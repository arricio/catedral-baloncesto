/* ============================================================================
   SORRÍOS DE ORDÁS — game.js
   Máquina de estados, bucle de juego, entradas por estado, viajes entre
   mapas, dormir, guardar y cargar la partida.
   ========================================================================== */
(function (global) {
  'use strict';
  var G = global.SORRIOS, M = G.M, D = G.DATA, W = G.World, Art = G.Art,
      E = G.Entities, Sys = G.Systems, T = G.Time;
  var TILE = 16;

  var Game = G.Game = {
    state: 'title',
    maps: null, player: null, npcs: [], animals: [], children: [],
    clock: null, ui: null, fx: null, milking: null,
    removed: [], flags: {},
    autosave: true,
    fade: 0, fadeDir: 0, fadeAction: null, fadeLabel: '',
    hasDonkey: false,
    seed: 20260817,
    _minuteMark: -1, _hourMark: -1,

    /* ------------------------------------------------------------ init -- */
    init: function () {
      this.clock = new T.Clock();
      this.player = new E.Player();
      this.fx = new G.Render.FX();
      this.milking = new Sys.Milking();
      this.ui = new G.UI(this);
      this.buildWorld();
      this.spawnNPCs();
      return this;
    },

    buildWorld: function () {
      this.maps = W.build(this.seed);
      // Identificador estable por objeto para poder guardar los que se quitan
      for (var id in this.maps) {
        var objs = this.maps[id].objects;
        for (var i = 0; i < objs.length; i++) objs[i].oid = i;
      }
    },

    spawnNPCs: function () {
      this.npcs = [];
      for (var i = 0; i < D.NPCS.length; i++) {
        var n = new E.NPC(D.NPCS[i]);
        n.updateSchedule(this.clock, this.maps, true);
        this.npcs.push(n);
      }
    },

    npc: function (id) {
      for (var i = 0; i < this.npcs.length; i++) if (this.npcs[i].id === id) return this.npcs[i];
      return null;
    },

    map: function () { return this.maps[this.player.map]; },

    /* -------------------------------------------------------- new game -- */
    newGame: function () {
      this.clock = new T.Clock();
      this.player = new E.Player();
      this.children = [];
      this.removed = [];
      this.flags = {};
      this.buildWorld();
      this.spawnNPCs();

      var p = this.player;
      p.map = 'valle';
      var st = this.maps.valle.spots.playerStart;
      p.x = st.x * TILE + 8; p.y = st.y * TILE + 8;
      p.hotbar = ['azada', 'regadera', 'cubo', 'hoz'];
      p.addItem('sem_patata', 8);
      p.addItem('sem_lechuga', 5);
      p.addItem('pan', 2);
      p.addItem('heno', 10);
      p.money = 1500;

      // Ganado de partida
      this.animals = [];
      this.addAnimal('cow', 'Pinta');
      this.addAnimal('cow', 'Lucera');
      this.addAnimal('sheep', 'Copo');
      this.addAnimal('sheep', 'Nube');
      this.addAnimal('lamb', 'Chispa');
      this.addAnimal('chicken', 'Cuca');
      this.addAnimal('chicken', 'Pita');
      this.addAnimal('chick', 'Peque');
      this.addAnimal('donkey', 'Platero');
      for (var i = 0; i < this.animals.length; i++) {
        this.animals[i].fed = true;
        if (this.animals[i].def.product) this.animals[i].productReady = true;
      }
      this.hasDonkey = true;
      p.invMax = 24;

      this.clock.tomorrow = this.clock.rollWeather();
      this.state = 'play';
      G.Render.snap = true;
      this.syncHotbar();
      this.updateAnimalLocations(true);
      this.ui.noticeMsg('Sorríos de Ordás',
        'Arricio, has vuelto al pueblo de tus abuelos. Tienes casa, cuadra, huerto ' +
        'y unos animales. Todo lo demás está por hacer. ¡Suerte!');
    },

    addAnimal: function (kind, name) {
      var def = D.ANIMALS[kind];
      var mapId = def.house === 'gallinero' ? 'gallinero' : 'cuadra';
      var map = this.maps[mapId];
      var pen = map.zones.pen;
      var a = new E.Animal(kind,
        (pen.x + M.rndF(1, pen.w - 1)) * TILE,
        (pen.y + M.rndF(1, pen.h - 1)) * TILE, name);
      a.map = mapId;
      this.animals.push(a);
      if (kind === 'donkey') this.hasDonkey = true;
      return a;
    },

    /* ---------------------------------------------------------- ayudas -- */
    give: function (id, qty) {
      if (!this.player.addItem(id, qty || 1)) {
        this.ui.toast('¡La mochila está llena!', '#e0b47a');
        return false;
      }
      this.syncHotbar();
      return true;
    },

    // Mantiene el cinturón coherente: herramientas + lo que se haya equipado.
    syncHotbar: function () {
      var p = this.player;
      for (var i = p.hotbar.length - 1; i >= 0; i--) {
        var id = p.hotbar[i];
        var def = D.ITEMS[id];
        if (!def) { p.hotbar.splice(i, 1); continue; }
        if (def.type !== 'tool' && p.countItem(id) <= 0) p.hotbar.splice(i, 1);
      }
      if (!p.hotbar.length) p.hotbar.push('azada');
      p.slot = M.clamp(p.slot, 0, p.hotbar.length - 1);
    },

    equip: function (id) {
      var p = this.player;
      if (p.hotbar.indexOf(id) >= 0) { p.slot = p.hotbar.indexOf(id); return; }
      if (p.hotbar.length >= 10) p.hotbar.splice(p.hotbar.length - 1, 1);
      p.hotbar.push(id);
      p.slot = p.hotbar.length - 1;
      G.Audio.sfx('ok');
    },

    openShop: function (id) { this.ui.openShop(id); },
    openShip: function () { this.ui.openShip(); },
    openKitchen: function () { this.ui.openKitchen(); },

    /* --------------------------------------------------------- viajes --- */
    warp: function (w) {
      if (!w.to) {
        this.ui.noticeMsg(w.name || 'Cerrado', w.msg || 'Está cerrado.');
        return;
      }
      var self = this;
      this.startFade(function () {
        var p = self.player;
        p.map = w.to;
        var m = self.maps[w.to];
        if (w.to === 'valle') { p.x = w.tx * TILE + 8; p.y = w.ty * TILE + 8; }
        else {
          var e = m.spots.entry;
          p.x = e.x * TILE + 8; p.y = e.y * TILE + 8;
        }
        p.dir = w.to === 'valle' ? 0 : 1;
        G.Render.snap = true;
        self.ui.toast(m.name, '#f4e2a8');
        // Los hijos entran con su padre
        for (var i = 0; i < self.children.length; i++) {
          var c = self.children[i];
          if (c.stage > 0) { c.map = p.map; c.x = p.x; c.y = p.y + 6; }
        }
      });
    },

    startFade: function (action, label) {
      this.fadeDir = 1; this.fadeAction = action; this.fadeLabel = label || '';
      this.state = 'fade';
    },

    /* ---------------------------------------------------------- dormir -- */
    trySleep: function () {
      var self = this;
      var h = this.clock.minutes / 60;
      if (h < 17 && h > 8) {
        this.ui.dialog('La cama', '¿Ya a dormir? Aún es de día, Arricio. Vuelve por la tarde.');
        return true;
      }
      this.doSleep(false);
      return true;
    },

    doSleep: function (collapsed) {
      var self = this;
      G.Audio.sfx('sleep');
      this.startFade(function () {
        var rep = Sys.newDay(self, collapsed);
        if (collapsed) rep.events.unshift('Te desmayaste de cansancio. ' +
          (self.player.spouse ? 'Tu mujer te llevó a la cama.' : 'Amaneciste en la cama, sin saber cómo.'));
        self.player.map = 'casa';
        var bed = self.maps.casa.spots.bed;
        self.player.x = bed.x * TILE + 8; self.player.y = bed.y * TILE + 8;
        self.player.dir = 0;
        self.updateAnimalLocations(true);
        for (var i = 0; i < self.npcs.length; i++) self.npcs[i].updateSchedule(self.clock, self.maps, true);
        for (var c = 0; c < self.children.length; c++) { self.children[c].map = 'casa'; self.children[c].x = self.player.x + 10; self.children[c].y = self.player.y + 6; }
        G.Render.snap = true;
        self.ui.report = rep;
        self.state = 'report';
        if (self.autosave) self.save(true);
      }, 'Durmiendo…');
    },

    /* ----------------------------------------- dónde están los animales -- */
    updateAnimalLocations: function (force) {
      var h = this.clock.minutes / 60;
      var good = !this.clock.isRaining() && !this.clock.isSnowing();
      var outside = good && h >= 8 && h < 18;
      var pasture = this.maps.valle.zones.pasture;
      for (var i = 0; i < this.animals.length; i++) {
        var a = this.animals[i];
        var want = outside ? 'valle' : (a.def.house === 'gallinero' ? 'gallinero' : 'cuadra');
        if (a.map === want && !force) continue;
        a.map = want;
        if (want === 'valle') {
          a.x = (pasture.x + M.rndF(1, pasture.w - 1)) * TILE;
          a.y = (pasture.y + M.rndF(1, pasture.h - 1)) * TILE;
        } else {
          var pen = this.maps[want].zones.pen;
          a.x = (pen.x + M.rndF(1, pen.w - 1)) * TILE;
          a.y = (pen.y + M.rndF(1, pen.h - 1)) * TILE;
        }
        a.state = 'idle'; a.stateT = M.rndF(0.2, 2);
      }
    },

    /* =========================================================== UPDATE == */
    update: function (dt) {
      var I = G.Input;
      this.ui.update(dt);
      this.fx.update(dt);

      switch (this.state) {
        case 'title':    this.updateTitle(); break;
        case 'play':     this.updatePlay(dt); break;
        case 'dialog':   this.updateDialog(); break;
        case 'menu':     this.updateMenu(); break;
        case 'shop':     this.updateShop(); break;
        case 'ship':     this.updateShip(); break;
        case 'kitchen':  this.updateKitchen(); break;
        case 'milking':  this.updateMilking(dt); break;
        case 'report':   this.updateReport(); break;
        case 'notice':   this.updateNotice(); break;
        case 'fade':     this.updateFade(dt); break;
      }

      // El mundo sigue vivo mientras hay diálogos o menús ligeros
      if (this.state === 'play' || this.state === 'dialog' || this.state === 'milking') {
        this.tickWorld(dt, this.state === 'play');
      }
      G.Render.updateCamera(this, dt);
      G.Render.updateWeather(this, dt);
      G.Audio.music(dt, this.clock.season, this.clock.isNight());
      G.Audio.setRain(this.clock.isRaining() && !this.map().indoor, this.clock.weather === 'tormenta' ? 1.6 : 1);
    },

    tickWorld: function (dt, advanceTime) {
      var map = this.map();
      if (advanceTime) {
        var ev = this.clock.update(dt);
        if (ev && ev.lightning) { G.Render.lightning(); G.Audio.sfx('thunder'); }
        if (ev && ev.collapse) { this.doSleep(true); return; }
      }

      // Cambios por minuto/hora
      var mm = Math.floor(this.clock.minutes);
      if (mm !== this._minuteMark) {
        this._minuteMark = mm;
        var hh = Math.floor(this.clock.minutes / 60);
        if (hh !== this._hourMark) {
          this._hourMark = hh;
          for (var i = 0; i < this.npcs.length; i++) this.npcs[i].updateSchedule(this.clock, this.maps);
          this.updateAnimalLocations(false);
        }
      }

      // Animales del mapa actual
      for (var a = 0; a < this.animals.length; a++) {
        var an = this.animals[a];
        if (an.map === map.id) an.update(dt, map, this.clock);
      }
      // Vecinos del mapa actual
      for (var n = 0; n < this.npcs.length; n++) {
        var np = this.npcs[n];
        if (np.map === map.id) np.update(dt, map, this.clock);
      }
      // Hijos
      for (var c = 0; c < this.children.length; c++) {
        var ch = this.children[c];
        if (ch.map === map.id) ch.update(dt, map, this.player);
      }
    },

    /* ----------------------------------------------------------- título -- */
    updateTitle: function () {
      var I = G.Input, ui = this.ui;
      var opts = ui.titleOptions || ['Empezar a jugar'];
      if (I.take('up')) { ui.sel = (ui.sel + opts.length - 1) % opts.length; G.Audio.sfx('menu'); }
      if (I.take('down')) { ui.sel = (ui.sel + 1) % opts.length; G.Audio.sfx('menu'); }
      var tap = ui.tappedId();
      if (tap && tap.indexOf('title') === 0) { ui.sel = parseInt(tap.slice(5), 10); this.titleConfirm(); return; }
      if (I.take('action') || I.take('menu')) this.titleConfirm();
    },
    titleConfirm: function () {
      var ui = this.ui;
      var opts = ui.titleOptions || ['Empezar a jugar'];
      G.Audio.unlock();
      G.Audio.sfx('ok');
      if (opts.length > 1 && ui.sel === 0) {
        if (!this.load()) this.newGame();
      } else {
        this.newGame();
      }
    },

    /* ------------------------------------------------------------ juego -- */
    updatePlay: function (dt) {
      var I = G.Input, p = this.player, map = this.map();
      p.update(dt, map, true);

      // Cambio de herramienta
      if (I.take('next')) { p.slot = (p.slot + 1) % p.hotbar.length; G.Audio.sfx('menu'); }
      if (I.take('prev')) { p.slot = (p.slot + p.hotbar.length - 1) % p.hotbar.length; G.Audio.sfx('menu'); }
      for (var s = 1; s <= 9; s++) if (I.take('slot' + s) && p.hotbar[s - 1]) p.slot = s - 1;

      // Menú
      if (I.take('menu')) { this.ui.openMenu(); return; }
      var tap = this.ui.tappedId();
      if (tap === 'menu') { this.ui.openMenu(); return; }
      if (tap && tap.indexOf('slot') === 0) { p.slot = parseInt(tap.slice(4), 10); G.Audio.sfx('menu'); }

      // Acciones
      if (I.take('action')) Sys.interact(this);
      if (I.take('tool')) Sys.useTool(this);

      // Puertas: al pisar la baldosa
      var t = p.tile();
      var w = W.warpAt(map, t.x, t.y);
      if (w) { this.warp(w); return; }

      this.updateHint();
    },

    updateHint: function () {
      var p = this.player, hint = '';
      var n = Sys.npcNear(this, 28);
      if (n) {
        hint = 'A · hablar con ' + n.name;
        var held = D.ITEMS[p.currentTool()];
        if (held && held.type !== 'tool' && held.type !== 'seed') {
          hint += (p.currentTool() === 'ramo' ? '   B · pedirle salir'
                : p.currentTool() === 'anillo' ? '   B · pedirle matrimonio'
                : '   B · regalar ' + held.name.toLowerCase());
        }
      }
      else {
        var a = Sys.animalNear(this, 26);
        if (a) {
          if (a.productReady && a.def.productTool === 'cubo') hint = 'B con el cubo · ordeñar a ' + a.name;
          else if (a.productReady && a.kind === 'chicken') hint = 'A · coger el huevo';
          else if (a.extraReady) hint = 'B con tijeras · esquilar';
          else hint = 'A · acariciar a ' + a.name;
        } else {
          var o = Sys.objNear(this, 26);
          if (o) {
            var names = {
              bed: 'A · dormir', well: 'A · llenar la regadera', trough: 'A · echar de comer',
              haystack: 'A · coger heno', shop: 'A · comprar y vender', ship: 'A · caja de recogida',
              chest: 'A · caja de recogida', stove: 'A · cocinar', sign: 'A · leer', flower: 'A · coger la flor',
              rock: 'B con la pala'
            };
            hint = names[o.interact] || '';
          } else {
            var f = p.facingTile(), map = this.map();
            var so = map.soilAt(f.x, f.y);
            if (so && so.crop && D.cropStage(so.crop, so.grow) === 4) hint = 'A · cosechar ' + D.CROPS[so.crop].name;
          }
        }
      }
      this.ui.hintText = hint;
    },

    /* ---------------------------------------------------------- diálogo -- */
    updateDialog: function () {
      var I = G.Input, d = this.ui.dialogBox;
      if (!d) { this.state = 'play'; return; }
      var tap = this.ui.tappedId();
      if (I.take('action') || I.take('menu') || tap === 'dialog_next') {
        if (d.chars < d.body.length) { d.chars = d.body.length; return; }
        this.ui.dialogBox = null;
        this.state = 'play';
      }
    },

    updateNotice: function () {
      var I = G.Input;
      var tap = this.ui.tappedId();
      if (I.take('action') || I.take('menu') || tap === 'notice_ok') {
        this.ui.notice = null;
        this.state = 'play';
      }
    },

    updateReport: function () {
      var I = G.Input;
      var tap = this.ui.tappedId();
      if (I.take('action') || I.take('menu') || tap === 'report_ok') {
        this.ui.report = null;
        this.state = 'play';
        G.Audio.sfx('ok');
      }
    },

    /* ------------------------------------------------------------- menú -- */
    updateMenu: function () {
      var I = G.Input, ui = this.ui, p = this.player;
      var tap = ui.tappedId();

      if (I.take('menu') || tap === 'close') { ui.closeMenu(); return; }
      if (tap && tap.indexOf('tab') === 0) { ui.tab = parseInt(tap.slice(3), 10); ui.sel = 0; ui.scroll = 0; G.Audio.sfx('menu'); return; }
      if (I.take('next')) { ui.tab = (ui.tab + 1) % 5; ui.sel = 0; G.Audio.sfx('menu'); }
      if (I.take('prev')) { ui.tab = (ui.tab + 4) % 5; ui.sel = 0; G.Audio.sfx('menu'); }

      if (ui.tab === 0) { // mochila
        var cols = 11;
        if (I.take('right')) ui.sel = Math.min(p.invMax - 1, ui.sel + 1);
        if (I.take('left')) ui.sel = Math.max(0, ui.sel - 1);
        if (I.take('down')) ui.sel = Math.min(p.invMax - 1, ui.sel + cols);
        if (I.take('up')) ui.sel = Math.max(0, ui.sel - cols);
        if (tap && tap.indexOf('inv') === 0) ui.sel = parseInt(tap.slice(3), 10);
        var it = p.inv[ui.sel];
        if (it) {
          var def = D.ITEMS[it.id];
          if ((I.take('action') || tap === 'eat') && def.energy) Sys.eat(this, it.id);
          if ((I.take('tool') || tap === 'equip') && def.type !== 'tool') this.equip(it.id);
        }
      } else if (ui.tab === 1) {
        if (I.take('down')) ui.sel = Math.min(this.npcs.length - 1, ui.sel + 1);
        if (I.take('up')) ui.sel = Math.max(0, ui.sel - 1);
        if (tap && tap.indexOf('npc') === 0) ui.sel = parseInt(tap.slice(3), 10);
      } else if (ui.tab === 4) {
        if (I.take('down')) ui.sel = Math.min(3, ui.sel + 1);
        if (I.take('up')) ui.sel = Math.max(0, ui.sel - 1);
        var pick = -1;
        if (tap && tap.indexOf('set') === 0) { pick = parseInt(tap.slice(3), 10); ui.sel = pick; }
        if (I.take('action')) pick = ui.sel;
        if (pick >= 0) this.settingsAction(pick);
      }
    },

    settingsAction: function (i) {
      var self = this;
      if (i === 0) { G.Audio.setMuted(!G.Audio.muted); this.ui.toast(G.Audio.muted ? 'Sonido apagado' : 'Sonido encendido'); }
      else if (i === 1) { this.save(); this.ui.toast('Partida guardada.', '#a8e07a'); G.Audio.sfx('ok'); }
      else if (i === 2) { this.autosave = !this.autosave; this.ui.toast('Guardado automático: ' + (this.autosave ? 'sí' : 'no')); }
      else if (i === 3) {
        G.Storage.clear();
        this.ui.toast('Partida borrada. Reinicia para empezar.', '#e08a8a');
        this.state = 'title'; this.ui.menu = null; this.ui.sel = 0;
      }
    },

    /* ----------------------------------------------------------- tienda -- */
    updateShop: function () {
      var I = G.Input, ui = this.ui;
      var tap = ui.tappedId();
      if (I.take('menu') || tap === 'shopclose') { this.state = 'play'; G.Audio.sfx('menu'); return; }
      var nTabs = ui.shopTabs().length;
      if (tap && tap.indexOf('shoptab') === 0) { ui.shopMode = parseInt(tap.slice(7), 10); ui.sel = 0; ui.scroll = 0; return; }
      if (I.take('right')) { ui.shopMode = (ui.shopMode + 1) % nTabs; ui.sel = 0; ui.scroll = 0; G.Audio.sfx('menu'); }
      if (I.take('left')) { ui.shopMode = (ui.shopMode + nTabs - 1) % nTabs; ui.sel = 0; ui.scroll = 0; G.Audio.sfx('menu'); }
      var list = ui.shopList();
      if (I.take('down')) ui.sel = Math.min(list.length - 1, ui.sel + 1);
      if (I.take('up')) ui.sel = Math.max(0, ui.sel - 1);
      if (tap && tap.indexOf('shopitem') === 0) ui.sel = parseInt(tap.slice(8), 10);
      var confirmTap = (tap && tap.indexOf('shopitem') === 0);
      var it = list[ui.sel];
      if (!it) return;
      if (I.take('action') || confirmTap) {
        if (ui.shopMode === 2) Sys.buyAnimal(this, it.id);
        else if (ui.shopMode === 0) Sys.buy(this, it.id, 1);
        else Sys.sell(this, it.id, 1);
      }
      if (I.take('tool') && ui.shopMode !== 2) {
        if (ui.shopMode === 0) Sys.buy(this, it.id, 5);
        else Sys.sell(this, it.id, 5);
      }
    },

    updateShip: function () {
      var I = G.Input, ui = this.ui, p = this.player;
      var tap = ui.tappedId();
      if (I.take('menu')) { this.state = 'play'; G.Audio.sfx('menu'); return; }
      var list = p.inv.filter(function (it) { return D.ITEMS[it.id].sell; });
      if (I.take('down')) ui.sel = Math.min(list.length - 1, ui.sel + 1);
      if (I.take('up')) ui.sel = Math.max(0, ui.sel - 1);
      if (tap && tap.indexOf('ship') === 0 && tap !== 'shipall') ui.sel = parseInt(tap.slice(4), 10);
      var it = list[ui.sel];
      if (!it) return;
      if (I.take('action') || (tap && tap.indexOf('ship') === 0 && tap !== 'shipall')) Sys.sell(this, it.id, 1);
      if (I.take('tool') || tap === 'shipall') {
        var total = 0;
        for (var i = list.length - 1; i >= 0; i--) {
          var def = D.ITEMS[list[i].id];
          total += def.sell * list[i].qty;
          Sys.sell(this, list[i].id, list[i].qty);
        }
        if (total) this.ui.toast('Vendido todo: ' + G.fmtMoney(total), '#f2d96a');
        ui.sel = 0;
      }
    },

    updateKitchen: function () {
      var I = G.Input, ui = this.ui;
      var tap = ui.tappedId();
      if (I.take('menu')) { this.state = 'play'; G.Audio.sfx('menu'); return; }
      var R = Sys.RECIPES;
      if (I.take('down')) ui.sel = Math.min(R.length - 1, ui.sel + 1);
      if (I.take('up')) ui.sel = Math.max(0, ui.sel - 1);
      if (tap && tap.indexOf('cook') === 0) { ui.sel = parseInt(tap.slice(4), 10); Sys.cook(this, R[ui.sel]); return; }
      if (I.take('action')) Sys.cook(this, R[ui.sel]);
    },

    /* ----------------------------------------------------------- ordeño -- */
    updateMilking: function (dt) {
      var I = G.Input, m = this.milking;
      m.update(dt);
      var tap = this.ui.tappedId();
      if (!m.result) {
        if (I.take('left') || tap === 'milkL' || I.take('tool')) m.press(0);
        if (I.take('right') || tap === 'milkR' || I.take('action')) m.press(1);
      }
      if (!m.active) {
        // Final del minijuego
        var got = m.yieldAmount();
        var a = m.animal;
        if (got > 0) {
          this.give(m.product, got);
          this.player.stats.animalsMilked++;
          a.productReady = false;
          a.happy = M.clamp(a.happy + 6, 0, 100);
          this.ui.toast('+' + got + ' ' + D.ITEMS[m.product].name, '#f6f2e8');
          this.fx.pop(a.x, a.y - 16, Art.icon(m.product, D.ITEMS[m.product]));
          G.Audio.sfx('levelup');
        } else {
          a.happy = M.clamp(a.happy - 4, 0, 100);
          this.ui.toast(a.name + ' se ha movido. Inténtalo otra vez.', '#e0a8a8');
        }
        this.player.useEnergy(4);
        this.state = 'play';
      }
    },

    /* ------------------------------------------------------- transición -- */
    updateFade: function (dt) {
      if (this.fadeDir > 0) {
        this.fade += dt * 2.6;
        if (this.fade >= 1) {
          this.fade = 1; this.fadeDir = -1;
          if (this.fadeAction) { var f = this.fadeAction; this.fadeAction = null; f(); }
          if (this.state === 'fade') this.state = 'play';
          this._pendingFadeOut = true;
        }
      }
    },

    /* ============================================================= DRAW == */
    draw: function (dt) {
      var R = G.Render;
      R.beginFrame();
      if (this.state === 'title') {
        this.ui.hits.length = 0;
        this.ui.drawTitle(dt);
        return;
      }
      R.drawWorld(this, dt);
      this.ui.drawHUD();

      switch (this.state) {
        case 'dialog':  this.ui.drawDialog(dt); break;
        case 'menu':    this.ui.drawMenu(); break;
        case 'shop':    this.ui.drawShop(); break;
        case 'ship':    this.ui.drawShip(); break;
        case 'kitchen': this.ui.drawKitchen(); break;
        case 'milking': this.ui.drawMilking(); break;
        case 'report':  this.ui.drawReport(); break;
        case 'notice':  this.ui.drawNotice(); break;
      }

      // Fundido
      if (this.fade > 0) {
        this.ui.drawFade(this.fade, this.fadeDir > 0 ? this.fadeLabel : '');
        if (this.fadeDir < 0) {
          this.fade -= dt * 2.2;
          if (this.fade <= 0) { this.fade = 0; this.fadeDir = 0; }
        }
      }
    },

    /* ============================================================= SAVE == */
    save: function (silent) {
      var soils = {};
      for (var id in this.maps) {
        var s = this.maps[id].soil;
        var out = [];
        for (var k in s) {
          var p = s[k];
          out.push([p.x, p.y, p.tilled ? 1 : 0, p.watered ? 1 : 0, p.crop || '', p.grow, p.dead ? 1 : 0]);
        }
        if (out.length) soils[id] = out;
      }
      var pl = this.player;
      var data = {
        v: 1,
        seed: this.seed,
        clock: this.clock.save(),
        player: {
          x: pl.x, y: pl.y, map: pl.map, dir: pl.dir,
          energy: pl.energy, maxEnergy: pl.maxEnergy, money: pl.money,
          inv: pl.inv, invMax: pl.invMax, hotbar: pl.hotbar, slot: pl.slot,
          wateringLevel: pl.wateringLevel, spouse: pl.spouse, partner: pl.partner,
          stats: pl.stats
        },
        animals: this.animals.map(function (a) { return a.save(); }),
        npcs: this.npcs.map(function (n) { return n.save(); }),
        children: this.children.map(function (c) { return c.save(); }),
        soils: soils,
        removed: this.removed,
        flags: this.flags,
        autosave: this.autosave
      };
      var ok = G.Storage.save(data);
      if (!silent && ok) this.ui.toast('Partida guardada.', '#a8e07a');
      return ok;
    },

    load: function () {
      var data = G.Storage.load();
      if (!data) return false;
      try {
        this.seed = data.seed || this.seed;
        this.clock = new T.Clock().load(data.clock);
        this.buildWorld();

        var pl = new E.Player();
        var s = data.player;
        for (var k in s) if (s[k] !== undefined) pl[k] = s[k];
        pl.inv = s.inv || [];
        pl.stats = s.stats || pl.stats;
        this.player = pl;

        this.animals = (data.animals || []).map(function (a) { return E.Animal.load(a); });
        this.hasDonkey = this.animals.some(function (a) { return a.kind === 'donkey'; });

        this.spawnNPCs();
        var saved = data.npcs || [];
        for (var i = 0; i < saved.length; i++) {
          var n = this.npc(saved[i].id);
          if (n) { n.hearts = saved[i].hearts; n.points = saved[i].points; n.married = saved[i].married; n.dating = saved[i].dating; }
        }
        this.children = (data.children || []).map(function (c) { return E.Child.load(c); });
        this.flags = data.flags || {};
        this.autosave = data.autosave !== false;

        // Huerto
        for (var mid in (data.soils || {})) {
          var map = this.maps[mid];
          if (!map) continue;
          var arr = data.soils[mid];
          for (var j = 0; j < arr.length; j++) {
            var r = arr[j];
            var p = map.makeSoil(r[0], r[1]);
            p.tilled = !!r[2]; p.watered = !!r[3];
            p.crop = r[4] || null; p.grow = r[5] || 0; p.dead = !!r[6];
            map.set(r[0], r[1], W.T.SOIL, p.watered ? 1 : 0);
          }
        }
        // Objetos retirados (árboles talados, piedras…)
        this.removed = data.removed || [];
        for (var q = 0; q < this.removed.length; q++) {
          var parts = String(this.removed[q]).split(':');
          var m2 = this.maps[parts[0]];
          if (!m2) continue;
          for (var o = m2.objects.length - 1; o >= 0; o--) {
            if (m2.objects[o].oid === parseInt(parts[1], 10)) { W.removeObj(m2, m2.objects[o]); break; }
          }
        }

        for (var z = 0; z < this.npcs.length; z++) this.npcs[z].updateSchedule(this.clock, this.maps, true);
        for (var c2 = 0; c2 < this.children.length; c2++) { this.children[c2].map = this.player.map; this.children[c2].x = this.player.x; this.children[c2].y = this.player.y; }
        this.updateAnimalLocations(true);
        this.syncHotbar();
        G.Render.snap = true;
        this.state = 'play';
        this.ui.toast('¡Bienvenido de vuelta, Arricio!', '#f4e2a8');
        return true;
      } catch (e) {
        console.error('Error al cargar la partida:', e);
        return false;
      }
    }
  };

})(window);
