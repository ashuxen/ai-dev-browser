/**
 * Security Manager for FlashAppAI Browser
 * 
 * Features:
 * - Popup blocking
 * - Permission management (camera, mic, location, notifications)
 * - HTTPS enforcement
 * - Certificate error handling
 * - Anti-fingerprinting protection
 * - Content Security Policy
 */

import { BrowserWindow, dialog, app } from 'electron';
import ElectronStore from 'electron-store';

interface SecuritySettings {
  blockPopups: boolean;
  enforceHttps: boolean;
  blockThirdPartyCookies: boolean;
  doNotTrack: boolean;
  antiFingerprinting: boolean;
  permissions: {
    camera: 'allow' | 'deny' | 'ask';
    microphone: 'allow' | 'deny' | 'ask';
    geolocation: 'allow' | 'deny' | 'ask';
    notifications: 'allow' | 'deny' | 'ask';
    midi: 'allow' | 'deny' | 'ask';
    pointerLock: 'allow' | 'deny' | 'ask';
    fullscreen: 'allow' | 'deny' | 'ask';
  };
  trustedDomains: string[];
  blockedDomains: string[];
}

const defaultSettings: SecuritySettings = {
  blockPopups: true,
  enforceHttps: true,
  blockThirdPartyCookies: false,
  doNotTrack: true,
  antiFingerprinting: true,
  permissions: {
    camera: 'ask',
    microphone: 'ask',
    geolocation: 'ask',
    notifications: 'ask',
    midi: 'deny',
    pointerLock: 'ask',
    fullscreen: 'allow',
  },
  trustedDomains: ['flashappai.org', 'google.com', 'github.com'],
  blockedDomains: [],
};

export class SecurityManager {
  private store: ElectronStore;
  private settings: SecuritySettings;
  private blockedPopups: Map<string, number> = new Map();

  constructor() {
    this.store = new ElectronStore({ name: 'security-settings' });
    this.settings = this.store.get('settings', defaultSettings) as SecuritySettings;
  }

  /**
   * Initialize security features for a session
   */
  public initializeSession(ses: Electron.Session, isPhantomMode: boolean = false) {
    console.log('🔐 Initializing security for session, phantom:', isPhantomMode);

    // Set up permission handler
    this.setupPermissionHandler(ses);

    // Set up popup blocking
    if (this.settings.blockPopups) {
      this.setupPopupBlocking(ses);
    }

    // Set up HTTPS enforcement
    if (this.settings.enforceHttps) {
      this.setupHttpsEnforcement(ses);
    }

    // Set up certificate error handling
    this.setupCertificateHandling(ses);

    // Set up anti-fingerprinting
    if (this.settings.antiFingerprinting || isPhantomMode) {
      this.setupAntiFingerprinting(ses);
    }

    // Set Do Not Track header
    if (this.settings.doNotTrack) {
      ses.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['DNT'] = '1';
        details.requestHeaders['Sec-GPC'] = '1'; // Global Privacy Control
        callback({ requestHeaders: details.requestHeaders });
      });
    }

    // Block third-party cookies if enabled
    if (this.settings.blockThirdPartyCookies || isPhantomMode) {
      ses.cookies.on('changed', (event, cookie, cause, removed) => {
        if (!removed && cookie.sameSite === 'no_restriction') {
          ses.cookies.remove(cookie.domain || '', cookie.name);
        }
      });
    }

    console.log('✅ Security initialized');
  }

  /**
   * Setup permission handler for camera, mic, location, etc.
   */
  private setupPermissionHandler(ses: Electron.Session) {
    ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const url = webContents.getURL();
      const domain = this.extractDomain(url);
      
      console.log(`🔒 Permission request: ${permission} from ${domain}`);

      // Map Electron permission names to our settings
      const permissionMap: Record<string, keyof SecuritySettings['permissions']> = {
        'media': 'camera', // Electron uses 'media' for camera/mic
        'geolocation': 'geolocation',
        'notifications': 'notifications',
        'midi': 'midi',
        'pointerLock': 'pointerLock',
        'fullscreen': 'fullscreen',
      };

      const settingKey = permissionMap[permission];
      if (!settingKey) {
        // Unknown permission - deny by default
        console.log(`❌ Unknown permission denied: ${permission}`);
        callback(false);
        return;
      }

      const setting = this.settings.permissions[settingKey];

      // Check if domain is trusted
      if (this.settings.trustedDomains.some(d => domain.includes(d))) {
        console.log(`✅ Trusted domain, allowing: ${permission}`);
        callback(true);
        return;
      }

      // Check if domain is blocked
      if (this.settings.blockedDomains.some(d => domain.includes(d))) {
        console.log(`❌ Blocked domain, denying: ${permission}`);
        callback(false);
        return;
      }

      switch (setting) {
        case 'allow':
          console.log(`✅ Permission allowed by policy: ${permission}`);
          callback(true);
          break;
        case 'deny':
          console.log(`❌ Permission denied by policy: ${permission}`);
          callback(false);
          break;
        case 'ask':
        default:
          // Show permission dialog
          this.showPermissionDialog(webContents, permission, domain, callback);
          break;
      }
    });

    // Handle permission check (for checking before requesting)
    ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      const domain = this.extractDomain(requestingOrigin);
      
      // Allow for trusted domains
      if (this.settings.trustedDomains.some(d => domain.includes(d))) {
        return true;
      }

      // Check specific permission setting
      const permissionMap: Record<string, keyof SecuritySettings['permissions']> = {
        'media': 'camera',
        'geolocation': 'geolocation',
        'notifications': 'notifications',
      };

      const settingKey = permissionMap[permission];
      if (settingKey && this.settings.permissions[settingKey] === 'allow') {
        return true;
      }

      return false;
    });
  }

  /**
   * Show permission request dialog
   */
  private showPermissionDialog(
    webContents: Electron.WebContents,
    permission: string,
    domain: string,
    callback: (granted: boolean) => void
  ) {
    const permissionNames: Record<string, string> = {
      'media': 'Camera & Microphone',
      'geolocation': 'Location',
      'notifications': 'Notifications',
      'midi': 'MIDI Devices',
      'pointerLock': 'Mouse Lock',
      'fullscreen': 'Fullscreen',
    };

    const permissionName = permissionNames[permission] || permission;
    const window = BrowserWindow.fromWebContents(webContents);

    if (!window) {
      callback(false);
      return;
    }

    dialog.showMessageBox(window, {
      type: 'question',
      buttons: ['Allow', 'Block', 'Ask Later'],
      defaultId: 2,
      cancelId: 2,
      title: 'Permission Request',
      message: `${domain} wants to access your ${permissionName}`,
      detail: 'Do you want to allow this site to access this feature?',
      checkboxLabel: 'Remember my choice for this site',
    }).then(result => {
      const granted = result.response === 0;
      
      if (result.checkboxChecked && result.response !== 2) {
        // Remember choice
        if (granted) {
          this.settings.trustedDomains.push(domain);
        } else {
          this.settings.blockedDomains.push(domain);
        }
        this.saveSettings();
      }

      callback(granted);
    });
  }

  /**
   * Setup popup blocking
   */
  private setupPopupBlocking(ses: Electron.Session) {
    // This is handled in the window creation
    console.log('🚫 Popup blocking enabled');
  }

  /**
   * Block or allow popup for a window
   */
  public shouldBlockPopup(parentUrl: string, popupUrl: string): boolean {
    if (!this.settings.blockPopups) return false;

    const parentDomain = this.extractDomain(parentUrl);
    const popupDomain = this.extractDomain(popupUrl);

    // Allow same-domain popups
    if (parentDomain === popupDomain) return false;

    // Allow trusted domains
    if (this.settings.trustedDomains.some(d => popupDomain.includes(d))) return false;

    // Track blocked popups
    const count = this.blockedPopups.get(parentDomain) || 0;
    this.blockedPopups.set(parentDomain, count + 1);

    console.log(`🚫 Popup blocked: ${popupUrl} from ${parentUrl}`);
    return true;
  }

  /**
   * Get blocked popup count for a domain
   */
  public getBlockedPopupCount(url: string): number {
    const domain = this.extractDomain(url);
    return this.blockedPopups.get(domain) || 0;
  }

  /**
   * Setup HTTPS enforcement
   */
  private setupHttpsEnforcement(ses: Electron.Session) {
    ses.webRequest.onBeforeRequest({ urls: ['http://*/*'] }, (details, callback) => {
      const url = details.url;
      
      // Skip localhost and local IPs
      if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('192.168.')) {
        callback({});
        return;
      }

      // Upgrade to HTTPS
      const httpsUrl = url.replace('http://', 'https://');
      console.log(`🔒 Upgrading to HTTPS: ${url}`);
      callback({ redirectURL: httpsUrl });
    });

    console.log('🔒 HTTPS enforcement enabled');
  }

  /**
   * Setup certificate error handling
   */
  private setupCertificateHandling(ses: Electron.Session) {
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
      event.preventDefault();
      
      const domain = this.extractDomain(url);
      console.log(`⚠️ Certificate error for ${domain}: ${error}`);

      // Check if domain is trusted (user previously accepted)
      const trustedCerts = this.store.get('trustedCertificates', []) as string[];
      if (trustedCerts.includes(certificate.fingerprint)) {
        callback(true);
        return;
      }

      // Show certificate error dialog
      const window = BrowserWindow.fromWebContents(webContents);
      if (!window) {
        callback(false);
        return;
      }

      dialog.showMessageBox(window, {
        type: 'warning',
        buttons: ['Go Back (Safe)', 'Proceed Anyway (Unsafe)', 'View Certificate'],
        defaultId: 0,
        cancelId: 0,
        title: 'Certificate Error',
        message: `The security certificate for ${domain} is not trusted`,
        detail: `Error: ${error}\n\nThis could mean:\n• Someone is trying to intercept your connection\n• The website's certificate has expired\n• The certificate is self-signed\n\nProceeding is not recommended.`,
      }).then(result => {
        if (result.response === 1) {
          // User chose to proceed - remember this cert
          trustedCerts.push(certificate.fingerprint);
          this.store.set('trustedCertificates', trustedCerts);
          callback(true);
        } else if (result.response === 2) {
          // View certificate
          dialog.showMessageBox(window, {
            type: 'info',
            title: 'Certificate Details',
            message: `Certificate for ${domain}`,
            detail: `Subject: ${certificate.subjectName}\nIssuer: ${certificate.issuerName}\nValid From: ${certificate.validStart}\nValid Until: ${certificate.validExpiry}\nFingerprint: ${certificate.fingerprint}`,
          });
          callback(false);
        } else {
          callback(false);
        }
      });
    });

    console.log('🔐 Certificate handling enabled');
  }

  /**
   * Setup anti-fingerprinting protection
   */
  private setupAntiFingerprinting(ses: Electron.Session) {
    // Inject anti-fingerprinting scripts
    ses.webRequest.onHeadersReceived((details, callback) => {
      // Add security headers
      const responseHeaders = { ...details.responseHeaders };
      
      // Prevent embedding in iframes (clickjacking protection)
      responseHeaders['X-Frame-Options'] = ['SAMEORIGIN'];
      responseHeaders['X-Content-Type-Options'] = ['nosniff'];
      responseHeaders['Referrer-Policy'] = ['strict-origin-when-cross-origin'];
      
      callback({ responseHeaders });
    });

    // Spoof/randomize certain browser fingerprint data
    ses.setUserAgent(this.getAnonymizedUserAgent());

    console.log('🎭 Anti-fingerprinting enabled');
  }

  /**
   * Get anonymized user agent string
   */
  private getAnonymizedUserAgent(): string {
    // Use a common, generic user agent to blend in
    const platform = process.platform === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7' :
                     process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64' :
                     'X11; Linux x86_64';
    
    return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36`;
  }

  /**
   * Get anti-fingerprinting script to inject into pages
   */
  public getAntiFingerPrintingScript(): string {
    return `
      (function() {
        // Spoof canvas fingerprinting
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
          if (type === 'image/png' || type === undefined) {
            const ctx = this.getContext('2d');
            if (ctx) {
              const imageData = ctx.getImageData(0, 0, this.width, this.height);
              for (let i = 0; i < imageData.data.length; i += 4) {
                imageData.data[i] ^= 1; // Slight modification
              }
              ctx.putImageData(imageData, 0, 0);
            }
          }
          return originalToDataURL.apply(this, arguments);
        };

        // Spoof WebGL fingerprinting
        const getParameterProto = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) return 'Intel Inc.'; // UNMASKED_VENDOR_WEBGL
          if (parameter === 37446) return 'Intel Iris OpenGL Engine'; // UNMASKED_RENDERER_WEBGL
          return getParameterProto.apply(this, arguments);
        };

        // Spoof AudioContext fingerprinting
        if (window.AudioContext || window.webkitAudioContext) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          const originalCreateOscillator = AudioContextClass.prototype.createOscillator;
          AudioContextClass.prototype.createOscillator = function() {
            const oscillator = originalCreateOscillator.apply(this, arguments);
            oscillator.frequency.value += Math.random() * 0.001;
            return oscillator;
          };
        }

        // Randomize screen dimensions slightly
        Object.defineProperty(screen, 'width', { value: 1920 + Math.floor(Math.random() * 10) });
        Object.defineProperty(screen, 'height', { value: 1080 + Math.floor(Math.random() * 10) });
        Object.defineProperty(screen, 'availWidth', { value: 1920 + Math.floor(Math.random() * 10) });
        Object.defineProperty(screen, 'availHeight', { value: 1040 + Math.floor(Math.random() * 10) });

        // Spoof navigator properties
        Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4 });
        Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
        Object.defineProperty(navigator, 'platform', { value: 'MacIntel' });

        // Block WebRTC IP leak
        if (window.RTCPeerConnection) {
          const origRTCPeerConnection = window.RTCPeerConnection;
          window.RTCPeerConnection = function(config) {
            // Force using only TURN servers (no direct connections that leak IP)
            if (config && config.iceServers) {
              config.iceServers = config.iceServers.filter(server => {
                const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
                return urls.some(url => url.startsWith('turn:'));
              });
            }
            return new origRTCPeerConnection(config);
          };
          window.RTCPeerConnection.prototype = origRTCPeerConnection.prototype;
        }

        // Block WebRTC entirely in Phantom Mode by overriding
        if (window.RTCPeerConnection) {
          window.RTCPeerConnection = function() {
            throw new Error('WebRTC is disabled for privacy');
          };
        }
        if (window.webkitRTCPeerConnection) {
          window.webkitRTCPeerConnection = function() {
            throw new Error('WebRTC is disabled for privacy');
          };
        }
        if (window.RTCDataChannel) {
          window.RTCDataChannel = function() {
            throw new Error('WebRTC is disabled for privacy');
          };
        }

        // Spoof timezone to UTC
        const originalDateTimeFormat = Intl.DateTimeFormat;
        Intl.DateTimeFormat = function(locale, options) {
          options = options || {};
          options.timeZone = 'UTC';
          return new originalDateTimeFormat(locale, options);
        };

        // Block Battery API
        if (navigator.getBattery) {
          navigator.getBattery = undefined;
        }

        // Block connection info
        if (navigator.connection) {
          Object.defineProperty(navigator, 'connection', { value: undefined });
        }

        // Spoof language/languages
        Object.defineProperty(navigator, 'language', { value: 'en-US' });
        Object.defineProperty(navigator, 'languages', { value: ['en-US', 'en'] });

        // Block plugins enumeration
        Object.defineProperty(navigator, 'plugins', { value: [] });
        Object.defineProperty(navigator, 'mimeTypes', { value: [] });

        console.log('🎭 Anti-fingerprinting active (full protection)');
      })();
    `;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Get current settings
   */
  public getSettings(): SecuritySettings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  public updateSettings(newSettings: Partial<SecuritySettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  /**
   * Save settings to store
   */
  private saveSettings() {
    this.store.set('settings', this.settings);
  }

  /**
   * Add trusted domain
   */
  public addTrustedDomain(domain: string) {
    if (!this.settings.trustedDomains.includes(domain)) {
      this.settings.trustedDomains.push(domain);
      this.saveSettings();
    }
  }

  /**
   * Remove trusted domain
   */
  public removeTrustedDomain(domain: string) {
    this.settings.trustedDomains = this.settings.trustedDomains.filter(d => d !== domain);
    this.saveSettings();
  }

  /**
   * Clear all security data
   */
  public clearSecurityData() {
    this.store.clear();
    this.settings = defaultSettings;
    this.blockedPopups.clear();
  }
}

export const securityManager = new SecurityManager();

