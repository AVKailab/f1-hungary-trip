/* ===== storage.js - localStorage abstraction ===== */
(function () {
  'use strict';

  var STORAGE_KEY = 'f1HungaryTrip';

  var DEFAULT_DATA = {
    hotel: {
      name: 'Rooftop City Residence',
      address: 'Garay t\u00E9r 20, 1076 Budapest, Hongarije',
      checkIn: '2026-07-23',
      checkOut: '2026-07-27',
      lat: 47.4975,
      lng: 19.0775,
      notes: ''
    },
    group: [],
    dining: {
      breakfastPlans: {},
      dinnerPlans: {},
      savedRestaurants: []
    },
    transportNotes: '',
    tickets: [],  // { name: '', dataUrl: '', type: '' }
    predictions: {},
    raceResult: null
  };

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadData() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        var parsed = JSON.parse(stored);
        // Merge with defaults to ensure all keys exist
        var merged = deepClone(DEFAULT_DATA);
        if (parsed.hotel) {
          Object.keys(parsed.hotel).forEach(function (k) {
            merged.hotel[k] = parsed.hotel[k];
          });
        }
        if (parsed.group) merged.group = parsed.group;
        if (parsed.dining) {
          if (parsed.dining.breakfastPlans) merged.dining.breakfastPlans = parsed.dining.breakfastPlans;
          if (parsed.dining.dinnerPlans) merged.dining.dinnerPlans = parsed.dining.dinnerPlans;
          if (parsed.dining.savedRestaurants) merged.dining.savedRestaurants = parsed.dining.savedRestaurants;
        }
        if (parsed.transportNotes !== undefined) merged.transportNotes = parsed.transportNotes;
        if (parsed.tickets) merged.tickets = parsed.tickets;
        if (parsed.predictions) merged.predictions = parsed.predictions;
        if (parsed.raceResult !== undefined) merged.raceResult = parsed.raceResult;
        return merged;
      }
    } catch (e) {
      console.warn('Could not load data from localStorage:', e);
    }
    return deepClone(DEFAULT_DATA);
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Could not save data to localStorage:', e);
    }
  }

  function resetData() {
    localStorage.removeItem(STORAGE_KEY);
    return deepClone(DEFAULT_DATA);
  }

  // Expose to global scope
  window.TripStorage = {
    loadData: loadData,
    saveData: saveData,
    resetData: resetData
  };
})();
