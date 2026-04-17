/* ===== translate.js - NL -> HU vertaler =====
   Gebruikt de gratis MyMemory API (1000 woorden/dag, geen key nodig,
   CORS-enabled). Handige snel-zinnen zijn hardcoded zodat ze direct
   uitspreekbaar zijn zonder netwerk-call. Geschiedenis wordt lokaal
   opgeslagen (max 10 items). */
(function () {
  'use strict';

  var HISTORY_KEY = 'f1Trip_translateHistory';
  var MAX_HISTORY = 10;
  var API_BASE = 'https://api.mymemory.translated.net/get';

  /* ---------- Pre-translated quick phrases ---------- */
  var QUICK_PHRASES = [
    { cat: 'Basis', nl: 'Hallo', hu: 'Szia' },
    { cat: 'Basis', nl: 'Goedemorgen', hu: 'J\u00F3 reggelt' },
    { cat: 'Basis', nl: 'Goedemiddag / Goedendag', hu: 'J\u00F3 napot' },
    { cat: 'Basis', nl: 'Goedenavond', hu: 'J\u00F3 est\u00E9t' },
    { cat: 'Basis', nl: 'Tot ziens', hu: 'Viszl\u00E1t' },
    { cat: 'Basis', nl: 'Bedankt', hu: 'K\u00F6sz\u00F6n\u00F6m' },
    { cat: 'Basis', nl: 'Alstublieft', hu: 'K\u00E9rem' },
    { cat: 'Basis', nl: 'Sorry / Pardon', hu: 'Bocs\u00E1nat' },
    { cat: 'Basis', nl: 'Ja', hu: 'Igen' },
    { cat: 'Basis', nl: 'Nee', hu: 'Nem' },

    { cat: 'Communicatie', nl: 'Ik spreek geen Hongaars', hu: 'Nem besz\u00E9lek magyarul' },
    { cat: 'Communicatie', nl: 'Spreekt u Engels?', hu: 'Besz\u00E9l angolul?' },
    { cat: 'Communicatie', nl: 'Ik begrijp het niet', hu: 'Nem \u00E9rtem' },
    { cat: 'Communicatie', nl: 'Kunt u dat herhalen?', hu: 'Megism\u00E9teln\u00E9, k\u00E9rem?' },
    { cat: 'Communicatie', nl: 'Kunt u langzamer spreken?', hu: 'Besz\u00E9lne lassabban, k\u00E9rem?' },

    { cat: 'Restaurant', nl: 'De rekening, alstublieft', hu: 'A sz\u00E1ml\u00E1t k\u00E9rem' },
    { cat: 'Restaurant', nl: 'Twee bier, alstublieft', hu: 'K\u00E9t s\u00F6rt k\u00E9rem' },
    { cat: 'Restaurant', nl: 'Water zonder prik', hu: 'Sz\u00E9nsavmentes viz' },
    { cat: 'Restaurant', nl: 'Koffie met melk', hu: 'K\u00E1v\u00E9 tejjel' },
    { cat: 'Restaurant', nl: 'Het menu, alstublieft', hu: 'Az \u00E9tlapot k\u00E9rem' },
    { cat: 'Restaurant', nl: 'Is dit vegetarisch?', hu: 'Ez vegetari\u00E1nus?' },
    { cat: 'Restaurant', nl: 'Het was heerlijk', hu: 'Finom volt' },

    { cat: 'Op Pad', nl: 'Waar is het toilet?', hu: 'Hol van a WC?' },
    { cat: 'Op Pad', nl: 'Hoeveel kost dit?', hu: 'Mennyibe ker\u00FCl?' },
    { cat: 'Op Pad', nl: 'Kan ik met kaart betalen?', hu: 'Fizethetek k\u00E1rty\u00E1val?' },
    { cat: 'Op Pad', nl: 'Waar is het treinstation?', hu: 'Hol van a vas\u00FAt\u00E1llom\u00E1s?' },
    { cat: 'Op Pad', nl: 'Hoe laat vertrekt de trein?', hu: 'Mikor indul a vonat?' },
    { cat: 'Op Pad', nl: 'Een kaartje naar Hungaroring', hu: 'Egy jegyet a Hungaroringre' },
    { cat: 'Op Pad', nl: 'Kunt u een taxi bellen?', hu: 'H\u00EDvna egy taxit?' },

    { cat: 'Noodgeval', nl: 'Help!', hu: 'Seg\u00EDts\u00E9g!' },
    { cat: 'Noodgeval', nl: 'Bel de politie', hu: 'H\u00EDvja a rend\u0151rs\u00E9get' },
    { cat: 'Noodgeval', nl: 'Bel een ambulance', hu: 'H\u00EDvjon ment\u0151t' },
    { cat: 'Noodgeval', nl: 'Ik heb een dokter nodig', hu: 'Orvosra van sz\u00FCks\u00E9gem' },
    { cat: 'Noodgeval', nl: 'Ik ben verdwaald', hu: 'Eltevedtem' }
  ];

  /* ---------- History helpers ---------- */
  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch (e) {}
  }

  function addToHistory(nl, hu) {
    if (!nl || !hu) return;
    var list = loadHistory();
    // Remove duplicates
    list = list.filter(function (item) { return item.nl !== nl; });
    list.unshift({ nl: nl, hu: hu, ts: Date.now() });
    if (list.length > MAX_HISTORY) list = list.slice(0, MAX_HISTORY);
    saveHistory(list);
  }

  function clearHistory() {
    saveHistory([]);
    renderHistory();
  }

  /* ---------- Translation API ---------- */
  function translate(text, callback) {
    text = (text || '').trim();
    if (!text) return callback('Geen tekst');

    // Check if it's in quick phrases first (instant, no API needed)
    for (var i = 0; i < QUICK_PHRASES.length; i++) {
      if (QUICK_PHRASES[i].nl.toLowerCase() === text.toLowerCase()) {
        return callback(null, QUICK_PHRASES[i].hu);
      }
    }

    var url = API_BASE + '?q=' + encodeURIComponent(text) + '&langpair=nl|hu';
    fetch(url).then(function (res) {
      if (!res.ok) throw new Error('API fout (' + res.status + ')');
      return res.json();
    }).then(function (data) {
      if (data && data.responseData && data.responseData.translatedText) {
        callback(null, data.responseData.translatedText);
      } else {
        callback('Geen vertaling ontvangen');
      }
    }).catch(function (err) {
      callback('Kon niet vertalen: ' + (err.message || err));
    });
  }

  /* ---------- Speech ---------- */
  function speak(text) {
    if (!('speechSynthesis' in window)) {
      alert('Uitspraak wordt niet ondersteund op dit apparaat');
      return;
    }
    window.speechSynthesis.cancel();

    var utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'hu-HU';
    utter.rate = 0.9; // slightly slower for clarity

    // Try to pick a Hungarian voice if available
    var voices = window.speechSynthesis.getVoices();
    var huVoice = voices.find(function (v) { return v.lang && v.lang.indexOf('hu') === 0; });
    if (huVoice) utter.voice = huVoice;

    window.speechSynthesis.speak(utter);
  }

  // Pre-load voices (some browsers need this async trigger)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', function () {
        window.speechSynthesis.getVoices();
      });
    }
  }

  /* ---------- Voice recognition (NL speech -> text) ---------- */
  var recognition = null;
  var isListening = false;

  function getSpeechRecognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function setVoiceStatus(text, state) {
    var el = document.getElementById('translate-voice-status');
    if (!el) return;
    if (!text) {
      el.classList.add('hidden');
      el.textContent = '';
      el.dataset.state = '';
      return;
    }
    el.classList.remove('hidden');
    el.textContent = text;
    el.dataset.state = state || '';
  }

  function setMicListening(on) {
    var btn = document.getElementById('translate-mic');
    if (!btn) return;
    if (on) btn.classList.add('is-listening');
    else btn.classList.remove('is-listening');
  }

  function stopListening() {
    if (recognition && isListening) {
      try { recognition.stop(); } catch (e) {}
    }
  }

  function startVoiceInput() {
    var SR = getSpeechRecognition();
    if (!SR) {
      alert('Stemherkenning wordt niet ondersteund op dit apparaat.\nTip: gebruik Chrome op Android of Safari op iOS 14.5+');
      return;
    }

    // If already listening — toggle off
    if (isListening) {
      stopListening();
      return;
    }

    // Stop any ongoing Hungarian speech before listening
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();

    try {
      recognition = new SR();
    } catch (e) {
      setVoiceStatus('\u26A0\uFE0F Kon microfoon niet starten', 'error');
      return;
    }

    recognition.lang = 'nl-NL';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    var finalTranscript = '';

    recognition.onstart = function () {
      isListening = true;
      setMicListening(true);
      setVoiceStatus('\uD83C\uDFA4 Luisteren\u2026 spreek nu', 'listening');
      var input = document.getElementById('translate-input');
      if (input) input.value = '';
    };

    recognition.onresult = function (event) {
      var interim = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var r = event.results[i];
        if (r.isFinal) finalTranscript += r[0].transcript;
        else interim += r[0].transcript;
      }
      var input = document.getElementById('translate-input');
      if (input) input.value = (finalTranscript + interim).trim();
      if (interim) setVoiceStatus('\uD83C\uDFA4 \u201C' + interim.trim() + '\u201D', 'listening');
    };

    recognition.onerror = function (event) {
      isListening = false;
      setMicListening(false);
      var msg = 'Fout: ' + event.error;
      if (event.error === 'no-speech') msg = '\u26A0\uFE0F Geen spraak gehoord';
      else if (event.error === 'not-allowed') msg = '\u26A0\uFE0F Microfoon toegang geweigerd';
      else if (event.error === 'audio-capture') msg = '\u26A0\uFE0F Geen microfoon gevonden';
      else if (event.error === 'network') msg = '\u26A0\uFE0F Netwerk vereist voor stemherkenning';
      setVoiceStatus(msg, 'error');
      setTimeout(function () { setVoiceStatus('', ''); }, 3000);
    };

    recognition.onend = function () {
      isListening = false;
      setMicListening(false);
      var text = finalTranscript.trim();
      var input = document.getElementById('translate-input');
      if (input) input.value = text;

      if (text) {
        setVoiceStatus('\u2728 Vertalen\u2026', 'working');
        voiceTranslateAndSpeak(text);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      isListening = false;
      setMicListening(false);
      setVoiceStatus('\u26A0\uFE0F Kon niet starten: ' + (e.message || e), 'error');
    }
  }

  /* Voice mode flow: transcript -> translate -> speak */
  function voiceTranslateAndSpeak(text) {
    translate(text, function (err, hu) {
      if (err) {
        setVoiceStatus('\u26A0\uFE0F ' + err, 'error');
        setTimeout(function () { setVoiceStatus('', ''); }, 3000);
        return;
      }
      showResult(text, hu);
      addToHistory(text, hu);
      renderHistory();
      setVoiceStatus('\uD83D\uDD0A Uitspraak\u2026', 'speaking');
      speak(hu);
      setTimeout(function () { setVoiceStatus('', ''); }, 2500);
    });
  }

  /* ---------- Modal UI ---------- */
  function openModal() {
    var modal = document.getElementById('translate-modal');
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    renderHistory();
    var input = document.getElementById('translate-input');
    if (input) setTimeout(function () { input.focus(); }, 50);
  }

  function closeModal() {
    var modal = document.getElementById('translate-modal');
    if (!modal) return;
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    stopListening();
    setVoiceStatus('', '');
  }

  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderQuickPhrases() {
    var container = document.getElementById('translate-quick');
    if (!container) return;

    // Group by category
    var groups = {};
    QUICK_PHRASES.forEach(function (p) {
      if (!groups[p.cat]) groups[p.cat] = [];
      groups[p.cat].push(p);
    });

    var html = '';
    Object.keys(groups).forEach(function (cat) {
      html += '<div class="translate-quick-cat">' + escapeHTML(cat) + '</div>';
      html += '<div class="translate-quick-grid">';
      groups[cat].forEach(function (p, i) {
        var idx = QUICK_PHRASES.indexOf(p);
        html += '<button class="translate-quick-btn" data-idx="' + idx + '">';
        html += '<span class="translate-quick-nl">' + escapeHTML(p.nl) + '</span>';
        html += '<span class="translate-quick-hu">' + escapeHTML(p.hu) + '</span>';
        html += '</button>';
      });
      html += '</div>';
    });
    container.innerHTML = html;

    // Click = show result + speak
    container.querySelectorAll('.translate-quick-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.idx);
        var p = QUICK_PHRASES[idx];
        if (!p) return;
        showResult(p.nl, p.hu);
        addToHistory(p.nl, p.hu);
        renderHistory();
        speak(p.hu);
      });
    });
  }

  function renderHistory() {
    var container = document.getElementById('translate-history');
    if (!container) return;
    var list = loadHistory();
    if (list.length === 0) {
      container.innerHTML = '<div class="translate-history-empty">Nog geen vertalingen</div>';
      return;
    }
    var html = '<div class="translate-history-header">';
    html += '<span>\u{1F552} Recent</span>';
    html += '<button class="translate-history-clear" id="translate-history-clear-btn">Wissen</button>';
    html += '</div>';
    list.forEach(function (item) {
      html += '<button class="translate-history-item" data-nl="' + escapeHTML(item.nl) + '" data-hu="' + escapeHTML(item.hu) + '">';
      html += '<span class="translate-history-nl">' + escapeHTML(item.nl) + '</span>';
      html += '<span class="translate-history-hu">' + escapeHTML(item.hu) + '</span>';
      html += '</button>';
    });
    container.innerHTML = html;

    var clearBtn = document.getElementById('translate-history-clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', clearHistory);

    container.querySelectorAll('.translate-history-item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showResult(btn.dataset.nl, btn.dataset.hu);
        speak(btn.dataset.hu);
      });
    });
  }

  function showResult(nl, hu) {
    var input = document.getElementById('translate-input');
    var resultBox = document.getElementById('translate-result');
    var resultText = document.getElementById('translate-result-text');
    if (input) input.value = nl;
    if (resultText) resultText.textContent = hu;
    if (resultBox) resultBox.classList.add('visible');
  }

  function handleTranslateClick() {
    var input = document.getElementById('translate-input');
    var btn = document.getElementById('translate-btn');
    var resultText = document.getElementById('translate-result-text');
    var resultBox = document.getElementById('translate-result');
    if (!input || !resultText) return;

    var text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Vertalen...';
    resultText.textContent = '';
    resultBox.classList.add('visible');

    translate(text, function (err, hu) {
      btn.disabled = false;
      btn.textContent = 'Vertaal';
      if (err) {
        resultText.textContent = '\u26A0\uFE0F ' + err;
        return;
      }
      resultText.textContent = hu;
      addToHistory(text, hu);
      renderHistory();
    });
  }

  /* ---------- Init ---------- */
  function init() {
    var fab = document.getElementById('translate-fab');
    if (fab) fab.addEventListener('click', openModal);

    var closeBtn = document.getElementById('translate-close');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    var backdrop = document.getElementById('translate-backdrop');
    if (backdrop) backdrop.addEventListener('click', closeModal);

    var translateBtn = document.getElementById('translate-btn');
    if (translateBtn) translateBtn.addEventListener('click', handleTranslateClick);

    var input = document.getElementById('translate-input');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          handleTranslateClick();
        }
      });
    }

    var speakBtn = document.getElementById('translate-speak');
    if (speakBtn) speakBtn.addEventListener('click', function () {
      var resultText = document.getElementById('translate-result-text');
      if (resultText && resultText.textContent) speak(resultText.textContent);
    });

    var micBtn = document.getElementById('translate-mic');
    if (micBtn) {
      // Hide mic button if API is not supported (e.g. desktop Firefox)
      if (!getSpeechRecognition()) {
        micBtn.style.display = 'none';
      } else {
        micBtn.addEventListener('click', startVoiceInput);
      }
    }

    var copyBtn = document.getElementById('translate-copy');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      var resultText = document.getElementById('translate-result-text');
      if (!resultText || !resultText.textContent) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(resultText.textContent).then(function () {
          copyBtn.textContent = '\u2705 Gekopieerd';
          setTimeout(function () { copyBtn.innerHTML = '\u{1F4CB} Kopieer'; }, 1500);
        });
      }
    });

    // ESC key closes modal
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var modal = document.getElementById('translate-modal');
        if (modal && modal.classList.contains('open')) closeModal();
      }
    });

    renderQuickPhrases();
    renderHistory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.TripTranslate = {
    open: openModal,
    close: closeModal,
    translate: translate,
    speak: speak
  };
})();
