import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  BrowserView,
} from 'electron';
import path from 'path';
import { BookmarkManager } from './bookmark-manager';
import { HistoryManager } from './history-manager';

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

class FlashAppAIBrowser {
  private mainWindow: BrowserWindow | null = null;
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private tabIdCounter = 0;
  private sidebarWidth = 0;
  
  // Managers
  private bookmarkManager: BookmarkManager;
  private historyManager: HistoryManager;

  constructor() {
    this.bookmarkManager = new BookmarkManager();
    this.historyManager = new HistoryManager();
    this.init();
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
      this.createWindow();
      this.setupIPC();
      this.setupMenu();
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

    // Load the browser UI HTML file directly from src
    const uiPath = path.join(app.getAppPath(), 'src/renderer/browser-ui.html');
    console.log('📦 Loading UI from:', uiPath);
    await this.mainWindow.loadFile(uiPath);

    // Create initial tab after UI loads
    setTimeout(() => {
      console.log('✅ Creating initial tab');
      this.createTab('https://flashappai.org');
    }, 300);

    this.mainWindow.on('resize', () => this.updateTabBounds());
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    console.log('✅ Main window created');
  }

  private createTab(url: string = 'https://flashappai.org'): string {
    if (!this.mainWindow) return '';

    const id = `tab-${++this.tabIdCounter}`;
    console.log(`📑 Creating tab ${id}: ${url}`);

    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const tab: Tab = { id, url, title: 'New Tab', view };
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
    });

    view.webContents.loadURL(url);
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
    const TOOLBAR_HEIGHT = 88; // Tab bar + address bar

    tab.view.setBounds({
      x: this.sidebarWidth,
      y: TOOLBAR_HEIGHT,
      width: bounds.width - this.sidebarWidth,
      height: bounds.height - TOOLBAR_HEIGHT,
    });
  }

  private notifyTabUpdate() {
    if (!this.mainWindow) return;

    const tabsData = Array.from(this.tabs.values()).map(t => ({
      id: t.id,
      url: t.url,
      title: t.title,
      isActive: t.id === this.activeTabId,
      canGoBack: t.view.webContents.canGoBack(),
      canGoForward: t.view.webContents.canGoForward(),
      isLoading: t.view.webContents.isLoading(),
    }));

    this.mainWindow.webContents.send('tabs-updated', {
      tabs: tabsData,
      activeTabId: this.activeTabId,
    });
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
      if (tab?.view.webContents.canGoBack()) {
        tab.view.webContents.goBack();
      }
    });

    ipcMain.handle('tab:forward', () => {
      const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
      if (tab?.view.webContents.canGoForward()) {
        tab.view.webContents.goForward();
      }
    });

    ipcMain.handle('tab:reload', () => {
      const tab = this.activeTabId ? this.tabs.get(this.activeTabId) : null;
      if (tab) {
        tab.view.webContents.reload();
      }
    });

    ipcMain.handle('tab:get-all', () => {
      return Array.from(this.tabs.values()).map(t => ({
        id: t.id,
        url: t.url,
        title: t.title,
        isActive: t.id === this.activeTabId,
        canGoBack: t.view.webContents.canGoBack(),
        canGoForward: t.view.webContents.canGoForward(),
        isLoading: t.view.webContents.isLoading(),
      }));
    });

    // Bookmarks
    ipcMain.handle('bookmark:add', (_e, bookmark: { url: string; title: string }) => {
      return this.bookmarkManager.add(bookmark);
    });

    ipcMain.handle('bookmark:remove', (_e, id: string) => {
      return this.bookmarkManager.remove(id);
    });

    ipcMain.handle('bookmark:get-all', () => {
      return this.bookmarkManager.getAll();
    });

    ipcMain.handle('bookmark:search', (_e, query: string) => {
      return this.bookmarkManager.search(query);
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

    // Code-server (placeholder)
    ipcMain.handle('code-server:connect', () => false);
    ipcMain.handle('code-server:disconnect', () => {});
    ipcMain.handle('code-server:send-code', () => false);
    ipcMain.handle('code-server:status', () => ({ connected: false, url: null }));

    // AI (placeholder - responds with helpful message)
    ipcMain.handle('ai:explain-code', () => ({
      success: false,
      error: 'AI not configured. Add your OpenAI or Anthropic API key in settings.'
    }));

    ipcMain.handle('ai:summarize-docs', () => ({
      success: false,
      error: 'AI not configured. Add your OpenAI or Anthropic API key in settings.'
    }));

    ipcMain.handle('ai:chat', (_e, message: string) => {
      // Simple responses for demo
      const responses: { [key: string]: string } = {
        'hello': 'Hello! How can I help you with your development today?',
        'hi': 'Hi there! I\'m ready to assist with code, documentation, or any development questions.',
      };

      const lowerMsg = message.toLowerCase();
      
      for (const [key, response] of Object.entries(responses)) {
        if (lowerMsg.includes(key)) {
          return { success: true, content: response };
        }
      }

      return {
        success: false,
        error: 'To enable AI features, configure your API key:\n\n1. Get an API key from OpenAI or Anthropic\n2. Go to Settings > AI Configuration\n3. Enter your API key\n\nOnce configured, I can help you:\n• Explain code snippets\n• Summarize documentation\n• Debug issues\n• Suggest improvements'
      };
    });

    ipcMain.handle('ai:configure', () => {});

    // OAuth (placeholder)
    ipcMain.handle('oauth:status', () => ({}));
    ipcMain.handle('oauth:get-tokens', () => []);

    // App info
    ipcMain.handle('app:version', () => app.getVersion());
    ipcMain.handle('app:platform', () => process.platform);
    ipcMain.handle('app:is-dark-mode', () => nativeTheme.shouldUseDarkColors);

    console.log('✅ IPC handlers registered');
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
