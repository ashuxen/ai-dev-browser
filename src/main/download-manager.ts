import { BrowserWindow, dialog, shell, ipcMain, DownloadItem } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface Download {
  id: string;
  url: string;
  filename: string;
  savePath: string;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  receivedBytes: number;
  totalBytes: number;
  startTime: number;
  endTime?: number;
  speed: number; // bytes per second
  error?: string;
}

interface DownloadState {
  downloads: Download[];
  defaultPath: string;
}

export class DownloadManager {
  private mainWindow: BrowserWindow | null = null;
  private store: Store<{ downloadState: DownloadState }>;
  private activeDownloads: Map<string, DownloadItem> = new Map();

  constructor() {
    this.store = new Store({
      name: 'downloads',
      defaults: {
        downloadState: {
          downloads: [],
          defaultPath: '',
        },
      },
    });

    this.setupIPC();
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;

    // Handle downloads from the window's session
    window.webContents.session.on('will-download', (_event, item, _webContents) => {
      this.handleDownload(item);
    });
  }

  private setupIPC(): void {
    ipcMain.handle('download:get-all', () => this.getAllDownloads());
    ipcMain.handle('download:cancel', (_event, id: string) => this.cancelDownload(id));
    ipcMain.handle('download:pause', (_event, id: string) => this.pauseDownload(id));
    ipcMain.handle('download:resume', (_event, id: string) => this.resumeDownload(id));
    ipcMain.handle('download:clear-completed', () => this.clearCompleted());
    ipcMain.handle('download:open-file', (_event, id: string) => this.openFile(id));
    ipcMain.handle('download:show-in-folder', (_event, id: string) => this.showInFolder(id));
    ipcMain.handle('download:set-default-path', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openDirectory'],
        title: 'Select Default Download Location',
      });
      
      if (!result.canceled && result.filePaths[0]) {
        const state = this.store.get('downloadState');
        state.defaultPath = result.filePaths[0];
        this.store.set('downloadState', state);
        return result.filePaths[0];
      }
      return null;
    });
  }

  private handleDownload(item: DownloadItem): void {
    const downloadId = uuidv4();
    const filename = item.getFilename();
    
    // Get save path
    const state = this.store.get('downloadState');
    const savePath = state.defaultPath
      ? path.join(state.defaultPath, filename)
      : path.join(require('os').homedir(), 'Downloads', filename);

    item.setSavePath(savePath);

    // Create download record
    const download: Download = {
      id: downloadId,
      url: item.getURL(),
      filename,
      savePath,
      state: 'progressing',
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      startTime: Date.now(),
      speed: 0,
    };

    this.activeDownloads.set(downloadId, item);
    this.addDownload(download);

    let lastReceivedBytes = 0;
    let lastTime = Date.now();

    // Update progress
    item.on('updated', (_event, progressState) => {
      const currentTime = Date.now();
      const timeDiff = (currentTime - lastTime) / 1000;
      const bytesDiff = item.getReceivedBytes() - lastReceivedBytes;
      
      download.receivedBytes = item.getReceivedBytes();
      download.totalBytes = item.getTotalBytes();
      download.state = progressState === 'progressing' ? 'progressing' : 'interrupted';
      download.speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

      lastReceivedBytes = item.getReceivedBytes();
      lastTime = currentTime;

      this.updateDownload(download);
      this.notifyProgress(download);
    });

    // Handle completion
    item.once('done', (_event, doneState) => {
      download.endTime = Date.now();
      
      if (doneState === 'completed') {
        download.state = 'completed';
        download.receivedBytes = item.getTotalBytes();
      } else if (doneState === 'cancelled') {
        download.state = 'cancelled';
      } else {
        download.state = 'interrupted';
        download.error = 'Download failed';
      }

      this.activeDownloads.delete(downloadId);
      this.updateDownload(download);
      this.notifyComplete(download);
    });
  }

  private addDownload(download: Download): void {
    const state = this.store.get('downloadState');
    state.downloads.unshift(download);
    
    // Keep only last 1000 downloads
    if (state.downloads.length > 1000) {
      state.downloads = state.downloads.slice(0, 1000);
    }
    
    this.store.set('downloadState', state);
  }

  private updateDownload(download: Download): void {
    const state = this.store.get('downloadState');
    const index = state.downloads.findIndex(d => d.id === download.id);
    
    if (index !== -1) {
      state.downloads[index] = download;
      this.store.set('downloadState', state);
    }
  }

  getAllDownloads(): Download[] {
    const state = this.store.get('downloadState');
    return state.downloads;
  }

  cancelDownload(id: string): boolean {
    const item = this.activeDownloads.get(id);
    if (item) {
      item.cancel();
      return true;
    }
    return false;
  }

  pauseDownload(id: string): boolean {
    const item = this.activeDownloads.get(id);
    if (item && item.canResume()) {
      item.pause();
      return true;
    }
    return false;
  }

  resumeDownload(id: string): boolean {
    const item = this.activeDownloads.get(id);
    if (item && item.isPaused()) {
      item.resume();
      return true;
    }
    return false;
  }

  clearCompleted(): void {
    const state = this.store.get('downloadState');
    state.downloads = state.downloads.filter(d => 
      d.state === 'progressing'
    );
    this.store.set('downloadState', state);
  }

  openFile(id: string): boolean {
    const state = this.store.get('downloadState');
    const download = state.downloads.find(d => d.id === id);
    
    if (download && download.state === 'completed') {
      shell.openPath(download.savePath);
      return true;
    }
    return false;
  }

  showInFolder(id: string): boolean {
    const state = this.store.get('downloadState');
    const download = state.downloads.find(d => d.id === id);
    
    if (download) {
      shell.showItemInFolder(download.savePath);
      return true;
    }
    return false;
  }

  private notifyProgress(download: Download): void {
    this.mainWindow?.webContents.send('download-progress', download);
  }

  private notifyComplete(download: Download): void {
    this.mainWindow?.webContents.send('download-complete', download);
  }
}

