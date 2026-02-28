/* ===== map.js - Leaflet map integration ===== */
(function () {
  'use strict';

  var map = null;
  var markers = {};
  var routeLine = null;
  var settingHotelPin = false;

  function createIcon(emoji) {
    return L.divIcon({
      className: 'custom-marker',
      html: '<span style="font-size:28px">' + emoji + '</span>',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16]
    });
  }

  function initMap() {
    if (map) return;

    var mapEl = document.getElementById('map-container');
    if (!mapEl) return;

    // Height is handled by CSS flex layout

    map = L.map('map-container').setView([47.54, 19.15], 11);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    // Hungaroring marker
    var hungaroring = window.TripData.HUNGARORING;
    markers.hungaroring = L.marker([hungaroring.lat, hungaroring.lng], {
      icon: createIcon('\uD83C\uDFC1')
    }).addTo(map).bindPopup(
      '<strong>\uD83C\uDFC1 Hungaroring</strong><br>Formula 1 Hungarian Grand Prix<br>Mogyor\u00F3d, Hongarije'
    );

    // Load hotel marker
    var data = window.TripStorage.loadData();
    if (data.hotel.lat && data.hotel.lng) {
      addHotelMarker(data.hotel);
    }

    // Load restaurant markers
    if (data.dining.savedRestaurants) {
      data.dining.savedRestaurants.forEach(function (r) {
        if (r.lat && r.lng) addRestaurantMarker(r);
      });
    }

    // Map click handler for hotel pin setting
    map.on('click', function (e) {
      if (!settingHotelPin) return;

      var data = window.TripStorage.loadData();
      data.hotel.lat = e.latlng.lat;
      data.hotel.lng = e.latlng.lng;
      window.TripStorage.saveData(data);

      addHotelMarker(data.hotel);
      setSettingHotelPin(false);
    });

    // Fit all button
    var fitBtn = document.getElementById('map-fit-all');
    if (fitBtn) {
      fitBtn.addEventListener('click', fitAll);
    }

    // Set hotel pin button
    var hotelBtn = document.getElementById('map-set-hotel');
    if (hotelBtn) {
      hotelBtn.addEventListener('click', function () {
        setSettingHotelPin(!settingHotelPin);
      });
    }
  }

  function addHotelMarker(hotel) {
    if (!map) return;
    if (markers.hotel) map.removeLayer(markers.hotel);

    markers.hotel = L.marker([hotel.lat, hotel.lng], {
      icon: createIcon('\uD83C\uDFE8')
    }).addTo(map).bindPopup(
      '<strong>\uD83C\uDFE8 ' + (hotel.name || 'Hotel') + '</strong>' +
      (hotel.address ? '<br>' + hotel.address : '')
    );

    updateRouteLine();
  }

  function addRestaurantMarker(restaurant) {
    if (!map) return;
    var key = 'restaurant_' + restaurant.name;
    if (markers[key]) map.removeLayer(markers[key]);

    markers[key] = L.marker([restaurant.lat, restaurant.lng], {
      icon: createIcon('\uD83C\uDF7D\uFE0F')
    }).addTo(map).bindPopup(
      '<strong>\uD83C\uDF7D\uFE0F ' + restaurant.name + '</strong>' +
      (restaurant.cuisine ? '<br>' + restaurant.cuisine : '')
    );
  }

  function updateRouteLine() {
    if (routeLine) {
      map.removeLayer(routeLine);
      routeLine = null;
    }

    var data = window.TripStorage.loadData();
    if (data.hotel.lat && data.hotel.lng) {
      var hungaroring = window.TripData.HUNGARORING;
      routeLine = L.polyline(
        [[data.hotel.lat, data.hotel.lng], [hungaroring.lat, hungaroring.lng]],
        { color: '#E10600', weight: 2, dashArray: '8, 8', opacity: 0.6 }
      ).addTo(map);
    }
  }

  function fitAll() {
    if (!map) return;
    var bounds = [];
    Object.keys(markers).forEach(function (key) {
      var m = markers[key];
      if (m && m.getLatLng) {
        bounds.push(m.getLatLng());
      }
    });
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  function setSettingHotelPin(active) {
    settingHotelPin = active;
    var hint = document.getElementById('map-set-hotel-hint');
    var btn = document.getElementById('map-set-hotel');

    if (active) {
      if (hint) hint.classList.remove('hidden');
      if (btn) btn.classList.add('active');
      if (map) map.getContainer().style.cursor = 'crosshair';
    } else {
      if (hint) hint.classList.add('hidden');
      if (btn) btn.classList.remove('active');
      if (map) map.getContainer().style.cursor = '';
    }
  }

  function refreshMap() {
    if (map) {
      setTimeout(function () {
        map.invalidateSize();
      }, 100);
    }
  }

  function showLocation(lat, lng) {
    if (!map) initMap();
    if (map) {
      map.setView([lat, lng], 15);
    }
  }

  window.TripMap = {
    initMap: initMap,
    addHotelMarker: addHotelMarker,
    addRestaurantMarker: addRestaurantMarker,
    fitAll: fitAll,
    refreshMap: refreshMap,
    showLocation: showLocation
  };
})();
