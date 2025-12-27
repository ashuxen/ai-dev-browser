# AI Dev Browser

<p align="center">
  <img src="assets/icons/icon.png" alt="AI Dev Browser" width="128" height="128">
</p>

<p align="center">
  <strong>An AI-powered browser for developers working with cloud-based code editors</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#development">Development</a> •
  <a href="#building">Building</a>
</p>

---

## ✨ Features

### 🔐 OAuth Authentication Bridge
- **Universal OAuth callback handler** for cloud IDEs (code-server, GitHub Codespaces, Gitpod)
- Supports all major providers: GitHub, Google, Microsoft, OpenAI, GitLab, Anthropic
- Automatic token extraction and secure storage
- Works with localhost, vscode://, and custom protocols

### 🤖 AI-Powered Assistance
- **Code Explainer**: Select any code → Right-click → Get AI explanation
- **Documentation Summarizer**: One-click summarization of long docs
- **Smart Chat**: Context-aware AI assistant
- Supports OpenAI GPT-4 and Anthropic Claude

### 💻 Code-Server Integration
- WebSocket connection for real-time communication
- Send code snippets directly to your editor
- OAuth tokens delivered to extensions automatically
- Execute commands remotely

### 🌐 Full Browser Functionality
- Chromium-based rendering engine
- Tabs, bookmarks, and history management
- Built-in Developer Tools
- Download manager
- Auto-updates

## 📦 Installation

### Download Pre-built Binaries

| Platform | Architecture | Download |
|----------|--------------|----------|
| macOS | Apple Silicon (M1/M2/M3) | [Download .dmg](https://github.com/flashappai/ai-dev-browser/releases/latest) |
| macOS | Intel | [Download .dmg](https://github.com/flashappai/ai-dev-browser/releases/latest) |
| Windows | x64 | [Download .exe](https://github.com/flashappai/ai-dev-browser/releases/latest) |
| Windows | ARM64 | [Download .exe](https://github.com/flashappai/ai-dev-browser/releases/latest) |
| Linux | x64 | [Download .deb / .rpm](https://github.com/flashappai/ai-dev-browser/releases/latest) |
| Linux | ARM64 | [Download .deb / .rpm](https://github.com/flashappai/ai-dev-browser/releases/latest) |

### Build from Source

```bash
# Clone the repository
git clone https://github.com/flashappai/ai-dev-browser.git
cd ai-dev-browser

# Install dependencies
npm install

# Start in development mode
npm start

# Build for your platform
npm run make
```

## 🔧 Development

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- Git

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm start
```

### Project Structure

```
ai-dev-browser/
├── src/
│   ├── main/           # Electron main process
│   │   ├── main.ts
│   │   ├── oauth-bridge.ts
│   │   ├── code-server-integration.ts
│   │   ├── tab-manager.ts
│   │   └── ...
│   ├── preload/        # Preload scripts
│   ├── renderer/       # React UI
│   │   ├── components/
│   │   ├── styles/
│   │   └── App.tsx
│   └── services/       # Shared services
├── assets/             # Icons and images
├── .github/            # GitHub Actions workflows
└── forge.config.ts     # Electron Forge configuration
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start in development mode |
| `npm run package` | Package the app (no installer) |
| `npm run make` | Create distributable installers |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run tests |

## 🏗️ Building

### macOS

```bash
# Build for current architecture
npm run make

# Build for specific architecture
npm run make -- --arch=arm64  # Apple Silicon
npm run make -- --arch=x64    # Intel
```

For code signing, set these environment variables:
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`
- `APPLE_IDENTITY`

### Windows

```bash
npm run make -- --arch=x64
```

For code signing, set:
- `WINDOWS_CERTIFICATE_FILE`
- `WINDOWS_CERTIFICATE_PASSWORD`

### Linux

```bash
# Install dependencies first
sudo apt-get install rpm libarchive-tools

npm run make
```

## ⚙️ Configuration

### AI Settings

1. Open Settings (⌘/Ctrl + ,)
2. Go to "AI Settings" tab
3. Enter your API keys:
   - **OpenAI**: Get from [platform.openai.com](https://platform.openai.com/api-keys)
   - **Anthropic**: Get from [console.anthropic.com](https://console.anthropic.com/settings/keys)

### Code-Server Connection

1. Click the code icon in the toolbar or use ⌘/Ctrl + Shift + C
2. Enter your code-server URL
3. The browser will establish a WebSocket connection

## 🔒 Security

- OAuth tokens are encrypted at rest using AES-256
- All network communication uses TLS 1.3
- Context isolation enabled in renderer
- Sandboxed web content
- No telemetry without explicit consent

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) first.

## 📬 Support

- 📧 Email: support@flashappai.org
- 🐛 Issues: [GitHub Issues](https://github.com/flashappai/ai-dev-browser/issues)
- 💬 Discord: [Join our community](https://discord.gg/flashappai)

---

<p align="center">
  Made with ❤️ by the <a href="https://flashappai.org">FlashAppAI</a> team
</p>


