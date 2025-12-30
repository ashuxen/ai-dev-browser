import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    outDir: '.vite/renderer/main_window',
    rollupOptions: {
      input: 'src/renderer/index.html',
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});



