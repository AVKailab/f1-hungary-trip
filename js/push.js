/* ===== push.js - Deadline-herinneringen via Web Push =====
   Flow: gebruiker tikt "Zet herinneringen aan" -> notificatie-permissie ->
   pushManager.subscribe met onze VAPID public key -> subscription + naam
   naar de Worker. De Worker-cron pusht dan een seintje als een race binnen
   24 uur sluit en deze persoon nog niet heeft ingeleverd.

   iOS-quirk: web push werkt op iPhone alleen als de app via "Zet op
   beginscherm" is geïnstalleerd (iOS 16.4+). In Safari-tab tonen we een
   installatie-hint in plaats van de knop. */
(function () {
  'use strict';

  function cfg() { return window.F1_CONFIG || {}; }
  function workerBase() { return (cfg().workerUrl || '').replace(/\/$/, ''); }

  function isSupported() {
    return !!(workerBase() && cfg().vapidPublicKey &&
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
  }

  function iosNeedsInstall() {
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    var standalone = window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    return isIOS && !standalone;
  }

  /* VAPID key: base64url -> Uint8Array (verwacht door pushManager.subscribe) */
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = window.atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  /* Current state: 'unsupported' | 'ios-install' | 'denied' | 'on' | 'off' */
  function getState(callback) {
    if (!isSupported()) {
      callback(iosNeedsInstall() ? 'ios-install' : 'unsupported');
      return;
    }
    if (Notification.permission === 'denied') { callback('denied'); return; }
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription();
    }).then(function (sub) {
      callback(sub ? 'on' : 'off');
    }).catch(function () {
      callback('off');
    });
  }

  function enable(owner, callback) {
    if (!isSupported()) { callback('Niet ondersteund op dit apparaat'); return; }
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { callback('Toestemming geweigerd'); return; }
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(cfg().vapidPublicKey)
        });
      }).then(function (sub) {
        return fetch(workerBase() + '/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub.toJSON(), owner: owner })
        }).then(function (res) {
          if (!res.ok) throw new Error('Registratie mislukt (' + res.status + ')');
          callback(null);
        });
      }).catch(function (e) {
        callback(e.message || 'Kon niet aanmelden');
      });
    });
  }

  function disable(callback) {
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription();
    }).then(function (sub) {
      if (!sub) { callback(null); return; }
      var endpoint = sub.endpoint;
      sub.unsubscribe().then(function () {
        // Best effort — de Worker ruimt dode endpoints toch op bij 410
        fetch(workerBase() + '/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: endpoint })
        }).catch(function () {});
        callback(null);
      });
    }).catch(function (e) {
      callback(e.message || 'Kon niet afmelden');
    });
  }

  window.TripPush = {
    isSupported: isSupported,
    iosNeedsInstall: iosNeedsInstall,
    getState: getState,
    enable: enable,
    disable: disable
  };
})();
