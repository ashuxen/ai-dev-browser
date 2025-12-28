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
import { AIService } from './ai-service';

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
  private phantomWindows: Set<BrowserWindow> = new Set();  // Phantom Mode windows
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private tabIdCounter = 0;
  private sidebarWidth = 0;
  
  // AI Panel
  private aiPanelView: BrowserView | null = null;
  private aiPanelOpen = false;
  private aiPanelWidth = 420;
  
  // Managers
  private bookmarkManager: BookmarkManager;
  private historyManager: HistoryManager;
  private aiService: AIService;

  constructor() {
    this.bookmarkManager = new BookmarkManager();
    this.historyManager = new HistoryManager();
    this.aiService = new AIService();
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

    // Load the browser UI HTML file
    const isDev = !app.isPackaged;
    const uiPath = isDev
      ? path.join(app.getAppPath(), 'src/renderer/browser-ui.html')
      : path.join(process.resourcesPath, 'browser-ui.html');
    console.log('📦 Loading UI from:', uiPath, '(isDev:', isDev, ')');
    
    try {
      await this.mainWindow.loadFile(uiPath);
    } catch (err) {
      console.error('❌ Failed to load UI:', err);
      // Fallback: try loading from app path
      const fallbackPath = path.join(app.getAppPath(), 'src/renderer/browser-ui.html');
      console.log('📦 Trying fallback:', fallbackPath);
      await this.mainWindow.loadFile(fallbackPath);
    }

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
    const aiWidth = this.aiPanelOpen ? this.aiPanelWidth : 0;

    tab.view.setBounds({
      x: this.sidebarWidth,
      y: TOOLBAR_HEIGHT,
      width: bounds.width - this.sidebarWidth - aiWidth,
      height: bounds.height - TOOLBAR_HEIGHT,
    });

    // Update AI panel bounds if open
    // Leave space for AI panel header (56px) + quick actions (50px) + selector (50px) = ~156px
    const AI_PANEL_HEADER_HEIGHT = 200; // Header + selector + quick actions
    if (this.aiPanelView && this.aiPanelOpen) {
      this.aiPanelView.setBounds({
        x: bounds.width - aiWidth,
        y: TOOLBAR_HEIGHT + AI_PANEL_HEADER_HEIGHT,
        width: aiWidth,
        height: bounds.height - TOOLBAR_HEIGHT - AI_PANEL_HEADER_HEIGHT,
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
    } else {
      this.aiPanelWidth = Math.max(320, Math.min(800, width));
      this.aiPanelOpen = true;
    }
    this.updateTabBounds();
    console.log('🤖 AI Panel resized to:', this.aiPanelWidth);
  }

  // 👻 Phantom Mode - Private browsing with no traces
  private createPhantomWindow() {
    console.log('👻 Opening Phantom Mode...');
    
    // Create ephemeral session (in-memory only, no persistence)
    const { session } = require('electron');
    const phantomSession = session.fromPartition(`phantom-${Date.now()}`, { cache: false });
    
    const phantomWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
      trafficLightPosition: { x: 15, y: 15 },
      backgroundColor: '#1a0a2e',  // Darker purple for Phantom Mode
      title: '👻 Phantom Mode - FlashAppAI',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webviewTag: true,
        session: phantomSession,
      },
    });

    // Load phantom mode UI
    const phantomIsDev = !app.isPackaged;
    const phantomUIPath = phantomIsDev
      ? path.join(app.getAppPath(), 'src/renderer/phantom-mode.html')
      : path.join(process.resourcesPath, 'phantom-mode.html');
    phantomWindow.loadFile(phantomUIPath).catch(() => {
      // Fallback if phantom-mode.html doesn't exist yet
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

    console.log('👻 Phantom Mode window created');
    return phantomWindow;
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

    // 👻 Phantom Mode
    ipcMain.handle('phantom:open', () => {
      this.createPhantomWindow();
      return { success: true };
    });

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
