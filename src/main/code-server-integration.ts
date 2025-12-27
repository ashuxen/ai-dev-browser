import WebSocket from 'ws';
import Store from 'electron-store';
import { EventEmitter } from 'events';

interface CodeServerConfig {
  url: string;
  autoConnect: boolean;
  reconnectAttempts: number;
  reconnectDelay: number;
}

interface CodeServerStatus {
  connected: boolean;
  url: string | null;
  lastConnected: number | null;
  reconnecting: boolean;
  version?: string;
}

interface CodeMessage {
  type: 'code' | 'command' | 'token' | 'file' | 'notification';
  payload: unknown;
  metadata?: {
    language?: string;
    filename?: string;
    cursor?: { line: number; column: number };
  };
}

export class CodeServerIntegration extends EventEmitter {
  private ws: WebSocket | null = null;
  private store: Store<{ config: CodeServerConfig }>;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private status: CodeServerStatus = {
    connected: false,
    url: null,
    lastConnected: null,
    reconnecting: false,
  };

  constructor() {
    super();
    this.store = new Store({
      name: 'code-server-config',
      defaults: {
        config: {
          url: '',
          autoConnect: true,
          reconnectAttempts: 5,
          reconnectDelay: 3000,
        },
      },
    });

    // Auto-connect if configured
    const config = this.store.get('config');
    if (config.autoConnect && config.url) {
      setTimeout(() => this.connect(config.url), 1000);
    }
  }

  /**
   * Connect to a code-server instance
   */
  async connect(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // Clean up existing connection
        this.disconnect();

        // Normalize URL
        const wsUrl = this.normalizeWebSocketUrl(url);
        console.log('[CodeServer] Connecting to:', wsUrl);

        this.ws = new WebSocket(wsUrl, {
          headers: {
            'User-Agent': 'AI-Dev-Browser/1.0',
          },
        });

        this.ws.on('open', () => {
          console.log('[CodeServer] Connected successfully');
          this.status = {
            connected: true,
            url: url,
            lastConnected: Date.now(),
            reconnecting: false,
          };
          this.reconnectAttempts = 0;
          
          // Save successful connection URL
          const config = this.store.get('config');
          this.store.set('config', { ...config, url });

          // Send handshake
          this.send({
            type: 'command',
            payload: { action: 'handshake', client: 'ai-dev-browser', version: '1.0' },
          });

          this.emit('connected', this.status);
          resolve(true);
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            console.warn('[CodeServer] Failed to parse message:', error);
          }
        });

        this.ws.on('close', (code, reason) => {
          console.log('[CodeServer] Connection closed:', code, reason.toString());
          this.status.connected = false;
          this.emit('disconnected', { code, reason: reason.toString() });
          this.attemptReconnect();
        });

        this.ws.on('error', (error) => {
          console.error('[CodeServer] WebSocket error:', error);
          this.emit('error', error);
          if (!this.status.connected) {
            resolve(false);
          }
        });

        // Connection timeout
        setTimeout(() => {
          if (!this.status.connected) {
            this.ws?.close();
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        console.error('[CodeServer] Connection failed:', error);
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from code-server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.status = {
      connected: false,
      url: null,
      lastConnected: this.status.lastConnected,
      reconnecting: false,
    };

    this.emit('disconnected', { manual: true });
  }

  /**
   * Send code to code-server
   */
  async sendCode(code: string, language?: string): Promise<boolean> {
    if (!this.isConnected()) {
      console.warn('[CodeServer] Not connected, cannot send code');
      return false;
    }

    return this.send({
      type: 'code',
      payload: { content: code },
      metadata: { language },
    });
  }

  /**
   * Send a file to code-server
   */
  async sendFile(filename: string, content: string): Promise<boolean> {
    if (!this.isConnected()) {
      console.warn('[CodeServer] Not connected, cannot send file');
      return false;
    }

    return this.send({
      type: 'file',
      payload: { content },
      metadata: { filename },
    });
  }

  /**
   * Send OAuth token to code-server
   */
  async sendToken(provider: string, token: string): Promise<boolean> {
    if (!this.isConnected()) {
      console.warn('[CodeServer] Not connected, cannot send token');
      return false;
    }

    return this.send({
      type: 'token',
      payload: { provider, token },
    });
  }

  /**
   * Execute a command in code-server
   */
  async executeCommand(command: string, args?: unknown[]): Promise<boolean> {
    if (!this.isConnected()) {
      console.warn('[CodeServer] Not connected, cannot execute command');
      return false;
    }

    return this.send({
      type: 'command',
      payload: { action: 'execute', command, args },
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get current status
   */
  getStatus(): CodeServerStatus {
    return { ...this.status };
  }

  /**
   * Get stored configuration
   */
  getConfig(): CodeServerConfig {
    return this.store.get('config');
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<CodeServerConfig>): void {
    const current = this.store.get('config');
    this.store.set('config', { ...current, ...config });
  }

  /**
   * Send a message to code-server
   */
  private send(message: CodeMessage): boolean {
    if (!this.isConnected() || !this.ws) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now(),
        source: 'ai-dev-browser',
      }));
      return true;
    } catch (error) {
      console.error('[CodeServer] Failed to send message:', error);
      return false;
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: CodeMessage): void {
    console.log('[CodeServer] Received message:', message.type);

    switch (message.type) {
      case 'command':
        this.handleCommand(message);
        break;
      case 'notification':
        this.emit('notification', message.payload);
        break;
      default:
        this.emit('message', message);
    }
  }

  /**
   * Handle command messages
   */
  private handleCommand(message: CodeMessage): void {
    const payload = message.payload as { action: string; [key: string]: unknown };

    switch (payload.action) {
      case 'version':
        this.status.version = payload.version as string;
        break;
      case 'request-token':
        this.emit('token-requested', payload.provider);
        break;
      case 'open-url':
        this.emit('open-url', payload.url);
        break;
      default:
        this.emit('command', payload);
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    const config = this.store.get('config');
    
    if (!config.url || this.reconnectAttempts >= config.reconnectAttempts) {
      this.status.reconnecting = false;
      return;
    }

    this.status.reconnecting = true;
    this.reconnectAttempts++;

    console.log(`[CodeServer] Reconnecting (attempt ${this.reconnectAttempts}/${config.reconnectAttempts})...`);

    this.reconnectTimer = setTimeout(() => {
      this.connect(config.url);
    }, config.reconnectDelay);
  }

  /**
   * Normalize URL to WebSocket format
   */
  private normalizeWebSocketUrl(url: string): string {
    let wsUrl = url.trim();

    // Add protocol if missing
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      if (wsUrl.startsWith('https://')) {
        wsUrl = wsUrl.replace('https://', 'wss://');
      } else if (wsUrl.startsWith('http://')) {
        wsUrl = wsUrl.replace('http://', 'ws://');
      } else {
        // Default to wss for security
        wsUrl = `wss://${wsUrl}`;
      }
    }

    // Add WebSocket endpoint path if not present
    if (!wsUrl.includes('/ws') && !wsUrl.includes('/websocket')) {
      wsUrl = wsUrl.replace(/\/?$/, '/api/v1/ai-dev-browser');
    }

    return wsUrl;
  }
}

