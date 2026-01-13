# FlashAppAI Browser - Improvement Plan

## Overview
This document outlines all planned improvements for the FlashAppAI Browser, organized by priority and category. Each improvement should be implemented one at a time, tested thoroughly, and committed before moving to the next.

---

## ✅ Priority 1: Critical Fixes (Stability) - COMPLETED

### 1.1 Modal Close Issue
- **Problem**: When modals (Settings, Privacy Dashboard, etc.) are opened and closed, sometimes the webpage becomes blank
- **Root Cause**: `views.hide()` and `views.show()` IPC calls not properly restoring BrowserViews
- **Solution**: Fixed by restoring to stable version and removing aggressive view hiding
- **Status**: ✅ Completed (v1.3.5)

### 1.2 Settings Persistence
- **Problem**: Some settings changes don't persist or take effect immediately
- **Root Cause**: Settings are saved but not applied to active sessions
- **Solution**: Settings now work correctly after restore
- **Status**: ✅ Completed (v1.3.5)

### 1.3 Navigation State
- **Problem**: Back/Forward buttons sometimes cause blank pages
- **Root Cause**: BrowserView bounds not updated after navigation
- **Solution**: Fixed with debounced updateTabBounds() and did-finish-load handler
- **Status**: ✅ Completed (v1.3.5)

---

## 🟠 Priority 2: Core Features (Need Proper Implementation)

### 2.1 Research Mode
- **Current State**: Opens Perplexity in new tab (workaround)
- **Desired State**: Left sidebar panel with:
  - List of open tabs
  - Research notes (auto-saved)
  - AI assistant selector
  - "Analyze Page" button
  - Export notes functionality
- **Implementation**: Use `research:set-width` IPC to resize BrowserView and show HTML panel
- **Status**: ⬜ Not Started

### 2.2 Quick Notes
- **Current State**: Uses browser `prompt()` (workaround)
- **Desired State**: Left sidebar panel with:
  - List of saved notes with timestamps
  - Create new note button
  - Edit/delete notes
  - Search notes
  - Notes linked to URLs
- **Implementation**: Similar to Research Mode, use left panel approach
- **Status**: ⬜ Not Started

### 2.3 Split View
- **Current State**: Creates new tab (workaround)
- **Desired State**: Two BrowserViews side by side in same window
- **Implementation**: Create second BrowserView, split window horizontally
- **Complexity**: High - requires significant changes to tab management
- **Status**: ⬜ Not Started

### 2.4 Screenshot Tool
- **Current State**: Captures and downloads immediately
- **Desired State**: 
  - Preview before saving
  - Annotation tools (arrows, text, highlights)
  - Copy to clipboard option
  - Area selection
- **Status**: ⬜ Not Started

### 2.5 Privacy Dashboard ✅
- **Current State**: Fully functional modal with real-time stats
- **Implemented Features**: 
  - Real-time tracker/ad block counts
  - Toggle controls for Ad Blocker, Tracker Blocker
  - Anti-fingerprinting indicator (always on)
  - Active privacy features grid
  - Clear browsing data button
  - Quick access to Phantom Mode
  - Badge on toolbar showing blocked count
- **Status**: ✅ Completed (Jan 11, 2026)

---

## 🟡 Priority 3: UI/UX Improvements

### 3.1 Bookmark Organization
- **Features Needed**:
  - Drag and drop bookmarks
  - Create/rename/delete folders
  - Move bookmarks between folders
  - Bookmark bar folder display
  - Import/export bookmarks
- **Status**: ⬜ Not Started

### 3.2 Tab Management
- **Features Needed**:
  - Tab groups with colors
  - Drag to reorder tabs
  - Pin tabs
  - Duplicate tab
  - Mute tab audio
  - Tab search
- **Status**: ⬜ Not Started

### 3.3 URL Autocomplete
- **Current Issues**:
  - Sometimes hidden behind BrowserView
  - Click selection inconsistent
- **Improvements**:
  - Better z-index management
  - Keyboard and mouse selection
  - Show favicons
  - Categorize (history, bookmarks, popular)
- **Status**: ⬜ Not Started

### 3.4 Settings UI
- **Improvements Needed**:
  - More visible toggle switches
  - Instant apply (no save button needed)
  - Search settings
  - Reset to defaults option
  - Import/export settings
- **Status**: ⬜ Not Started

### 3.5 AI Assistant Panel
- **Improvements Needed**:
  - Better resize handle visibility
  - Remember panel width
  - Quick switch between AI services
  - Share page content with AI
  - History of AI conversations
- **Status**: ⬜ Not Started

---

## 🟢 Priority 4: New Features

### 4.1 Workspaces
- **Description**: Save and restore tab sessions
- **Features**:
  - Save current tabs as workspace
  - Name and organize workspaces
  - Quick switch between workspaces
  - Auto-save workspace on close
- **Status**: ⬜ Not Started

### 4.2 Reading Mode
- **Description**: Distraction-free article reading
- **Features**:
  - Strip ads and clutter
  - Adjustable font size
  - Dark/light/sepia themes
  - Save for offline reading
- **Status**: ⬜ Not Started

### 4.3 Developer Tools Integration
- **Features**:
  - Built-in JSON viewer/formatter
  - API tester (like Postman)
  - Network request inspector
  - Console log viewer
- **Status**: ⬜ Not Started

### 4.4 Download Manager
- **Current State**: Basic download tracking
- **Improvements**:
  - Download progress in UI
  - Pause/resume downloads
  - Download history
  - Auto-organize downloads by type
- **Status**: ⬜ Not Started

### 4.5 Extensions Support (Future)
- **Description**: Support for browser extensions
- **Complexity**: Very High
- **Status**: ⬜ Future Consideration

---

## 🔵 Priority 5: Performance & Security

### 5.1 Memory Management
- **Improvements**:
  - Monitor memory usage per tab
  - Auto-suspend inactive tabs
  - Memory usage indicator
  - Tab discard for low memory
- **Status**: ⬜ Not Started

### 5.2 Page Load Speed
- **Improvements**:
  - Preload links on hover
  - Cache optimization
  - Lazy load images option
  - Block heavy resources option
- **Status**: ⬜ Not Started

### 5.3 Security Enhancements
- **Features**:
  - HTTPS-only mode
  - Certificate error handling
  - Phishing protection
  - Password manager integration
- **Status**: ⬜ Not Started

### 5.4 Privacy Enhancements
- **Features**:
  - Better anti-fingerprinting
  - Cookie management UI
  - Clear data on exit option
  - Per-site permissions
- **Status**: ⬜ Not Started

---

## 📋 Implementation Order (Recommended)

1. ~~**1.1** Modal Close Issue (Critical)~~ ✅
2. ~~**1.2** Settings Persistence (Critical)~~ ✅
3. ~~**1.3** Navigation State (Critical)~~ ✅
4. ~~**2.5** Privacy Dashboard (Core - fixes existing feature)~~ ✅
5. **3.3** URL Autocomplete (UX - fixes existing feature) ⬅️ NEXT
6. **3.1** Bookmark Organization (UX)
7. **2.1** Research Mode (Core - new implementation)
8. **2.2** Quick Notes (Core - new implementation)
9. **3.2** Tab Management (UX)
10. **2.4** Screenshot Tool (Core)
11. **4.1** Workspaces (New Feature)
12. **4.4** Download Manager (New Feature)
13. **2.3** Split View (Core - complex)
14. **Others as needed**

---

## 📝 Development Guidelines

### Before Starting Each Improvement:
1. Read this document and understand the scope
2. Check current implementation in codebase
3. Plan the changes needed
4. Estimate complexity (Low/Medium/High)

### During Implementation:
1. Make small, incremental changes
2. Test after each change
3. Don't modify unrelated code
4. Keep the browser functional at all times

### After Implementation:
1. Test thoroughly (all scenarios)
2. Check for regressions
3. Commit with clear message
4. Update this document (mark as ✅ Completed)
5. Push to Git
6. Create release if significant

---

## 🔄 Progress Tracking

| ID | Feature | Priority | Status | Date Started | Date Completed |
|----|---------|----------|--------|--------------|----------------|
| 1.1 | Modal Close Issue | 🔴 Critical | ✅ | Jan 11, 2026 | Jan 11, 2026 |
| 1.2 | Settings Persistence | 🔴 Critical | ✅ | Jan 11, 2026 | Jan 11, 2026 |
| 1.3 | Navigation State | 🔴 Critical | ✅ | Jan 11, 2026 | Jan 11, 2026 |
| 2.1 | Research Mode | 🟠 Core | ⬜ | - | - |
| 2.2 | Quick Notes | 🟠 Core | ⬜ | - | - |
| 2.3 | Split View | 🟠 Core | ⬜ | - | - |
| 2.4 | Screenshot Tool | 🟠 Core | ⬜ | - | - |
| 2.5 | Privacy Dashboard | 🟠 Core | ✅ | Jan 11, 2026 | Jan 11, 2026 |
| 3.1 | Bookmark Organization | 🟡 UX | ⬜ | - | - |
| 3.2 | Tab Management | 🟡 UX | ⬜ | - | - |
| 3.3 | URL Autocomplete | 🟡 UX | ⬜ | - | - |
| 3.4 | Settings UI | 🟡 UX | ⬜ | - | - |
| 3.5 | AI Assistant Panel | 🟡 UX | ⬜ | - | - |
| 4.1 | Workspaces | 🟢 New | ⬜ | - | - |
| 4.2 | Reading Mode | 🟢 New | ⬜ | - | - |
| 4.3 | Developer Tools | 🟢 New | ⬜ | - | - |
| 4.4 | Download Manager | 🟢 New | ⬜ | - | - |
| 5.1 | Memory Management | 🔵 Perf | ⬜ | - | - |
| 5.2 | Page Load Speed | 🔵 Perf | ⬜ | - | - |
| 5.3 | Security Enhancements | 🔵 Sec | ⬜ | - | - |
| 5.4 | Privacy Enhancements | 🔵 Sec | ⬜ | - | - |

---

---

## ⚠️ Known Limitations

### Google Sign-In Blocked

**Issue**: Google blocks sign-in from Electron/CEF-based browsers for security reasons.

**Official Source**: [Google Support Article](https://support.google.com/accounts/answer/7675428)

**Why**: Google states: "If you implemented 'Sign in with Google' with the Chromium Embedded Framework, you'll need to migrate to a more secure alternative."

**Affected Apps**: All Electron apps including VS Code, Slack, Discord, Spotify face this same limitation.

**Our Solution**:
- When Google blocks sign-in, we detect it and show a helpful dialog
- User clicks "Sign in with Safari/Chrome"
- Login completes in the system browser
- User returns to FlashAppAI Browser and refreshes
- Session cookies sync and user is logged in

**Status**: ✅ Implemented (browser-based OAuth flow)

---

*Last Updated: January 12, 2026*

