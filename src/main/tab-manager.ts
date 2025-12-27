import { BrowserWindow, BrowserView, ipcMain } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import Store from 'electron-store';

export interface Tab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isActive: boolean;
  createdAt: number;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
}

export class TabManager {
  private mainWindow: BrowserWindow | null = null;
  private views: Map<string, BrowserView> = new Map();
  private tabs: Map<string, Tab> = new Map();
  private activeTabId: string | null = null;
  private store: Store<{ tabState: TabState }>;

  constructor() {
    this.store = new Store({
      name: 'tab-state',
      defaults: {
        tabState: {
          tabs: [],
          activeTabId: null,
        },
      },
    });
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
    
    // Restore tabs from previous session
    this.restoreTabs();

    // Create default tab if no tabs exist
    if (this.tabs.size === 0) {
      this.createTab('https://google.com');
    }

    // Handle window resize
    window.on('resize', () => this.updateViewBounds());
  }

  /**
   * Create a new tab
   */
  createTab(url: string = 'https://google.com'): Tab {
    const tabId = uuidv4();
    
    const tab: Tab = {
      id: tabId,
      url: url,
      title: 'New Tab',
      isLoading: true,
      canGoBack: false,
      canGoForward: false,
      isActive: false,
      createdAt: Date.now(),
    };

    this.tabs.set(tabId, tab);

    // Create BrowserView for this tab
    if (this.mainWindow) {
      const view = new BrowserView({
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
        },
      });

      this.views.set(tabId, view);
      
      // Set up event listeners
      this.setupViewListeners(tabId, view);
      
      // Load URL
      view.webContents.loadURL(url);
    }

    // Switch to new tab
    this.switchToTab(tabId);
    
    // Notify renderer
    this.notifyTabsUpdate();
    
    return tab;
  }

  /**
   * Close a tab
   */
  closeTab(tabId: string): void {
    const view = this.views.get(tabId);
    
    if (view) {
      if (this.mainWindow && this.activeTabId === tabId) {
        this.mainWindow.removeBrowserView(view);
      }
      
      // Destroy the view
      (view.webContents as any).destroy?.();
      this.views.delete(tabId);
    }

    this.tabs.delete(tabId);

    // Switch to another tab if this was active
    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        this.switchToTab(remainingTabs[remainingTabs.length - 1]);
      } else {
        this.activeTabId = null;
        // Create a new tab if all tabs are closed
        this.createTab();
      }
    }

    this.notifyTabsUpdate();
    this.saveTabs();
  }

  /**
   * Close current active tab
   */
  closeCurrentTab(): void {
    if (this.activeTabId) {
      this.closeTab(this.activeTabId);
    }
  }

  /**
   * Switch to a specific tab
   */
  switchToTab(tabId: string): void {
    if (!this.tabs.has(tabId) || !this.mainWindow) return;

    // Deactivate current tab
    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentView = this.views.get(this.activeTabId);
      if (currentView) {
        this.mainWindow.removeBrowserView(currentView);
      }
      
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        currentTab.isActive = false;
        this.tabs.set(this.activeTabId, currentTab);
      }
    }

    // Activate new tab
    const newView = this.views.get(tabId);
    if (newView) {
      this.mainWindow.addBrowserView(newView);
      this.updateViewBounds();
    }

    const newTab = this.tabs.get(tabId);
    if (newTab) {
      newTab.isActive = true;
      this.tabs.set(tabId, newTab);
    }

    this.activeTabId = tabId;
    this.notifyTabsUpdate();
    this.saveTabs();
  }

  /**
   * Navigate to a URL in the current tab
   */
  navigateTo(url: string): void {
    if (!this.activeTabId) return;

    const view = this.views.get(this.activeTabId);
    if (view) {
      // Ensure URL has protocol
      if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
        // Check if it looks like a URL
        if (url.includes('.') && !url.includes(' ')) {
          url = `https://${url}`;
        } else {
          // Treat as search query
          url = `https://google.com/search?q=${encodeURIComponent(url)}`;
        }
      }

      view.webContents.loadURL(url);
    }
  }

  /**
   * Go back in history
   */
  goBack(): void {
    if (!this.activeTabId) return;

    const view = this.views.get(this.activeTabId);
    if (view && view.webContents.canGoBack()) {
      view.webContents.goBack();
    }
  }

  /**
   * Go forward in history
   */
  goForward(): void {
    if (!this.activeTabId) return;

    const view = this.views.get(this.activeTabId);
    if (view && view.webContents.canGoForward()) {
      view.webContents.goForward();
    }
  }

  /**
   * Reload current tab
   */
  reload(): void {
    if (!this.activeTabId) return;

    const view = this.views.get(this.activeTabId);
    if (view) {
      view.webContents.reload();
    }
  }

  /**
   * Get all tabs
   */
  getAllTabs(): Tab[] {
    return Array.from(this.tabs.values());
  }

  /**
   * Get active tab
   */
  getActiveTab(): Tab | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) || null;
  }

  /**
   * Set up event listeners for a BrowserView
   */
  private setupViewListeners(tabId: string, view: BrowserView): void {
    const webContents = view.webContents;

    webContents.on('did-start-loading', () => {
      this.updateTab(tabId, { isLoading: true });
    });

    webContents.on('did-stop-loading', () => {
      this.updateTab(tabId, { isLoading: false });
    });

    webContents.on('did-navigate', (_event, url) => {
      this.updateTab(tabId, {
        url,
        canGoBack: webContents.canGoBack(),
        canGoForward: webContents.canGoForward(),
      });
    });

    webContents.on('did-navigate-in-page', (_event, url) => {
      this.updateTab(tabId, {
        url,
        canGoBack: webContents.canGoBack(),
        canGoForward: webContents.canGoForward(),
      });
    });

    webContents.on('page-title-updated', (_event, title) => {
      this.updateTab(tabId, { title });
    });

    webContents.on('page-favicon-updated', (_event, favicons) => {
      if (favicons.length > 0) {
        this.updateTab(tabId, { favicon: favicons[0] });
      }
    });

    // Context menu for right-click
    webContents.on('context-menu', (_event, params) => {
      this.mainWindow?.webContents.send('context-menu', {
        tabId,
        params: {
          x: params.x,
          y: params.y,
          linkURL: params.linkURL,
          srcURL: params.srcURL,
          selectionText: params.selectionText,
          isEditable: params.isEditable,
          mediaType: params.mediaType,
        },
      });
    });
  }

  /**
   * Update tab properties
   */
  private updateTab(tabId: string, updates: Partial<Tab>): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      Object.assign(tab, updates);
      this.tabs.set(tabId, tab);
      this.notifyTabsUpdate();
    }
  }

  /**
   * Update view bounds to fit window
   */
  private updateViewBounds(): void {
    if (!this.mainWindow || !this.activeTabId) return;

    const view = this.views.get(this.activeTabId);
    if (!view) return;

    const bounds = this.mainWindow.getBounds();
    const TAB_BAR_HEIGHT = 80; // Height of tab bar + toolbar

    view.setBounds({
      x: 0,
      y: TAB_BAR_HEIGHT,
      width: bounds.width,
      height: bounds.height - TAB_BAR_HEIGHT,
    });
  }

  /**
   * Notify renderer of tab updates
   */
  private notifyTabsUpdate(): void {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('tabs-updated', {
        tabs: this.getAllTabs(),
        activeTabId: this.activeTabId,
      });
    }
  }

  /**
   * Save tabs to persistent storage
   */
  private saveTabs(): void {
    const tabState: TabState = {
      tabs: this.getAllTabs().map(tab => ({
        ...tab,
        isLoading: false, // Don't save loading state
      })),
      activeTabId: this.activeTabId,
    };
    this.store.set('tabState', tabState);
  }

  /**
   * Restore tabs from previous session
   */
  private restoreTabs(): void {
    const tabState = this.store.get('tabState');
    
    // Only restore if we have saved tabs
    if (tabState.tabs.length > 0) {
      for (const tab of tabState.tabs) {
        // Recreate the tab
        const newTab = this.createTab(tab.url);
        newTab.title = tab.title;
        newTab.favicon = tab.favicon;
      }

      // Switch to previously active tab
      if (tabState.activeTabId && this.tabs.has(tabState.activeTabId)) {
        this.switchToTab(tabState.activeTabId);
      }
    }
  }
}

