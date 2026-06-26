/* ===== config.js - App configuration =====
   Eén plek om de Cloudflare Worker URL te zetten. Zowel de vertaler
   (translate.js) als de prediction-sync (sync.js) lezen deze waarde.

   Na het deployen van /worker:  npm run deploy  -> kopieer de
   workers.dev URL en plak die hieronder (zonder trailing slash). */
window.F1_CONFIG = {
  workerUrl: 'https://f1-hungary-translate.avk-ailab.workers.dev'
};
