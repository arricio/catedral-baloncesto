/* ============================================================================
   SORRÍOS DE ORDÁS 3D — audio.js
   Sonido sintetizado con la Web Audio API: motor del tractor, animales,
   pasos, lluvia, viento y avisos de la interfaz. Sin ficheros de audio.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U;

  var A = S.Audio = {
    ctx: null, master: null, sfx: null, amb: null, activo: true, silencio: false,
    _motor: null, _lluvia: null, _viento: null,

    iniciar: function () {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      var AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) { this.activo = false; return; }
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.6;
        this.master.connect(this.ctx.destination);
        this.sfx = this.ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
        this.amb = this.ctx.createGain(); this.amb.gain.value = 0.5; this.amb.connect(this.master);
      } catch (e) { this.activo = false; }
    },
    mudo: function (v) { this.silencio = v; if (this.master) this.master.gain.value = v ? 0 : 0.6; },

    tono: function (f, dur, tipo, vol, hasta, dest) {
      if (!this.ctx || this.silencio) return;
      var t = this.ctx.currentTime;
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = tipo || 'sine';
      o.frequency.setValueAtTime(f, t);
      if (hasta) o.frequency.exponentialRampToValueAtTime(Math.max(20, hasta), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol || 0.2), t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(dest || this.sfx);
      o.start(t); o.stop(t + dur + 0.05);
    },
    ruido: function (dur, vol, f, q, tipo) {
      if (!this.ctx || this.silencio) return;
      var t = this.ctx.currentTime;
      var len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = this.ctx.createBufferSource(); src.buffer = buf;
      var fl = this.ctx.createBiquadFilter();
      fl.type = tipo || 'bandpass'; fl.frequency.value = f || 800; fl.Q.value = q || 1;
      var g = this.ctx.createGain(); g.gain.value = vol || 0.2;
      src.connect(fl); fl.connect(g); g.connect(this.sfx);
      src.start(t);
    },

    fx: function (n) {
      if (!this.ctx) return;
      switch (n) {
        case 'paso':     this.ruido(0.09, 0.09, 300 + Math.random() * 260, 1.4); break;
        case 'paso_duro':this.ruido(0.07, 0.11, 900 + Math.random() * 400, 2.2); break;
        case 'arar':     this.ruido(0.5, 0.16, 260, 0.8); break;
        case 'azada':    this.ruido(0.2, 0.24, 240, 1.0); this.tono(130, 0.12, 'triangle', 0.12, 90); break;
        case 'agua':     this.ruido(0.5, 0.14, 1900, 0.7); break;
        case 'sembrar':  this.tono(430, 0.1, 'sine', 0.14, 640); break;
        case 'coger':    this.tono(720, 0.09, 'triangle', 0.16, 1150); break;
        case 'moneda':   this.tono(980, 0.07, 'square', 0.12, 1320);
                         setTimeout(function () { A.tono(1320, 0.1, 'square', 0.1, 1680); }, 60); break;
        case 'leche':    this.ruido(0.14, 0.2, 1600, 3.2); this.tono(280, 0.08, 'sine', 0.08, 200); break;
        case 'ok':       this.tono(620, 0.08, 'triangle', 0.14, 880); break;
        case 'no':       this.tono(210, 0.16, 'sawtooth', 0.12, 120); break;
        case 'menu':     this.tono(520, 0.05, 'square', 0.07); break;
        case 'hablar':   this.tono(400 + Math.random() * 140, 0.05, 'square', 0.05); break;
        case 'muu':      this.tono(135, 0.65, 'sawtooth', 0.16, 100); break;
        case 'bee':      this.tono(420, 0.4, 'sawtooth', 0.11, 300); break;
        case 'coc':      this.tono(860, 0.06, 'square', 0.08, 620);
                         setTimeout(function () { A.tono(700, 0.05, 'square', 0.06, 900); }, 70); break;
        case 'iaa':      this.tono(230, 0.32, 'sawtooth', 0.15, 480);
                         setTimeout(function () { A.tono(420, 0.38, 'sawtooth', 0.13, 140); }, 280); break;
        case 'arranque': this.tono(60, 0.9, 'sawtooth', 0.2, 140); break;
        case 'trueno':   this.ruido(1.4, 0.32, 90, 0.5, 'lowpass'); break;
        case 'corazon':  this.tono(660, 0.1, 'sine', 0.13, 990);
                         setTimeout(function () { A.tono(880, 0.16, 'sine', 0.12, 1320); }, 110); break;
        case 'logro':    [523, 659, 784, 1046].forEach(function (f, i) {
                           setTimeout(function () { A.tono(f, 0.16, 'triangle', 0.13); }, i * 85);
                         }); break;
        case 'campana':  this.tono(440, 1.6, 'sine', 0.16, 430);
                         this.tono(660, 1.4, 'sine', 0.07, 650); break;
      }
    },

    // Motor del tractor: dos osciladores con la frecuencia ligada al régimen
    motor: function (on, rpm, carga) {
      if (!this.ctx) return;
      if (on && !this._motor) {
        var o1 = this.ctx.createOscillator(), o2 = this.ctx.createOscillator();
        var g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
        o1.type = 'sawtooth'; o2.type = 'square';
        f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 3;
        g.gain.value = 0;
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.master);
        o1.start(); o2.start();
        this._motor = { o1: o1, o2: o2, g: g, f: f };
      }
      if (!this._motor) return;
      var m = this._motor, t = this.ctx.currentTime;
      if (!on) { m.g.gain.setTargetAtTime(0, t, 0.25); return; }
      var base = 26 + rpm * 46;
      m.o1.frequency.setTargetAtTime(base, t, 0.08);
      m.o2.frequency.setTargetAtTime(base * 2.02, t, 0.08);
      m.f.frequency.setTargetAtTime(280 + rpm * 900 + carga * 200, t, 0.15);
      m.g.gain.setTargetAtTime(this.silencio ? 0 : 0.045 + rpm * 0.05, t, 0.12);
    },

    // Lluvia y viento continuos
    ambiente: function (lluvia, viento) {
      if (!this.ctx) return;
      if (!this._lluvia) {
        var len = this.ctx.sampleRate * 2;
        function mkNoise(ctx, filtro, freq) {
          var buf = ctx.createBuffer(1, len, ctx.sampleRate);
          var d = buf.getChannelData(0);
          for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
          var src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
          var f = ctx.createBiquadFilter(); f.type = filtro; f.frequency.value = freq;
          var g = ctx.createGain(); g.gain.value = 0;
          src.connect(f); f.connect(g);
          src.start();
          return { src: src, g: g };
        }
        this._lluvia = mkNoise(this.ctx, 'lowpass', 1500);
        this._lluvia.g.connect(this.amb);
        this._viento = mkNoise(this.ctx, 'bandpass', 420);
        this._viento.g.connect(this.amb);
      }
      var t = this.ctx.currentTime;
      this._lluvia.g.gain.setTargetAtTime(this.silencio ? 0 : lluvia * 0.09, t, 0.7);
      this._viento.g.gain.setTargetAtTime(this.silencio ? 0 : viento * 0.035, t, 1.2);
    },

    // Pájaros de fondo durante el día
    pajaro: function () {
      if (!this.ctx || this.silencio) return;
      var f = 1800 + Math.random() * 1400;
      this.tono(f, 0.08, 'sine', 0.035, f * 1.4, this.amb);
      var self = this;
      setTimeout(function () { self.tono(f * 1.2, 0.07, 'sine', 0.03, f * 0.8, self.amb); }, 90);
    }
  };

})(window);
