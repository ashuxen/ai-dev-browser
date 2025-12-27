import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

// Debug logging
console.log('🚀 Renderer starting...');
console.log('window.electron available:', !!window.electron);

const container = document.getElementById('root');
if (!container) {
  console.error('Root element not found!');
  document.body.innerHTML = '<h1 style="color: red; padding: 20px;">Error: Root element not found</h1>';
  throw new Error('Root element not found');
}

console.log('✅ Root element found, rendering App...');

try {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log('✅ App rendered successfully');
} catch (error) {
  console.error('❌ Error rendering app:', error);
  container.innerHTML = `<div style="color: red; padding: 20px;"><h1>Error rendering app</h1><pre>${error}</pre></div>`;
}

