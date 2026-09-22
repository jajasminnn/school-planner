const CACHE='school-planner-v6-spreadsheet-tasks';
const ASSETS=['./','./index.html','./login.html','./styles.css','./app.js','./login.js','./firebase-config.js','./manifest.json','./icon.svg'];
const NETWORK_FIRST=['./index.html','./firebase-config.js','./app.js','./styles.css'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  const isNetworkFirst=e.request.mode==='navigate'||NETWORK_FIRST.some(a=>url.pathname.endsWith(a.slice(1)));
  if(isNetworkFirst){
    e.respondWith(fetch(e.request).then(x=>{const c=x.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return x}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{const c=x.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return x}).catch(()=>caches.match('./index.html'))));
});
