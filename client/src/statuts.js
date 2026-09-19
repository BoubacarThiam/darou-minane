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

/**
 * Paiement mobile money (SasPay). Seul le serveur, après relecture chez
 * SasPay, fait passer un paiement à « paye » : ces libellés ne font que
 * dire où en est l'argent.
 */
export const PAIEMENTS = {
  paye:       { libelle: 'Payée par mobile money', classe: 'etiquette etiquette--succes' },
  en_attente: { libelle: 'Paiement en attente',    classe: 'etiquette etiquette--alerte' },
  expire:     { libelle: 'Paiement expiré',        classe: 'etiquette' },
  annule:     { libelle: 'Paiement abandonné',     classe: 'etiquette' },
}

/** Étiquette de liste : la liste ne connaît que « payée ou pas encore ». */
export function etiquettePaiement(commande) {
  if (commande.mode_paiement !== 'mobile_money') return null
  return commande.paye_en_ligne_le
    ? { libelle: 'Payée · mobile money', classe: 'etiquette etiquette--succes' }
    : { libelle: 'Mobile money · non reçu', classe: 'etiquette' }
}
