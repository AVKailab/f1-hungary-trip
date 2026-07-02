/* ===== config.js - App configuration =====
   Eén plek voor de Cloudflare Worker URL + push-key. Gelezen door
   translate.js, sync.js, push.js én sw.js (via importScripts — daarom
   `self` i.p.v. `window`; in een gewone pagina zijn die identiek). */
self.F1_CONFIG = {
  workerUrl: 'https://f1-hungary-translate.avk-ailab.workers.dev',
  // VAPID public key voor web push (de private helft leeft in de Worker)
  vapidPublicKey: 'BJTuw03yW4Zl4WxRJnQg4ZMCrhz09CtWoMyMz-EoOA6AWEpLkqDyd0JAI9fd0BlHKCLm4s-1dGvWIrMTsnhe9sY'
};
