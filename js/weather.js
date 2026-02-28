/* ===== weather.js - Weather forecast via Open-Meteo ===== */
(function () {
  'use strict';

  var API_URL = 'https://api.open-meteo.com/v1/forecast';
  var BUDAPEST_LAT = 47.50;
  var BUDAPEST_LNG = 19.04;
  var CACHE_KEY = 'f1Trip_weather';
  var CACHE_DURATION = 3600000; // 1 hour

  var WEATHER_CODES = {
    0: { icon: '\u2600\uFE0F', desc: 'Zonnig' },
    1: { icon: '\uD83C\uDF24\uFE0F', desc: 'Overwegend zonnig' },
    2: { icon: '\u26C5', desc: 'Deels bewolkt' },
    3: { icon: '\u2601\uFE0F', desc: 'Betrokken' },
    45: { icon: '\uD83C\uDF2B\uFE0F', desc: 'Mistig' },
    48: { icon: '\uD83C\uDF2B\uFE0F', desc: 'Aanvriezende mist' },
    51: { icon: '\uD83C\uDF26\uFE0F', desc: 'Lichte motregen' },
    53: { icon: '\uD83C\uDF26\uFE0F', desc: 'Motregen' },
    55: { icon: '\uD83C\uDF27\uFE0F', desc: 'Zware motregen' },
    61: { icon: '\uD83C\uDF27\uFE0F', desc: 'Lichte regen' },
    63: { icon: '\uD83C\uDF27\uFE0F', desc: 'Regen' },
    65: { icon: '\uD83C\uDF27\uFE0F', desc: 'Zware regen' },
    80: { icon: '\uD83C\uDF26\uFE0F', desc: 'Lichte buien' },
    81: { icon: '\uD83C\uDF27\uFE0F', desc: 'Regenbuien' },
    82: { icon: '\u26C8\uFE0F', desc: 'Zware buien' },
    95: { icon: '\u26C8\uFE0F', desc: 'Onweer' },
    96: { icon: '\u26C8\uFE0F', desc: 'Onweer met hagel' },
    99: { icon: '\u26C8\uFE0F', desc: 'Zwaar onweer' }
  };

  var TYPICAL_JULY = [
    { date: '2026-07-23', tempMax: 30, tempMin: 18, precipProb: 20, icon: '\u2600\uFE0F', desc: 'Warm zomerweer' },
    { date: '2026-07-24', tempMax: 31, tempMin: 19, precipProb: 25, icon: '\uD83C\uDF24\uFE0F', desc: 'Overwegend zonnig' },
    { date: '2026-07-25', tempMax: 30, tempMin: 18, precipProb: 30, icon: '\u26C5', desc: 'Deels bewolkt' },
    { date: '2026-07-26', tempMax: 31, tempMin: 19, precipProb: 20, icon: '\u2600\uFE0F', desc: 'Zonnig' },
    { date: '2026-07-27', tempMax: 29, tempMin: 17, precipProb: 25, icon: '\uD83C\uDF24\uFE0F', desc: 'Overwegend zonnig' }
  ];

  function getWeatherInfo(code) {
    return WEATHER_CODES[code] || { icon: '\u2753', desc: 'Onbekend' };
  }

  function fetchWeather(callback) {
    // Check cache
    try {
      var cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return callback(null, cached.data);
      }
    } catch (e) {}

    var url = API_URL +
      '?latitude=' + BUDAPEST_LAT +
      '&longitude=' + BUDAPEST_LNG +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code' +
      '&timezone=Europe%2FBudapest' +
      '&start_date=2026-07-23' +
      '&end_date=2026-07-27';

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('Weather API error');
        return res.json();
      })
      .then(function (data) {
        if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
          throw new Error('No forecast data');
        }

        var days = [];
        for (var i = 0; i < data.daily.time.length; i++) {
          var info = getWeatherInfo(data.daily.weather_code[i]);
          days.push({
            date: data.daily.time[i],
            tempMax: Math.round(data.daily.temperature_2m_max[i]),
            tempMin: Math.round(data.daily.temperature_2m_min[i]),
            precipProb: data.daily.precipitation_probability_max[i] || 0,
            icon: info.icon,
            desc: info.desc
          });
        }

        var result = { days: days, isReal: true };
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data: result }));
        } catch (e) {}

        callback(null, result);
      })
      .catch(function () {
        // Fallback to typical July weather
        callback(null, { days: TYPICAL_JULY, isReal: false });
      });
  }

  window.TripWeather = {
    fetchWeather: fetchWeather
  };
})();
