# 📚 Browser Development Glossary

A dictionary of terms you'll encounter while building browsers.

---

## A

### API (Application Programming Interface)
A set of functions and protocols that allow different software to communicate. Think of it as a waiter taking your order to the kitchen.

### App Shell
The minimal HTML, CSS, and JavaScript required to power a user interface. The "skeleton" of your app.

### Async/Await
JavaScript keywords that make asynchronous code look synchronous. Instead of callbacks, you can write `await someFunction()`.

---

## B

### BrowserWindow
The main class in Electron used to create and control browser windows.

```javascript
new BrowserWindow({ width: 800, height: 600 })
```

### Bundle
A single file that combines multiple JavaScript/CSS files. Created by tools like Webpack or Vite.

---

## C

### Callback
A function passed to another function to be called later.

```javascript
button.addEventListener('click', () => {
  // This is a callback
});
```

### Chromium
The open-source browser project that Chrome, Edge, Brave, and Electron are built on.

### Context Bridge
Electron's secure way to expose APIs from the preload script to the renderer.

```javascript
contextBridge.exposeInMainWorld('api', { ... });
```

### CORS (Cross-Origin Resource Sharing)
A security feature that controls which websites can access resources from another domain.

---

## D

### DevTools
Chrome's built-in developer tools for inspecting, debugging, and profiling web pages.

### DOM (Document Object Model)
The programming interface for HTML. It represents the page as a tree of objects.

```javascript
document.getElementById('myButton')  // Accessing the DOM
```

---

## E

### Electron
A framework for building desktop applications using web technologies (HTML, CSS, JavaScript).

### Electron Forge
A complete toolchain for building, packaging, and publishing Electron applications.

### Event Loop
The mechanism that handles asynchronous operations in JavaScript/Node.js.

---

## F

### Fetch API
Modern JavaScript API for making network requests.

```javascript
const response = await fetch('https://api.example.com/data');
```

---

## G

### GPU Acceleration
Using the graphics card to speed up rendering. Electron/Chromium does this automatically.

---

## H

### Hot Module Replacement (HMR)
A feature that updates modules in a running app without a full reload. Makes development faster.

---

## I

### IPC (Inter-Process Communication)
How different parts of an Electron app talk to each other.

```javascript
// Main process
ipcMain.handle('getData', () => { ... });

// Renderer process  
const data = await ipcRenderer.invoke('getData');
```

---

## J

### JSX
A syntax extension for JavaScript that looks like HTML. Used with React.

```jsx
const element = <h1>Hello, world!</h1>;
```

---

## L

### Lazy Loading
Loading resources only when they're needed, not all at once.

---

## M

### Main Process
The "backend" of an Electron app. Runs Node.js and controls the app lifecycle.

### Manifest
A JSON file describing an app's metadata, permissions, and configuration.

---

## N

### Node.js
A JavaScript runtime that lets you run JavaScript outside the browser. Powers Electron's main process.

### npm (Node Package Manager)
The default package manager for Node.js. Used to install libraries.

```bash
npm install electron
```

---

## O

### OAuth
An authorization framework that lets apps access user data without passwords.

```
User clicks "Login with Google"
  → Redirected to Google
  → User authorizes
  → Redirected back with token
```

---

## P

### Package.json
The configuration file for Node.js projects. Lists dependencies, scripts, and metadata.

### Preload Script
A script that runs before the web page loads in Electron. Acts as a secure bridge.

### Process
An instance of a running program. Electron has main and renderer processes.

---

## R

### React
A JavaScript library for building user interfaces with components.

### Renderer Process
The "frontend" of an Electron app. Runs Chromium and displays web content.

### REST API
An architectural style for web services using HTTP methods (GET, POST, PUT, DELETE).

---

## S

### Sandbox
A security mechanism that isolates processes to prevent them from accessing system resources.

### Session
Electron's API for managing browser sessions, cookies, cache, and proxy settings.

### State
Data that can change over time and affects what's displayed.

```javascript
const [count, setCount] = useState(0);
```

---

## T

### Tab
In browser terms, a single webpage view. Modern browsers support multiple tabs.

### TypeScript
A typed superset of JavaScript that compiles to plain JavaScript.

```typescript
function greet(name: string): string {
  return `Hello, ${name}`;
}
```

---

## U

### URL (Uniform Resource Locator)
The address of a web resource. Example: `https://www.example.com/page`

---

## V

### Vite
A modern build tool that's fast because it uses native ES modules.

### V8
The JavaScript engine used by Chrome and Node.js.

---

## W

### WebSocket
A protocol for real-time, two-way communication between client and server.

```javascript
const ws = new WebSocket('ws://localhost:8080');
ws.onmessage = (event) => console.log(event.data);
```

### WebView
An HTML tag in Electron that displays external web content (like an iframe but more powerful).

```html
<webview src="https://google.com"></webview>
```

### Webpack
A popular bundler that compiles JavaScript modules into optimized bundles.

---

## X-Z

### XSS (Cross-Site Scripting)
A security vulnerability where attackers inject malicious scripts into web pages.

### Yield
A JavaScript keyword used in generator functions to pause execution.

### Zero-day
A previously unknown vulnerability that attackers can exploit.

---

## Symbols

### `=>` (Arrow Function)
A shorter syntax for writing functions.

```javascript
// Traditional
function add(a, b) { return a + b; }

// Arrow function
const add = (a, b) => a + b;
```

### `...` (Spread Operator)
Expands an array or object.

```javascript
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5]; // [1, 2, 3, 4, 5]
```

### `?` (Optional Chaining)
Safely access nested properties.

```javascript
const name = user?.profile?.name; // undefined if any is null
```

### `??` (Nullish Coalescing)
Provide a default value for null/undefined.

```javascript
const name = user.name ?? 'Anonymous';
```

---

<p align="center">
  <em>Can't find a term? Search online or ask in a developer community!</em>
</p>



