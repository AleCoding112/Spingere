/* Il service worker è quello che rende l'app davvero utilizzabile in palestra:
   al primo caricamento mette in cache tutto, e da lì in poi serve sempre dalla
   cache. Senza rete non cambia niente, perché la rete non la usa comunque.

   Cambia CACHE quando modifichi un file, altrimenti il telefono continua a
   servire la versione vecchia. */

const CACHE = 'spingere-4';

const ROBA = [
  './',
  'index.html',
  'stile.css',
  'interfaccia.js',
  'esercizi.js',
  'allenamenti.js',
  'schede.js',
  'gruppi.js',
  'comporre.js',
  'motore.js',
  'archivio.js',
  'manifest.json',
  'icona.png',
  'icona-margine.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(ROBA)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(chiavi => Promise.all(chiavi.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Prima la cache. Se un file non c'è si prova la rete, e se la rete non c'è
   si risponde con la pagina: è il caso in cui il telefono ha perso la cache. */
self.addEventListener('fetch', ev => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    caches.match(ev.request, {ignoreSearch: true}).then(trovato => {
      if (trovato) return trovato;
      return fetch(ev.request)
        .then(risposta => {
          if (risposta.ok && new URL(ev.request.url).origin === location.origin)
            caches.open(CACHE).then(c => c.put(ev.request, risposta.clone()));
          return risposta;
        })
        .catch(() => caches.match('index.html'));
    })
  );
});
