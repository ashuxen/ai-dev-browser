# 🎓 Complete Guide: Building an AI-Powered Browser from Scratch

A comprehensive learning guide with step-by-step tutorials for developers who want to build their own browser.

---

## 📚 Table of Contents

1. [Prerequisites & Learning Path](#-prerequisites--learning-path)
2. [Understanding Browser Architecture](#-understanding-browser-architecture)
3. [Tutorial 1: Your First Electron App](#-tutorial-1-your-first-electron-app-30-mins)
4. [Tutorial 2: Creating a Basic Browser](#-tutorial-2-creating-a-basic-browser-45-mins)
5. [Tutorial 3: Adding Tabs](#-tutorial-3-adding-tabs-60-mins)
6. [Tutorial 4: Building the UI with React](#-tutorial-4-building-the-ui-with-react-90-mins)
7. [Tutorial 5: Implementing OAuth Bridge](#-tutorial-5-implementing-oauth-bridge-60-mins)
8. [Tutorial 6: Adding AI Integration](#-tutorial-6-adding-ai-integration-45-mins)
9. [Tutorial 7: Cross-Platform Building](#-tutorial-7-cross-platform-building-30-mins)
10. [Resources & Next Steps](#-resources--next-steps)

---

## 🎯 Prerequisites & Learning Path

### Required Knowledge

| Skill | Level | Why You Need It |
|-------|-------|-----------------|
| JavaScript/TypeScript | Intermediate | Core language for Electron |
| HTML/CSS | Intermediate | Building the browser UI |
| React | Beginner+ | Modern UI components |
| Node.js | Beginner | Server-side operations |
| Git | Beginner | Version control |

### Recommended Learning Order

```
Week 1: JavaScript ES6+ & TypeScript basics
Week 2: Node.js fundamentals
Week 3: React fundamentals
Week 4: Electron basics (this guide)
Week 5-6: Build your browser!
```

### Tools You'll Need

```bash
# Install these before starting
node --version  # v18 or higher
npm --version   # v9 or higher
git --version   # Any recent version

# Code editor
# Download VS Code: https://code.visualstudio.com
```

---

## 🏗️ Understanding Browser Architecture

### How Browsers Work

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Tab 1     │  │   Tab 2     │  │   Tab 3     │  ...    │
│  │ (WebView)   │  │ (WebView)   │  │ (WebView)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
├─────────────────────────────────────────────────────────────┤
│                     BROWSER CHROME                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [←] [→] [↻]  │ https://example.com          │ [⚙]  │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    ELECTRON FRAMEWORK                        │
│  ┌──────────────────┐  ┌──────────────────────────────┐    │
│  │   Main Process   │  │      Renderer Process        │    │
│  │   (Node.js)      │◄─┤      (Chromium)              │    │
│  │   - File system  │  │      - Web pages             │    │
│  │   - Native APIs  │  │      - React UI              │    │
│  │   - IPC          │  │      - DOM                   │    │
│  └──────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Electron's Two Processes

| Main Process | Renderer Process |
|-------------|------------------|
| Runs Node.js | Runs Chromium |
| Creates windows | Displays web content |
| Handles system APIs | Handles user interactions |
| One per app | One per window/webview |

---

## 📘 Tutorial 1: Your First Electron App (30 mins)

### Goal
Create a simple Electron window that displays "Hello World"

### Step 1: Create Project

```bash
# Create a new folder
mkdir my-first-browser
cd my-first-browser

# Initialize npm
npm init -y

# Install Electron
npm install electron --save-dev
```

### Step 2: Create Main Process

Create `main.js`:

```javascript
// main.js - The brain of your app
const { app, BrowserWindow } = require('electron');

// Function to create a window
function createWindow() {
  // Create a new browser window
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  // Load an HTML file
  win.loadFile('index.html');
}

// When Electron is ready, create the window
app.whenReady().then(createWindow);

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

### Step 3: Create the HTML

Create `index.html`:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My First Browser</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    h1 {
      font-size: 3em;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <h1>🎉 Hello, Browser Developer!</h1>
</body>
</html>
```

### Step 4: Update package.json

```json
{
  "name": "my-first-browser",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron ."
  }
}
```

### Step 5: Run It!

```bash
npm start
```

🎊 **Congratulations!** You've created your first Electron app!

### What You Learned
- ✅ How Electron apps are structured
- ✅ The main process creates windows
- ✅ Windows load HTML content

---

## 📘 Tutorial 2: Creating a Basic Browser (45 mins)

### Goal
Add a URL bar and navigation controls to browse real websites

### Step 1: Update main.js

```javascript
// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,  // Enable <webview> tag
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

### Step 2: Create preload.js

```javascript
// preload.js - Bridge between main and renderer
const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer
contextBridge.exposeInMainWorld('browserAPI', {
  // We'll add functions here later
});
```

### Step 3: Create Browser UI

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>My Browser</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #1a1a2e;
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    /* Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #252538;
      gap: 8px;
    }
    
    /* Navigation buttons */
    .nav-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: #1a1a2e;
      color: #a0a0b8;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
    }
    
    .nav-btn:hover {
      background: #333;
      color: white;
    }
    
    .nav-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    
    /* URL bar */
    .url-bar {
      flex: 1;
      height: 32px;
      padding: 0 12px;
      border: none;
      background: #1a1a2e;
      color: white;
      border-radius: 6px;
      font-size: 14px;
    }
    
    .url-bar:focus {
      outline: 2px solid #6366f1;
    }
    
    /* WebView container */
    .browser-content {
      flex: 1;
      display: flex;
    }
    
    webview {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <!-- Toolbar -->
  <div class="toolbar">
    <button class="nav-btn" id="backBtn" title="Go Back">←</button>
    <button class="nav-btn" id="forwardBtn" title="Go Forward">→</button>
    <button class="nav-btn" id="reloadBtn" title="Reload">↻</button>
    <input type="text" class="url-bar" id="urlBar" placeholder="Enter URL or search...">
    <button class="nav-btn" id="goBtn" title="Go">Go</button>
  </div>
  
  <!-- Browser content -->
  <div class="browser-content">
    <webview id="webview" src="https://www.google.com"></webview>
  </div>
  
  <script>
    // Get elements
    const webview = document.getElementById('webview');
    const urlBar = document.getElementById('urlBar');
    const backBtn = document.getElementById('backBtn');
    const forwardBtn = document.getElementById('forwardBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const goBtn = document.getElementById('goBtn');
    
    // Navigate to URL
    function navigate(url) {
      // Add https:// if missing
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      webview.src = url;
    }
    
    // Handle URL bar enter key
    urlBar.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        navigate(urlBar.value);
      }
    });
    
    // Go button
    goBtn.addEventListener('click', () => navigate(urlBar.value));
    
    // Navigation buttons
    backBtn.addEventListener('click', () => webview.goBack());
    forwardBtn.addEventListener('click', () => webview.goForward());
    reloadBtn.addEventListener('click', () => webview.reload());
    
    // Update URL bar when page changes
    webview.addEventListener('did-navigate', (e) => {
      urlBar.value = e.url;
    });
    
    // Update navigation button states
    webview.addEventListener('did-navigate', () => {
      backBtn.disabled = !webview.canGoBack();
      forwardBtn.disabled = !webview.canGoForward();
    });
  </script>
</body>
</html>
```

### Step 4: Run and Test

```bash
npm start
```

Try:
- Type `github.com` and press Enter
- Click Back and Forward buttons
- Click Reload

### What You Learned
- ✅ Using `<webview>` to display websites
- ✅ Building navigation controls
- ✅ Handling browser events

---

## 📘 Tutorial 3: Adding Tabs (60 mins)

### Goal
Create a tabbed browser interface

### Step 1: Update HTML with Tabs

```html
<!-- index.html - Updated with tabs -->
<!DOCTYPE html>
<html>
<head>
  <title>My Tabbed Browser</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      background: #1a1a2e;
      color: white;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    /* Tab bar */
    .tab-bar {
      display: flex;
      align-items: center;
      background: #252538;
      padding: 8px 8px 0;
      gap: 4px;
    }
    
    .tab {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #1a1a2e;
      border-radius: 8px 8px 0 0;
      cursor: pointer;
      min-width: 120px;
      max-width: 200px;
    }
    
    .tab.active {
      background: #333;
    }
    
    .tab-title {
      flex: 1;
      font-size: 12px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .tab-close {
      width: 18px;
      height: 18px;
      border: none;
      background: transparent;
      color: #888;
      cursor: pointer;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .tab-close:hover {
      background: #444;
      color: white;
    }
    
    .new-tab-btn {
      width: 28px;
      height: 28px;
      border: none;
      background: transparent;
      color: #888;
      cursor: pointer;
      border-radius: 6px;
      font-size: 18px;
    }
    
    .new-tab-btn:hover {
      background: #333;
      color: white;
    }
    
    /* Toolbar */
    .toolbar {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background: #333;
      gap: 8px;
    }
    
    .nav-btn {
      width: 32px;
      height: 32px;
      border: none;
      background: #252538;
      color: #a0a0b8;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
    }
    
    .nav-btn:hover { background: #444; color: white; }
    .nav-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    
    .url-bar {
      flex: 1;
      height: 32px;
      padding: 0 12px;
      border: none;
      background: #252538;
      color: white;
      border-radius: 6px;
      font-size: 14px;
    }
    
    .url-bar:focus { outline: 2px solid #6366f1; }
    
    /* WebView container */
    .browser-content {
      flex: 1;
      position: relative;
    }
    
    webview {
      position: absolute;
      width: 100%;
      height: 100%;
      display: none;
    }
    
    webview.active {
      display: block;
    }
  </style>
</head>
<body>
  <!-- Tab bar -->
  <div class="tab-bar" id="tabBar">
    <button class="new-tab-btn" id="newTabBtn" title="New Tab">+</button>
  </div>
  
  <!-- Toolbar -->
  <div class="toolbar">
    <button class="nav-btn" id="backBtn">←</button>
    <button class="nav-btn" id="forwardBtn">→</button>
    <button class="nav-btn" id="reloadBtn">↻</button>
    <input type="text" class="url-bar" id="urlBar" placeholder="Enter URL...">
  </div>
  
  <!-- Browser content (webviews go here) -->
  <div class="browser-content" id="browserContent"></div>
  
  <script>
    // Tab manager
    class TabManager {
      constructor() {
        this.tabs = [];
        this.activeTabId = null;
        this.nextId = 1;
        
        // Get DOM elements
        this.tabBar = document.getElementById('tabBar');
        this.browserContent = document.getElementById('browserContent');
        this.urlBar = document.getElementById('urlBar');
        this.backBtn = document.getElementById('backBtn');
        this.forwardBtn = document.getElementById('forwardBtn');
        this.reloadBtn = document.getElementById('reloadBtn');
        this.newTabBtn = document.getElementById('newTabBtn');
        
        // Setup event listeners
        this.newTabBtn.addEventListener('click', () => this.createTab());
        this.backBtn.addEventListener('click', () => this.goBack());
        this.forwardBtn.addEventListener('click', () => this.goForward());
        this.reloadBtn.addEventListener('click', () => this.reload());
        this.urlBar.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') this.navigate(this.urlBar.value);
        });
        
        // Create first tab
        this.createTab('https://www.google.com');
      }
      
      createTab(url = 'https://www.google.com') {
        const id = this.nextId++;
        
        // Create tab element
        const tabEl = document.createElement('div');
        tabEl.className = 'tab';
        tabEl.innerHTML = `
          <span class="tab-title">New Tab</span>
          <button class="tab-close">×</button>
        `;
        
        // Insert before "+" button
        this.tabBar.insertBefore(tabEl, this.newTabBtn);
        
        // Create webview
        const webview = document.createElement('webview');
        webview.src = url;
        webview.id = `webview-${id}`;
        this.browserContent.appendChild(webview);
        
        // Setup webview events
        webview.addEventListener('did-navigate', (e) => {
          if (id === this.activeTabId) {
            this.urlBar.value = e.url;
            this.updateNavButtons();
          }
        });
        
        webview.addEventListener('page-title-updated', (e) => {
          tabEl.querySelector('.tab-title').textContent = e.title;
        });
        
        // Tab click handler
        tabEl.addEventListener('click', (e) => {
          if (!e.target.classList.contains('tab-close')) {
            this.switchToTab(id);
          }
        });
        
        // Close button handler
        tabEl.querySelector('.tab-close').addEventListener('click', () => {
          this.closeTab(id);
        });
        
        // Store tab info
        this.tabs.push({ id, tabEl, webview });
        
        // Switch to new tab
        this.switchToTab(id);
        
        return id;
      }
      
      switchToTab(id) {
        // Deactivate current tab
        this.tabs.forEach(tab => {
          tab.tabEl.classList.remove('active');
          tab.webview.classList.remove('active');
        });
        
        // Activate new tab
        const tab = this.tabs.find(t => t.id === id);
        if (tab) {
          tab.tabEl.classList.add('active');
          tab.webview.classList.add('active');
          this.activeTabId = id;
          this.urlBar.value = tab.webview.src;
          this.updateNavButtons();
        }
      }
      
      closeTab(id) {
        const index = this.tabs.findIndex(t => t.id === id);
        if (index === -1) return;
        
        const tab = this.tabs[index];
        tab.tabEl.remove();
        tab.webview.remove();
        this.tabs.splice(index, 1);
        
        // If closing active tab, switch to another
        if (id === this.activeTabId && this.tabs.length > 0) {
          this.switchToTab(this.tabs[Math.max(0, index - 1)].id);
        }
        
        // If no tabs left, create a new one
        if (this.tabs.length === 0) {
          this.createTab();
        }
      }
      
      navigate(url) {
        if (!url.startsWith('http')) url = 'https://' + url;
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) tab.webview.src = url;
      }
      
      goBack() {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab?.webview.canGoBack()) tab.webview.goBack();
      }
      
      goForward() {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab?.webview.canGoForward()) tab.webview.goForward();
      }
      
      reload() {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) tab.webview.reload();
      }
      
      updateNavButtons() {
        const tab = this.tabs.find(t => t.id === this.activeTabId);
        if (tab) {
          this.backBtn.disabled = !tab.webview.canGoBack();
          this.forwardBtn.disabled = !tab.webview.canGoForward();
        }
      }
    }
    
    // Initialize
    const tabManager = new TabManager();
  </script>
</body>
</html>
```

### Step 2: Run and Test

```bash
npm start
```

Try:
- Click "+" to open new tabs
- Click tabs to switch between them
- Click "×" to close tabs
- Navigate in each tab independently

### What You Learned
- ✅ Managing multiple webviews
- ✅ Tab state management
- ✅ Dynamic DOM manipulation

---

## 📘 Tutorial 4: Building the UI with React (90 mins)

### Goal
Refactor to use React for a maintainable, scalable UI

### Step 1: Install Dependencies

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom typescript vite @vitejs/plugin-react
```

### Step 2: Create Project Structure

```
src/
├── main/
│   └── main.ts        # Electron main process
├── preload/
│   └── preload.ts     # Preload script
└── renderer/
    ├── index.html
    ├── main.tsx       # React entry
    ├── App.tsx        # Main component
    └── components/
        ├── TabBar.tsx
        └── Toolbar.tsx
```

### Step 3: Create React Components

**src/renderer/components/TabBar.tsx**
```tsx
import React from 'react';

interface Tab {
  id: string;
  title: string;
  isActive: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  onNewTab: () => void;
  onCloseTab: (id: string) => void;
  onSelectTab: (id: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  onNewTab,
  onCloseTab,
  onSelectTab,
}) => {
  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`tab ${tab.isActive ? 'active' : ''}`}
          onClick={() => onSelectTab(tab.id)}
        >
          <span className="tab-title">{tab.title}</span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="new-tab-btn" onClick={onNewTab}>
        +
      </button>
    </div>
  );
};
```

**src/renderer/components/Toolbar.tsx**
```tsx
import React, { useState } from 'react';

interface ToolbarProps {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  url,
  canGoBack,
  canGoForward,
  onNavigate,
  onBack,
  onForward,
  onReload,
}) => {
  const [inputUrl, setInputUrl] = useState(url);
  
  // Update input when URL changes
  React.useEffect(() => {
    setInputUrl(url);
  }, [url]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate(inputUrl);
  };
  
  return (
    <form className="toolbar" onSubmit={handleSubmit}>
      <button type="button" onClick={onBack} disabled={!canGoBack}>
        ←
      </button>
      <button type="button" onClick={onForward} disabled={!canGoForward}>
        →
      </button>
      <button type="button" onClick={onReload}>
        ↻
      </button>
      <input
        type="text"
        value={inputUrl}
        onChange={(e) => setInputUrl(e.target.value)}
        placeholder="Enter URL..."
      />
    </form>
  );
};
```

**src/renderer/App.tsx**
```tsx
import React, { useState, useCallback } from 'react';
import { TabBar } from './components/TabBar';
import { Toolbar } from './components/Toolbar';

interface Tab {
  id: string;
  url: string;
  title: string;
}

const App: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', url: 'https://google.com', title: 'Google' }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  
  const activeTab = tabs.find(t => t.id === activeTabId);
  
  const createTab = useCallback(() => {
    const id = Date.now().toString();
    setTabs(prev => [...prev, { id, url: 'https://google.com', title: 'New Tab' }]);
    setActiveTabId(id);
  }, []);
  
  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id);
      if (newTabs.length === 0) {
        return [{ id: Date.now().toString(), url: 'https://google.com', title: 'New Tab' }];
      }
      return newTabs;
    });
  }, []);
  
  const navigate = useCallback((url: string) => {
    if (!url.startsWith('http')) url = 'https://' + url;
    setTabs(prev => prev.map(t => 
      t.id === activeTabId ? { ...t, url } : t
    ));
  }, [activeTabId]);
  
  return (
    <div className="app">
      <TabBar
        tabs={tabs.map(t => ({ ...t, isActive: t.id === activeTabId }))}
        onNewTab={createTab}
        onCloseTab={closeTab}
        onSelectTab={setActiveTabId}
      />
      <Toolbar
        url={activeTab?.url || ''}
        canGoBack={false}
        canGoForward={false}
        onNavigate={navigate}
        onBack={() => {}}
        onForward={() => {}}
        onReload={() => {}}
      />
      <div className="browser-content">
        {/* WebView would go here */}
        <p>Active URL: {activeTab?.url}</p>
      </div>
    </div>
  );
};

export default App;
```

### What You Learned
- ✅ React component architecture
- ✅ State management with hooks
- ✅ Props and callbacks
- ✅ TypeScript with React

---

## 📘 Tutorial 5: Implementing OAuth Bridge (60 mins)

### Goal
Capture OAuth callbacks for cloud IDE extensions

### Understanding the Problem

```
Normal OAuth Flow (Works):
Browser → Auth Provider → localhost:3000/callback → Your App ✓

Cloud IDE OAuth Flow (Fails):
Browser → Auth Provider → localhost:3000/callback → ??? 
                                                    ↑
                                       Code-server can't receive this!
```

### Our Solution

```
AI Dev Browser Solution:
Browser → Auth Provider → localhost/callback → AI Dev Browser intercepts!
                                                    ↓
                                               Extracts token
                                                    ↓
                                               Sends to code-server via WebSocket ✓
```

### Step 1: Create OAuth Bridge

```typescript
// src/main/oauth-bridge.ts
import { session } from 'electron';

// Patterns that indicate OAuth callbacks
const OAUTH_PATTERNS = [
  /callback/i,
  /oauth/i,
  /authorize/i,
];

// Extract tokens from URL
function extractToken(url: string): { code?: string; token?: string } {
  const urlObj = new URL(url);
  return {
    code: urlObj.searchParams.get('code') || undefined,
    token: urlObj.searchParams.get('access_token') || undefined,
  };
}

// Check if URL is OAuth callback
function isOAuthCallback(url: string): boolean {
  try {
    const urlObj = new URL(url);
    
    // Check URL patterns
    const matchesPattern = OAUTH_PATTERNS.some(p => p.test(urlObj.pathname));
    
    // Check for OAuth params
    const hasParams = urlObj.searchParams.has('code') || 
                      urlObj.searchParams.has('access_token');
    
    return matchesPattern && hasParams;
  } catch {
    return false;
  }
}

// Setup OAuth interception
export function setupOAuthBridge(onTokenReceived: (token: any) => void) {
  // Intercept all requests
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['*://localhost/*', '*://127.0.0.1/*'] },
    (details, callback) => {
      
      if (isOAuthCallback(details.url)) {
        console.log('🔐 OAuth callback detected:', details.url);
        
        const token = extractToken(details.url);
        if (token.code || token.token) {
          onTokenReceived(token);
        }
      }
      
      // Allow request to continue
      callback({ cancel: false });
    }
  );
}
```

### Step 2: Use in Main Process

```typescript
// src/main/main.ts
import { setupOAuthBridge } from './oauth-bridge';

// In your app initialization:
setupOAuthBridge((token) => {
  console.log('Token received:', token);
  
  // Send to renderer
  mainWindow?.webContents.send('oauth-token', token);
  
  // Or send to code-server via WebSocket
  // codeServerConnection.send({ type: 'token', data: token });
});
```

### What You Learned
- ✅ Request interception
- ✅ URL parsing for tokens
- ✅ Cross-process communication

---

## 📘 Tutorial 6: Adding AI Integration (45 mins)

### Goal
Add AI-powered code explanation

### Step 1: Install AI SDK

```bash
npm install openai @anthropic-ai/sdk
```

### Step 2: Create AI Service

```typescript
// src/services/ai-service.ts
import OpenAI from 'openai';

export class AIService {
  private client: OpenAI | null = null;
  
  configure(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }
  
  async explainCode(code: string, language?: string): Promise<string> {
    if (!this.client) {
      throw new Error('AI not configured. Please add your API key.');
    }
    
    const response = await this.client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful programming assistant. Explain code clearly and concisely.'
        },
        {
          role: 'user',
          content: `Explain this ${language || 'code'}:\n\n${code}`
        }
      ],
      max_tokens: 1000,
    });
    
    return response.choices[0]?.message?.content || 'No explanation available.';
  }
  
  async chat(message: string): Promise<string> {
    if (!this.client) {
      throw new Error('AI not configured');
    }
    
    const response = await this.client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant for developers.'
        },
        { role: 'user', content: message }
      ],
    });
    
    return response.choices[0]?.message?.content || '';
  }
}

export const aiService = new AIService();
```

### Step 3: Expose via IPC

```typescript
// src/main/main.ts
import { ipcMain } from 'electron';
import { aiService } from '../services/ai-service';

// Configure AI
ipcMain.handle('ai:configure', async (_, apiKey: string) => {
  aiService.configure(apiKey);
});

// Explain code
ipcMain.handle('ai:explain', async (_, code: string, language?: string) => {
  try {
    return { success: true, content: await aiService.explainCode(code, language) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Chat
ipcMain.handle('ai:chat', async (_, message: string) => {
  try {
    return { success: true, content: await aiService.chat(message) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### Step 4: Use in Renderer

```typescript
// In your React component
const handleExplainCode = async () => {
  const selectedText = window.getSelection()?.toString();
  if (!selectedText) return;
  
  const result = await window.electron.ai.explain(selectedText);
  
  if (result.success) {
    console.log('Explanation:', result.content);
    // Show in UI
  } else {
    console.error('Error:', result.error);
  }
};
```

### What You Learned
- ✅ Integrating OpenAI API
- ✅ Async IPC communication
- ✅ Error handling patterns

---

## 📘 Tutorial 7: Cross-Platform Building (30 mins)

### Goal
Build for macOS, Windows, and Linux

### Step 1: Install Electron Forge

```bash
npm install -D @electron-forge/cli @electron-forge/maker-dmg \
  @electron-forge/maker-squirrel @electron-forge/maker-deb \
  @electron-forge/maker-rpm @electron-forge/maker-zip
```

### Step 2: Configure forge.config.js

```javascript
// forge.config.js
module.exports = {
  packagerConfig: {
    name: 'My Browser',
    icon: './assets/icon',
    appBundleId: 'com.example.mybrowser',
  },
  makers: [
    // macOS DMG
    {
      name: '@electron-forge/maker-dmg',
      config: { name: 'MyBrowser' }
    },
    // macOS ZIP
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin']
    },
    // Windows
    {
      name: '@electron-forge/maker-squirrel',
      config: { name: 'MyBrowser' }
    },
    // Linux DEB
    {
      name: '@electron-forge/maker-deb',
      config: { name: 'my-browser' }
    },
    // Linux RPM
    {
      name: '@electron-forge/maker-rpm',
      config: { name: 'my-browser' }
    }
  ]
};
```

### Step 3: Build Commands

```bash
# Build for current platform
npm run make

# Build for specific platform (on that OS)
npm run make -- --arch=arm64     # Apple Silicon
npm run make -- --arch=x64       # Intel/AMD

# Package without installer
npm run package
```

### Step 4: GitHub Actions CI/CD

Create `.github/workflows/build.yml`:

```yaml
name: Build

on:
  push:
    tags: ['v*']

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run make
      - uses: actions/upload-artifact@v4
        with:
          name: mac-build
          path: out/make/**/*

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run make
      - uses: actions/upload-artifact@v4
        with:
          name: windows-build
          path: out/make/**/*

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run make
      - uses: actions/upload-artifact@v4
        with:
          name: linux-build
          path: out/make/**/*
```

### What You Learned
- ✅ Electron Forge configuration
- ✅ Platform-specific builds
- ✅ CI/CD automation

---

## 📚 Resources & Next Steps

### Official Documentation

| Resource | URL |
|----------|-----|
| Electron Docs | https://www.electronjs.org/docs |
| Electron Forge | https://www.electronforge.io |
| React Docs | https://react.dev |
| TypeScript | https://www.typescriptlang.org/docs |

### Recommended Reading

1. **Electron Security** - https://www.electronjs.org/docs/latest/tutorial/security
2. **React Patterns** - https://react.dev/learn
3. **TypeScript Handbook** - https://www.typescriptlang.org/docs/handbook

### Project Ideas to Practice

| Level | Project |
|-------|---------|
| Beginner | Add bookmarks with local storage |
| Intermediate | Add browser history with search |
| Advanced | Add extensions support |
| Expert | Build a custom rendering engine |

### Community

- **Electron Discord** - https://discord.gg/electron
- **React Discord** - https://discord.gg/reactiflux
- **Stack Overflow** - Tag: `electron`, `react`

---

## 🎯 Summary Checklist

By completing this guide, you've learned:

- [x] How Electron apps are structured
- [x] Creating browser windows
- [x] Building tabbed interfaces
- [x] React component architecture
- [x] IPC communication
- [x] OAuth token interception
- [x] AI API integration
- [x] Cross-platform building
- [x] CI/CD automation

### Your Journey

```
Beginner          Intermediate           Advanced
   |                   |                    |
   v                   v                    v
Tutorial 1-2 ──► Tutorial 3-5 ──► Tutorial 6-7 ──► 🎉 You're Ready!
```

---

<p align="center">
  <strong>Happy Coding! 🚀</strong>
</p>

<p align="center">
  Built with ❤️ for the developer community
</p>



