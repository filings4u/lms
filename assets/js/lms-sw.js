const CACHE='s4u-lms-static-v20261003-1';
const CORE=[
 './images/fav.png','./images/logo.png','./images/logo.png',
 './assets/css/lms.css','./assets/css/lms-refinement.css','./assets/css/lms-ui-modals.css','./assets/css/lms-logo-branding.css',
 './assets/js/supabase-config.js','./assets/js/core-auth.js','./assets/js/training-auth-guard.js',
 './assets/js/navigation.js','./assets/js/lms.js','./assets/js/lms-performance.js'
];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('s4u-lms-static-')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;
 const u=new URL(req.url);if(u.origin!==location.origin)return;
 const isHtml=req.mode==='navigate'||u.pathname.endsWith('.html')||u.pathname.endsWith('/');
 if(isHtml){
   e.respondWith(fetch(req).catch(()=>caches.match(req)));
   return;
 }
 if(/\.(?:js|css|png|jpg|jpeg|webp|svg|woff2?)$/i.test(u.pathname)){
   e.respondWith(caches.match(req).then(async cached=>{
     if(cached)return cached;
     const r=await fetch(req);
     if(r&&r.ok){
       // Clone before the original response can be consumed by the page.
       const copy=r.clone();
       const cache=await caches.open(CACHE);
       await cache.put(req,copy);
     }
     return r;
   }));
 }
});
