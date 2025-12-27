import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  Menu,
  shell,
  nativeTheme,
  dialog,
  protocol,
} from 'electron';
import path from 'path';
import { OAuthBridge } from './oauth-bridge';
import { CodeServerIntegration } from './code-server-integration';
import { TabManager } from './tab-manager';
import { BookmarkManager } from './bookmark-manager';
import { HistoryManager } from './history-manager';
import { DownloadManager } from './download-manager';
import { AIService } from '../services/ai-service';
import { setupAutoUpdater } from './auto-updater';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

class AIDevBrowser {
  private mainWindow: BrowserWindow | null = null;
  private oauthBridge: OAuthBridge;
  private codeServerIntegration: CodeServerIntegration;
  private tabManager: TabManager;
  private bookmarkManager: BookmarkManager;
  private historyManager: HistoryManager;
  private downloadManager: DownloadManager;
  private aiService: AIService;

  constructor() {
    this.oauthBridge = new OAuthBridge();
    this.codeServerIntegration = new CodeServerIntegration();
    this.tabManager = new TabManager();
    this.bookmarkManager = new BookmarkManager();
    this.historyManager = new HistoryManager();
    this.downloadManager = new DownloadManager();
    this.aiService = new AIService();

    this.setupApp();
  }

  private setupApp(): void {
    // Ensure single instance
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
      return;
    }

    app.on('second-instance', (_event, commandLine) => {
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
        
        // Handle URLs passed to second instance
        const url = commandLine.find(arg => arg.startsWith('http'));
        if (url) {
          this.tabManager.createTab(url);
        }
      }
    });

    app.whenReady().then(() => {
      this.registerProtocols();
      this.createWindow();
      this.setupMenu();
      this.setupIPC();
      this.setupOAuthInterception();
      setupAutoUpdater(this.mainWindow!);

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Security settings
    app.on('web-contents-created', (_event, contents) => {
      contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        // Allow navigation within the app
        if (parsedUrl.origin !== 'file://') {
          event.preventDefault();
          this.tabManager.navigateTo(navigationUrl);
        }
      });

      contents.setWindowOpenHandler(({ url }) => {
        // Open external links in new tab
        this.tabManager.createTab(url);
        return { action: 'deny' };
      });
    });
  }

  private registerProtocols(): void {
    // Register custom protocol for OAuth callbacks
    protocol.registerHttpProtocol('aidevbrowser', (request, callback) => {
      this.oauthBridge.handleCallback(request.url);
      callback({ url: 'about:blank' });
    });

    // Handle vscode:// protocol
    app.setAsDefaultProtocolClient('vscode');
    app.setAsDefaultProtocolClient('aidevbrowser');
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      trafficLightPosition: { x: 15, y: 15 },
      frame: process.platform !== 'darwin',
      backgroundColor: nativeTheme.shouldUseDarkColors ? '#1a1a2e' : '#ffffff',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        webviewTag: true,
        webSecurity: true,
      },
      icon: path.join(__dirname, '../../assets/icons/icon.png'),
    });

    // Load the main window
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      this.mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      this.mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
      );
    }

    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Initialize managers with main window
    this.tabManager.setMainWindow(this.mainWindow);
    this.downloadManager.setMainWindow(this.mainWindow);
  }

  private setupMenu(): void {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'AI Dev Browser',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          {
            label: 'Preferences',
            accelerator: 'CmdOrCtrl+,',
            click: () => this.mainWindow?.webContents.send('open-settings'),
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
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
            click: () => this.tabManager.createTab(),
          },
          {
            label: 'New Window',
            accelerator: 'CmdOrCtrl+N',
            click: () => this.createWindow(),
          },
          { type: 'separator' },
          {
            label: 'Close Tab',
            accelerator: 'CmdOrCtrl+W',
            click: () => this.tabManager.closeCurrentTab(),
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
          { type: 'separator' },
          {
            label: 'Find',
            accelerator: 'CmdOrCtrl+F',
            click: () => this.mainWindow?.webContents.send('open-find'),
          },
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
        label: 'Navigate',
        submenu: [
          {
            label: 'Back',
            accelerator: 'CmdOrCtrl+[',
            click: () => this.tabManager.goBack(),
          },
          {
            label: 'Forward',
            accelerator: 'CmdOrCtrl+]',
            click: () => this.tabManager.goForward(),
          },
          {
            label: 'Reload',
            accelerator: 'CmdOrCtrl+R',
            click: () => this.tabManager.reload(),
          },
          { type: 'separator' },
          {
            label: 'Home',
            accelerator: 'CmdOrCtrl+Shift+H',
            click: () => this.tabManager.navigateTo('https://google.com'),
          },
        ],
      },
      {
        label: 'Developer',
        submenu: [
          {
            label: 'Connect to Code-Server',
            click: () => this.mainWindow?.webContents.send('open-code-server-dialog'),
          },
          { type: 'separator' },
          {
            label: 'API Tester',
            accelerator: 'CmdOrCtrl+Shift+A',
            click: () => this.mainWindow?.webContents.send('open-api-tester'),
          },
          {
            label: 'Snippets Manager',
            accelerator: 'CmdOrCtrl+Shift+S',
            click: () => this.mainWindow?.webContents.send('open-snippets'),
          },
          { type: 'separator' },
          {
            label: 'AI Assistant',
            accelerator: 'CmdOrCtrl+Shift+I',
            click: () => this.mainWindow?.webContents.send('open-ai-panel'),
          },
        ],
      },
      {
        label: 'Bookmarks',
        submenu: [
          {
            label: 'Bookmark This Page',
            accelerator: 'CmdOrCtrl+D',
            click: () => this.mainWindow?.webContents.send('add-bookmark'),
          },
          {
            label: 'Show All Bookmarks',
            accelerator: 'CmdOrCtrl+Shift+B',
            click: () => this.mainWindow?.webContents.send('show-bookmarks'),
          },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Documentation',
            click: () => shell.openExternal('https://docs.flashappai.org'),
          },
          {
            label: 'Report Issue',
            click: () => shell.openExternal('https://github.com/flashappai/ai-dev-browser/issues'),
          },
          { type: 'separator' },
          {
            label: 'About AI Dev Browser',
            click: () => {
              dialog.showMessageBox({
                type: 'info',
                title: 'About AI Dev Browser',
                message: 'AI Dev Browser',
                detail: `Version ${app.getVersion()}\n\nAn AI-powered browser for developers working with cloud-based code editors.\n\n© 2025 FlashAppAI Team`,
              });
            },
          },
        ],
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private setupIPC(): void {
    // Tab management
    ipcMain.handle('tab:create', (_event, url?: string) => this.tabManager.createTab(url));
    ipcMain.handle('tab:close', (_event, tabId: string) => this.tabManager.closeTab(tabId));
    ipcMain.handle('tab:switch', (_event, tabId: string) => this.tabManager.switchToTab(tabId));
    ipcMain.handle('tab:navigate', (_event, url: string) => this.tabManager.navigateTo(url));
    ipcMain.handle('tab:back', () => this.tabManager.goBack());
    ipcMain.handle('tab:forward', () => this.tabManager.goForward());
    ipcMain.handle('tab:reload', () => this.tabManager.reload());
    ipcMain.handle('tab:get-all', () => this.tabManager.getAllTabs());

    // Bookmark management
    ipcMain.handle('bookmark:add', (_event, bookmark) => this.bookmarkManager.add(bookmark));
    ipcMain.handle('bookmark:remove', (_event, id: string) => this.bookmarkManager.remove(id));
    ipcMain.handle('bookmark:get-all', () => this.bookmarkManager.getAll());
    ipcMain.handle('bookmark:search', (_event, query: string) => this.bookmarkManager.search(query));

    // History management
    ipcMain.handle('history:add', (_event, entry) => this.historyManager.add(entry));
    ipcMain.handle('history:get-all', () => this.historyManager.getAll());
    ipcMain.handle('history:search', (_event, query: string) => this.historyManager.search(query));
    ipcMain.handle('history:clear', () => this.historyManager.clear());

    // Code-Server integration
    ipcMain.handle('code-server:connect', (_event, url: string) => 
      this.codeServerIntegration.connect(url)
    );
    ipcMain.handle('code-server:disconnect', () => 
      this.codeServerIntegration.disconnect()
    );
    ipcMain.handle('code-server:send-code', (_event, code: string, language?: string) =>
      this.codeServerIntegration.sendCode(code, language)
    );
    ipcMain.handle('code-server:status', () => 
      this.codeServerIntegration.getStatus()
    );

    // AI Service
    ipcMain.handle('ai:explain-code', (_event, code: string, language?: string) =>
      this.aiService.explainCode(code, language)
    );
    ipcMain.handle('ai:summarize-docs', (_event, content: string) =>
      this.aiService.summarizeDocs(content)
    );
    ipcMain.handle('ai:chat', (_event, message: string, context?: string) =>
      this.aiService.chat(message, context)
    );
    ipcMain.handle('ai:configure', (_event, config) =>
      this.aiService.configure(config)
    );

    // OAuth
    ipcMain.handle('oauth:status', () => this.oauthBridge.getStatus());
    ipcMain.handle('oauth:get-tokens', () => this.oauthBridge.getStoredTokens());

    // App info
    ipcMain.handle('app:version', () => app.getVersion());
    ipcMain.handle('app:platform', () => process.platform);
    ipcMain.handle('app:is-dark-mode', () => nativeTheme.shouldUseDarkColors);

    // Theme changes
    nativeTheme.on('updated', () => {
      this.mainWindow?.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors);
    });
  }

  private setupOAuthInterception(): void {
    // Intercept OAuth callbacks
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['*://localhost/*', '*://127.0.0.1/*'] },
      (details, callback) => {
        const url = new URL(details.url);
        
        // Check if this is an OAuth callback
        if (this.oauthBridge.isOAuthCallback(url)) {
          this.oauthBridge.handleCallback(details.url);
          // Notify renderer about successful auth
          this.mainWindow?.webContents.send('oauth-callback-received', {
            provider: this.oauthBridge.identifyProvider(url),
            success: true,
          });
          callback({ cancel: false });
        } else {
          callback({ cancel: false });
        }
      }
    );

    // Handle vscode:// protocol
    app.on('open-url', (_event, url) => {
      if (url.startsWith('vscode://')) {
        this.oauthBridge.handleVSCodeCallback(url);
        this.mainWindow?.webContents.send('oauth-callback-received', {
          provider: 'vscode',
          success: true,
        });
      }
    });
  }
}

// Start the browser
new AIDevBrowser();

