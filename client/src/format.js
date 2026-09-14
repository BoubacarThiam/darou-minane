/** Le FCFA n'a pas de décimales : « 12 500 FCFA », espace insécable fine. */
export function fcfa(montant) {
  const nombre = Number(montant) || 0
  return `${nombre.toLocaleString('fr-FR').replace(/ | /g, ' ')} FCFA`
}

/**
 * Fourchette de prix d'un produit à plusieurs variantes.
 * La devise n'est écrite qu'une fois : « 25 000 – 27 000 FCFA » tient sur
 * une ligne là où « 25 000 FCFA – 27 000 FCFA » se coupe en deux.
 */
export function fourchettePrix(min, max) {
  if (min === max) return fcfa(min)
  const bas = Number(min).toLocaleString('fr-FR').replace(/ | /g, ' ')
  return `${bas} – ${fcfa(max)}`
}

/**
 * Accord en nombre : « 1 article », « 3 articles ».
 * En français, zéro reste au singulier (« 0 article »).
 * Le « (s) » entre parenthèses est de la langue de formulaire, pas de la
 * langue d'une boutique.
 */
export function pluriel(nombre, singulier, plurielMot = `${singulier}s`) {
  return `${nombre} ${Math.abs(nombre) > 1 ? plurielMot : singulier}`
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
