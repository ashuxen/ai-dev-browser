import React, { useState, useEffect } from 'react';
import './Sidebar.css';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type SidebarTab = 'bookmarks' | 'history' | 'downloads';

interface Bookmark {
  id: string;
  url: string;
  title: string;
  favicon?: string;
}

interface HistoryEntry {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  visitedAt: number;
}

interface Download {
  id: string;
  filename: string;
  state: string;
  receivedBytes: number;
  totalBytes: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>('bookmarks');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const loadData = async () => {
    switch (activeTab) {
      case 'bookmarks':
        const bm = await window.electron.bookmarks.getAll();
        setBookmarks(bm);
        break;
      case 'history':
        const hist = await window.electron.history.getAll();
        setHistory(hist.slice(0, 100));
        break;
      case 'downloads':
        const dl = await window.electron.downloads.getAll();
        setDownloads(dl);
        break;
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query) {
      loadData();
      return;
    }

    switch (activeTab) {
      case 'bookmarks':
        const bm = await window.electron.bookmarks.search(query);
        setBookmarks(bm);
        break;
      case 'history':
        const hist = await window.electron.history.search(query);
        setHistory(hist);
        break;
    }
  };

  const openUrl = (url: string) => {
    window.electron.tabs.navigate(url);
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeTab === 'bookmarks' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookmarks')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            Bookmarks
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </button>
          <button
            className={`sidebar-tab ${activeTab === 'downloads' ? 'active' : ''}`}
            onClick={() => setActiveTab('downloads')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Downloads
          </button>
        </div>
        <button className="sidebar-close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {activeTab !== 'downloads' && (
        <div className="sidebar-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
      )}

      <div className="sidebar-content">
        {activeTab === 'bookmarks' && (
          <div className="sidebar-list">
            {bookmarks.length === 0 ? (
              <div className="sidebar-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <p>No bookmarks yet</p>
              </div>
            ) : (
              bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="sidebar-item"
                  onClick={() => openUrl(bookmark.url)}
                >
                  {bookmark.favicon ? (
                    <img src={bookmark.favicon} alt="" className="sidebar-item-icon" />
                  ) : (
                    <div className="sidebar-item-icon default">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    </div>
                  )}
                  <div className="sidebar-item-content">
                    <span className="sidebar-item-title">{bookmark.title}</span>
                    <span className="sidebar-item-url">{bookmark.url}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="sidebar-list">
            {history.length === 0 ? (
              <div className="sidebar-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <p>No history yet</p>
              </div>
            ) : (
              history.map((entry) => (
                <div
                  key={entry.id}
                  className="sidebar-item"
                  onClick={() => openUrl(entry.url)}
                >
                  {entry.favicon ? (
                    <img src={entry.favicon} alt="" className="sidebar-item-icon" />
                  ) : (
                    <div className="sidebar-item-icon default">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    </div>
                  )}
                  <div className="sidebar-item-content">
                    <span className="sidebar-item-title">{entry.title}</span>
                    <span className="sidebar-item-meta">{formatTime(entry.visitedAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'downloads' && (
          <div className="sidebar-list">
            {downloads.length === 0 ? (
              <div className="sidebar-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <p>No downloads yet</p>
              </div>
            ) : (
              downloads.map((download) => (
                <div key={download.id} className="sidebar-item download-item">
                  <div className="download-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                      <polyline points="13 2 13 9 20 9" />
                    </svg>
                  </div>
                  <div className="sidebar-item-content">
                    <span className="sidebar-item-title">{download.filename}</span>
                    <div className="download-progress">
                      <div
                        className="download-progress-bar"
                        style={{
                          width: download.totalBytes > 0
                            ? `${(download.receivedBytes / download.totalBytes) * 100}%`
                            : '0%',
                        }}
                      />
                    </div>
                    <span className="sidebar-item-meta">
                      {formatBytes(download.receivedBytes)} / {formatBytes(download.totalBytes)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};




