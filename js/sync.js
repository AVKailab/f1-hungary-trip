/* ===== sync.js - Shared predictions & race result sync ===== */
/* Everybody shares the SAME jsonblob. No room codes. Predictions are
   keyed per person name, so they merge cleanly across devices. */
(function () {
  'use strict';

  /* ---------- Configuration ---------- */
  var MASTER_BLOB_ID = '019d9a9e-925a-7849-bdc4-e2a1868b7991';
  var JSONBLOB_BASE = 'https://jsonblob.com/api/jsonBlob';
  var CORS_PROXY = 'https://corsproxy.io/?';
  var POLL_INTERVAL = 10000; // 10 seconds

  function blobUrl() {
    return CORS_PROXY + encodeURIComponent(JSONBLOB_BASE + '/' + MASTER_BLOB_ID);
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

  function fetchRemote(callback) {
    fetch(blobUrl(), {
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      // 404 = blob expired or never created; treat as empty so app keeps working
      if (res.status === 404) return { predictions: {}, raceResult: null };
      if (!res.ok) throw new Error('Sync error (' + res.status + ')');
      return res.json();
    }).then(function (data) {
      callback(null, data || {});
    }).catch(function (err) {
      callback(err.message || 'Kon data niet ophalen');
    });
  }

  function saveRemote(data, callback) {
    fetch(blobUrl(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) throw new Error('Opslaan mislukt (' + res.status + ')');
      callback(null);
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

  /* Push local predictions + raceResult to remote (merge with remote first to
     avoid clobbering other people's predictions) */
  function pushLocal(callback) {
    pushCooldownUntil = Date.now() + 8000;

    fetchRemote(function (err, remote) {
      if (err) {
        pushCooldownUntil = 0;
        if (callback) callback(err);
        return;
      }

      var localData = window.TripStorage.loadData();
      var mergedPreds = mergePredictions(remote.predictions || {}, localData.predictions || {});

      // Race result: local wins on push (user just clicked Save)
      var newResult = (localData.raceResult !== undefined) ? localData.raceResult : (remote.raceResult || null);

      remote.predictions = mergedPreds;
      remote.raceResult = newResult;
      remote._updated = Date.now();

      saveRemote(remote, function (saveErr) {
        if (saveErr) {
          pushCooldownUntil = 0;
          if (callback) callback(saveErr);
          return;
        }
        // Also update local with merged predictions so we're in sync
        localData.predictions = mergedPreds;
        localData.raceResult = newResult;
        window.TripStorage.saveData(localData);
        pushCooldownUntil = Date.now() + 2000;
        if (callback) callback(null);
      });
    });
  }

  /* ---------- Polling ---------- */

  function startPolling(onUpdate) {
    onUpdateCallback = onUpdate || null;
    stopPolling();
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
