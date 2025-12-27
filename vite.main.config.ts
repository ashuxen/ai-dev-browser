import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@main': path.resolve(__dirname, 'src/main'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@services': path.resolve(__dirname, 'src/services'),
    },
  },
  build: {
    outDir: '.vite/build',
    lib: {
      entry: 'src/main/main.ts',
      formats: ['cjs'],
    },
    rollupOptions: {
      external: ['electron', 'electron-store', 'ws', 'electron-updater'],
    },
    minify: process.env.NODE_ENV === 'production',
    sourcemap: true,
  },
});

