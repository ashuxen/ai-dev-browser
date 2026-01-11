import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  BrowserView,
  session,
  dialog,
  shell,
  Notification,
} from 'electron';
import path from 'path';
import fs from 'fs';
import Store from 'electron-store';
import { autoUpdater, UpdateInfo } from 'electron-updater';
import { BookmarkManager } from './bookmark-manager';
import { HistoryManager } from './history-manager';
import { AIService } from './ai-service';
import { securityManager } from './security-manager';
import { torManager } from './tor-manager';
import { ssoManager } from './sso-manager';

// Settings interface
interface BrowserSettings {
  homepage: string;
  newTabPage: string;
  openLinksInNewTab: boolean;
  blockPopups: boolean;
  showBookmarkBar: boolean;
  darkMode: boolean;
  adBlockEnabled: boolean;
  trackerBlockEnabled: boolean;
}

// Default settings
const defaultSettings: BrowserSettings = {
  homepage: 'https://flashappai.org',
  newTabPage: 'about:blank',
  openLinksInNewTab: true,
  blockPopups: true,
  showBookmarkBar: true,
  darkMode: true,
  adBlockEnabled: true,
  trackerBlockEnabled: true,
};

console.log('🚀 FlashAppAI Browser starting...');

// Handle creating/removing shortcuts on Windows
if (process.platform === 'win32') {
  try {
    if (require('electron-squirrel-startup')) {
      app.quit();
    }
  } catch (e) {
    // Ignore
  }
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Tab interface
interface Tab {
  id: string;
  url: string;
  title: string;
  view: BrowserView;
}

// Recently closed tab interface
interface ClosedTab {
  id: string;
  url: string;
  title: string;
  closedAt: number;
}

// Download interface
interface Download {
  id: string;
  url: string;
  filename: string;
  path: string;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  receivedBytes: number;
  totalBytes: number;
  startTime: number;
}

class FlashAppAIBrowser {
  private mainWindow: BrowserWindow | null = null;
  private phantomWindows: Set<BrowserWindow> = new Set();  // Phantom Mode windows
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private tabIdCounter = 0;
  private sidebarWidth = 0;
  
  // AI Panel
  private aiPanelView: BrowserView | null = null;
  private aiPanelOpen = false;
  private aiPanelWidth = 0; // 0 = use responsive calculation, >0 = manual resize
  
  // Recently Closed Tabs
  private recentlyClosed: ClosedTab[] = [];
  private maxRecentlyClosed = 25;
  
  // Downloads
  private downloads: Map<string, Download> = new Map();
  
  // Ad & Tracker Blocking
  private adBlockEnabled = true;
  private trackerBlockEnabled = true;
  private blockedDomains: Set<string> = new Set();
  
  // Managers
  private bookmarkManager: BookmarkManager;
  private historyManager: HistoryManager;
  private aiService: AIService;
  
  // Settings store
  private settingsStore: Store<{ settings: BrowserSettings }>;

  constructor() {
    this.bookmarkManager = new BookmarkManager();
    this.historyManager = new HistoryManager();
    this.aiService = new AIService();
    this.settingsStore = new Store<{ settings: BrowserSettings }>({
      name: 'browser-settings',
      defaults: {
        settings: defaultSettings,
      },
    });
    this.init();
  }
  
  // Get a setting
  private getSetting<K extends keyof BrowserSettings>(key: K): BrowserSettings[K] {
    const settings = this.settingsStore.get('settings', defaultSettings);
    return settings[key] ?? defaultSettings[key];
  }
  
  // Set a setting
  private setSetting<K extends keyof BrowserSettings>(key: K, value: BrowserSettings[K]) {
    const settings = this.settingsStore.get('settings', defaultSettings);
    settings[key] = value;
    this.settingsStore.set('settings', settings);
  }
  
  // Get all settings
  private getAllSettings(): BrowserSettings {
    return this.settingsStore.get('settings', defaultSettings);
  }
  
  // Update multiple settings
  private updateSettings(updates: Partial<BrowserSettings>) {
    const settings = this.settingsStore.get('settings', defaultSettings);
    Object.assign(settings, updates);
    this.settingsStore.set('settings', settings);
  }

  private init() {
    // Ensure single instance
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
      return;
    }

    app.whenReady().then(() => {
      console.log('✅ App ready');
      
      // Performance optimizations
      console.log('⚡ Applying performance optimizations...');
      app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder'); // Hardware video decode
      app.commandLine.appendSwitch('disable-software-rasterizer'); // Use GPU
      app.commandLine.appendSwitch('enable-gpu-rasterization'); // GPU rendering
      
      // Configure default session cache
      session.defaultSession.setPreloads([]); // No custom preloads for pages
      
      // Initialize security for default session
      console.log('🔐 Initializing security features...');
      securityManager.initializeSession(session.defaultSession, false);
      
      // Initialize blocking and downloads
      this.updateBlockingRules();
      this.setupDownloadManager();
      
      this.createWindow();
      this.setupIPC();
      this.setupMenu();
      this.setupSecurityIPC();
      
      // Setup auto-updater (only in production)
      if (app.isPackaged) {
        this.setupAutoUpdater();
      }
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });
  }

  private async createWindow() {
    console.log('📱 Creating main window...');
    
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 900,
      minHeight: 600,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      trafficLightPosition: { x: 15, y: 15 },
      backgroundColor: '#0a0a1a',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true,
      },
    });

    // Load the browser UI HTML file
    const isDev = !app.isPackaged;
    console.log('📦 isDev:', isDev, 'cwd:', process.cwd(), 'appPath:', app.getAppPath());
    
    // Use process.cwd() for dev mode - it's always the project root when running via npm start
    const uiPath = isDev
      ? path.join(process.cwd(), 'src/renderer/browser-ui.html')
      : path.join(process.resourcesPath, 'browser-ui.html');
    console.log('📦 Loading UI from:', uiPath);
    
    try {
      await this.mainWindow.loadFile(uiPath);
      console.log('✅ UI loaded successfully');
    } catch (err) {
      console.error('❌ Failed to load UI:', err);
      // Fallback for production
      if (!isDev) {
        try {
          const fallback = path.join(app.getAppPath(), 'browser-ui.html');
          await this.mainWindow.loadFile(fallback);
        } catch (e) {
          console.error('❌ All fallbacks failed');
        }
      }
    }

    // Create initial tab after UI loads
    setTimeout(() => {
      // Use the user's homepage setting (default: flashappai.org)
      const homepage = this.getSetting('homepage') || 'https://flashappai.org';
      console.log('✅ Creating initial tab with homepage:', homepage);
      this.createTab(homepage);
    }, 300);

    this.mainWindow.on('resize', () => this.updateTabBounds());
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    console.log('✅ Main window created');
  }

  private createTab(url?: string): string {
    if (!this.mainWindow) return '';
    
    // If no URL provided, use the new tab page setting (default: blank)
    const tabUrl = url || this.getSetting('newTabPage') || 'about:blank';

    const id = `tab-${++this.tabIdCounter}`;
    console.log(`📑 Creating tab ${id}: ${tabUrl}`);

    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // Performance optimizations
        backgroundThrottling: false, // Keep page responsive when in background
        enableBlinkFeatures: 'CSSContainerQueries', // Modern CSS features
        spellcheck: false, // Disable for performance (can be toggled)
      },
    });

    const tab: Tab = { id, url: tabUrl, title: 'New Tab', view };
    this.tabs.set(id, tab);

    // Setup view events
    view.webContents.on('did-navigate', (_e, navUrl) => {
      tab.url = navUrl;
      this.addToHistory(navUrl, tab.title);
      this.notifyTabUpdate();
    });

    view.webContents.on('did-navigate-in-page', (_e, navUrl) => {
      tab.url = navUrl;
      this.notifyTabUpdate();
    });

    view.webContents.on('page-title-updated', (_e, title) => {
      tab.title = title;
      this.addToHistory(tab.url, title);
      this.notifyTabUpdate();
    });

    view.webContents.on('did-start-loading', () => {
      this.notifyTabUpdate();
    });

    view.webContents.on('did-stop-loading', () => {
      this.notifyTabUpdate();
      // Ensure bounds are correct after page load
      if (this.activeTabId === id) {
        this.updateTabBounds();
      }
    });

    // Ensure view bounds are correct after any navigation finishes
    view.webContents.on('did-finish-load', () => {
      if (this.activeTabId === id) {
        this.updateTabBounds();
      }
    });

    // Handle fullscreen mode (for videos, etc.)
    view.webContents.on('enter-html-full-screen', () => {
      console.log('🎬 Entering HTML fullscreen');
      if (this.mainWindow) {
        // Tell renderer to hide UI immediately
        this.mainWindow.webContents.send('fullscreen-change', true);
        
        // Hide AI panel if open
        if (this.aiPanelView) {
          this.mainWindow.removeBrowserView(this.aiPanelView);
        }
        
        // After a brief moment for UI to hide, set BrowserView to fill window
        setTimeout(() => {
          if (this.mainWindow) {
            const bounds = this.mainWindow.getBounds();
            view.setBounds({
              x: 0,
              y: 0,
              width: bounds.width,
              height: bounds.height,
            });
          }
        }, 50);
      }
    });

    view.webContents.on('leave-html-full-screen', () => {
      console.log('🎬 Leaving HTML fullscreen');
      if (this.mainWindow) {
        // Tell renderer to show UI
        this.mainWindow.webContents.send('fullscreen-change', false);
      }
      
      // Restore normal bounds
      setTimeout(() => {
        this.updateTabBounds();
        // Restore AI panel if it was open
        if (this.aiPanelView && this.aiPanelOpen) {
          this.mainWindow?.addBrowserView(this.aiPanelView);
          this.updateTabBounds();
        }
      }, 50);
    });

    // Handle popups and new window requests - open in new tab instead of popup window
    view.webContents.setWindowOpenHandler(({ url, disposition }) => {
      console.log(`🔗 Window open request: ${url} (${disposition})`);
      
      // Check if popups should be blocked
      if (this.getSetting('blockPopups')) {
        // Allow user-initiated navigation (ctrl+click, middle-click)
        if (disposition === 'new-window' || disposition === 'background-tab' || 
            disposition === 'foreground-tab') {
          // Open in new tab instead of popup
          if (this.getSetting('openLinksInNewTab')) {
            this.createTab(url);
            return { action: 'deny' }; // Deny popup, we opened it in a tab
          }
        }
        
        // Block unwanted popups
        if (disposition === 'default') {
          console.log('🚫 Blocked popup:', url);
          return { action: 'deny' };
        }
      }
      
      // Open in new tab by default
      if (this.getSetting('openLinksInNewTab')) {
        this.createTab(url);
        return { action: 'deny' };
      }
      
      return { action: 'allow' };
    });

    view.webContents.loadURL(tabUrl);
    this.switchToTab(id);

    return id;
  }

  private addToHistory(url: string, title: string) {
    // Skip internal URLs and empty titles
    if (!url || url.startsWith('about:') || url.startsWith('file:')) return;
    
    try {
      this.historyManager.add({ url, title: title || url });
    } catch (e) {
      console.error('Failed to add to history:', e);
    }
  }

  private switchToTab(tabId: string) {
    if (!this.mainWindow) return;

    // Remove current view
    if (this.activeTabId) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        this.mainWindow.removeBrowserView(currentTab.view);
      }
    }

    // Add new view
    const newTab = this.tabs.get(tabId);
    if (newTab) {
      this.mainWindow.addBrowserView(newTab.view);
      this.activeTabId = tabId;
      this.updateTabBounds();
      this.notifyTabUpdate();
    }
  }

  private closeTab(tabId: string) {
    const tab = this.tabs.get(tabId);
    if (!tab || !this.mainWindow) return;

    // Save to recently closed before destroying
    if (tab.url && tab.url !== 'about:blank') {
      this.recentlyClosed.unshift({
        id: `closed-${Date.now()}`,
        url: tab.url,
        title: tab.title || 'Untitled',
        closedAt: Date.now(),
      });
      // Keep only the most recent ones
      if (this.recentlyClosed.length > this.maxRecentlyClosed) {
        this.recentlyClosed = this.recentlyClosed.slice(0, this.maxRecentlyClosed);
      }
    }

    if (this.activeTabId === tabId) {
      this.mainWindow.removeBrowserView(tab.view);
    }

    (tab.view.webContents as any).destroy?.();
    this.tabs.delete(tabId);

    // Switch to another tab or create new one
    if (this.activeTabId === tabId) {
      const remaining = Array.from(this.tabs.keys());
      if (remaining.length > 0) {
        this.switchToTab(remaining[0]);
      } else {
        this.createTab();
      }
    }

    this.notifyTabUpdate();
  }

  private updateTabBounds() {
    if (!this.mainWindow || !this.activeTabId) return;

    const tab = this.tabs.get(this.activeTabId);
    if (!tab) return;

    const bounds = this.mainWindow.getBounds();
    const TOOLBAR_HEIGHT = 120; // Tab bar (44px) + address bar (44px) + bookmark bar (32px)
    
    // Calculate AI panel width responsively based on window width
    let aiWidth = 0;
    if (this.aiPanelOpen) {
      // If manually resized, use that width; otherwise calculate responsive width
      if (this.aiPanelWidth > 0) {
        aiWidth = this.aiPanelWidth;
      } else {
        // Responsive: 30% of window, clamped between 350-600px
        aiWidth = Math.min(Math.max(350, bounds.width * 0.30), 600);
      }
    }

    tab.view.setBounds({
      x: this.sidebarWidth,
      y: TOOLBAR_HEIGHT,
      width: bounds.width - this.sidebarWidth - aiWidth,
      height: bounds.height - TOOLBAR_HEIGHT,
    });

    // Update AI panel bounds if open
    // Calculate header height proportionally (about 15% of panel height, min 120px, max 180px)
    if (this.aiPanelView && this.aiPanelOpen) {
      const panelHeight = bounds.height - TOOLBAR_HEIGHT;
      const AI_PANEL_HEADER_HEIGHT = Math.min(Math.max(120, panelHeight * 0.15), 180);
      
      this.aiPanelView.setBounds({
        x: bounds.width - aiWidth,
        y: TOOLBAR_HEIGHT + AI_PANEL_HEADER_HEIGHT,
        width: aiWidth,
        height: panelHeight - AI_PANEL_HEADER_HEIGHT,
      });
    }
  }

  // AI Panel methods
  private createAIPanel(url: string = 'https://chat.openai.com') {
    if (!this.mainWindow) return;

    // Remove existing AI panel if any
    if (this.aiPanelView) {
      this.mainWindow.removeBrowserView(this.aiPanelView);
      (this.aiPanelView.webContents as any).destroy?.();
    }

    this.aiPanelView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    this.mainWindow.addBrowserView(this.aiPanelView);
    this.aiPanelView.webContents.loadURL(url);
    this.aiPanelOpen = true;
    this.updateTabBounds();

    console.log('🤖 AI Panel opened:', url);
  }

  private closeAIPanel() {
    if (!this.mainWindow) return;

    // Remove BrowserView if exists
    if (this.aiPanelView) {
      this.mainWindow.removeBrowserView(this.aiPanelView);
      (this.aiPanelView.webContents as any).destroy?.();
      this.aiPanelView = null;
    }
    
    this.aiPanelOpen = false;
    this.updateTabBounds();

    console.log('🤖 AI Panel closed');
  }

  // Clear AI content but keep panel open (for back/switch)
  private clearAIContent() {
    if (!this.mainWindow) return;

    // Just remove the BrowserView, keep panel open
    if (this.aiPanelView) {
      this.mainWindow.removeBrowserView(this.aiPanelView);
      (this.aiPanelView.webContents as any).destroy?.();
      this.aiPanelView = null;
    }
    
    // Panel stays open, dimensions stay the same
    console.log('🤖 AI content cleared (panel still open)');
  }

  private setAIPanelUrl(url: string) {
    if (this.aiPanelView) {
      this.aiPanelView.webContents.loadURL(url);
    }
  }

  private reloadAIPanel() {
    if (this.aiPanelView) {
      this.aiPanelView.webContents.reload();
    }
  }

  private resizeAIPanel(width: number) {
    // Width of 0 means close/hide the AI panel area
    if (width === 0) {
      this.aiPanelWidth = 0;
      this.aiPanelOpen = false;
    } else if (width === -1) {
      // -1 = reset to responsive/auto size
      this.aiPanelWidth = 0;
      this.aiPanelOpen = true;
    } else {
      // Manual resize: clamp between reasonable bounds (20-70% of window)
      const bounds = this.mainWindow?.getBounds();
      const maxWidth = bounds ? bounds.width * 0.7 : 1000;
      const minWidth = 280;
      this.aiPanelWidth = Math.max(minWidth, Math.min(maxWidth, width));
      this.aiPanelOpen = true;
    }
    this.updateTabBounds();
    console.log('🤖 AI Panel resized to:', this.aiPanelWidth);
  }

  // 👻 Phantom Mode - Private browsing with Tor support
  private async createPhantomWindow() {
    console.log('👻 Opening Phantom Mode...');
    
    // Create ephemeral session (in-memory only, no persistence)
    const phantomSession = session.fromPartition(`phantom-${Date.now()}`, { cache: false });
    
    // Initialize security with enhanced protection for Phantom Mode
    securityManager.initializeSession(phantomSession, true);
    
    // Inject anti-fingerprinting script
    phantomSession.webRequest.onCompleted({ urls: ['*://*/*'] }, (details) => {
      // Inject anti-fingerprinting after page load
    });
    
    // Try to enable Tor
    let torEnabled = false;
    const torStatus = torManager.getStatus();
    
    if (!torStatus.connected) {
      // Try to start Tor
      console.log('🧅 Attempting to start Tor for Phantom Mode...');
      torEnabled = await torManager.start();
    } else {
      torEnabled = true;
    }
    
    if (torEnabled) {
      // Configure session to use Tor if available
      await torManager.configureSession(phantomSession);
      console.log('🧅 Phantom Mode using Tor network');
    } else {
      // Use built-in privacy features without Tor
      console.log('👻 Phantom Mode with built-in privacy features');
      // Security already initialized above, just log that we're using built-in privacy
    }
    
    const phantomWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      trafficLightPosition: { x: 15, y: 15 },
      backgroundColor: '#1a0a2e',  // Darker purple for Phantom Mode
      title: torEnabled ? '🧅 Phantom Mode (Tor) - FlashAppAI' : '👻 Phantom Mode - FlashAppAI',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true,
        session: phantomSession,
      },
    });

    // Block popups in Phantom Mode
    phantomWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (securityManager.shouldBlockPopup(phantomWindow.webContents.getURL(), url)) {
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    // Load phantom mode UI
    const phantomIsDev = !app.isPackaged;
    const phantomUIPath = phantomIsDev
      ? path.join(process.cwd(), 'src/renderer/phantom-mode.html')
      : path.join(process.resourcesPath, 'phantom-mode.html');
    phantomWindow.loadFile(phantomUIPath).catch(() => {
      // Fallback for production
      phantomWindow.loadURL('https://duckduckgo.com');
    });

    // Track phantom windows
    this.phantomWindows.add(phantomWindow);
    
    phantomWindow.on('closed', () => {
      this.phantomWindows.delete(phantomWindow);
      console.log('👻 Phantom Mode window closed');
    });

    // Clear all data when window closes
    phantomWindow.on('close', () => {
      phantomSession.clearStorageData();
      phantomSession.clearCache();
      phantomSession.clearAuthCache();
    });

    console.log('👻 Phantom Mode window created', torEnabled ? '(with Tor)' : '(without Tor)');
    return phantomWindow;
  }

  private notifyTabUpdate() {
    if (!this.mainWindow) return;

    const tabsData = Array.from(this.tabs.values()).map(t => {
      // Safe check for view and webContents existence
      const viewValid = t.view && t.view.webContents && !t.view.webContents.isDestroyed();
      return {
        id: t.id,
        url: t.url,
        title: t.title,
        isActive: t.id === this.activeTabId,
        canGoBack: viewValid ? t.view.webContents.canGoBack() : false,
        canGoForward: viewValid ? t.view.webContents.canGoForward() : false,
        isLoading: viewValid ? t.view.webContents.isLoading() : false,
      };
    });

    this.mainWindow.webContents.send('tabs-updated', {
      tabs: tabsData,
      activeTabId: this.activeTabId,
    });
  }

  // ===== AD & TRACKER BLOCKING =====
  private adBlockList = new Set([
    // Ad networks
    'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
    'facebook.com/tr', 'facebook.net/tr', 'adservice.google.com',
    'pagead2.googlesyndication.com', 'securepubads.g.doubleclick.net',
    'ads.yahoo.com', 'advertising.com', 'adsrvr.org', 'adnxs.com',
    'criteo.com', 'criteo.net', 'outbrain.com', 'taboola.com',
    'amazon-adsystem.com', 'moatads.com', 'rubiconproject.com',
    'pubmatic.com', 'openx.net', 'casalemedia.com', 'spotxchange.com',
    'advertising.amazon.com', 'media.net', 'revcontent.com',
  ]);

  private trackerBlockList = new Set([
    // Trackers
    'google-analytics.com', 'analytics.google.com', 'googletagmanager.com',
    'facebook.com/plugins', 'connect.facebook.net', 'pixel.facebook.com',
    'hotjar.com', 'mixpanel.com', 'segment.io', 'segment.com',
    'amplitude.com', 'fullstory.com', 'mouseflow.com', 'clarity.ms',
    'crazyegg.com', 'optimizely.com', 'omtrdc.net', 'demdex.net',
    'bluekai.com', 'krxd.net', 'exelator.com', 'quantserve.com',
    'scorecardresearch.com', 'chartbeat.com', 'newrelic.com',
    'bugsnag.com', 'sentry.io', 'logrocket.com',
  ]);

  private updateBlockingRules() {
    const ses = session.defaultSession;
    
    // Remove existing filter
    ses.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      const url = new URL(details.url);
      const hostname = url.hostname;
      
      let shouldBlock = false;
      
      // Check ad blocking
      if (this.adBlockEnabled) {
        for (const adDomain of this.adBlockList) {
          if (hostname.includes(adDomain) || details.url.includes(adDomain)) {
            shouldBlock = true;
            this.blockedDomains.add(hostname);
            break;
          }
        }
      }
      
      // Check tracker blocking
      if (!shouldBlock && this.trackerBlockEnabled) {
        for (const trackerDomain of this.trackerBlockList) {
          if (hostname.includes(trackerDomain) || details.url.includes(trackerDomain)) {
            shouldBlock = true;
            this.blockedDomains.add(hostname);
            break;
          }
        }
      }
      
      if (shouldBlock) {
        console.log('🛡️ Blocked:', hostname);
        callback({ cancel: true });
      } else {
        callback({});
      }
    });
    
    console.log('🛡️ Blocking rules updated - Ads:', this.adBlockEnabled, 'Trackers:', this.trackerBlockEnabled);
  }

  private setupDownloadManager() {
    const ses = session.defaultSession;
    
    ses.on('will-download', (_event, item) => {
      const downloadId = `dl-${Date.now()}`;
      const filename = item.getFilename();
      const savePath = path.join(app.getPath('downloads'), filename);
      
      item.setSavePath(savePath);
      
      const download: Download = {
        id: downloadId,
        url: item.getURL(),
        filename,
        path: savePath,
        state: 'progressing',
        receivedBytes: 0,
        totalBytes: item.getTotalBytes(),
        startTime: Date.now(),
      };
      
      this.downloads.set(downloadId, download);
      
      item.on('updated', (_e, state) => {
        download.receivedBytes = item.getReceivedBytes();
        download.totalBytes = item.getTotalBytes();
        download.state = state === 'progressing' ? 'progressing' : 'interrupted';
        
        // Notify renderer of progress
        this.mainWindow?.webContents.send('download:progress', download);
      });
      
      item.on('done', (_e, state) => {
        download.state = state === 'completed' ? 'completed' : 'cancelled';
        download.receivedBytes = item.getReceivedBytes();
        
        // Notify renderer
        this.mainWindow?.webContents.send('download:complete', download);
        
        if (state === 'completed') {
          new Notification({
            title: 'Download Complete',
            body: filename,
          }).show();
        }
      });
    });
    
    console.log('📥 Download manager initialized');
  }

  private setupIPC() {
    // Tab management
    ipcMain.handle('tab:create', (_e, url?: string) => {
      return this.createTab(url);
    });

    ipcMain.handle('tab:close', (_e, tabId: string) => {
      this.closeTab(tabId);
    });

    ipcMain.handle('tab:switch', (_e, tabId: string) => {
      this.switchToTab(tabId);
    });

    ipcMain.handle('tab:navigate', (_e, url: string) => {
      // Handle sidebar width update
      if (url.startsWith('__sidebar:')) {
        this.sidebarWidth = parseInt(url.split(':')[1]) || 0;
        this.updateTabBounds();
        return;
      }

      if (!this.activeTabId) return;
      const tab = this.tabs.get(this.activeTabId);
      if (tab) {
        // Add protocol if missing
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          url = url.includes('.') ? `https://${url}` : `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
        tab.view.webContents.loadURL(url);
      }
    });

    ipcMain.handle('tab:back', () => {
      const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
      if (!tab?.view?.webContents || tab.view.webContents.isDestroyed()) return;
      
      if (tab.view.webContents.canGoBack()) {
        tab.view.webContents.goBack();
        // Ensure bounds are correct after navigation
        setTimeout(() => this.updateTabBounds(), 100);
      }
    });

    ipcMain.handle('tab:forward', () => {
      const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
      if (!tab?.view?.webContents || tab.view.webContents.isDestroyed()) return;
      
      if (tab.view.webContents.canGoForward()) {
        tab.view.webContents.goForward();
        // Ensure bounds are correct after navigation
        setTimeout(() => this.updateTabBounds(), 100);
      }
    });

    ipcMain.handle('tab:reload', () => {
      const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
      if (!tab?.view?.webContents || tab.view.webContents.isDestroyed()) return;
      
      tab.view.webContents.reload();
      // Ensure bounds are correct after reload
      setTimeout(() => this.updateTabBounds(), 100);
    });

    ipcMain.handle('tab:get-all', () => {
      return Array.from(this.tabs.values()).map(t => {
        // Safe check for view and webContents existence
        const viewValid = t.view && t.view.webContents && !t.view.webContents.isDestroyed();
        return {
          id: t.id,
          url: t.url,
          title: t.title,
          isActive: t.id === this.activeTabId,
          canGoBack: viewValid ? t.view.webContents.canGoBack() : false,
          canGoForward: viewValid ? t.view.webContents.canGoForward() : false,
          isLoading: viewValid ? t.view.webContents.isLoading() : false,
        };
      });
    });

    // Get page content for AI summarization
    ipcMain.handle('tab:get-page-content', async () => {
      const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
      if (!tab) return { content: '', url: '', title: '' };

      try {
        // Extract text content from the page
        const content = await tab.view.webContents.executeJavaScript(`
          (function() {
            // Remove scripts, styles, and hidden elements
            const clone = document.body.cloneNode(true);
            const scripts = clone.querySelectorAll('script, style, noscript, iframe, nav, header, footer');
            scripts.forEach(el => el.remove());
            
            // Get main content if available
            const main = clone.querySelector('main, article, [role="main"], .content, .post, .article');
            const textSource = main || clone;
            
            // Get text and clean it up
            let text = textSource.innerText || textSource.textContent || '';
            text = text.replace(/\\s+/g, ' ').trim();
            
            // Limit to ~4000 chars for URL parameter safety
            return text.substring(0, 4000);
          })();
        `);
        
        console.log('📄 Extracted page content:', content.substring(0, 100) + '...');
        return {
          content: content || '',
          url: tab.url,
          title: tab.title
        };
      } catch (e) {
        console.error('Failed to extract page content:', e);
        return { content: '', url: tab.url, title: tab.title };
      }
    });

    // Get selected text from the page (for code explanation)
    ipcMain.handle('tab:get-selected-text', async () => {
      const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
      if (!tab) return '';

      try {
        const selectedText = await tab.view.webContents.executeJavaScript(`
          window.getSelection().toString();
        `);
        console.log('📝 Selected text:', selectedText?.substring(0, 100) + '...');
        return selectedText || '';
      } catch (e) {
        console.error('Failed to get selected text:', e);
        return '';
      }
    });

    // Scan page for code blocks (for auto code explanation)
    ipcMain.handle('tab:get-code-content', async () => {
      const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
      if (!tab) return { code: '', language: '', url: '', title: '' };

      try {
        const codeData = await tab.view.webContents.executeJavaScript(`
          (function() {
            // First check for selected text
            const selection = window.getSelection().toString().trim();
            if (selection && selection.length > 10) {
              return { code: selection, language: 'auto', source: 'selection' };
            }
            
            // Look for code blocks in priority order
            const codeSelectors = [
              'pre code',           // Standard code blocks
              'code[class*="language-"]', // Prism/highlight.js
              '.highlight pre',     // GitHub style
              '.code-block',        // Generic
              'pre.prettyprint',    // Google prettify
              '.CodeMirror-code',   // CodeMirror
              '.monaco-editor .view-lines', // Monaco
              'pre',                // Plain pre tags
              'code'                // Inline code (last resort)
            ];
            
            let allCode = [];
            
            for (const selector of codeSelectors) {
              const elements = document.querySelectorAll(selector);
              for (const el of elements) {
                const text = el.innerText || el.textContent || '';
                if (text.trim().length > 20) {
                  // Try to detect language from class
                  let lang = 'auto';
                  const classList = el.className || el.parentElement?.className || '';
                  const langMatch = classList.match(/language-(\w+)|lang-(\w+)|(\w+)-code/);
                  if (langMatch) {
                    lang = langMatch[1] || langMatch[2] || langMatch[3];
                  }
                  allCode.push({ code: text.trim(), language: lang });
                }
              }
            }
            
            // Return first substantial code block found
            if (allCode.length > 0) {
              // Sort by length, prefer longer code blocks
              allCode.sort((a, b) => b.code.length - a.code.length);
              return { ...allCode[0], source: 'scan', totalFound: allCode.length };
            }
            
            return { code: '', language: '', source: 'none' };
          })();
        `);
        
        console.log('💻 Code scan result:', codeData?.source, 'found:', codeData?.totalFound || 0);
        return {
          ...codeData,
          url: tab.url,
          title: tab.title
        };
      } catch (e) {
        console.error('Failed to scan for code:', e);
        return { code: '', language: '', url: tab.url, title: tab.title };
      }
    });

    // Bookmarks
    ipcMain.handle('bookmark:add', (_e, bookmark: { url: string; title: string; folderId?: string; tags?: string[] }) => {
      return this.bookmarkManager.add(bookmark);
    });

    ipcMain.handle('bookmark:remove', (_e, id: string) => {
      return this.bookmarkManager.remove(id);
    });

    ipcMain.handle('bookmark:update', (_e, id: string, updates: any) => {
      return this.bookmarkManager.update(id, updates);
    });

    ipcMain.handle('bookmark:get-all', () => {
      return this.bookmarkManager.getAll();
    });

    ipcMain.handle('bookmark:get-by-folder', (_e, folderId: string) => {
      return this.bookmarkManager.getByFolder(folderId);
    });

    ipcMain.handle('bookmark:search', (_e, query: string) => {
      return this.bookmarkManager.search(query);
    });

    // Bookmark Folders
    ipcMain.handle('bookmark:get-folders', () => {
      return this.bookmarkManager.getAllFolders();
    });

    ipcMain.handle('bookmark:create-folder', (_e, name: string, parentId?: string) => {
      return this.bookmarkManager.createFolder(name, parentId);
    });

    ipcMain.handle('bookmark:delete-folder', (_e, id: string) => {
      return this.bookmarkManager.deleteFolder(id);
    });

    ipcMain.handle('bookmark:move-to-folder', (_e, bookmarkId: string, folderId: string) => {
      return this.bookmarkManager.update(bookmarkId, { folderId });
    });

    // AI Bookmark Organization - suggest folder based on URL/title
    ipcMain.handle('bookmark:suggest-folder', (_e, url: string, title: string) => {
      const folders = this.bookmarkManager.getAllFolders();
      const existingBookmarks = this.bookmarkManager.getAll();
      
      // Simple AI logic: suggest folder based on domain or keywords
      try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');
        const lowerTitle = title.toLowerCase();
        
        // Check if similar bookmarks exist in a folder
        const similarBookmark = existingBookmarks.find(b => {
          try {
            const bDomain = new URL(b.url).hostname.replace('www.', '');
            return bDomain === domain && b.folderId;
          } catch { return false; }
        });
        
        if (similarBookmark?.folderId) {
          const folder = folders.find(f => f.id === similarBookmark.folderId);
          return { suggestedFolderId: similarBookmark.folderId, suggestedFolderName: folder?.name, reason: `Similar to other ${domain} bookmarks` };
        }
        
        // Keyword-based suggestions
        const keywordFolders: Record<string, string[]> = {
          'Work': ['github', 'gitlab', 'slack', 'jira', 'confluence', 'notion', 'trello', 'asana', 'linear'],
          'Social': ['twitter', 'facebook', 'instagram', 'linkedin', 'reddit', 'discord', 'x.com'],
          'Shopping': ['amazon', 'ebay', 'etsy', 'shopify', 'aliexpress', 'walmart', 'target'],
          'News': ['news', 'bbc', 'cnn', 'nytimes', 'guardian', 'reuters', 'techcrunch'],
          'Learning': ['udemy', 'coursera', 'youtube', 'stackoverflow', 'medium', 'dev.to', 'tutorial', 'learn'],
          'Entertainment': ['netflix', 'hulu', 'spotify', 'twitch', 'gaming', 'movie', 'music'],
        };
        
        for (const [folderName, keywords] of Object.entries(keywordFolders)) {
          if (keywords.some(kw => domain.includes(kw) || lowerTitle.includes(kw))) {
            // Check if folder exists
            const existingFolder = folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
            return { 
              suggestedFolderId: existingFolder?.id || null, 
              suggestedFolderName: folderName,
              reason: `Based on content type`,
              createNew: !existingFolder
            };
          }
        }
        
        return { suggestedFolderId: 'other', suggestedFolderName: 'Other Bookmarks', reason: 'Default location' };
      } catch {
        return { suggestedFolderId: 'other', suggestedFolderName: 'Other Bookmarks', reason: 'Default location' };
      }
    });

    // Settings
    ipcMain.handle('settings:get-all', () => {
      return this.getAllSettings();
    });

    ipcMain.handle('settings:get', (_e, key: keyof BrowserSettings) => {
      return this.getSetting(key);
    });

    ipcMain.handle('settings:set', (_e, key: keyof BrowserSettings, value: any) => {
      this.setSetting(key, value);
      return { success: true };
    });

    ipcMain.handle('settings:update', (_e, updates: Partial<BrowserSettings>) => {
      this.updateSettings(updates);
      return { success: true };
    });

    // History
    ipcMain.handle('history:add', (_e, entry: { url: string; title: string }) => {
      return this.historyManager.add(entry);
    });

    ipcMain.handle('history:get-all', () => {
      return this.historyManager.getAll();
    });

    ipcMain.handle('history:search', (_e, query: string) => {
      return this.historyManager.search(query);
    });

    ipcMain.handle('history:clear', () => {
      this.historyManager.clear();
    });

    // AI Panel
    ipcMain.handle('ai-panel:open', (_e, url?: string) => {
      this.createAIPanel(url || 'https://chat.openai.com');
      return { success: true };
    });

    ipcMain.handle('ai-panel:close', () => {
      this.closeAIPanel();
      return { success: true };
    });

    // Clear AI content but keep panel open (for back/switch buttons)
    ipcMain.handle('ai-panel:clear', () => {
      this.clearAIContent();
      return { success: true };
    });

    ipcMain.handle('ai-panel:set-url', (_e, url: string) => {
      this.setAIPanelUrl(url);
      return { success: true };
    });

    ipcMain.handle('ai-panel:reload', () => {
      this.reloadAIPanel();
      return { success: true };
    });

    ipcMain.handle('ai-panel:resize', (_e, width: number) => {
      this.resizeAIPanel(width);
      return { success: true };
    });

    ipcMain.handle('ai-panel:status', () => {
      return { 
        isOpen: this.aiPanelOpen, 
        width: this.aiPanelWidth,
        url: this.aiPanelView?.webContents.getURL() || null
      };
    });

    // Code-server (placeholder)
    ipcMain.handle('code-server:connect', () => false);
    ipcMain.handle('code-server:disconnect', () => {});
    ipcMain.handle('code-server:send-code', () => false);
    ipcMain.handle('code-server:status', () => ({ connected: false, url: null }));

    // AI Service
    ipcMain.handle('ai:get-providers', () => {
      return this.aiService.getProviders();
    });

    ipcMain.handle('ai:get-config', () => {
      return this.aiService.getConfig();
    });

    ipcMain.handle('ai:set-config', (_e, config: any) => {
      this.aiService.setConfig(config);
    });

    ipcMain.handle('ai:set-api-key', (_e, providerId: string, apiKey: string) => {
      this.aiService.setApiKey(providerId, apiKey);
    });

    ipcMain.handle('ai:chat', async (_e, message: string, context?: string) => {
      return await this.aiService.chat(message, context);
    });

    ipcMain.handle('ai:explain-code', async (_e, code: string, language?: string) => {
      return await this.aiService.explainCode(code, language);
    });

    ipcMain.handle('ai:summarize-docs', async (_e, content: string, url?: string) => {
      return await this.aiService.summarizePage(content, url || '');
    });

    ipcMain.handle('ai:suggest', async (_e, code: string, language?: string) => {
      return await this.aiService.suggestImprovements(code, language);
    });

    ipcMain.handle('ai:debug', async (_e, code: string, error?: string, language?: string) => {
      return await this.aiService.debugHelp(code, error, language);
    });

    ipcMain.handle('ai:clear-history', () => {
      this.aiService.clearHistory();
    });

    ipcMain.handle('ai:configure', (_e, config: any) => {
      this.aiService.setConfig(config);
    });

    // OAuth (placeholder)
    ipcMain.handle('oauth:status', () => ({}));
    ipcMain.handle('oauth:get-tokens', () => []);

    // App info
    ipcMain.handle('app:version', () => app.getVersion());
    ipcMain.handle('app:platform', () => process.platform);
    ipcMain.handle('app:is-dark-mode', () => nativeTheme.shouldUseDarkColors);

    // ===== FIND IN PAGE =====
    ipcMain.handle('find:start', (_e, text: string, options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean }) => {
      const tab = this.tabs.get(this.activeTabId!);
      if (tab) {
        tab.view.webContents.findInPage(text, {
          forward: options?.forward ?? true,
          findNext: options?.findNext ?? false,
          matchCase: options?.matchCase ?? false,
        });
        return { success: true };
      }
      return { success: false };
    });

    ipcMain.handle('find:next', (_e, text: string) => {
      const tab = this.tabs.get(this.activeTabId!);
      if (tab) {
        tab.view.webContents.findInPage(text, { forward: true, findNext: true });
        return { success: true };
      }
      return { success: false };
    });

    ipcMain.handle('find:previous', (_e, text: string) => {
      const tab = this.tabs.get(this.activeTabId!);
      if (tab) {
        tab.view.webContents.findInPage(text, { forward: false, findNext: true });
        return { success: true };
      }
      return { success: false };
    });

    ipcMain.handle('find:stop', () => {
      const tab = this.tabs.get(this.activeTabId!);
      if (tab) {
        tab.view.webContents.stopFindInPage('clearSelection');
        return { success: true };
      }
      return { success: false };
    });

    // Listen for find results
    this.tabs.forEach((tab) => {
      tab.view.webContents.on('found-in-page', (_event, result) => {
        this.mainWindow?.webContents.send('find:result', result);
      });
    });

    // ===== RECENTLY CLOSED TABS =====
    ipcMain.handle('tabs:get-recently-closed', () => {
      return this.recentlyClosed;
    });

    ipcMain.handle('tabs:restore-closed', (_e, id: string) => {
      const closedTab = this.recentlyClosed.find(t => t.id === id);
      if (closedTab) {
        this.recentlyClosed = this.recentlyClosed.filter(t => t.id !== id);
        this.createTab(closedTab.url);
        return { success: true };
      }
      return { success: false };
    });

    ipcMain.handle('tabs:clear-recently-closed', () => {
      this.recentlyClosed = [];
      return { success: true };
    });

    // ===== DEVELOPER TOOLS =====
    ipcMain.handle('devtools:toggle', () => {
      const tab = this.tabs.get(this.activeTabId!);
      if (tab) {
        if (tab.view.webContents.isDevToolsOpened()) {
          tab.view.webContents.closeDevTools();
        } else {
          tab.view.webContents.openDevTools({ mode: 'right' });
        }
        return { success: true, isOpen: tab.view.webContents.isDevToolsOpened() };
      }
      return { success: false };
    });

    ipcMain.handle('devtools:open', () => {
      const tab = this.tabs.get(this.activeTabId!);
      if (tab) {
        tab.view.webContents.openDevTools({ mode: 'right' });
        return { success: true };
      }
      return { success: false };
    });

    ipcMain.handle('devtools:close', () => {
      const tab = this.tabs.get(this.activeTabId!);
      if (tab) {
        tab.view.webContents.closeDevTools();
        return { success: true };
      }
      return { success: false };
    });

    // ===== SCREENSHOT =====
    ipcMain.handle('screenshot:capture', async (_e, options?: { fullPage?: boolean }) => {
      const tab = this.tabs.get(this.activeTabId!);
      if (!tab) return { success: false };

      try {
        const image = await tab.view.webContents.capturePage();
        const pageTitle = tab.view.webContents.getTitle() || 'screenshot';
        const sanitizedTitle = pageTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        const { filePath } = await dialog.showSaveDialog(this.mainWindow!, {
          title: 'Save Screenshot',
          defaultPath: `${sanitizedTitle}_${timestamp}.png`,
          filters: [{ name: 'PNG Images', extensions: ['png'] }],
        });

        if (filePath) {
          fs.writeFileSync(filePath, image.toPNG());
          new Notification({
            title: 'Screenshot Saved',
            body: `Saved to ${filePath}`,
          }).show();
          shell.showItemInFolder(filePath);
          return { success: true, path: filePath };
        }
        return { success: false, reason: 'cancelled' };
      } catch (error) {
        console.error('Screenshot failed:', error);
        return { success: false, reason: (error as Error).message };
      }
    });

    // ===== AD & TRACKER BLOCKING =====
    ipcMain.handle('blocking:get-status', () => {
      return {
        adBlockEnabled: this.adBlockEnabled,
        trackerBlockEnabled: this.trackerBlockEnabled,
        blockedCount: this.blockedDomains.size,
      };
    });

    ipcMain.handle('blocking:set-ad-block', (_e, enabled: boolean) => {
      this.adBlockEnabled = enabled;
      this.updateBlockingRules();
      return { success: true };
    });

    ipcMain.handle('blocking:set-tracker-block', (_e, enabled: boolean) => {
      this.trackerBlockEnabled = enabled;
      this.updateBlockingRules();
      return { success: true };
    });

    // ===== DOWNLOAD MANAGER =====
    ipcMain.handle('downloads:get-all', () => {
      return Array.from(this.downloads.values());
    });

    ipcMain.handle('downloads:clear', () => {
      const completed = Array.from(this.downloads.entries())
        .filter(([_, d]) => d.state === 'completed' || d.state === 'cancelled');
      completed.forEach(([id]) => this.downloads.delete(id));
      return { success: true };
    });

    // 👻 Phantom Mode
    ipcMain.handle('phantom:open', () => {
      this.createPhantomWindow();
      return { success: true };
    });

    // Hide/Show BrowserViews (for modals)
    ipcMain.handle('views:hide', () => {
      if (!this.mainWindow) return;
      
      // Hide all tab BrowserViews
      this.tabs.forEach((tab) => {
        this.mainWindow?.removeBrowserView(tab.view);
      });
      
      // Hide AI panel BrowserView
      if (this.aiPanelView) {
        this.mainWindow.removeBrowserView(this.aiPanelView);
      }
      
      console.log('🔲 BrowserViews hidden for modal');
      return { success: true };
    });

    ipcMain.handle('views:show', () => {
      if (!this.mainWindow) return;
      
      // Re-add the active tab's BrowserView
      const activeTab = this.tabs.get(this.activeTabId!);
      if (activeTab) {
        this.mainWindow.addBrowserView(activeTab.view);
        this.updateTabBounds();
      }
      
      // Re-add AI panel if it was open
      if (this.aiPanelView && this.aiPanelOpen) {
        this.mainWindow.addBrowserView(this.aiPanelView);
        this.updateTabBounds();
      }
      
      console.log('🔲 BrowserViews restored');
      return { success: true };
    });

    // Native Menu (works above BrowserViews)
    ipcMain.handle('menu:show', (_e, menuType: string) => {
      if (!this.mainWindow) return;
      
      const menuTemplate: Electron.MenuItemConstructorOptions[] = [];
      
      if (menuType === 'main') {
        menuTemplate.push(
          {
            label: '⚙️ Settings',
            click: () => this.mainWindow?.webContents.send('menu:action', 'settings'),
          },
          {
            label: '❓ Help',
            click: () => this.mainWindow?.webContents.send('menu:action', 'help'),
          },
          {
            label: 'ℹ️ About',
            click: () => this.mainWindow?.webContents.send('menu:action', 'about'),
          },
          { type: 'separator' },
          {
            label: '📥 Downloads',
            click: () => {
              // Open system downloads folder
              const downloadsPath = app.getPath('downloads');
              shell.openPath(downloadsPath);
            },
          },
          { type: 'separator' },
          {
            label: '🔍 Zoom In',
            accelerator: 'CmdOrCtrl+Plus',
            click: () => {
              const tab = this.tabs.get(this.activeTabId!);
              if (tab) {
                const currentZoom = tab.view.webContents.getZoomFactor();
                tab.view.webContents.setZoomFactor(Math.min(currentZoom + 0.1, 3));
              }
            },
          },
          {
            label: '🔍 Zoom Out',
            accelerator: 'CmdOrCtrl+Minus',
            click: () => {
              const tab = this.tabs.get(this.activeTabId!);
              if (tab) {
                const currentZoom = tab.view.webContents.getZoomFactor();
                tab.view.webContents.setZoomFactor(Math.max(currentZoom - 0.1, 0.25));
              }
            },
          },
          {
            label: '🔍 Reset Zoom',
            accelerator: 'CmdOrCtrl+0',
            click: () => {
              const tab = this.tabs.get(this.activeTabId!);
              if (tab) {
                tab.view.webContents.setZoomFactor(1);
              }
            },
          },
          { type: 'separator' },
          {
            label: '🖨️ Print',
            accelerator: 'CmdOrCtrl+P',
            click: () => {
              const tab = this.tabs.get(this.activeTabId!);
              if (tab) {
                tab.view.webContents.print({}, (success, errorType) => {
                  if (!success) {
                    console.log('Print failed:', errorType);
                  }
                });
              }
            },
          },
          {
            label: '📄 Save as PDF',
            accelerator: 'CmdOrCtrl+Shift+P',
            click: async () => {
              const tab = this.tabs.get(this.activeTabId!);
              if (tab) {
                const pageTitle = tab.view.webContents.getTitle() || 'page';
                const sanitizedTitle = pageTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
                
                const { filePath } = await dialog.showSaveDialog(this.mainWindow!, {
                  title: 'Save as PDF',
                  defaultPath: `${sanitizedTitle}.pdf`,
                  filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
                });
                
                if (filePath) {
                  try {
                    const pdfData = await tab.view.webContents.printToPDF({
                      printBackground: true,
                      landscape: false,
                      pageSize: 'A4',
                    });
                    
                    fs.writeFileSync(filePath, pdfData);
                    
                    // Show success notification
                    new Notification({
                      title: 'PDF Saved',
                      body: `Saved to ${filePath}`,
                    }).show();
                    
                    // Open the saved PDF
                    shell.openPath(filePath);
                  } catch (error) {
                    console.error('Failed to save PDF:', error);
                  }
                }
              }
            },
          },
          { type: 'separator' },
          {
            label: '🔄 Reload',
            accelerator: 'CmdOrCtrl+R',
            click: () => {
              const tab = this.tabs.get(this.activeTabId!);
              if (tab) {
                tab.view.webContents.reload();
              }
            },
          },
          {
            label: '🔍 Find in Page',
            accelerator: 'CmdOrCtrl+F',
            click: () => {
              this.mainWindow?.webContents.send('menu:action', 'find');
            },
          },
          {
            label: '📋 Recently Closed Tabs',
            accelerator: 'CmdOrCtrl+Shift+T',
            click: () => {
              this.mainWindow?.webContents.send('menu:action', 'recently-closed');
            },
          },
          { type: 'separator' },
          {
            label: '📸 Take Screenshot',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: async () => {
              const tab = this.tabs.get(this.activeTabId!);
              if (!tab) return;
              
              try {
                const image = await tab.view.webContents.capturePage();
                const pageTitle = tab.view.webContents.getTitle() || 'screenshot';
                const sanitizedTitle = pageTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                
                const { filePath } = await dialog.showSaveDialog(this.mainWindow!, {
                  title: 'Save Screenshot',
                  defaultPath: `${sanitizedTitle}_${timestamp}.png`,
                  filters: [{ name: 'PNG Images', extensions: ['png'] }],
                });

                if (filePath) {
                  fs.writeFileSync(filePath, image.toPNG());
                  new Notification({
                    title: 'Screenshot Saved',
                    body: `Saved to ${filePath}`,
                  }).show();
                  shell.showItemInFolder(filePath);
                }
              } catch (error) {
                console.error('Screenshot failed:', error);
              }
            },
          },
          {
            label: '🛠️ Developer Tools',
            accelerator: 'CmdOrCtrl+Shift+I',
            click: () => {
              const tab = this.tabs.get(this.activeTabId!);
              if (tab) {
                if (tab.view.webContents.isDevToolsOpened()) {
                  tab.view.webContents.closeDevTools();
                } else {
                  tab.view.webContents.openDevTools({ mode: 'right' });
                }
              }
            },
          },
          { type: 'separator' },
          {
            label: '🛡️ Ad Blocker',
            type: 'checkbox',
            checked: this.adBlockEnabled,
            click: () => {
              this.adBlockEnabled = !this.adBlockEnabled;
              this.updateBlockingRules();
              this.mainWindow?.webContents.send('menu:action', 
                this.adBlockEnabled ? 'ad-block-enabled' : 'ad-block-disabled');
            },
          },
          {
            label: '🔒 Tracker Blocker',
            type: 'checkbox',
            checked: this.trackerBlockEnabled,
            click: () => {
              this.trackerBlockEnabled = !this.trackerBlockEnabled;
              this.updateBlockingRules();
              this.mainWindow?.webContents.send('menu:action', 
                this.trackerBlockEnabled ? 'tracker-block-enabled' : 'tracker-block-disabled');
            },
          },
          { type: 'separator' },
          {
            label: '🧹 Clear Browsing Data',
            click: () => {
              session.defaultSession.clearStorageData();
              this.mainWindow?.webContents.send('menu:action', 'data-cleared');
            },
          },
        );
      }
      
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup({ window: this.mainWindow });
      
      return { success: true };
    });

    console.log('✅ IPC handlers registered');
  }

  private setupSecurityIPC() {
    console.log('🔐 Setting up security IPC handlers...');

    // Security settings
    ipcMain.handle('security:get-settings', () => {
      return securityManager.getSettings();
    });

    ipcMain.handle('security:update-settings', (_e, settings: any) => {
      securityManager.updateSettings(settings);
      return { success: true };
    });

    ipcMain.handle('security:add-trusted-domain', (_e, domain: string) => {
      securityManager.addTrustedDomain(domain);
      return { success: true };
    });

    ipcMain.handle('security:remove-trusted-domain', (_e, domain: string) => {
      securityManager.removeTrustedDomain(domain);
      return { success: true };
    });

    ipcMain.handle('security:get-blocked-popups', (_e, url: string) => {
      return securityManager.getBlockedPopupCount(url);
    });

    ipcMain.handle('security:clear-data', () => {
      securityManager.clearSecurityData();
      return { success: true };
    });

    // Tor integration
    ipcMain.handle('tor:status', () => {
      return torManager.getStatus();
    });

    ipcMain.handle('tor:start', async () => {
      const success = await torManager.start();
      return { success, status: torManager.getStatus() };
    });

    ipcMain.handle('tor:stop', () => {
      torManager.stop();
      return { success: true };
    });

    ipcMain.handle('tor:new-circuit', async () => {
      const success = await torManager.newCircuit();
      return { success };
    });

    ipcMain.handle('tor:get-install-instructions', () => {
      return torManager.getInstallInstructions();
    });

    // SSO/OAuth
    ipcMain.handle('sso:get-providers', () => {
      return ssoManager.getProviders();
    });

    ipcMain.handle('sso:configure-provider', (_e, providerId: string, config: any) => {
      return ssoManager.configureProvider(providerId, config);
    });

    ipcMain.handle('sso:authenticate', async (_e, providerId: string) => {
      return await ssoManager.authenticate(providerId);
    });

    ipcMain.handle('sso:get-session', (_e, providerId: string) => {
      return ssoManager.getSession(providerId);
    });

    ipcMain.handle('sso:logout', (_e, providerId: string) => {
      ssoManager.logout(providerId);
      return { success: true };
    });

    ipcMain.handle('sso:logout-all', () => {
      ssoManager.logoutAll();
      return { success: true };
    });

    console.log('✅ Security IPC handlers registered');
  }

  private setupAutoUpdater() {
    console.log('🔄 Setting up auto-updater...');
    
    // Configure auto-updater
    autoUpdater.autoDownload = false; // Don't auto-download, ask user first
    autoUpdater.autoInstallOnAppQuit = true;
    
    // Set the GitHub releases URL
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'ashuxen',
      repo: 'ai-dev-browser',
    });

    // Update events
    autoUpdater.on('checking-for-update', () => {
      console.log('🔍 Checking for updates...');
      this.mainWindow?.webContents.send('update:status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      console.log('📦 Update available:', info.version);
      this.mainWindow?.webContents.send('update:status', { 
        status: 'available', 
        version: info.version,
        releaseNotes: info.releaseNotes,
      });
      
      // Show notification
      if (Notification.isSupported()) {
        new Notification({
          title: '🚀 Update Available',
          body: `FlashAppAI Browser ${info.version} is available. Click to download.`,
        }).show();
      }
      
      // Ask user if they want to download
      dialog.showMessageBox(this.mainWindow!, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) is available!`,
        detail: 'Would you like to download and install it now?',
        buttons: ['Download Now', 'Later'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
    });

    autoUpdater.on('update-not-available', () => {
      console.log('✅ App is up to date');
      this.mainWindow?.webContents.send('update:status', { status: 'up-to-date' });
    });

    autoUpdater.on('download-progress', (progress) => {
      console.log(`📥 Download progress: ${Math.round(progress.percent)}%`);
      this.mainWindow?.webContents.send('update:status', { 
        status: 'downloading',
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      });
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      console.log('✅ Update downloaded:', info.version);
      this.mainWindow?.webContents.send('update:status', { 
        status: 'downloaded',
        version: info.version,
      });
      
      // Ask user to restart
      dialog.showMessageBox(this.mainWindow!, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded!',
        detail: `Version ${info.version} has been downloaded. Restart now to install?`,
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      }).then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    });

    autoUpdater.on('error', (error) => {
      console.error('❌ Auto-updater error:', error);
      this.mainWindow?.webContents.send('update:status', { 
        status: 'error',
        error: error.message,
      });
    });

    // Check for updates after a short delay
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.log('Update check skipped:', err.message);
      });
    }, 5000); // Check 5 seconds after app starts
    
    // Also check periodically (every 4 hours)
    setInterval(() => {
      autoUpdater.checkForUpdates().catch(() => {});
    }, 4 * 60 * 60 * 1000);

    // IPC handlers for manual update control
    ipcMain.handle('update:check', async () => {
      try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result?.updateInfo };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('update:download', async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle('update:install', () => {
      autoUpdater.quitAndInstall(false, true);
    });

    console.log('✅ Auto-updater configured');
  }

  private setupMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'FlashAppAI Browser',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'File',
        submenu: [
          {
            label: 'New Tab',
            accelerator: 'CmdOrCtrl+T',
            click: () => this.createTab(),
          },
          {
            label: 'Close Tab',
            accelerator: 'CmdOrCtrl+W',
            click: () => {
              if (this.activeTabId) this.closeTab(this.activeTabId);
            },
          },
          { type: 'separator' },
          {
            label: 'New Window',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.createWindow(),
          },
          {
            label: '👻 New Phantom Window',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: () => this.createPhantomWindow(),
          },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'History',
        submenu: [
          {
            label: 'Back',
            accelerator: 'CmdOrCtrl+[',
            click: () => {
              const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
              if (tab?.view.webContents.canGoBack()) {
                tab.view.webContents.goBack();
              }
            },
          },
          {
            label: 'Forward',
            accelerator: 'CmdOrCtrl+]',
            click: () => {
              const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
              if (tab?.view.webContents.canGoForward()) {
                tab.view.webContents.goForward();
              }
            },
          },
          { type: 'separator' },
          {
            label: 'Show All History',
            accelerator: 'CmdOrCtrl+Y',
            click: () => {
              this.mainWindow?.webContents.send('open-history');
            },
          },
        ],
      },
      {
        label: 'Bookmarks',
        submenu: [
          {
            label: 'Bookmark This Page',
            accelerator: 'CmdOrCtrl+D',
            click: () => {
              const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
              if (tab) {
                this.bookmarkManager.add({ url: tab.url, title: tab.title });
                this.notifyTabUpdate();
              }
            },
          },
          {
            label: 'Show All Bookmarks',
            accelerator: 'CmdOrCtrl+Shift+B',
            click: () => {
              this.mainWindow?.webContents.send('open-bookmarks');
            },
          },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
        ],
      },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }
}

// Start the browser
new FlashAppAIBrowser();
