import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Provide empty module replacements for Node.js built-in modules
      fs: path.resolve(__dirname, './src/empty-module.js'),
      path: path.resolve(__dirname, './src/empty-module.js'),
      stream: path.resolve(__dirname, './src/empty-module.js'),
      util: path.resolve(__dirname, './src/empty-module.js'),
      buffer: path.resolve(__dirname, './src/empty-module.js'),
      process: path.resolve(__dirname, './src/process.js'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      // Node.js global to browser globalThis
      define: {
        global: 'globalThis',
      },
    },
  },
  define: {
    'process.env': {
      NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development')
    },
    'process.browser': true,
    'process.version': JSON.stringify(''),
    'process.platform': JSON.stringify('browser'),
  }
}) 