/** Le FCFA n'a pas de décimales : « 12 500 FCFA », espace insécable fine. */
export function fcfa(montant) {
  const nombre = Number(montant) || 0
  return `${nombre.toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`
}

export function fourchettePrix(min, max) {
  return min === max ? fcfa(min) : `${fcfa(min)} – ${fcfa(max)}`
}

/** « 2026-09-05 14:32:10 » (UTC, comme la base) -> « 5 sept. à 14:32 ». */
export function dateCourte(valeur) {
  if (!valeur) return ''
  const date = new Date(String(valeur).replace(' ', 'T') + 'Z')
  if (Number.isNaN(date.getTime())) return String(valeur)
  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function libelleTypeMouvement(type) {
  return {
    entree: 'Entrée',
    vente: 'Vente',
    retour: 'Retour',
    perte: 'Perte',
    ajustement: 'Inventaire',
  }[type] ?? type
}

/** Affiche « +12 » ou « −2 » (vrai signe moins). */
export function delta(quantite) {
  return quantite > 0 ? `+${quantite}` : `−${Math.abs(quantite)}`
}
