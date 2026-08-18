/* ============================================================================
   SORRÍOS DE ORDÁS 3D — util.js
   Matemáticas, ruido procedural, generador aleatorio determinista, guardado
   y detección de dispositivo. Base de todo lo demás.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D = global.SORRIOS3D || {};

  var U = S.U = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    damp: function (a, b, k, dt) { return a + (b - a) * (1 - Math.exp(-k * dt)); },
    smooth: function (t) { return t * t * (3 - 2 * t); },
    mod: function (v, n) { return ((v % n) + n) % n; },
    sign: function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },
    rnd: function (a, b) { return a + Math.random() * (b - a); },
    rndInt: function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
    pick: function (a) { return a[Math.floor(Math.random() * a.length)]; },
    chance: function (p) { return Math.random() < p; },
    // Ángulo más corto entre dos rumbos (para girar suave)
    angleDelta: function (a, b) {
      var d = (b - a + Math.PI) % (Math.PI * 2);
      if (d < 0) d += Math.PI * 2;
      return d - Math.PI;
    },
    fmtMoney: function (n) {
      return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €';
    },
    fmtHour: function (h, m) {
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }
  };

  /* ------------------------------------------------------------------ RNG */
  S.RNG = function (seed) {
    var s = (seed >>> 0) || 1;
    var f = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.range = function (a, b) { return a + f() * (b - a); };
    f.int = function (a, b) { return a + Math.floor(f() * (b - a + 1)); };
    f.pick = function (a) { return a[Math.floor(f() * a.length)]; };
    f.chance = function (p) { return f() < p; };
    return f;
  };

  /* ---------------------------------------------------------------- ruido */
  // Ruido de valor con interpolación suave; base del terreno y las texturas.
  S.Noise = function (seed) {
    var rnd = S.RNG(seed || 1);
    var N = 256, P = new Float32Array(N * N);
    for (var i = 0; i < P.length; i++) P[i] = rnd();
    function at(x, y) { return P[(U.mod(y, N) | 0) * N + (U.mod(x, N) | 0)]; }
    function noise(x, y) {
      var xi = Math.floor(x), yi = Math.floor(y);
      var xf = x - xi, yf = y - yi;
      var u = U.smooth(xf), v = U.smooth(yf);
      return U.lerp(U.lerp(at(xi, yi), at(xi + 1, yi), u),
                    U.lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
    }
    // Ruido fractal (varias octavas) para relieve natural
    noise.fbm = function (x, y, oct, lac, gain) {
      oct = oct || 4; lac = lac || 2.0; gain = gain || 0.5;
      var a = 0.5, f = 1, sum = 0, norm = 0;
      for (var o = 0; o < oct; o++) {
        sum += a * noise(x * f, y * f);
        norm += a; a *= gain; f *= lac;
      }
      return sum / norm;
    };
    return noise;
  };

  /* -------------------------------------------------------------- guardado */
  S.Storage = {
    KEY: 'sorrios_3d_v1',
    save: function (d) { try { localStorage.setItem(this.KEY, JSON.stringify(d)); return true; } catch (e) { return false; } },
    load: function () { try { var r = localStorage.getItem(this.KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } },
    has: function () { try { return !!localStorage.getItem(this.KEY); } catch (e) { return false; } },
    clear: function () { try { localStorage.removeItem(this.KEY); } catch (e) {} }
  };

  /* ------------------------------------------------------------ dispositivo */
  S.isMobile = function () {
    return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  };

  // Nivel de calidad automático: en móvil bajamos sombras, hierba y niebla.
  S.quality = function () {
    var mob = S.isMobile();
    var mem = navigator.deviceMemory || (mob ? 4 : 8);
    var lvl = mob ? (mem >= 6 ? 'media' : 'baja') : 'alta';
    return {
      level: lvl,
      shadowSize: lvl === 'alta' ? 2048 : (lvl === 'media' ? 1024 : 1024),
      shadowDist: lvl === 'alta' ? 70 : 45,
      grass: lvl === 'alta' ? 26000 : (lvl === 'media' ? 9000 : 4500),
      grassRadius: lvl === 'alta' ? 46 : (lvl === 'media' ? 30 : 22),
      viewDist: lvl === 'alta' ? 420 : 260,
      pixelRatio: lvl === 'alta' ? Math.min(devicePixelRatio || 1, 2) : Math.min(devicePixelRatio || 1, 1.5),
      antialias: lvl !== 'baja',
      treeDetail: lvl === 'alta' ? 1 : 0
    };
  };

})(window);
