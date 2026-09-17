/*
 * Service worker de Darou Minane.
 *
 * Objectif : que la boutique reste consultable quand le réseau est lent ou
 * coupé, sans jamais servir une donnée de gestion périmée.
 *
 *   coquille   : la page d'entrée, pour démarrer hors ligne
 *   ressources : JS et CSS déjà versionnés par leur nom -> cache d'abord
 *   images     : photos produits, immuables -> cache d'abord, 60 au plus
 *   catalogue  : GET publics -> réseau d'abord, cache en secours
 *
 * Jamais mis en cache : tout /api/admin/ (données de gestion) et toute
 * requête qui n'est pas un GET (commandes, connexion, stock).
 */
// À incrémenter dès que la coquille ou le manifeste change : l'ancien cache
// est purgé à l'activation. v4 : le logo officiel (sceau rose) remplace « DM » ;
// v3 : retour au blanc et rose ; v2 : icônes nuit et or, sans quoi les
// visiteurs déjà venus garderaient l'ancien logo.
const VERSION = 'v4';
const COQUILLE = `darou-coquille-${VERSION}`;
const RESSOURCES = `darou-ressources-${VERSION}`;
const IMAGES = `darou-images-${VERSION}`;
const CATALOGUE = `darou-catalogue-${VERSION}`;
const CACHES = [COQUILLE, RESSOURCES, IMAGES, CATALOGUE];
const IMAGES_MAX = 60;

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches.open(COQUILLE).then((cache) => cache.addAll(['/', '/manifest.webmanifest'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((nom) => !CACHES.includes(nom)).map((nom) => caches.delete(nom))))
      .then(() => self.clients.claim()),
  );
});

async function limiter(nomCache, maximum) {
  const cache = await caches.open(nomCache);
  const clefs = await cache.keys();
  if (clefs.length > maximum) {
    await Promise.all(clefs.slice(0, clefs.length - maximum).map((clef) => cache.delete(clef)));
  }
}

async function cacheDabord(requete, nomCache, maximum) {
  const cache = await caches.open(nomCache);
  const enCache = await cache.match(requete);
  if (enCache) return enCache;

  const reponse = await fetch(requete);
  if (reponse.ok) {
    await cache.put(requete, reponse.clone());
    if (maximum) limiter(nomCache, maximum);
  }
  return reponse;
}

async function reseauDabord(requete, nomCache, secours) {
  const cache = await caches.open(nomCache);
  try {
    const reponse = await fetch(requete);
    if (reponse.ok) await cache.put(requete, reponse.clone());
    return reponse;
  } catch (erreur) {
    const enCache = await cache.match(requete);
    if (enCache) return enCache;
    if (secours) {
      const coquille = await caches.open(COQUILLE);
      const page = await coquille.match(secours);
      if (page) return page;
    }
    throw erreur;
  }
}

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;
  const url = new URL(requete.url);

  if (requete.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/admin/') || url.pathname.startsWith('/api/auth/')) return;

  // Navigation : réseau d'abord pour avoir la dernière version, coquille en
  // secours pour que l'application démarre hors ligne.
  if (requete.mode === 'navigate') {
    evenement.respondWith(reseauDabord(requete, COQUILLE, '/'));
    return;
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icones/')) {
    evenement.respondWith(cacheDabord(requete, RESSOURCES));
    return;
  }

  if (url.pathname.startsWith('/api/uploads/') || requete.destination === 'image') {
    evenement.respondWith(cacheDabord(requete, IMAGES, IMAGES_MAX));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    evenement.respondWith(reseauDabord(requete, CATALOGUE));
  }
});
