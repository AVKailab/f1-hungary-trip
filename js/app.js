/* ===== app.js - Core application logic ===== */
(function () {
  'use strict';

  var appData = null;
  var countdownInterval = null;
  var mapInitialized = false;
  var activeEmojiPicker = null;

  /* ---------- Initialization ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    appData = window.TripStorage.loadData();
    initTabNavigation();
    renderActiveTab();
    startCountdownUpdates();

    // Start cloud sync for predictions + raceResult so all 4 friends see each other's input
    if (window.TripSync && typeof window.TripSync.startPolling === 'function') {
      window.TripSync.startPolling(function () {
        // Remote update arrived — re-render so new predictions/result show up
        renderActiveTab();
      });
    }

    // Register service worker for PWA offline support (production only — skip localhost)
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (err) {
          console.warn('Service worker registration failed:', err);
        });
      });
    }
  });

  /* ---------- Tab Navigation ---------- */
  function initTabNavigation() {
    var nav = document.querySelector('.tab-nav');
    nav.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tab]');
      if (!btn) return;

      var tabId = btn.dataset.tab;

      // Deactivate all
      document.querySelectorAll('.tab-content').forEach(function (s) { s.classList.remove('active'); });
      document.querySelectorAll('.tab-nav-item').forEach(function (n) {
        n.classList.remove('active');
        n.setAttribute('aria-selected', 'false');
      });

      // Activate target
      var target = document.getElementById(tabId);
      if (target) target.classList.add('active');
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      renderActiveTab();

      // Map needs special handling
      if (tabId === 'tab-map') {
        if (!mapInitialized) {
          window.TripMap.initMap();
          mapInitialized = true;
        } else {
          window.TripMap.refreshMap();
        }
      }
    });
  }

  function getActiveTab() {
    var active = document.querySelector('.tab-content.active');
    return active ? active.id : 'tab-dashboard';
  }

  function renderActiveTab() {
    var tab = getActiveTab();
    appData = window.TripStorage.loadData();

    switch (tab) {
      case 'tab-dashboard': renderDashboard(); break;
      case 'tab-schedule': renderSchedule(); break;
      case 'tab-roadtrip': renderRoadtrip(); break;
      case 'tab-results': renderResults(); break;
      case 'tab-circuit': renderCircuit(); break;
      case 'tab-group': renderGroup(); break;
    }
  }

  /* ---------- Countdown Updates ---------- */
  function startCountdownUpdates() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(function () {
      updateDashboardCountdowns();
      updateScheduleCountdowns();
      updateRoadtripCountdowns();
    }, 1000);
  }

  function updateDashboardCountdowns() {
    if (getActiveTab() !== 'tab-dashboard') return;

    // Main countdown
    var raceSession = window.TripData.RACE_SESSIONS[4]; // Race
    var mainEl = document.getElementById('main-countdown');
    if (mainEl) {
      mainEl.innerHTML = window.TripCountdown.renderCountdownHTML(raceSession.date, 'large');
    }

    // Next up countdown
    var next = window.TripCountdown.getNextSession();
    var nextCountdownEl = document.getElementById('next-up-countdown');
    if (nextCountdownEl && next) {
      nextCountdownEl.innerHTML = window.TripCountdown.renderCountdownHTML(next.date, 'mini');
    }
  }

  function updateScheduleCountdowns() {
    if (getActiveTab() !== 'tab-schedule') return;

    window.TripData.RACE_SESSIONS.forEach(function (session) {
      var statusEl = document.getElementById('status-' + session.id);
      var countdownEl = document.getElementById('countdown-' + session.id);

      var status = window.TripCountdown.getSessionStatus(session);

      if (statusEl) {
        statusEl.className = 'session-badge ' + status;
        var labels = { upcoming: 'Binnenkort', live: 'LIVE', completed: 'Klaar' };
        statusEl.textContent = labels[status] || status;
      }

      if (countdownEl) {
        if (status === 'upcoming') {
          countdownEl.textContent = window.TripCountdown.formatMiniCountdown(session.date);
          countdownEl.style.display = '';
        } else {
          countdownEl.style.display = 'none';
        }
      }

      // Update status dot
      var dotEl = document.getElementById('dot-' + session.id);
      if (dotEl) {
        dotEl.className = 'session-status-dot ' + status;
      }
    });
  }

  function updateRoadtripCountdowns() {
    if (getActiveTab() !== 'tab-roadtrip') return;

    var sessions = window.TripData.RACE_SESSIONS;
    var buffers = window.TripData.DEPARTURE_BUFFERS;

    sessions.forEach(function (session) {
      var buffer = buffers[session.id] || 90;
      var sessionStart = new Date(session.date).getTime();
      var departureTime = new Date(sessionStart - buffer * 60000);

      var countdownEl = document.getElementById('departure-countdown-' + session.id);
      if (!countdownEl) return;

      var now = Date.now();
      if (now >= sessionStart) {
        countdownEl.innerHTML = '<span class="text-muted">Afgelopen</span>';
      } else if (now >= departureTime.getTime()) {
        countdownEl.innerHTML = '<span style="color:var(--f1-red);font-weight:700">Nu vertrekken!</span>';
      } else {
        countdownEl.innerHTML = window.TripCountdown.formatMiniCountdown(departureTime.toISOString());
      }
    });
  }

  /* ---------- Dashboard ---------- */
  function renderDashboard() {
    var container = document.getElementById('dashboard-content');
    var raceSession = window.TripData.RACE_SESSIONS[4];
    var next = window.TripCountdown.getNextSession();

    var html = '';

    // Main countdown
    html += '<div class="text-center">';
    html += '<div class="countdown-label">Countdown naar de Race</div>';
    html += '<div id="main-countdown">';
    html += window.TripCountdown.renderCountdownHTML(raceSession.date, 'large');
    html += '</div>';
    html += '</div>';

    // Next up
    if (next) {
      var status = window.TripCountdown.getSessionStatus(next);
      html += '<div class="next-up-card">';
      html += '<div class="next-up-label">' + (status === 'live' ? '\uD83D\uDD34 NU LIVE' : 'Volgende sessie') + '</div>';
      html += '<div class="next-up-name">' + next.name + '</div>';
      html += '<div class="next-up-time">' + next.day + ' \u2022 ' + window.TripCountdown.formatSessionTime(next) + '</div>';
      if (status !== 'live') {
        html += '<div id="next-up-countdown">';
        html += window.TripCountdown.renderCountdownHTML(next.date, 'mini');
        html += '</div>';
      }
      html += '</div>';
    } else {
      html += '<div class="race-done-message">\uD83C\uDFC6 Race weekend afgelopen!</div>';
    }

    // Quick cards
    var car = window.TripData.CAR_INFO;
    html += '<div class="quick-cards">';
    html += '<div class="quick-card">';
    html += '<div class="quick-card-icon">\uD83C\uDFE8</div>';
    html += '<div class="quick-card-value">' + (appData.hotel.name || 'Niet ingesteld') + '</div>';
    html += '<div class="quick-card-label">Hotel</div>';
    html += '</div>';
    html += '<div class="quick-card">';
    html += '<div class="quick-card-icon">\uD83D\uDE97</div>';
    html += '<div class="quick-card-value">' + car.model + '</div>';
    html += '<div class="quick-card-label">' + car.range + ' km range</div>';
    html += '</div>';
    html += '<div class="quick-card">';
    html += '<div class="quick-card-icon">\uD83D\uDC65</div>';
    html += '<div class="quick-card-value">' + (appData.group.length || 0) + ' personen</div>';
    html += '<div class="quick-card-label">Groep</div>';
    html += '</div>';
    html += '</div>';

    // Tickets card
    var tickets = window.TripData.TICKETS;
    html += '<div class="card mt-md">';
    html += '<div class="card-header"><span class="card-title">\uD83C\uDFDF\uFE0F Onze Zitplaatsen</span></div>';
    html += '<div style="margin-top:8px">';
    html += '<div style="font-size:15px;font-weight:700;color:var(--f1-red)">' + tickets.tribune + '</div>';
    html += '<div style="display:flex;gap:16px;margin-top:8px;font-size:13px;color:var(--text-secondary)">';
    html += '<span><strong>Sector:</strong> ' + tickets.sector + '</span>';
    html += '<span><strong>Rij:</strong> ' + tickets.rij + '</span>';
    html += '</div>';
    html += '<div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">';
    tickets.stoelen.forEach(function (stoel) {
      html += '<div style="background:var(--bg-tertiary);border:1px solid var(--f1-red);border-radius:6px;padding:6px 14px;text-align:center">';
      html += '<div style="font-family:var(--font-mono);font-size:18px;font-weight:700">' + stoel + '</div>';
      html += '<div style="font-size:9px;color:var(--text-muted);text-transform:uppercase">Stoel</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Weather card
    html += '<div class="card mt-md">';
    html += '<div class="card-header"><span class="card-title">\uD83C\uDF24\uFE0F Weer Budapest</span></div>';
    html += '<div id="weather-content">';
    html += '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:13px">Weer laden...</div>';
    html += '</div>';
    html += '</div>';

    // Prediction game — count filled-in predictions for a status bar
    var predictions = appData.predictions || {};
    var filledCount = 0;
    appData.group.forEach(function (p) {
      var pred = predictions[p.name];
      if (pred && pred.p1 && pred.p2 && pred.p3) filledCount++;
    });
    var totalPeople = appData.group.length;
    var statusLabel = '\uD83C\uDFC6 Race Voorspelling &nbsp;<span style="font-size:11px;color:var(--text-muted);font-weight:600">' + filledCount + '/' + totalPeople + ' ingevuld</span>';

    html += renderAccordion('predictions', statusLabel, renderPredictionContent(), true);

    container.innerHTML = html;
    loadWeatherCard();
  }

  /* ---------- Weather ---------- */
  function loadWeatherCard() {
    window.TripWeather.fetchWeather(function (err, data) {
      var el = document.getElementById('weather-content');
      if (!el) return;

      var shortDays = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
      var sessionDays = {
        '2026-07-24': 'VT1 \u2022 VT2',
        '2026-07-25': 'VT3 \u2022 QUAL',
        '2026-07-26': 'RACE'
      };

      var html = '<div class="weather-days">';

      data.days.forEach(function (day) {
        var d = new Date(day.date + 'T12:00:00');
        var dayName = shortDays[d.getDay()];
        var dayNum = d.getDate();
        var isRaceDay = sessionDays[day.date];

        html += '<div class="weather-day' + (day.date === '2026-07-26' ? ' weather-day--race' : '') + '">';
        html += '<div class="weather-day-name">' + dayName + '</div>';
        html += '<div class="weather-day-date">' + dayNum + ' jul</div>';
        html += '<div class="weather-day-icon">' + day.icon + '</div>';
        html += '<div class="weather-day-temp">' + day.tempMax + '\u00B0</div>';
        html += '<div class="weather-day-temp-min">' + day.tempMin + '\u00B0</div>';
        html += '<div class="weather-day-rain">\uD83D\uDCA7 ' + day.precipProb + '%</div>';
        if (isRaceDay) {
          html += '<div class="weather-day-session">' + isRaceDay + '</div>';
        }
        html += '</div>';
      });

      html += '</div>';

      if (!data.isReal) {
        html += '<div class="weather-note">Typisch juli weer \u2022 Echte voorspelling dichter bij datum</div>';
      }

      el.innerHTML = html;
    });
  }

  /* ---------- Prediction Helpers ---------- */
  function calculateScore(prediction, result) {
    if (!prediction || !result) return 0;
    var score = 0;
    var positions = ['p1', 'p2', 'p3'];
    var points = window.TripData.PREDICTION_SCORING.exact;
    var wrongPosPoints = window.TripData.PREDICTION_SCORING.wrongPos;

    positions.forEach(function (pos, i) {
      var predicted = prediction[pos];
      if (!predicted) return;

      if (predicted === result[pos]) {
        score += points[i];
      } else if (predicted === result.p1 || predicted === result.p2 || predicted === result.p3) {
        score += wrongPosPoints;
      }
    });

    return score;
  }

  /* ---------- Schedule ---------- */
  function renderSchedule() {
    var container = document.getElementById('schedule-content');
    var sessions = window.TripData.RACE_SESSIONS;
    var activities = window.TripData.THURSDAY_ACTIVITIES || [];

    var html = '';
    html += '<div class="timezone-note">\u23F0 Alle tijden in CEST (UTC+2) \u2014 Lokale tijd Budapest</div>';

    // Donderdag sightseeing (vóór F1 sessies)
    if (activities.length > 0) {
      html += '<div class="day-group">';
      html += '<div class="day-header">Donderdag \u2014 Sightseeing Budapest</div>';
      activities.forEach(function (a) {
        html += '<div class="session-card">';
        html += '<div class="session-status-dot upcoming"></div>';
        html += '<div class="session-info">';
        html += '<div class="session-name">' + a.icon + ' ' + a.title + '</div>';
        html += '<div class="session-time">' + a.time + ' \u2013 ' + a.endTime + '</div>';
        html += '<div style="font-size:12px;color:var(--text-secondary);margin-top:4px;line-height:1.4">' + a.description + '</div>';
        html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;line-height:1.4">\uD83D\uDCA1 ' + a.tip + '</div>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    var currentDay = '';
    sessions.forEach(function (session) {
      if (session.day !== currentDay) {
        if (currentDay) html += '</div>';
        currentDay = session.day;
        html += '<div class="day-group">';
        html += '<div class="day-header">' + session.day + '</div>';
      }

      var status = window.TripCountdown.getSessionStatus(session);

      html += '<div class="session-card">';
      html += '<div class="session-status-dot ' + status + '" id="dot-' + session.id + '"></div>';
      html += '<div class="session-info">';
      html += '<div class="session-name">' + session.name + '</div>';
      html += '<div class="session-time">' + window.TripCountdown.formatSessionTime(session) + '</div>';
      if (status === 'upcoming') {
        html += '<div class="session-countdown-mini" id="countdown-' + session.id + '">';
        html += window.TripCountdown.formatMiniCountdown(session.date);
        html += '</div>';
      }
      html += '</div>';

      var labels = { upcoming: 'Binnenkort', live: 'LIVE', completed: 'Klaar' };
      html += '<div class="session-badge ' + status + '" id="status-' + session.id + '">' + labels[status] + '</div>';
      html += '</div>';
    });

    if (currentDay) html += '</div>';

    container.innerHTML = html;
  }

  /* ---------- Roadtrip Tab (was: Reis) ---------- */
  function renderRoadtrip() {
    var container = document.getElementById('roadtrip-content');
    if (!container) return;
    var html = '';
    var car = window.TripData.CAR_INFO;
    var pad = window.TripCountdown.pad;

    html += '<div class="section-title">\uD83D\uDE97 Roadtrip</div>';
    html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--space-md)">Nederland \u2192 Budapest \u2022 ~1.300 km</p>';

    // Car info banner
    html += '<div class="car-info-banner">';
    html += '<div class="car-info-icon">\u26A1</div>';
    html += '<div class="car-info-body">';
    html += '<div class="car-info-model">' + car.model + '</div>';
    html += '<div class="car-info-meta">';
    html += '<span>\uD83D\uDD0B ' + car.range + ' km range</span>';
    html += '<span>\u2195\uFE0F Max ' + car.maxHeight + '</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    // Route summary bar
    html += '<div class="route-summary-bar">';
    html += '<span>\uD83C\uDDF3\uD83C\uDDF1 Nederland</span>';
    html += '<span class="route-arrow">\u2192</span>';
    html += '<span>\uD83C\uDDED\uD83C\uDDFA Budapest</span>';
    html += '<span class="route-duration">~10-12 uur</span>';
    html += '</div>';

    // Vertical timeline — roadtrip legs
    var legs = window.TripData.ROADTRIP_LEGS;
    html += '<div class="route-timeline">';
    legs.forEach(function (leg, index) {
      var isLast = index === legs.length - 1;
      var dotClass = 'route-step-dot';
      if (leg.type === 'charge') dotClass += ' route-step-dot--charge';
      else if (leg.type === 'overnight') dotClass += ' route-step-dot--overnight';
      else if (leg.type === 'arrive') dotClass += ' route-step-dot--arrive';

      html += '<div class="route-step' + (isLast ? ' route-step--last' : '') + '" id="route-step-' + leg.id + '">';

      // Marker column (dot + line)
      html += '<div class="route-step-marker">';
      html += '<div class="' + dotClass + '"></div>';
      if (!isLast) html += '<div class="route-step-line"></div>';
      html += '</div>';

      // Content column
      html += '<div class="route-step-content">';
      html += '<button class="route-step-header" onclick="window.App.toggleRouteStep(\'' + leg.id + '\')">';
      html += '<div class="route-step-icon">' + leg.icon + '</div>';
      html += '<div class="route-step-info">';
      html += '<div class="route-step-title">' + leg.title + '</div>';
      html += '<div class="route-step-subtitle">' + leg.subtitle + '</div>';
      html += '</div>';
      html += '<div class="route-step-meta">';
      if (leg.duration) html += '<span class="route-step-duration">' + leg.duration + '</span>';
      html += '<span class="route-step-chevron">\u25BC</span>';
      html += '</div>';
      html += '</button>';

      // Expandable details
      html += '<div class="route-step-details" id="route-details-' + leg.id + '">';
      if (leg.distance) {
        html += '<div class="route-detail-row"><strong>Afstand:</strong> ' + leg.distance + '</div>';
      }
      html += '<div class="route-detail-row">' + leg.details + '</div>';
      html += '<div class="route-step-tip">\uD83D\uDCA1 ' + leg.tips + '</div>';
      html += '</div>';

      html += '</div>'; // route-step-content
      html += '</div>'; // route-step
    });
    html += '</div>';

    // Departure calculator
    html += renderAccordion('departures', '\u23F0 Vertrektijden Circuit', renderDepartureContent(), false);

    // Travel tips accordion
    html += renderAccordion('reistips', '\uD83D\uDCA1 Reistips', renderTravelTipsContent(), false);

    container.innerHTML = html;
  }

  function renderDepartureContent() {
    var html = '';
    var pad = window.TripCountdown.pad;
    var sessions = window.TripData.RACE_SESSIONS;
    var buffers = window.TripData.DEPARTURE_BUFFERS;

    html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:var(--space-sm)">Aanbevolen vertrektijd vanaf het hotel per sessie</p>';

    sessions.forEach(function (session) {
      var buffer = buffers[session.id] || 90;
      var sessionStart = new Date(session.date);
      var departureTime = new Date(sessionStart.getTime() - buffer * 60000);
      var status = window.TripCountdown.getSessionStatus(session);

      // Format times in CEST (UTC+2)
      var depH = pad(departureTime.getUTCHours() + 2);
      var depM = pad(departureTime.getUTCMinutes());
      var sessH = pad(sessionStart.getUTCHours() + 2);
      var sessM = pad(sessionStart.getUTCMinutes());

      html += '<div class="departure-card' + (session.id === 'race' ? ' departure-card--race' : '') + '">';

      // Session info
      html += '<div class="departure-session">';
      html += '<div class="departure-session-name">' + session.shortName + '</div>';
      html += '<div class="departure-session-day">' + session.day + '</div>';
      html += '</div>';

      // Times: departure → session
      html += '<div class="departure-times">';
      html += '<div class="departure-leave">';
      html += '<div class="departure-leave-label">Vertrek</div>';
      html += '<div class="departure-leave-time">' + depH + ':' + depM + '</div>';
      html += '</div>';
      html += '<div class="departure-arrow">\u2192</div>';
      html += '<div class="departure-session-start">';
      html += '<div class="departure-start-label">Sessie</div>';
      html += '<div class="departure-start-time">' + sessH + ':' + sessM + '</div>';
      html += '</div>';
      html += '</div>';

      // Countdown
      html += '<div class="departure-countdown" id="departure-countdown-' + session.id + '">';
      if (status === 'completed') {
        html += '<span class="text-muted">Afgelopen</span>';
      } else {
        html += window.TripCountdown.formatMiniCountdown(departureTime.toISOString());
      }
      html += '</div>';

      html += '</div>';
    });

    return html;
  }

  function renderTravelTipsContent() {
    var tips = window.TripData.TRAVEL_TIPS;
    var html = '';
    tips.forEach(function (tip) {
      html += '<div class="travel-tip-card">';
      html += '<div class="travel-tip-icon">' + tip.icon + '</div>';
      html += '<div class="travel-tip-body">';
      html += '<div class="travel-tip-title">' + tip.title + '</div>';
      html += '<div class="travel-tip-text">' + tip.text + '</div>';
      html += '</div>';
      html += '</div>';
    });
    return html;
  }

  /* ---------- Circuit Tab (was: Info) ---------- */
  function renderCircuit() {
    var container = document.getElementById('circuit-content');
    var html = '';

    html += '<div class="section-title">\uD83C\uDFCE\uFE0F Circuit & Logistiek</div>';

    // Route heen (Gate 6) accordion
    html += renderAccordion('circuit-heen', '\uD83D\uDEB6 Route Heen \u2192 Gate 6', renderCircuitRouteContent(window.TripData.CIRCUIT_ROUTE_TO, 'Hotel \u2192 Hungaroring Gate 6', '~50 min'), true);

    // Route terug (Gate 3) accordion
    html += renderAccordion('circuit-terug', '\uD83D\uDD04 Route Terug \u2192 Gate 3', renderCircuitRouteContent(window.TripData.CIRCUIT_ROUTE_RETURN, 'Hungaroring Gate 3 \u2192 Hotel', '~55 min'), false);

    // Regels & veiligheid accordion
    html += renderAccordion('circuit-regels', '\u26A0\uFE0F Regels & Veiligheid', renderRulesContent(), false);

    // Hotel accordion
    html += renderAccordion('hotel', '\uD83C\uDFE8 Hotel', renderHotelContent(), false);

    container.innerHTML = html;
    attachCircuitEventListeners();
  }

  function renderCircuitRouteContent(legs, label, totalDuration) {
    var html = '';
    html += '<div class="route-summary-bar">';
    html += '<span>' + label.split(' \u2192 ')[0] + '</span>';
    html += '<span class="route-arrow">\u2192</span>';
    html += '<span>' + label.split(' \u2192 ')[1] + '</span>';
    html += '<span class="route-duration">' + totalDuration + '</span>';
    html += '</div>';

    html += '<div class="route-timeline">';
    legs.forEach(function (leg, index) {
      var isLast = index === legs.length - 1;
      html += '<div class="route-step' + (isLast ? ' route-step--last' : '') + '" id="route-step-' + leg.id + '">';

      html += '<div class="route-step-marker">';
      html += '<div class="route-step-dot"></div>';
      if (!isLast) html += '<div class="route-step-line"></div>';
      html += '</div>';

      html += '<div class="route-step-content">';
      html += '<button class="route-step-header" onclick="window.App.toggleRouteStep(\'' + leg.id + '\')">';
      html += '<div class="route-step-icon">' + leg.icon + '</div>';
      html += '<div class="route-step-info">';
      html += '<div class="route-step-title">' + leg.title + '</div>';
      html += '<div class="route-step-subtitle">' + leg.subtitle + '</div>';
      html += '</div>';
      html += '<div class="route-step-meta">';
      if (leg.duration) html += '<span class="route-step-duration">' + leg.duration + '</span>';
      html += '<span class="route-step-chevron">\u25BC</span>';
      html += '</div>';
      html += '</button>';

      html += '<div class="route-step-details" id="route-details-' + leg.id + '">';
      if (leg.distance) {
        html += '<div class="route-detail-row"><strong>Afstand:</strong> ' + leg.distance + '</div>';
      }
      html += '<div class="route-detail-row">' + leg.details + '</div>';
      html += '<div class="route-step-tip">\uD83D\uDCA1 ' + leg.tips + '</div>';
      html += '</div>';

      html += '</div>';
      html += '</div>';
    });
    html += '</div>';

    return html;
  }

  function renderRulesContent() {
    var rules = window.TripData.CIRCUIT_RULES;
    var html = '';
    rules.forEach(function (rule) {
      html += '<div class="travel-tip-card">';
      html += '<div class="travel-tip-icon">' + rule.icon + '</div>';
      html += '<div class="travel-tip-body">';
      html += '<div class="travel-tip-title">' + rule.title + '</div>';
      html += '<div class="travel-tip-text">' + rule.text + '</div>';
      html += '</div>';
      html += '</div>';
    });
    return html;
  }

  /* ---------- Accordion Helper ---------- */
  function renderAccordion(id, title, content, openByDefault) {
    return '<div class="accordion-section' + (openByDefault ? ' open' : '') + '" id="accordion-' + id + '">' +
      '<button class="accordion-header" onclick="window.App.toggleAccordion(\'' + id + '\')">' +
      '<span>' + title + '</span>' +
      '<span class="accordion-icon">\u25BC</span>' +
      '</button>' +
      '<div class="accordion-body">' + content + '</div>' +
      '</div>';
  }

  /* ---------- Tickets Content ---------- */
  function renderTicketsContent() {
    var tickets = appData.tickets || [];
    var html = '';

    // Upload button
    html += '<div style="margin-bottom:12px">';
    html += '<label class="btn-primary" style="display:inline-block;cursor:pointer;text-align:center">';
    html += '\uD83D\uDCF7 Foto of PDF uploaden';
    html += '<input type="file" id="ticket-upload" accept="image/*,.pdf" multiple style="display:none">';
    html += '</label>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:6px">Foto\'s van je tickets, e-tickets of PDF\'s</div>';
    html += '</div>';

    if (tickets.length === 0) {
      html += '<div class="text-muted" style="font-size:13px;padding:12px 0">Nog geen tickets ge\u00FCpload</div>';
    } else {
      html += '<div class="ticket-grid">';
      tickets.forEach(function (ticket, i) {
        html += '<div class="ticket-item">';
        if (ticket.type === 'pdf') {
          html += '<div class="ticket-thumb ticket-pdf" onclick="window.App.viewTicket(' + i + ')">';
          html += '<div style="font-size:28px">PDF</div>';
          html += '</div>';
        } else {
          html += '<div class="ticket-thumb" onclick="window.App.viewTicket(' + i + ')">';
          html += '<img src="' + ticket.dataUrl + '" alt="' + escapeAttr(ticket.name) + '">';
          html += '</div>';
        }
        html += '<div class="ticket-item-footer">';
        html += '<span class="ticket-name">' + escapeHTML(ticket.name) + '</span>';
        html += '<button class="btn-icon" onclick="window.App.removeTicket(' + i + ')" title="Verwijderen">\u2715</button>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    return html;
  }

  function attachTicketListeners() {
    var uploadInput = document.getElementById('ticket-upload');
    if (!uploadInput) return;

    uploadInput.addEventListener('change', function (e) {
      var files = Array.from(e.target.files);
      if (!files.length) return;

      var processed = 0;
      files.forEach(function (file) {
        if (file.size > 5 * 1024 * 1024) {
          alert(file.name + ' is te groot (max 5MB)');
          processed++;
          return;
        }

        var reader = new FileReader();
        reader.onload = function (ev) {
          var isPdf = file.type === 'application/pdf';
          var dataUrl = ev.target.result;

          if (!isPdf) {
            resizeImage(dataUrl, 1200, function (resized) {
              appData = window.TripStorage.loadData();
              if (!appData.tickets) appData.tickets = [];
              appData.tickets.push({
                name: file.name,
                dataUrl: resized,
                type: 'image'
              });
              window.TripStorage.saveData(appData);
              processed++;
              if (processed === files.length) renderCircuit();
            });
          } else {
            appData = window.TripStorage.loadData();
            if (!appData.tickets) appData.tickets = [];
            appData.tickets.push({
              name: file.name,
              dataUrl: dataUrl,
              type: 'pdf'
            });
            window.TripStorage.saveData(appData);
            processed++;
            if (processed === files.length) renderCircuit();
          }
        };
        reader.readAsDataURL(file);
      });

      uploadInput.value = '';
    });
  }

  function resizeImage(dataUrl, maxWidth, callback) {
    var img = new Image();
    img.onload = function () {
      var w = img.width;
      var h = img.height;
      if (w > maxWidth) {
        h = Math.round(h * maxWidth / w);
        w = maxWidth;
      }
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
  }

  /* ---------- Hotel Content ---------- */
  function renderHotelContent() {
    var h = appData.hotel;
    var html = '';

    html += '<div class="form-group">';
    html += '<label class="form-label">Hotel naam</label>';
    html += '<input type="text" class="form-input" id="hotel-name" value="' + escapeAttr(h.name) + '" placeholder="Bijv. Hotel Marriott Budapest">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Adres</label>';
    html += '<input type="text" class="form-input" id="hotel-address" value="' + escapeAttr(h.address) + '" placeholder="Bijv. Ap\u00E1czai Csere J\u00E1nos u. 4">';
    html += '</div>';

    html += '<div style="display:flex;gap:8px">';
    html += '<div class="form-group" style="flex:1">';
    html += '<label class="form-label">Check-in</label>';
    html += '<input type="date" class="form-input" id="hotel-checkin" value="' + h.checkIn + '">';
    html += '</div>';
    html += '<div class="form-group" style="flex:1">';
    html += '<label class="form-label">Check-out</label>';
    html += '<input type="date" class="form-input" id="hotel-checkout" value="' + h.checkOut + '">';
    html += '</div>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label class="form-label">Notities</label>';
    html += '<textarea class="form-textarea" id="hotel-notes" placeholder="Bijv. bevestigingsnummer, kamernummer...">' + escapeHTML(h.notes) + '</textarea>';
    html += '</div>';

    if (h.lat && h.lng) {
      html += '<button class="btn-secondary" onclick="window.App.showHotelOnMap()">\uD83D\uDCCD Toon op kaart</button>';
    }

    return html;
  }

  /* ---------- Transport Content ---------- */
  function renderTransportContent() {
    var options = window.TripData.TRANSPORT_OPTIONS;
    var html = '';

    options.forEach(function (opt) {
      html += '<div class="transport-card">';
      html += '<div class="transport-header">';
      html += '<span class="transport-icon">' + opt.icon + '</span>';
      html += '<span class="transport-mode">' + opt.mode + '</span>';
      html += '</div>';
      html += '<div class="transport-meta">';
      html += '<span>\u23F1 ' + opt.duration + '</span>';
      html += '<span>\uD83D\uDCB0 ' + opt.cost + '</span>';
      html += '</div>';
      html += '<div class="transport-description">' + opt.description + '</div>';
      html += '<div class="transport-tip">\uD83D\uDCA1 ' + opt.tips + '</div>';
      html += '</div>';
    });

    html += '<div class="form-group mt-md">';
    html += '<label class="form-label">Ons transport plan</label>';
    html += '<textarea class="form-textarea" id="transport-notes" placeholder="Bijv. We pakken de taxi heen en OV terug...">' + escapeHTML(appData.transportNotes) + '</textarea>';
    html += '</div>';

    return html;
  }

  /* ---------- Dining Content ---------- */
  function renderDiningContent() {
    var dates = window.TripData.TRIP_DATES;
    var dayNames = window.TripData.DAY_NAMES;
    var html = '';

    dates.forEach(function (date) {
      var breakfast = appData.dining.breakfastPlans[date] || '';
      var dinner = appData.dining.dinnerPlans[date] || '';

      html += '<div class="dining-day">';
      html += '<div class="dining-day-header">' + dayNames[date] + '</div>';
      html += '<div class="meal-row">';
      html += '<span class="meal-label">\uD83E\uDD50 Ontbijt</span>';
      html += '<input type="text" class="meal-input" data-meal="breakfast" data-date="' + date + '" value="' + escapeAttr(breakfast) + '" placeholder="Nog niet gepland">';
      html += '</div>';
      html += '<div class="meal-row">';
      html += '<span class="meal-label">\uD83C\uDF7D\uFE0F Diner</span>';
      html += '<input type="text" class="meal-input" data-meal="dinner" data-date="' + date + '" value="' + escapeAttr(dinner) + '" placeholder="Nog niet gepland">';
      html += '</div>';
      html += '</div>';
    });

    // Saved restaurants
    html += '<div class="restaurant-list">';
    html += '<div class="card-header"><span class="card-title" style="font-size:14px">\u2B50 Opgeslagen restaurants</span></div>';

    if (appData.dining.savedRestaurants.length === 0) {
      html += '<div class="text-muted" style="font-size:13px;padding:8px 0">Nog geen restaurants opgeslagen</div>';
    } else {
      appData.dining.savedRestaurants.forEach(function (r, i) {
        html += '<div class="restaurant-card">';
        html += '<div class="restaurant-info">';
        html += '<div class="restaurant-name">' + escapeHTML(r.name) + '</div>';
        if (r.cuisine) html += '<div class="restaurant-cuisine">' + escapeHTML(r.cuisine) + '</div>';
        html += '</div>';
        html += '<button class="btn-icon" onclick="window.App.removeRestaurant(' + i + ')" title="Verwijderen">\u2715</button>';
        html += '</div>';
      });
    }

    html += '<button class="btn-secondary mt-sm" onclick="window.App.toggleAddRestaurant()">+ Restaurant toevoegen</button>';
    html += '<div class="add-restaurant-form" id="add-restaurant-form">';
    html += '<div class="form-group">';
    html += '<input type="text" class="form-input" id="new-restaurant-name" placeholder="Restaurant naam">';
    html += '</div>';
    html += '<div class="form-group">';
    html += '<input type="text" class="form-input" id="new-restaurant-cuisine" placeholder="Keuken (bijv. Hongaars, Italiaans)">';
    html += '</div>';
    html += '<button class="btn-primary" onclick="window.App.addRestaurant()">Opslaan</button>';
    html += '</div>';
    html += '</div>';

    return html;
  }

  /* ---------- Circuit Event Listeners ---------- */
  function attachCircuitEventListeners() {
    // Hotel fields auto-save
    var hotelFields = ['hotel-name', 'hotel-address', 'hotel-checkin', 'hotel-checkout', 'hotel-notes'];
    hotelFields.forEach(function (fieldId) {
      var el = document.getElementById(fieldId);
      if (el) {
        el.addEventListener('input', debouncedSave(function () {
          appData = window.TripStorage.loadData();
          appData.hotel.name = document.getElementById('hotel-name').value;
          appData.hotel.address = document.getElementById('hotel-address').value;
          appData.hotel.checkIn = document.getElementById('hotel-checkin').value;
          appData.hotel.checkOut = document.getElementById('hotel-checkout').value;
          appData.hotel.notes = document.getElementById('hotel-notes').value;
          window.TripStorage.saveData(appData);
        }));
      }
    });

    // Transport notes
    var transportNotes = document.getElementById('transport-notes');
    if (transportNotes) {
      transportNotes.addEventListener('input', debouncedSave(function () {
        appData.transportNotes = transportNotes.value;
        window.TripStorage.saveData(appData);
      }));
    }

    // Meal inputs
    document.querySelectorAll('.meal-input').forEach(function (input) {
      input.addEventListener('input', debouncedSave(function () {
        var meal = input.dataset.meal;
        var date = input.dataset.date;
        if (meal === 'breakfast') {
          appData.dining.breakfastPlans[date] = input.value;
        } else {
          appData.dining.dinnerPlans[date] = input.value;
        }
        window.TripStorage.saveData(appData);
      }));
    });
  }

  /* ---------- Results Tab ---------- */
  var resultsDataCache = null;

  function renderResults() {
    var container = document.getElementById('results-content');
    container.innerHTML = '<div class="results-loading">\uD83C\uDFC1 Uitslagen laden...</div>';

    if (resultsDataCache) {
      renderResultsContent(container, resultsDataCache);
      return;
    }

    window.F1Results.loadAll(function (data) {
      resultsDataCache = data;
      renderResultsContent(container, data);
    });
  }

  function renderResultsContent(container, data) {
    var html = '';
    html += '<div class="section-title">\uD83C\uDFC6 F1 2026 Uitslagen</div>';

    if (data.errors.length > 0 && !data.calendar) {
      html += '<div class="empty-state">Kan uitslagen niet laden.<br>Controleer je internetverbinding.</div>';
      container.innerHTML = html;
      return;
    }

    /* --- WK Stand --- */
    if (data.standings && data.standings.length > 0) {
      html += '<div class="results-standings-card">';
      html += '<div class="results-standings-title">\uD83C\uDFC5 WK Stand Coureurs</div>';
      var top = Math.min(data.standings.length, 10);
      for (var s = 0; s < top; s++) {
        var ds = data.standings[s];
        if (!ds.position && ds.positionText === '-') continue;
        var teamColor = window.F1Results.getTeamColor(ds.Constructors[0].constructorId);
        var posClass = s === 0 ? 'gold' : s === 1 ? 'silver' : s === 2 ? 'bronze' : '';
        html += '<div class="results-standing-row">';
        html += '<span class="results-pos ' + posClass + '">' + ds.position + '</span>';
        html += '<span class="results-team-dot" style="background:' + teamColor + '"></span>';
        html += '<span class="results-driver-name">' + ds.Driver.givenName.charAt(0) + '. ' + ds.Driver.familyName + '</span>';
        html += '<span class="results-team-name">' + ds.Constructors[0].name + '</span>';
        html += '<span class="results-points">' + ds.points + ' pts</span>';
        html += '</div>';
      }
      html += '</div>';
    }

    /* --- Race cards --- */
    var calendar = data.calendar || [];
    var resultsMap = {};
    if (data.results) {
      data.results.forEach(function (r) {
        resultsMap[r.round] = r.Results;
      });
    }

    var now = new Date();

    html += '<div class="results-races-title">\uD83D\uDCC5 Alle Races</div>';

    calendar.forEach(function (race) {
      var raceDate = new Date(race.date + 'T' + (race.time || '00:00:00Z'));
      var isPast = now > raceDate;
      var results = resultsMap[race.round];
      var isHungary = race.Circuit.circuitId === 'hungaroring';
      var flag = window.F1Results.getFlag(race.Circuit.Location.country);

      var cardClass = 'results-race-card';
      if (isHungary) cardClass += ' results-race-card--hungary';
      if (!isPast) cardClass += ' results-race-card--upcoming';

      html += '<div class="' + cardClass + '">';

      /* Header */
      html += '<div class="results-race-header"';
      if (results && results.length > 0) {
        html += ' onclick="window.App.toggleResultCard(\'' + race.round + '\')"';
        html += ' style="cursor:pointer"';
      }
      html += '>';
      html += '<div class="results-race-round">R' + race.round + '</div>';
      html += '<div class="results-race-info">';
      html += '<div class="results-race-name">' + flag + ' ' + race.raceName + '</div>';
      html += '<div class="results-race-circuit">' + race.Circuit.circuitName + '</div>';
      html += '<div class="results-race-date">' + formatRaceDate(race.date) + '</div>';
      html += '</div>';

      if (results && results.length > 0) {
        html += '<div class="results-race-badge completed">\u2705</div>';
      } else if (isPast) {
        html += '<div class="results-race-badge completed">Klaar</div>';
      } else {
        html += '<div class="results-race-badge upcoming">Nog niet gereden</div>';
      }
      html += '</div>'; // header

      /* Podium (top 3) */
      if (results && results.length >= 3) {
        html += '<div class="results-podium">';
        for (var p = 0; p < 3; p++) {
          var dr = results[p];
          var tc = window.F1Results.getTeamColor(dr.Constructor.constructorId);
          var medal = p === 0 ? '\uD83E\uDD47' : p === 1 ? '\uD83E\uDD48' : '\uD83E\uDD49';
          html += '<div class="results-podium-item">';
          html += '<span class="results-podium-medal">' + medal + '</span>';
          html += '<span class="results-podium-driver" style="border-left:3px solid ' + tc + ';padding-left:6px">';
          html += dr.Driver.familyName;
          html += '</span>';
          html += '<span class="results-podium-time">' + (dr.Time ? dr.Time.time : dr.status) + '</span>';
          html += '</div>';
        }
        html += '</div>';

        /* Full results (top 10) */
        if (results.length > 3) {
          html += '<div class="results-full" id="results-full-' + race.round + '" style="display:none">';
          var showCount = Math.min(results.length, 10);
          for (var r = 3; r < showCount; r++) {
            var drf = results[r];
            var tcf = window.F1Results.getTeamColor(drf.Constructor.constructorId);
            html += '<div class="results-full-row">';
            html += '<span class="results-full-pos">P' + drf.position + '</span>';
            html += '<span class="results-team-dot" style="background:' + tcf + '"></span>';
            html += '<span class="results-full-driver">' + drf.Driver.familyName + '</span>';
            html += '<span class="results-full-time">' + (drf.Time ? drf.Time.time : drf.status) + '</span>';
            html += '</div>';
          }
          html += '</div>';
        }
      }

      if (isHungary && !isPast) {
        html += '<div class="results-hungary-badge">\uD83C\uDDED\uD83C\uDDFA Wij zijn erbij!</div>';
      }

      html += '</div>'; // card
    });

    container.innerHTML = html;
  }

  function formatRaceDate(dateStr) {
    var months = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    var days = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
    var d = new Date(dateStr + 'T12:00:00Z');
    return days[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + months[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  /* ---------- Group Tab ---------- */
  function renderGroup() {
    var container = document.getElementById('group-content');
    var html = '';

    html += '<div class="section-title">\uD83D\uDC65 Onze Groep</div>';

    var tickets = window.TripData.TICKETS;
    var predictions = appData.predictions || {};
    var raceResult = appData.raceResult;
    var hasResult = !!(raceResult && raceResult.p1 && raceResult.p2 && raceResult.p3);

    // Leaderboard (shows after race result is entered)
    if (hasResult && appData.group.length > 0) {
      var scores = appData.group.map(function (person) {
        var name = person.name || '';
        var pred = predictions[name];
        return {
          name: name,
          emoji: person.emoji || '\uD83D\uDC64',
          score: calculateScore(pred, raceResult),
          prediction: pred
        };
      });
      scores.sort(function (a, b) { return b.score - a.score; });
      var medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

      html += '<div class="group-leaderboard">';
      html += '<div class="group-leaderboard-title">\uD83C\uDFC6 Scorebord</div>';
      scores.forEach(function (s, i) {
        html += '<div class="group-leaderboard-row">';
        html += '<span class="group-leaderboard-pos">' + (medals[i] || (i + 1) + '.') + '</span>';
        html += '<span class="group-leaderboard-emoji">' + s.emoji + '</span>';
        html += '<span class="group-leaderboard-name">' + escapeHTML(s.name) + '</span>';
        html += '<span class="group-leaderboard-score">' + s.score + ' pt</span>';
        html += '</div>';
      });
      html += '</div>';
    }

    if (appData.group.length === 0) {
      html += '<div class="empty-state">Nog niemand toegevoegd.<br>Voeg je reisgenoten toe!</div>';
    } else {
      appData.group.forEach(function (person, i) {
        var seatNum = tickets.stoelen[i] || null;
        var pred = predictions[person.name];
        var predFilled = !!(pred && pred.p1 && pred.p2 && pred.p3);

        html += '<div class="person-card-full">';

        // Top row: avatar + name + remove
        html += '<div class="person-card-top">';
        html += '<div class="person-avatar" onclick="window.App.openEmojiPicker(' + i + ')" title="Klik om emoji te kiezen">' + (person.emoji || '\uD83D\uDC64') + '</div>';
        html += '<div class="person-fields">';
        html += '<input type="text" class="person-name-input" data-index="' + i + '" data-field="name" value="' + escapeAttr(person.name) + '" placeholder="Naam">';
        html += '<input type="text" class="person-notes-input" data-index="' + i + '" data-field="notes" value="' + escapeAttr(person.notes || '') + '" placeholder="Notities (optioneel)">';
        html += '</div>';
        html += '</div>';

        // Seat info
        if (seatNum) {
          html += '<div class="person-seat">';
          html += '<span class="person-seat-label">\uD83C\uDFDF\uFE0F Stoel ' + seatNum + '</span>';
          html += '<span class="person-seat-detail">Sector ' + tickets.sector + ' \u2022 Rij ' + tickets.rij + '</span>';
          html += '</div>';
        }

        // Prediction status
        html += '<div class="person-pred-status person-pred-status--' + (predFilled ? 'filled' : 'empty') + '">';
        if (predFilled) {
          html += '<span class="person-pred-status-icon">\u2705</span>';
          html += '<span class="person-pred-status-text">Voorspelling ingevuld</span>';
          html += '<span class="person-pred-status-detail">\uD83E\uDD47 ' + escapeHTML(pred.p1) + ' &middot; \uD83E\uDD48 ' + escapeHTML(pred.p2) + ' &middot; \uD83E\uDD49 ' + escapeHTML(pred.p3) + '</span>';
        } else {
          html += '<span class="person-pred-status-icon">\u23F3</span>';
          html += '<span class="person-pred-status-text">Nog geen voorspelling</span>';
        }
        html += '</div>';

        html += '</div>';
      });
    }


    // Financial overview accordion
    html += renderAccordion('finances', '\uD83D\uDCB0 Financieel Overzicht', renderFinancesContent(), false);

    // Emoji picker overlay (hidden)
    html += '<div class="emoji-picker" id="emoji-picker">';
    window.TripData.PERSON_EMOJIS.forEach(function (emoji) {
      html += '<button class="emoji-option" onclick="window.App.selectEmoji(\'' + emoji + '\')">' + emoji + '</button>';
    });
    html += '</div>';


    container.innerHTML = html;

    // Attach input listeners
    container.querySelectorAll('.person-name-input, .person-notes-input').forEach(function (input) {
      input.addEventListener('input', debouncedSave(function () {
        var idx = parseInt(input.dataset.index);
        var field = input.dataset.field;
        if (appData.group[idx]) {
          appData.group[idx][field] = input.value;
          window.TripStorage.saveData(appData);
        }
      }));
    });

    // Attach ticket upload listeners per person
    container.querySelectorAll('.person-ticket-input').forEach(function (input) {
      input.addEventListener('change', function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var personIdx = parseInt(input.dataset.personIndex);

        if (file.size > 5 * 1024 * 1024) {
          alert('Bestand is te groot (max 5MB)');
          return;
        }

        var reader = new FileReader();
        reader.onload = function (ev) {
          var dataUrl = ev.target.result;
          var isPdf = file.type === 'application/pdf';

          if (isPdf) {
            appData = window.TripStorage.loadData();
            if (appData.group[personIdx]) {
              appData.group[personIdx].ticketImage = dataUrl;
              appData.group[personIdx].ticketType = 'pdf';
              window.TripStorage.saveData(appData);
              renderGroup();
            }
          } else {
            resizeImage(dataUrl, 1200, function (resized) {
              appData = window.TripStorage.loadData();
              if (appData.group[personIdx]) {
                appData.group[personIdx].ticketImage = resized;
                appData.group[personIdx].ticketType = 'image';
                window.TripStorage.saveData(appData);
                renderGroup();
              }
            });
          }
        };
        reader.readAsDataURL(file);
      });
    });

    // Attach financial input listeners
    attachFinanceListeners();
  }

  /* ---------- Finances ---------- */
  function renderFinancesContent() {
    var config = window.TripData.FINANCES_CONFIG;
    var finances = appData.finances || { costs: [], paidItems: {} };
    var groupSize = Math.max(appData.group.length, 1);
    var html = '';

    // Fixed costs (already paid)
    html += '<div class="finance-section-label">\u2705 Vaste kosten (betaald)</div>';
    var fixedTotal = 0;
    config.fixedCosts.forEach(function (cost) {
      fixedTotal += cost.amount;
      html += '<div class="finance-row finance-row--fixed">';
      html += '<span class="finance-row-icon">' + cost.icon + '</span>';
      html += '<span class="finance-row-label">' + cost.label + '</span>';
      html += '<span class="finance-row-amount">\u20AC' + cost.amount.toFixed(2) + '</span>';
      html += '</div>';
    });

    // Shared costs (estimated)
    html += '<div class="finance-section-label" style="margin-top:16px">\uD83D\uDE97 Gedeelde kosten (geschat)</div>';
    var sharedTotal = 0;
    config.sharedCosts.forEach(function (cost) {
      sharedTotal += cost.amount;
      html += '<div class="finance-row">';
      html += '<span class="finance-row-icon">' + cost.icon + '</span>';
      html += '<span class="finance-row-label">' + cost.label + '</span>';
      html += '<span class="finance-row-amount">\u20AC' + cost.amount.toFixed(2) + '</span>';
      html += '</div>';
    });

    // Custom costs
    if (finances.costs.length > 0) {
      html += '<div class="finance-section-label" style="margin-top:16px">\u270F\uFE0F Extra kosten</div>';
      finances.costs.forEach(function (cost, i) {
        sharedTotal += (parseFloat(cost.amount) || 0);
        html += '<div class="finance-row">';
        html += '<span class="finance-row-icon">\uD83D\uDCCC</span>';
        html += '<span class="finance-row-label">' + escapeHTML(cost.label) + '</span>';
        html += '<span class="finance-row-amount">\u20AC' + (parseFloat(cost.amount) || 0).toFixed(2) + '</span>';
        html += '<button class="btn-icon finance-remove-btn" onclick="window.App.removeCustomCost(' + i + ')" title="Verwijderen">\u2715</button>';
        html += '</div>';
      });
    }

    // Add custom cost form
    html += '<div class="finance-add-form">';
    html += '<div style="display:flex;gap:8px;margin-top:12px">';
    html += '<input type="text" class="form-input" id="finance-new-label" placeholder="Omschrijving" style="flex:2">';
    html += '<input type="number" class="form-input" id="finance-new-amount" placeholder="\u20AC" step="0.01" style="flex:1">';
    html += '<button class="btn-secondary" onclick="window.App.addCustomCost()" style="white-space:nowrap">+</button>';
    html += '</div>';
    html += '</div>';

    // Totals
    var grandTotal = fixedTotal + sharedTotal;
    var perPerson = grandTotal / groupSize;

    html += '<div class="finance-total">';
    html += '<div class="finance-total-row">';
    html += '<span>Vaste kosten</span>';
    html += '<span>\u20AC' + fixedTotal.toFixed(2) + '</span>';
    html += '</div>';
    html += '<div class="finance-total-row">';
    html += '<span>Gedeelde kosten</span>';
    html += '<span>\u20AC' + sharedTotal.toFixed(2) + '</span>';
    html += '</div>';
    html += '<div class="finance-total-row finance-total-row--grand">';
    html += '<span>Totaal</span>';
    html += '<span>\u20AC' + grandTotal.toFixed(2) + '</span>';
    html += '</div>';
    html += '<div class="finance-total-row finance-total-row--pp">';
    html += '<span>Per persoon (' + groupSize + ')</span>';
    html += '<span>\u20AC' + perPerson.toFixed(2) + '</span>';
    html += '</div>';
    html += '</div>';

    return html;
  }

  function attachFinanceListeners() {
    // No persistent input listeners needed; custom costs are added via button
  }

  /* ---------- Prediction Game ---------- */
  function renderPredictionContent() {
    var html = '';
    var drivers = window.TripData.F1_DRIVERS;
    var predictions = appData.predictions || {};
    var raceResult = appData.raceResult;

    if (appData.group.length === 0) {
      html += '<div class="text-muted" style="font-size:13px;padding:12px 0">Voeg eerst personen toe bij <strong>Groep</strong></div>';
      return html;
    }

    html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:var(--space-sm)">Voorspel de top 3 van de race. Punten: P1 exact = 10, P2 = 8, P3 = 6, juiste coureur verkeerde plek = 3</p>';

    // Per-person prediction forms
    appData.group.forEach(function (person, i) {
      var personName = person.name || ('Persoon ' + (i + 1));
      var pred = predictions[personName] || {};

      html += '<div class="prediction-card">';
      html += '<div class="prediction-person-header">';
      html += '<span class="prediction-person-emoji">' + (person.emoji || '\uD83D\uDC64') + '</span>';
      html += '<span class="prediction-person-name">' + escapeHTML(personName) + '</span>';
      if (pred.p1 && pred.p2 && pred.p3) {
        html += '<span style="font-size:11px;color:var(--accent-green)">\u2705</span>';
      }
      html += '</div>';

      html += '<div class="prediction-picks">';
      ['p1', 'p2', 'p3'].forEach(function (pos, j) {
        html += '<div class="prediction-pick">';
        html += '<div class="prediction-pick-label">P' + (j + 1) + '</div>';
        html += '<select class="prediction-select" data-person="' + escapeAttr(personName) + '" data-position="' + pos + '" onchange="window.App.savePrediction(this)">';
        html += '<option value="">Kies...</option>';
        drivers.forEach(function (driver) {
          html += '<option value="' + driver + '"' + (pred[pos] === driver ? ' selected' : '') + '>' + driver + '</option>';
        });
        html += '</select>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    });

    // Leaderboard (if race result exists)
    if (raceResult && raceResult.p1) {
      html += '<div class="leaderboard">';
      html += '<div style="font-size:14px;font-weight:700;margin-bottom:var(--space-sm)">\uD83C\uDFC6 Scorebord</div>';

      var scores = [];
      appData.group.forEach(function (person) {
        var name = person.name || '';
        if (!name) return;
        var pred = predictions[name];
        var score = calculateScore(pred, raceResult);
        scores.push({ name: name, emoji: person.emoji || '\uD83D\uDC64', score: score, prediction: pred });
      });

      scores.sort(function (a, b) { return b.score - a.score; });

      var medals = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];
      scores.forEach(function (s, i) {
        html += '<div class="leaderboard-row">';
        html += '<span class="leaderboard-pos">' + (medals[i] || (i + 1) + '.') + '</span>';
        html += '<span style="font-size:16px">' + s.emoji + '</span>';
        html += '<span class="leaderboard-name">' + escapeHTML(s.name) + '</span>';
        html += '<span class="leaderboard-score">' + s.score + ' pts</span>';
        html += '</div>';
      });

      html += '<div style="margin-top:12px;padding:var(--space-sm);background:var(--bg-secondary);border-radius:var(--radius-sm);font-size:12px;color:var(--text-secondary)">';
      html += '<strong>Uitslag:</strong> \uD83E\uDD47 ' + escapeHTML(raceResult.p1) + ' \uD83E\uDD48 ' + escapeHTML(raceResult.p2) + ' \uD83E\uDD49 ' + escapeHTML(raceResult.p3);
      html += '</div>';

      html += '</div>';
    }

    // Race result input
    html += '<div class="race-result-section">';
    html += '<div class="race-result-title">\uD83C\uDFC1 Race Uitslag</div>';
    html += '<div style="font-size:11px;color:var(--text-muted);margin-bottom:var(--space-sm)">Vul in na de race om scores te berekenen</div>';

    html += '<div class="prediction-picks">';
    ['p1', 'p2', 'p3'].forEach(function (pos, j) {
      html += '<div class="prediction-pick">';
      html += '<div class="prediction-pick-label">P' + (j + 1) + '</div>';
      html += '<select class="prediction-select" data-result-position="' + pos + '" onchange="window.App.saveRaceResult(this)">';
      html += '<option value="">Kies...</option>';
      drivers.forEach(function (driver) {
        html += '<option value="' + driver + '"' + ((raceResult && raceResult[pos] === driver) ? ' selected' : '') + '>' + driver + '</option>';
      });
      html += '</select>';
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';

    return html;
  }

  /* ---------- Public API ---------- */
  window.App = {
    toggleAccordion: function (id) {
      var section = document.getElementById('accordion-' + id);
      if (section) section.classList.toggle('open');
    },

    toggleRouteStep: function (id) {
      var step = document.getElementById('route-step-' + id);
      if (step) step.classList.toggle('open');
    },

    toggleResultCard: function (round) {
      var el = document.getElementById('results-full-' + round);
      if (el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
      }
    },

    viewTicket: function (index) {
      appData = window.TripStorage.loadData();
      var ticket = appData.tickets && appData.tickets[index];
      if (!ticket) return;

      var overlay = document.createElement('div');
      overlay.className = 'ticket-overlay';
      overlay.onclick = function (e) {
        if (e.target === overlay) document.body.removeChild(overlay);
      };

      var inner = document.createElement('div');
      inner.className = 'ticket-overlay-inner';

      var closeBtn = document.createElement('button');
      closeBtn.className = 'ticket-overlay-close';
      closeBtn.textContent = '\u2715';
      closeBtn.onclick = function () { document.body.removeChild(overlay); };
      inner.appendChild(closeBtn);

      if (ticket.type === 'pdf') {
        var iframe = document.createElement('iframe');
        iframe.src = ticket.dataUrl;
        iframe.className = 'ticket-overlay-pdf';
        inner.appendChild(iframe);
      } else {
        var img = document.createElement('img');
        img.src = ticket.dataUrl;
        img.className = 'ticket-overlay-img';
        inner.appendChild(img);
      }

      overlay.appendChild(inner);
      document.body.appendChild(overlay);
    },

    removeTicket: function (index) {
      if (!confirm('Ticket verwijderen?')) return;
      appData = window.TripStorage.loadData();
      if (appData.tickets) {
        appData.tickets.splice(index, 1);
        window.TripStorage.saveData(appData);
        renderCircuit();
      }
    },

    viewPersonTicket: function (index) {
      appData = window.TripStorage.loadData();
      var person = appData.group && appData.group[index];
      if (!person || !person.ticketImage) return;

      var overlay = document.createElement('div');
      overlay.className = 'ticket-overlay';
      overlay.onclick = function (e) {
        if (e.target === overlay) document.body.removeChild(overlay);
      };

      var inner = document.createElement('div');
      inner.className = 'ticket-overlay-inner';

      var closeBtn = document.createElement('button');
      closeBtn.className = 'ticket-overlay-close';
      closeBtn.textContent = '\u2715';
      closeBtn.onclick = function () { document.body.removeChild(overlay); };
      inner.appendChild(closeBtn);

      if (person.ticketType === 'pdf') {
        var iframe = document.createElement('iframe');
        iframe.src = person.ticketImage;
        iframe.className = 'ticket-overlay-pdf';
        inner.appendChild(iframe);
      } else {
        var img = document.createElement('img');
        img.src = person.ticketImage;
        img.className = 'ticket-overlay-img';
        inner.appendChild(img);
      }

      overlay.appendChild(inner);
      document.body.appendChild(overlay);
    },

    removePersonTicket: function (index) {
      if (!confirm('Ticket verwijderen?')) return;
      appData = window.TripStorage.loadData();
      if (appData.group[index]) {
        delete appData.group[index].ticketImage;
        delete appData.group[index].ticketType;
        window.TripStorage.saveData(appData);
        renderGroup();
      }
    },

    showHotelOnMap: function () {
      document.querySelector('[data-tab="tab-map"]').click();
      setTimeout(function () {
        if (appData.hotel.lat && appData.hotel.lng) {
          window.TripMap.showLocation(appData.hotel.lat, appData.hotel.lng);
        }
      }, 200);
    },

    toggleAddRestaurant: function () {
      var form = document.getElementById('add-restaurant-form');
      if (form) form.classList.toggle('visible');
    },

    addRestaurant: function () {
      var name = document.getElementById('new-restaurant-name').value.trim();
      var cuisine = document.getElementById('new-restaurant-cuisine').value.trim();
      if (!name) return;

      appData.dining.savedRestaurants.push({ name: name, cuisine: cuisine, lat: null, lng: null });
      window.TripStorage.saveData(appData);
      renderCircuit();
    },

    removeRestaurant: function (index) {
      if (confirm('Restaurant verwijderen?')) {
        appData.dining.savedRestaurants.splice(index, 1);
        window.TripStorage.saveData(appData);
        renderCircuit();
      }
    },

    addPerson: function () {
      var emojis = window.TripData.PERSON_EMOJIS;
      appData.group.push({
        name: '',
        emoji: emojis[appData.group.length % emojis.length],
        notes: ''
      });
      window.TripStorage.saveData(appData);
      renderGroup();

      var inputs = document.querySelectorAll('.person-name-input');
      if (inputs.length) inputs[inputs.length - 1].focus();
    },

    removePerson: function (index) {
      if (confirm('Persoon verwijderen uit de groep?')) {
        appData.group.splice(index, 1);
        window.TripStorage.saveData(appData);
        renderGroup();
      }
    },

    openEmojiPicker: function (index) {
      activeEmojiPicker = index;
      var picker = document.getElementById('emoji-picker');
      var avatar = document.querySelectorAll('.person-avatar')[index];
      if (picker && avatar) {
        var rect = avatar.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.top = (rect.bottom + 4) + 'px';
        picker.style.left = rect.left + 'px';
        picker.classList.add('visible');

        setTimeout(function () {
          document.addEventListener('click', closeEmojiPickerOnOutside);
        }, 0);
      }
    },

    selectEmoji: function (emoji) {
      if (activeEmojiPicker !== null && appData.group[activeEmojiPicker]) {
        appData.group[activeEmojiPicker].emoji = emoji;
        window.TripStorage.saveData(appData);
        renderGroup();
      }
      closeEmojiPicker();
    },

    savePrediction: function (selectEl) {
      var personName = selectEl.dataset.person;
      var position = selectEl.dataset.position;
      var driver = selectEl.value;

      appData = window.TripStorage.loadData();
      if (!appData.predictions) appData.predictions = {};
      if (!appData.predictions[personName]) appData.predictions[personName] = {};
      appData.predictions[personName][position] = driver;
      appData.predictions[personName]._updated = Date.now();
      window.TripStorage.saveData(appData);

      // Push to cloud so other friends see it
      if (window.TripSync && typeof window.TripSync.pushLocal === 'function') {
        window.TripSync.pushLocal();
      }
    },

    saveRaceResult: function (selectEl) {
      var position = selectEl.dataset.resultPosition;
      var driver = selectEl.value;

      appData = window.TripStorage.loadData();
      if (!appData.raceResult) appData.raceResult = {};
      appData.raceResult[position] = driver;
      appData.raceResult._updated = Date.now();
      window.TripStorage.saveData(appData);
      renderDashboard();

      // Push to cloud so other friends see the official result
      if (window.TripSync && typeof window.TripSync.pushLocal === 'function') {
        window.TripSync.pushLocal();
      }
    },

    addCustomCost: function () {
      var labelEl = document.getElementById('finance-new-label');
      var amountEl = document.getElementById('finance-new-amount');
      if (!labelEl || !amountEl) return;

      var label = labelEl.value.trim();
      var amount = parseFloat(amountEl.value);
      if (!label || isNaN(amount)) return;

      appData = window.TripStorage.loadData();
      if (!appData.finances) appData.finances = { costs: [], paidItems: {} };
      appData.finances.costs.push({ label: label, amount: amount });
      window.TripStorage.saveData(appData);
      renderGroup();
    },

    removeCustomCost: function (index) {
      if (!confirm('Kosten verwijderen?')) return;
      appData = window.TripStorage.loadData();
      if (appData.finances && appData.finances.costs) {
        appData.finances.costs.splice(index, 1);
        window.TripStorage.saveData(appData);
        renderGroup();
      }
    }
  };

  function closeEmojiPickerOnOutside(e) {
    var picker = document.getElementById('emoji-picker');
    if (picker && !picker.contains(e.target) && !e.target.classList.contains('person-avatar')) {
      closeEmojiPicker();
    }
  }

  function closeEmojiPicker() {
    var picker = document.getElementById('emoji-picker');
    if (picker) picker.classList.remove('visible');
    activeEmojiPicker = null;
    document.removeEventListener('click', closeEmojiPickerOnOutside);
  }

  /* ---------- Utilities ---------- */
  function debouncedSave(fn) {
    var timeout = null;
    return function () {
      clearTimeout(timeout);
      timeout = setTimeout(fn, 400);
    };
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
