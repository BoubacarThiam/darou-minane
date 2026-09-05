import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, definirJetonCsrf } from './api.js'

const ContexteAuth = createContext(null)

export function FournisseurAuth({ children }) {
  const [utilisateur, setUtilisateur] = useState(null)
  const [chargement, setChargement] = useState(true)

  const appliquerSession = useCallback((donnees) => {
    definirJetonCsrf(donnees?.csrf_token ?? null)
    setUtilisateur(donnees?.utilisateur ?? null)
  }, [])

  useEffect(() => {
    let annule = false
    api
      .get('/auth/moi')
      .then((donnees) => { if (!annule) appliquerSession(donnees) })
      .catch(() => { if (!annule) appliquerSession(null) })
      .finally(() => { if (!annule) setChargement(false) })
    return () => { annule = true }
  }, [appliquerSession])

  // L'API signale une session expirée (401) : on repasse en état déconnecté.
  useEffect(() => {
    const surSessionTerminee = () => appliquerSession(null)
    window.addEventListener('session-terminee', surSessionTerminee)
    return () => window.removeEventListener('session-terminee', surSessionTerminee)
  }, [appliquerSession])

  const connexion = useCallback(
    async (telephone, motDePasse) => {
      const donnees = await api.post('/auth/connexion', { telephone, mot_de_passe: motDePasse })
      appliquerSession(donnees)
      return donnees.utilisateur
    },
    [appliquerSession],
  )

  const deconnexion = useCallback(async () => {
    try {
      await api.post('/auth/deconnexion')
    } finally {
      appliquerSession(null)
    }
  }, [appliquerSession])

  const valeur = useMemo(
    () => ({
      utilisateur,
      chargement,
      connexion,
      deconnexion,
      estProprietaire: utilisateur?.role === 'proprietaire',
    }),
    [utilisateur, chargement, connexion, deconnexion],
  )

  return <ContexteAuth.Provider value={valeur}>{children}</ContexteAuth.Provider>
}

export function useAuth() {
  const contexte = useContext(ContexteAuth)
  if (!contexte) throw new Error('useAuth doit être utilisé dans FournisseurAuth.')
  return contexte
}
