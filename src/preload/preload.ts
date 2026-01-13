import { contextBridge, ipcRenderer } from 'electron';

// Type definitions for exposed APIs
export interface TabAPI {
  create: (url?: string) => Promise<any>;
  close: (tabId: string) => Promise<void>;
  switch: (tabId: string) => Promise<void>;
  navigate: (url: string) => Promise<void>;
  back: () => Promise<void>;
  forward: () => Promise<void>;
  reload: () => Promise<void>;
  getAll: () => Promise<any[]>;
  getPageContent: () => Promise<{ content: string; url: string; title: string }>;
  getSelectedText: () => Promise<string>;
  getCodeContent: () => Promise<{ code: string; language: string; url: string; title: string; source?: string; totalFound?: number }>;
  onUpdate: (callback: (data: any) => void) => void;
}

export interface BookmarkAPI {
  add: (bookmark: any) => Promise<any>;
  remove: (id: string) => Promise<boolean>;
  getAll: () => Promise<any[]>;
  search: (query: string) => Promise<any[]>;
}

export interface HistoryAPI {
  add: (entry: any) => Promise<any>;
  getAll: () => Promise<any[]>;
  search: (query: string) => Promise<any[]>;
  clear: () => Promise<void>;
}

export interface CodeServerAPI {
  connect: (url: string) => Promise<boolean>;
  disconnect: () => Promise<void>;
  sendCode: (code: string, language?: string) => Promise<boolean>;
  status: () => Promise<any>;
}

export interface AIPanelAPI {
  open: (url?: string) => Promise<any>;
  close: () => Promise<any>;
  clear: () => Promise<any>;  // Clear content but keep panel open
  setUrl: (url: string) => Promise<any>;
  reload: () => Promise<any>;
  resize: (width: number) => Promise<any>;
  status: () => Promise<any>;
}

export interface AIAPI {
  getProviders: () => Promise<any[]>;
  getConfig: () => Promise<any>;
  setConfig: (config: any) => Promise<void>;
  setApiKey: (providerId: string, apiKey: string) => Promise<void>;
  chat: (message: string, context?: string) => Promise<any>;
  explainCode: (code: string, language?: string) => Promise<any>;
  summarizeDocs: (content: string, url?: string) => Promise<any>;
  suggest: (code: string, language?: string) => Promise<any>;
  debug: (code: string, error?: string, language?: string) => Promise<any>;
  clearHistory: () => Promise<void>;
  configure: (config: any) => Promise<void>;
}

export interface OAuthAPI {
  status: () => Promise<any>;
  getTokens: () => Promise<any[]>;
}

export interface AppAPI {
  version: () => Promise<string>;
  platform: () => Promise<string>;
  isDarkMode: () => Promise<boolean>;
  onThemeChange: (callback: (isDark: boolean) => void) => void;
  openPhantomMode: () => Promise<any>;  // 👻 Phantom Mode
}

export interface DownloadAPI {
  getAll: () => Promise<any[]>;
  cancel: (id: string) => Promise<boolean>;
  pause: (id: string) => Promise<boolean>;
  resume: (id: string) => Promise<boolean>;
  clearCompleted: () => Promise<void>;
  openFile: (id: string) => Promise<boolean>;
  showInFolder: (id: string) => Promise<boolean>;
  onProgress: (callback: (download: any) => void) => void;
  onComplete: (callback: (download: any) => void) => void;
}

export interface UpdateAPI {
  check: () => Promise<any>;
  download: () => Promise<boolean>;
  install: () => Promise<void>;
  onStatus: (callback: (status: any) => void) => void;
}

export interface MenuAPI {
  show: (menuType: string) => Promise<any>;
  onAction: (callback: (action: string) => void) => void;
}

export interface ElectronAPI {
  tabs: TabAPI;
  bookmarks: BookmarkAPI;
  history: HistoryAPI;
  codeServer: CodeServerAPI;
  ai: AIAPI;
  aiPanel: AIPanelAPI;
  oauth: OAuthAPI;
  app: AppAPI;
  downloads: DownloadAPI;
  updates: UpdateAPI;
  menu: MenuAPI;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
}

// Expose APIs to renderer
contextBridge.exposeInMainWorld('electron', {
  // Tab management
  tabs: {
    create: (url?: string) => ipcRenderer.invoke('tab:create', url),
    close: (tabId: string) => ipcRenderer.invoke('tab:close', tabId),
    switch: (tabId: string) => ipcRenderer.invoke('tab:switch', tabId),
    navigate: (url: string) => ipcRenderer.invoke('tab:navigate', url),
    back: () => ipcRenderer.invoke('tab:back'),
    forward: () => ipcRenderer.invoke('tab:forward'),
    reload: () => ipcRenderer.invoke('tab:reload'),
    getAll: () => ipcRenderer.invoke('tab:get-all'),
    getPageContent: () => ipcRenderer.invoke('tab:get-page-content'),
    getSelectedText: () => ipcRenderer.invoke('tab:get-selected-text'),
    getCodeContent: () => ipcRenderer.invoke('tab:get-code-content'),
    getRecentlyClosed: () => ipcRenderer.invoke('tabs:get-recently-closed'),
    restoreClosed: (id: string) => ipcRenderer.invoke('tabs:restore-closed', id),
    clearRecentlyClosed: () => ipcRenderer.invoke('tabs:clear-recently-closed'),
    onUpdate: (callback: (data: any) => void) => {
      ipcRenderer.on('tabs-updated', (_event, data) => callback(data));
    },
  },

  // Find in Page
  find: {
    start: (text: string, options?: any) => ipcRenderer.invoke('find:start', text, options),
    next: (text: string) => ipcRenderer.invoke('find:next', text),
    previous: (text: string) => ipcRenderer.invoke('find:previous', text),
    stop: () => ipcRenderer.invoke('find:stop'),
    onResult: (callback: (result: any) => void) => {
      ipcRenderer.on('find:result', (_event, result) => callback(result));
    },
  },

  // Developer Tools
  devtools: {
    toggle: () => ipcRenderer.invoke('devtools:toggle'),
    open: () => ipcRenderer.invoke('devtools:open'),
    close: () => ipcRenderer.invoke('devtools:close'),
  },

  // Screenshot
  screenshot: {
    capture: (options?: any) => ipcRenderer.invoke('screenshot:capture', options),
  },

  // Ad & Tracker Blocking
  blocking: {
    getStatus: () => ipcRenderer.invoke('blocking:get-status'),
    setAdBlock: (enabled: boolean) => ipcRenderer.invoke('blocking:set-ad-block', enabled),
    setTrackerBlock: (enabled: boolean) => ipcRenderer.invoke('blocking:set-tracker-block', enabled),
  },

  // Security
  security: {
    clearData: () => ipcRenderer.invoke('security:clear-data'),
  },

  // Settings management
  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    update: (updates: any) => ipcRenderer.invoke('settings:update', updates),
  },

  // Bookmark management
  bookmarks: {
    add: (bookmark: any) => ipcRenderer.invoke('bookmark:add', bookmark),
    remove: (id: string) => ipcRenderer.invoke('bookmark:remove', id),
    update: (id: string, updates: any) => ipcRenderer.invoke('bookmark:update', id, updates),
    getAll: () => ipcRenderer.invoke('bookmark:get-all'),
    getByFolder: (folderId: string) => ipcRenderer.invoke('bookmark:get-by-folder', folderId),
    search: (query: string) => ipcRenderer.invoke('bookmark:search', query),
    // Folder management
    getFolders: () => ipcRenderer.invoke('bookmark:get-folders'),
    createFolder: (name: string, parentId?: string) => ipcRenderer.invoke('bookmark:create-folder', name, parentId),
    deleteFolder: (id: string) => ipcRenderer.invoke('bookmark:delete-folder', id),
    moveToFolder: (bookmarkId: string, folderId: string) => ipcRenderer.invoke('bookmark:move-to-folder', bookmarkId, folderId),
    // AI organization
    suggestFolder: (url: string, title: string) => ipcRenderer.invoke('bookmark:suggest-folder', url, title),
  },

  // History management
  history: {
    add: (entry: any) => ipcRenderer.invoke('history:add', entry),
    getAll: () => ipcRenderer.invoke('history:get-all'),
    search: (query: string) => ipcRenderer.invoke('history:search', query),
    clear: () => ipcRenderer.invoke('history:clear'),
  },

  // Code-Server integration
  codeServer: {
    connect: (url: string) => ipcRenderer.invoke('code-server:connect', url),
    disconnect: () => ipcRenderer.invoke('code-server:disconnect'),
    sendCode: (code: string, language?: string) => 
      ipcRenderer.invoke('code-server:send-code', code, language),
    status: () => ipcRenderer.invoke('code-server:status'),
  },

  // AI Panel
  aiPanel: {
    open: (url?: string) => ipcRenderer.invoke('ai-panel:open', url),
    close: () => ipcRenderer.invoke('ai-panel:close'),
    clear: () => ipcRenderer.invoke('ai-panel:clear'),  // Clear content, keep panel open
    setUrl: (url: string) => ipcRenderer.invoke('ai-panel:set-url', url),
    reload: () => ipcRenderer.invoke('ai-panel:reload'),
    resize: (width: number) => ipcRenderer.invoke('ai-panel:resize', width),
    status: () => ipcRenderer.invoke('ai-panel:status'),
    injectContent: (content: string) => ipcRenderer.invoke('ai-panel:inject-content', content),
  },

  // AI Service
  ai: {
    getProviders: () => ipcRenderer.invoke('ai:get-providers'),
    getConfig: () => ipcRenderer.invoke('ai:get-config'),
    setConfig: (config: any) => ipcRenderer.invoke('ai:set-config', config),
    setApiKey: (providerId: string, apiKey: string) => 
      ipcRenderer.invoke('ai:set-api-key', providerId, apiKey),
    chat: (message: string, context?: string) =>
      ipcRenderer.invoke('ai:chat', message, context),
    explainCode: (code: string, language?: string) =>
      ipcRenderer.invoke('ai:explain-code', code, language),
    summarizeDocs: (content: string, url?: string) =>
      ipcRenderer.invoke('ai:summarize-docs', content, url),
    suggest: (code: string, language?: string) =>
      ipcRenderer.invoke('ai:suggest', code, language),
    debug: (code: string, error?: string, language?: string) =>
      ipcRenderer.invoke('ai:debug', code, error, language),
    clearHistory: () => ipcRenderer.invoke('ai:clear-history'),
    configure: (config: any) => ipcRenderer.invoke('ai:configure', config),
  },

  // OAuth
  oauth: {
    status: () => ipcRenderer.invoke('oauth:status'),
    getTokens: () => ipcRenderer.invoke('oauth:get-tokens'),
  },

  // App info
  app: {
    version: () => ipcRenderer.invoke('app:version'),
    platform: () => ipcRenderer.invoke('app:platform'),
    isDarkMode: () => ipcRenderer.invoke('app:is-dark-mode'),
    onThemeChange: (callback: (isDark: boolean) => void) => {
      ipcRenderer.on('theme-changed', (_event, isDark) => callback(isDark));
    },
    openPhantomMode: () => ipcRenderer.invoke('phantom:open'),  // 👻 Phantom Mode
  },

  // Downloads
  downloads: {
    getAll: () => ipcRenderer.invoke('download:get-all'),
    cancel: (id: string) => ipcRenderer.invoke('download:cancel', id),
    pause: (id: string) => ipcRenderer.invoke('download:pause', id),
    resume: (id: string) => ipcRenderer.invoke('download:resume', id),
    clearCompleted: () => ipcRenderer.invoke('download:clear-completed'),
    openFile: (id: string) => ipcRenderer.invoke('download:open-file', id),
    showInFolder: (id: string) => ipcRenderer.invoke('download:show-in-folder', id),
    onProgress: (callback: (download: any) => void) => {
      ipcRenderer.on('download-progress', (_event, download) => callback(download));
    },
    onComplete: (callback: (download: any) => void) => {
      ipcRenderer.on('download-complete', (_event, download) => callback(download));
    },
  },

  // Updates (auto-update functionality)
  updates: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (callback: (status: any) => void) => {
      ipcRenderer.on('update:status', (_event, status) => callback(status));
    },
  },

  // Native Menu (works above BrowserViews)
  menu: {
    show: (menuType: string) => ipcRenderer.invoke('menu:show', menuType),
    onAction: (callback: (action: string) => void) => {
      ipcRenderer.on('menu:action', (_event, action) => callback(action));
    },
  },

  // Hide/Show BrowserViews (for modals to be visible)
  views: {
    hide: () => ipcRenderer.invoke('views:hide'),
    show: () => ipcRenderer.invoke('views:show'),
  },

  // Generic event handlers
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = [
      'tabs-updated',
      'theme-changed',
      'download-progress',
      'download-complete',
      'update-status',
      'oauth-callback-received',
      'context-menu',
      'open-settings',
      'open-find',
      'open-code-server-dialog',
      'open-api-tester',
      'open-snippets',
      'open-ai-panel',
      'add-bookmark',
      'show-bookmarks',
      'menu:action',
      'fullscreen-change',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args));
    }
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
} as ElectronAPI);

// Declare global type for TypeScript
declare global {
  interface Window {
    electron: ElectronAPI;
  }
}


