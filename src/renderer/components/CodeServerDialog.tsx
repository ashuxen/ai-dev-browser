import React, { useState } from 'react';
import './Modal.css';

interface CodeServerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  status: {
    connected: boolean;
    url: string | null;
  };
  onConnect: (url: string) => Promise<boolean>;
  onDisconnect: () => void;
}

export const CodeServerDialog: React.FC<CodeServerDialogProps> = ({
  isOpen,
  onClose,
  status,
  onConnect,
  onDisconnect,
}) => {
  const [url, setUrl] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsConnecting(true);
    setError('');

    try {
      const success = await onConnect(url.trim());
      if (!success) {
        setError('Failed to connect. Please check the URL and try again.');
      }
    } catch (err) {
      setError('Connection failed. Make sure code-server is running.');
    } finally {
      setIsConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            Code-Server Connection
          </h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-content">
          {status.connected ? (
            <div className="connection-status connected">
              <div className="status-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <div className="status-info">
                <h3>Connected</h3>
                <p>{status.url}</p>
              </div>
              <button className="setting-button danger" onClick={onDisconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnect}>
              <div className="setting-item">
                <label>Code-Server URL</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://code.example.com"
                  disabled={isConnecting}
                />
                <span className="setting-hint">
                  Enter your code-server instance URL. The browser will establish
                  a WebSocket connection for OAuth token delivery and code transfer.
                </span>
              </div>

              {error && (
                <div className="connection-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="modal-button primary full-width"
                disabled={!url.trim() || isConnecting}
              >
                {isConnecting ? (
                  <>
                    <span className="button-spinner" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            </form>
          )}

          <div className="connection-info">
            <h4>Features enabled with code-server:</h4>
            <ul>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                OAuth token delivery to extensions
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Send code snippets to editor
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Execute commands remotely
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Real-time synchronization
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};




