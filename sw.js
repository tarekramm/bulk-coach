// A single service worker handles offline caching and OneSignal's push events.
try { importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"); } catch (e) { /* Offline installs continue to work. */ }
const CACHE="bulk-coach-v1";
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(["/","/index.html","/style.css","/app.js","/config.js","/icon.svg","/manifest.webmanifest"]))));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("fetch",event=>{ if(event.request.method!=="GET")return; const u=new URL(event.request.url);if(u.origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request)));});
