/* sw.js — service worker «Игрового центра», кэш v9.
   v9: принудительная зачистка старых кэшей при активации (лечит залипший platform.js в TG-desktop);
       skipWaiting + clients.claim — новый SW работает сразу;
       запросы с cache:'no-store' (versions.json) идут мимо кэша.
   Навигации: network-first с фолбэком в кэш (офлайн-оболочка web).
   Статика: cache-first с фоновым освежением. */
var CACHE = 'igrovoj-centr-v9';

self.addEventListener('install', function(e){
  try{ self.skipWaiting(); }catch(err){}
});

self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    try{
      var keys = await caches.keys();
      await Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }catch(err){}
    try{ await self.clients.claim(); }catch(err){}
  })());
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try{ url = new URL(req.url); }catch(err){ return; }
  if (url.origin !== location.origin) return;

  /* манифест и прочие no-store — всегда сеть */
  if (req.cache === 'no-store') {
    e.respondWith(fetch(req));
    return;
  }

  if (req.mode === 'navigate') {
    e.respondWith((async function(){
      try{
        var net = await fetch(req);
        var cache = await caches.open(CACHE);
        cache.put(req, net.clone());
        return net;
      }catch(err){
        var cached = await caches.match(req);
        if (cached) return cached;
        var fallback = await caches.match(new Request('./index.html'));
        if (fallback) return fallback;
        throw err;
      }
    })());
    return;
  }

  e.respondWith((async function(){
    var cache = await caches.open(CACHE);
    var hit = await cache.match(req);
    var network = fetch(req).then(function(res){
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(function(){ return hit; });
    return hit || network;
  })());
});