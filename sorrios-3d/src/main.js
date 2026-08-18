/* ============================================================================
   SORRÍOS DE ORDÁS 3D — main.js
   Arranque por fases (para que la pantalla de carga avance), pantalla de
   título y bucle principal.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D;

  function $(id) { return document.getElementById(id); }

  var fases = [
    ['Preparando el motor 3D', function (G) { /* ya hecho en init */ }],
    ['Levantando el valle y los montes', function (G) { G.construirMundo(G.clock.season); }],
    ['Sembrando praderas y arboledas', function (G) { /* incluido arriba */ }],
    ['Abriendo el pueblo', function (G) { }],
    ['Listo', function (G) { }]
  ];

  function arrancar() {
    var canvas = $('lienzo');
    var G = S.Game.init(canvas, null);
    S.Input.init(canvas);

    var i = 0;
    function paso() {
      if (i >= fases.length) return terminar(G);
      $('carga-msg').textContent = fases[i][0] + '…';
      $('carga-barra').style.width = Math.round((i + 1) / fases.length * 100) + '%';
      setTimeout(function () {
        try { fases[i][1](G); }
        catch (e) { console.error(e); $('carga-msg').textContent = 'Error: ' + e.message; return; }
        i++; paso();
      }, 30);
    }
    paso();
  }

  function terminar(G) {
    $('carga').classList.add('oculto');
    $('titulo').classList.remove('oculto');
    $('btn-continuar').style.display = S.Storage.has() ? '' : 'none';

    if (S.isMobile() || navigator.maxTouchPoints > 0) {
      $('tactil').classList.remove('oculto');
      S.Input.tactil = true;
    }

    $('btn-nueva').addEventListener('click', function () {
      S.Audio.iniciar(); S.Audio.fx('ok');
      $('titulo').classList.add('oculto');
      G.nuevaPartida();
    });
    $('btn-continuar').addEventListener('click', function () {
      S.Audio.iniciar(); S.Audio.fx('ok');
      $('titulo').classList.add('oculto');
      if (!G.cargar()) G.nuevaPartida();
      G.ui.hudVisible(true);
    });

    // el audio necesita un gesto del usuario
    window.addEventListener('pointerdown', function () { S.Audio.iniciar(); });
    window.addEventListener('keydown', function () { S.Audio.iniciar(); });

    bucle(G);
  }

  var ultimo = 0;
  function bucle(G) {
    function frame(ts) {
      var dt = Math.min(0.05, (ts - ultimo) / 1000 || 0.016);
      ultimo = ts;
      try {
        G.update(dt);
        G.render();
      } catch (e) {
        console.error('Fallo en el bucle:', e);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // Evitar gestos del navegador que estorban al jugar
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); }, { passive: false });

  // Guardado automático al salir o cambiar de aplicación
  function guardarSiProcede() {
    if (S.Game && S.Game.estado && S.Game.estado !== 'titulo' && S.Game.terrain) S.Game.guardar(true);
  }
  window.addEventListener('visibilitychange', function () { if (document.hidden) guardarSiProcede(); });
  window.addEventListener('pagehide', guardarSiProcede);

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar);
  else setTimeout(arrancar, 0);

})(window);
