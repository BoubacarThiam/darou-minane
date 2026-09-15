import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
// Les jetons d'abord : la feuille de style ne fait que les consommer.
import './tokens.css'
import './styles.css'

// Le service worker n'est utile qu'en production : en développement il
// masquerait les modifications derrière son cache.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Pas de service worker (navigateur ancien, site non sécurisé) :
      // l'application fonctionne, sans le mode hors ligne.
    })
  })
}

createRoot(document.getElementById('racine')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
