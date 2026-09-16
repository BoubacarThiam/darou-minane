import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Le front appelle toujours /api/... : en production l'API est dans /api,
// en développement le proxy renvoie vers le serveur PHP intégré.
const proxyApi = {
  '/api': {
    target: 'http://127.0.0.1:8000',
    changeOrigin: false,
    rewrite: (chemin) => chemin.replace(/^\/api/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: proxyApi,
  },
  // Le même proxy pour `vite preview` : sans lui, impossible de mesurer la
  // compilation de production en local, et c'est la seule qui compte —
  // le serveur de développement sert un JavaScript ni minifié ni compressé.
  preview: {
    port: 4173,
    proxy: proxyApi,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        // React change bien plus rarement que le code du projet : en le
        // isolant, une mise en ligne ne réinvalide pas 140 Ko chez le client.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
