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
      case 'tab-info': renderInfo(); break;
      case 'tab-group': renderGroup(); break;
      case 'tab-reis': renderReis(); break;
    }
  }

  /* ---------- Countdown Updates ---------- */
  function startCountdownUpdates() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(function () {
      updateDashboardCountdowns();
      updateScheduleCountdowns();
      updateReisCountdowns();
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
    html += '<div class="quick-cards">';
    html += '<div class="quick-card">';
    html += '<div class="quick-card-icon">\uD83C\uDFE8</div>';
    html += '<div class="quick-card-value">' + (appData.hotel.name || 'Niet ingesteld') + '</div>';
    html += '<div class="quick-card-label">Hotel</div>';
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

    container.innerHTML = html;
  }

  /* ---------- Schedule ---------- */
  function renderSchedule() {
    var container = document.getElementById('schedule-content');
    var sessions = window.TripData.RACE_SESSIONS;

    var html = '';
    html += '<div class="timezone-note">\u23F0 Alle tijden in CEST (UTC+2) \u2014 Lokale tijd Budapest</div>';

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

  /* ---------- Info Tab ---------- */
  function renderInfo() {
    var container = document.getElementById('info-content');
    var html = '';

    // Tickets accordion
    html += renderAccordion('tickets', '\uD83C\uDFAB Tickets', renderTicketsContent(), true);

    // Hotel accordion
    html += renderAccordion('hotel', '\uD83C\uDFE8 Hotel', renderHotelContent(), false);

    // Transport accordion
    html += renderAccordion('transport', '\uD83D\uDE8C Transport', renderTransportContent(), false);

    // Dining accordion
    html += renderAccordion('dining', '\uD83C\uDF7D\uFE0F Eten', renderDiningContent(), false);

    container.innerHTML = html;
    attachInfoEventListeners();
    attachTicketListeners();
  }

  function renderAccordion(id, title, content, openByDefault) {
    return '<div class="accordion-section' + (openByDefault ? ' open' : '') + '" id="accordion-' + id + '">' +
      '<button class="accordion-header" onclick="window.App.toggleAccordion(\'' + id + '\')">' +
      '<span>' + title + '</span>' +
      '<span class="accordion-icon">\u25BC</span>' +
      '</button>' +
      '<div class="accordion-body">' + content + '</div>' +
      '</div>';
  }

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
            // Resize image to save localStorage space
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
              if (processed === files.length) renderInfo();
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
            if (processed === files.length) renderInfo();
          }
        };
        reader.readAsDataURL(file);
      });

      // Reset input so same file can be re-uploaded
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

  function attachInfoEventListeners() {
    // Hotel fields auto-save
    var hotelFields = ['hotel-name', 'hotel-address', 'hotel-checkin', 'hotel-checkout', 'hotel-notes'];
    hotelFields.forEach(function (fieldId) {
      var el = document.getElementById(fieldId);
      if (el) {
        el.addEventListener('input', debouncedSave(function () {
          // Reload to preserve lat/lng set via map
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

  /* ---------- Group Tab ---------- */
  function renderGroup() {
    var container = document.getElementById('group-content');
    var html = '';

    html += '<div class="section-title">\uD83D\uDC65 Onze Groep</div>';

    var tickets = window.TripData.TICKETS;

    if (appData.group.length === 0) {
      html += '<div class="empty-state">Nog niemand toegevoegd.<br>Voeg je reisgenoten toe!</div>';
    } else {
      appData.group.forEach(function (person, i) {
        var seatNum = tickets.stoelen[i] || null;

        html += '<div class="person-card-full">';

        // Top row: avatar + name + remove
        html += '<div class="person-card-top">';
        html += '<div class="person-avatar" onclick="window.App.openEmojiPicker(' + i + ')" title="Klik om emoji te kiezen">' + (person.emoji || '\uD83D\uDC64') + '</div>';
        html += '<div class="person-fields">';
        html += '<input type="text" class="person-name-input" data-index="' + i + '" data-field="name" value="' + escapeAttr(person.name) + '" placeholder="Naam">';
        html += '<input type="text" class="person-notes-input" data-index="' + i + '" data-field="notes" value="' + escapeAttr(person.notes || '') + '" placeholder="Notities (optioneel)">';
        html += '</div>';
        html += '<button class="remove-person-btn" onclick="window.App.removePerson(' + i + ')" title="Verwijderen">\u2715</button>';
        html += '</div>';

        // Seat info
        if (seatNum) {
          html += '<div class="person-seat">';
          html += '<span class="person-seat-label">\uD83C\uDFDF\uFE0F Stoel ' + seatNum + '</span>';
          html += '<span class="person-seat-detail">Sector ' + tickets.sector + ' \u2022 Rij ' + tickets.rij + '</span>';
          html += '</div>';
        }

        // Ticket upload
        html += '<div class="person-ticket">';
        if (person.ticketImage) {
          html += '<div class="person-ticket-preview" onclick="window.App.viewPersonTicket(' + i + ')">';
          html += '<img src="' + person.ticketImage + '" alt="Ticket">';
          html += '<div class="person-ticket-badge">\uD83C\uDFAB Ticket</div>';
          html += '</div>';
          html += '<button class="btn-icon" onclick="window.App.removePersonTicket(' + i + ')" title="Ticket verwijderen" style="font-size:12px;color:var(--text-muted)">\u2715 Verwijder ticket</button>';
        } else {
          html += '<label class="person-ticket-upload">';
          html += '\uD83C\uDFAB Ticket uploaden';
          html += '<input type="file" accept="image/*,.pdf" data-person-index="' + i + '" class="person-ticket-input" style="display:none">';
          html += '</label>';
        }
        html += '</div>';

        html += '</div>';
      });
    }

    html += '<button class="btn-primary mt-md" onclick="window.App.addPerson()">+ Persoon toevoegen</button>';

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
            // Store PDF directly
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
  }

  /* ---------- Reis (Travel Planner) ---------- */
  function updateReisCountdowns() {
    if (getActiveTab() !== 'tab-reis') return;

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

  function renderReis() {
    var container = document.getElementById('reis-content');
    if (!container) return;
    var html = '';
    var pad = window.TripCountdown.pad;

    html += '<div class="section-title">\uD83D\uDE86 Reisplanner</div>';
    html += '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:var(--space-md)">Hotel \u2192 Hungaroring via openbaar vervoer</p>';

    // Route overview bar
    html += '<div class="route-summary-bar">';
    html += '<span>\uD83D\uDCCD Garay t\u00E9r 20</span>';
    html += '<span class="route-arrow">\u2192</span>';
    html += '<span>\uD83C\uDFC1 Hungaroring</span>';
    html += '<span class="route-duration">~50-60 min</span>';
    html += '</div>';

    // Vertical timeline
    var legs = window.TripData.ROUTE_LEGS;
    html += '<div class="route-timeline">';
    legs.forEach(function (leg, index) {
      var isLast = index === legs.length - 1;
      html += '<div class="route-step' + (isLast ? ' route-step--last' : '') + '" id="route-step-' + leg.id + '">';

      // Marker column (dot + line)
      html += '<div class="route-step-marker">';
      html += '<div class="route-step-dot"></div>';
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
      html += '<span class="route-step-duration">' + leg.duration + '</span>';
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
    html += '<div class="section-title mt-md">\u23F0 Vertrektijden</div>';
    html += '<p style="font-size:12px;color:var(--text-muted);margin-bottom:var(--space-sm)">Aanbevolen vertrektijd vanaf het hotel per sessie</p>';

    var sessions = window.TripData.RACE_SESSIONS;
    var buffers = window.TripData.DEPARTURE_BUFFERS;

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

    // Travel tips accordion
    html += renderAccordion('reistips', '\uD83D\uDCA1 Reistips', renderTravelTipsContent(), false);

    // Return journey accordion
    html += renderAccordion('terugreis', '\uD83D\uDD04 Terugreis', renderReturnJourneyContent(), false);

    container.innerHTML = html;
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

  function renderReturnJourneyContent() {
    var html = '';
    html += '<div style="font-size:13px;color:var(--text-secondary);line-height:1.6">';
    html += '<p style="margin-bottom:12px">De terugreis is dezelfde route in omgekeerde volgorde:</p>';
    html += '<div class="transport-card">';
    html += '<div class="transport-header">';
    html += '<span class="transport-icon">\uD83D\uDE8C</span>';
    html += '<span class="transport-mode">Shuttle \u2192 H\u00C9V \u2192 M2 \u2192 Lopen</span>';
    html += '</div>';
    html += '<div class="transport-description">Hungaroring Gate 3 \u2192 Kerepes (shuttle) \u2192 \u00D6rs vez\u00E9r tere (H\u00C9V) \u2192 Keleti (M2) \u2192 Hotel</div>';
    html += '</div>';
    html += '<div class="transport-tip">\u26A0\uFE0F Na de race: verwacht lange wachtrijen bij de shuttle (30-60 min). De H\u00C9V rijdt tot ~23:00. Overweeg om 20 min naar Mogyor\u00F3d dorp te lopen voor een taxi als alternatief.</div>';
    html += '<div class="transport-tip" style="margin-top:8px">\uD83D\uDCA1 Tip: Na de kwalificatie is het veel rustiger. Shuttles rijden vlot en je bent binnen een uur terug.</div>';
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

    viewTicket: function (index) {
      appData = window.TripStorage.loadData();
      var ticket = appData.tickets && appData.tickets[index];
      if (!ticket) return;

      // Create fullscreen overlay
      var overlay = document.createElement('div');
      overlay.className = 'ticket-overlay';
      overlay.onclick = function (e) {
        if (e.target === overlay) document.body.removeChild(overlay);
      };

      var inner = document.createElement('div');
      inner.className = 'ticket-overlay-inner';

      // Close button
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
        renderInfo();
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
      // Switch to map tab
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
      renderInfo();
    },

    removeRestaurant: function (index) {
      if (confirm('Restaurant verwijderen?')) {
        appData.dining.savedRestaurants.splice(index, 1);
        window.TripStorage.saveData(appData);
        renderInfo();
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

      // Focus the new name input
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

        // Close on outside click
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
