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
      body: JSON.stringify({ predictions: data.predictions || {}, raceResult: data.raceResult || null })
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

  /* ---------- Sync operations ---------- */

  /* Pull from remote, merge predictions + raceResult, save locally if changed */
  function pullAndMerge(callback) {
    if (isSyncing) return;
    if (Date.now() < pushCooldownUntil) { if (callback) callback(); return; }
    isSyncing = true;

    fetchRemote(function (err, remote) {
      isSyncing = false;
      if (err) {
        if (callback) callback(err);
        return;
      }

      var localData = window.TripStorage.loadData();
      var remotePreds = remote.predictions || {};
      var remoteResult = (remote.raceResult !== undefined) ? remote.raceResult : null;

      var mergedPreds = mergePredictions(localData.predictions, remotePreds);
      var predsChanged = hashOf(mergedPreds) !== hashOf(localData.predictions);
      var resultChanged = hashOf(remoteResult) !== hashOf(localData.raceResult || null);

      // Race result: take remote if remote is set and differs (global last-write-wins).
      // If local has a result but remote doesn't, keep local (it will be pushed next).
      var newResult = localData.raceResult || null;
      if (remoteResult && resultChanged) {
        newResult = remoteResult;
      }

      var changed = predsChanged || (hashOf(newResult) !== hashOf(localData.raceResult || null));

      if (changed) {
        localData.predictions = mergedPreds;
        localData.raceResult = newResult;
        window.TripStorage.saveData(localData);
      }

      lastRemoteHash = hashOf({ p: remotePreds, r: remoteResult });

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
      { predictions: localData.predictions || {}, raceResult: localData.raceResult || null },
      function (saveErr, merged) {
        if (saveErr) {
          pushCooldownUntil = 0;
          if (callback) callback(saveErr);
          return;
        }
        // Merge the canonical server state back into CURRENT local (not the
        // snapshot we sent). This prevents an in-flight push from clobbering
        // newer local edits made while the request was on the wire.
        var fresh = window.TripStorage.loadData();
        var serverPreds = (merged && merged.predictions) || {};
        fresh.predictions = mergePredictions(fresh.predictions, serverPreds);
        // Race result: prefer a complete result from either side
        var serverResult = (merged && merged.raceResult) || null;
        if (serverResult && serverResult.p1 && serverResult.p2 && serverResult.p3) {
          fresh.raceResult = serverResult;
        }
        window.TripStorage.saveData(fresh);
        pushCooldownUntil = Date.now() + 2000;
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
      pullAndMerge();
    }, POLL_INTERVAL);
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
    pushLocal: pushLocal
  };
})();
