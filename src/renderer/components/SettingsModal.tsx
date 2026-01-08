import React, { useState, useEffect } from 'react';
import './Modal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Settings {
  openaiApiKey: string;
  anthropicApiKey: string;
  aiProvider: 'openai' | 'anthropic' | 'auto';
  theme: 'system' | 'light' | 'dark';
  defaultSearchEngine: string;
  enableTelemetry: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<Settings>({
    openaiApiKey: '',
    anthropicApiKey: '',
    aiProvider: 'auto',
    theme: 'system',
    defaultSearchEngine: 'google',
    enableTelemetry: false,
  });
  const [activeTab, setActiveTab] = useState<'general' | 'ai' | 'privacy'>('general');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Load settings
      // In a real app, these would be loaded from electron-store
    }
  }, [isOpen]);

  const handleSave = async () => {
    // Save to AI service
    await window.electron.ai.configure({
      provider: settings.aiProvider,
      openaiApiKey: settings.openaiApiKey || undefined,
      anthropicApiKey: settings.anthropicApiKey || undefined,
    });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={`modal-tab ${activeTab === 'ai' ? 'active' : ''}`}
            onClick={() => setActiveTab('ai')}
          >
            AI Settings
          </button>
          <button
            className={`modal-tab ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            Privacy
          </button>
        </div>

        <div className="modal-content">
          {activeTab === 'general' && (
            <div className="settings-section">
              <div className="setting-item">
                <label>Theme</label>
                <select
                  value={settings.theme}
                  onChange={(e) => setSettings(s => ({ ...s, theme: e.target.value as any }))}
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>

              <div className="setting-item">
                <label>Default Search Engine</label>
                <select
                  value={settings.defaultSearchEngine}
                  onChange={(e) => setSettings(s => ({ ...s, defaultSearchEngine: e.target.value }))}
                >
                  <option value="google">Google</option>
                  <option value="duckduckgo">DuckDuckGo</option>
                  <option value="bing">Bing</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="settings-section">
              <div className="setting-item">
                <label>AI Provider</label>
                <select
                  value={settings.aiProvider}
                  onChange={(e) => setSettings(s => ({ ...s, aiProvider: e.target.value as any }))}
                >
                  <option value="auto">Auto (Use available)</option>
                  <option value="openai">OpenAI (GPT-4)</option>
                  <option value="anthropic">Anthropic (Claude)</option>
                </select>
              </div>

              <div className="setting-item">
                <label>OpenAI API Key</label>
                <input
                  type="password"
                  value={settings.openaiApiKey}
                  onChange={(e) => setSettings(s => ({ ...s, openaiApiKey: e.target.value }))}
                  placeholder="sk-..."
                />
                <span className="setting-hint">
                  Get your API key from{' '}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer">
                    OpenAI Dashboard
                  </a>
                </span>
              </div>

              <div className="setting-item">
                <label>Anthropic API Key</label>
                <input
                  type="password"
                  value={settings.anthropicApiKey}
                  onChange={(e) => setSettings(s => ({ ...s, anthropicApiKey: e.target.value }))}
                  placeholder="sk-ant-..."
                />
                <span className="setting-hint">
                  Get your API key from{' '}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer">
                    Anthropic Console
                  </a>
                </span>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="settings-section">
              <div className="setting-item checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.enableTelemetry}
                    onChange={(e) => setSettings(s => ({ ...s, enableTelemetry: e.target.checked }))}
                  />
                  <span>Enable anonymous usage analytics</span>
                </label>
                <span className="setting-hint">
                  Help us improve AI Dev Browser by sending anonymous usage data.
                  No personal information is collected.
                </span>
              </div>

              <div className="setting-item">
                <button className="setting-button danger">
                  Clear All Browsing Data
                </button>
              </div>

              <div className="setting-item">
                <button className="setting-button danger">
                  Clear All OAuth Tokens
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="modal-button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-button primary" onClick={handleSave}>
            {saved ? '✓ Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};




