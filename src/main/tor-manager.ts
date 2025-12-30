/**
 * Tor Manager for FlashAppAI Browser Phantom Mode
 * 
 * Provides Tor network integration for anonymous browsing:
 * - SOCKS5 proxy routing through Tor
 * - Circuit management
 * - .onion site support
 * - Connection status monitoring
 * 
 * Note: Requires Tor to be installed on the system or bundled with the app
 * macOS: brew install tor
 * Windows: Download from torproject.org
 * Linux: apt install tor
 */

import { app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';

interface TorStatus {
  connected: boolean;
  circuitEstablished: boolean;
  socksPort: number;
  controlPort: number;
  exitNode?: string;
  country?: string;
  latency?: number;
  error?: string;
}

export class TorManager {
  private torProcess: ChildProcess | null = null;
  private socksPort: number = 9050;
  private controlPort: number = 9051;
  private status: TorStatus = {
    connected: false,
    circuitEstablished: false,
    socksPort: 9050,
    controlPort: 9051,
  };
  private statusCallbacks: ((status: TorStatus) => void)[] = [];
  private torDataDir: string;

  constructor() {
    this.torDataDir = path.join(app.getPath('userData'), 'tor-data');
    
    // Create Tor data directory if it doesn't exist
    if (!fs.existsSync(this.torDataDir)) {
      fs.mkdirSync(this.torDataDir, { recursive: true });
    }
  }

  /**
   * Start Tor daemon
   */
  public async start(): Promise<boolean> {
    console.log('🧅 Starting Tor...');

    // Check if Tor is already running
    if (await this.checkTorRunning()) {
      console.log('✅ Tor is already running');
      this.status.connected = true;
      this.status.circuitEstablished = true;
      this.notifyStatusChange();
      return true;
    }

    // Find Tor executable
    const torPath = await this.findTorExecutable();
    if (!torPath) {
      this.status.error = 'Tor not found. Please install Tor to use Phantom Mode with anonymity.';
      console.error('❌ Tor executable not found');
      this.notifyStatusChange();
      return false;
    }

    return new Promise((resolve) => {
      try {
        // Create torrc configuration
        const torrcPath = path.join(this.torDataDir, 'torrc');
        const torrc = `
SocksPort ${this.socksPort}
ControlPort ${this.controlPort}
DataDirectory ${this.torDataDir}
Log notice stdout
`;
        fs.writeFileSync(torrcPath, torrc);

        // Start Tor process
        this.torProcess = spawn(torPath, ['-f', torrcPath], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let bootstrapped = false;

        this.torProcess.stdout?.on('data', (data: Buffer) => {
          const output = data.toString();
          console.log('🧅 Tor:', output.trim());

          // Check for bootstrap completion
          if (output.includes('Bootstrapped 100%') && !bootstrapped) {
            bootstrapped = true;
            this.status.connected = true;
            this.status.circuitEstablished = true;
            this.status.error = undefined;
            this.notifyStatusChange();
            console.log('✅ Tor connected and bootstrapped');
            resolve(true);
          }

          // Parse bootstrap progress
          const progressMatch = output.match(/Bootstrapped (\d+)%/);
          if (progressMatch) {
            const progress = parseInt(progressMatch[1]);
            console.log(`🧅 Tor bootstrap: ${progress}%`);
          }
        });

        this.torProcess.stderr?.on('data', (data: Buffer) => {
          console.error('🧅 Tor error:', data.toString().trim());
        });

        this.torProcess.on('close', (code) => {
          console.log(`🧅 Tor process exited with code ${code}`);
          this.status.connected = false;
          this.status.circuitEstablished = false;
          this.torProcess = null;
          this.notifyStatusChange();
          if (!bootstrapped) {
            resolve(false);
          }
        });

        this.torProcess.on('error', (err) => {
          console.error('🧅 Tor process error:', err);
          this.status.error = err.message;
          this.notifyStatusChange();
          resolve(false);
        });

        // Timeout after 60 seconds
        setTimeout(() => {
          if (!bootstrapped) {
            console.error('❌ Tor bootstrap timeout');
            this.status.error = 'Tor connection timeout';
            this.notifyStatusChange();
            this.stop();
            resolve(false);
          }
        }, 60000);

      } catch (error) {
        console.error('❌ Failed to start Tor:', error);
        this.status.error = (error as Error).message;
        this.notifyStatusChange();
        resolve(false);
      }
    });
  }

  /**
   * Stop Tor daemon
   */
  public stop() {
    if (this.torProcess) {
      console.log('🧅 Stopping Tor...');
      this.torProcess.kill('SIGTERM');
      this.torProcess = null;
    }
    this.status.connected = false;
    this.status.circuitEstablished = false;
    this.notifyStatusChange();
  }

  /**
   * Check if Tor is already running (e.g., system Tor)
   */
  private async checkTorRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(this.socksPort, '127.0.0.1');
    });
  }

  /**
   * Find Tor executable on the system
   */
  private async findTorExecutable(): Promise<string | null> {
    const possiblePaths = [];

    if (process.platform === 'darwin') {
      possiblePaths.push(
        '/usr/local/bin/tor',
        '/opt/homebrew/bin/tor',
        '/opt/local/bin/tor',
        path.join(app.getAppPath(), 'tor', 'tor'),
      );
    } else if (process.platform === 'win32') {
      possiblePaths.push(
        'C:\\Program Files\\Tor Browser\\Browser\\TorBrowser\\Tor\\tor.exe',
        'C:\\Program Files (x86)\\Tor Browser\\Browser\\TorBrowser\\Tor\\tor.exe',
        path.join(app.getAppPath(), 'tor', 'tor.exe'),
        path.join(process.env.APPDATA || '', 'tor', 'tor.exe'),
      );
    } else {
      // Linux
      possiblePaths.push(
        '/usr/bin/tor',
        '/usr/local/bin/tor',
        path.join(app.getAppPath(), 'tor', 'tor'),
      );
    }

    for (const torPath of possiblePaths) {
      if (fs.existsSync(torPath)) {
        console.log('🧅 Found Tor at:', torPath);
        return torPath;
      }
    }

    return null;
  }

  /**
   * Configure session to use Tor proxy
   */
  public async configureSession(ses: Electron.Session): Promise<boolean> {
    const proxyUrl = `socks5://127.0.0.1:${this.socksPort}`;
    
    try {
      await ses.setProxy({
        proxyRules: proxyUrl,
        proxyBypassRules: '', // Route everything through Tor
      });
      
      console.log('🧅 Session configured to use Tor proxy');
      return true;
    } catch (error) {
      console.error('❌ Failed to configure Tor proxy:', error);
      return false;
    }
  }

  /**
   * Request a new Tor circuit (new identity)
   */
  public async newCircuit(): Promise<boolean> {
    // Send NEWNYM signal to Tor control port
    return new Promise((resolve) => {
      const socket = new net.Socket();
      
      socket.on('connect', () => {
        // Authenticate (no password by default)
        socket.write('AUTHENTICATE\r\n');
      });
      
      socket.on('data', (data) => {
        const response = data.toString();
        
        if (response.includes('250 OK')) {
          if (response.includes('AUTHENTICATE')) {
            // Request new circuit
            socket.write('SIGNAL NEWNYM\r\n');
          } else {
            console.log('🧅 New Tor circuit established');
            socket.destroy();
            resolve(true);
          }
        } else {
          console.error('🧅 Tor control error:', response);
          socket.destroy();
          resolve(false);
        }
      });
      
      socket.on('error', (err) => {
        console.error('🧅 Tor control connection error:', err);
        resolve(false);
      });
      
      socket.connect(this.controlPort, '127.0.0.1');
    });
  }

  /**
   * Get current Tor status
   */
  public getStatus(): TorStatus {
    return { ...this.status };
  }

  /**
   * Register status change callback
   */
  public onStatusChange(callback: (status: TorStatus) => void) {
    this.statusCallbacks.push(callback);
  }

  /**
   * Notify all callbacks of status change
   */
  private notifyStatusChange() {
    for (const callback of this.statusCallbacks) {
      callback(this.getStatus());
    }
  }

  /**
   * Check if a URL is a .onion address
   */
  public isOnionAddress(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.endsWith('.onion');
    } catch {
      return false;
    }
  }

  /**
   * Get installation instructions for Tor
   */
  public getInstallInstructions(): string {
    if (process.platform === 'darwin') {
      return `To enable Tor anonymity in Phantom Mode:

1. Install Homebrew (if not installed):
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

2. Install Tor:
   brew install tor

3. Restart the browser

Or download Tor Browser from: https://www.torproject.org`;
    } else if (process.platform === 'win32') {
      return `To enable Tor anonymity in Phantom Mode:

1. Download Tor Browser from: https://www.torproject.org
2. Install it to the default location
3. Restart the browser

Or install Tor Expert Bundle from the Tor Project website.`;
    } else {
      return `To enable Tor anonymity in Phantom Mode:

1. Install Tor:
   sudo apt install tor    # Debian/Ubuntu
   sudo dnf install tor    # Fedora
   sudo pacman -S tor      # Arch

2. Start Tor service:
   sudo systemctl start tor

3. Restart the browser`;
    }
  }
}

export const torManager = new TorManager();

