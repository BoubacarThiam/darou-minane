import { useEffect, useState } from 'react'

/**
 * Bandeau discret quand le téléphone perd le réseau. La boutique reste
 * consultable grâce au cache du service worker, mais commander demande
 * une connexion : mieux vaut le dire avant l'échec.
 */
export function HorsLigne() {
  const [horsLigne, setHorsLigne] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)

  useEffect(() => {
    const enLigne = () => setHorsLigne(false)
    const coupe = () => setHorsLigne(true)
    window.addEventListener('online', enLigne)
    window.addEventListener('offline', coupe)
    return () => {
      window.removeEventListener('online', enLigne)
      window.removeEventListener('offline', coupe)
    }
  }, [])

  if (!horsLigne) return null

  return (
    <p className="hors-ligne" role="status">
      Vous êtes hors ligne. Vous pouvez consulter le catalogue déjà chargé ; l'envoi d'une
      commande attendra le retour du réseau.
    </p>
  )
}
