/* ===== countdown.js - Countdown timer logic ===== */
(function () {
  'use strict';

  function getTimeDiff(targetISO) {
    var now = Date.now();
    var target = new Date(targetISO).getTime();
    var diff = target - now;
    if (diff <= 0) return null;

    var days = Math.floor(diff / 86400000);
    var hours = Math.floor((diff % 86400000) / 3600000);
    var minutes = Math.floor((diff % 3600000) / 60000);
    var seconds = Math.floor((diff % 60000) / 1000);

    return { days: days, hours: hours, minutes: minutes, seconds: seconds };
  }

  function getSessionStatus(session) {
    var now = Date.now();
    var start = new Date(session.date).getTime();
    var end = start + session.duration * 60000;

    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'live';
    return 'completed';
  }

  function getNextSession() {
    var sessions = window.TripData.RACE_SESSIONS;
    var now = Date.now();

    for (var i = 0; i < sessions.length; i++) {
      var end = new Date(sessions[i].date).getTime() + sessions[i].duration * 60000;
      if (now < end) return sessions[i];
    }
    return null;
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function renderCountdownHTML(targetISO, size) {
    var diff = getTimeDiff(targetISO);
    if (!diff) return '<div class="text-muted">Gestart!</div>';

    if (size === 'large') {
      return '<div class="countdown-container">' +
        '<div class="countdown-digit-box"><div class="value">' + pad(diff.days) + '</div><div class="label">Dagen</div></div>' +
        '<div class="countdown-digit-box"><div class="value">' + pad(diff.hours) + '</div><div class="label">Uren</div></div>' +
        '<div class="countdown-digit-box"><div class="value">' + pad(diff.minutes) + '</div><div class="label">Min</div></div>' +
        '<div class="countdown-digit-box"><div class="value">' + pad(diff.seconds) + '</div><div class="label">Sec</div></div>' +
        '</div>';
    }

    // Mini countdown
    return '<div class="next-up-countdown">' +
      '<div class="mini-digit"><div class="val">' + pad(diff.days) + '</div><div class="lbl">d</div></div>' +
      '<div class="mini-digit"><div class="val">' + pad(diff.hours) + '</div><div class="lbl">u</div></div>' +
      '<div class="mini-digit"><div class="val">' + pad(diff.minutes) + '</div><div class="lbl">m</div></div>' +
      '<div class="mini-digit"><div class="val">' + pad(diff.seconds) + '</div><div class="lbl">s</div></div>' +
      '</div>';
  }

  function formatSessionTime(session) {
    var start = new Date(session.date);
    var end = new Date(start.getTime() + session.duration * 60000);
    var h1 = pad(start.getUTCHours() + 2); // CEST = UTC+2
    var m1 = pad(start.getUTCMinutes());
    var h2 = pad(end.getUTCHours() + 2);
    var m2 = pad(end.getUTCMinutes());
    return h1 + ':' + m1 + ' - ' + h2 + ':' + m2 + ' CEST';
  }

  function formatMiniCountdown(targetISO) {
    var diff = getTimeDiff(targetISO);
    if (!diff) return 'Nu!';
    var parts = [];
    if (diff.days > 0) parts.push(diff.days + 'd');
    parts.push(pad(diff.hours) + ':' + pad(diff.minutes) + ':' + pad(diff.seconds));
    return parts.join(' ');
  }

  window.TripCountdown = {
    getTimeDiff: getTimeDiff,
    getSessionStatus: getSessionStatus,
    getNextSession: getNextSession,
    renderCountdownHTML: renderCountdownHTML,
    formatSessionTime: formatSessionTime,
    formatMiniCountdown: formatMiniCountdown,
    pad: pad
  };
})();
