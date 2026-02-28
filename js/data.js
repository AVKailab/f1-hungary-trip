/* ===== data.js - Static constants ===== */
(function () {
  'use strict';

  var RACE_SESSIONS = [
    {
      id: 'fp1',
      name: 'Vrije Training 1',
      shortName: 'VT1',
      date: '2026-07-24T13:30:00+02:00',
      duration: 60,
      day: 'Vrijdag'
    },
    {
      id: 'fp2',
      name: 'Vrije Training 2',
      shortName: 'VT2',
      date: '2026-07-24T17:00:00+02:00',
      duration: 60,
      day: 'Vrijdag'
    },
    {
      id: 'fp3',
      name: 'Vrije Training 3',
      shortName: 'VT3',
      date: '2026-07-25T12:30:00+02:00',
      duration: 60,
      day: 'Zaterdag'
    },
    {
      id: 'quali',
      name: 'Kwalificatie',
      shortName: 'QUAL',
      date: '2026-07-25T16:00:00+02:00',
      duration: 60,
      day: 'Zaterdag'
    },
    {
      id: 'race',
      name: 'Race',
      shortName: 'RACE',
      date: '2026-07-26T15:00:00+02:00',
      duration: 120,
      day: 'Zondag'
    }
  ];

  var HUNGARORING = { lat: 47.5789, lng: 19.2486, name: 'Hungaroring' };
  var BUDAPEST_CENTER = { lat: 47.4979, lng: 19.0402, name: 'Budapest centrum' };

  var TRIP_DATES = [
    '2026-07-23',
    '2026-07-24',
    '2026-07-25',
    '2026-07-26',
    '2026-07-27'
  ];

  var DAY_NAMES = {
    '2026-07-23': 'Woensdag 23 juli',
    '2026-07-24': 'Donderdag 24 juli',
    '2026-07-25': 'Vrijdag 25 juli',
    '2026-07-26': 'Zaterdag 26 juli',
    '2026-07-27': 'Zondag 27 juli'
  };

  var TRANSPORT_OPTIONS = [
    {
      mode: 'Openbaar Vervoer',
      icon: '\uD83D\uDE86',
      description: 'Metro M2 naar \u00D6rs vez\u00E9r tere \u2192 H\u00C9V H8 trein naar Kerepes \u2192 Gratis shuttle naar Gate 3',
      duration: '~90 min',
      cost: 'Budapest 24-uurs pas aanbevolen',
      tips: 'Neem extra tijd. Shuttles rijden vanaf 07:00. Check de BKK app voor live updates.'
    },
    {
      mode: 'City Shuttle',
      icon: '\uD83D\uDE90',
      description: 'Directe minibus vanaf Heldenplein (H\u0151s\u00F6k tere) naar Hungaroring',
      duration: '~30-40 min',
      cost: '~\u20AC20 enkele reis',
      tips: 'Tickets bij de opstapplaats (niet online beschikbaar). Retour vanaf 16:00.'
    },
    {
      mode: 'Taxi',
      icon: '\uD83D\uDE95',
      description: 'Direct van hotel naar circuit. Officieel: F\u0151taxi app of bel +36 1 222 2222',
      duration: '~30 min',
      cost: '~\u20AC40 enkele reis',
      tips: 'Gebruik de F\u0150TAXI app. Verwacht 1-2 uur wachttijd na de race. Loop naar Mogyor\u00F3d dorp voor snellere pickup.'
    },
    {
      mode: 'Auto',
      icon: '\uD83D\uDE97',
      description: 'Via de M3 snelweg vanuit Budapest',
      duration: '25-30 min',
      cost: 'Gratis parkeren (vol = vol)',
      tips: 'Kom vroeg. Verwacht flink verkeer na de sessies. Tolsticker (e-vignette) nodig voor de snelweg.'
    }
  ];

  var TICKETS = {
    tribune: 'Grand Prix 1 Tribune (Max Verstappen Tribune)',
    sector: 'E',
    rij: '9',
    stoelen: ['4', '5', '6', '7'],
    notes: ''
  };

  var PERSON_EMOJIS = [
    '\uD83C\uDFCE\uFE0F', '\uD83C\uDFC1', '\uD83E\uDDD1\u200D\uD83D\uDE80',
    '\uD83D\uDE0E', '\uD83E\uDD73', '\uD83E\uDDD1\u200D\uD83D\uDCBB',
    '\uD83D\uDC68\u200D\uD83D\uDE92', '\uD83E\uDDB8', '\uD83E\uDDD9',
    '\uD83D\uDC7D', '\uD83E\uDD16', '\uD83C\uDFC6'
  ];

  var ROUTE_LEGS = [
    {
      id: 'walk',
      icon: '\uD83D\uDEB6',
      title: 'Lopen naar Keleti',
      subtitle: 'Hotel \u2192 Keleti p\u00E1lyaudvar',
      duration: '~5 min',
      distance: '~400m',
      details: 'Loop via Garay t\u00E9r richting het station. Volg de borden naar de M2 metro ingang.',
      tips: 'De ingang naar de M2 metro is aan de zuidkant van het station.'
    },
    {
      id: 'metro',
      icon: '\uD83D\uDE87',
      title: 'M2 Metro (rode lijn)',
      subtitle: 'Keleti \u2192 \u00D6rs vez\u00E9r tere',
      duration: '~8 min',
      distance: '4 haltes',
      details: 'Richting \u00D6rs vez\u00E9r tere. Haltes: Keleti \u2192 Pusk\u00E1s Ferenc Stadion \u2192 Pillang\u00F3 utca \u2192 \u00D6rs vez\u00E9r tere.',
      tips: 'De metro rijdt elke 2-5 minuten. Valideer je kaartje bij de gele automaten.'
    },
    {
      id: 'hev',
      icon: '\uD83D\uDE83',
      title: 'H\u00C9V H8 trein',
      subtitle: '\u00D6rs vez\u00E9r tere \u2192 Kerepes',
      duration: '~25 min',
      distance: null,
      details: 'Richting G\u00F6d\u00F6ll\u0151. Stap uit bij halte Kerepes. Let op: de H\u00C9V vertrekt vanaf het bovengrondse perron naast het metrostation.',
      tips: 'De Budapest-kaart is geldig op de H\u00C9V binnen de stadsgrenzen. Voor de rit voorbij de grens heb je een aanvullend kaartje nodig (~350 HUF).'
    },
    {
      id: 'shuttle',
      icon: '\uD83D\uDE8C',
      title: 'Gratis F1 Shuttle',
      subtitle: 'Kerepes \u2192 Hungaroring Gate 3',
      duration: '~10 min',
      distance: null,
      details: 'Gratis shuttlebus georganiseerd door de Hungaroring. Rijdt continu op raceweekend.',
      tips: 'Shuttles rijden vanaf ~3 uur voor de eerste sessie. Volg de borden en de menigte bij het station Kerepes.'
    }
  ];

  var DEPARTURE_BUFFERS = {
    fp1: 75,
    fp2: 75,
    fp3: 75,
    quali: 90,
    race: 120
  };

  var TRAVEL_TIPS = [
    {
      icon: '\uD83D\uDCB3',
      title: 'Budapest 24/72-uurs kaart',
      text: 'Koop een Budapest Travel Card voor onbeperkt OV. Verkrijgbaar bij BKK automaten in het metrostation.'
    },
    {
      icon: '\uD83D\uDCF1',
      title: 'BKK Fut\u00E1r app',
      text: 'Download de BKK Fut\u00E1r app voor live vertrektijden en routeplanning.'
    },
    {
      icon: '\uD83D\uDCA7',
      title: 'Water & zonnebrand',
      text: 'Juli in Budapest is heet (30-35\u00B0C). Neem water en zonnebrand mee. Bij het circuit is water te koop maar duur.'
    },
    {
      icon: '\u26A1',
      title: 'Vroeg vertrekken op racedag',
      text: 'Op zondag is het extreem druk. Vertrek ruim 2 uur voor de start. De shuttle-wachtrij kan lang zijn.'
    }
  ];

  var F1_DRIVERS = [
    'Verstappen', 'Norris', 'Piastri', 'Leclerc', 'Hamilton',
    'Russell', 'Antonelli', 'Sainz', 'Albon', 'Alonso',
    'Stroll', 'Gasly', 'Doohan', 'Ocon', 'Bearman',
    'H\u00FClkenberg', 'Bortoleto', 'Tsunoda', 'Hadjar', 'Lawson'
  ];

  var PREDICTION_SCORING = {
    exact: [10, 8, 6],
    wrongPos: 3
  };

  // Expose to global scope
  window.TripData = {
    RACE_SESSIONS: RACE_SESSIONS,
    HUNGARORING: HUNGARORING,
    BUDAPEST_CENTER: BUDAPEST_CENTER,
    TRIP_DATES: TRIP_DATES,
    DAY_NAMES: DAY_NAMES,
    TRANSPORT_OPTIONS: TRANSPORT_OPTIONS,
    TICKETS: TICKETS,
    PERSON_EMOJIS: PERSON_EMOJIS,
    ROUTE_LEGS: ROUTE_LEGS,
    DEPARTURE_BUFFERS: DEPARTURE_BUFFERS,
    TRAVEL_TIPS: TRAVEL_TIPS,
    F1_DRIVERS: F1_DRIVERS,
    PREDICTION_SCORING: PREDICTION_SCORING
  };
})();
