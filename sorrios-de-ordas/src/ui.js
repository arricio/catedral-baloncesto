/* ============================================================================
   SORRÍOS DE ORDÁS — ui.js
   HUD (reloj, estación, tiempo, energía, dinero, cinturón de herramientas),
   diálogos, menú de pausa, tiendas, cocina, resumen del día, pantalla de
   título y el minijuego de ordeño a mano.
   ========================================================================== */
(function (global) {
  'use strict';
  var G = global.SORRIOS, M = G.M, D = G.DATA, Art = G.Art, Sys = G.Systems;

  function UI(game) {
    this.game = game;
    this.toasts = [];
    this.dialogBox = null;
    this.menu = null;
    this.sel = 0;
    this.scroll = 0;
    this.hits = [];
    this.tab = 0;
    this.shopId = null;
    this.shopMode = 0;     // 0 comprar, 1 vender
    this.report = null;
    this.notice = null;
    this.hintText = '';
  }

  /* ------------------------------------------------------------ dibujo --- */
  UI.prototype.R = function () { return G.Render; };
  UI.prototype.ctx = function () { return G.Render.ctx; };

  function panel(ctx, x, y, w, h, alpha) {
    ctx.fillStyle = 'rgba(24,18,12,' + (alpha == null ? 0.82 : alpha) + ')';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(196,166,110,.85)';
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = 'rgba(255,255,255,.10)';
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
  }
  function text(ctx, s, x, y, col, size, align, bold) {
    ctx.font = (bold === false ? '' : 'bold ') + (size || 9) + 'px "Trebuchet MS", "Segoe UI", sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillText(s, x + 1, y + 1);
    ctx.fillStyle = col || '#f0e6cf';
    ctx.fillText(s, x, y);
    ctx.textAlign = 'left';
  }
  function bar(ctx, x, y, w, h, t, col, bg) {
    ctx.fillStyle = bg || 'rgba(0,0,0,.55)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col;
    ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * M.clamp(t, 0, 1))), h - 2);
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * M.clamp(t, 0, 1))), 1);
    ctx.strokeStyle = 'rgba(196,166,110,.7)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  function wrap(ctx, s, maxW, size) {
    ctx.font = 'bold ' + size + 'px "Trebuchet MS", "Segoe UI", sans-serif';
    var words = String(s).split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; }
      else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* ------------------------------------------------------------ toasts --- */
  UI.prototype.toast = function (msg, color) {
    this.toasts.push({ msg: msg, color: color || '#f0e6cf', life: 2.6 });
    if (this.toasts.length > 4) this.toasts.shift();
  };
  UI.prototype.dialog = function (title, body, npc) {
    this.dialogBox = { title: title, body: body, npc: npc, t: 0, chars: 0 };
    this.game.state = 'dialog';
  };
  UI.prototype.noticeMsg = function (title, body) {
    this.notice = { title: title, body: body };
    this.game.state = 'notice';
  };

  /* ---------------------------------------------------- zonas pulsables -- */
  UI.prototype.hit = function (id, x, y, w, h) {
    this.hits.push({ id: id, x: x, y: y, w: w, h: h });
  };
  UI.prototype.tappedId = function () {
    var p = G.Input.pointer;
    if (!p.tapped) return null;
    var R = this.R();
    var px = p.x * R.w, py = p.y * R.h;
    for (var i = this.hits.length - 1; i >= 0; i--) {
      var r = this.hits[i];
      if (px >= r.x && py >= r.y && px <= r.x + r.w && py <= r.y + r.h) return r.id;
    }
    return null;
  };

  /* ================================================================= HUD = */
  UI.prototype.drawHUD = function () {
    var ctx = this.ctx(), R = this.R(), g = this.game, p = g.player, c = g.clock;
    this.hits.length = 0;

    // ---- panel de fecha / hora / tiempo ----
    var pw = 104, ph = 40;
    panel(ctx, 4, 4, pw, ph);
    text(ctx, D.DAY_NAMES[c.weekday].slice(0, 3) + ' ' + c.day + ' ' + D.SEASON_NAMES[c.season], 10, 15, '#f4e2a8', 9);
    text(ctx, c.timeString(), 10, 27, c.isNight() ? '#a8c8e8' : '#ffffff', 11);
    // icono del tiempo
    this.weatherIcon(ctx, pw - 16, 12, c.weather);
    text(ctx, 'Año ' + c.year, pw - 8, 36, '#c9b48a', 8, 'right');
    var seasonCol = ['#8fc45c', '#f2c14a', '#d97a3a', '#a8c8e8'][c.season];
    ctx.fillStyle = seasonCol;
    ctx.fillRect(4, 4 + ph - 2, pw, 2);

    // ---- dinero ----
    var mw = 82;
    panel(ctx, R.w - mw - 4, 4, mw, 18);
    text(ctx, G.fmtMoney(p.money), R.w - 8, 17, '#f2d96a', 10, 'right');

    // ---- energía ----
    var ex = 4, ey = 4 + ph + 6;
    panel(ctx, ex, ey, 104, 20);
    text(ctx, 'Fuerzas', ex + 6, ey + 13, '#c9b48a', 8);
    var t = p.energy / p.maxEnergy;
    var ecol = t > 0.5 ? '#7fc04a' : (t > 0.2 ? '#f2c14a' : '#e0503a');
    bar(ctx, ex + 44, ey + 5, 54, 10, t, ecol);

    // ---- regadera ----
    if (p.currentTool() === 'regadera') {
      panel(ctx, ex, ey + 24, 104, 16);
      text(ctx, 'Agua', ex + 6, ey + 36, '#c9b48a', 8);
      bar(ctx, ex + 44, ey + 28, 54, 8, p.wateringLevel / p.wateringMax, '#6d9dc5');
    }

    // ---- cinturón de herramientas ----
    var n = p.hotbar.length, slot = 22, gap = 2;
    var totw = n * (slot + gap) - gap;
    var hx = Math.round((R.w - totw) / 2), hy = R.h - slot - 6;
    if (G.Input.touchMode) hy = R.h - slot - 6;
    for (var i = 0; i < n; i++) {
      var x = hx + i * (slot + gap);
      var id = p.hotbar[i];
      var def = D.ITEMS[id];
      panel(ctx, x, hy, slot, slot, i === p.slot ? 0.92 : 0.7);
      if (i === p.slot) {
        ctx.strokeStyle = '#f4e2a8'; ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, hy + 0.5, slot - 1, slot - 1);
      }
      if (def) {
        ctx.drawImage(Art.icon(id, def), x + 3, hy + 3);
        if (def.type !== 'tool') {
          var q = p.countItem(id);
          text(ctx, String(q), x + slot - 2, hy + slot - 2, '#ffffff', 8, 'right');
        }
      }
      this.hit('slot' + i, x, hy, slot, slot);
    }
    // nombre de la herramienta seleccionada
    var cur = D.ITEMS[p.currentTool()];
    if (cur) text(ctx, cur.name, R.w / 2, hy - 4, '#f0e6cf', 9, 'center');

    // ---- pista de interacción ----
    if (this.hintText) {
      var hw2 = ctx.measureText(this.hintText).width + 16;
      text(ctx, this.hintText, R.w / 2, hy - 16, '#a8e07a', 9, 'center');
    }

    // ---- botón de menú (ratón/escritorio) ----
    if (!G.Input.touchMode) {
      panel(ctx, R.w - 26, R.h - 26, 22, 22);
      text(ctx, '☰', R.w - 15, R.h - 10, '#f0e6cf', 12, 'center');
      this.hit('menu', R.w - 26, R.h - 26, 22, 22);
    }

    // ---- avisos flotantes ----
    for (var k = 0; k < this.toasts.length; k++) {
      var tst = this.toasts[k];
      var a = M.clamp(tst.life, 0, 1);
      ctx.globalAlpha = a;
      var ty = hy - 30 - k * 14;
      var tw = ctx.measureText(tst.msg).width;
      ctx.font = 'bold 9px "Trebuchet MS", sans-serif';
      tw = ctx.measureText(tst.msg).width + 14;
      panel(ctx, Math.round((R.w - tw) / 2), ty - 10, tw, 14, 0.75);
      text(ctx, tst.msg, R.w / 2, ty, tst.color, 9, 'center');
      ctx.globalAlpha = 1;
    }
  };

  UI.prototype.weatherIcon = function (ctx, x, y, w) {
    if (w === 'sol') {
      ctx.fillStyle = '#f2d96a';
      ctx.beginPath(); ctx.arc(x, y, 5, 0, 6.284); ctx.fill();
      ctx.strokeStyle = '#f2d96a'; ctx.lineWidth = 1;
      for (var i = 0; i < 8; i++) {
        var a = i / 8 * 6.284;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 6.5, y + Math.sin(a) * 6.5);
        ctx.lineTo(x + Math.cos(a) * 8.5, y + Math.sin(a) * 8.5);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = w === 'tormenta' ? '#6a7484' : '#c4ccd6';
      ctx.beginPath(); ctx.arc(x - 3, y, 4, 0, 6.284); ctx.arc(x + 2, y - 1, 5, 0, 6.284);
      ctx.arc(x + 5, y + 1, 3.5, 0, 6.284); ctx.fill();
      ctx.fillRect(x - 6, y, 13, 4);
      if (w === 'lluvia' || w === 'tormenta') {
        ctx.strokeStyle = '#8fc8e8';
        for (var j = 0; j < 3; j++) {
          ctx.beginPath(); ctx.moveTo(x - 4 + j * 4, y + 5); ctx.lineTo(x - 6 + j * 4, y + 9); ctx.stroke();
        }
      }
      if (w === 'tormenta') {
        ctx.fillStyle = '#f2d96a';
        ctx.fillRect(x, y + 4, 2, 4); ctx.fillRect(x - 1, y + 8, 3, 2);
      }
      if (w === 'nieve') {
        ctx.fillStyle = '#ffffff';
        for (var k = 0; k < 3; k++) ctx.fillRect(x - 4 + k * 4, y + 6 + (k % 2) * 2, 2, 2);
      }
    }
  };

  /* ============================================================= DIÁLOGO = */
  UI.prototype.drawDialog = function (dt) {
    var ctx = this.ctx(), R = this.R(), d = this.dialogBox;
    if (!d) return;
    d.t += dt;
    d.chars = Math.min(d.body.length, d.chars + dt * 60);
    var h = 62, y = R.h - h - 6, x = 8, w = R.w - 16;
    panel(ctx, x, y, w, h, 0.9);
    // retrato
    if (d.npc) {
      var sheet = d.npc.sheet();
      ctx.drawImage(sheet, 0, 0, Art.CH_W, Art.CH_H, x + 5, y + 6, Art.CH_W * 1.4, Art.CH_H * 1.4);
    }
    var tx = x + (d.npc ? 34 : 10);
    text(ctx, d.title, tx, y + 15, '#f4e2a8', 10);
    var lines = wrap(ctx, d.body.slice(0, Math.floor(d.chars)), w - (d.npc ? 46 : 22), 9);
    for (var i = 0; i < Math.min(lines.length, 3); i++)
      text(ctx, lines[i], tx, y + 30 + i * 11, '#e8dcc4', 9);
    if (d.chars >= d.body.length && Math.floor(d.t * 2) % 2 === 0)
      text(ctx, '▼', x + w - 12, y + h - 8, '#f4e2a8', 9);
    this.hit('dialog_next', x, y, w, h);
  };

  /* ============================================================== MENÚS == */
  var TABS = ['Mochila', 'Vecinos', 'Granja', 'Ayuda', 'Ajustes'];

  UI.prototype.openMenu = function () {
    this.menu = 'pause'; this.sel = 0; this.scroll = 0;
    this.game.state = 'menu';
    G.Audio.sfx('menu');
  };
  UI.prototype.closeMenu = function () {
    this.menu = null;
    this.game.state = 'play';
    G.Audio.sfx('menu');
  };

  UI.prototype.drawMenu = function () {
    var ctx = this.ctx(), R = this.R(), g = this.game;
    ctx.fillStyle = 'rgba(8,10,8,.72)';
    ctx.fillRect(0, 0, R.w, R.h);
    var w = Math.min(R.w - 16, 340), h = Math.min(R.h - 16, 210);
    var x = Math.round((R.w - w) / 2), y = Math.round((R.h - h) / 2);
    panel(ctx, x, y, w, h, 0.94);

    // pestañas
    var tw = Math.floor((w - 8) / TABS.length);
    for (var i = 0; i < TABS.length; i++) {
      var tx = x + 4 + i * tw;
      ctx.fillStyle = i === this.tab ? 'rgba(196,166,110,.35)' : 'rgba(0,0,0,.3)';
      ctx.fillRect(tx, y + 4, tw - 2, 16);
      text(ctx, TABS[i], tx + tw / 2 - 1, y + 15, i === this.tab ? '#f4e2a8' : '#a89b78', 8, 'center');
      this.hit('tab' + i, tx, y + 4, tw - 2, 16);
    }
    var cx = x + 8, cy = y + 26, cw = w - 16, chh = h - 34;

    if (this.tab === 0) this.drawInventory(ctx, cx, cy, cw, chh);
    else if (this.tab === 1) this.drawRelations(ctx, cx, cy, cw, chh);
    else if (this.tab === 2) this.drawFarm(ctx, cx, cy, cw, chh);
    else if (this.tab === 3) this.drawHelp(ctx, cx, cy, cw, chh);
    else this.drawSettings(ctx, cx, cy, cw, chh);

    text(ctx, 'ESC / ☰ cerrar', x + w - 6, y + h - 6, '#a89b78', 8, 'right');
    this.hit('close', x + w - 60, y + h - 16, 56, 14);
  };

  UI.prototype.drawInventory = function (ctx, x, y, w, h) {
    var g = this.game, p = g.player;
    var cols = Math.floor(w / 26), cell = 26;
    text(ctx, 'Mochila (' + p.inv.length + '/' + p.invMax + ')', x, y + 8, '#f4e2a8', 9);
    var gy = y + 14;
    for (var i = 0; i < p.invMax; i++) {
      var col = i % cols, row = Math.floor(i / cols);
      var ix = x + col * cell, iy = gy + row * cell;
      if (iy + cell > y + h - 22) break;
      var it = p.inv[i];
      panel(ctx, ix, iy, cell - 2, cell - 2, i === this.sel ? 0.9 : 0.55);
      if (i === this.sel) { ctx.strokeStyle = '#f4e2a8'; ctx.lineWidth = 1; ctx.strokeRect(ix + 0.5, iy + 0.5, cell - 3, cell - 3); }
      if (it) {
        var def = D.ITEMS[it.id];
        ctx.drawImage(Art.icon(it.id, def), ix + 4, iy + 4);
        text(ctx, String(it.qty), ix + cell - 5, iy + cell - 5, '#fff', 8, 'right');
      }
      this.hit('inv' + i, ix, iy, cell - 2, cell - 2);
    }
    var sel = p.inv[this.sel];
    if (sel) {
      var def2 = D.ITEMS[sel.id];
      text(ctx, def2.name, x, y + h - 12, '#ffffff', 9);
      var sub = (def2.desc || '') + (def2.sell ? '  Vale ' + def2.sell + ' ₧' : '') +
                (def2.energy ? '  (+' + def2.energy + ' fuerzas)' : '');
      text(ctx, sub, x, y + h - 2, '#c9b48a', 8);
      if (def2.energy) { text(ctx, '[A] comer', x + w - 4, y + h - 12, '#a8e07a', 8, 'right'); this.hit('eat', x + w - 60, y + h - 20, 58, 12); }
      if (def2.type === 'seed' || def2.type === 'feed' || def2.type === 'special')
        { text(ctx, '[B] a la mano', x + w - 4, y + h - 2, '#8fc8e8', 8, 'right'); this.hit('equip', x + w - 70, y + h - 10, 68, 12); }
    }
  };

  UI.prototype.drawRelations = function (ctx, x, y, w, h) {
    var g = this.game;
    var rows = g.npcs.slice().sort(function (a, b) { return b.points - a.points; });
    text(ctx, 'Vecinos de Sorríos', x, y + 8, '#f4e2a8', 9);
    var start = this.scroll, max = Math.floor((h - 20) / 15);
    for (var i = 0; i < Math.min(max, rows.length - start); i++) {
      var n = rows[start + i];
      var ry = y + 16 + i * 15;
      ctx.fillStyle = (start + i) === this.sel ? 'rgba(196,166,110,.25)' : 'rgba(0,0,0,.22)';
      ctx.fillRect(x, ry, w, 13);
      ctx.drawImage(n.sheet(), 0, 0, Art.CH_W, Art.CH_H, x + 1, ry - 4, Art.CH_W * 0.62, Art.CH_H * 0.62);
      var tag = n.married ? ' (esposa)' : (n.dating ? ' (novia)' : '');
      text(ctx, n.name + tag, x + 14, ry + 10, '#f0e6cf', 9);
      text(ctx, n.def.role, x + 92, ry + 10, '#a89b78', 8);
      text(ctx, Sys.hearts(n.hearts), x + w - 4, ry + 10, '#e8506a', 8, 'right');
      this.hit('npc' + (start + i), x, ry, w, 13);
    }
  };

  UI.prototype.drawFarm = function (ctx, x, y, w, h) {
    var g = this.game, p = g.player;
    text(ctx, 'La granja de Arricio', x, y + 8, '#f4e2a8', 9);
    var counts = {};
    for (var i = 0; i < g.animals.length; i++) {
      var k = g.animals[i].def.name;
      counts[k] = (counts[k] || 0) + 1;
    }
    var lines = [];
    for (var k2 in counts) lines.push(counts[k2] + ' × ' + k2);
    if (!lines.length) lines.push('Todavía no tienes animales.');
    var plots = 0, planted = 0, ready = 0;
    for (var mid in g.maps) {
      var mp = g.maps[mid];
      for (var s in mp.soil) {
        plots++;
        var so = mp.soil[s];
        if (so.crop) { planted++; if (D.cropStage(so.crop, so.grow) === 4) ready++; }
      }
    }
    var info = [
      'Ganado: ' + lines.join(', '),
      'Huerto: ' + plots + ' parcelas, ' + planted + ' sembradas, ' + ready + ' para recoger',
      'Días vividos en el pueblo: ' + g.clock.dayCount,
      'Cosechas recogidas: ' + p.stats.cropsHarvested + '   Ordeños: ' + p.stats.animalsMilked,
      'Huevos: ' + p.stats.eggsCollected + '   Leña: ' + p.stats.wood,
      'Ganado en total: ' + G.fmtMoney(p.stats.earned)
    ];
    if (p.spouse) {
      var sp = g.npc(p.spouse);
      info.push('Casado con ' + (sp ? sp.name : '—'));
    } else if (p.partner) {
      var pa = g.npc(p.partner);
      info.push('Saliendo con ' + (pa ? pa.name : '—'));
    }
    if (g.children.length) {
      var kids = g.children.map(function (c) {
        return c.name + ' (' + ['bebé', 'niñ' + (c.girl ? 'a' : 'o'), 'moz' + (c.girl ? 'a' : 'o')][c.stage] + ')';
      });
      info.push('Hijos: ' + kids.join(', '));
    }
    for (var j = 0; j < info.length; j++) {
      var wl = wrap(ctx, info[j], w, 8);
      for (var q = 0; q < wl.length; q++) text(ctx, wl[q], x, y + 22 + j * 11 + q * 9, '#e8dcc4', 8);
    }
  };

  UI.prototype.drawHelp = function (ctx, x, y, w, h) {
    text(ctx, 'Cómo se juega', x, y + 8, '#f4e2a8', 9);
    var lines = [
      'MOVER: flechas/WASD o joystick.   ACCIÓN: A / E / espacio.',
      'HERRAMIENTA: B / F.   CAMBIAR: ◀ ▶ / Q y R / 1-9.',
      '', 'CONSEJOS:'
    ].concat(D.TIPS.slice(0, 8));
    var yy = y + 20;
    for (var i = 0; i < lines.length; i++) {
      var wl = wrap(ctx, lines[i], w, 8);
      for (var q = 0; q < wl.length; q++) { text(ctx, wl[q], x, yy, '#e8dcc4', 8); yy += 9; }
      if (yy > y + h - 6) break;
    }
  };

  UI.prototype.drawSettings = function (ctx, x, y, w, h) {
    var g = this.game;
    text(ctx, 'Ajustes', x, y + 8, '#f4e2a8', 9);
    var opts = [
      (G.Audio.muted ? '🔇 Sonido: APAGADO' : '🔊 Sonido: ENCENDIDO'),
      '💾 Guardar la partida',
      '📋 Guardado automático: ' + (g.autosave ? 'sí' : 'no'),
      '🗑️ Empezar de cero (borra la partida)'
    ];
    for (var i = 0; i < opts.length; i++) {
      var ry = y + 20 + i * 18;
      ctx.fillStyle = i === this.sel ? 'rgba(196,166,110,.28)' : 'rgba(0,0,0,.24)';
      ctx.fillRect(x, ry, w, 15);
      text(ctx, opts[i], x + 6, ry + 11, i === this.sel ? '#f4e2a8' : '#e8dcc4', 9);
      this.hit('set' + i, x, ry, w, 15);
    }
    text(ctx, 'Sorríos de Ordás — hecho con cariño para Arricio.', x, y + h - 2, '#8a7f66', 8);
  };

  /* =============================================================== TIENDA = */
  UI.prototype.openShop = function (shopId) {
    this.shopId = shopId; this.shopMode = 0; this.sel = 0; this.scroll = 0;
    this.game.state = 'shop';
    G.Audio.sfx('menu');
  };
  UI.prototype.shopTabs = function () {
    var shop = D.SHOPS[this.shopId];
    return (shop && shop.livestock) ? ['Comprar', 'Vender', 'Ganado'] : ['Comprar', 'Vender'];
  };
  UI.prototype.shopList = function () {
    var g = this.game, shop = D.SHOPS[this.shopId];
    if (!shop) return [];
    if (this.shopMode === 2) {
      return Sys.LIVESTOCK.map(function (k) {
        return { id: k, animal: true, price: D.ANIMALS[k].price, name: D.ANIMALS[k].name };
      });
    }
    if (this.shopMode === 0) {
      var list = shop.stock.slice();
      if (shop.seedsBySeason) list = D.seedsForSeason(g.clock.season).concat(list);
      // El anillo solo aparece si ya tienes novia
      if (!g.player.partner) list = list.filter(function (i) { return i !== 'anillo'; });
      return list.map(function (id) { return { id: id, price: D.ITEMS[id].buy }; });
    }
    var out = [];
    for (var i = 0; i < g.player.inv.length; i++) {
      var it = g.player.inv[i], def = D.ITEMS[it.id];
      if (!def.sell) continue;
      if (shop.buysFrom.indexOf(def.type) < 0) continue;
      out.push({ id: it.id, price: def.sell, qty: it.qty });
    }
    return out;
  };
  UI.prototype.drawShop = function () {
    var ctx = this.ctx(), R = this.R(), g = this.game;
    var shop = D.SHOPS[this.shopId];
    ctx.fillStyle = 'rgba(8,10,8,.7)';
    ctx.fillRect(0, 0, R.w, R.h);
    var w = Math.min(R.w - 16, 300), h = Math.min(R.h - 16, 200);
    var x = Math.round((R.w - w) / 2), y = Math.round((R.h - h) / 2);
    panel(ctx, x, y, w, h, 0.95);
    text(ctx, shop.name, x + 8, y + 14, '#f4e2a8', 10);
    text(ctx, G.fmtMoney(g.player.money), x + w - 8, y + 14, '#f2d96a', 9, 'right');

    // pestañas comprar / vender / ganado
    var tabs = this.shopTabs();
    var tabW = Math.floor((w - 16) / tabs.length) - 2;
    tabs.forEach(function (t, i) {
      var tx = x + 8 + i * (tabW + 3);
      ctx.fillStyle = i === this.shopMode ? 'rgba(196,166,110,.35)' : 'rgba(0,0,0,.3)';
      ctx.fillRect(tx, y + 20, tabW, 14);
      text(ctx, t, tx + tabW / 2, y + 30, i === this.shopMode ? '#f4e2a8' : '#a89b78', 8, 'center');
      this.hit('shoptab' + i, tx, y + 20, tabW, 14);
    }, this);

    var list = this.shopList();
    if (this.sel >= list.length) this.sel = Math.max(0, list.length - 1);
    var rowH = 17, maxRows = Math.floor((h - 56) / rowH);
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + maxRows) this.scroll = this.sel - maxRows + 1;

    for (var i2 = 0; i2 < Math.min(maxRows, list.length - this.scroll); i2++) {
      var it = list[this.scroll + i2];
      var ry = y + 38 + i2 * rowH;
      var selected = (this.scroll + i2) === this.sel;
      ctx.fillStyle = selected ? 'rgba(196,166,110,.28)' : 'rgba(0,0,0,.22)';
      ctx.fillRect(x + 6, ry, w - 12, rowH - 2);
      if (it.animal) {
        var sh = Art.animals[it.id][0], asz = Art.ANIMAL_DEFS[it.id];
        var scl = Math.min(1, 14 / asz.h);
        ctx.drawImage(sh, 0, 0, asz.w, asz.h, x + 8, ry + 1, Math.round(asz.w * scl), Math.round(asz.h * scl));
        text(ctx, it.name, x + 34, ry + 11, '#f0e6cf', 9);
      } else {
        var def = D.ITEMS[it.id];
        ctx.drawImage(Art.icon(it.id, def), x + 8, ry - 1);
        text(ctx, def.name, x + 26, ry + 11, '#f0e6cf', 9);
        if (this.shopMode === 1) text(ctx, '×' + it.qty, x + w - 62, ry + 11, '#a89b78', 8, 'right');
      }
      var afford = this.shopMode === 1 || g.player.money >= it.price;
      text(ctx, it.price + ' ₧', x + w - 12, ry + 11, afford ? '#f2d96a' : '#a06060', 9, 'right');
      this.hit('shopitem' + (this.scroll + i2), x + 6, ry, w - 12, rowH - 2);
    }
    if (!list.length) text(ctx, this.shopMode === 1 ? 'No llevas nada que te compren.' : 'Hoy no hay género.', x + w / 2, y + h / 2, '#a89b78', 9, 'center');

    var selItem = list[this.sel];
    if (selItem) {
      var desc;
      if (selItem.animal) {
        var ad = D.ANIMALS[selItem.id];
        desc = ad.perk || (ad.product ? 'Da ' + D.ITEMS[ad.product].name.toLowerCase() +
               (ad.productTool === 'cubo' ? ' (se ordeña a mano).' : ' cada día.') :
               'Crece y se hace ' + (D.ANIMALS[ad.growsInto] ? D.ANIMALS[ad.growsInto].name.toLowerCase() : 'mayor') + '.');
      } else {
        var d2 = D.ITEMS[selItem.id];
        desc = d2.desc || (d2.type === 'seed' ? 'Se siembra en ' + D.CROPS[d2.crop].seasons.map(function (s) { return D.SEASON_NAMES[s].toLowerCase(); }).join(' y ') + '.' :
                (d2.energy ? 'Da ' + d2.energy + ' de fuerzas.' : ''));
      }
      var dl = wrap(ctx, desc, w - 16, 8);
      text(ctx, dl[0] || '', x + 8, y + h - 16, '#c9b48a', 8);
    }
    var verbo = this.shopMode === 1 ? 'vender' : 'comprar';
    text(ctx, '[A] ' + verbo + (this.shopMode === 2 ? '' : '   [B] ×5') + '   [ESC] salir', x + 8, y + h - 5, '#8fc8e8', 8);
    this.hit('shopclose', x + w - 40, y + h - 14, 36, 12);
  };

  /* =============================================================== COCINA = */
  UI.prototype.openKitchen = function () {
    this.menu = 'kitchen'; this.sel = 0;
    this.game.state = 'kitchen';
    G.Audio.sfx('menu');
  };
  UI.prototype.drawKitchen = function () {
    var ctx = this.ctx(), R = this.R(), g = this.game;
    ctx.fillStyle = 'rgba(8,10,8,.7)';
    ctx.fillRect(0, 0, R.w, R.h);
    var w = Math.min(R.w - 16, 300), h = Math.min(R.h - 16, 190);
    var x = Math.round((R.w - w) / 2), y = Math.round((R.h - h) / 2);
    panel(ctx, x, y, w, h, 0.95);
    text(ctx, 'La cocina de casa', x + 8, y + 14, '#f4e2a8', 10);
    var R2 = Sys.RECIPES;
    for (var i = 0; i < R2.length; i++) {
      var r = R2[i], ry = y + 22 + i * 20;
      var can = Sys.canCook(g, r);
      ctx.fillStyle = i === this.sel ? 'rgba(196,166,110,.28)' : 'rgba(0,0,0,.22)';
      ctx.fillRect(x + 6, ry, w - 12, 18);
      ctx.drawImage(Art.icon(r.out[0], D.ITEMS[r.out[0]]), x + 8, ry + 1);
      text(ctx, r.name, x + 26, ry + 9, can ? '#f0e6cf' : '#8a7f66', 9);
      var need = r.need.map(function (n) { return n[1] + '× ' + D.ITEMS[n[0]].name; }).join(', ');
      text(ctx, need, x + 26, ry + 17, can ? '#a8e07a' : '#a06060', 7);
      this.hit('cook' + i, x + 6, ry, w - 12, 18);
    }
    text(ctx, '[A] cocinar   [ESC] salir', x + 8, y + h - 5, '#8fc8e8', 8);
  };

  /* ========================================================== VENDER CAJA = */
  UI.prototype.openShip = function () {
    this.menu = 'ship'; this.sel = 0;
    this.game.state = 'ship';
    G.Audio.sfx('menu');
  };
  UI.prototype.drawShip = function () {
    var ctx = this.ctx(), R = this.R(), g = this.game;
    ctx.fillStyle = 'rgba(8,10,8,.7)';
    ctx.fillRect(0, 0, R.w, R.h);
    var w = Math.min(R.w - 16, 300), h = Math.min(R.h - 16, 190);
    var x = Math.round((R.w - w) / 2), y = Math.round((R.h - h) / 2);
    panel(ctx, x, y, w, h, 0.95);
    text(ctx, 'Caja de recogida', x + 8, y + 14, '#f4e2a8', 10);
    text(ctx, 'El camión de la cooperativa pasa cada mañana.', x + 8, y + 24, '#c9b48a', 8);
    var list = g.player.inv.filter(function (it) { return D.ITEMS[it.id].sell; });
    var rowH = 16, maxRows = Math.floor((h - 60) / rowH);
    if (this.sel >= list.length) this.sel = Math.max(0, list.length - 1);
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + maxRows) this.scroll = this.sel - maxRows + 1;
    for (var i = 0; i < Math.min(maxRows, list.length - this.scroll); i++) {
      var it = list[this.scroll + i], def = D.ITEMS[it.id];
      var ry = y + 32 + i * rowH;
      ctx.fillStyle = (this.scroll + i) === this.sel ? 'rgba(196,166,110,.28)' : 'rgba(0,0,0,.22)';
      ctx.fillRect(x + 6, ry, w - 12, rowH - 2);
      ctx.drawImage(Art.icon(it.id, def), x + 8, ry - 1);
      text(ctx, def.name + '  ×' + it.qty, x + 26, ry + 11, '#f0e6cf', 9);
      text(ctx, (def.sell * it.qty) + ' ₧', x + w - 12, ry + 11, '#f2d96a', 9, 'right');
      this.hit('ship' + (this.scroll + i), x + 6, ry, w - 12, rowH - 2);
    }
    if (!list.length) text(ctx, 'No llevas nada que vender.', x + w / 2, y + h / 2, '#a89b78', 9, 'center');
    text(ctx, '[A] vender uno   [B] vender todo   [ESC] salir', x + 8, y + h - 5, '#8fc8e8', 8);
    this.hit('shipall', x + w - 90, y + h - 13, 86, 12);
  };

  /* ============================================================== ORDEÑO = */
  UI.prototype.drawMilking = function () {
    var ctx = this.ctx(), R = this.R(), m = this.game.milking;
    if (!m.active) return;
    ctx.fillStyle = 'rgba(8,10,8,.55)';
    ctx.fillRect(0, 0, R.w, R.h);

    var sheet = m.animal.sheet(), sz = m.animal.size();
    var w = Math.min(R.w - 20, 250), h = Math.min(R.h - 24, 176);
    var x = Math.round((R.w - w) / 2), y = Math.round((R.h - h) / 2);
    var shake = m.shake > 0 ? Math.round(Math.sin(m.shake * 90) * 2) : 0;
    var cx = x + w / 2 + shake;
    panel(ctx, x + shake, y, w, h, 0.95);
    text(ctx, 'Ordeñando a ' + m.animal.name, cx, y + 14, '#f4e2a8', 10, 'center');
    text(ctx, 'Fallos: ' + m.misses + '/5', x + w - 8, y + 14, '#e0a8a8', 8, 'right');

    // --- el animal, visto de perfil ---
    var aTop = y + 20;
    var aSc = h > 158 ? 2 : 1.4;
    ctx.drawImage(sheet, 0, 0, sz.w, sz.h,
      Math.round(cx - sz.w * aSc / 2), aTop, Math.round(sz.w * aSc), Math.round(sz.h * aSc));

    // --- ubre y pezones, justo debajo del animal ---
    var uy = aTop + Math.round(sz.h * aSc) + 5;
    Art.ellipse(ctx, cx, uy, 15, 8, '#f0b8b0');
    Art.ellipse(ctx, cx, uy - 2, 13, 6, '#f8ccc4');
    for (var i = 0; i < 2; i++) {
      var tx0 = cx - 8 + i * 16;
      ctx.fillStyle = '#e8a09a';
      ctx.fillRect(tx0 - 2, uy + 5, 4, 7);
      ctx.fillStyle = '#d98f8a';
      ctx.fillRect(tx0 - 2, uy + 10, 4, 2);
    }

    // --- las dos manos ---
    for (var j = 0; j < 2; j++) {
      var active = (m.hand === j);
      var press = active && m.flash > 0;
      var hx = cx - 8 + j * 16;
      var hy = uy + 5 + (press ? 4 : 0);
      // puño
      ctx.fillStyle = press ? '#f2d0aa' : (active ? '#e8b98c' : '#9a8168');
      ctx.fillRect(hx - 7, hy, 14, 10);
      ctx.fillStyle = press ? '#e0b48a' : (active ? '#d0a173' : '#856d56');
      ctx.fillRect(hx - 7, hy + 7, 14, 3);
      for (var f = 0; f < 3; f++) {
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        ctx.fillRect(hx - 5 + f * 4, hy + 2, 1, 5);
      }
      // muñeca / manga
      ctx.fillStyle = '#4a7a9a';
      ctx.fillRect(hx - 8, hy + 9, 16, 4);
      if (active) {
        var glow = 0.45 + 0.55 * (m.window / m.beat);
        ctx.globalAlpha = glow;
        text(ctx, j === 0 ? '◀' : '▶', hx, hy - 5, '#f4e2a8', 11, 'center');
        ctx.globalAlpha = 1;
      }
    }

    // --- chorros de leche ---
    for (var s = 0; s < m.squirts.length; s++) {
      var sq = m.squirts[s];
      ctx.fillStyle = 'rgba(255,255,255,' + M.clamp(sq.life * 2, 0, 1).toFixed(2) + ')';
      ctx.fillRect(cx - 9 + (sq.x > 0 ? 16 : 0) + 1, uy + 16 + sq.y * 0.4, 2, 6);
    }

    // --- el cubo ---
    var bw2 = 44, bh2 = 24, by = uy + 26;
    ctx.fillStyle = '#6e747d'; ctx.fillRect(cx - bw2 / 2, by, bw2, bh2);
    ctx.fillStyle = '#a8adb6'; ctx.fillRect(cx - bw2 / 2 + 1, by + 1, bw2 - 2, bh2 - 2);
    ctx.fillStyle = '#c8ccd4'; ctx.fillRect(cx - bw2 / 2 + 1, by + 1, 3, bh2 - 2);
    var fillH = Math.round((bh2 - 5) * (m.filled / 100));
    if (fillH > 0) {
      ctx.fillStyle = '#f6f2e8';
      ctx.fillRect(cx - bw2 / 2 + 3, by + bh2 - 3 - fillH, bw2 - 6, fillH);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - bw2 / 2 + 3, by + bh2 - 3 - fillH, bw2 - 6, 2);
    }
    ctx.fillStyle = '#6e747d';
    ctx.fillRect(cx - bw2 / 2 - 2, by - 2, bw2 + 4, 3);

    // --- barra de ritmo ---
    var barX = x + 14, barW = w - 28, barY = y + h - 15;
    var tRatio = m.window / m.beat;
    bar(ctx, barX, barY, barW, 9, tRatio, tRatio > 0.55 ? '#7fc04a' : '#c9a95c');
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillRect(barX + Math.round(barW * 0.55), barY - 2, 1, 13);
    ctx.fillStyle = 'rgba(127,192,74,.25)';
    ctx.fillRect(barX + Math.round(barW * 0.55), barY + 1, Math.round(barW * 0.45) - 1, 7);

    text(ctx, m.msg, cx, y + h - 20, '#e8dcc4', 8, 'center');

    if (m.result) {
      var ok = m.result === 'ok';
      ctx.fillStyle = 'rgba(10,12,10,.55)';
      ctx.fillRect(x + shake, y, w, h);
      text(ctx, ok ? '¡Cubo lleno!' : 'La res se ha movido…',
        cx, y + h / 2, ok ? '#a8e07a' : '#e0a8a8', 13, 'center');
    }

    // Botones grandes a los lados: mano izquierda y mano derecha
    var bw3 = Math.min(56, Math.max(38, Math.round((R.w - w) / 2) - 8));
    var bh3 = 56, byy = Math.round(R.h / 2 - bh3 / 2);
    var lx = Math.max(2, x - bw3 - 4), rx = Math.min(R.w - bw3 - 2, x + w + 4);
    [[lx, 'milkL', '◀', 0], [rx, 'milkR', '▶', 1]].forEach(function (b) {
      var on = m.hand === b[3];
      panel(ctx, b[0], byy, bw3, bh3, on ? 0.95 : 0.6);
      if (on) { ctx.strokeStyle = '#f4e2a8'; ctx.lineWidth = 1; ctx.strokeRect(b[0] + 0.5, byy + 0.5, bw3 - 1, bh3 - 1); }
      text(ctx, b[2], b[0] + bw3 / 2, byy + bh3 / 2 + 2, on ? '#f4e2a8' : '#8a7f66', 18, 'center');
      text(ctx, b[3] ? 'DCHA' : 'IZQ', b[0] + bw3 / 2, byy + bh3 - 6, on ? '#e8dcc4' : '#7a715c', 8, 'center');
      this.hit(b[1], b[0], byy, bw3, bh3);
    }, this);
    if (!G.Input.touchMode)
      text(ctx, 'Teclas ← y →  (o B y A)', cx, y + h + 12, '#8fc8e8', 8, 'center');
  };

  /* ======================================================= RESUMEN DEL DÍA */
  UI.prototype.drawReport = function () {
    var ctx = this.ctx(), R = this.R(), g = this.game, rep = this.report;
    if (!rep) return;
    ctx.fillStyle = 'rgba(8,10,8,.86)';
    ctx.fillRect(0, 0, R.w, R.h);
    var w = Math.min(R.w - 20, 300), h = Math.min(R.h - 20, 190);
    var x = Math.round((R.w - w) / 2), y = Math.round((R.h - h) / 2);
    panel(ctx, x, y, w, h, 0.96);
    text(ctx, g.clock.dateString(), x + w / 2, y + 18, '#f4e2a8', 11, 'center');
    text(ctx, 'Hoy: ' + g.clock.weatherName(), x + w / 2, y + 31, '#c9b48a', 9, 'center');
    this.weatherIcon(ctx, x + w / 2, y + 48, g.clock.weather);
    var yy = y + 66;
    for (var i = 0; i < rep.events.length; i++) {
      var lines = wrap(ctx, '· ' + rep.events[i], w - 20, 8);
      for (var q = 0; q < lines.length; q++) {
        if (yy > y + h - 22) break;
        text(ctx, lines[q], x + 10, yy, '#e8dcc4', 8); yy += 9;
      }
    }
    if (!rep.events.length) text(ctx, 'Un día tranquilo en Sorríos.', x + w / 2, yy, '#a89b78', 9, 'center');
    text(ctx, '[A] empezar el día', x + w / 2, y + h - 8, '#a8e07a', 9, 'center');
    this.hit('report_ok', x, y, w, h);
  };

  /* ============================================================== NOTICE = */
  UI.prototype.drawNotice = function () {
    var ctx = this.ctx(), R = this.R(), n = this.notice;
    if (!n) return;
    ctx.fillStyle = 'rgba(8,10,8,.75)';
    ctx.fillRect(0, 0, R.w, R.h);
    var w = Math.min(R.w - 24, 260), h = 110;
    var x = Math.round((R.w - w) / 2), y = Math.round((R.h - h) / 2);
    panel(ctx, x, y, w, h, 0.96);
    text(ctx, n.title, x + w / 2, y + 22, '#f4e2a8', 11, 'center');
    var lines = wrap(ctx, n.body, w - 20, 9);
    for (var i = 0; i < lines.length; i++) text(ctx, lines[i], x + w / 2, y + 42 + i * 11, '#e8dcc4', 9, 'center');
    text(ctx, '[A] vale', x + w / 2, y + h - 10, '#a8e07a', 9, 'center');
    this.hit('notice_ok', x, y, w, h);
  };

  /* =============================================================== TÍTULO = */
  UI.prototype.drawTitle = function (t) {
    var ctx = this.ctx(), R = this.R(), g = this.game;
    // Cielo con degradado y montañas de Ordás
    var grd = ctx.createLinearGradient(0, 0, 0, R.h);
    grd.addColorStop(0, '#20344f'); grd.addColorStop(0.45, '#5f7a8a');
    grd.addColorStop(0.62, '#c98a5a'); grd.addColorStop(1, '#2e3a24');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, R.w, R.h);
    // sol
    ctx.fillStyle = '#f2d08a';
    ctx.beginPath(); ctx.arc(R.w * 0.72, R.h * 0.52, 16, 0, 6.284); ctx.fill();
    // montañas
    for (var l = 0; l < 3; l++) {
      ctx.fillStyle = ['#3f5162', '#33463a', '#26332a'][l];
      ctx.beginPath();
      ctx.moveTo(0, R.h);
      for (var x = 0; x <= R.w; x += 8) {
        var yy = R.h * (0.52 + l * 0.09) - Math.sin(x * 0.017 + l * 2.1) * (16 - l * 4) - Math.sin(x * 0.005) * 10;
        ctx.lineTo(x, yy);
      }
      ctx.lineTo(R.w, R.h); ctx.closePath(); ctx.fill();
    }
    // prado
    ctx.fillStyle = '#3f6b33';
    ctx.fillRect(0, R.h * 0.78, R.w, R.h);

    // Título
    var cy = Math.round(R.h * 0.30);
    text(ctx, 'SORRÍOS DE ORDÁS', R.w / 2, cy, '#f4e2a8', Math.min(26, Math.round(R.w / 15)), 'center');
    text(ctx, 'La granja de Arricio', R.w / 2, cy + 18, '#e8dcc4', 11, 'center');

    // Arricio y una vaca en el prado
    var sheet = g.player.sheet();
    ctx.drawImage(sheet, 0, 0, Art.CH_W, Art.CH_H, R.w * 0.30, R.h * 0.72, Art.CH_W * 2, Art.CH_H * 2);
    var cows = Art.animals.cow[0], sz = Art.ANIMAL_DEFS.cow;
    ctx.drawImage(cows, 0, 0, sz.w, sz.h, R.w * 0.52, R.h * 0.74, sz.w * 1.8, sz.h * 1.8);

    // Botones
    var bw = Math.min(190, R.w - 40), bh = 26;
    var bx = Math.round((R.w - bw) / 2), by = Math.round(R.h * 0.50);
    var opts = G.Storage.has() ? ['Continuar', 'Partida nueva'] : ['Empezar a jugar'];
    for (var i = 0; i < opts.length; i++) {
      var ry = by + i * (bh + 6);
      var selh = i === this.sel;
      panel(ctx, bx, ry, bw, bh, selh ? 0.92 : 0.72);
      if (selh) { ctx.strokeStyle = '#f4e2a8'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, ry + 0.5, bw - 1, bh - 1); }
      text(ctx, opts[i], R.w / 2, ry + 17, selh ? '#f4e2a8' : '#d8ccb0', 11, 'center');
      this.hit('title' + i, bx, ry, bw, bh);
    }
    text(ctx, 'Ordeña a mano, siembra el huerto y forma una familia', R.w / 2, R.h - 16, '#cbbf98', 8, 'center');
    text(ctx, 'v1.0 · Sorríos de Ordás (León)', R.w / 2, R.h - 5, '#8a7f66', 8, 'center');
    this.titleOptions = opts;
  };

  /* =============================================== PANTALLA DE TRANSICIÓN = */
  UI.prototype.drawFade = function (a, label) {
    var ctx = this.ctx(), R = this.R();
    ctx.fillStyle = 'rgba(6,8,6,' + M.clamp(a, 0, 1) + ')';
    ctx.fillRect(0, 0, R.w, R.h);
    if (label && a > 0.5) text(ctx, label, R.w / 2, R.h / 2, '#f4e2a8', 12, 'center');
  };

  UI.prototype.update = function (dt) {
    for (var i = this.toasts.length - 1; i >= 0; i--) {
      this.toasts[i].life -= dt;
      if (this.toasts[i].life <= 0) this.toasts.splice(i, 1);
    }
  };

  G.UI = UI;
  G.UIHelpers = { panel: panel, text: text, bar: bar, wrap: wrap };

})(window);
