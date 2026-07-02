/* ===== sync.js - Shared predictions & race result sync ===== */
/* Everybody shares ONE Cloudflare Worker (KV-backed). No room codes.
   Predictions are keyed per person name, so they merge cleanly across
   devices. The Worker also merges server-side as a safety net.

   Set the Worker URL in js/config.js. If it is empty, sync is disabled
   and the app works in local-only mode (no crashes). */
(function () {
  'use strict';

  /* ---------- Configuration ---------- */
  var POLL_INTERVAL = 10000; // 10 seconds

  function workerBase() {
    var url = (window.F1_CONFIG && window.F1_CONFIG.workerUrl) || '';
    return url.replace(/\/$/, '');
  }

  function syncEnabled() {
    return !!workerBase();
  }

  /* ---------- State ---------- */
  var pollTimer = null;
  var onUpdateCallback = null;
  var isSyncing = false;
  var pushCooldownUntil = 0;
  var lastRemoteHash = '';

  /* Status for the UI indicator. pendingPush = a push failed (offline?) and
     will be retried on the next poll tick or when the browser comes online. */
  var syncStatus = { lastOkAt: 0, lastError: null, pendingPush: false };

  function emitStatus() {
    try {
      window.dispatchEvent(new CustomEvent('f1syncstatus'));
    } catch (e) {}
  }

  function markOk() {
    syncStatus.lastOkAt = Date.now();
    syncStatus.lastError = null;
    emitStatus();
  }

  function markError(err) {
    syncStatus.lastError = err || 'sync error';
    emitStatus();
  }

  /* ---------- Helpers ---------- */

  function hashOf(obj) {
    try { return JSON.stringify(obj || {}); } catch (e) { return ''; }
  }

  /* GET the shared state from the Worker. */
  function fetchRemote(callback) {
    if (!syncEnabled()) {
      return callback(null, { predictions: {}, raceResult: null });
    }
    fetch(workerBase() + '/sync', {
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('Sync error (' + res.status + ')');
      return res.json();
    }).then(function (data) {
      callback(null, data || { predictions: {}, raceResult: null });
    }).catch(function (err) {
      callback(err.message || 'Kon data niet ophalen');
    });
  }

  /* POST local state to the Worker; it merges server-side and returns the
     canonical merged state. */
  function saveRemote(data, callback) {
    if (!syncEnabled()) return callback(null, data);
    fetch(workerBase() + '/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ predictionsByRace: data.predictionsByRace || {}, raceResultsByRace: data.raceResultsByRace || {} })
    }).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error(body.error || ('Opslaan mislukt (' + res.status + ')'));
        return body;
      });
    }).then(function (merged) {
      callback(null, merged);
    }).catch(function (err) {
      callback(err.message || 'Kon data niet opslaan');
    });
  }

  /* Merge remote predictions into local. Rules:
     1. A LOCKED prediction is immutable — once locked, the locked version
        always wins (earliest lockedAt if both sides locked).
     2. If only one side is locked, that one wins regardless of timestamps.
     3. Neither side locked: use _updated timestamp (newest wins). */
  function mergePredictions(localPreds, remotePreds) {
    localPreds = localPreds || {};
    remotePreds = remotePreds || {};
    var merged = {};
    var names = {};
    Object.keys(localPreds).forEach(function (n) { names[n] = true; });
    Object.keys(remotePreds).forEach(function (n) { names[n] = true; });

    Object.keys(names).forEach(function (name) {
      var l = localPreds[name];
      var r = remotePreds[name];
      if (!l) { merged[name] = r; return; }
      if (!r) { merged[name] = l; return; }

      // Lock rules: locked entries are immutable
      if (l.locked && !r.locked) { merged[name] = l; return; }
      if (r.locked && !l.locked) { merged[name] = r; return; }
      if (l.locked && r.locked) {
        // Both locked — keep the one that locked first (can't re-lock)
        var ll = l.lockedAt || 0;
        var rl = r.lockedAt || 0;
        merged[name] = (ll <= rl && ll > 0) ? l : r;
        return;
      }

      // Neither locked — newest wins
      var lu = l._updated || 0;
      var ru = r._updated || 0;
      merged[name] = (ru > lu) ? r : l;
    });
    return merged;
  }

  /* Merge nested predictionsByRace: { round: { name: pred } } — per round,
     per person, with the locked-wins rules above. */
  function mergePredictionsByRace(a, b) {
    a = a || {};
    b = b || {};
    var rounds = {};
    Object.keys(a).forEach(function (r) { rounds[r] = true; });
    Object.keys(b).forEach(function (r) { rounds[r] = true; });
    var out = {};
    Object.keys(rounds).forEach(function (r) {
      out[r] = mergePredictions(a[r], b[r]);
    });
    return out;
  }

  /* Merge raceResultsByRace: { round: {p1,p2,p3} } — keep a complete result
     once it exists; never wiped by an incomplete/absent side. */
  function mergeResultsByRace(a, b) {
    a = a || {};
    b = b || {};
    var rounds = {};
    Object.keys(a).forEach(function (r) { rounds[r] = true; });
    Object.keys(b).forEach(function (r) { rounds[r] = true; });
    var out = {};
    Object.keys(rounds).forEach(function (r) {
      var ra = a[r], rb = b[r];
      var aok = ra && ra.p1 && ra.p2 && ra.p3;
      var bok = rb && rb.p1 && rb.p2 && rb.p3;
      if (aok && !bok) out[r] = ra;
      else if (bok && !aok) out[r] = rb;
      else if (aok && bok) out[r] = ((ra._updated || 0) >= (rb._updated || 0)) ? ra : rb;
    });
    return out;
  }

  /* ---------- Sync operations ---------- */

  /* Pull from remote, merge predictions + raceResult, save locally if changed */
  function pullAndMerge(callback) {
    if (isSyncing) return;
    if (Date.now() < pushCooldownUntil) { if (callback) callback(); return; }
    isSyncing = true;

    fetchRemote(function (err, remote) {
      isSyncing = false;
      if (err) {
        markError(err);
        if (callback) callback(err);
        return;
      }

      var localData = window.TripStorage.loadData();
      var remotePreds = remote.predictionsByRace || {};
      var remoteResults = remote.raceResultsByRace || {};

      var mergedPreds = mergePredictionsByRace(localData.predictionsByRace, remotePreds);
      var mergedResults = mergeResultsByRace(localData.raceResultsByRace, remoteResults);

      var predsChanged = hashOf(mergedPreds) !== hashOf(localData.predictionsByRace || {});
      var resultChanged = hashOf(mergedResults) !== hashOf(localData.raceResultsByRace || {});
      var changed = predsChanged || resultChanged;

      if (changed) {
        localData.predictionsByRace = mergedPreds;
        localData.raceResultsByRace = mergedResults;
        window.TripStorage.saveData(localData);
      }

      lastRemoteHash = hashOf({ p: remotePreds, r: remoteResults });
      markOk();

      if (callback) callback(null, changed);
      if (changed && onUpdateCallback) onUpdateCallback();
    });
  }

  /* Push local predictions + raceResult to the Worker. The Worker merges
     server-side and returns the canonical state, which we adopt locally. */
  function pushLocal(callback) {
    if (!syncEnabled()) { if (callback) callback(null); return; }
    pushCooldownUntil = Date.now() + 8000;

    var localData = window.TripStorage.loadData();

    saveRemote(
      { predictionsByRace: localData.predictionsByRace || {}, raceResultsByRace: localData.raceResultsByRace || {} },
      function (saveErr, merged) {
        if (saveErr) {
          pushCooldownUntil = 0;
          // Remember that local changes still need to reach the cloud;
          // retried on the next poll tick and on the 'online' event.
          syncStatus.pendingPush = true;
          markError(saveErr);
          if (callback) callback(saveErr);
          return;
        }
        // Merge the canonical server state back into CURRENT local (not the
        // snapshot we sent). This prevents an in-flight push from clobbering
        // newer local edits made while the request was on the wire.
        var fresh = window.TripStorage.loadData();
        fresh.predictionsByRace = mergePredictionsByRace(fresh.predictionsByRace, (merged && merged.predictionsByRace) || {});
        fresh.raceResultsByRace = mergeResultsByRace(fresh.raceResultsByRace, (merged && merged.raceResultsByRace) || {});
        window.TripStorage.saveData(fresh);
        pushCooldownUntil = Date.now() + 2000;
        syncStatus.pendingPush = false;
        markOk();
        if (callback) callback(null);
        if (onUpdateCallback) onUpdateCallback();
      }
    );
  }

  /* ---------- Polling ---------- */

  function startPolling(onUpdate) {
    onUpdateCallback = onUpdate || null;
    stopPolling();
    if (!syncEnabled()) return; // local-only mode
    pullAndMerge();
    pollTimer = setInterval(function () {
      // A failed push (offline submit!) takes priority over pulling —
      // otherwise a locked prediction made offline would never reach the cloud
      if (syncStatus.pendingPush) {
        pushLocal();
      } else {
        pullAndMerge();
      }
    }, POLL_INTERVAL);

    // Retry immediately when the connection returns
    window.addEventListener('online', function () {
      if (syncStatus.pendingPush) pushLocal();
      else pullAndMerge();
    });
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* ---------- Public API ---------- */
  window.TripSync = {
    startPolling: startPolling,
    stopPolling: stopPolling,
    pullAndMerge: pullAndMerge,
    pushLocal: pushLocal,
    getStatus: function () {
      return {
        enabled: syncEnabled(),
        lastOkAt: syncStatus.lastOkAt,
        lastError: syncStatus.lastError,
        pendingPush: syncStatus.pendingPush
      };
    }
  };
})();
