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

export interface ElectronAPI {
  tabs: TabAPI;
  bookmarks: BookmarkAPI;
  history: HistoryAPI;
  codeServer: CodeServerAPI;
  ai: AIAPI;
  oauth: OAuthAPI;
  app: AppAPI;
  downloads: DownloadAPI;
  updates: UpdateAPI;
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
    onUpdate: (callback: (data: any) => void) => {
      ipcRenderer.on('tabs-updated', (_event, data) => callback(data));
    },
  },

  // Bookmark management
  bookmarks: {
    add: (bookmark: any) => ipcRenderer.invoke('bookmark:add', bookmark),
    remove: (id: string) => ipcRenderer.invoke('bookmark:remove', id),
    getAll: () => ipcRenderer.invoke('bookmark:get-all'),
    search: (query: string) => ipcRenderer.invoke('bookmark:search', query),
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

  // Updates
  updates: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (callback: (status: any) => void) => {
      ipcRenderer.on('update-status', (_event, status) => callback(status));
    },
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


