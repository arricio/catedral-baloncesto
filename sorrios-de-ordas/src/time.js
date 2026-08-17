/* ============================================================================
   SORRÍOS DE ORDÁS — time.js
   Reloj del juego, calendario de cuatro estaciones y meteorología
   (sol, nubes, lluvia, tormenta y nieve) con su curva de luz.
   ========================================================================== */
(function (global) {
  'use strict';
  var G = global.SORRIOS, M = G.M, D = G.DATA;

  var DAYS_PER_SEASON = 28;
  var MINUTES_PER_SECOND = 40 / 60;   // 1 min de juego ≈ 1,5 s reales
  var WAKE_HOUR = 6, COLLAPSE_HOUR = 26; // 26 = 2:00 de la madrugada

  // Probabilidades de tiempo por estación: [sol, nublado, lluvia, tormenta, nieve]
  var WEATHER_TABLE = [
    [0.42, 0.24, 0.28, 0.06, 0.00], // primavera
    [0.62, 0.20, 0.12, 0.06, 0.00], // verano
    [0.36, 0.30, 0.28, 0.06, 0.00], // otoño
    [0.30, 0.28, 0.10, 0.02, 0.30]  // invierno
  ];
  var WEATHER_NAMES = {
    sol: 'Despejado', nublado: 'Nublado', lluvia: 'Lluvia',
    tormenta: 'Tormenta', nieve: 'Nieve'
  };
  var WEATHER_KEYS = ['sol', 'nublado', 'lluvia', 'tormenta', 'nieve'];

  function Clock() {
    this.minutes = WAKE_HOUR * 60;  // minutos desde medianoche
    this.day = 1;                    // 1..28
    this.season = 0;                 // 0..3
    this.year = 1;
    this.weekday = 0;
    this.weather = 'sol';
    this.tomorrow = 'sol';
    this.paused = false;
    this.acc = 0;
    this.dayCount = 1;               // días totales jugados
    this._lightning = 0;
    this.rainT = 0;
  }

  Clock.prototype.hour = function () { return Math.floor(this.minutes / 60); };
  Clock.prototype.minute = function () { return Math.floor(this.minutes % 60); };
  Clock.prototype.timeString = function () {
    var h = Math.floor(this.minutes / 60) % 24;
    return G.fmtTime(h, this.minute());
  };
  Clock.prototype.dateString = function () {
    return D.DAY_NAMES[this.weekday] + ' ' + this.day + ' de ' + D.SEASON_NAMES[this.season] + ', año ' + this.year;
  };
  Clock.prototype.seasonName = function () { return D.SEASON_NAMES[this.season]; };
  Clock.prototype.weatherName = function () { return WEATHER_NAMES[this.weather]; };

  Clock.prototype.update = function (dt) {
    if (this.paused) return null;
    this.acc += dt * MINUTES_PER_SECOND * 60;
    var events = null;
    while (this.acc >= 1) {
      this.acc -= 1;
      this.minutes += 1;
      if (this.minutes >= COLLAPSE_HOUR * 60) {
        events = events || {};
        events.collapse = true;
        this.minutes = COLLAPSE_HOUR * 60;
        break;
      }
    }
    if (this.weather === 'tormenta') {
      this._lightning -= dt;
      if (this._lightning <= 0) {
        this._lightning = M.rndF(6, 18);
        events = events || {};
        events.lightning = true;
      }
    }
    return events;
  };

  // Avanza al día siguiente (al dormir o desmayarse).
  Clock.prototype.nextDay = function (rnd) {
    this.day++;
    this.dayCount++;
    this.weekday = (this.weekday + 1) % 7;
    if (this.day > DAYS_PER_SEASON) {
      this.day = 1;
      this.season++;
      if (this.season > 3) { this.season = 0; this.year++; }
    }
    this.minutes = WAKE_HOUR * 60;
    this.weather = this.tomorrow;
    this.tomorrow = this.rollWeather(rnd);
    return this;
  };

  Clock.prototype.rollWeather = function (rnd) {
    var r = (rnd ? rnd() : Math.random());
    var table = WEATHER_TABLE[this.season], acc = 0;
    for (var i = 0; i < table.length; i++) {
      acc += table[i];
      if (r < acc) return WEATHER_KEYS[i];
    }
    return 'sol';
  };

  Clock.prototype.isRaining = function () { return this.weather === 'lluvia' || this.weather === 'tormenta'; };
  Clock.prototype.isSnowing = function () { return this.weather === 'nieve'; };
  Clock.prototype.wetGround = function () { return this.isRaining(); };

  // Amanecer/anochecer varían con la estación (días largos en verano).
  Clock.prototype.sunTimes = function () {
    var s = this.season;
    var sunrise = [6.5, 6.0, 7.2, 8.0][s];
    var sunset  = [20.5, 21.5, 19.5, 18.0][s];
    return { sunrise: sunrise, sunset: sunset };
  };

  // 0 = plena noche, 1 = pleno día.
  Clock.prototype.daylight = function () {
    var h = this.minutes / 60;
    var st = this.sunTimes();
    var fade = 1.2;
    if (h < st.sunrise - fade || h > st.sunset + fade) return 0;
    if (h < st.sunrise + fade * 0.4) return M.smooth(M.clamp((h - (st.sunrise - fade)) / (fade * 1.4), 0, 1));
    if (h > st.sunset - fade * 0.4) return M.smooth(M.clamp(((st.sunset + fade) - h) / (fade * 1.4), 0, 1));
    return 1;
  };

  Clock.prototype.isNight = function () { return this.daylight() < 0.25; };

  // Color de la luz ambiente que se multiplica sobre la escena.
  Clock.prototype.ambient = function () {
    var d = this.daylight();
    var h = this.minutes / 60;
    var st = this.sunTimes();
    // Noche azulada -> amanecer cálido -> día neutro -> atardecer anaranjado
    var night = [0.30, 0.34, 0.62];
    var dawn  = [1.02, 0.80, 0.66];
    var day   = [1.0, 1.0, 1.0];
    var dusk  = [1.05, 0.74, 0.56];

    var col;
    if (d <= 0) col = night;
    else if (d >= 1) col = day;
    else {
      var warm = (h < 12) ? dawn : dusk;
      var t = d;
      var a = [M.lerp(night[0], warm[0], M.smooth(Math.min(1, t * 1.8))),
               M.lerp(night[1], warm[1], M.smooth(Math.min(1, t * 1.8))),
               M.lerp(night[2], warm[2], M.smooth(Math.min(1, t * 1.8)))];
      col = [M.lerp(a[0], day[0], M.smooth(Math.max(0, (t - 0.45) / 0.55))),
             M.lerp(a[1], day[1], M.smooth(Math.max(0, (t - 0.45) / 0.55))),
             M.lerp(a[2], day[2], M.smooth(Math.max(0, (t - 0.45) / 0.55)))];
    }

    // El tiempo modula el brillo y la saturación
    var w = this.weather;
    var k = 1;
    if (w === 'nublado') k = 0.86;
    else if (w === 'lluvia') k = 0.72;
    else if (w === 'tormenta') k = 0.58;
    else if (w === 'nieve') k = 0.90;
    var desat = (w === 'lluvia' || w === 'tormenta') ? 0.35 : (w === 'nublado' ? 0.18 : 0);
    var avg = (col[0] + col[1] + col[2]) / 3;
    return [
      M.lerp(col[0], avg, desat) * k,
      M.lerp(col[1], avg, desat) * k,
      M.lerp(col[2], avg, desat) * k * (w === 'nieve' ? 1.04 : 1)
    ];
  };

  // Color del cielo (fondo por debajo del terreno y niebla del horizonte).
  Clock.prototype.skyColor = function () {
    var d = this.daylight();
    var h = this.minutes / 60;
    var Art = G.Art;
    var night = '#101a2e', day = '#8fc8e8', warm = (h < 12) ? '#f0b47a' : '#e88a5a';
    var c = Art.mix(night, warm, M.smooth(Math.min(1, d * 1.9)));
    c = Art.mix(c, day, M.smooth(Math.max(0, (d - 0.45) / 0.55)));
    if (this.weather === 'nublado') c = Art.mix(c, '#9aa0a8', 0.35);
    if (this.isRaining()) c = Art.mix(c, '#5a6470', 0.55);
    if (this.weather === 'nieve') c = Art.mix(c, '#c8d4de', 0.5);
    return c;
  };

  Clock.prototype.save = function () {
    return {
      minutes: this.minutes, day: this.day, season: this.season, year: this.year,
      weekday: this.weekday, weather: this.weather, tomorrow: this.tomorrow, dayCount: this.dayCount
    };
  };
  Clock.prototype.load = function (s) {
    if (!s) return this;
    this.minutes = s.minutes; this.day = s.day; this.season = s.season; this.year = s.year;
    this.weekday = s.weekday; this.weather = s.weather; this.tomorrow = s.tomorrow;
    this.dayCount = s.dayCount || 1;
    return this;
  };

  G.Time = {
    Clock: Clock,
    DAYS_PER_SEASON: DAYS_PER_SEASON,
    WAKE_HOUR: WAKE_HOUR,
    COLLAPSE_HOUR: COLLAPSE_HOUR,
    WEATHER_NAMES: WEATHER_NAMES
  };

})(window);
