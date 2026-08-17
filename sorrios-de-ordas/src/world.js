/* ============================================================================
   SORRÍOS DE ORDÁS — world.js
   Construcción del valle (granja + pueblo), interiores, colisiones y el
   estado del huerto (tierra labrada, regada y sembrada).
   ========================================================================== */
(function (global) {
  'use strict';
  var G = global.SORRIOS, M = G.M, Art = G.Art;
  var TILE = 16;

  // Tipos de suelo
  var T = {
    GRASS: 0, DIRT: 1, PATH: 2, WATER: 3, SOIL: 4,
    WOOD: 5, STONE: 6, HAY: 7, RUG: 8, BRIDGE: 9
  };

  function Map2(id, name, w, h, indoor) {
    this.id = id; this.name = name; this.w = w; this.h = h; this.indoor = !!indoor;
    this.ground = new Uint8Array(w * h);
    this.variant = new Uint8Array(w * h);
    this.block = new Uint8Array(w * h);   // colisión estática
    this.objects = [];
    this.warps = [];
    this.spots = {};
    this.zones = {};
    this.soil = {};                        // "x,y" -> parcela del huerto
    this.tillable = null;                  // rect donde se puede labrar
    this.lightSources = [];
  }
  Map2.prototype.idx = function (x, y) { return y * this.w + x; };
  Map2.prototype.inside = function (x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; };
  Map2.prototype.get = function (x, y) { return this.inside(x, y) ? this.ground[this.idx(x, y)] : T.GRASS; };
  Map2.prototype.set = function (x, y, t, v) {
    if (!this.inside(x, y)) return;
    this.ground[this.idx(x, y)] = t;
    if (v != null) this.variant[this.idx(x, y)] = v;
  };
  Map2.prototype.fill = function (x0, y0, w, h, t, varfn) {
    for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) {
      if (!this.inside(x, y)) continue;
      this.ground[this.idx(x, y)] = t;
      if (varfn) this.variant[this.idx(x, y)] = varfn(x, y);
    }
  };
  Map2.prototype.blockRect = function (x0, y0, w, h, v) {
    for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++)
      if (this.inside(x, y)) this.block[this.idx(x, y)] = (v === undefined ? 1 : v);
  };
  Map2.prototype.isSolidTile = function (x, y) {
    if (!this.inside(x, y)) return true;
    var i = this.idx(x, y);
    if (this.block[i]) return true;
    return this.ground[i] === T.WATER;
  };
  // Colisión en píxeles, con la caja de pies del personaje.
  Map2.prototype.solidAt = function (px, py) {
    return this.isSolidTile(Math.floor(px / TILE), Math.floor(py / TILE));
  };
  Map2.prototype.addObj = function (o) {
    o.sortY = (o.sortY != null) ? o.sortY : (o.py + (o.img ? o.img.height : 0));
    this.objects.push(o);
    return o;
  };
  Map2.prototype.soilAt = function (tx, ty) { return this.soil[tx + ',' + ty]; };
  Map2.prototype.makeSoil = function (tx, ty) {
    var k = tx + ',' + ty;
    if (!this.soil[k]) this.soil[k] = { x: tx, y: ty, tilled: true, watered: false, crop: null, grow: 0, regrow: 0, dead: false };
    else { this.soil[k].tilled = true; this.soil[k].dead = false; }
    return this.soil[k];
  };
  Map2.prototype.canTill = function (tx, ty) {
    var r = this.tillable;
    if (!r) return false;
    if (tx < r.x || ty < r.y || tx >= r.x + r.w || ty >= r.y + r.h) return false;
    if (this.isSolidTile(tx, ty)) return false;
    var s = this.soilAt(tx, ty);
    return !s || !s.tilled;
  };

  /* ------------------------------------------------------- constructores -- */
  function addBuilding(map, img, tx, ty, tw, th, doorDx, warp) {
    map.addObj({ img: img, px: tx * TILE, py: ty * TILE, sortY: (ty + th) * TILE, kind: 'building' });
    map.blockRect(tx, ty, tw, th, 1);
    var dx = tx + doorDx, dy = ty + th; // baldosa delante de la puerta
    map.set(dx, dy, T.PATH, 0);
    if (warp) {
      map.warps.push({ x: dx, y: dy, to: warp.to, tx: warp.tx, ty: warp.ty, name: warp.name, locked: warp.locked, msg: warp.msg });
    }
    map.spots['door_' + (warp ? warp.to : tx + '_' + ty)] = { x: dx, y: dy };
    return { doorX: dx, doorY: dy };
  }

  function fenceLine(map, x0, y0, len, dir, gapAt) {
    for (var i = 0; i < len; i++) {
      if (gapAt != null && i === gapAt) continue;
      var x = dir === 'h' ? x0 + i : x0;
      var y = dir === 'h' ? y0 : y0 + i;
      map.addObj({ img: dir === 'h' ? Art.obj.fenceH : Art.obj.fenceV, px: x * TILE, py: y * TILE - 4, sortY: (y + 1) * TILE, kind: 'fence' });
      map.block[map.idx(x, y)] = 1;
    }
  }

  function scatter(map, rnd, count, opts) {
    var placed = 0, tries = 0;
    while (placed < count && tries < count * 40) {
      tries++;
      var x = rnd.int(opts.x, opts.x + opts.w - 1);
      var y = rnd.int(opts.y, opts.y + opts.h - 1);
      if (!map.inside(x, y)) continue;
      if (map.isSolidTile(x, y)) continue;
      if (map.get(x, y) !== T.GRASS) continue;
      if (opts.avoid && opts.avoid(x, y)) continue;
      opts.place(x, y, rnd);
      placed++;
    }
  }

  /* ================================================== EL VALLE (exterior) = */
  function buildValle(seed) {
    var W = 104, H = 84;
    var map = new Map2('valle', 'Sorríos de Ordás', W, H, false);
    var rnd = G.RNG(seed);
    var noise = G.noise2(seed + 3);

    // --- hierba base con variantes ---
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var n = noise(x * 0.19, y * 0.19);
      var v = n > 0.72 ? 1 : (n < 0.24 ? 2 : (n > 0.62 ? 3 : 0));
      map.set(x, y, T.GRASS, v);
    }

    // --- río de norte a sur, separando la granja del pueblo ---
    var riverX = [];
    for (var ry = 0; ry < H; ry++) {
      var cx = 47 + Math.round(Math.sin(ry * 0.13) * 2.5 + Math.sin(ry * 0.41) * 1.2);
      riverX.push(cx);
      var wdt = 3 + (ry % 7 === 0 ? 1 : 0);
      for (var i = 0; i < wdt; i++) map.set(cx + i, ry, T.WATER, 0);
      map.set(cx - 1, ry, T.DIRT, 0);
      map.set(cx + wdt, ry, T.DIRT, 0);
    }

    // --- camino principal: granja -> puente -> plaza ---
    function road(x0, y0, x1, y1) {
      var x = x0, y = y0, guard = 0;
      while ((x !== x1 || y !== y1) && guard++ < 900) {
        for (var w = -1; w <= 1; w++) {
          if (map.get(x, y + w) !== T.WATER) map.set(x, y + w, T.PATH, (x + y + w) % 2);
          if (map.get(x + w, y) !== T.WATER) map.set(x + w, y, T.PATH, (x + w + y) % 2);
        }
        if (x !== x1) x += M.sign(x1 - x);
        else if (y !== y1) y += M.sign(y1 - y);
      }
    }
    road(20, 30, 20, 46);
    road(20, 46, 44, 46);
    road(52, 46, 70, 46);
    road(70, 46, 70, 58);
    road(70, 58, 88, 58);
    road(62, 46, 62, 40);

    // --- puente sobre el río ---
    var bridgeY = 46;
    for (var by = bridgeY - 1; by <= bridgeY + 1; by++) {
      for (var bx = riverX[by] - 3; bx <= riverX[by] + 5; bx++) {
        map.set(bx, by, T.BRIDGE, 0);
      }
    }
    map.spots.bridge = { x: riverX[bridgeY] + 1, y: bridgeY };

    /* ------------------------------- LA GRANJA DE ARRICIO (noroeste) ----- */
    // Casa
    addBuilding(map, Art.obj.house, 8, 6, 7, 6, 3, { to: 'casa', tx: 10, ty: 12, name: 'Casa de Arricio' });
    // Cuadra (vacas, ovejas y el burro)
    addBuilding(map, Art.obj.barn, 24, 5, 8, 7, 4, { to: 'cuadra', tx: 11, ty: 14, name: 'La cuadra' });
    // Gallinero
    addBuilding(map, Art.obj.coop, 35, 8, 5, 4, 2, { to: 'gallinero', tx: 7, ty: 10, name: 'El gallinero' });

    // Pozo y comedero
    map.addObj({ img: Art.obj.well, px: 17 * TILE, py: 15 * TILE, kind: 'well', interact: 'well' });
    map.blockRect(17, 16, 2, 1, 1);
    map.spots.well = { x: 17, y: 17 };
    map.addObj({ img: Art.obj.trough, px: 27 * TILE, py: 14 * TILE, kind: 'trough', interact: 'trough' });
    map.blockRect(27, 14, 2, 1, 1);
    map.spots.trough = { x: 27, y: 15 };
    map.addObj({ img: Art.obj.haystack, px: 34 * TILE, py: 14 * TILE, kind: 'haystack', interact: 'haystack' });
    map.blockRect(34, 15, 2, 1, 1);
    map.addObj({ img: Art.obj.chest, px: 13 * TILE, py: 13 * TILE, kind: 'chest', interact: 'ship' });
    map.blockRect(13, 13, 1, 1, 1);
    map.spots.ship = { x: 13, y: 14 };

    // Prado cercado para el ganado
    var pasture = { x: 22, y: 14, w: 18, h: 14 };
    map.zones.pasture = pasture;
    fenceLine(map, pasture.x, pasture.y, pasture.w, 'h', 6);
    fenceLine(map, pasture.x, pasture.y + pasture.h, pasture.w, 'h', 9);
    fenceLine(map, pasture.x, pasture.y, pasture.h, 'v', 0);
    fenceLine(map, pasture.x + pasture.w, pasture.y, pasture.h, 'v', null);
    map.addObj({ img: Art.obj.gate, px: (pasture.x + 6) * TILE, py: pasture.y * TILE - 4, sortY: (pasture.y + 1) * TILE, kind: 'gate' });

    // Huerto junto a la casa
    var huerto = { x: 7, y: 19, w: 13, h: 10 };
    map.tillable = huerto;
    map.zones.huerto = huerto;
    map.fill(huerto.x - 1, huerto.y - 1, huerto.w + 2, huerto.h + 2, T.DIRT, function () { return rnd.int(0, 2); });
    fenceLine(map, huerto.x - 1, huerto.y - 1, huerto.w + 2, 'h', 6);
    fenceLine(map, huerto.x - 1, huerto.y + huerto.h, huerto.w + 2, 'h', 6);
    fenceLine(map, huerto.x - 1, huerto.y - 1, huerto.h + 1, 'v', null);
    fenceLine(map, huerto.x + huerto.w + 1, huerto.y - 1, huerto.h + 1, 'v', null);
    map.spots.huerto = { x: huerto.x + 5, y: huerto.y + 5 };

    // Cartel de la granja
    map.addObj({ img: Art.makeSign('GRANJA\nARRICIO'), px: 21 * TILE, py: 31 * TILE, kind: 'sign', interact: 'sign',
                 text: 'GRANJA DE ARRICIO — Sorríos de Ordás' });
    map.blockRect(21, 32, 2, 1, 1);

    /* ------------------------------------ EL PUEBLO (sureste del río) ---- */
    // Plaza empedrada
    map.fill(64, 42, 14, 10, T.PATH, function (x, y) { return (x + y) % 2; });
    map.zones.plaza = { x: 64, y: 42, w: 14, h: 10 };

    addBuilding(map, Art.obj.church, 58, 30, 9, 11, 4, { to: 'iglesia', tx: 9, ty: 15, name: 'Iglesia de San Roque' });
    addBuilding(map, Art.obj.shopFood, 54, 44, 7, 6, 3, { to: 'tienda_comida', tx: 10, ty: 12, name: 'Ultramarinos «La Reguera»' });
    addBuilding(map, Art.obj.shopFarm, 80, 44, 8, 6, 4, { to: 'tienda_aperos', tx: 11, ty: 12, name: 'Piensos y Aperos «Bernardo»' });
    addBuilding(map, Art.obj.tavern, 62, 60, 7, 6, 3, { to: 'taberna', tx: 10, ty: 12, name: 'Taberna de Segundo' });
    addBuilding(map, Art.obj.houseBig, 74, 60, 8, 7, 4, { to: 'casa_marina', tx: 9, ty: 11, name: 'Casa de Marina' });
    addBuilding(map, Art.obj.houseVilla, 88, 52, 6, 6, 2, { to: 'casa_aurora', tx: 8, ty: 11, name: 'Casa de Aurora' });
    addBuilding(map, Art.obj.houseSmall, 86, 34, 5, 5, 2, { to: 'casa_nieves', tx: 8, ty: 10, name: 'Molino de Nieves' });
    addBuilding(map, Art.obj.houseSmall, 52, 56, 5, 5, 2, { to: 'casa_herminia', tx: 8, ty: 10, name: 'Casa de Herminia' });
    // Casas sin interior (fachada viva del pueblo)
    addBuilding(map, Art.obj.house, 92, 62, 7, 6, 3, { to: null, name: 'Casa de Lucio', locked: true, msg: 'La fragua de Lucio está cerrada.' });
    addBuilding(map, Art.obj.houseSmall, 46, 64, 5, 5, 2, { to: null, name: 'Casa de Chelo', locked: true, msg: 'Chelo anda repartiendo el correo.' });
    addBuilding(map, Art.obj.houseVilla, 80, 68, 6, 6, 2, { to: null, name: 'Casa del alcalde', locked: true, msg: 'La casa del alcalde está cerrada.' });
    addBuilding(map, Art.obj.houseSmall, 56, 70, 5, 5, 2, { to: null, name: 'Casa de Tino', locked: true, msg: 'Tino anda con las ovejas.' });
    addBuilding(map, Art.obj.house, 68, 72, 7, 6, 3, { to: null, name: 'Escuela', locked: true, msg: 'La escuela está cerrada hasta mañana.' });

    // Farolas y detalles de plaza
    [[65, 42], [77, 42], [65, 51], [77, 51]].forEach(function (p) {
      map.addObj({ img: Art.obj.lamp, px: p[0] * TILE, py: p[1] * TILE - 24, sortY: (p[1] + 1) * TILE, kind: 'lamp' });
      map.block[map.idx(p[0], p[1])] = 1;
      map.lightSources.push({ x: p[0] * TILE + 8, y: p[1] * TILE, r: 78 });
    });
    map.addObj({ img: Art.obj.well, px: 70 * TILE, py: 46 * TILE, kind: 'well', interact: 'well' });
    map.blockRect(70, 47, 2, 1, 1);
    map.addObj({ img: Art.makeSign('SORRÍOS\nDE ORDÁS'), px: 55 * TILE, py: 47 * TILE, kind: 'sign', interact: 'sign',
                 text: 'SORRÍOS DE ORDÁS — 41 vecinos. Ayuntamiento de Ordás.' });
    map.blockRect(55, 48, 2, 1, 1);

    /* ---------------------------------------- vegetación y decoración ---- */
    // Bosque en el norte y el este
    scatter(map, rnd, 130, {
      x: 0, y: 0, w: W, h: H,
      avoid: function (x, y) {
        if (x > 4 && x < 44 && y > 2 && y < 34) return true;      // granja
        if (x > 44 && x < 100 && y > 28 && y < 80) return true;   // pueblo
        return false;
      },
      place: function (x, y, r) {
        var kind = r() < 0.42 ? 'pine' : (r() < 0.85 ? 'tree' : 'apple');
        map.addObj({ img: null, imgSet: kind, px: x * TILE - 12, py: y * TILE - 36, sortY: (y + 1) * TILE, kind: 'tree', tx: x, ty: y });
        map.block[map.idx(x, y)] = 1;
      }
    });
    // Arbolitos sueltos en granja y pueblo
    [[6, 3], [16, 4], [40, 5], [42, 20], [6, 32], [30, 32], [54, 38], [92, 40], [50, 52], [84, 66], [66, 66], [96, 48]].forEach(function (p) {
      map.addObj({ img: null, imgSet: (p[0] % 3 === 0 ? 'apple' : 'tree'), px: p[0] * TILE - 12, py: p[1] * TILE - 36, sortY: (p[1] + 1) * TILE, kind: 'tree', tx: p[0], ty: p[1] });
      if (map.inside(p[0], p[1])) map.block[map.idx(p[0], p[1])] = 1;
    });
    // Matorrales, piedras y flores
    scatter(map, rnd, 70, {
      x: 0, y: 0, w: W, h: H,
      avoid: function (x, y) { return (x > 6 && x < 21 && y > 18 && y < 30); },
      place: function (x, y, r) {
        if (r() < 0.45) {
          map.addObj({ img: null, imgSet: 'bush', px: x * TILE - 2, py: y * TILE - 4, sortY: (y + 1) * TILE, kind: 'bush', tx: x, ty: y, harvest: true });
        } else if (r() < 0.6) {
          map.addObj({ img: Art.obj.rock[r.int(0, 1)], px: x * TILE, py: y * TILE, sortY: (y + 1) * TILE, kind: 'rock', tx: x, ty: y, interact: 'rock' });
          map.block[map.idx(x, y)] = 1;
        } else {
          map.addObj({ img: null, imgSet: 'flowers', px: x * TILE, py: y * TILE + 2, sortY: (y + 1) * TILE - 2, kind: 'flowers', tx: x, ty: y, interact: 'flower' });
        }
      }
    });

    map.spots.playerStart = { x: 12, y: 15 };
    map.spots.pastureCenter = { x: pasture.x + pasture.w / 2, y: pasture.y + pasture.h / 2 };
    return map;
  }

  /* ================================================ INTERIORES genéricos = */
  function buildRoom(o) {
    var map = new Map2(o.id, o.name, o.w, o.h, true);
    var rnd = G.RNG(o.seed || 7);
    var floor = o.floor || T.WOOD;
    map.fill(0, 0, o.w, o.h, floor, function () { return rnd.int(0, 1); });
    // Muros: fila superior de pared (2 tiles) y borde sólido
    map.blockRect(0, 0, o.w, 2, 1);
    map.blockRect(0, 0, 1, o.h, 1);
    map.blockRect(o.w - 1, 0, 1, o.h, 1);
    map.blockRect(0, o.h - 1, o.w, 1, 1);
    map.wallColor = o.wall || '#c9b696';
    map.floorTile = floor;

    // Puerta de salida en el centro inferior
    var dx = o.doorX != null ? o.doorX : Math.floor(o.w / 2);
    map.block[map.idx(dx, o.h - 1)] = 0;
    map.warps.push({ x: dx, y: o.h - 1, to: 'valle', tx: o.outX, ty: o.outY, name: 'Salir' });
    map.spots.entry = { x: dx, y: o.h - 2 };
    map.spots.door = { x: dx, y: o.h - 1 };
    return map;
  }

  function buildInteriors() {
    var maps = {};

    /* ---- casa de Arricio ---- */
    var casa = buildRoom({ id: 'casa', name: 'Casa de Arricio', w: 13, h: 10, seed: 11, outX: 11, outY: 12, wall: '#cdb896' });
    casa.fill(4, 5, 5, 4, T.RUG, function () { return 0; });
    casa.addObj({ img: Art.obj.bed, px: 1 * TILE, py: 2 * TILE, sortY: 5 * TILE, kind: 'bed', interact: 'bed' });
    casa.blockRect(1, 2, 2, 3, 1);
    casa.spots.bed = { x: 2, y: 5 };
    casa.addObj({ img: Art.obj.stove, px: 10 * TILE, py: 2 * TILE, sortY: 4 * TILE, kind: 'stove', interact: 'stove' });
    casa.blockRect(10, 2, 2, 2, 1);
    casa.spots.stove = { x: 10, y: 4 };
    casa.addObj({ img: Art.obj.chest, px: 7 * TILE, py: 2 * TILE + 8, sortY: 4 * TILE, kind: 'chest', interact: 'chest' });
    casa.blockRect(7, 2, 1, 1, 1);
    casa.spots.crib = { x: 5, y: 3 };
    maps.casa = casa;

    /* ---- cuadra ---- */
    var cuadra = buildRoom({ id: 'cuadra', name: 'La cuadra', w: 16, h: 12, floor: T.HAY, seed: 13, outX: 28, outY: 12, wall: '#b04a3a' });
    cuadra.addObj({ img: Art.obj.trough, px: 2 * TILE, py: 2 * TILE, sortY: 3 * TILE + 8, kind: 'trough', interact: 'trough' });
    cuadra.blockRect(2, 2, 2, 1, 1);
    cuadra.spots.trough = { x: 3, y: 3 };
    cuadra.addObj({ img: Art.obj.trough, px: 11 * TILE, py: 2 * TILE, sortY: 3 * TILE + 8, kind: 'trough', interact: 'trough' });
    cuadra.blockRect(11, 2, 2, 1, 1);
    cuadra.addObj({ img: Art.obj.haystack, px: 13 * TILE, py: 7 * TILE, sortY: 9 * TILE, kind: 'haystack', interact: 'haystack' });
    cuadra.blockRect(13, 8, 2, 1, 1);
    cuadra.zones.pen = { x: 1, y: 3, w: 14, h: 7 };
    maps.cuadra = cuadra;

    /* ---- gallinero ---- */
    var gall = buildRoom({ id: 'gallinero', name: 'El gallinero', w: 10, h: 8, floor: T.HAY, seed: 17, outX: 37, outY: 12, wall: '#c8b189' });
    gall.addObj({ img: Art.obj.trough, px: 1 * TILE, py: 2 * TILE, sortY: 3 * TILE + 8, kind: 'trough', interact: 'trough' });
    gall.blockRect(1, 2, 2, 1, 1);
    gall.spots.trough = { x: 2, y: 3 };
    gall.zones.pen = { x: 1, y: 3, w: 8, h: 4 };
    maps.gallinero = gall;

    /* ---- tienda de comestibles ---- */
    var tc = buildRoom({ id: 'tienda_comida', name: 'Ultramarinos «La Reguera»', w: 13, h: 10, floor: T.STONE, seed: 19, outX: 57, outY: 50, wall: '#e0d4b4' });
    tc.addObj({ img: Art.obj.shelf, px: 1 * TILE, py: 2 * TILE - 8, sortY: 3 * TILE, kind: 'shelf' });
    tc.blockRect(1, 2, 3, 1, 1);
    tc.addObj({ img: Art.obj.shelf, px: 8 * TILE, py: 2 * TILE - 8, sortY: 3 * TILE, kind: 'shelf' });
    tc.blockRect(8, 2, 3, 1, 1);
    tc.addObj({ img: Art.obj.counter, px: 4 * TILE, py: 5 * TILE, sortY: 6 * TILE + 6, kind: 'counter', interact: 'shop', shop: 'comestibles' });
    tc.blockRect(4, 5, 3, 1, 1);
    tc.spots.counter = { x: 5, y: 6 };
    tc.spots.keeper = { x: 5, y: 4 };
    maps.tienda_comida = tc;

    /* ---- almacén de piensos y aperos ---- */
    var ta = buildRoom({ id: 'tienda_aperos', name: 'Piensos y Aperos «Bernardo»', w: 14, h: 10, floor: T.STONE, seed: 23, outX: 84, outY: 50, wall: '#d6c49c' });
    ta.addObj({ img: Art.obj.shelf, px: 1 * TILE, py: 2 * TILE - 8, sortY: 3 * TILE, kind: 'shelf' });
    ta.blockRect(1, 2, 3, 1, 1);
    ta.addObj({ img: Art.obj.shelf, px: 9 * TILE, py: 2 * TILE - 8, sortY: 3 * TILE, kind: 'shelf' });
    ta.blockRect(9, 2, 3, 1, 1);
    ta.addObj({ img: Art.obj.haystack, px: 11 * TILE, py: 6 * TILE, sortY: 8 * TILE, kind: 'haystack' });
    ta.blockRect(11, 7, 2, 1, 1);
    ta.addObj({ img: Art.obj.counter, px: 4 * TILE, py: 5 * TILE, sortY: 6 * TILE + 6, kind: 'counter', interact: 'shop', shop: 'aperos' });
    ta.blockRect(4, 5, 3, 1, 1);
    ta.spots.counter = { x: 5, y: 6 };
    ta.spots.keeper = { x: 5, y: 4 };
    maps.tienda_aperos = ta;

    /* ---- taberna ---- */
    var tab = buildRoom({ id: 'taberna', name: 'Taberna de Segundo', w: 13, h: 10, floor: T.WOOD, seed: 29, outX: 65, outY: 66, wall: '#c9ab84' });
    tab.addObj({ img: Art.obj.counter, px: 3 * TILE, py: 3 * TILE, sortY: 4 * TILE + 6, kind: 'counter' });
    tab.blockRect(3, 3, 3, 1, 1);
    tab.addObj({ img: Art.obj.shelf, px: 2 * TILE, py: 2 * TILE - 10, sortY: 2 * TILE + 4, kind: 'shelf' });
    tab.blockRect(2, 2, 3, 1, 1);
    tab.spots.keeper = { x: 4, y: 2 };
    tab.spots.tables = { x: 8, y: 6 };
    maps.taberna = tab;

    /* ---- iglesia ---- */
    var igl = buildRoom({ id: 'iglesia', name: 'Iglesia de San Roque', w: 11, h: 12, floor: T.STONE, seed: 31, outX: 62, outY: 41, wall: '#c0b8a4' });
    igl.fill(4, 2, 3, 9, T.RUG, function () { return 0; });
    igl.spots.altar = { x: 5, y: 3 };
    igl.spots.keeper = { x: 5, y: 2 };
    igl.blockRect(4, 1, 3, 1, 1);
    maps.iglesia = igl;

    /* ---- casas de vecinas ---- */
    function casita(id, name, outX, outY, wall, seed) {
      var m = buildRoom({ id: id, name: name, w: 11, h: 9, floor: T.WOOD, seed: seed, outX: outX, outY: outY, wall: wall });
      m.fill(3, 4, 4, 3, T.RUG, function () { return 0; });
      m.addObj({ img: Art.obj.bed, px: 1 * TILE, py: 2 * TILE, sortY: 5 * TILE, kind: 'bed' });
      m.blockRect(1, 2, 2, 3, 1);
      m.addObj({ img: Art.obj.stove, px: 8 * TILE, py: 2 * TILE, sortY: 4 * TILE, kind: 'stove' });
      m.blockRect(8, 2, 2, 2, 1);
      m.spots.keeper = { x: 5, y: 3 };
      return m;
    }
    maps.casa_marina = casita('casa_marina', 'Casa de Marina', 78, 67, '#c2b8a0', 37);
    maps.casa_aurora = casita('casa_aurora', 'Casa de Aurora', 90, 58, '#bdae94', 41);
    maps.casa_nieves = casita('casa_nieves', 'Molino de Nieves', 88, 39, '#d0bfa0', 43);
    maps.casa_herminia = casita('casa_herminia', 'Casa de Herminia', 54, 61, '#d0bfa0', 47);

    return maps;
  }

  /* --------------------------------------------------------------- API --- */
  G.World = {
    TILE: TILE, T: T, Map: Map2,
    build: function (seed) {
      var maps = buildInteriors();
      maps.valle = buildValle(seed || 20260817);
      return maps;
    },
    warpAt: function (map, tx, ty) {
      for (var i = 0; i < map.warps.length; i++) {
        var w = map.warps[i];
        if (w.x === tx && w.y === ty) return w;
      }
      return null;
    },
    objAtTile: function (map, tx, ty) {
      for (var i = 0; i < map.objects.length; i++) {
        var o = map.objects[i];
        if (o.tx === tx && o.ty === ty) return o;
      }
      return null;
    },
    // Objeto interactuable más cercano dentro de un radio (en píxeles).
    nearestInteractive: function (map, px, py, rad) {
      var best = null, bd = rad * rad;
      for (var i = 0; i < map.objects.length; i++) {
        var o = map.objects[i];
        if (!o.interact) continue;
        var ox = o.px + (o.img ? o.img.width / 2 : 8);
        var oy = o.py + (o.img ? o.img.height * 0.75 : 8);
        var d = M.dist2(px, py, ox, oy);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    },
    removeObj: function (map, obj) {
      var i = map.objects.indexOf(obj);
      if (i >= 0) map.objects.splice(i, 1);
      if (obj.tx != null && map.inside(obj.tx, obj.ty)) map.block[map.idx(obj.tx, obj.ty)] = 0;
      // Se apunta para que al recargar la partida siga quitado
      if (G.Game && G.Game.removed && obj.oid != null) {
        var key = map.id + ':' + obj.oid;
        if (G.Game.removed.indexOf(key) < 0) G.Game.removed.push(key);
      }
    }
  };

})(window);
