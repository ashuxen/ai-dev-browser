import React, { useState, useEffect, useCallback } from 'react';
import { TabBar } from './components/TabBar';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { AIPanel } from './components/AIPanel';
import { SettingsModal } from './components/SettingsModal';
import { CodeServerDialog } from './components/CodeServerDialog';
import './styles/App.css';

interface Tab {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  isActive: boolean;
}

interface AppState {
  tabs: Tab[];
  activeTabId: string | null;
  sidebarOpen: boolean;
  aiPanelOpen: boolean;
  settingsOpen: boolean;
  codeServerDialogOpen: boolean;
  isDarkMode: boolean;
  codeServerStatus: {
    connected: boolean;
    url: string | null;
  };
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    tabs: [],
    activeTabId: null,
    sidebarOpen: false,
    aiPanelOpen: false,
    settingsOpen: false,
    codeServerDialogOpen: false,
    isDarkMode: true,
    codeServerStatus: {
      connected: false,
      url: null,
    },
  });

  // Initialize app
  useEffect(() => {
    const init = async () => {
      // Check dark mode
      const isDarkMode = await window.electron.app.isDarkMode();
      setState(prev => ({ ...prev, isDarkMode }));

      // Get initial tabs
      const tabs = await window.electron.tabs.getAll();
      if (tabs.length > 0) {
        const activeTab = tabs.find((t: Tab) => t.isActive);
        setState(prev => ({
          ...prev,
          tabs,
          activeTabId: activeTab?.id || tabs[0].id,
        }));
      }

      // Get code-server status
      const codeServerStatus = await window.electron.codeServer.status();
      setState(prev => ({ ...prev, codeServerStatus }));
    };

    init();

    // Listen for tab updates
    window.electron.tabs.onUpdate((data) => {
      setState(prev => ({
        ...prev,
        tabs: data.tabs,
        activeTabId: data.activeTabId,
      }));
    });

    // Listen for theme changes
    window.electron.app.onThemeChange((isDark) => {
      setState(prev => ({ ...prev, isDarkMode: isDark }));
    });

    // Listen for menu commands
    window.electron.on('open-settings', () => {
      setState(prev => ({ ...prev, settingsOpen: true }));
    });

    window.electron.on('open-ai-panel', () => {
      setState(prev => ({ ...prev, aiPanelOpen: !prev.aiPanelOpen }));
    });

    window.electron.on('open-code-server-dialog', () => {
      setState(prev => ({ ...prev, codeServerDialogOpen: true }));
    });
  }, []);

  // Tab handlers
  const handleNewTab = useCallback(async () => {
    await window.electron.tabs.create();
  }, []);

  const handleCloseTab = useCallback(async (tabId: string) => {
    await window.electron.tabs.close(tabId);
  }, []);

  const handleSwitchTab = useCallback(async (tabId: string) => {
    await window.electron.tabs.switch(tabId);
  }, []);

  const handleNavigate = useCallback(async (url: string) => {
    await window.electron.tabs.navigate(url);
  }, []);

  const handleBack = useCallback(async () => {
    await window.electron.tabs.back();
  }, []);

  const handleForward = useCallback(async () => {
    await window.electron.tabs.forward();
  }, []);

  const handleReload = useCallback(async () => {
    await window.electron.tabs.reload();
  }, []);

  // UI handlers
  const toggleSidebar = useCallback(() => {
    setState(prev => ({ ...prev, sidebarOpen: !prev.sidebarOpen }));
  }, []);

  const toggleAIPanel = useCallback(() => {
    setState(prev => ({ ...prev, aiPanelOpen: !prev.aiPanelOpen }));
  }, []);

  const activeTab = state.tabs.find(t => t.id === state.activeTabId);

  return (
    <div className={`app ${state.isDarkMode ? 'dark' : 'light'}`}>
      {/* Title bar area (for macOS traffic lights) */}
      <div className="title-bar-spacer" />
      
      {/* Tab bar */}
      <TabBar
        tabs={state.tabs}
        activeTabId={state.activeTabId}
        onNewTab={handleNewTab}
        onCloseTab={handleCloseTab}
        onSwitchTab={handleSwitchTab}
      />
      
      {/* Navigation toolbar */}
      <Toolbar
        url={activeTab?.url || ''}
        isLoading={activeTab?.isLoading || false}
        canGoBack={activeTab?.canGoBack || false}
        canGoForward={activeTab?.canGoForward || false}
        codeServerConnected={state.codeServerStatus.connected}
        onNavigate={handleNavigate}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onToggleSidebar={toggleSidebar}
        onToggleAI={toggleAIPanel}
        onOpenSettings={() => setState(prev => ({ ...prev, settingsOpen: true }))}
        onConnectCodeServer={() => setState(prev => ({ ...prev, codeServerDialogOpen: true }))}
      />

      {/* Main content area */}
      <div className="main-content">
        {/* Sidebar */}
        <Sidebar
          isOpen={state.sidebarOpen}
          onClose={() => setState(prev => ({ ...prev, sidebarOpen: false }))}
        />

        {/* Browser view container (content rendered by main process) */}
        <div className="browser-view-container" />

        {/* AI Panel */}
        <AIPanel
          isOpen={state.aiPanelOpen}
          onClose={() => setState(prev => ({ ...prev, aiPanelOpen: false }))}
        />
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={state.settingsOpen}
        onClose={() => setState(prev => ({ ...prev, settingsOpen: false }))}
      />

      <CodeServerDialog
        isOpen={state.codeServerDialogOpen}
        onClose={() => setState(prev => ({ ...prev, codeServerDialogOpen: false }))}
        status={state.codeServerStatus}
        onConnect={async (url) => {
          const success = await window.electron.codeServer.connect(url);
          if (success) {
            const status = await window.electron.codeServer.status();
            setState(prev => ({ ...prev, codeServerStatus: status, codeServerDialogOpen: false }));
          }
          return success;
        }}
        onDisconnect={async () => {
          await window.electron.codeServer.disconnect();
          setState(prev => ({
            ...prev,
            codeServerStatus: { connected: false, url: null },
          }));
        }}
      />
    </div>
  );
};

export default App;

