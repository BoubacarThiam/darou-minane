/**
 * Client HTTP de l'API Darou Minane.
 * Le front appelle toujours /api/... : en production l'API est servie dans
 * /api, en développement le proxy Vite s'en charge (voir vite.config.js).
 */
const BASE = '/api'

let jetonCsrf = null

export function definirJetonCsrf(jeton) {
  jetonCsrf = jeton
}

export class ErreurApi extends Error {
  constructor(message, statut, champs = {}) {
    super(message)
    this.statut = statut
    this.champs = champs
  }
}

function construireUrl(chemin, parametres) {
  if (!parametres) return BASE + chemin
  const query = new URLSearchParams()
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (valeur !== undefined && valeur !== null && valeur !== '') query.set(cle, String(valeur))
  }
  const chaine = query.toString()
  return BASE + chemin + (chaine ? `?${chaine}` : '')
}

async function requete(methode, chemin, { corps, formData, parametres } = {}) {
  const options = { method: methode, credentials: 'same-origin', headers: {} }

  if (methode !== 'GET' && jetonCsrf) options.headers['X-CSRF-Token'] = jetonCsrf
  if (formData) {
    options.body = formData // le navigateur pose lui-même le Content-Type multipart
  } else if (corps !== undefined) {
    options.headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(corps)
  }

  let reponse
  try {
    reponse = await fetch(construireUrl(chemin, parametres), options)
  } catch {
    throw new ErreurApi('Connexion impossible. Vérifiez le réseau et réessayez.', 0)
  }

  if (reponse.status === 204) return null

  const donnees = await reponse.json().catch(() => null)

  if (!reponse.ok) {
    if (reponse.status === 401) window.dispatchEvent(new CustomEvent('session-terminee'))
    throw new ErreurApi(
      donnees?.erreur ?? 'Une erreur est survenue.',
      reponse.status,
      donnees?.champs ?? {},
    )
  }
  return donnees
}

export const api = {
  get: (chemin, parametres) => requete('GET', chemin, { parametres }),
  post: (chemin, corps) => requete('POST', chemin, { corps }),
  put: (chemin, corps) => requete('PUT', chemin, { corps }),
  supprimer: (chemin) => requete('DELETE', chemin),
  televerser: (chemin, formData) => requete('POST', chemin, { formData }),
}
