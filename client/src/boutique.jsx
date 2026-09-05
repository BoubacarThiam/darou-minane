import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

const ContexteBoutique = createContext(null)

/** Identité de l'enseigne — nom, WhatsApp, zone de livraison — servie par
 *  l'API : rien de tout cela n'est écrit en dur dans le front. */
const REPLI = {
  nom: 'Darou Minane',
  slogan: 'Groupe Business Communication 626',
  whatsapp: null,
  zone_livraison: 'Tambacounda et environs',
  devise: 'FCFA',
  livraison: 'à convenir',
}

export function FournisseurBoutique({ children }) {
  const [boutique, setBoutique] = useState(REPLI)

  useEffect(() => {
    let annule = false
    api
      .get('/boutique')
      .then((donnees) => { if (!annule) setBoutique({ ...REPLI, ...donnees }) })
      .catch(() => {})
    return () => { annule = true }
  }, [])

  return <ContexteBoutique.Provider value={boutique}>{children}</ContexteBoutique.Provider>
}

export function useBoutique() {
  return useContext(ContexteBoutique) ?? REPLI
}
