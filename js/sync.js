/* ===== sync.js - Cloud group sync via jsonblob.com ===== */
(function () {
  'use strict';

  /* ---------- Configuration ---------- */
  var MASTER_BLOB_ID = '019ccd32-605a-7845-a597-fc4bd0ba9033';
  var JSONBLOB_BASE = 'https://jsonblob.com/api/jsonBlob';
  var CORS_PROXY = 'https://corsproxy.io/?';
  var POLL_INTERVAL = 8000; // 8 seconds

  function masterUrl() {
    return CORS_PROXY + encodeURIComponent(JSONBLOB_BASE + '/' + MASTER_BLOB_ID);
  }

  /* ---------- State ---------- */
  var pollTimer = null;
  var onUpdateCallback = null;
  var isSyncing = false;
  var pushCooldownUntil = 0;

  /* ---------- Room ID helpers ---------- */
  function getRoomId() {
    return localStorage.getItem('f1Trip_syncRoom') || null;
  }

  function setRoomId(code) {
    localStorage.setItem('f1Trip_syncRoom', code);
  }

  function isConnected() {
    return !!getRoomId();
  }

  /* Generate a short, easy-to-share room code (6 chars) */
  function generateRoomCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
    var code = '';
    for (var i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /* ---------- Master blob helpers ---------- */

  /* Fetch the entire master blob */
  function fetchMaster(callback) {
    fetch(masterUrl(), {
      headers: { 'Accept': 'application/json' }
    }).then(function (res) {
      if (!res.ok) throw new Error('Sync fout (' + res.status + ')');
      return res.json();
    }).then(function (data) {
      callback(null, data);
    }).catch(function (err) {
      callback(err.message || 'Kon data niet ophalen');
    });
  }

  /* Save the entire master blob */
  function saveMaster(data, callback) {
    fetch(masterUrl(), {
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

  /* ---------- Room operations ---------- */

  /* Create a new room with current local data */
  function createRoom(callback) {
    fetchMaster(function (err, master) {
      if (err) return callback('Kon groep niet aanmaken: ' + err);

      var rooms = master.rooms || {};
      var code = generateRoomCode();

      // Ensure unique code (extremely unlikely collision, but just in case)
      var attempts = 0;
      while (rooms[code] && attempts < 10) {
        code = generateRoomCode();
        attempts++;
      }

      var localData = window.TripStorage.loadData();
      rooms[code] = {
        group: stripTickets(localData.group || []),
        predictions: localData.predictions || {},
        raceResult: localData.raceResult || null,
        created: Date.now()
      };
      master.rooms = rooms;

      saveMaster(master, function (saveErr) {
        if (saveErr) return callback('Kon groep niet delen: ' + saveErr);
        setRoomId(code);
        callback(null, code);
      });
    });
  }

  /* Join an existing room */
  function joinRoom(code, callback) {
    code = (code || '').toUpperCase().trim();
    if (!code) return callback('Geen code opgegeven');

    fetchMaster(function (err, master) {
      if (err) return callback('Kon niet deelnemen: ' + err);

      var rooms = master.rooms || {};
      var roomData = rooms[code];
      if (!roomData) return callback('Groep niet gevonden (code: ' + code + ')');

      setRoomId(code);

      // Replace local data with remote data
      var localData = window.TripStorage.loadData();
      localData.group = roomData.group || [];
      localData.predictions = roomData.predictions || {};
      localData.raceResult = roomData.raceResult || null;
      window.TripStorage.saveData(localData);

      callback(null, roomData);
    });
  }

  /* ---------- Sync & Push ---------- */

  /* Sync: fetch remote room data, merge with local */
  function sync(callback) {
    if (isSyncing || !isConnected()) return;
    if (Date.now() < pushCooldownUntil) return;
    isSyncing = true;

    var code = getRoomId();

    fetchMaster(function (err, master) {
      isSyncing = false;
      if (err) {
        if (callback) callback(err);
        return;
      }

      var rooms = master.rooms || {};
      var roomData = rooms[code];
      if (!roomData) {
        if (callback) callback('Groep niet meer beschikbaar');
        return;
      }

      var localData = window.TripStorage.loadData();
      var remoteGroup = roomData.group || [];

      var groupChanged = JSON.stringify(stripTickets(localData.group)) !== JSON.stringify(stripTickets(remoteGroup));
      var predictionsChanged = JSON.stringify(localData.predictions || {}) !== JSON.stringify(roomData.predictions || {});
      var resultChanged = JSON.stringify(localData.raceResult || null) !== JSON.stringify(roomData.raceResult || null);
      var changed = groupChanged || predictionsChanged || resultChanged;

      if (changed) {
        localData.group = mergeWithLocalTickets(remoteGroup, localData.group);
        localData.predictions = roomData.predictions || {};
        localData.raceResult = roomData.raceResult || null;
        window.TripStorage.saveData(localData);
      }

      if (callback) callback(null, changed);
      if (changed && onUpdateCallback) onUpdateCallback();
    });
  }

  /* Push local data to remote room */
  function pushGroupChange(callback) {
    if (!isConnected()) {
      if (callback) callback();
      return;
    }

    pushCooldownUntil = Date.now() + 10000;
    var code = getRoomId();

    fetchMaster(function (err, master) {
      if (err) {
        pushCooldownUntil = 0;
        if (callback) callback(err);
        return;
      }

      var rooms = master.rooms || {};
      var localData = window.TripStorage.loadData();

      rooms[code] = {
        group: stripTickets(localData.group || []),
        predictions: localData.predictions || {},
        raceResult: localData.raceResult || null,
        updated: Date.now()
      };
      // Preserve created timestamp if it existed
      if (master.rooms && master.rooms[code] && master.rooms[code].created) {
        rooms[code].created = master.rooms[code].created;
      }
      master.rooms = rooms;

      saveMaster(master, function (saveErr) {
        if (!saveErr) {
          pushCooldownUntil = Date.now() + 2000;
        } else {
          pushCooldownUntil = 0;
        }
        if (callback) callback(saveErr);
      });
    });
  }

  /* ---------- Ticket helpers ---------- */

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

  function mergeWithLocalTickets(remoteGroup, localGroup) {
    return remoteGroup.map(function (remotePerson, i) {
      var localPerson = null;
      var rName = (remotePerson.name || '').toLowerCase().trim();

      if (rName) {
        for (var j = 0; j < localGroup.length; j++) {
          if ((localGroup[j].name || '').toLowerCase().trim() === rName) {
            localPerson = localGroup[j];
            break;
          }
        }
      }

      if (!localPerson && i < localGroup.length) {
        localPerson = localGroup[i];
      }

      if (localPerson && localPerson.ticketImage) {
        remotePerson.ticketImage = localPerson.ticketImage;
        remotePerson.ticketType = localPerson.ticketType;
      }

      return remotePerson;
    });
  }

  /* ---------- Polling ---------- */

  function startPolling(onUpdate) {
    onUpdateCallback = onUpdate;
    stopPolling();
    pollTimer = setInterval(function () {
      sync();
    }, POLL_INTERVAL);
    sync();
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /* ---------- Disconnect ---------- */

  function disconnect() {
    stopPolling();
    localStorage.removeItem('f1Trip_syncRoom');
    onUpdateCallback = null;
  }

  /* ---------- Share URL ---------- */

  function getShareUrl() {
    var code = getRoomId();
    if (!code) return null;
    var base = window.location.origin + window.location.pathname;
    return base + '?room=' + code;
  }

  function checkUrlForRoom() {
    var params = new URLSearchParams(window.location.search);
    return params.get('room') || null;
  }

  /* ---------- Public API ---------- */
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
