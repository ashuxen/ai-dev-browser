# ⚡ FlashAppAI Browser

An AI-powered browser built for developers and scientists. Browse the web with integrated AI assistants, private browsing with Phantom Mode, and powerful developer tools.

![FlashAppAI Browser](https://flashappai.org/images/browser-preview.png)

## ✨ Features

### 🤖 AI Assistant Panel
- **Multiple AI Services**: ChatGPT, Gemini, Claude, Perplexity, DuckDuckGo AI, and more
- **Summarize Pages**: One-click page summarization with AI
- **Explain Code**: Automatically detect and explain code on any webpage
- **No API Keys Required**: Use free web-based AI services directly

### 👻 Phantom Mode (Private Browsing)
- **Zero Traces**: No history, cookies, or cache saved
- **Auto-Clean**: All data wiped when you close the window
- **Private AI**: Even AI conversations are private
- **Keyboard Shortcut**: `Cmd+Shift+N` (Mac) / `Ctrl+Shift+N` (Windows/Linux)

### 🔖 Full Browser Features
- **Tabbed Browsing**: Multiple tabs with easy management
- **Bookmarks**: Save and organize your favorite sites
- **History**: Track your browsing history
- **Modern UI**: Beautiful dark theme inspired by FlashAppAI

---

## 📥 Download & Install

### macOS

#### Option 1: DMG Installer (Recommended)
1. Download `FlashAppAI-Browser.dmg` from [Releases](https://github.com/ashuxen/ai-dev-browser/releases)
2. Double-click the DMG file to open it
3. Drag **FlashAppAI Browser** to your **Applications** folder
4. Open from Applications or Spotlight (`Cmd+Space`, type "FlashAppAI")

#### Option 2: ZIP File
1. Download `FlashAppAI-Browser-darwin-*.zip` from [Releases](https://github.com/ashuxen/ai-dev-browser/releases)
2. Extract the ZIP file
3. Move **AI Dev Browser.app** to your Applications folder
4. Right-click → Open (first time only, to bypass Gatekeeper)

#### macOS Security Note
If you see "App is damaged" or "Cannot be opened":
```bash
# Run this in Terminal:
xattr -cr /Applications/AI\ Dev\ Browser.app
```

---

### Windows

1. Download `FlashAppAI-Browser-win32-x64.zip` from [Releases](https://github.com/ashuxen/ai-dev-browser/releases)
2. Extract the ZIP to a folder (e.g., `C:\Program Files\FlashAppAI Browser`)
3. Double-click **ai-dev-browser.exe** to run
4. (Optional) Right-click → Create shortcut → Move to Desktop

#### Windows Security Note
If Windows Defender blocks the app:
1. Click "More info"
2. Click "Run anyway"

---

### Linux

#### Ubuntu/Debian
1. Download `FlashAppAI-Browser-linux-x64.zip` from [Releases](https://github.com/ashuxen/ai-dev-browser/releases)
2. Extract and run:
```bash
unzip FlashAppAI-Browser-linux-x64.zip
cd "AI Dev Browser-linux-x64"
./ai-dev-browser
```

#### Make it Executable (if needed)
```bash
chmod +x ai-dev-browser
```

#### Create Desktop Shortcut
```bash
cat > ~/.local/share/applications/flashappai-browser.desktop << EOF
[Desktop Entry]
Name=FlashAppAI Browser
Exec=/path/to/ai-dev-browser
Icon=/path/to/icon.png
Type=Application
Categories=Development;Network;WebBrowser;
EOF
```

---

## 🚀 Quick Start Guide

### 1. Launch the Browser
Open FlashAppAI Browser from your applications menu or desktop.

### 2. Browse the Web
- Enter any URL in the address bar
- Use `Cmd+T` (Mac) / `Ctrl+T` (Windows/Linux) for new tabs
- Navigate with back/forward buttons

### 3. Use AI Assistant
1. Click the **⚡ AI button** in the toolbar (top-right)
2. Select an AI service from the dropdown:
   - 🦆 **DuckDuckGo AI** - Free, no login
   - 🔍 **Perplexity** - Fast answers, no login
   - 🤖 **ChatGPT** - Requires login
   - ✨ **Gemini** - Requires Google account
3. Or use quick actions:
   - **📄 Summarize Page** - AI summarizes the current webpage
   - **💻 Explain Code** - AI explains code found on the page

### 4. Use Phantom Mode
1. Click the **👻 Ghost button** in the toolbar, OR
2. Press `Cmd+Shift+N` (Mac) / `Ctrl+Shift+N` (Windows/Linux)
3. Browse privately - nothing is saved!
4. Close the window to erase all traces

### 5. Manage Bookmarks & History
- **Bookmark**: Click the 🔖 bookmark icon to save a page
- **History**: Click the 🕐 history icon to view past visits
- **Keyboard**: `Cmd+D` to bookmark, `Cmd+Y` for history

---

## ⌨️ Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| New Tab | `Cmd+T` | `Ctrl+T` |
| Close Tab | `Cmd+W` | `Ctrl+W` |
| New Window | `Cmd+N` | `Ctrl+N` |
| Phantom Mode | `Cmd+Shift+N` | `Ctrl+Shift+N` |
| Bookmark Page | `Cmd+D` | `Ctrl+D` |
| Show History | `Cmd+Y` | `Ctrl+Y` |
| Reload | `Cmd+R` | `Ctrl+R` |
| Back | `Cmd+[` | `Alt+←` |
| Forward | `Cmd+]` | `Alt+→` |
| Find | `Cmd+F` | `Ctrl+F` |

---

## 🎯 Benefits

### For Developers
- **Code Explanation**: Select any code, click "Explain Code" - instant understanding
- **Documentation Summary**: Quickly summarize long documentation pages
- **Multiple AI Options**: Choose the best AI for your task
- **Private Research**: Use Phantom Mode for sensitive research

### For Scientists & Researchers
- **Paper Summarization**: Summarize research papers instantly
- **No Account Required**: Use free AI services without signing up
- **Private Browsing**: Keep research confidential with Phantom Mode
- **Cross-Platform**: Works on Mac, Windows, and Linux

### For Everyone
- **Ad-Free AI**: No ads or tracking in the AI panel
- **Fast & Lightweight**: Built on Electron for native performance
- **Beautiful UI**: Modern dark theme that's easy on the eyes
- **Open Source**: Free to use and customize

---

## 🛠️ Troubleshooting

### Browser won't start
- **Mac**: Run `xattr -cr /Applications/AI\ Dev\ Browser.app` in Terminal
- **Windows**: Run as Administrator once
- **Linux**: Make sure the file is executable: `chmod +x ai-dev-browser`

### AI Panel not loading
1. Check your internet connection
2. Try a different AI service (DuckDuckGo AI is most reliable)
3. Click the ← back button and select again

### Page not loading
1. Check if the URL is correct (should include https://)
2. Try refreshing with `Cmd+R` / `Ctrl+R`
3. Check your internet connection

---

## 🔒 Privacy

- **No Telemetry**: We don't collect any usage data
- **No Accounts**: Use the browser without creating an account
- **Phantom Mode**: Complete privacy with auto-delete
- **Local Storage**: All bookmarks and history stored locally on your device

---

## 📝 License

MIT License - Free to use, modify, and distribute.

---

## 🤝 Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md).

---

## 📧 Support

- **Email**: support@flashappai.org
- **Issues**: [GitHub Issues](https://github.com/ashuxen/ai-dev-browser/issues)
- **Website**: [flashappai.org](https://flashappai.org)

---

Made with ⚡ by [FlashAppAI](https://flashappai.org)
