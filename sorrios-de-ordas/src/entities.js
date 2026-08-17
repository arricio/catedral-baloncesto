/* ============================================================================
   SORRÍOS DE ORDÁS — entities.js
   Arricio (el jugador), los animales de la granja, los vecinos del pueblo con
   sus horarios, la novia/esposa y los hijos que ayudan en las tareas.
   ========================================================================== */
(function (global) {
  'use strict';
  var G = global.SORRIOS, M = G.M, D = G.DATA, Art = G.Art;
  var TILE = 16;

  /* ------------------------------------------------- colisión y movimiento */
  // Caja de pies: el personaje colisiona solo con la parte baja del sprite.
  function canStand(map, x, y, hw, hh) {
    return !(map.solidAt(x - hw, y - hh) || map.solidAt(x + hw, y - hh) ||
             map.solidAt(x - hw, y + hh) || map.solidAt(x + hw, y + hh));
  }
  function moveAxis(map, e, dx, dy) {
    var hw = e.hw || 5, hh = e.hh || 3;
    if (dx) {
      var nx = e.x + dx;
      if (canStand(map, nx, e.y, hw, hh)) e.x = nx;
      else {
        // deslizamiento suave por las esquinas
        var slid = false;
        for (var s = 1; s <= 3 && !slid; s++) {
          if (canStand(map, nx, e.y - s, hw, hh)) { e.y -= s * 0.6; e.x = nx; slid = true; }
          else if (canStand(map, nx, e.y + s, hw, hh)) { e.y += s * 0.6; e.x = nx; slid = true; }
        }
      }
    }
    if (dy) {
      var ny = e.y + dy;
      if (canStand(map, e.x, ny, hw, hh)) e.y = ny;
      else {
        var slid2 = false;
        for (var s2 = 1; s2 <= 3 && !slid2; s2++) {
          if (canStand(map, e.x - s2, ny, hw, hh)) { e.x -= s2 * 0.6; e.y = ny; slid2 = true; }
          else if (canStand(map, e.x + s2, ny, hw, hh)) { e.x += s2 * 0.6; e.y = ny; slid2 = true; }
        }
      }
    }
    e.x = M.clamp(e.x, 4, map.w * TILE - 4);
    e.y = M.clamp(e.y, 8, map.h * TILE - 4);
  }

  function dirFrom(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 2 : 3;
    return dy < 0 ? 1 : 0;
  }

  /* ================================================================ PLAYER */
  function Player() {
    this.name = 'Arricio';
    this.x = 12 * TILE + 8; this.y = 16 * TILE;
    this.map = 'valle';
    this.dir = 0; this.frame = 0; this.animT = 0; this.moving = false;
    this.hw = 5; this.hh = 3;
    this.speed = 62;
    this.energy = 100; this.maxEnergy = 100;
    this.money = 1500;
    this.inv = [];
    this.invMax = 20;
    this.hotbar = ['azada', 'regadera', 'cubo', 'hoz', 'tijeras'];
    this.slot = 0;
    this.wateringLevel = 20; this.wateringMax = 20;
    this.milkBucket = 0;
    this.swing = 0;           // temporizador de animación de herramienta
    this.exhausted = false;
    this.look = {
      skin: '#e0a97a', hair: '#3a2a1a', hairStyle: 'short',
      shirt: '#4a7a9a', pants: '#3a3f52', boots: '#4a3218',
      hat: 'boina', hatColor: '#2a2a30', beard: '#3a2a1a'
    };
    this.spouse = null;       // id del NPC con quien se casó
    this.partner = null;      // id del NPC que es su novia
    this.children = [];
    this.stats = { daysPlayed: 1, cropsHarvested: 0, animalsMilked: 0, eggsCollected: 0, earned: 0, wood: 0 };
  }

  Player.prototype.sheet = function () {
    return Art.charSheet('arricio', this.look);
  };

  Player.prototype.addItem = function (id, qty) {
    qty = qty || 1;
    var def = D.ITEMS[id];
    if (!def) return false;
    for (var i = 0; i < this.inv.length; i++) {
      if (this.inv[i].id === id && def.type !== 'tool') { this.inv[i].qty += qty; return true; }
    }
    if (this.inv.length >= this.invMax) return false;
    this.inv.push({ id: id, qty: qty });
    return true;
  };
  Player.prototype.countItem = function (id) {
    var n = 0;
    for (var i = 0; i < this.inv.length; i++) if (this.inv[i].id === id) n += this.inv[i].qty;
    return n;
  };
  Player.prototype.removeItem = function (id, qty) {
    qty = qty || 1;
    for (var i = this.inv.length - 1; i >= 0; i--) {
      if (this.inv[i].id !== id) continue;
      var take = Math.min(qty, this.inv[i].qty);
      this.inv[i].qty -= take; qty -= take;
      if (this.inv[i].qty <= 0) this.inv.splice(i, 1);
      if (qty <= 0) return true;
    }
    return qty <= 0;
  };
  Player.prototype.hasTool = function (id) { return this.hotbar.indexOf(id) >= 0; };
  Player.prototype.currentTool = function () { return this.hotbar[this.slot]; };
  Player.prototype.spend = function (n) {
    if (this.money < n) return false;
    this.money -= n; return true;
  };
  Player.prototype.earn = function (n) { this.money += n; this.stats.earned += n; };
  Player.prototype.useEnergy = function (n) {
    this.energy = Math.max(-20, this.energy - n);
    if (this.energy <= 0) this.exhausted = true;
    return this.energy > -20;
  };
  Player.prototype.restore = function (n) {
    this.energy = M.clamp(this.energy + n, -20, this.maxEnergy);
    if (this.energy > 10) this.exhausted = false;
  };

  Player.prototype.update = function (dt, map, allowMove) {
    var mv = allowMove ? G.Input.move() : { x: 0, y: 0, len: 0 };
    var sp = this.speed * (this.exhausted ? 0.55 : 1) * (this.energy < 15 ? 0.8 : 1);
    if (G.Game && G.Game.hasDonkey) sp *= 1.06;
    this.moving = mv.len > 0.06 && this.swing <= 0;
    if (this.swing > 0) { this.swing -= dt; }
    if (this.moving) {
      moveAxis(map, this, mv.x * sp * dt, 0);
      moveAxis(map, this, 0, mv.y * sp * dt);
      this.dir = dirFrom(mv.x, mv.y);
      this.animT += dt * (6 + mv.len * 4);
      this.frame = 1 + (Math.floor(this.animT) % 3);
      if (this.frame > 3) this.frame = 3;
      this._stepT = (this._stepT || 0) + dt * mv.len;
      if (this._stepT > 0.34) {
        this._stepT = 0;
        G.Audio.sfx(map.indoor ? 'step_wood' : 'step');
      }
    } else {
      this.animT = 0; this.frame = 0;
    }
  };

  // Baldosa a la que mira Arricio (destino de las herramientas).
  Player.prototype.facingTile = function () {
    var dx = [0, 0, -1, 1][this.dir], dy = [1, -1, 0, 0][this.dir];
    return { x: Math.floor(this.x / TILE) + dx, y: Math.floor(this.y / TILE) + dy };
  };
  Player.prototype.tile = function () { return { x: Math.floor(this.x / TILE), y: Math.floor(this.y / TILE) }; };

  /* =============================================================== ANIMALS */
  var animalSeq = 1;
  function Animal(kind, x, y, name) {
    var def = D.ANIMALS[kind];
    this.id = 'a' + (animalSeq++);
    this.kind = kind;
    this.def = def;
    this.name = name || Animal.randomName(kind);
    this.x = x; this.y = y;
    this.map = 'cuadra';
    this.dir = 1;                 // 1 derecha, -1 izquierda
    this.frame = 0; this.animT = 0;
    this.hw = 6; this.hh = 3;
    this.state = 'idle';
    this.stateT = M.rndF(0.5, 3);
    this.tx = x; this.ty = y;
    this.fed = false;
    this.pet = false;
    this.happy = 50;              // 0..100
    this.age = 0;                 // días
    this.productReady = false;
    this.extraReady = false;
    this.extraTimer = 0;
    this.sheared = false;
    this.variant = M.rndInt(0, (Art.animals[kind] ? Art.animals[kind].length : 1) - 1);
    this.sound = 0;
  }
  Animal.NAMES = {
    cow: ['Pinta', 'Lucera', 'Morena', 'Estrella', 'Bonita', 'Careta', 'Rubia', 'Gallarda'],
    sheep: ['Copo', 'Nube', 'Lana', 'Blanca', 'Rizos', 'Mota'],
    lamb: ['Chispa', 'Bolita', 'Tirso', 'Pelusa'],
    chicken: ['Cuca', 'Pita', 'Pinto', 'Coca', 'Trufa'],
    chick: ['Peque', 'Piolín', 'Chispi', 'Motita'],
    donkey: ['Platero', 'Rucio', 'Manchas', 'Trotón']
  };
  Animal.randomName = function (kind) { return M.pick(Animal.NAMES[kind] || ['Animal']); };

  Animal.prototype.sheet = function () {
    var set = this.kind === 'sheep' && this.sheared ? Art.animals.sheepShorn : Art.animals[this.kind];
    return set[Math.min(this.variant, set.length - 1)];
  };
  Animal.prototype.size = function () {
    var d = Art.ANIMAL_DEFS[this.kind];
    return { w: d.w, h: d.h };
  };

  Animal.prototype.update = function (dt, map, clock) {
    this.stateT -= dt;
    var speed = this.def.speed || 10;
    if (this.state === 'walk') {
      var dx = this.tx - this.x, dy = this.ty - this.y;
      var d = Math.hypot(dx, dy);
      if (d < 3 || this.stateT <= 0) { this.state = 'idle'; this.stateT = M.rndF(1.5, 5); }
      else {
        this.dir = dx < 0 ? -1 : 1;
        moveAxis(map, this, (dx / d) * speed * dt, 0);
        moveAxis(map, this, 0, (dy / d) * speed * dt);
        this.animT += dt * 5;
        this.frame = Math.floor(this.animT) % 4;
      }
    } else if (this.state === 'eat') {
      this.frame = 1;
      if (this.stateT <= 0) { this.state = 'idle'; this.stateT = M.rndF(1, 3); }
    } else {
      this.frame = 0;
      if (this.stateT <= 0) {
        var zone = map.zones.pen || map.zones.pasture || { x: 2, y: 2, w: map.w - 4, h: map.h - 4 };
        if (M.chance(0.65)) {
          this.tx = (zone.x + M.rndF(0.5, zone.w - 0.5)) * TILE;
          this.ty = (zone.y + M.rndF(0.5, zone.h - 0.5)) * TILE;
          this.state = 'walk'; this.stateT = M.rndF(2, 5);
        } else {
          this.state = 'eat'; this.stateT = M.rndF(1.5, 4);
        }
      }
    }
    // Balidos y mugidos ocasionales
    this.sound -= dt;
    if (this.sound <= 0) {
      this.sound = M.rndF(14, 40);
      if (G.Game && G.Game.player.map === this.map && M.chance(0.35)) {
        var dd = M.dist(this.x, this.y, G.Game.player.x, G.Game.player.y);
        if (dd < 160) G.Audio.sfx(this.def.sound);
      }
    }
  };

  // Paso de día: crecimiento, producción y humor.
  Animal.prototype.newDay = function () {
    var def = this.def;
    this.age++;
    if (this.fed) this.happy = M.clamp(this.happy + (this.pet ? 12 : 6), 0, 100);
    else this.happy = M.clamp(this.happy - 18, 0, 100);

    var grown = false;
    if (def.growsInto && this.age >= def.matureDays) {
      this.kind = def.growsInto;
      this.def = D.ANIMALS[this.kind];
      this.variant = M.rndInt(0, Art.animals[this.kind].length - 1);
      this.age = 0;
      grown = true;
    }
    if (this.def.product && this.fed && this.happy > 20) this.productReady = true;
    if (this.def.extra) {
      this.extraTimer++;
      if (this.extraTimer >= this.def.extraEvery && this.fed) { this.extraReady = true; this.sheared = false; }
    }
    this.fed = false;
    this.pet = false;
    return grown;
  };

  Animal.prototype.save = function () {
    return {
      id: this.id, kind: this.kind, name: this.name, x: this.x, y: this.y, map: this.map,
      fed: this.fed, pet: this.pet, happy: this.happy, age: this.age,
      productReady: this.productReady, extraReady: this.extraReady,
      extraTimer: this.extraTimer, sheared: this.sheared, variant: this.variant
    };
  };
  Animal.load = function (s) {
    var a = new Animal(s.kind, s.x, s.y, s.name);
    a.id = s.id; a.map = s.map; a.fed = s.fed; a.pet = s.pet; a.happy = s.happy;
    a.age = s.age; a.productReady = s.productReady; a.extraReady = s.extraReady;
    a.extraTimer = s.extraTimer || 0; a.sheared = !!s.sheared; a.variant = s.variant || 0;
    return a;
  };

  /* ================================================================== NPCS */
  // Puntos del pueblo usados por los horarios.
  var SPOTS = {
    plaza:     { map: 'valle', x: 70, y: 48 },
    plaza2:    { map: 'valle', x: 73, y: 45 },
    iglesia:   { map: 'iglesia', x: 5, y: 4 },
    iglesiaP:  { map: 'valle', x: 62, y: 42 },
    taberna:   { map: 'taberna', x: 8, y: 6 },
    tabernaBar:{ map: 'taberna', x: 4, y: 3 },
    tiendaC:   { map: 'tienda_comida', x: 5, y: 4 },
    tiendaA:   { map: 'tienda_aperos', x: 5, y: 4 },
    rio:       { map: 'valle', x: 51, y: 56 },
    prado:     { map: 'valle', x: 60, y: 70 },
    granja:    { map: 'valle', x: 24, y: 34 },
    puente:    { map: 'valle', x: 48, y: 46 },
    molino:    { map: 'casa_nieves', x: 5, y: 4 },
    escuela:   { map: 'valle', x: 71, y: 71 }
  };

  function schedFor(npc) {
    var homeMap = npc.home && npc.home.indexOf('casa_') === 0 ? npc.home : npc.home;
    var home = { map: homeMap, x: 5, y: 4 };
    switch (npc.id) {
      case 'rosalia': return [
        { h: 6, at: { map: 'tienda_comida', x: 5, y: 4 } },
        { h: 19, at: SPOTS.plaza }, { h: 21, at: SPOTS.taberna },
        { h: 23, at: { map: 'tienda_comida', x: 5, y: 4 } }];
      case 'bernardo': return [
        { h: 6, at: { map: 'tienda_aperos', x: 5, y: 4 } },
        { h: 18, at: SPOTS.tabernaBar }, { h: 23, at: { map: 'tienda_aperos', x: 5, y: 4 } }];
      case 'marina': return [
        { h: 7, at: SPOTS.granja }, { h: 11, at: SPOTS.prado }, { h: 15, at: SPOTS.plaza },
        { h: 19, at: SPOTS.taberna }, { h: 22, at: home }];
      case 'aurora': return [
        { h: 8, at: SPOTS.escuela }, { h: 16, at: SPOTS.plaza }, { h: 18, at: SPOTS.rio },
        { h: 21, at: home }];
      case 'nieves': return [
        { h: 7, at: SPOTS.molino }, { h: 13, at: SPOTS.plaza }, { h: 16, at: SPOTS.molino },
        { h: 20, at: SPOTS.taberna }, { h: 23, at: home }];
      case 'segundo': return [{ h: 5, at: SPOTS.tabernaBar }];
      case 'casimiro': return [
        { h: 7, at: SPOTS.iglesia }, { h: 13, at: SPOTS.iglesiaP }, { h: 15, at: SPOTS.iglesia },
        { h: 21, at: SPOTS.iglesia }];
      case 'herminia': return [
        { h: 9, at: SPOTS.plaza }, { h: 13, at: home }, { h: 17, at: SPOTS.plaza }, { h: 20, at: home }];
      case 'tino': return [
        { h: 6, at: SPOTS.prado }, { h: 14, at: SPOTS.rio }, { h: 19, at: SPOTS.tabernaBar },
        { h: 23, at: home }];
      case 'celso': return [
        { h: 8, at: SPOTS.plaza }, { h: 14, at: SPOTS.plaza2 }, { h: 19, at: SPOTS.taberna },
        { h: 23, at: home }];
      case 'lucio': return [
        { h: 8, at: { map: 'valle', x: 92, y: 68 } }, { h: 18, at: SPOTS.tabernaBar }, { h: 23, at: home }];
      case 'chelo': return [
        { h: 8, at: SPOTS.plaza }, { h: 10, at: SPOTS.puente }, { h: 12, at: SPOTS.granja },
        { h: 15, at: SPOTS.plaza2 }, { h: 19, at: SPOTS.taberna }, { h: 23, at: home }];
      default: return [{ h: 8, at: SPOTS.plaza }, { h: 21, at: home }];
    }
  }

  function NPC(def) {
    this.id = def.id;
    this.def = def;
    this.name = def.name;
    this.x = 70 * TILE; this.y = 48 * TILE;
    this.map = 'valle';
    this.dir = 0; this.frame = 0; this.animT = 0;
    this.hw = 5; this.hh = 3;
    this.speed = 34;
    this.hearts = 0;         // 0..10
    this.points = 0;         // 0..1000
    this.giftedToday = false;
    this.talkedToday = false;
    this.schedule = schedFor(def);
    this.target = null;
    this.idleT = 0;
    this.married = false;
    this.dating = false;
  }
  NPC.prototype.sheet = function () { return Art.charSheet('npc_' + this.id, this.def.look); };

  NPC.prototype.updateSchedule = function (clock, maps, force) {
    var h = clock.minutes / 60;
    var cur = this.schedule[0];
    for (var i = 0; i < this.schedule.length; i++) if (h >= this.schedule[i].h) cur = this.schedule[i];
    if (this.married && G.Game && G.Game.player.spouse === this.id) {
      // La pareja vive en casa de Arricio y sale al huerto por la tarde.
      cur = (h >= 10 && h < 18) ? { at: { map: 'valle', x: 15, y: 24 } } : { at: { map: 'casa', x: 6, y: 5 } };
    }
    var at = cur.at;
    if (at.map !== this.map || force) {
      this.map = at.map;
      this.x = at.x * TILE + 8; this.y = at.y * TILE + 8;
    }
    this.homeTarget = { x: at.x * TILE + 8, y: at.y * TILE + 8 };
  };

  NPC.prototype.update = function (dt, map, clock) {
    if (!this.homeTarget) return;
    // Deambula alrededor de su punto del horario.
    this.idleT -= dt;
    if (!this.target || this.idleT <= 0) {
      if (M.chance(0.55)) {
        this.target = {
          x: this.homeTarget.x + M.rndF(-34, 34),
          y: this.homeTarget.y + M.rndF(-26, 26)
        };
      } else this.target = null;
      this.idleT = M.rndF(2.5, 6.5);
    }
    if (this.target) {
      var dx = this.target.x - this.x, dy = this.target.y - this.y;
      var d = Math.hypot(dx, dy);
      if (d < 4) { this.target = null; this.frame = 0; return; }
      moveAxis(map, this, (dx / d) * this.speed * dt, 0);
      moveAxis(map, this, 0, (dy / d) * this.speed * dt);
      this.dir = dirFrom(dx, dy);
      this.animT += dt * 6;
      this.frame = 1 + (Math.floor(this.animT) % 3);
    } else this.frame = 0;
  };

  NPC.prototype.addPoints = function (n) {
    this.points = M.clamp(this.points + n, 0, 1000);
    var h = Math.min(10, Math.floor(this.points / 100));
    var up = h > this.hearts;
    this.hearts = h;
    return up;
  };

  NPC.prototype.line = function (clock) {
    var d = this.def;
    var keys = Object.keys(d.lines).map(Number).sort(function (a, b) { return a - b; });
    var best = keys[0];
    for (var i = 0; i < keys.length; i++) if (this.hearts >= keys[i]) best = keys[i];
    var pool = d.lines[best].slice();
    // De vez en cuando, charla del tiempo o de la estación
    if (M.chance(0.3)) pool = pool.concat(D.SMALLTALK.weather[clock.weather] || []);
    if (M.chance(0.25)) pool = pool.concat(D.SMALLTALK.season[clock.season]);
    return M.pick(pool);
  };

  NPC.prototype.save = function () {
    return { id: this.id, hearts: this.hearts, points: this.points, married: this.married, dating: this.dating };
  };

  /* ================================================================= HIJOS */
  var CHILD_NAMES_M = ['Nicolás', 'Diego', 'Mateo', 'Bruno', 'Tomás', 'Adrián'];
  var CHILD_NAMES_F = ['Lucía', 'Carmen', 'Sara', 'Julia', 'Nora', 'Elena'];

  function Child(name, girl) {
    this.name = name || (girl ? M.pick(CHILD_NAMES_F) : M.pick(CHILD_NAMES_M));
    this.girl = !!girl;
    this.age = 0;                 // días desde el nacimiento
    this.stage = 0;               // 0 bebé, 1 niño, 2 mozo
    this.x = 12 * TILE; this.y = 16 * TILE;
    this.map = 'casa';
    this.dir = 0; this.frame = 0; this.animT = 0;
    this.hw = 4; this.hh = 3;
    this.speed = 40;
    this.target = null; this.idleT = 0;
    this.helpedToday = false;
    this.look = {
      child: true,
      skin: girl ? '#e8b98c' : '#e0a97a',
      hair: girl ? '#5a3a1a' : '#3a2a1a',
      hairStyle: girl ? 'long' : 'short',
      shirt: girl ? '#c46a8a' : '#6a8ac4',
      pants: '#4a4a52', boots: '#4a3218'
    };
  }
  Child.prototype.sheet = function () { return Art.charSheet('child_' + this.name, this.look); };
  Child.prototype.newDay = function () {
    this.age++;
    var old = this.stage;
    if (this.age >= 28) this.stage = 2;
    else if (this.age >= 10) this.stage = 1;
    this.helpedToday = false;
    return this.stage !== old ? this.stage : -1;
  };
  Child.prototype.update = function (dt, map, player) {
    if (this.stage === 0) { this.frame = 0; return; } // el bebé está en la cuna
    // Los hijos siguen a Arricio a cierta distancia.
    var tx = player.x, ty = player.y;
    var d = M.dist(this.x, this.y, tx, ty);
    if (d > 34) {
      var dx = tx - this.x, dy = ty - this.y;
      moveAxis(map, this, (dx / d) * this.speed * dt, 0);
      moveAxis(map, this, 0, (dy / d) * this.speed * dt);
      this.dir = dirFrom(dx, dy);
      this.animT += dt * 7;
      this.frame = 1 + (Math.floor(this.animT) % 3);
    } else this.frame = 0;
  };
  Child.prototype.save = function () {
    return { name: this.name, girl: this.girl, age: this.age, stage: this.stage };
  };
  Child.load = function (s) {
    var c = new Child(s.name, s.girl);
    c.age = s.age; c.stage = s.stage;
    return c;
  };

  G.Entities = {
    Player: Player, Animal: Animal, NPC: NPC, Child: Child,
    moveAxis: moveAxis, dirFrom: dirFrom, SPOTS: SPOTS,
    CHILD_NAMES_M: CHILD_NAMES_M, CHILD_NAMES_F: CHILD_NAMES_F
  };

})(window);
