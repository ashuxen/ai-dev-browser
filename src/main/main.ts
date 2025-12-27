import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  BrowserView,
} from 'electron';
import path from 'path';

console.log('🚀 AI Dev Browser starting...');

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

// Simple tab management
interface Tab {
  id: string;
  url: string;
  title: string;
  view: BrowserView;
}

class SimpleBrowser {
  private mainWindow: BrowserWindow | null = null;
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private tabIdCounter = 0;

  constructor() {
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
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      trafficLightPosition: { x: 15, y: 15 },
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a2e' : '#ffffff',
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
      this.createTab('https://www.google.com');
    }, 300);

    this.mainWindow.on('resize', () => this.updateTabBounds());
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    console.log('✅ Main window created');
  }

  private async loadURLWithRetry(window: BrowserWindow, url: string, retries = 10): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        await window.loadURL(url);
        console.log('✅ Dev server loaded successfully');
        return;
      } catch (error) {
        console.log(`⏳ Waiting for dev server (attempt ${i + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    console.error('❌ Failed to load dev server after retries');
  }

  private createTab(url: string = 'https://www.google.com'): string {
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
      this.notifyTabUpdate();
    });

    view.webContents.on('page-title-updated', (_e, title) => {
      tab.title = title;
      this.notifyTabUpdate();
    });

    view.webContents.loadURL(url);
    this.switchToTab(id);

    return id;
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
      x: 0,
      y: TOOLBAR_HEIGHT,
      width: bounds.width,
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

    // Bookmarks (simplified)
    ipcMain.handle('bookmark:add', () => ({ id: '1', url: '', title: '' }));
    ipcMain.handle('bookmark:remove', () => true);
    ipcMain.handle('bookmark:get-all', () => []);
    ipcMain.handle('bookmark:search', () => []);

    // History (simplified)
    ipcMain.handle('history:add', () => ({}));
    ipcMain.handle('history:get-all', () => []);
    ipcMain.handle('history:search', () => []);
    ipcMain.handle('history:clear', () => {});

    // Code-server (simplified)
    ipcMain.handle('code-server:connect', () => false);
    ipcMain.handle('code-server:disconnect', () => {});
    ipcMain.handle('code-server:send-code', () => false);
    ipcMain.handle('code-server:status', () => ({ connected: false, url: null }));

    // AI (simplified)
    ipcMain.handle('ai:explain-code', () => ({ success: false, error: 'Not configured' }));
    ipcMain.handle('ai:summarize-docs', () => ({ success: false, error: 'Not configured' }));
    ipcMain.handle('ai:chat', () => ({ success: false, error: 'Not configured' }));
    ipcMain.handle('ai:configure', () => {});

    // OAuth (simplified)
    ipcMain.handle('oauth:status', () => ({}));
    ipcMain.handle('oauth:get-tokens', () => []);

    // App info
    ipcMain.handle('app:version', () => app.getVersion());
    ipcMain.handle('app:platform', () => process.platform);
    ipcMain.handle('app:is-dark-mode', () => nativeTheme.shouldUseDarkColors);

    console.log('✅ IPC handlers registered');
  }

  private getEmbeddedUI(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Dev Browser</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #1a1a2e;
      color: #e8e8f0;
      height: 88px;
      overflow: hidden;
      -webkit-app-region: drag;
    }
    .toolbar {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      gap: 8px;
      background: #252538;
      height: 44px;
      -webkit-app-region: no-drag;
    }
    .tab-bar {
      display: flex;
      align-items: center;
      padding: 8px 12px 0;
      gap: 4px;
      height: 44px;
      padding-left: 80px;
    }
    .tab {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #252538;
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      max-width: 200px;
      -webkit-app-region: no-drag;
    }
    .tab.active { background: #333; }
    .tab-title {
      flex: 1;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-right: 8px;
    }
    .tab-close {
      width: 16px; height: 16px;
      border: none; background: transparent;
      color: #888; cursor: pointer;
      border-radius: 4px; font-size: 14px;
    }
    .tab-close:hover { background: #444; color: white; }
    .new-tab {
      width: 28px; height: 28px;
      border: none; background: transparent;
      color: #888; cursor: pointer;
      border-radius: 6px; font-size: 18px;
      -webkit-app-region: no-drag;
    }
    .new-tab:hover { background: #333; color: white; }
    .nav-btn {
      width: 32px; height: 32px;
      border: none; background: #1a1a2e;
      color: #a0a0b8; border-radius: 6px;
      cursor: pointer; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
    }
    .nav-btn:hover { background: #333; color: white; }
    .nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .url-bar {
      flex: 1; height: 32px;
      padding: 0 12px; border: none;
      background: #1a1a2e; color: white;
      border-radius: 6px; font-size: 14px;
      outline: none;
    }
    .url-bar:focus { outline: 2px solid #6366f1; }
  </style>
</head>
<body>
  <div class="tab-bar" id="tabBar">
    <button class="new-tab" id="newTab" title="New Tab">+</button>
  </div>
  <div class="toolbar">
    <button class="nav-btn" id="backBtn" title="Back">←</button>
    <button class="nav-btn" id="forwardBtn" title="Forward">→</button>
    <button class="nav-btn" id="reloadBtn" title="Reload">↻</button>
    <input type="text" class="url-bar" id="urlBar" placeholder="Enter URL or search..." />
  </div>
  <script>
    const { ipcRenderer } = require('electron');
    
    // Elements
    const tabBar = document.getElementById('tabBar');
    const newTabBtn = document.getElementById('newTab');
    const backBtn = document.getElementById('backBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const urlBar = document.getElementById('urlBar');
    
    // Tab management
    let tabs = [];
    let activeTabId = null;
    
    function renderTabs() {
      // Remove existing tabs (keep new tab button)
      const existingTabs = tabBar.querySelectorAll('.tab');
      existingTabs.forEach(t => t.remove());
      
      // Add tabs before the + button
      tabs.forEach(tab => {
        const tabEl = document.createElement('div');
        tabEl.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
        tabEl.innerHTML = \`
          <span class="tab-title">\${tab.title || 'New Tab'}</span>
          <button class="tab-close">×</button>
        \`;
        tabEl.addEventListener('click', (e) => {
          if (!e.target.classList.contains('tab-close')) {
            window.electron.tabs.switch(tab.id);
          }
        });
        tabEl.querySelector('.tab-close').addEventListener('click', () => {
          window.electron.tabs.close(tab.id);
        });
        tabBar.insertBefore(tabEl, newTabBtn);
      });
      
      // Update URL bar
      const activeTab = tabs.find(t => t.id === activeTabId);
      if (activeTab) {
        urlBar.value = activeTab.url;
        backBtn.disabled = !activeTab.canGoBack;
        forwardBtn.disabled = !activeTab.canGoForward;
      }
    }
    
    // Event listeners
    newTabBtn.addEventListener('click', () => window.electron.tabs.create());
    backBtn.addEventListener('click', () => window.electron.tabs.back());
    forwardBtn.addEventListener('click', () => window.electron.tabs.forward());
    reloadBtn.addEventListener('click', () => window.electron.tabs.reload());
    
    urlBar.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && urlBar.value.trim()) {
        window.electron.tabs.navigate(urlBar.value.trim());
      }
    });
    
    // Listen for tab updates
    window.electron.tabs.onUpdate((data) => {
      tabs = data.tabs;
      activeTabId = data.activeTabId;
      renderTabs();
    });
    
    // Initial load
    window.electron.tabs.getAll().then(data => {
      if (Array.isArray(data)) {
        tabs = data;
        activeTabId = data.find(t => t.isActive)?.id;
        renderTabs();
      }
    });
  </script>
</body>
</html>`;
  }

  private setupMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'AI Dev Browser',
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
new SimpleBrowser();
