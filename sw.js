// PréVol — service worker
//
// Réécrit le 07/09/2026 pour le site en douze pages.
//
// L'ancienne version mettait en cache la seule ./index.html et la servait en
// secours pour TOUTES les navigations : hors ligne, meteo.html ou carburant.html
// affichaient le tableau de bord. Chaque page est désormais mise en cache et
// resservie individuellement.
//
// Les chemins sont relatifs à l'emplacement du service worker, pour rester
// valables aussi bien à la racine d'un domaine que sous /nom-du-depot/ comme
// le fait GitHub Pages.
const CACHE_VERSION = 'prevol-v42-docs-pilote';

const PAGES = [
  './',
  './index.html',
  './dossier.html',
  './carnet-de-vol.html',
  './dossiers.html',
  './navigation.html',
  './masse-centrage.html',
  './carburant.html',
  './performances.html',
  './documents.html',
  './meteo.html',
  './notam.html',
  './parametres.html',
  './a-propos.html'
];

// Le script et la feuille de style partagés sont désormais des fichiers à
// part : sans eux dans le cache, les pages s'ouvriraient nues hors ligne.
const ASSETS = [
  './app.js',
  './app.css',
  './page-carburant.js',
  './carnet.css',
  './carnet.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './hero-wing.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll échoue en bloc si une seule ressource manque : on ajoute
      // pièce par pièce pour qu'un fichier absent ne vide pas tout le cache.
      Promise.all(
        PAGES.concat(ASSETS).map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] non mis en cache :', url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // La météo passe désormais par l'API publique de l'Aviation Weather Center,
  // donc par une autre origine. Le service worker ne doit toucher ni à ces
  // appels, ni à l'ancien relais /api/ : une observation périmée servie
  // silencieusement depuis un cache serait dangereuse en préparation de vol.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return;

  const isNavigation = req.mode === 'navigate' ||
    (req.destination === '' && req.headers.get('accept')?.includes('text/html'));

  if (isNavigation) {
    // Réseau d'abord, pour qu'un commit soit pris en compte dès la
    // réouverture ; repli sur la page elle-même, puis sur le tableau de bord.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match('./index.html'))
        )
    );
    return;
  }

  // Les feuilles de style et les scripts passent en RÉSEAU D'ABORD.
  //
  // Ils étaient servis depuis le cache, avec rafraîchissement en arrière-plan
  // pour la visite suivante. Conséquence : après un commit, le premier
  // rechargement affichait encore l'ancien CSS. Une correction de mise en page
  // semblait donc sans effet, et il fallait recharger deux fois sans le savoir.
  // Le cache reste le filet hors ligne, plus la source par défaut.
  const codeSource = /\.(css|js)$/i.test(url.pathname);
  if (codeSource) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Le reste (images, icônes, manifeste) change rarement : cache d'abord,
  // rafraîchi en arrière-plan.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
