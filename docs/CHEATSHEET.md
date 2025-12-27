# 📋 Browser Development Cheat Sheet

Quick reference for building Electron-based browsers.

---

## 🚀 Quick Start Commands

```bash
# Create new Electron project
npm init -y
npm install electron --save-dev

# Add React + TypeScript
npm install react react-dom
npm install -D typescript @types/react @types/react-dom

# Install Electron Forge
npx electron-forge import

# Development
npm start          # Run in dev mode

# Production
npm run package    # Package app
npm run make       # Create installer
```

---

## 📁 Project Structure

```
my-browser/
├── package.json
├── forge.config.ts
├── tsconfig.json
├── src/
│   ├── main/           # Node.js process
│   │   └── main.ts
│   ├── preload/        # Bridge script
│   │   └── preload.ts
│   └── renderer/       # Web UI (React)
│       ├── App.tsx
│       └── components/
└── assets/
    └── icon.png
```

---

## 🔧 Essential Code Snippets

### Create a Window

```typescript
import { app, BrowserWindow } from 'electron';

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
    }
  });
  win.loadFile('index.html');
};

app.whenReady().then(createWindow);
```

### Add WebView (Browser Tab)

```html
<webview 
  id="browser" 
  src="https://google.com"
  style="width:100%; height:100%;"
></webview>
```

```javascript
const webview = document.getElementById('browser');

// Navigate
webview.src = 'https://github.com';

// Navigation
webview.goBack();
webview.goForward();
webview.reload();

// Events
webview.addEventListener('did-navigate', (e) => {
  console.log('URL:', e.url);
});

webview.addEventListener('page-title-updated', (e) => {
  console.log('Title:', e.title);
});
```

### IPC Communication

**Main Process:**
```typescript
import { ipcMain } from 'electron';

// Handle request from renderer
ipcMain.handle('get-data', async () => {
  return { foo: 'bar' };
});

// Listen for events
ipcMain.on('log', (_, message) => {
  console.log(message);
});
```

**Preload Script:**
```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getData: () => ipcRenderer.invoke('get-data'),
  log: (msg: string) => ipcRenderer.send('log', msg),
});
```

**Renderer:**
```typescript
const data = await window.api.getData();
window.api.log('Hello from renderer!');
```

### Intercept Requests (OAuth)

```typescript
import { session } from 'electron';

session.defaultSession.webRequest.onBeforeRequest(
  { urls: ['*://localhost/*'] },
  (details, callback) => {
    if (details.url.includes('callback')) {
      // Handle OAuth callback
      console.log('OAuth:', details.url);
    }
    callback({ cancel: false });
  }
);
```

---

## ⚛️ React Patterns

### Tab Component

```tsx
interface Tab {
  id: string;
  title: string;
  url: string;
}

const [tabs, setTabs] = useState<Tab[]>([]);
const [activeId, setActiveId] = useState<string>('');

// Add tab
const addTab = () => {
  const id = Date.now().toString();
  setTabs([...tabs, { id, title: 'New', url: 'https://google.com' }]);
  setActiveId(id);
};

// Close tab
const closeTab = (id: string) => {
  setTabs(tabs.filter(t => t.id !== id));
};
```

### URL Bar with Navigation

```tsx
const [url, setUrl] = useState('');

const navigate = (e: React.FormEvent) => {
  e.preventDefault();
  let targetUrl = url;
  if (!url.startsWith('http')) {
    targetUrl = 'https://' + url;
  }
  webviewRef.current.src = targetUrl;
};

return (
  <form onSubmit={navigate}>
    <input value={url} onChange={e => setUrl(e.target.value)} />
  </form>
);
```

---

## 🔒 Security Best Practices

```typescript
// ✅ DO: Use preload with contextBridge
contextBridge.exposeInMainWorld('api', {
  safeFunction: () => { /* ... */ }
});

// ❌ DON'T: Enable nodeIntegration
new BrowserWindow({
  webPreferences: {
    nodeIntegration: true  // DANGEROUS!
  }
});

// ✅ DO: Validate URLs
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// ✅ DO: Sanitize IPC data
ipcMain.handle('save', async (_, data) => {
  if (!isValidData(data)) {
    throw new Error('Invalid data');
  }
  // ...
});
```

---

## 📦 Build Configuration

### forge.config.ts

```typescript
import type { ForgeConfig } from '@electron-forge/shared-types';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'MyBrowser',
    icon: './assets/icon',
    osxSign: {},
  },
  makers: [
    { name: '@electron-forge/maker-zip', platforms: ['darwin'] },
    { name: '@electron-forge/maker-dmg' },
    { name: '@electron-forge/maker-squirrel' },
    { name: '@electron-forge/maker-deb' },
  ],
};

export default config;
```

---

## 🎯 WebView API Reference

| Method | Description |
|--------|-------------|
| `src` | Get/set current URL |
| `goBack()` | Navigate back |
| `goForward()` | Navigate forward |
| `reload()` | Reload page |
| `stop()` | Stop loading |
| `canGoBack()` | Check if can go back |
| `canGoForward()` | Check if can go forward |
| `getURL()` | Get current URL |
| `getTitle()` | Get page title |
| `executeJavaScript(code)` | Run JS in page |
| `openDevTools()` | Open DevTools |

### WebView Events

| Event | Description |
|-------|-------------|
| `did-start-loading` | Started loading |
| `did-stop-loading` | Finished loading |
| `did-navigate` | Navigation complete |
| `page-title-updated` | Title changed |
| `page-favicon-updated` | Favicon changed |
| `new-window` | Popup requested |
| `console-message` | Console log |

---

## 🔗 Useful Links

- Electron Docs: https://electronjs.org/docs
- Electron Forge: https://electronforge.io
- React: https://react.dev
- TypeScript: https://typescriptlang.org

---

*Keep this handy while developing! 🚀*


