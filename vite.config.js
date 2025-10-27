// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  // Vite will automatically handle your imports
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});