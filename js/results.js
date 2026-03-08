/* ===== results.js - F1 2026 Race Results via Jolpica API ===== */
(function () {
  'use strict';

  var API_BASE = 'https://api.jolpi.ca/ergast/f1/2026';
  var CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  /* Country flag emoji lookup */
  var FLAGS = {
    'Australia': '\uD83C\uDDE6\uD83C\uDDFA',
    'China': '\uD83C\uDDE8\uD83C\uDDF3',
    'Japan': '\uD83C\uDDEF\uD83C\uDDF5',
    'Bahrain': '\uD83C\uDDE7\uD83C\uDDED',
    'Saudi Arabia': '\uD83C\uDDF8\uD83C\uDDE6',
    'USA': '\uD83C\uDDFA\uD83C\uDDF8',
    'Canada': '\uD83C\uDDE8\uD83C\uDDE6',
    'Monaco': '\uD83C\uDDF2\uD83C\uDDE8',
    'Spain': '\uD83C\uDDEA\uD83C\uDDF8',
    'Austria': '\uD83C\uDDE6\uD83C\uDDF9',
    'UK': '\uD83C\uDDEC\uD83C\uDDE7',
    'Belgium': '\uD83C\uDDE7\uD83C\uDDEA',
    'Hungary': '\uD83C\uDDED\uD83C\uDDFA',
    'Netherlands': '\uD83C\uDDF3\uD83C\uDDF1',
    'Italy': '\uD83C\uDDEE\uD83C\uDDF9',
    'Azerbaijan': '\uD83C\uDDE6\uD83C\uDDFF',
    'Singapore': '\uD83C\uDDF8\uD83C\uDDEC',
    'Mexico': '\uD83C\uDDF2\uD83C\uDDFD',
    'Brazil': '\uD83C\uDDE7\uD83C\uDDF7',
    'Qatar': '\uD83C\uDDF6\uD83C\uDDE6',
    'UAE': '\uD83C\uDDE6\uD83C\uDDEA'
  };

  /* Team color mapping */
  var TEAM_COLORS = {
    'mercedes': '#27F4D2',
    'ferrari': '#E80020',
    'mclaren': '#FF8000',
    'red_bull': '#3671C6',
    'aston_martin': '#229971',
    'alpine': '#0093CC',
    'williams': '#64C4FF',
    'rb': '#6692FF',
    'haas': '#B6BABD',
    'audi': '#FF0000',
    'cadillac': '#FFD700'
  };

  /* ---------- Cache helpers ---------- */
  function cacheGet(key) {
    try {
      var raw = sessionStorage.getItem('f1_' + key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (Date.now() - obj.ts > CACHE_TTL) {
        sessionStorage.removeItem('f1_' + key);
        return null;
      }
      return obj.data;
    } catch (e) { return null; }
  }

  function cacheSet(key, data) {
    try {
      sessionStorage.setItem('f1_' + key, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) { /* quota exceeded, ignore */ }
  }

  /* ---------- API fetch ---------- */
  function apiFetch(path, callback) {
    var cacheKey = path.replace(/[^a-z0-9]/gi, '_');
    var cached = cacheGet(cacheKey);
    if (cached) return callback(null, cached);

    fetch(API_BASE + path)
      .then(function (res) {
        if (!res.ok) throw new Error('API fout (' + res.status + ')');
        return res.json();
      })
      .then(function (data) {
        cacheSet(cacheKey, data);
        callback(null, data);
      })
      .catch(function (err) {
        callback(err.message || 'Kan data niet ophalen');
      });
  }

  /* ---------- Public API ---------- */

  /* Get full 2026 race calendar */
  function getCalendar(callback) {
    apiFetch('.json', function (err, data) {
      if (err) return callback(err);
      var races = data && data.MRData && data.MRData.RaceTable && data.MRData.RaceTable.Races;
      callback(null, races || []);
    });
  }

  /* Get race results for all completed races */
  function getResults(callback) {
    apiFetch('/results.json?limit=1000', function (err, data) {
      if (err) return callback(err);
      var races = data && data.MRData && data.MRData.RaceTable && data.MRData.RaceTable.Races;
      callback(null, races || []);
    });
  }

  /* Get current driver standings */
  function getStandings(callback) {
    apiFetch('/driverStandings.json', function (err, data) {
      if (err) return callback(err);
      var lists = data && data.MRData && data.MRData.StandingsTable && data.MRData.StandingsTable.StandingsLists;
      var standings = lists && lists[0] && lists[0].DriverStandings;
      callback(null, standings || []);
    });
  }

  /* Load everything at once */
  function loadAll(callback) {
    var result = { calendar: null, results: null, standings: null, errors: [] };
    var pending = 3;

    function done() {
      pending--;
      if (pending === 0) callback(result);
    }

    getCalendar(function (err, data) {
      if (err) result.errors.push(err); else result.calendar = data;
      done();
    });

    getResults(function (err, data) {
      if (err) result.errors.push(err); else result.results = data;
      done();
    });

    getStandings(function (err, data) {
      if (err) result.errors.push(err); else result.standings = data;
      done();
    });
  }

  function getFlag(country) {
    return FLAGS[country] || '\uD83C\uDFF3\uFE0F';
  }

  function getTeamColor(constructorId) {
    return TEAM_COLORS[constructorId] || '#888';
  }

  /* Expose */
  window.F1Results = {
    loadAll: loadAll,
    getCalendar: getCalendar,
    getResults: getResults,
    getStandings: getStandings,
    getFlag: getFlag,
    getTeamColor: getTeamColor
  };
})();
