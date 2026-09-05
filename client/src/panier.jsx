import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ContextePanier = createContext(null)
const CLE = 'darou-minane.panier'

/**
 * Panier de la boutique publique, conservé dans le navigateur : le client
 * peut fermer l'onglet, revenir plus tard et retrouver sa sélection sans
 * avoir jamais créé de compte.
 *
 * Les prix stockés ici ne servent qu'à l'affichage : c'est le serveur qui
 * refige le prix de chaque ligne au moment de la commande.
 */
function lireStockage() {
  try {
    const brut = window.localStorage.getItem(CLE)
    const lignes = brut ? JSON.parse(brut) : []
    return Array.isArray(lignes) ? lignes.filter((l) => l && l.variante_id && l.quantite > 0) : []
  } catch {
    return []
  }
}

export function FournisseurPanier({ children }) {
  const [lignes, setLignes] = useState(lireStockage)

  useEffect(() => {
    try {
      window.localStorage.setItem(CLE, JSON.stringify(lignes))
    } catch {
      // navigation privée ou stockage plein : le panier reste en mémoire.
    }
  }, [lignes])

  const ajouter = useCallback((article, quantite = 1) => {
    setLignes((actuelles) => {
      const existante = actuelles.find((ligne) => ligne.variante_id === article.variante_id)
      if (!existante) {
        return [...actuelles, { ...article, quantite: Math.max(1, quantite) }]
      }
      return actuelles.map((ligne) =>
        ligne.variante_id === article.variante_id
          ? { ...ligne, quantite: ligne.quantite + quantite }
          : ligne,
      )
    })
  }, [])

  const changerQuantite = useCallback((varianteId, quantite) => {
    setLignes((actuelles) =>
      actuelles
        .map((ligne) => (ligne.variante_id === varianteId ? { ...ligne, quantite } : ligne))
        .filter((ligne) => ligne.quantite > 0),
    )
  }, [])

  const retirer = useCallback((varianteId) => {
    setLignes((actuelles) => actuelles.filter((ligne) => ligne.variante_id !== varianteId))
  }, [])

  const vider = useCallback(() => setLignes([]), [])

  const valeur = useMemo(() => {
    const articles = lignes.reduce((somme, ligne) => somme + ligne.quantite, 0)
    const total = lignes.reduce((somme, ligne) => somme + ligne.prix * ligne.quantite, 0)
    return { lignes, articles, total, ajouter, changerQuantite, retirer, vider }
  }, [lignes, ajouter, changerQuantite, retirer, vider])

  return <ContextePanier.Provider value={valeur}>{children}</ContextePanier.Provider>
}

export function usePanier() {
  const contexte = useContext(ContextePanier)
  if (!contexte) throw new Error('usePanier doit être utilisé dans FournisseurPanier.')
  return contexte
}
