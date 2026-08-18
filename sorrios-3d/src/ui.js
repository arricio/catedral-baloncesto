/* ============================================================================
   SORRÍOS DE ORDÁS 3D — ui.js
   Toda la interfaz es HTML sobre el lienzo 3D: se ve nítida en cualquier
   pantalla y funciona igual con ratón que con el dedo.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, D = S.DATA;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  var METEO_IC = { sol: '☀️', nubes: '☁️', lluvia: '🌧️', tormenta: '⛈️', nieve: '❄️' };

  function UI(game) {
    this.g = game;
    this.tab = 'mochila';
    this.shopTab = 'comprar';
    this.shopId = null;
    this.dlgCola = null;
    this.hotbarCache = '';
    this.bind();
  }

  UI.prototype.bind = function () {
    var self = this, g = this.g;

    // pestañas del menú
    document.querySelectorAll('#menu .pest').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#menu .pest').forEach(function (x) { x.classList.remove('activa'); });
        b.classList.add('activa');
        self.tab = b.getAttribute('data-tab');
        self.pintarMenu();
        S.Audio.fx('menu');
      });
    });
    document.querySelectorAll('#tienda .pest').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#tienda .pest').forEach(function (x) { x.classList.remove('activa'); });
        b.classList.add('activa');
        self.shopTab = b.getAttribute('data-shoptab');
        self.pintarTienda();
        S.Audio.fx('menu');
      });
    });
    document.querySelectorAll('[data-cerrar]').forEach(function (b) {
      b.addEventListener('click', function () {
        var q = b.getAttribute('data-cerrar');
        $(q).classList.add('oculto');
        g.estado = 'juego';
        S.Audio.fx('menu');
      });
    });
    $('dialogo').addEventListener('click', function () { self.siguienteDialogo(); });
    $('parte-ok').addEventListener('click', function () {
      $('parte').classList.add('oculto');
      g.estado = 'juego';
      S.Audio.fx('ok');
    });
    $('mano-izq').addEventListener('click', function () { g.ordenar(0); });
    $('mano-der').addEventListener('click', function () { g.ordenar(1); });
  };

  /* ------------------------------------------------------------------ HUD */
  UI.prototype.refrescar = function () {
    var g = this.g, c = g.clock, p = g.player;
    $('ui-fecha').textContent = S.DAYS[c.weekday] + ', ' + c.day + ' de ' + S.SEASONS[c.season];
    $('ui-anio').textContent = 'Año ' + c.year;
    $('ui-hora').textContent = c.timeString();
    $('ui-meteo').textContent = METEO_IC[c.weather] || '☀️';
    $('ui-estacion').textContent = S.SEASONS[c.season];
    $('ui-dinero').textContent = U.fmtMoney(p.dinero);
    $('ui-energia').style.width = U.clamp(p.energia / p.energiaMax, 0, 1) * 100 + '%';

    // brújula
    var dir = ((-g.camYaw * 180 / Math.PI) % 360 + 360) % 360;
    var puntos = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    $('ui-brujula').textContent = puntos[Math.round(dir / 45) % 8];

    // panel del tractor
    var pt = $('panel-tractor');
    if (g.conduciendo && g.tractor) {
      pt.classList.remove('oculto');
      $('ui-kmh').textContent = Math.round(g.tractor.kmh());
      var ap = g.tractor.attached;
      $('ui-apero').textContent = ap ? g.tractor.attachments[ap].userData.nombre : 'Ninguno';
      $('ui-apero-estado').textContent = !ap ? '—' : (g.tractor.lowered ? 'Trabajando' : 'Levantado');
      $('ui-gasoil').style.width = g.tractor.fuel + '%';
    } else pt.classList.add('oculto');

    this.pintarCinturon();
  };

  UI.prototype.pintarCinturon = function () {
    var g = this.g, p = g.player;
    var clave = p.cinturon.join(',') + '|' + p.slot + '|' + p.cinturon.map(function (id) { return p.cuantos(id); }).join(',');
    if (clave === this.hotbarCache) return;
    this.hotbarCache = clave;
    var cont = $('cinturon');
    cont.innerHTML = '';
    var self = this;
    p.cinturon.forEach(function (id, i) {
      var def = D.ITEMS[id];
      var r = el('div', 'ranura' + (i === p.slot ? ' sel' : ''));
      r.innerHTML = '<span class="num">' + (i + 1) + '</span>' +
        '<span>' + (def ? def.ic : '?') + '</span>' +
        (def && def.t !== 'tool' ? '<span class="cant">' + p.cuantos(id) + '</span>' : '') +
        '<span class="nom">' + (def ? def.n : '') + '</span>';
      r.addEventListener('click', function () { p.slot = i; self.hotbarCache = ''; S.Audio.fx('menu'); });
      cont.appendChild(r);
    });
  };

  UI.prototype.prompt = function (texto, tecla) {
    var p = $('prompt');
    if (!texto) { p.classList.remove('on'); return; }
    p.classList.add('on');
    p.innerHTML = (tecla ? '<span class="tecla">' + tecla + '</span>' : '') + '<span>' + texto + '</span>';
  };

  UI.prototype.aviso = function (texto, sub) {
    var a = $('aviso-central');
    a.innerHTML = texto + (sub ? '<small>' + sub + '</small>' : '');
    a.classList.add('on');
    clearTimeout(this._avisoT);
    this._avisoT = setTimeout(function () { a.classList.remove('on'); }, 2600);
  };

  UI.prototype.toast = function (texto, tipo) {
    var t = el('div', 'toast' + (tipo ? ' ' + tipo : ''), texto);
    $('toasts').appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .4s, transform .4s';
      t.style.opacity = '0'; t.style.transform = 'translateX(30px)';
      setTimeout(function () { t.remove(); }, 420);
    }, 2600);
    var cont = $('toasts');
    while (cont.children.length > 5) cont.removeChild(cont.firstChild);
  };

  /* -------------------------------------------------------------- diálogo */
  UI.prototype.dialogo = function (nombre, texto, npc) {
    $('dlg-nombre').textContent = nombre;
    $('dlg-corazones').innerHTML = npc
      ? '<span class="corazones">' + '♥'.repeat(npc.corazones) + '<span style="opacity:.3">' + '♥'.repeat(10 - npc.corazones) + '</span></span>'
      : '';
    $('dlg-texto').textContent = texto;
    $('dialogo').classList.remove('oculto');
    this.g.estado = 'dialogo';
    S.Audio.fx('hablar');
  };
  UI.prototype.siguienteDialogo = function () {
    $('dialogo').classList.add('oculto');
    if (this.g.estado === 'dialogo') this.g.estado = 'juego';
  };

  /* ----------------------------------------------------------------- menú */
  UI.prototype.abrirMenu = function () {
    $('menu').classList.remove('oculto');
    this.g.estado = 'menu';
    this.pintarMenu();
    S.Audio.fx('menu');
  };
  UI.prototype.cerrarMenu = function () {
    $('menu').classList.add('oculto');
    if (this.g.estado === 'menu') this.g.estado = 'juego';
  };

  UI.prototype.pintarMenu = function () {
    var g = this.g, p = g.player, cuerpo = $('menu-cuerpo'), self = this;
    cuerpo.innerHTML = '';
    if (this.tab === 'mochila') {
      var rej = el('div', 'rejilla');
      if (!p.inv.length) cuerpo.appendChild(el('p', 'ayuda-li', 'La mochila está vacía.'));
      p.inv.forEach(function (it) {
        var def = D.ITEMS[it.id];
        var c = el('div', 'celda');
        c.innerHTML = '<span class="ic">' + def.ic + '</span><span class="qt">' + it.q + '</span><span class="tx">' + def.n + '</span>';
        c.addEventListener('click', function () {
          if (def.energy) { g.comer(it.id); self.pintarMenu(); }
          else if (def.t === 'seed' || def.t === 'feed' || def.t === 'esp') { g.equipar(it.id); self.toast('En la mano: ' + def.n, 'info'); }
          else self.toast(def.n + (def.sell ? ' · vale ' + def.sell + ' €' : ''), 'info');
        });
        rej.appendChild(c);
      });
      cuerpo.appendChild(rej);
      cuerpo.appendChild(el('p', 'seccion', 'Pulsa un alimento para comerlo; una semilla o saco para llevarlo en la mano.'));
    } else if (this.tab === 'granja') {
      var stats = g.resumenGranja();
      stats.forEach(function (s) {
        cuerpo.appendChild(el('div', 'dato', '<span>' + s[0] + '</span><b>' + s[1] + '</b>'));
      });
    } else if (this.tab === 'vecinos') {
      g.npcs.slice().sort(function (a, b) { return b.puntos - a.puntos; }).forEach(function (n) {
        var tag = n.casado ? ' · esposa' : (n.novia ? ' · novia' : '');
        var f = el('div', 'fila');
        f.innerHTML = '<span class="ic">🧑‍🌾</span><div class="info"><b>' + n.nombre + tag +
          '</b><small>' + n.def.rol + '</small></div>' +
          '<span class="corazones">' + '♥'.repeat(n.corazones) + '<span style="opacity:.25">' + '♥'.repeat(10 - n.corazones) + '</span></span>';
        cuerpo.appendChild(f);
      });
    } else if (this.tab === 'ayuda') {
      cuerpo.appendChild(el('p', 'seccion', 'Controles'));
      var ctrl = [
        ['Moverse', 'W A S D  ·  joystick'],
        ['Correr', 'Mayúsculas  ·  botón ⏩'],
        ['Mirar', 'ratón  ·  arrastrar en la pantalla'],
        ['Acción / hablar / recoger', 'E  ·  botón A'],
        ['Usar herramienta', 'F  ·  botón ✋'],
        ['Subir o bajar del tractor', 'T  ·  botón 🚜'],
        ['Cambiar de apero', 'C'],
        ['Bajar o subir el apero', 'H'],
        ['Arrancar o parar el motor', 'P'],
        ['Cambiar de objeto', 'Q / R  ·  ◀ ▶  ·  teclas 1-9'],
        ['Cambiar de cámara', 'V'],
        ['Menú', 'Esc  ·  botón ☰']
      ];
      ctrl.forEach(function (c) { cuerpo.appendChild(el('div', 'dato', '<span>' + c[0] + '</span><b>' + c[1] + '</b>')); });
      cuerpo.appendChild(el('p', 'seccion', 'Consejos'));
      D.AYUDA.forEach(function (t) { cuerpo.appendChild(el('p', 'ayuda-li', '▸ ' + t)); });
    } else {
      var opciones = [
        ['🔊 Sonido', S.Audio.silencio ? 'Apagado' : 'Encendido', function () { S.Audio.mudo(!S.Audio.silencio); }],
        ['💾 Guardar la partida', 'Guardar ahora', function () { g.guardar(); self.toast('Partida guardada.', 'oro'); }],
        ['🌾 Calidad gráfica', g.q.level, function () { g.cambiarCalidad(); }],
        ['🗑️ Empezar de cero', 'Borrar partida', function () {
          if (confirm('¿Seguro que quieres borrar la partida y empezar de cero?')) { S.Storage.clear(); location.reload(); }
        }]
      ];
      opciones.forEach(function (o) {
        var f = el('div', 'fila');
        f.innerHTML = '<div class="info"><b>' + o[0] + '</b><small>' + o[1] + '</small></div>';
        f.addEventListener('click', function () { o[2](); self.pintarMenu(); });
        cuerpo.appendChild(f);
      });
      cuerpo.appendChild(el('p', 'seccion', 'Sorríos de Ordás 3D · hecho para Arricio'));
    }
  };

  /* --------------------------------------------------------------- tienda */
  UI.prototype.abrirTienda = function (id) {
    this.shopId = id;
    this.shopTab = 'comprar';
    document.querySelectorAll('#tienda .pest').forEach(function (b) {
      b.classList.toggle('activa', b.getAttribute('data-shoptab') === 'comprar');
      b.style.display = (b.getAttribute('data-shoptab') === 'ganado' && !D.SHOPS[id].ganado) ? 'none' : '';
    });
    $('tienda-nombre').textContent = D.SHOPS[id].n;
    $('tienda').classList.remove('oculto');
    this.g.estado = 'tienda';
    this.pintarTienda();
    S.Audio.fx('menu');
  };

  UI.prototype.pintarTienda = function () {
    var g = this.g, p = g.player, self = this;
    var shop = D.SHOPS[this.shopId];
    var lista = $('tienda-lista');
    lista.innerHTML = '';
    $('tienda-dinero').textContent = U.fmtMoney(p.dinero);

    if (this.shopTab === 'comprar') {
      var items = shop.stock.slice();
      if (shop.semillas) items = D.semillasDe(g.clock.season).concat(items);
      if (!p.pareja) items = items.filter(function (i) { return i !== 'anillo'; });
      items.forEach(function (id) {
        var def = D.ITEMS[id];
        var puede = p.dinero >= def.buy;
        var f = el('div', 'fila' + (puede ? '' : ' no'));
        var desc = def.d || (def.t === 'seed'
          ? 'Se siembra en ' + D.CROPS[def.crop].s.map(function (s) { return S.SEASONS[s].toLowerCase(); }).join(' y ')
          : (def.energy ? 'Da ' + def.energy + ' de fuerzas' : ''));
        f.innerHTML = '<span class="ic">' + def.ic + '</span><div class="info"><b>' + def.n +
          '</b><small>' + desc + '</small></div><span class="precio' + (puede ? '' : ' caro') + '">' + def.buy + ' €</span>';
        f.addEventListener('click', function () { g.comprar(id, 1); self.pintarTienda(); });
        lista.appendChild(f);
      });
    } else if (this.shopTab === 'vender') {
      var vendibles = p.inv.filter(function (it) {
        var d = D.ITEMS[it.id];
        return d.sell && shop.compra.indexOf(d.t) >= 0;
      });
      if (!vendibles.length) lista.appendChild(el('p', 'ayuda-li', 'No llevas nada que te compren aquí.'));
      vendibles.forEach(function (it) {
        var def = D.ITEMS[it.id];
        var f = el('div', 'fila');
        f.innerHTML = '<span class="ic">' + def.ic + '</span><div class="info"><b>' + def.n +
          '</b><small>Llevas ' + it.q + ' · pulsa para vender uno, mantén para todo</small></div>' +
          '<span class="precio">' + def.sell + ' €</span>';
        f.addEventListener('click', function () { g.vender(it.id, 1); self.pintarTienda(); });
        f.addEventListener('dblclick', function () { g.vender(it.id, it.q); self.pintarTienda(); });
        lista.appendChild(f);
      });
      if (vendibles.length) {
        var todo = el('button', 'boton', 'Vender todo lo vendible');
        todo.addEventListener('click', function () {
          var total = 0;
          vendibles.slice().forEach(function (it) { total += D.ITEMS[it.id].sell * it.q; g.vender(it.id, it.q); });
          self.toast('Vendido todo: ' + U.fmtMoney(total), 'oro');
          self.pintarTienda();
        });
        lista.appendChild(todo);
      }
    } else {
      ['vaca', 'oveja', 'cordero', 'gallina', 'pollo', 'burro'].forEach(function (k) {
        var a = D.ANIMALS[k];
        var puede = p.dinero >= a.precio;
        var f = el('div', 'fila' + (puede ? '' : ' no'));
        var desc = a.perk || (a.prod ? 'Da ' + D.ITEMS[a.prod].n.toLowerCase() + (a.tool === 'cubo' ? ' (se ordeña a mano)' : ' cada día')
          : 'Crece y se hace ' + (D.ANIMALS[a.crece] ? D.ANIMALS[a.crece].n.toLowerCase() : 'mayor'));
        f.innerHTML = '<span class="ic">' + { vaca: '🐄', oveja: '🐑', cordero: '🐑', gallina: '🐔', pollo: '🐤', burro: '🫏' }[k] +
          '</span><div class="info"><b>' + a.n + '</b><small>' + desc + '</small></div>' +
          '<span class="precio' + (puede ? '' : ' caro') + '">' + a.precio + ' €</span>';
        f.addEventListener('click', function () { g.comprarAnimal(k); self.pintarTienda(); });
        lista.appendChild(f);
      });
    }
  };

  /* --------------------------------------------------------------- ordeño */
  UI.prototype.abrirOrdeno = function (animal) {
    $('ordeno-titulo').textContent = 'Ordeñando a ' + animal.nombre;
    $('ordeno').classList.remove('oculto');
  };
  UI.prototype.cerrarOrdeno = function () { $('ordeno').classList.add('oculto'); };
  UI.prototype.refrescarOrdeno = function (m) {
    $('ordeno-leche').style.height = m.lleno + '%';
    $('ordeno-pct').textContent = Math.round(m.lleno) + '%';
    $('ordeno-compas').style.width = (m.ventana / m.compas * 100).toFixed(1) + '%';
    $('ordeno-msg').textContent = m.resultado
      ? (m.resultado === 'ok' ? '¡Cubo lleno!' : 'La res se ha movido…')
      : m.msg;
    $('ordeno-fallos').textContent = m.fallos;
    $('mano-izq').classList.toggle('activa', m.mano === 0 && !m.resultado);
    $('mano-der').classList.toggle('activa', m.mano === 1 && !m.resultado);
  };

  /* ------------------------------------------------------- parte del día */
  UI.prototype.parteDelDia = function (rep) {
    var g = this.g;
    $('parte-fecha').textContent = g.clock.dateString();
    $('parte-meteo').innerHTML = (METEO_IC[g.clock.weather] || '☀️') +
      '<div style="font-size:15px;color:var(--tenue)">' + g.clock.weatherName() + '</div>';
    var ul = $('parte-lista');
    ul.innerHTML = '';
    if (!rep.eventos.length) ul.appendChild(el('li', '', 'Un día tranquilo en Sorríos.'));
    rep.eventos.forEach(function (e) { ul.appendChild(el('li', '', e)); });
    $('parte').classList.remove('oculto');
    g.estado = 'parte';
  };

  UI.prototype.hudVisible = function (v) { $('hud').classList.toggle('oculto', !v); };

  S.UI = UI;

})(window);
