const CACHE='school-planner-v37-keep-unsynced-edits';
const ASSETS=['./','./index.html','./app.html','./login.html','./landing.css','./landing.js','./styles.css','./app.js','./login.js','./firebase-config.js','./session.js','./manifest.json','./logo.png','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const NETWORK_FIRST=['./index.html','./app.html','./login.html','./landing.css','./landing.js','./firebase-config.js','./session.js','./app.js','./login.js','./styles.css'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  const isNetworkFirst=e.request.mode==='navigate'||NETWORK_FIRST.some(a=>url.pathname.endsWith(a.slice(1)));
  if(isNetworkFirst){
    // Revalidate with the server so GitHub Pages' 10-minute HTTP cache never serves an old app.js.
    e.respondWith(fetch(e.request,{cache:'no-cache'}).then(x=>{const c=x.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return x}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{const c=x.clone();caches.open(CACHE).then(k=>k.put(e.request,c));return x}).catch(()=>caches.match('./index.html'))));
});
