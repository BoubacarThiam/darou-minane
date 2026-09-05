import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api.js'
import { useAuth } from './auth.jsx'
import { useToasts } from './composants/Toasts.jsx'

const ContexteNotifications = createContext(null)
const INTERVALLE = 30_000

/* --- Signal sonore ----------------------------------------------------
   Deux notes courtes, synthétisées : aucun fichier à télécharger, ce qui
   compte quand la boutique est en 3G. Le navigateur n'autorise le son
   qu'après une première interaction : on prépare le contexte audio au
   premier geste de l'utilisateur.                                        */
let contexteAudio = null

function preparerAudio() {
  if (contexteAudio) return
  const Constructeur = window.AudioContext ?? window.webkitAudioContext
  if (!Constructeur) return
  contexteAudio = new Constructeur()
}

function jouerSignal() {
  if (!contexteAudio) return
  if (contexteAudio.state === 'suspended') contexteAudio.resume()

  const depart = contexteAudio.currentTime
  for (const [index, frequence] of [880, 1175].entries()) {
    const oscillateur = contexteAudio.createOscillator()
    const volume = contexteAudio.createGain()
    const debut = depart + index * 0.18

    oscillateur.type = 'sine'
    oscillateur.frequency.value = frequence
    volume.gain.setValueAtTime(0.0001, debut)
    volume.gain.exponentialRampToValueAtTime(0.2, debut + 0.02)
    volume.gain.exponentialRampToValueAtTime(0.0001, debut + 0.16)

    oscillateur.connect(volume)
    volume.connect(contexteAudio.destination)
    oscillateur.start(debut)
    oscillateur.stop(debut + 0.18)
  }
}

export function FournisseurNotifications({ children }) {
  const { utilisateur } = useAuth()
  const toasts = useToasts()
  const [nonVues, setNonVues] = useState(0)
  const [commandes, setCommandes] = useState([])
  const precedent = useRef(null)

  useEffect(() => {
    const surGeste = () => preparerAudio()
    document.addEventListener('pointerdown', surGeste, { once: true })
    document.addEventListener('keydown', surGeste, { once: true })
    return () => {
      document.removeEventListener('pointerdown', surGeste)
      document.removeEventListener('keydown', surGeste)
    }
  }, [])

  const rafraichir = useCallback(async () => {
    try {
      const reponse = await api.get('/admin/notifications')
      setNonVues(reponse.non_vues)
      setCommandes(reponse.commandes)

      // Le signal ne se déclenche que sur une VRAIE nouveauté, jamais au
      // premier chargement de la page.
      if (precedent.current !== null && reponse.non_vues > precedent.current) {
        jouerSignal()
        const derniere = reponse.commandes[0]
        toasts.afficher(
          derniere
            ? `Nouvelle commande ${derniere.reference} — ${derniere.client_nom}`
            : 'Nouvelle commande en ligne',
          'succes',
          8000,
        )
      }
      precedent.current = reponse.non_vues
    } catch {
      // Réseau coupé : on garde le dernier compteur connu, sans déranger.
    }
  }, [toasts])

  useEffect(() => {
    if (!utilisateur) {
      setNonVues(0)
      setCommandes([])
      precedent.current = null
      return undefined
    }

    rafraichir()
    const minuteur = window.setInterval(rafraichir, INTERVALLE)
    const surVisibilite = () => { if (!document.hidden) rafraichir() }
    document.addEventListener('visibilitychange', surVisibilite)

    return () => {
      window.clearInterval(minuteur)
      document.removeEventListener('visibilitychange', surVisibilite)
    }
  }, [utilisateur, rafraichir])

  const valeur = useMemo(() => ({ nonVues, commandes, rafraichir }), [nonVues, commandes, rafraichir])

  return <ContexteNotifications.Provider value={valeur}>{children}</ContexteNotifications.Provider>
}

export function useNotifications() {
  const contexte = useContext(ContexteNotifications)
  if (!contexte) throw new Error('useNotifications doit être utilisé dans FournisseurNotifications.')
  return contexte
}
