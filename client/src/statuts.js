/** Vocabulaire et couleurs des statuts de commande, partagés par les écrans. */
export const STATUTS = {
  nouvelle:     { libelle: 'Nouvelle',     ton: 'rose' },
  confirmee:    { libelle: 'Confirmée',    ton: 'info' },
  en_livraison: { libelle: 'En livraison', ton: 'info' },
  livree:       { libelle: 'Livrée',       ton: 'succes' },
  payee:        { libelle: 'Payée',        ton: 'succes' },
  annulee:      { libelle: 'Annulée',      ton: 'neutre' },
}

export function libelleStatut(statut) {
  return STATUTS[statut]?.libelle ?? statut
}

export function classeStatut(statut) {
  const ton = STATUTS[statut]?.ton
  if (ton === 'succes') return 'etiquette etiquette--succes'
  if (ton === 'rose') return 'etiquette etiquette--rose'
  if (ton === 'info') return 'etiquette etiquette--info'
  return 'etiquette'
}

/** Verbe d'action pour le bouton qui fait passer la commande à ce statut. */
export function actionStatut(statut) {
  return {
    confirmee: 'Confirmer',
    en_livraison: 'Mettre en livraison',
    livree: 'Marquer livrée',
    payee: 'Marquer payée',
    annulee: 'Annuler la commande',
  }[statut] ?? libelleStatut(statut)
}

export const CANAUX = { en_ligne: 'En ligne', comptoir: 'Comptoir' }
