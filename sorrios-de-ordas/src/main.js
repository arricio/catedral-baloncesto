/* ============================================================================
   SORRÍOS DE ORDÁS — main.js
   Arranque: genera el arte, prepara el lienzo y las entradas, y lanza el
   bucle de juego. También registra el service worker para poder instalarlo
   como aplicación en Android.
   ========================================================================== */
(function (global) {
  'use strict';
  var G = global.SORRIOS;

  function boot() {
    var bootMsg = document.getElementById('boot-msg');
    var bootEl = document.getElementById('boot');
    var canvas = document.getElementById('game');

    function step(msg, fn, done) {
      if (bootMsg) bootMsg.textContent = msg;
      setTimeout(function () {
        try { fn(); } catch (e) { console.error(e); if (bootMsg) bootMsg.textContent = 'Error: ' + e.message; throw e; }
        done();
      }, 16);
    }

    step('Dibujando el pueblo…', function () {
      G.Art.build();
    }, function () {
      step('Levantando la granja…', function () {
        G.Render.init(canvas);
        G.Input.init(canvas);
        G.Game.init();
      }, function () {
        // Controles táctiles solo en pantallas táctiles
        var touch = document.getElementById('touch');
        if (G.isMobile() || navigator.maxTouchPoints > 0) {
          touch.classList.remove('hidden');
          G.Input.touchMode = true;
        }
        // El audio necesita un gesto del usuario en móvil
        var unlock = function () { G.Audio.unlock(); };
        window.addEventListener('pointerdown', unlock, { once: false });
        window.addEventListener('keydown', unlock, { once: false });

        if (bootEl) bootEl.classList.add('hidden');
        loop();
      });
    });
  }

  var last = 0;
  function loop(ts) {
    var now = ts || performance.now();
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    try {
      G.Game.update(dt);
      G.Game.draw(dt);
    } catch (e) {
      console.error('Fallo en el bucle:', e);
    }
    G.Input.endFrame();
    requestAnimationFrame(loop);
  }

  // Evita que el navegador haga scroll o zoom con los gestos del juego
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // Guardado al salir o al pasar a segundo plano (importante en Android)
  window.addEventListener('visibilitychange', function () {
    if (document.hidden && G.Game && G.Game.state !== 'title' && G.Game.autosave) G.Game.save(true);
  });
  window.addEventListener('pagehide', function () {
    if (G.Game && G.Game.state !== 'title' && G.Game.autosave) G.Game.save(true);
  });

  // Service worker (solo con http/https; al abrir el fichero directo no hace falta)
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* sin conexión, da igual */ });
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(boot, 0);
  else document.addEventListener('DOMContentLoaded', boot);

})(window);
