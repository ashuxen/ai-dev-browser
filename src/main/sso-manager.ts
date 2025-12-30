/**
 * SSO Manager for FlashAppAI Browser
 * 
 * Provides enterprise Single Sign-On support:
 * - SAML 2.0 authentication
 * - OAuth 2.0 / OpenID Connect
 * - Enterprise identity providers (Azure AD, Okta, Google Workspace, etc.)
 * - Session management
 * - Token refresh handling
 */

import { BrowserWindow } from 'electron';
import ElectronStore from 'electron-store';
import { v4 as uuidv4 } from 'uuid';

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oauth' | 'oidc';
  enabled: boolean;
  config: SAMLConfig | OAuthConfig;
}

interface SAMLConfig {
  entryPoint: string;  // Identity Provider SSO URL
  issuer: string;      // Service Provider Entity ID
  cert?: string;       // IdP Certificate for signature validation
  callbackUrl: string; // Assertion Consumer Service URL
}

interface OAuthConfig {
  clientId: string;
  clientSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  scopes: string[];
  redirectUri: string;
  pkce?: boolean;      // Use PKCE for public clients
}

interface SSOSession {
  providerId: string;
  userId: string;
  email?: string;
  name?: string;
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt?: number;
  attributes?: Record<string, any>;
}

// Pre-configured enterprise providers
const defaultProviders: SSOProvider[] = [
  {
    id: 'azure-ad',
    name: 'Microsoft Azure AD',
    type: 'oidc',
    enabled: true,
    config: {
      clientId: '', // User must configure
      authorizationUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      userInfoUrl: 'https://graph.microsoft.com/oidc/userinfo',
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      redirectUri: 'flashappai://auth/callback',
      pkce: true,
    } as OAuthConfig,
  },
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    type: 'oidc',
    enabled: true,
    config: {
      clientId: '', // User must configure
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
      scopes: ['openid', 'profile', 'email'],
      redirectUri: 'flashappai://auth/callback',
      pkce: true,
    } as OAuthConfig,
  },
  {
    id: 'okta',
    name: 'Okta',
    type: 'oidc',
    enabled: true,
    config: {
      clientId: '', // User must configure
      authorizationUrl: '', // e.g., https://your-domain.okta.com/oauth2/default/v1/authorize
      tokenUrl: '', // e.g., https://your-domain.okta.com/oauth2/default/v1/token
      userInfoUrl: '', // e.g., https://your-domain.okta.com/oauth2/default/v1/userinfo
      scopes: ['openid', 'profile', 'email'],
      redirectUri: 'flashappai://auth/callback',
      pkce: true,
    } as OAuthConfig,
  },
  {
    id: 'github',
    name: 'GitHub',
    type: 'oauth',
    enabled: true,
    config: {
      clientId: '', // User must configure
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scopes: ['read:user', 'user:email'],
      redirectUri: 'flashappai://auth/callback',
    } as OAuthConfig,
  },
];

export class SSOManager {
  private store: ElectronStore;
  private providers: SSOProvider[];
  private sessions: Map<string, SSOSession> = new Map();
  private authWindow: BrowserWindow | null = null;
  private pendingAuth: {
    providerId: string;
    codeVerifier?: string;
    state: string;
    resolve: (session: SSOSession | null) => void;
  } | null = null;

  constructor() {
    this.store = new ElectronStore({ name: 'sso-config' });
    this.providers = this.store.get('providers', defaultProviders) as SSOProvider[];
    
    // Load saved sessions
    const savedSessions = this.store.get('sessions', {}) as Record<string, SSOSession>;
    for (const [key, session] of Object.entries(savedSessions)) {
      this.sessions.set(key, session);
    }
  }

  /**
   * Get all configured SSO providers
   */
  public getProviders(): SSOProvider[] {
    return this.providers.map(p => ({
      ...p,
      config: { ...p.config, clientSecret: undefined } // Don't expose secrets
    }));
  }

  /**
   * Configure an SSO provider
   */
  public configureProvider(providerId: string, config: Partial<SAMLConfig | OAuthConfig>): boolean {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider) return false;

    provider.config = { ...provider.config, ...config };
    this.saveProviders();
    return true;
  }

  /**
   * Add a custom SSO provider
   */
  public addProvider(provider: SSOProvider): void {
    // Remove existing with same ID
    this.providers = this.providers.filter(p => p.id !== provider.id);
    this.providers.push(provider);
    this.saveProviders();
  }

  /**
   * Remove an SSO provider
   */
  public removeProvider(providerId: string): void {
    this.providers = this.providers.filter(p => p.id !== providerId);
    this.saveProviders();
  }

  /**
   * Start SSO authentication flow
   */
  public async authenticate(providerId: string): Promise<SSOSession | null> {
    const provider = this.providers.find(p => p.id === providerId);
    if (!provider || !provider.enabled) {
      console.error(`SSO provider not found or disabled: ${providerId}`);
      return null;
    }

    if (provider.type === 'oauth' || provider.type === 'oidc') {
      return this.startOAuthFlow(provider);
    } else if (provider.type === 'saml') {
      return this.startSAMLFlow(provider);
    }

    return null;
  }

  /**
   * Start OAuth 2.0 / OIDC flow
   */
  private async startOAuthFlow(provider: SSOProvider): Promise<SSOSession | null> {
    const config = provider.config as OAuthConfig;
    
    if (!config.clientId) {
      console.error('OAuth client ID not configured');
      return null;
    }

    return new Promise((resolve) => {
      const state = uuidv4();
      let codeVerifier: string | undefined;
      let authUrl = `${config.authorizationUrl}?`;
      
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        scope: config.scopes.join(' '),
        state: state,
      });

      // Add PKCE if enabled
      if (config.pkce) {
        codeVerifier = this.generateCodeVerifier();
        const codeChallenge = this.generateCodeChallenge(codeVerifier);
        params.append('code_challenge', codeChallenge);
        params.append('code_challenge_method', 'S256');
      }

      authUrl += params.toString();

      this.pendingAuth = {
        providerId: provider.id,
        codeVerifier,
        state,
        resolve,
      };

      // Open auth window
      this.authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        title: `Sign in with ${provider.name}`,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      this.authWindow.loadURL(authUrl);

      // Handle navigation to callback URL
      this.authWindow.webContents.on('will-navigate', (event, url) => {
        this.handleOAuthCallback(url, provider);
      });

      this.authWindow.webContents.on('will-redirect', (event, url) => {
        this.handleOAuthCallback(url, provider);
      });

      this.authWindow.on('closed', () => {
        this.authWindow = null;
        if (this.pendingAuth) {
          this.pendingAuth.resolve(null);
          this.pendingAuth = null;
        }
      });
    });
  }

  /**
   * Handle OAuth callback
   */
  private async handleOAuthCallback(url: string, provider: SSOProvider) {
    if (!url.startsWith('flashappai://auth/callback') && !url.includes('code=')) {
      return;
    }

    const urlObj = new URL(url.replace('flashappai://', 'https://'));
    const code = urlObj.searchParams.get('code');
    const state = urlObj.searchParams.get('state');
    const error = urlObj.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      this.authWindow?.close();
      this.pendingAuth?.resolve(null);
      this.pendingAuth = null;
      return;
    }

    if (!code || !this.pendingAuth || state !== this.pendingAuth.state) {
      console.error('Invalid OAuth response');
      this.authWindow?.close();
      this.pendingAuth?.resolve(null);
      this.pendingAuth = null;
      return;
    }

    // Exchange code for tokens
    const config = provider.config as OAuthConfig;
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      code: code,
      redirect_uri: config.redirectUri,
    });

    if (config.clientSecret) {
      tokenParams.append('client_secret', config.clientSecret);
    }

    if (this.pendingAuth.codeVerifier) {
      tokenParams.append('code_verifier', this.pendingAuth.codeVerifier);
    }

    try {
      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: tokenParams.toString(),
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
      }

      // Create session
      const ssoSession: SSOSession = {
        providerId: provider.id,
        userId: '',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        idToken: tokens.id_token,
        expiresAt: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined,
      };

      // Get user info
      if (config.userInfoUrl && tokens.access_token) {
        const userInfoResponse = await fetch(config.userInfoUrl, {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
          },
        });
        const userInfo = await userInfoResponse.json();
        ssoSession.userId = userInfo.sub || userInfo.id || userInfo.login;
        ssoSession.email = userInfo.email;
        ssoSession.name = userInfo.name || userInfo.login;
        ssoSession.attributes = userInfo;
      }

      // Save session
      this.sessions.set(provider.id, ssoSession);
      this.saveSessions();

      this.authWindow?.close();
      this.pendingAuth.resolve(ssoSession);
      this.pendingAuth = null;

      console.log(`✅ SSO authentication successful: ${provider.name}`);

    } catch (error) {
      console.error('Token exchange failed:', error);
      this.authWindow?.close();
      this.pendingAuth?.resolve(null);
      this.pendingAuth = null;
    }
  }

  /**
   * Start SAML flow
   */
  private async startSAMLFlow(provider: SSOProvider): Promise<SSOSession | null> {
    const config = provider.config as SAMLConfig;
    
    return new Promise((resolve) => {
      // Generate SAML AuthnRequest
      const samlRequest = this.generateSAMLRequest(config);
      const authUrl = `${config.entryPoint}?SAMLRequest=${encodeURIComponent(samlRequest)}`;

      this.pendingAuth = {
        providerId: provider.id,
        state: uuidv4(),
        resolve,
      };

      this.authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        title: `Sign in with ${provider.name}`,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      this.authWindow.loadURL(authUrl);

      // Handle SAML response
      this.authWindow.webContents.on('will-navigate', (event, url) => {
        if (url.includes(config.callbackUrl)) {
          this.handleSAMLResponse(url, provider);
        }
      });

      this.authWindow.on('closed', () => {
        this.authWindow = null;
        if (this.pendingAuth) {
          this.pendingAuth.resolve(null);
          this.pendingAuth = null;
        }
      });
    });
  }

  /**
   * Generate SAML AuthnRequest (simplified)
   */
  private generateSAMLRequest(config: SAMLConfig): string {
    const id = '_' + uuidv4();
    const issueInstant = new Date().toISOString();
    
    const request = `
      <samlp:AuthnRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${issueInstant}"
        AssertionConsumerServiceURL="${config.callbackUrl}"
        ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
        <saml:Issuer>${config.issuer}</saml:Issuer>
      </samlp:AuthnRequest>
    `;
    
    // Base64 encode and deflate
    return Buffer.from(request).toString('base64');
  }

  /**
   * Handle SAML response
   */
  private handleSAMLResponse(url: string, provider: SSOProvider) {
    // In a real implementation, you would parse and validate the SAML response
    // This is a simplified version
    console.log('SAML response received:', url);
    
    // Create a basic session
    const ssoSession: SSOSession = {
      providerId: provider.id,
      userId: 'saml-user',
    };

    this.sessions.set(provider.id, ssoSession);
    this.saveSessions();

    this.authWindow?.close();
    this.pendingAuth?.resolve(ssoSession);
    this.pendingAuth = null;
  }

  /**
   * Get current session for a provider
   */
  public getSession(providerId: string): SSOSession | null {
    const session = this.sessions.get(providerId);
    
    // Check if session is expired
    if (session?.expiresAt && Date.now() > session.expiresAt) {
      // Try to refresh
      this.refreshSession(providerId);
      return null;
    }
    
    return session || null;
  }

  /**
   * Refresh an expired session
   */
  public async refreshSession(providerId: string): Promise<boolean> {
    const session = this.sessions.get(providerId);
    const provider = this.providers.find(p => p.id === providerId);
    
    if (!session?.refreshToken || !provider) return false;

    const config = provider.config as OAuthConfig;
    
    try {
      const tokenParams = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId,
        refresh_token: session.refreshToken,
      });

      if (config.clientSecret) {
        tokenParams.append('client_secret', config.clientSecret);
      }

      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: tokenParams.toString(),
      });

      const tokens = await response.json();
      
      if (tokens.error) {
        throw new Error(tokens.error);
      }

      session.accessToken = tokens.access_token;
      if (tokens.refresh_token) {
        session.refreshToken = tokens.refresh_token;
      }
      session.expiresAt = tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined;

      this.sessions.set(providerId, session);
      this.saveSessions();
      
      return true;
    } catch (error) {
      console.error('Session refresh failed:', error);
      return false;
    }
  }

  /**
   * Logout from a provider
   */
  public logout(providerId: string): void {
    this.sessions.delete(providerId);
    this.saveSessions();
  }

  /**
   * Logout from all providers
   */
  public logoutAll(): void {
    this.sessions.clear();
    this.saveSessions();
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    require('crypto').randomFillSync(array);
    return Buffer.from(array).toString('base64url');
  }

  /**
   * Generate PKCE code challenge
   */
  private generateCodeChallenge(verifier: string): string {
    const hash = require('crypto').createHash('sha256').update(verifier).digest();
    return Buffer.from(hash).toString('base64url');
  }

  /**
   * Save providers to store
   */
  private saveProviders(): void {
    this.store.set('providers', this.providers);
  }

  /**
   * Save sessions to store
   */
  private saveSessions(): void {
    const sessionsObj: Record<string, SSOSession> = {};
    for (const [key, session] of this.sessions.entries()) {
      sessionsObj[key] = session;
    }
    this.store.set('sessions', sessionsObj);
  }
}

export const ssoManager = new SSOManager();

