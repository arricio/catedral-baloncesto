/* ============================================================================
   SORRÍOS DE ORDÁS 3D — input.js
   Teclado y ratón en el ordenador (con giro de cámara y bloqueo de puntero)
   y mandos táctiles en el móvil: joystick izquierdo, mirada a la derecha
   y botones de acción.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U;

  var MAPA = {
    KeyW: 'arriba', ArrowUp: 'arriba', KeyS: 'abajo', ArrowDown: 'abajo',
    KeyA: 'izq', ArrowLeft: 'izq', KeyD: 'der', ArrowRight: 'der',
    ShiftLeft: 'correr', ShiftRight: 'correr',
    KeyE: 'accion', Space: 'accion', Enter: 'accion',
    KeyF: 'herramienta', KeyG: 'herramienta',
    KeyQ: 'anterior', KeyR: 'siguiente', Tab: 'siguiente',
    Escape: 'menu', KeyM: 'menu',
    KeyT: 'montar', KeyV: 'camara', KeyH: 'bajar_apero', KeyC: 'cambiar_apero',
    KeyL: 'luces', KeyP: 'motor',
    Digit1: 'r1', Digit2: 'r2', Digit3: 'r3', Digit4: 'r4', Digit5: 'r5',
    Digit6: 'r6', Digit7: 'r7', Digit8: 'r8', Digit9: 'r9'
  };

  var I = S.Input = {
    pulsado: {}, _nuevo: {}, _consumido: {},
    eje: { x: 0, y: 0 },
    mirada: { x: 0, y: 0 },
    rueda: 0,
    tactil: false,
    puntero: false,
    _joyId: null,
    _lookId: null,

    init: function (canvas) {
      var self = this;
      this.canvas = canvas;

      window.addEventListener('keydown', function (e) {
        var a = MAPA[e.code];
        if (!a) return;
        if (!self.pulsado[a]) self._nuevo[a] = true;
        self.pulsado[a] = true;
        if (e.code === 'Tab' || e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
      });
      window.addEventListener('keyup', function (e) {
        var a = MAPA[e.code];
        if (a) self.pulsado[a] = false;
      });
      window.addEventListener('blur', function () { self.pulsado = {}; self.eje.x = self.eje.y = 0; });

      // --- ratón: girar la cámara ---
      canvas.addEventListener('mousedown', function (e) {
        if (e.button === 0 && !self.tactil && canvas.requestPointerLock) canvas.requestPointerLock();
      });
      document.addEventListener('pointerlockchange', function () {
        self.puntero = document.pointerLockElement === canvas;
      });
      window.addEventListener('mousemove', function (e) {
        if (self.puntero) {
          self.mirada.x += e.movementX * 0.0026;
          self.mirada.y += e.movementY * 0.0022;
        }
      });
      canvas.addEventListener('wheel', function (e) { self.rueda += e.deltaY * 0.002; e.preventDefault(); }, { passive: false });

      this.initTactil();
      return this;
    },

    initTactil: function () {
      var self = this;
      var joy = document.getElementById('joystick');
      var mando = document.getElementById('joystick-mando');
      var mirador = document.getElementById('mirador');

      if (joy) {
        var cx = 0, cy = 0, rad = 52;
        function jStart(e) {
          self.tactil = true;
          var t = e.changedTouches[0];
          var r = joy.getBoundingClientRect();
          cx = r.left + r.width / 2; cy = r.top + r.height / 2; rad = r.width * 0.42;
          self._joyId = t.identifier;
          jMove(e); e.preventDefault();
        }
        function jMove(e) {
          if (self._joyId === null) return;
          for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            if (t.identifier !== self._joyId) continue;
            var dx = t.clientX - cx, dy = t.clientY - cy;
            var d = Math.hypot(dx, dy);
            if (d > rad) { dx = dx / d * rad; dy = dy / d * rad; d = rad; }
            mando.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
            var dead = rad * 0.16;
            if (d < dead) { self.eje.x = 0; self.eje.y = 0; }
            else { self.eje.x = U.clamp(dx / rad, -1, 1); self.eje.y = U.clamp(dy / rad, -1, 1); }
          }
          e.preventDefault();
        }
        function jEnd(e) {
          for (var i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === self._joyId) {
              self._joyId = null; self.eje.x = 0; self.eje.y = 0;
              mando.style.transform = 'translate(0,0)';
            }
          }
        }
        joy.addEventListener('touchstart', jStart, { passive: false });
        joy.addEventListener('touchmove', jMove, { passive: false });
        joy.addEventListener('touchend', jEnd);
        joy.addEventListener('touchcancel', jEnd);
      }

      if (mirador) {
        var lx = 0, ly = 0;
        mirador.addEventListener('touchstart', function (e) {
          self.tactil = true;
          var t = e.changedTouches[0];
          self._lookId = t.identifier; lx = t.clientX; ly = t.clientY;
          e.preventDefault();
        }, { passive: false });
        mirador.addEventListener('touchmove', function (e) {
          for (var i = 0; i < e.changedTouches.length; i++) {
            var t = e.changedTouches[i];
            if (t.identifier !== self._lookId) continue;
            self.mirada.x += (t.clientX - lx) * 0.006;
            self.mirada.y += (t.clientY - ly) * 0.005;
            lx = t.clientX; ly = t.clientY;
          }
          e.preventDefault();
        }, { passive: false });
        mirador.addEventListener('touchend', function () { self._lookId = null; });
      }

      var botones = document.querySelectorAll('#tactil [data-accion]');
      Array.prototype.forEach.call(botones, function (b) {
        var a = b.getAttribute('data-accion');
        function down(e) {
          self.tactil = true;
          if (!self.pulsado[a]) self._nuevo[a] = true;
          self.pulsado[a] = true;
          e.preventDefault();
        }
        function up(e) { self.pulsado[a] = false; if (e.preventDefault) e.preventDefault(); }
        b.addEventListener('touchstart', down, { passive: false });
        b.addEventListener('touchend', up);
        b.addEventListener('touchcancel', up);
        b.addEventListener('mousedown', down);
        b.addEventListener('mouseup', up);
      });
    },

    // Movimiento normalizado (teclado + joystick)
    mover: function () {
      var x = this.eje.x, y = this.eje.y;
      if (this.pulsado.izq) x -= 1;
      if (this.pulsado.der) x += 1;
      if (this.pulsado.arriba) y -= 1;
      if (this.pulsado.abajo) y += 1;
      var d = Math.hypot(x, y);
      if (d > 1) { x /= d; y /= d; }
      return { x: x, y: y, len: Math.min(d, 1) };
    },

    nuevo: function (a) { return !!this._nuevo[a] && !this._consumido[a]; },
    tomar: function (a) { if (this.nuevo(a)) { this._consumido[a] = true; return true; } return false; },
    finFrame: function () { this._nuevo = {}; this._consumido = {}; this.rueda = 0; }
  };

})(window);
