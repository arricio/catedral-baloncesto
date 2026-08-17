/* ============================================================================
   SORRÍOS DE ORDÁS — core.js
   Utilidades base: namespace global, matemáticas, RNG determinista,
   entrada (teclado + táctil), audio procedural y guardado en localStorage.
   Se usan scripts clásicos (sin ES modules) para que el juego funcione
   igual servido por HTTP que abierto directamente desde el archivo en Android.
   ========================================================================== */
(function (global) {
  'use strict';

  var G = global.SORRIOS = global.SORRIOS || {};

  /* ---------------------------------------------------------------- math -- */
  var M = G.M = {
    clamp: function (v, a, b) { return v < a ? a : (v > b ? b : v); },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    // Interpolación independiente del framerate: t = 1-exp(-k*dt)
    damp: function (a, b, k, dt) { return M.lerp(a, b, 1 - Math.exp(-k * dt)); },
    dist2: function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
    dist: function (ax, ay, bx, by) { return Math.sqrt(M.dist2(ax, ay, bx, by)); },
    sign: function (v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },
    smooth: function (t) { return t * t * (3 - 2 * t); },
    wrap: function (v, n) { return ((v % n) + n) % n; },
    rndInt: function (a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
    rndF: function (a, b) { return a + Math.random() * (b - a); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    chance: function (p) { return Math.random() < p; },
    round2: function (v) { return Math.round(v * 100) / 100; }
  };

  /* ----------------------------------------------------------------- rng -- */
  // Mulberry32: rápido, determinista y suficiente para generar el mundo.
  G.RNG = function (seed) {
    var s = (seed >>> 0) || 1;
    var f = function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.int = function (a, b) { return a + Math.floor(f() * (b - a + 1)); };
    f.range = function (a, b) { return a + f() * (b - a); };
    f.pick = function (arr) { return arr[Math.floor(f() * arr.length)]; };
    f.chance = function (p) { return f() < p; };
    f.shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(f() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    };
    return f;
  };

  // Ruido de valor suavizado (para hierba, terreno y nubes).
  G.noise2 = function (seed) {
    var rnd = G.RNG(seed);
    var P = new Float32Array(256 * 256);
    for (var i = 0; i < P.length; i++) P[i] = rnd();
    function at(x, y) { return P[(M.wrap(y, 256) * 256 + M.wrap(x, 256)) | 0]; }
    return function (x, y) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var u = M.smooth(xf), v = M.smooth(yf);
      var a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return M.lerp(M.lerp(a, b, u), M.lerp(c, d, u), v);
    };
  };

  /* --------------------------------------------------------------- input -- */
  var KEYMAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    Space: 'action', KeyE: 'action', Enter: 'action',
    KeyF: 'tool', ShiftLeft: 'tool', ControlLeft: 'tool',
    Escape: 'menu', KeyM: 'menu', Tab: 'next', KeyQ: 'prev', KeyR: 'next',
    KeyI: 'inventory', Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3',
    Digit4: 'slot4', Digit5: 'slot5', Digit6: 'slot6', Digit7: 'slot7',
    Digit8: 'slot8', Digit9: 'slot9', Digit0: 'slot10'
  };

  var Input = G.Input = {
    axis: { x: 0, y: 0 },
    held: {},
    _pressed: {},
    _released: {},
    _consumed: {},
    pointer: { x: 0, y: 0, down: false, tapped: false, justDown: false },
    touchMode: false,
    anyInput: false,

    init: function (canvas) {
      var self = this;

      window.addEventListener('keydown', function (e) {
        var a = KEYMAP[e.code];
        if (a) {
          if (!self.held[a]) self._pressed[a] = true;
          self.held[a] = true;
          self.anyInput = true;
          if (e.code === 'Tab' || e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
        }
      });
      window.addEventListener('keyup', function (e) {
        var a = KEYMAP[e.code];
        if (a) { self.held[a] = false; self._released[a] = true; }
      });
      window.addEventListener('blur', function () { self.held = {}; self.axis.x = self.axis.y = 0; });

      // ---- Puntero (ratón y dedo) sobre el canvas: usado por los menús ----
      function toCanvas(ev) {
        var r = canvas.getBoundingClientRect();
        var t = (ev.touches && ev.touches[0]) || ev;
        return { x: (t.clientX - r.left) / r.width, y: (t.clientY - r.top) / r.height };
      }
      canvas.addEventListener('mousedown', function (e) {
        var p = toCanvas(e); self.pointer.x = p.x; self.pointer.y = p.y;
        self.pointer.down = true; self.pointer.justDown = true; self.anyInput = true;
      });
      canvas.addEventListener('mousemove', function (e) {
        var p = toCanvas(e); self.pointer.x = p.x; self.pointer.y = p.y;
      });
      window.addEventListener('mouseup', function () {
        if (self.pointer.down) self.pointer.tapped = true;
        self.pointer.down = false;
      });
      canvas.addEventListener('touchstart', function (e) {
        self.touchMode = true; self.anyInput = true;
        var p = toCanvas(e); self.pointer.x = p.x; self.pointer.y = p.y;
        self.pointer.down = true; self.pointer.justDown = true;
        e.preventDefault();
      }, { passive: false });
      canvas.addEventListener('touchmove', function (e) {
        var p = toCanvas(e); self.pointer.x = p.x; self.pointer.y = p.y;
        e.preventDefault();
      }, { passive: false });
      canvas.addEventListener('touchend', function (e) {
        if (self.pointer.down) self.pointer.tapped = true;
        self.pointer.down = false; e.preventDefault();
      }, { passive: false });

      this.initTouchControls();
      return this;
    },

    // Joystick virtual + botones del DOM.
    initTouchControls: function () {
      var self = this;
      var stick = document.getElementById('stick');
      var knob = document.getElementById('stick-knob');
      if (stick) {
        var id = null, cx = 0, cy = 0, rad = 56;
        function start(e) {
          self.touchMode = true;
          var t = e.changedTouches ? e.changedTouches[0] : e;
          var r = stick.getBoundingClientRect();
          cx = r.left + r.width / 2; cy = r.top + r.height / 2; rad = r.width * 0.42;
          id = e.changedTouches ? t.identifier : 'mouse';
          move(e); e.preventDefault();
        }
        function move(e) {
          if (id === null) return;
          var t = null;
          if (e.changedTouches) {
            for (var i = 0; i < e.changedTouches.length; i++)
              if (e.changedTouches[i].identifier === id) t = e.changedTouches[i];
          } else t = e;
          if (!t) return;
          var dx = t.clientX - cx, dy = t.clientY - cy;
          var d = Math.hypot(dx, dy);
          if (d > rad) { dx = dx / d * rad; dy = dy / d * rad; d = rad; }
          knob.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
          var dead = rad * 0.16;
          if (d < dead) { self.axis.x = 0; self.axis.y = 0; }
          else { self.axis.x = M.clamp(dx / rad, -1, 1); self.axis.y = M.clamp(dy / rad, -1, 1); }
          self.anyInput = true;
          e.preventDefault();
        }
        function end(e) {
          id = null; self.axis.x = 0; self.axis.y = 0;
          knob.style.transform = 'translate(0,0)';
          if (e.preventDefault) e.preventDefault();
        }
        stick.addEventListener('touchstart', start, { passive: false });
        stick.addEventListener('touchmove', move, { passive: false });
        stick.addEventListener('touchend', end, { passive: false });
        stick.addEventListener('touchcancel', end, { passive: false });
      }

      var btns = document.querySelectorAll('#touch .btn');
      Array.prototype.forEach.call(btns, function (b) {
        var act = b.getAttribute('data-act');
        function down(e) {
          self.touchMode = true; self.anyInput = true;
          if (!self.held[act]) self._pressed[act] = true;
          self.held[act] = true;
          e.preventDefault();
        }
        function up(e) { self.held[act] = false; self._released[act] = true; e.preventDefault(); }
        b.addEventListener('touchstart', down, { passive: false });
        b.addEventListener('touchend', up, { passive: false });
        b.addEventListener('touchcancel', up, { passive: false });
        b.addEventListener('mousedown', down);
        b.addEventListener('mouseup', up);
      });
    },

    // Movimiento normalizado combinando teclado y joystick.
    move: function () {
      var x = this.axis.x, y = this.axis.y;
      if (this.held.left) x -= 1;
      if (this.held.right) x += 1;
      if (this.held.up) y -= 1;
      if (this.held.down) y += 1;
      var d = Math.hypot(x, y);
      if (d > 1) { x /= d; y /= d; }
      return { x: x, y: y, len: Math.min(d, 1) };
    },

    pressed: function (a) { return !!this._pressed[a] && !this._consumed[a]; },
    consume: function (a) { this._consumed[a] = true; },
    // Devuelve true una sola vez por pulsación (y la marca como consumida).
    take: function (a) { if (this.pressed(a)) { this.consume(a); return true; } return false; },

    endFrame: function () {
      this._pressed = {}; this._released = {}; this._consumed = {};
      this.pointer.tapped = false; this.pointer.justDown = false;
    }
  };

  /* --------------------------------------------------------------- audio -- */
  // Sintetizador minúsculo: sin ficheros externos, todo generado en tiempo real.
  var Audio2 = G.Audio = {
    ctx: null, master: null, musicGain: null, sfxGain: null,
    enabled: true, muted: false, _rainSrc: null, _musicTimer: 0, _musicStep: 0,

    unlock: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) { this.enabled = false; return; }
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9;
        this.sfxGain.connect(this.master);
        this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.28;
        this.musicGain.connect(this.master);
      } catch (e) { this.enabled = false; }
    },

    setMuted: function (m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.55;
    },

    tone: function (freq, dur, type, vol, slideTo, dest) {
      if (!this.enabled || !this.ctx || this.muted) return;
      var t = this.ctx.currentTime;
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.2), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || this.sfxGain);
      o.start(t); o.stop(t + dur + 0.03);
    },

    noise: function (dur, vol, freq, q) {
      if (!this.enabled || !this.ctx || this.muted) return;
      var t = this.ctx.currentTime;
      var len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = this.ctx.createBufferSource(); src.buffer = buf;
      var f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = freq || 900; f.Q.value = q || 1;
      var g = this.ctx.createGain(); g.gain.value = vol || 0.2;
      src.connect(f); f.connect(g); g.connect(this.sfxGain);
      src.start(t);
    },

    sfx: function (name) {
      if (!this.enabled || !this.ctx) return;
      switch (name) {
        case 'step':    this.noise(0.07, 0.10, 380 + Math.random() * 260, 1.2); break;
        case 'step_wood': this.noise(0.06, 0.12, 220, 2.4); break;
        case 'hoe':     this.noise(0.18, 0.26, 260, 1.0); this.tone(140, 0.12, 'triangle', 0.14, 90); break;
        case 'water':   this.noise(0.42, 0.16, 2100, 0.8); break;
        case 'chop':    this.noise(0.16, 0.30, 480, 1.6); this.tone(180, 0.1, 'square', 0.09, 110); break;
        case 'pick':    this.tone(760, 0.09, 'triangle', 0.18, 1180); break;
        case 'plant':   this.tone(430, 0.10, 'sine', 0.16, 620); break;
        case 'coin':    this.tone(980, 0.07, 'square', 0.13, 1320);
                        setTimeout(function(){Audio2.tone(1320,0.10,'square',0.11,1680);},60); break;
        case 'milk':    this.noise(0.16, 0.20, 1500, 3.0); this.tone(300, 0.08, 'sine', 0.09, 220); break;
        case 'ok':      this.tone(620, 0.08, 'triangle', 0.16, 880); break;
        case 'no':      this.tone(220, 0.16, 'sawtooth', 0.13, 120); break;
        case 'menu':    this.tone(520, 0.05, 'square', 0.08); break;
        case 'talk':    this.tone(430 + Math.random() * 130, 0.045, 'square', 0.055); break;
        case 'moo':     this.tone(150, 0.55, 'sawtooth', 0.16, 110); break;
        case 'baa':     this.tone(420, 0.35, 'sawtooth', 0.12, 300); break;
        case 'cluck':   this.tone(860, 0.06, 'square', 0.09, 620);
                        setTimeout(function(){Audio2.tone(700,0.05,'square',0.07,900);},70); break;
        case 'bray':    this.tone(230, 0.30, 'sawtooth', 0.16, 480);
                        setTimeout(function(){Audio2.tone(420,0.35,'sawtooth',0.14,150);},260); break;
        case 'sleep':   this.tone(320, 0.9, 'sine', 0.12, 160); break;
        case 'heart':   this.tone(660, 0.10, 'sine', 0.14, 990);
                        setTimeout(function(){Audio2.tone(880,0.16,'sine',0.13,1320);},110); break;
        case 'levelup': [523, 659, 784, 1046].forEach(function (f, i) {
                          setTimeout(function () { Audio2.tone(f, 0.16, 'triangle', 0.15); }, i * 85);
                        }); break;
        case 'thunder': this.noise(1.1, 0.34, 120, 0.6); break;
      }
    },

    // Lluvia continua mediante ruido en bucle.
    setRain: function (on, intensity) {
      if (!this.enabled || !this.ctx) return;
      if (on && !this._rainSrc) {
        var len = this.ctx.sampleRate * 2;
        var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        var d = buf.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        var src = this.ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        var f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
        var g = this.ctx.createGain(); g.gain.value = 0.0;
        src.connect(f); f.connect(g); g.connect(this.master);
        src.start();
        this._rainSrc = { src: src, gain: g };
      }
      if (this._rainSrc) {
        var target = on ? 0.035 * (intensity || 1) : 0;
        this._rainSrc.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
      }
    },

    // Melodía procedural: escala distinta por estación, ritmo tranquilo.
    music: function (dt, season, night) {
      if (!this.enabled || !this.ctx || this.muted) return;
      var SCALES = [
        [0, 2, 4, 7, 9, 12, 16],     // primavera: mayor pentatónica ampliada
        [0, 2, 4, 5, 7, 9, 11],      // verano: jónica
        [0, 2, 3, 5, 7, 8, 10],      // otoño: eólica
        [0, 2, 3, 7, 8, 10, 12]      // invierno: menor melancólica
      ];
      this._musicTimer -= dt;
      if (this._musicTimer > 0) return;
      var sc = SCALES[season % 4];
      var root = night ? 174.61 : 220.0;
      var step = this._musicStep++;
      var n = sc[(step * 3 + (step >> 2)) % sc.length];
      var oct = ((step >> 3) % 2) ? 2 : 1;
      var f = root * Math.pow(2, n / 12) * oct;
      this.tone(f, night ? 1.5 : 0.9, night ? 'sine' : 'triangle', night ? 0.05 : 0.06, null, this.musicGain);
      if (step % 4 === 0) this.tone(root / 2, 1.6, 'sine', 0.05, null, this.musicGain);
      this._musicTimer = night ? 1.5 : 0.85;
    }
  };

  /* -------------------------------------------------------------- storage -- */
  G.Storage = {
    KEY: 'sorrios_de_ordas_save_v1',
    save: function (data) {
      try { localStorage.setItem(this.KEY, JSON.stringify(data)); return true; }
      catch (e) { console.warn('No se pudo guardar:', e); return false; }
    },
    load: function () {
      try {
        var raw = localStorage.getItem(this.KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    clear: function () { try { localStorage.removeItem(this.KEY); } catch (e) {} },
    has: function () { try { return !!localStorage.getItem(this.KEY); } catch (e) { return false; } }
  };

  /* --------------------------------------------------------------- utils -- */
  G.fmtMoney = function (n) {
    return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₧';
  };
  G.fmtTime = function (h, m) {
    var ap = h < 12 ? 'AM' : 'PM';
    var hh = h % 12; if (hh === 0) hh = 12;
    return hh + ':' + (m < 10 ? '0' : '') + m + ' ' + ap;
  };
  G.isMobile = function () {
    return /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  };

})(window);
