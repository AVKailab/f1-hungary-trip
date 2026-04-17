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

  /* ---------- Car Info ---------- */
  var CAR_INFO = {
    model: 'Ford Mustang Mach-E',
    range: 450,
    unit: 'km',
    maxHeight: '1.80m',
    note: 'Parkeergarage hotel max 1.80m \u2014 check hoogte!'
  };

  /* ---------- Roadtrip Legs (NL \u2192 Budapest, ~1.300km) ---------- */
  var ROADTRIP_LEGS = [
    {
      id: 'rt-1',
      icon: '\uD83D\uDE97',
      type: 'drive',
      title: 'Nederland \u2192 K\u00F6ln',
      subtitle: 'Start vanuit NL richting Duitsland',
      duration: '~2,5 uur',
      distance: '~250 km',
      details: 'Via A2/A3 richting K\u00F6ln. Geen vignet nodig in Duitsland.',
      tips: 'Tank vol voor vertrek. Duitse Autobahn heeft wisselende snelheidslimieten.'
    },
    {
      id: 'rt-charge1',
      icon: '\u26A1',
      type: 'charge',
      title: 'Laadstop K\u00F6ln omgeving',
      subtitle: 'Snelladen ~30 min',
      duration: '~30 min',
      distance: null,
      details: 'Snellaadstation langs de Autobahn. Zoek via ABRP of Plugsurfing.',
      tips: 'Plan laadstop via A Better Route Planner (ABRP) app. Neem iets te eten mee of zoek een Rasthof.'
    },
    {
      id: 'rt-2',
      icon: '\uD83D\uDE97',
      type: 'drive',
      title: 'K\u00F6ln \u2192 Passau',
      subtitle: 'Door Duitsland richting Oostenrijkse grens',
      duration: '~5 uur',
      distance: '~530 km',
      details: 'Via A3/A9 richting Passau. Na M\u00FCnchen wordt het rustiger.',
      tips: 'Koop v\u00F3\u00F3r Passau de Oostenrijkse digitale vignet (e-Vignette) online op asfinag.at.'
    },
    {
      id: 'rt-charge2',
      icon: '\u26A1',
      type: 'charge',
      title: 'Laadstop Passau / grensgebied',
      subtitle: 'Snelladen ~30 min',
      duration: '~30 min',
      distance: null,
      details: 'Laadstation bij Passau of net over de Oostenrijkse grens. IONITY stations langs A1/A3.',
      tips: 'Laad hier goed bij voor de laatste etappe naar Budapest. Check de laadhoeveelheid \u2014 je hebt nog ~300km te gaan.'
    },
    {
      id: 'rt-overnight',
      icon: '\uD83C\uDFE8',
      type: 'overnight',
      title: 'Overnachting onderweg (optioneel)',
      subtitle: 'Bijvoorbeeld in Linz of Wenen',
      duration: 'Overnachting',
      distance: null,
      details: 'Als je de rit wilt splitsen, is Linz of Wenen een goede tussenstop. Boek een hotel met EV-lader.',
      tips: 'Als je doorrijdt: reken op ~10 uur totale rijtijd + laadstops. Vroeg vertrekken!'
    },
    {
      id: 'rt-3',
      icon: '\uD83D\uDE97',
      type: 'drive',
      title: 'Passau \u2192 Budapest',
      subtitle: 'Via Wenen en Bratislava naar Hongarije',
      duration: '~4 uur',
      distance: '~450 km',
      details: 'Via A1 (Oostenrijk) \u2192 A4 \u2192 M1 (Hongarije). Koop Hongaarse e-vignet op ematrica.hu.',
      tips: 'Hongaarse vignet (e-matrica) is verplicht op snelwegen. Online kopen op ematrica.hu of bij tankstations.'
    },
    {
      id: 'rt-arrive',
      icon: '\uD83C\uDFC1',
      type: 'arrive',
      title: 'Aankomst Budapest',
      subtitle: 'Rooftop City Residence \u2014 Garay t\u00E9r 20',
      duration: null,
      distance: '~1.300 km totaal',
      details: 'Parkeren bij het hotel of in de buurt. Let op: max hoogte parkeergarage is 1.80m!',
      tips: 'Check of je auto past in de garage. Alternatief: straatparkeren (betaald, zones gelden overdag).'
    }
  ];

  /* ---------- Circuit Route Heen (Hotel \u2192 Hungaroring Gate 6) ---------- */
  var CIRCUIT_ROUTE_TO = [
    {
      id: 'ct-walk',
      icon: '\uD83D\uDEB6',
      title: 'Lopen naar Keleti',
      subtitle: 'Hotel \u2192 Keleti p\u00E1lyaudvar',
      duration: '~5 min',
      distance: '~400m',
      details: 'Loop via Garay t\u00E9r richting het station. Volg de borden naar de M2 metro ingang.',
      tips: 'De ingang naar de M2 metro is aan de zuidkant van het station.'
    },
    {
      id: 'ct-metro',
      icon: '\uD83D\uDE87',
      title: 'M2 Metro (rode lijn)',
      subtitle: 'Keleti \u2192 \u00D6rs vez\u00E9r tere',
      duration: '~8 min',
      distance: '4 haltes',
      details: 'Richting \u00D6rs vez\u00E9r tere. Haltes: Keleti \u2192 Pusk\u00E1s Ferenc Stadion \u2192 Pillang\u00F3 utca \u2192 \u00D6rs vez\u00E9r tere.',
      tips: 'De metro rijdt elke 2-5 minuten. Valideer je kaartje bij de gele automaten.'
    },
    {
      id: 'ct-hev',
      icon: '\uD83D\uDE83',
      title: 'H\u00C9V H8 trein',
      subtitle: '\u00D6rs vez\u00E9r tere \u2192 Szilasliget',
      duration: '~20 min',
      distance: null,
      details: 'Richting G\u00F6d\u00F6ll\u0151. Stap uit bij halte Szilasliget (niet Kerepes!). Dit is de dichtstbijzijnde halte voor Gate 6.',
      tips: 'Szilasliget is 1 halte v\u00F3\u00F3r Kerepes. Kijk goed naar de halte-aanduidingen. Budapest-kaart is geldig op de H\u00C9V binnen de stadsgrenzen.'
    },
    {
      id: 'ct-walk2',
      icon: '\uD83D\uDEB6',
      title: 'Lopen naar Gate 6',
      subtitle: 'Szilasliget \u2192 Hungaroring Gate 6',
      duration: '~15 min',
      distance: '~1 km',
      details: 'Loop vanaf het station richting het circuit. Volg de borden en de menigte. Gate 6 is aan de noordkant van het circuit.',
      tips: 'Gate 6 is het dichtst bij de Max Verstappen Tribune (Grand Prix 1). Neem water mee, de wandeling is in de zon.'
    }
  ];

  /* ---------- Circuit Route Terug (Hungaroring \u2192 Hotel) ---------- */
  var CIRCUIT_ROUTE_RETURN = [
    {
      id: 'cr-shuttle',
      icon: '\uD83D\uDE8C',
      title: 'Shuttle naar G\u00F6d\u00F6ll\u0151',
      subtitle: 'Gate 3 \u2192 G\u00F6d\u00F6ll\u0151 station',
      duration: '~15-20 min',
      distance: null,
      details: 'Na de sessie loopt iedereen naar Gate 3 voor de gratis shuttlebussen. Deze brengen je naar G\u00F6d\u00F6ll\u0151 H\u00C9V station.',
      tips: '\u26A0\uFE0F Na de race: verwacht 30-60 min wachtrij. Na de kwalificatie is het veel rustiger. Tip: blijf nog even zitten na de race, de eerste golf is het drukst.'
    },
    {
      id: 'cr-s80',
      icon: '\uD83D\uDE83',
      title: 'S80 trein naar Keleti',
      subtitle: 'G\u00F6d\u00F6ll\u0151 \u2192 Budapest Keleti',
      duration: '~35 min',
      distance: null,
      details: 'De S80 trein rijdt direct van G\u00F6d\u00F6ll\u0151 naar Budapest Keleti. Alternatief: H\u00C9V H8 naar \u00D6rs vez\u00E9r tere + M2 metro.',
      tips: 'De S80 is sneller dan de H\u00C9V + M2 combo. Rijdt tot ~23:00. Check vertrektijden op elvira.mav-start.hu of de M\u00C1V app.'
    }
  ];

  /* ---------- Circuit Regels & Veiligheid ---------- */
  var CIRCUIT_RULES = [
    {
      icon: '\uD83D\uDCA7',
      title: 'Vloeistoffen max 1 liter',
      text: 'Je mag geen containers groter dan 1 liter meenemen. Kleine flesjes water zijn toegestaan. Water is te koop op het circuit (duur).'
    },
    {
      icon: '\uD83D\uDCB3',
      title: 'Cashless betalen',
      text: 'Het circuit is volledig cashless. Alleen kaartbetalingen geaccepteerd (contactloos werkt het snelst). Geen contant geld nodig.'
    },
    {
      icon: '\u26A0\uFE0F',
      title: 'Pas op voor honey traps',
      text: 'In het uitgaansleven van Budapest zijn er bars die extreem hoge rekeningen presenteren (soms \u20AC500+). Ga alleen naar plekken met duidelijke menu\'s en prijzen.'
    },
    {
      icon: '\uD83D\uDE95',
      title: 'Alleen offici\u00EBle taxi\'s',
      text: 'Gebruik alleen de F\u0150TAXI app of bel +36 1 222 2222. Stap nooit in bij onoffici\u00EBle taxi\'s die je aanspreken \u2014 die rekenen veel te veel.'
    }
  ];

  /* ---------- Financi\u00EBn Configuratie ---------- */
  var FINANCES_CONFIG = {
    fixedCosts: [
      { label: 'Hotel (4 nachten)', amount: 1055.74, paid: true, icon: '\uD83C\uDFE8' },
      { label: 'Tickets (4x)', amount: 1156.00, paid: true, icon: '\uD83C\uDFAB' }
    ],
    sharedCosts: [
      { label: 'Vignet Oostenrijk (10-daags)', amount: 11.50, icon: '\uD83C\uDDE6\uD83C\uDDF9' },
      { label: 'Vignet Hongarije (10-daags)', amount: 5.20, icon: '\uD83C\uDDED\uD83C\uDDFA' },
      { label: 'Laden onderweg (geschat)', amount: 80.00, icon: '\u26A1' },
      { label: 'Parkeren Budapest (4 dagen)', amount: 40.00, icon: '\uD83C\uDD7F\uFE0F' }
    ]
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
    PREDICTION_SCORING: PREDICTION_SCORING,
    CAR_INFO: CAR_INFO,
    ROADTRIP_LEGS: ROADTRIP_LEGS,
    CIRCUIT_ROUTE_TO: CIRCUIT_ROUTE_TO,
    CIRCUIT_ROUTE_RETURN: CIRCUIT_ROUTE_RETURN,
    CIRCUIT_RULES: CIRCUIT_RULES,
    FINANCES_CONFIG: FINANCES_CONFIG
  };
})();
