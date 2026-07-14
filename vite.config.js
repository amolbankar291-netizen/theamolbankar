import { defineConfig } from 'vite';

// Relative base is required so the built assets load correctly
// when packaged inside a Capacitor native (Android/iOS) WebView.
export default defineConfig({
  base: './',
  server: {
    host: true,
    port: 5173
  },
  build: {
    outDir: 'dist',
    target: 'es2019',
    assetsInlineLimit: 0
  }
});
