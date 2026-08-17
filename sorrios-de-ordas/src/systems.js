/* ============================================================================
   SORRÍOS DE ORDÁS — systems.js
   Reglas del juego: labrar, sembrar, regar y cosechar; ordeño a mano; dar de
   comer al ganado; tiendas; amistad, noviazgo, boda e hijos; y el paso del día.
   ========================================================================== */
(function (global) {
  'use strict';
  var G = global.SORRIOS, M = G.M, D = G.DATA, W = G.World, Art = G.Art;
  var TILE = 16;

  /* ============================================================= ORDEÑO === */
  // Minijuego de ordeño a mano: hay que alternar las dos manos siguiendo el
  // ritmo, como se hacía antiguamente sentado en el taburete.
  function Milking() {
    this.active = false;
  }
  Milking.prototype.start = function (animal, product) {
    this.active = true;
    this.animal = animal;
    this.product = product;
    this.hand = 0;              // 0 = izquierda, 1 = derecha
    this.filled = 0;            // 0..100
    this.misses = 0;
    this.squeezes = 0;
    this.window = 0;            // tiempo transcurrido del compás
    this.beat = 1.05;           // duración del compás (se acelera)
    this.result = null;
    this.flash = 0;
    this.shake = 0;
    this.squirts = [];
    this.msg = '¡Alterna las manos al ritmo!';
  };
  Milking.prototype.press = function (hand) {
    if (!this.active || this.result) return;
    var t = this.window / this.beat;         // 0..1 dentro del compás
    var good = t > 0.55;                     // la ventana buena es el final del compás
    if (hand !== this.hand) {
      this.miss('¡Esa mano no!');
      return;
    }
    if (good) {
      var quality = t > 0.78 ? 1.6 : 1.0;
      this.filled = Math.min(100, this.filled + 7 * quality);
      this.squeezes++;
      this.hand = 1 - this.hand;
      this.window = 0;
      this.beat = Math.max(0.5, this.beat - 0.022);
      this.flash = 0.12;
      this.squirts.push({ x: hand ? 6 : -6, y: 0, vy: 60 + Math.random() * 30, life: 0.45 });
      this.msg = quality > 1.2 ? '¡Buen chorro!' : 'Bien.';
      G.Audio.sfx('milk');
      if (this.filled >= 100) this.finish(true);
    } else {
      this.miss('Demasiado pronto…');
    }
  };
  Milking.prototype.miss = function (msg) {
    this.misses++;
    this.filled = Math.max(0, this.filled - 4);
    this.beat = Math.min(1.15, this.beat + 0.05);
    this.shake = 0.25;
    this.msg = msg;
    G.Audio.sfx('no');
    if (this.misses >= 5) this.finish(false);
  };
  Milking.prototype.finish = function (ok) {
    this.result = ok ? 'ok' : 'fail';
    this.resultT = 1.4;
  };
  Milking.prototype.update = function (dt) {
    if (!this.active) return;
    if (this.flash > 0) this.flash -= dt;
    if (this.shake > 0) this.shake -= dt;
    for (var i = this.squirts.length - 1; i >= 0; i--) {
      var s = this.squirts[i];
      s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0) this.squirts.splice(i, 1);
    }
    if (this.result) {
      this.resultT -= dt;
      if (this.resultT <= 0) this.active = false;
      return;
    }
    this.window += dt;
    if (this.window > this.beat) {
      this.window = 0;
      this.miss('Se te fue el ritmo.');
    }
  };
  Milking.prototype.yieldAmount = function () {
    if (this.filled >= 100) return this.squeezes > 12 ? 2 : 1;
    return this.filled >= 55 ? 1 : 0;
  };

  /* ============================================================= AYUDANTES */
  function toast(game, text, color) { game.ui.toast(text, color); }

  function animalNear(game, rad) {
    var best = null, bd = (rad || 26) * (rad || 26);
    var f = game.player.facingTile();
    var fx = f.x * TILE + 8, fy = f.y * TILE + 8;
    for (var i = 0; i < game.animals.length; i++) {
      var a = game.animals[i];
      if (a.map !== game.player.map) continue;
      var d = Math.min(M.dist2(a.x, a.y, fx, fy), M.dist2(a.x, a.y, game.player.x, game.player.y));
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  function npcNear(game, rad) {
    var best = null, bd = (rad || 30) * (rad || 30);
    for (var i = 0; i < game.npcs.length; i++) {
      var n = game.npcs[i];
      if (n.map !== game.player.map) continue;
      var d = M.dist2(n.x, n.y, game.player.x, game.player.y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  function objNear(game, rad) {
    return W.nearestInteractive(game.map(), game.player.x, game.player.y, rad || 26);
  }

  /* ================================================== USO DE HERRAMIENTAS = */
  function useTool(game) {
    var p = game.player, map = game.map();
    var tool = p.currentTool();
    var def = D.ITEMS[tool];
    var f = p.facingTile();
    p.swing = 0.28;

    // Con un objeto en la mano (que no sea semilla ni herramienta) y un vecino
    // al lado, el botón de herramienta sirve para regalar.
    if (def && def.type !== 'tool' && def.type !== 'seed') {
      var vecino = npcNear(game, 30);
      if (vecino) {
        if (tool === 'ramo' || tool === 'anillo') return propose(game, vecino, tool);
        return giveGift(game, vecino, tool);
      }
    }

    // Si en la ranura hay semillas, se siembra
    if (def && def.type === 'seed') return plantSeed(game, tool, f);

    switch (tool) {
      case 'azada':     return doHoe(game, f);
      case 'regadera':  return doWater(game, f);
      case 'cubo':      return doMilk(game);
      case 'hoz':       return doScythe(game, f);
      case 'hacha':     return doAxe(game, f);
      case 'pala':      return doShovel(game, f);
      case 'rastrillo': return doRake(game, f);
      case 'tijeras':   return doShear(game);
    }
    return false;
  }

  function costEnergy(game, n) {
    var p = game.player;
    if (p.energy <= -15) { toast(game, 'No te tienes en pie. Vete a dormir.', '#e08a8a'); return false; }
    p.useEnergy(n);
    if (p.energy <= 0 && !p._warned) {
      p._warned = true;
      toast(game, 'Estás agotado, Arricio…', '#e08a8a');
    }
    return true;
  }

  function doHoe(game, f) {
    var map = game.map();
    var s = map.soilAt(f.x, f.y);
    if (s && s.crop) { toast(game, 'Ahí ya hay algo sembrado.'); return false; }
    if (!map.canTill(f.x, f.y)) {
      toast(game, map.tillable ? 'Aquí no se puede labrar.' : 'El huerto está junto a la casa.');
      return false;
    }
    if (!costEnergy(game, 3)) return false;
    map.makeSoil(f.x, f.y);
    map.set(f.x, f.y, W.T.SOIL, 0);
    G.Audio.sfx('hoe');
    game.fx.puff(f.x * TILE + 8, f.y * TILE + 10, '#6b4a2c', 8);
    return true;
  }

  function doWater(game, f) {
    var p = game.player, map = game.map();
    // Rellenar en agua, pozo o abrevadero
    var t = map.get(f.x, f.y);
    var obj = W.objAtTile(map, f.x, f.y);
    var nearWell = objNear(game, 30);
    if (t === W.T.WATER || (nearWell && nearWell.interact === 'well')) {
      p.wateringLevel = p.wateringMax;
      G.Audio.sfx('water');
      toast(game, 'Regadera llena.', '#8fc8e8');
      return true;
    }
    var s = map.soilAt(f.x, f.y);
    if (!s || !s.tilled) { toast(game, 'Ahí no hay tierra labrada.'); return false; }
    if (s.watered) { toast(game, 'Ya está regado.'); return false; }
    if (p.wateringLevel <= 0) { toast(game, 'La regadera está vacía. Ve al pozo.', '#8fc8e8'); return false; }
    if (!costEnergy(game, 2)) return false;
    p.wateringLevel--;
    s.watered = true;
    map.set(f.x, f.y, W.T.SOIL, 1);
    G.Audio.sfx('water');
    game.fx.splash(f.x * TILE + 8, f.y * TILE + 8);
    return true;
  }

  function doMilk(game) {
    var a = animalNear(game, 30);
    if (!a) { toast(game, 'Acércate a una vaca o una oveja.'); return false; }
    if (!a.def.product || a.def.productTool !== 'cubo') {
      toast(game, a.name + ' no se ordeña.');
      return false;
    }
    if (!a.productReady) {
      toast(game, a.name + ' ya está ordeñada hoy.');
      return false;
    }
    if (game.player.energy < 4) { toast(game, 'No te quedan fuerzas para ordeñar.', '#e08a8a'); return false; }
    game.milking.start(a, a.def.product);
    game.state = 'milking';
    game.player.dir = a.x < game.player.x ? 2 : 3;
    return true;
  }

  function doScythe(game, f) {
    var map = game.map();
    var o = W.objAtTile(map, f.x, f.y);
    if (o && (o.kind === 'bush' || o.kind === 'flowers')) {
      if (!costEnergy(game, 2)) return false;
      W.removeObj(map, o);
      G.Audio.sfx('chop');
      game.fx.puff(f.x * TILE + 8, f.y * TILE + 8, '#5f9e3f', 10);
      if (o.kind === 'flowers') { game.give('flor', 1); }
      else if (M.chance(0.5)) game.give('heno', 1);
      return true;
    }
    var s = map.soilAt(f.x, f.y);
    if (s && s.crop && s.dead) {
      if (!costEnergy(game, 2)) return false;
      s.crop = null; s.dead = false; s.grow = 0;
      G.Audio.sfx('chop');
      return true;
    }
    if (map.get(f.x, f.y) === W.T.GRASS && !map.indoor) {
      if (!costEnergy(game, 1)) return false;
      G.Audio.sfx('chop');
      game.fx.puff(f.x * TILE + 8, f.y * TILE + 8, '#5f9e3f', 6);
      if (M.chance(0.32)) game.give('heno', 1);
      return true;
    }
    toast(game, 'Aquí no hay nada que segar.');
    return false;
  }

  function doAxe(game, f) {
    var map = game.map();
    var o = W.objAtTile(map, f.x, f.y);
    if (o && o.kind === 'tree') {
      if (!costEnergy(game, 4)) return false;
      o.hp = (o.hp || 3) - 1;
      G.Audio.sfx('chop');
      game.fx.puff(f.x * TILE + 8, f.y * TILE, '#6b4a2c', 8);
      o.shake = 0.3;
      if (o.hp <= 0) {
        W.removeObj(map, o);
        var n = M.rndInt(2, 4);
        game.give('lena', n);
        game.player.stats.wood += n;
        toast(game, '+' + n + ' leña', '#c9a95c');
      }
      return true;
    }
    if (o && o.kind === 'bush') { return doScythe(game, f); }
    toast(game, 'No hay ningún árbol delante.');
    return false;
  }

  function doShovel(game, f) {
    var map = game.map();
    var o = W.objAtTile(map, f.x, f.y);
    if (o && o.kind === 'rock') {
      if (!costEnergy(game, 4)) return false;
      W.removeObj(map, o);
      G.Audio.sfx('chop');
      game.give('piedra', M.rndInt(1, 2));
      game.fx.puff(f.x * TILE + 8, f.y * TILE + 8, '#9a9287', 10);
      return true;
    }
    toast(game, 'Aquí no hay piedra que sacar.');
    return false;
  }

  function doRake(game, f) {
    var map = game.map();
    var s = map.soilAt(f.x, f.y);
    if (s && s.tilled && !s.crop) {
      if (!costEnergy(game, 1)) return false;
      delete map.soil[f.x + ',' + f.y];
      map.set(f.x, f.y, W.T.DIRT, 0);
      G.Audio.sfx('hoe');
      return true;
    }
    if (s && s.dead) { return doScythe(game, f); }
    toast(game, 'Nada que rastrillar aquí.');
    return false;
  }

  function doShear(game) {
    var a = animalNear(game, 30);
    if (!a) { toast(game, 'Acércate a una oveja.'); return false; }
    if (!a.def.extra) { toast(game, a.name + ' no da lana.'); return false; }
    if (!a.extraReady) { toast(game, a.name + ' aún no tiene lana suficiente.'); return false; }
    if (!costEnergy(game, 4)) return false;
    a.extraReady = false; a.extraTimer = 0; a.sheared = true;
    game.give('lana', 1);
    G.Audio.sfx('pick');
    game.fx.puff(a.x, a.y - 6, '#f2eee4', 14);
    toast(game, '¡Lana de ' + a.name + '!', '#f2eee4');
    return true;
  }

  function plantSeed(game, seedId, f) {
    var map = game.map();
    var s = map.soilAt(f.x, f.y);
    if (!s || !s.tilled) { toast(game, 'Primero hay que labrar con la azada.'); return false; }
    if (s.crop) { toast(game, 'Ahí ya hay sembrado.'); return false; }
    var def = D.ITEMS[seedId];
    var crop = D.CROPS[def.crop];
    if (crop.seasons.indexOf(game.clock.season) < 0) {
      toast(game, crop.name + ' no es de ' + D.SEASON_NAMES[game.clock.season].toLowerCase() + '.', '#e0b47a');
      return false;
    }
    if (game.player.countItem(seedId) <= 0) { toast(game, 'No te quedan semillas.'); return false; }
    if (!costEnergy(game, 1)) return false;
    game.player.removeItem(seedId, 1);
    s.crop = def.crop; s.grow = 0; s.regrow = 0; s.dead = false;
    G.Audio.sfx('plant');
    game.fx.puff(f.x * TILE + 8, f.y * TILE + 8, '#7fc04a', 6);
    game.syncHotbar();
    return true;
  }

  /* ================================================ INTERACCIÓN (botón A) = */
  function interact(game) {
    var p = game.player, map = game.map();

    // 1) El mostrador manda: si estás pegado a él, se abre la tienda aunque
    //    el tendero ande por detrás.
    var counter = objNear(game, 24);
    if (counter && counter.interact === 'shop') return useObject(game, counter);

    // 2) Vecinos
    var n = npcNear(game, 30);
    if (n) { talkTo(game, n); return true; }

    // 2) Hijos
    for (var c = 0; c < game.children.length; c++) {
      var ch = game.children[c];
      if (ch.map === p.map && ch.stage > 0 && M.dist(ch.x, ch.y, p.x, p.y) < 26) {
        game.ui.dialog(ch.name, M.pick(childLines(ch, game)));
        return true;
      }
    }

    // 3) Cultivo listo delante o debajo
    var f = p.facingTile(), t = p.tile();
    if (harvestAt(game, f.x, f.y) || harvestAt(game, t.x, t.y)) return true;

    // 4) Animales
    var a = animalNear(game, 28);
    if (a) { petAnimal(game, a); return true; }

    // 5) Objetos
    var o = objNear(game, 28);
    if (o) return useObject(game, o);

    return false;
  }

  function childLines(ch, game) {
    if (ch.stage === 1) return [
      '¡Papá! ¿Puedo dar de comer a las gallinas?',
      '¿Cuándo me dejas ordeñar a mí?',
      'He visto un corzo en el prado.',
      'Hoy la maestra nos ha hablado del pueblo.'
    ];
    return [
      'Padre, ya he regado el huerto.',
      'He echado pienso al ganado, no te preocupes.',
      'Cuando quieras me quedo yo con la cuadra.',
      'Este año la cosecha viene buena.'
    ];
  }

  function harvestAt(game, tx, ty) {
    var map = game.map();
    var s = map.soilAt(tx, ty);
    if (!s || !s.crop || s.dead) return false;
    var crop = D.CROPS[s.crop];
    var stage = D.cropStage(s.crop, s.grow);
    if (stage < 4) return false;
    var qty = M.rndInt(crop.yield[0], crop.yield[1]);
    if (game.player.energy < 1) { toast(game, 'Estás demasiado cansado.'); return true; }
    game.player.useEnergy(1);
    game.give(s.crop, qty);
    game.player.stats.cropsHarvested += qty;
    G.Audio.sfx('pick');
    game.fx.pop(tx * TILE + 8, ty * TILE + 4, Art.icon(s.crop, D.ITEMS[s.crop]));
    toast(game, '+' + qty + ' ' + D.ITEMS[s.crop].name, '#a8e07a');
    if (crop.regrow) {
      s.grow = Math.max(0, D.cropDays(s.crop) - crop.regrow);
      s.watered = false;
    } else {
      s.crop = null; s.grow = 0;
    }
    return true;
  }

  function petAnimal(game, a) {
    // Los huevos se recogen a mano; el resto es cariño.
    if (a.kind === 'chicken' && a.productReady) {
      a.productReady = false;
      game.give('huevo', 1);
      game.player.stats.eggsCollected++;
      G.Audio.sfx('pick');
      game.fx.pop(a.x, a.y - 10, Art.icon('huevo', D.ITEMS.huevo));
      toast(game, '+1 huevo de ' + a.name, '#f6efe0');
      a.happy = M.clamp(a.happy + 2, 0, 100);
      return;
    }
    if (!a.pet) {
      a.pet = true;
      a.happy = M.clamp(a.happy + 8, 0, 100);
      game.fx.heart(a.x, a.y - 14);
      G.Audio.sfx(a.def.sound);
      toast(game, 'Acaricias a ' + a.name + '.', '#f0a8b8');
    } else {
      var extra = a.productReady && a.def.productTool === 'cubo' ? ' Tiene la ubre llena: usa el cubo.' : '';
      game.ui.dialog(a.name, a.def.name + '. ' + humor(a) + extra);
    }
  }
  function humor(a) {
    if (a.happy > 80) return 'Está contentísima.';
    if (a.happy > 55) return 'Está a gusto.';
    if (a.happy > 30) return 'Anda regular, dale de comer.';
    return 'Está triste y con hambre.';
  }

  function useObject(game, o) {
    switch (o.interact) {
      case 'bed': return game.trySleep();
      case 'well':
        game.player.wateringLevel = game.player.wateringMax;
        G.Audio.sfx('water');
        toast(game, 'Llenas la regadera en el pozo.', '#8fc8e8');
        return true;
      case 'trough': return feedTrough(game);
      case 'haystack':
        if (game.player.countItem('heno') >= 8) { toast(game, 'Ya llevas heno de sobra.'); return true; }
        game.give('heno', 2);
        G.Audio.sfx('pick');
        toast(game, '+2 heno', '#e0c274');
        return true;
      case 'shop': game.openShop(o.shop); return true;
      case 'ship': game.openShip(); return true;
      case 'chest': game.openShip(); return true;
      case 'stove': game.openKitchen(); return true;
      case 'sign': game.ui.dialog('Cartel', o.text); return true;
      case 'rock':
        toast(game, 'Una piedra. Con la pala la sacarías.');
        return true;
      case 'flower':
        W.removeObj(game.map(), o);
        game.give('flor', 1);
        G.Audio.sfx('pick');
        toast(game, '+1 flor silvestre', '#f07aa8');
        return true;
    }
    return false;
  }

  function feedTrough(game) {
    var p = game.player;
    var feed = p.countItem('heno') > 0 ? 'heno' : (p.countItem('pienso') > 0 ? 'pienso' : (p.countItem('grano') > 0 ? 'grano' : null));
    if (!feed) { toast(game, 'No llevas pienso ni heno.', '#e0b47a'); return true; }
    var fed = 0;
    for (var i = 0; i < game.animals.length; i++) {
      var a = game.animals[i];
      if (a.map !== p.map && !(p.map === 'valle' && a.map === 'valle')) continue;
      if (a.fed) continue;
      if (a.def.feed.indexOf(feed) < 0 && feed !== 'pienso') continue;
      if (p.countItem(feed) <= 0) break;
      p.removeItem(feed, 1);
      a.fed = true;
      a.happy = M.clamp(a.happy + 5, 0, 100);
      fed++;
    }
    game.syncHotbar();
    if (fed === 0) { toast(game, 'Los animales de aquí ya están comidos.'); }
    else {
      G.Audio.sfx('ok');
      toast(game, 'Das de comer a ' + fed + ' animal' + (fed > 1 ? 'es' : '') + '.', '#e0c274');
      game.fx.puff(p.x, p.y - 8, '#e0c274', 8);
    }
    return true;
  }

  /* ==================================================== RELACIONES / NPCS = */
  function talkTo(game, n) {
    var p = game.player;
    // Regalo: si la ranura activa tiene un objeto regalable
    var slotItem = p.currentTool();

    if (!n.talkedToday) {
      n.talkedToday = true;
      var up = n.addPoints(20);
      if (up) { G.Audio.sfx('heart'); game.fx.heart(n.x, n.y - 22); }
    }
    var line = n.line(game.clock);

    // Propuestas de noviazgo/boda si llevas ramo o anillo en la mano
    if (slotItem === 'ramo' && n.def.romance && p.countItem('ramo') > 0) return propose(game, n, 'ramo');
    if (slotItem === 'anillo' && n.def.romance && p.countItem('anillo') > 0) return propose(game, n, 'anillo');

    var title = n.name + '  ' + hearts(n.hearts);
    game.ui.dialog(title, line, n);
    G.Audio.sfx('talk');
    return true;
  }

  function hearts(h) {
    var s = '';
    for (var i = 0; i < 10; i++) s += (i < h ? '♥' : '·');
    return s;
  }

  function giveGift(game, n, itemId) {
    var p = game.player;
    if (n.giftedToday) {
      game.ui.dialog(n.name, 'Ya me has dado algo hoy, ¡no te arruines!');
      return true;
    }
    var def = D.ITEMS[itemId];
    var pts = 12;
    var reply = 'Vaya, gracias, Arricio.';
    if (n.def.loves && n.def.loves.indexOf(itemId) >= 0) { pts = 70; reply = '¡Justo lo que más me gusta! Muchísimas gracias.'; }
    else if (n.def.likes && n.def.likes.indexOf(itemId) >= 0) { pts = 40; reply = '¡Qué detalle! Me encanta.'; }
    else if (def.type === 'material' && itemId === 'piedra') { pts = -5; reply = '¿Una piedra? Anda, guárdala.'; }

    p.removeItem(itemId, 1);
    game.syncHotbar();
    n.giftedToday = true;
    var up = n.addPoints(pts);
    G.Audio.sfx(pts > 0 ? 'heart' : 'no');
    if (pts > 0) game.fx.heart(n.x, n.y - 22);
    if (up) { G.Audio.sfx('levelup'); toast(game, '¡' + n.name + ' te aprecia más! (' + n.hearts + '♥)', '#f0a8b8'); }
    game.ui.dialog(n.name + '  ' + hearts(n.hearts), reply, n);
    return true;
  }

  function propose(game, n, what) {
    var p = game.player;
    if (what === 'ramo') {
      if (p.partner || p.spouse) {
        game.ui.dialog(n.name, 'Arricio… tú ya tienes a alguien. No está bien.');
        return true;
      }
      if (n.hearts < 8) {
        game.ui.dialog(n.name, 'Es un detalle precioso… pero aún nos conocemos poco. (Necesitas 8 ♥)');
        return true;
      }
      p.removeItem('ramo', 1);
      game.syncHotbar();
      n.dating = true;
      p.partner = n.id;
      n.addPoints(120);
      G.Audio.sfx('levelup');
      game.fx.hearts(n.x, n.y - 20, 10);
      game.ui.dialog('¡' + n.name + ' acepta!', 'Sí quiero salir contigo, Arricio. Todo el pueblo va a hablar de esto.', n);
      game.flags.dating = n.id;
      return true;
    }
    // Anillo
    if (p.spouse) { game.ui.dialog(n.name, 'Pero si ya estás casado, hombre.'); return true; }
    if (p.partner !== n.id) {
      game.ui.dialog(n.name, 'Primero habría que ser novios, ¿no te parece? (Regálame un ramo de flores)');
      return true;
    }
    if (n.hearts < 10) {
      game.ui.dialog(n.name, 'Casarnos es mucha palabra todavía… (Necesitas 10 ♥)');
      return true;
    }
    p.removeItem('anillo', 1);
    game.syncHotbar();
    n.married = true;
    p.spouse = n.id;
    p.partner = n.id;
    game.flags.married = n.id;
    game.flags.weddingDay = game.clock.dayCount;
    G.Audio.sfx('levelup');
    game.fx.hearts(n.x, n.y - 20, 24);
    game.ui.dialog('¡Boda en Sorríos!', 'Don Casimiro os casa en San Roque y el pueblo entero baja a la plaza. ' +
      n.name + ' se viene a vivir contigo a la granja.', n);
    n.updateSchedule(game.clock, game.maps, true);
    return true;
  }

  /* ================================================== COMPRAR Y VENDER === */
  function buy(game, itemId, qty) {
    qty = qty || 1;
    var def = D.ITEMS[itemId];
    var price = def.buy;
    if (!price) { toast(game, 'Eso no está en venta.'); return false; }
    var total = price * qty;
    if (game.player.money < total) { toast(game, 'No te llega el dinero.', '#e08a8a'); G.Audio.sfx('no'); return false; }
    if (def.type === 'tool') {
      if (game.player.hasTool(itemId)) { toast(game, 'Ya tienes esa herramienta.'); return false; }
      game.player.spend(total);
      game.player.hotbar.push(itemId);
      G.Audio.sfx('coin');
      toast(game, 'Compras: ' + def.name, '#f2d96a');
      return true;
    }
    if (!game.player.addItem(itemId, qty)) { toast(game, 'La mochila está llena.', '#e0b47a'); return false; }
    game.player.spend(total);
    G.Audio.sfx('coin');
    game.syncHotbar();
    return true;
  }

  // Compra de ganado en el almacén de Bernardo.
  var LIVESTOCK = ['cow', 'sheep', 'lamb', 'chicken', 'chick', 'donkey'];
  function buyAnimal(game, kind) {
    var def = D.ANIMALS[kind];
    var same = game.animals.filter(function (a) { return a.def.house === def.house; }).length;
    var limit = def.house === 'gallinero' ? 12 : 14;
    if (same >= limit) {
      toast(game, def.house === 'gallinero' ? 'El gallinero está lleno.' : 'La cuadra está llena.', '#e0b47a');
      G.Audio.sfx('no');
      return false;
    }
    if (kind === 'donkey' && game.hasDonkey) {
      toast(game, 'Con un burro te sobra, Arricio.');
      return false;
    }
    if (game.player.money < def.price) {
      toast(game, 'No te llega el dinero.', '#e08a8a');
      G.Audio.sfx('no');
      return false;
    }
    game.player.spend(def.price);
    var a = game.addAnimal(kind);
    a.fed = true;
    G.Audio.sfx('levelup');
    G.Audio.sfx(def.sound);
    toast(game, '¡' + def.name + ' nueva: ' + a.name + '! Está en ' +
      (def.house === 'gallinero' ? 'el gallinero' : 'la cuadra') + '.', '#a8e07a');
    return true;
  }

  function sell(game, itemId, qty) {
    var def = D.ITEMS[itemId];
    if (!def || !def.sell) { toast(game, 'Eso no lo compran.'); return false; }
    var have = game.player.countItem(itemId);
    qty = Math.min(qty || 1, have);
    if (qty <= 0) return false;
    game.player.removeItem(itemId, qty);
    game.player.earn(def.sell * qty);
    G.Audio.sfx('coin');
    game.syncHotbar();
    return true;
  }

  /* ========================================================== COCINA ===== */
  var RECIPES = [
    { id: 'queso', name: 'Queso de la casa', need: [['leche', 2]], out: ['queso', 1] },
    { id: 'queso_oveja', name: 'Queso de oveja', need: [['leche_oveja', 2]], out: ['queso', 1] },
    { id: 'manteca', name: 'Manteca', need: [['leche', 1], ['lena', 1]], out: ['manteca', 1] },
    { id: 'tortilla', name: 'Tortilla de patata', need: [['huevo', 2], ['patata', 2]], out: ['tortilla', 1] },
    { id: 'sopa', name: 'Sopa de ajo', need: [['ajo', 1], ['pan', 1]], out: ['sopa', 1] },
    { id: 'cocido', name: 'Cocido maragato', need: [['garbanzo', 2], ['chorizo', 1], ['berza', 1]], out: ['cocido', 1] },
    { id: 'empanada', name: 'Empanada', need: [['trigo', 2], ['cebolla', 1], ['pimiento', 1]], out: ['empanada', 1] }
  ];
  function canCook(game, r) {
    for (var i = 0; i < r.need.length; i++)
      if (game.player.countItem(r.need[i][0]) < r.need[i][1]) return false;
    return true;
  }
  function cook(game, r) {
    if (!canCook(game, r)) { toast(game, 'Te faltan ingredientes.', '#e0b47a'); G.Audio.sfx('no'); return false; }
    for (var i = 0; i < r.need.length; i++) game.player.removeItem(r.need[i][0], r.need[i][1]);
    game.give(r.out[0], r.out[1]);
    G.Audio.sfx('levelup');
    toast(game, '¡Has cocinado ' + D.ITEMS[r.out[0]].name + '!', '#f2d96a');
    game.syncHotbar();
    return true;
  }

  function eat(game, itemId) {
    var def = D.ITEMS[itemId];
    if (!def || !def.energy) { toast(game, 'Eso no se come.'); return false; }
    if (game.player.countItem(itemId) <= 0) return false;
    game.player.removeItem(itemId, 1);
    game.player.restore(def.energy);
    G.Audio.sfx('ok');
    toast(game, '+' + def.energy + ' de energía', '#a8e07a');
    game.syncHotbar();
    return true;
  }

  /* ============================================================ NUEVO DÍA = */
  function newDay(game, collapsed) {
    var clock = game.clock;
    var prevSeason = clock.season;
    clock.nextDay();
    var p = game.player;
    p.stats.daysPlayed++;

    // Energía: dormir recupera todo; desmayarse, la mitad
    p.energy = collapsed ? Math.round(p.maxEnergy * 0.5) : p.maxEnergy;
    p.exhausted = false;
    p._warned = false;
    p.wateringLevel = p.wateringMax;

    var report = { events: [], season: clock.season, seasonChanged: prevSeason !== clock.season };

    // --- huerto ---
    var rained = clock.isRaining();
    var froze = clock.season === D.INVIERNO && !clock.isSnowing() && M.chance(0.0);
    for (var mid in game.maps) {
      var map = game.maps[mid];
      for (var k in map.soil) {
        var s = map.soil[k];
        if (rained) s.watered = true;
        if (s.crop) {
          var crop = D.CROPS[s.crop];
          if (crop.seasons.indexOf(clock.season) < 0 && report.seasonChanged) {
            s.dead = true; s.crop = s.crop; // se seca al cambiar de estación
          } else if (s.watered && !s.dead) {
            s.grow++;
          }
        }
        s.watered = rained ? true : false;
        map.set(s.x, s.y, W.T.SOIL, s.watered ? 1 : 0);
      }
    }
    if (report.seasonChanged) report.events.push('Cambia la estación: llega ' + D.SEASON_NAMES[clock.season] + '.');

    // --- animales ---
    var grew = 0, prod = 0;
    for (var i = 0; i < game.animals.length; i++) {
      var a = game.animals[i];
      if (a.newDay()) grew++;
      if (a.productReady) prod++;
      // En invierno o de noche los animales duermen dentro
      a.map = a.def.house === 'gallinero' ? 'gallinero' : 'cuadra';
    }
    if (grew) report.events.push('¡' + grew + ' cría' + (grew > 1 ? 's han' : ' ha') + ' crecido en la cuadra!');
    if (prod) report.events.push(prod + ' animal' + (prod > 1 ? 'es tienen' : ' tiene') + ' algo que darte.');

    // --- vecinos ---
    for (var j = 0; j < game.npcs.length; j++) {
      var n = game.npcs[j];
      n.giftedToday = false;
      n.talkedToday = false;
      if (!n.married && n.points > 0 && M.chance(0.25)) n.points = Math.max(0, n.points - 4); // se enfría poco a poco
      n.updateSchedule(clock, game.maps, true);
    }

    // --- hijos ---
    for (var c = 0; c < game.children.length; c++) {
      var ch = game.children[c];
      var st = ch.newDay();
      if (st === 1) report.events.push('¡' + ch.name + ' ya anda y corre por la granja!');
      if (st === 2) report.events.push('¡' + ch.name + ' se ha hecho mozo y ayuda en todo!');
      // Los hijos echan una mano
      if (ch.stage >= 1) helpFromChild(game, ch, report);
    }

    // --- la pareja ---
    if (p.spouse) {
      var sp = game.npc(p.spouse);
      if (sp) {
        if (M.chance(0.5)) {
          var gift = M.pick(['pan', 'cafe', 'sopa', 'tortilla']);
          if (p.addItem(gift, 1)) report.events.push(sp.name + ' te ha dejado ' + D.ITEMS[gift].name.toLowerCase() + ' para el día.');
        }
        // Nacimiento de un hijo
        var since = clock.dayCount - (game.flags.weddingDay || 0);
        if (since > 12 && game.children.length < 3 && M.chance(0.06)) {
          var kid = new G.Entities.Child(null, M.chance(0.5));
          kid.map = 'casa';
          game.children.push(kid);
          report.events.push('¡Ha nacido ' + kid.name + '! ' + sp.name + ' y tú ya sois familia.');
          report.baby = kid.name;
        }
      }
    }

    // --- avisos meteorológicos ---
    if (clock.weather === 'nieve') report.events.push('Ha nevado en Ordás. Los animales mejor dentro.');
    else if (clock.weather === 'tormenta') report.events.push('Tormenta. El huerto se riega solo… y truena.');
    else if (clock.weather === 'lluvia') report.events.push('Llueve: hoy no hace falta regar.');

    game.syncHotbar();
    return report;
  }

  function helpFromChild(game, ch, report) {
    var helped = 0;
    var map = game.maps.valle;
    for (var k in map.soil) {
      var s = map.soil[k];
      if (s.crop && !s.watered && !s.dead && helped < (ch.stage === 2 ? 10 : 4)) {
        s.watered = true; s.grow++; helped++;
        map.set(s.x, s.y, W.T.SOIL, 1);
      }
    }
    if (ch.stage === 2) {
      var fedN = 0;
      for (var i = 0; i < game.animals.length; i++) {
        if (!game.animals[i].fed) { game.animals[i].fed = true; fedN++; }
      }
      if (fedN) report.events.push(ch.name + ' ha dado de comer a ' + fedN + ' animales.');
    }
    if (helped) report.events.push(ch.name + ' ha regado ' + helped + ' parcelas del huerto.');
  }

  G.Systems = {
    Milking: Milking,
    useTool: useTool,
    interact: interact,
    newDay: newDay,
    buy: buy, sell: sell, buyAnimal: buyAnimal, LIVESTOCK: LIVESTOCK,
    eat: eat, cook: cook, canCook: canCook, RECIPES: RECIPES,
    hearts: hearts,
    animalNear: animalNear, npcNear: npcNear, objNear: objNear,
    harvestAt: harvestAt, giveGift: giveGift,
    talkTo: talkTo, propose: propose, petAnimal: petAnimal,
    feedTrough: feedTrough, useObject: useObject, plantSeed: plantSeed
  };

})(window);
