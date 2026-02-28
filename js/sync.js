/* ===== sync.js - Cloud group sync via jsonblob.com ===== */
(function () {
  'use strict';

  var API_BASE = 'https://jsonblob.com/api/jsonBlob';
  var POLL_INTERVAL = 8000; // 8 seconds
  var pollTimer = null;
  var onUpdateCallback = null;
  var isSyncing = false;

  function getRoomId() {
    return localStorage.getItem('f1Trip_syncRoom') || null;
  }

  function setRoomId(id) {
    localStorage.setItem('f1Trip_syncRoom', id);
  }

  function isConnected() {
    return !!getRoomId();
  }

  /* Create a new room with current local group data */
  function createRoom(callback) {
    var localData = window.TripStorage.loadData();
    var payload = { group: localData.group || [], predictions: localData.predictions || {}, raceResult: localData.raceResult || null };

    fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      if (!res.ok) throw new Error('Kon geen groep aanmaken');
      var location = res.headers.get('Location') || res.headers.get('location') || '';
      var id = location.split('/').pop();
      if (!id) throw new Error('Geen room ID ontvangen');
      setRoomId(id);
      callback(null, id);
    }).catch(function (err) {
      callback(err.message || 'Fout bij aanmaken');
    });
  }

  /* Join an existing room */
  function joinRoom(id, callback) {
    fetch(API_BASE + '/' + id, {
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('Groep niet gevonden');
      return res.json();
    }).then(function (data) {
      setRoomId(id);
      // Replace local data with remote data
      var localData = window.TripStorage.loadData();
      localData.group = data.group || [];
      localData.predictions = data.predictions || {};
      localData.raceResult = data.raceResult || null;
      window.TripStorage.saveData(localData);
      callback(null, data);
    }).catch(function (err) {
      callback(err.message || 'Kon niet deelnemen');
    });
  }

  /* Fetch remote group data */
  function fetchRemote(callback) {
    var id = getRoomId();
    if (!id) return callback('Niet verbonden');

    fetch(API_BASE + '/' + id, {
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('Sync fout');
      return res.json();
    }).then(function (data) {
      callback(null, data);
    }).catch(function (err) {
      callback(err.message);
    });
  }

  /* Push data to remote */
  function pushRemote(data, callback) {
    var id = getRoomId();
    if (!id) return callback('Niet verbonden');

    fetch(API_BASE + '/' + id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      if (!res.ok) throw new Error('Push fout');
      callback(null);
    }).catch(function (err) {
      callback(err.message);
    });
  }

  /* Sync: fetch remote, update local, notify */
  function sync(callback) {
    if (isSyncing || !isConnected()) return;
    isSyncing = true;

    fetchRemote(function (err, remoteData) {
      isSyncing = false;
      if (err) {
        if (callback) callback(err);
        return;
      }

      var localData = window.TripStorage.loadData();
      var remoteGroup = remoteData.group || [];

      // Strip ticket images from comparison (they're local-only)
      var groupChanged = JSON.stringify(stripTickets(localData.group)) !== JSON.stringify(stripTickets(remoteGroup));
      var predictionsChanged = JSON.stringify(localData.predictions || {}) !== JSON.stringify(remoteData.predictions || {});
      var resultChanged = JSON.stringify(localData.raceResult || null) !== JSON.stringify(remoteData.raceResult || null);
      var changed = groupChanged || predictionsChanged || resultChanged;

      if (changed) {
        // Merge: keep ticket images from local, take everything else from remote
        localData.group = mergeWithLocalTickets(remoteGroup, localData.group);
        localData.predictions = remoteData.predictions || {};
        localData.raceResult = remoteData.raceResult || null;
        window.TripStorage.saveData(localData);
      }

      if (callback) callback(null, changed);
      if (changed && onUpdateCallback) onUpdateCallback();
    });
  }

  /* Strip ticket data for comparison (tickets are local-only) */
  function stripTickets(group) {
    return (group || []).map(function (p) {
      var copy = {};
      Object.keys(p).forEach(function (k) {
        if (k !== 'ticketImage' && k !== 'ticketType') {
          copy[k] = p[k];
        }
      });
      return copy;
    });
  }

  /* Merge remote group with local ticket images */
  function mergeWithLocalTickets(remoteGroup, localGroup) {
    return remoteGroup.map(function (remotePerson, i) {
      // Find matching local person by name or index
      var localPerson = null;
      var rName = (remotePerson.name || '').toLowerCase().trim();

      // First try to match by name
      if (rName) {
        for (var j = 0; j < localGroup.length; j++) {
          if ((localGroup[j].name || '').toLowerCase().trim() === rName) {
            localPerson = localGroup[j];
            break;
          }
        }
      }

      // Fall back to index match
      if (!localPerson && i < localGroup.length) {
        localPerson = localGroup[i];
      }

      // Keep local ticket images
      if (localPerson && localPerson.ticketImage) {
        remotePerson.ticketImage = localPerson.ticketImage;
        remotePerson.ticketType = localPerson.ticketType;
      }

      return remotePerson;
    });
  }

  /* Push local group to remote (after a local change) */
  function pushGroupChange(callback) {
    if (!isConnected()) {
      if (callback) callback();
      return;
    }

    var localData = window.TripStorage.loadData();
    // Don't push ticket images (too large for free storage)
    var cleanGroup = stripTickets(localData.group);

    pushRemote({ group: cleanGroup, predictions: localData.predictions || {}, raceResult: localData.raceResult || null }, function (err) {
      if (callback) callback(err);
    });
  }

  /* Start polling for updates */
  function startPolling(onUpdate) {
    onUpdateCallback = onUpdate;
    stopPolling();
    pollTimer = setInterval(function () {
      sync();
    }, POLL_INTERVAL);
    // Initial sync
    sync();
  }

  /* Stop polling */
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* Disconnect from room */
  function disconnect() {
    stopPolling();
    localStorage.removeItem('f1Trip_syncRoom');
    onUpdateCallback = null;
  }

  /* Get share URL for current room */
  function getShareUrl() {
    var id = getRoomId();
    if (!id) return null;
    // Use the GitHub Pages URL
    var base = window.location.origin + window.location.pathname;
    return base + '?room=' + id;
  }

  /* Check URL for room parameter (auto-join) */
  function checkUrlForRoom() {
    var params = new URLSearchParams(window.location.search);
    return params.get('room') || null;
  }

  // Expose to global scope
  window.TripSync = {
    getRoomId: getRoomId,
    isConnected: isConnected,
    createRoom: createRoom,
    joinRoom: joinRoom,
    sync: sync,
    pushGroupChange: pushGroupChange,
    startPolling: startPolling,
    stopPolling: stopPolling,
    disconnect: disconnect,
    getShareUrl: getShareUrl,
    checkUrlForRoom: checkUrlForRoom
  };
})();
