import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le front appelle toujours /api/... : en production l'API est dans /api,
// en développement le proxy renvoie vers le serveur PHP intégré.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: false,
        rewrite: (chemin) => chemin.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
