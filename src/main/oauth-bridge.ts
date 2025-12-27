import Store from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

interface OAuthToken {
  id: string;
  provider: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  createdAt: number;
}

interface OAuthProviderConfig {
  name: string;
  callbackPatterns: RegExp[];
  tokenExtractors: {
    code?: RegExp;
    token?: RegExp;
    state?: RegExp;
  };
}

const OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  {
    name: 'github',
    callbackPatterns: [
      /callback.*github/i,
      /github.*callback/i,
      /oauth.*github/i,
      /github.*oauth/i,
    ],
    tokenExtractors: {
      code: /[?&]code=([^&]+)/,
      state: /[?&]state=([^&]+)/,
    },
  },
  {
    name: 'google',
    callbackPatterns: [
      /callback.*google/i,
      /google.*callback/i,
      /oauth2.*google/i,
    ],
    tokenExtractors: {
      code: /[?&]code=([^&]+)/,
      token: /[?&#]access_token=([^&]+)/,
      state: /[?&]state=([^&]+)/,
    },
  },
  {
    name: 'microsoft',
    callbackPatterns: [
      /callback.*microsoft/i,
      /microsoft.*callback/i,
      /oauth.*azure/i,
      /login\.microsoftonline/i,
    ],
    tokenExtractors: {
      code: /[?&]code=([^&]+)/,
      token: /[?&#]access_token=([^&]+)/,
      state: /[?&]state=([^&]+)/,
    },
  },
  {
    name: 'openai',
    callbackPatterns: [
      /callback.*openai/i,
      /openai.*callback/i,
      /oauth.*openai/i,
    ],
    tokenExtractors: {
      code: /[?&]code=([^&]+)/,
      token: /[?&#]access_token=([^&]+)/,
    },
  },
  {
    name: 'gitlab',
    callbackPatterns: [
      /callback.*gitlab/i,
      /gitlab.*callback/i,
      /oauth.*gitlab/i,
    ],
    tokenExtractors: {
      code: /[?&]code=([^&]+)/,
      state: /[?&]state=([^&]+)/,
    },
  },
  {
    name: 'bitbucket',
    callbackPatterns: [
      /callback.*bitbucket/i,
      /bitbucket.*callback/i,
      /oauth.*bitbucket/i,
    ],
    tokenExtractors: {
      code: /[?&]code=([^&]+)/,
      state: /[?&]state=([^&]+)/,
    },
  },
  {
    name: 'anthropic',
    callbackPatterns: [
      /callback.*anthropic/i,
      /anthropic.*callback/i,
      /oauth.*claude/i,
    ],
    tokenExtractors: {
      code: /[?&]code=([^&]+)/,
      token: /[?&#]access_token=([^&]+)/,
    },
  },
];

export class OAuthBridge {
  private store: Store<{ tokens: OAuthToken[] }>;
  private pendingCallbacks: Map<string, {
    provider: string;
    resolve: (token: OAuthToken) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  constructor() {
    this.store = new Store({
      name: 'oauth-tokens',
      encryptionKey: 'ai-dev-browser-oauth-encryption-key',
      defaults: {
        tokens: [],
      },
    });
  }

  /**
   * Check if a URL is an OAuth callback
   */
  isOAuthCallback(url: URL): boolean {
    const fullUrl = url.toString();
    const pathname = url.pathname;
    
    // Check for common OAuth callback patterns
    const callbackIndicators = [
      'callback',
      'oauth',
      'auth/redirect',
      'authorize/callback',
      'signin-callback',
    ];

    const hasCallbackPath = callbackIndicators.some(
      indicator => pathname.toLowerCase().includes(indicator)
    );

    // Check for OAuth parameters
    const hasOAuthParams = 
      url.searchParams.has('code') ||
      url.searchParams.has('access_token') ||
      url.hash.includes('access_token');

    // Check provider-specific patterns
    const matchesProvider = OAUTH_PROVIDERS.some(provider =>
      provider.callbackPatterns.some(pattern => pattern.test(fullUrl))
    );

    return (hasCallbackPath && hasOAuthParams) || matchesProvider;
  }

  /**
   * Identify the OAuth provider from a URL
   */
  identifyProvider(url: URL): string {
    const fullUrl = url.toString();
    
    for (const provider of OAUTH_PROVIDERS) {
      if (provider.callbackPatterns.some(pattern => pattern.test(fullUrl))) {
        return provider.name;
      }
    }

    // Try to identify from URL parts
    const urlLower = fullUrl.toLowerCase();
    if (urlLower.includes('github')) return 'github';
    if (urlLower.includes('google')) return 'google';
    if (urlLower.includes('microsoft') || urlLower.includes('azure')) return 'microsoft';
    if (urlLower.includes('openai')) return 'openai';
    if (urlLower.includes('gitlab')) return 'gitlab';
    if (urlLower.includes('bitbucket')) return 'bitbucket';
    if (urlLower.includes('anthropic') || urlLower.includes('claude')) return 'anthropic';

    return 'unknown';
  }

  /**
   * Handle an OAuth callback URL
   */
  async handleCallback(callbackUrl: string): Promise<OAuthToken | null> {
    console.log('[OAuthBridge] Handling callback:', callbackUrl);
    
    try {
      const url = new URL(callbackUrl);
      const provider = this.identifyProvider(url);
      const providerConfig = OAUTH_PROVIDERS.find(p => p.name === provider);

      // Extract tokens/codes
      let code: string | null = null;
      let accessToken: string | null = null;
      let state: string | null = null;

      // Try URL parameters first
      code = url.searchParams.get('code');
      accessToken = url.searchParams.get('access_token');
      state = url.searchParams.get('state');

      // Try hash fragment (for implicit flow)
      if (!accessToken && url.hash) {
        const hashParams = new URLSearchParams(url.hash.substring(1));
        accessToken = hashParams.get('access_token');
        state = hashParams.get('state');
      }

      // Try provider-specific extractors
      if (providerConfig) {
        if (!code && providerConfig.tokenExtractors.code) {
          const match = callbackUrl.match(providerConfig.tokenExtractors.code);
          if (match) code = match[1];
        }
        if (!accessToken && providerConfig.tokenExtractors.token) {
          const match = callbackUrl.match(providerConfig.tokenExtractors.token);
          if (match) accessToken = match[1];
        }
      }

      if (!code && !accessToken) {
        console.warn('[OAuthBridge] No token or code found in callback');
        return null;
      }

      const token: OAuthToken = {
        id: uuidv4(),
        provider,
        accessToken: accessToken || code || '',
        createdAt: Date.now(),
      };

      // Store the token
      this.storeToken(token);

      // Resolve any pending callbacks
      if (state && this.pendingCallbacks.has(state)) {
        const pending = this.pendingCallbacks.get(state)!;
        clearTimeout(pending.timeout);
        pending.resolve(token);
        this.pendingCallbacks.delete(state);
      }

      console.log('[OAuthBridge] Token stored for provider:', provider);
      return token;
    } catch (error) {
      console.error('[OAuthBridge] Error handling callback:', error);
      return null;
    }
  }

  /**
   * Handle vscode:// protocol callbacks
   */
  handleVSCodeCallback(url: string): OAuthToken | null {
    console.log('[OAuthBridge] Handling vscode:// callback:', url);
    
    try {
      // vscode://vscode.github-authentication/did-authenticate?windowId=1&code=...
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');
      const provider = url.includes('github') ? 'github' : 'vscode';

      if (!code) {
        console.warn('[OAuthBridge] No code in vscode callback');
        return null;
      }

      const token: OAuthToken = {
        id: uuidv4(),
        provider,
        accessToken: code,
        createdAt: Date.now(),
      };

      this.storeToken(token);
      return token;
    } catch (error) {
      console.error('[OAuthBridge] Error handling vscode callback:', error);
      return null;
    }
  }

  /**
   * Store a token securely
   */
  private storeToken(token: OAuthToken): void {
    const tokens = this.store.get('tokens', []);
    
    // Remove existing token for same provider
    const filtered = tokens.filter(t => t.provider !== token.provider);
    filtered.push(token);
    
    this.store.set('tokens', filtered);
  }

  /**
   * Get all stored tokens
   */
  getStoredTokens(): OAuthToken[] {
    return this.store.get('tokens', []);
  }

  /**
   * Get token for a specific provider
   */
  getTokenForProvider(provider: string): OAuthToken | undefined {
    const tokens = this.store.get('tokens', []);
    return tokens.find(t => t.provider === provider);
  }

  /**
   * Remove token for a provider
   */
  removeToken(provider: string): void {
    const tokens = this.store.get('tokens', []);
    const filtered = tokens.filter(t => t.provider !== provider);
    this.store.set('tokens', filtered);
  }

  /**
   * Clear all tokens
   */
  clearAllTokens(): void {
    this.store.set('tokens', []);
  }

  /**
   * Get OAuth bridge status
   */
  getStatus(): { active: boolean; providers: string[]; tokenCount: number } {
    const tokens = this.store.get('tokens', []);
    return {
      active: true,
      providers: tokens.map(t => t.provider),
      tokenCount: tokens.length,
    };
  }

  /**
   * Wait for an OAuth callback with a specific state
   */
  waitForCallback(state: string, provider: string, timeoutMs = 300000): Promise<OAuthToken> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCallbacks.delete(state);
        reject(new Error('OAuth callback timeout'));
      }, timeoutMs);

      this.pendingCallbacks.set(state, { provider, resolve, reject, timeout });
    });
  }
}

