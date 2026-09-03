'use strict';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// La telemetría y las páginas autenticadas siempre se solicitan a la red.
self.addEventListener('fetch',()=>{});
