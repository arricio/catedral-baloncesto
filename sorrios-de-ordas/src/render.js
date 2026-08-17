/* ============================================================================
   SORRÍOS DE ORDÁS — render.js
   Cámara, pintado del mundo con ordenación por profundidad, iluminación por
   hora del día, farolas, y partículas de lluvia, nieve y efectos.
   ========================================================================== */
(function (global) {
  'use strict';
  var G = global.SORRIOS, M = G.M, Art = G.Art, W = G.World, D = G.DATA;
  var TILE = 16;

  /* ============================================================ PARTÍCULAS */
  function FX() { this.parts = []; this.pops = []; }
  FX.prototype.puff = function (x, y, color, n) {
    for (var i = 0; i < (n || 6); i++) {
      this.parts.push({
        x: x, y: y, vx: M.rndF(-24, 24), vy: M.rndF(-38, -6),
        g: 60, life: M.rndF(0.3, 0.7), max: 0.7, color: color, size: M.rndInt(1, 3)
      });
    }
  };
  FX.prototype.splash = function (x, y) {
    for (var i = 0; i < 9; i++) {
      this.parts.push({
        x: x, y: y, vx: M.rndF(-30, 30), vy: M.rndF(-50, -14),
        g: 130, life: M.rndF(0.25, 0.5), max: 0.5, color: '#8fc8e8', size: 1
      });
    }
  };
  FX.prototype.heart = function (x, y) {
    this.parts.push({ x: x, y: y, vx: M.rndF(-6, 6), vy: -22, g: 0, life: 1.1, max: 1.1, img: Art.fx.heart });
  };
  FX.prototype.hearts = function (x, y, n) {
    for (var i = 0; i < n; i++) {
      this.parts.push({
        x: x + M.rndF(-14, 14), y: y + M.rndF(-6, 6), vx: M.rndF(-16, 16), vy: M.rndF(-34, -14),
        g: 6, life: M.rndF(0.9, 1.8), max: 1.8, img: Art.fx.heart
      });
    }
  };
  FX.prototype.sparkle = function (x, y, n) {
    for (var i = 0; i < (n || 6); i++) {
      this.parts.push({
        x: x + M.rndF(-10, 10), y: y + M.rndF(-10, 10), vx: M.rndF(-8, 8), vy: M.rndF(-26, -8),
        g: 0, life: M.rndF(0.4, 0.9), max: 0.9, img: Art.fx.sparkle
      });
    }
  };
  FX.prototype.zzz = function (x, y) {
    this.parts.push({ x: x, y: y, vx: 8, vy: -16, g: 0, life: 1.4, max: 1.4, img: Art.fx.zzz });
  };
  FX.prototype.pop = function (x, y, img) {
    this.pops.push({ x: x, y: y, img: img, life: 1.1, max: 1.1 });
  };
  FX.prototype.update = function (dt) {
    for (var i = this.parts.length - 1; i >= 0; i--) {
      var p = this.parts[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt;
      p.life -= dt;
      if (p.life <= 0) this.parts.splice(i, 1);
    }
    for (var j = this.pops.length - 1; j >= 0; j--) {
      var q = this.pops[j];
      q.y -= 12 * dt; q.life -= dt;
      if (q.life <= 0) this.pops.splice(j, 1);
    }
  };
  FX.prototype.draw = function (ctx, cam) {
    for (var i = 0; i < this.parts.length; i++) {
      var p = this.parts[i];
      var a = M.clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      if (p.img) ctx.drawImage(p.img, Math.round(p.x - cam.x - p.img.width / 2), Math.round(p.y - cam.y - p.img.height / 2));
      else {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x - cam.x), Math.round(p.y - cam.y), p.size, p.size);
      }
    }
    for (var j = 0; j < this.pops.length; j++) {
      var q = this.pops[j];
      ctx.globalAlpha = M.clamp(q.life / q.max, 0, 1);
      ctx.drawImage(q.img, Math.round(q.x - cam.x - 8), Math.round(q.y - cam.y - 16));
    }
    ctx.globalAlpha = 1;
  };

  /* =============================================================== RENDER = */
  var Render = G.Render = {
    canvas: null, ctx: null, scale: 3, w: 420, h: 240,
    cam: { x: 0, y: 0 },
    light: null, lightCtx: null,
    weatherParts: [], flashT: 0,
    waterFrame: 0, waterT: 0,

    init: function (canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.ctx.imageSmoothingEnabled = false;
      this.light = Art.cv(8, 8);
      this.lightCtx = Art.ctxOf(this.light);
      this.resize();
      var self = this;
      window.addEventListener('resize', function () { self.resize(); });
      window.addEventListener('orientationchange', function () { setTimeout(function () { self.resize(); }, 250); });
      return this;
    },

    resize: function () {
      var cssW = Math.max(200, window.innerWidth);
      var cssH = Math.max(160, window.innerHeight);
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
      // Escala entera para que el pixel art quede nítido
      var s = Math.max(1, Math.min(8, Math.round(pw / 440)));
      var iw = Math.ceil(pw / s), ih = Math.ceil(ph / s);
      // Límites para que la vista no sea absurda en pantallas enormes
      if (iw > 620) { s = Math.max(1, Math.floor(pw / 620)); iw = Math.ceil(pw / s); ih = Math.ceil(ph / s); }
      this.scale = s; this.w = iw; this.h = ih;
      this.canvas.width = iw * s;
      this.canvas.height = ih * s;
      this.ctx.imageSmoothingEnabled = false;
      this.light.width = iw; this.light.height = ih;
      this.lightCtx = Art.ctxOf(this.light);
      this.weatherParts.length = 0;
    },

    beginFrame: function () {
      var ctx = this.ctx;
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      ctx.imageSmoothingEnabled = false;
    },

    updateCamera: function (game, dt) {
      var map = game.map();
      var tx = game.player.x - this.w / 2;
      var ty = game.player.y - this.h / 2 - 8;
      var maxX = Math.max(0, map.w * TILE - this.w);
      var maxY = Math.max(0, map.h * TILE - this.h);
      tx = M.clamp(tx, 0, maxX);
      ty = M.clamp(ty, 0, maxY);
      if (map.w * TILE < this.w) tx = (map.w * TILE - this.w) / 2;
      if (map.h * TILE < this.h) ty = (map.h * TILE - this.h) / 2;
      if (this.snap) { this.cam.x = tx; this.cam.y = ty; this.snap = false; }
      else {
        this.cam.x = M.damp(this.cam.x, tx, 9, dt);
        this.cam.y = M.damp(this.cam.y, ty, 9, dt);
      }
    },

    /* -------------------------------------------------------- suelo ----- */
    drawGround: function (game) {
      var ctx = this.ctx, map = game.map(), cam = this.cam;
      var season = game.clock.season, winter = season === 3 && !map.indoor;
      var t = Art.tiles;
      var x0 = Math.max(0, Math.floor(cam.x / TILE));
      var y0 = Math.max(0, Math.floor(cam.y / TILE));
      var x1 = Math.min(map.w - 1, Math.ceil((cam.x + this.w) / TILE));
      var y1 = Math.min(map.h - 1, Math.ceil((cam.y + this.h) / TILE));

      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          var i = y * map.w + x;
          var g = map.ground[i], v = map.variant[i];
          var img;
          switch (g) {
            case W.T.GRASS:  img = t.grass[season][v % 4]; break;
            case W.T.DIRT:   img = (winter ? t.dirtSnow : t.dirt)[v % 3]; break;
            case W.T.PATH:   img = (winter ? t.pathSnow : t.path)[v % 2]; break;
            case W.T.WATER:  img = t.water[this.waterFrame]; break;
            case W.T.SOIL:   img = (v ? t.soilWet : t.soil)[x % 2]; break;
            case W.T.WOOD:   img = t.wood[v % 2]; break;
            case W.T.STONE:  img = t.stone[v % 2]; break;
            case W.T.HAY:    img = t.hay[v % 2]; break;
            case W.T.RUG:    img = t.rug[0]; break;
            case W.T.BRIDGE: img = t.wood[(x + y) % 2]; break;
            default: img = t.grass[season][0];
          }
          ctx.drawImage(img, Math.round(x * TILE - cam.x), Math.round(y * TILE - cam.y));
        }
      }

      // Sombra bajo el borde del agua (da profundidad al río)
      if (!map.indoor) {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#0a1420';
        for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
          if (map.ground[yy * map.w + xx] === W.T.WATER && map.get(xx, yy - 1) !== W.T.WATER)
            ctx.fillRect(Math.round(xx * TILE - cam.x), Math.round(yy * TILE - cam.y), TILE, 3);
        }
        ctx.globalAlpha = 1;
      }

      // Paredes de los interiores
      if (map.indoor) this.drawWalls(game, map);
    },

    drawWalls: function (game, map) {
      var ctx = this.ctx, cam = this.cam;
      var wall = map.wallColor || '#c9b696';
      var wd = Art.shade(wall, -0.22), wl = Art.shade(wall, 0.14);
      var wpx = map.w * TILE;
      // banda de pared superior
      ctx.fillStyle = wall;
      ctx.fillRect(Math.round(-cam.x), Math.round(-cam.y), wpx, 2 * TILE);
      ctx.fillStyle = wl;
      ctx.fillRect(Math.round(-cam.x), Math.round(-cam.y), wpx, 4);
      ctx.fillStyle = wd;
      ctx.fillRect(Math.round(-cam.x), Math.round(2 * TILE - 6 - cam.y), wpx, 6);
      // zócalo de madera
      ctx.fillStyle = '#6b4728';
      ctx.fillRect(Math.round(-cam.x), Math.round(2 * TILE - 3 - cam.y), wpx, 3);
      // ventanucos
      for (var i = 1; i < map.w - 1; i += 4) {
        var wx = Math.round(i * TILE - cam.x), wy = Math.round(5 - cam.y);
        ctx.fillStyle = wd; ctx.fillRect(wx, wy, 20, 17);
        var night = game.clock.isNight();
        ctx.fillStyle = night ? '#1a2436' : '#8fc8e8';
        ctx.fillRect(wx + 2, wy + 2, 16, 13);
        ctx.fillStyle = night ? '#2a3446' : '#b8dcf0';
        ctx.fillRect(wx + 2, wy + 2, 16, 5);
        ctx.fillStyle = wd;
        ctx.fillRect(wx + 9, wy + 2, 2, 13);
        ctx.fillRect(wx + 2, wy + 8, 16, 2);
      }
      // bordes laterales
      ctx.fillStyle = wd;
      ctx.fillRect(Math.round(-cam.x), Math.round(-cam.y), TILE, map.h * TILE);
      ctx.fillRect(Math.round((map.w - 1) * TILE - cam.x), Math.round(-cam.y), TILE, map.h * TILE);
      ctx.fillRect(Math.round(-cam.x), Math.round((map.h - 1) * TILE - cam.y), map.w * TILE, TILE);
      // puerta
      var d = map.spots.door;
      if (d) {
        var dx = Math.round(d.x * TILE - cam.x), dy = Math.round(d.y * TILE - cam.y);
        ctx.fillStyle = '#4a3218'; ctx.fillRect(dx - 1, dy, TILE + 2, TILE);
        ctx.fillStyle = '#8a5f39'; ctx.fillRect(dx, dy + 1, TILE, TILE - 1);
        ctx.fillStyle = '#6b4728'; ctx.fillRect(dx + 7, dy + 1, 2, TILE - 1);
      }
    },

    /* ------------------------------------------------ objetos y entidades  */
    collectDrawables: function (game) {
      var list = [], map = game.map(), season = game.clock.season;
      var cam = this.cam, vx0 = cam.x - 48, vx1 = cam.x + this.w + 48;
      var vy0 = cam.y - 80, vy1 = cam.y + this.h + 64;

      for (var i = 0; i < map.objects.length; i++) {
        var o = map.objects[i];
        if (o.px > vx1 || o.py > vy1) continue;
        var img = o.img;
        if (!img && o.imgSet) {
          var set = Art.obj[o.imgSet];
          if (set) {
            var arr = Array.isArray(set[0]) || set[season] ? set[season] : set;
            img = arr[(o.tx + o.ty) % arr.length];
          }
        }
        if (!img) continue;
        if (o.px + img.width < vx0 || o.py + img.height < vy0) continue;
        list.push({ sortY: o.sortY, img: img, x: o.px, y: o.py, shake: o.shake, obj: o });
      }

      // Cultivos del huerto
      for (var k in map.soil) {
        var s = map.soil[k];
        if (!s.crop) continue;
        var cx = s.x * TILE, cy = s.y * TILE;
        if (cx > vx1 || cy > vy1 || cx < vx0 || cy < vy0) continue;
        var def = D.CROPS[s.crop];
        var sheet = Art.cropSheet(s.crop, def);
        var stage = D.cropStage(s.crop, s.grow);
        list.push({
          sortY: cy + TILE + 2, crop: true, sheet: sheet, stage: stage,
          x: cx, y: cy + TILE - 22, dead: s.dead
        });
      }

      // Animales
      for (var a = 0; a < game.animals.length; a++) {
        var an = game.animals[a];
        if (an.map !== map.id) continue;
        list.push({ sortY: an.y + 4, animal: an });
      }

      // Vecinos
      for (var n = 0; n < game.npcs.length; n++) {
        var np = game.npcs[n];
        if (np.map !== map.id) continue;
        list.push({ sortY: np.y + 2, npc: np });
      }

      // Hijos
      for (var c = 0; c < game.children.length; c++) {
        var ch = game.children[c];
        if (ch.map !== map.id || ch.stage === 0) continue;
        list.push({ sortY: ch.y + 2, child: ch });
      }

      // Arricio
      list.push({ sortY: game.player.y + 2, player: game.player });

      list.sort(function (p, q) { return p.sortY - q.sortY; });
      return list;
    },

    drawChar: function (sheet, x, y, dir, frame, cam, flip) {
      var fw = Art.CH_W, fh = Art.CH_H;
      var sx = frame * fw, sy = dir * fh;
      var dx = Math.round(x - cam.x - fw / 2), dy = Math.round(y - cam.y - fh + 4);
      var ctx = this.ctx;
      if (flip) {
        ctx.save();
        ctx.translate(dx + fw, dy);
        ctx.scale(-1, 1);
        ctx.drawImage(sheet, sx, sy, fw, fh, 0, 0, fw, fh);
        ctx.restore();
      } else {
        ctx.drawImage(sheet, sx, sy, fw, fh, dx, dy, fw, fh);
      }
    },

    drawEntities: function (game) {
      var ctx = this.ctx, cam = this.cam;
      var list = this.collectDrawables(game);
      for (var i = 0; i < list.length; i++) {
        var d = list[i];
        if (d.player) {
          var p = d.player;
          // La dirección 3 (derecha) se dibuja reflejando la 2 (izquierda)
          var dir = p.dir === 3 ? 2 : p.dir;
          this.drawChar(p.sheet(), p.x, p.y, dir, p.frame, cam, p.dir === 3);
          if (p.swing > 0) this.drawToolSwing(game, p);
        } else if (d.npc) {
          var n = d.npc;
          var nd = n.dir === 3 ? 2 : n.dir;
          this.drawChar(n.sheet(), n.x, n.y, nd, n.frame, cam, n.dir === 3);
        } else if (d.child) {
          var c = d.child;
          var cd = c.dir === 3 ? 2 : c.dir;
          this.drawChar(c.sheet(), c.x, c.y, cd, c.frame, cam, c.dir === 3);
        } else if (d.animal) {
          var a = d.animal;
          var sheet = a.sheet();
          var sz = a.size();
          var sx = a.frame * sz.w;
          var dx = Math.round(a.x - cam.x - sz.w / 2), dy = Math.round(a.y - cam.y - sz.h + 3);
          if (a.dir < 0) {
            ctx.save(); ctx.translate(dx + sz.w, dy); ctx.scale(-1, 1);
            ctx.drawImage(sheet, sx, 0, sz.w, sz.h, 0, 0, sz.w, sz.h);
            ctx.restore();
          } else ctx.drawImage(sheet, sx, 0, sz.w, sz.h, dx, dy, sz.w, sz.h);
          // Indicador de producto listo
          if (a.productReady && a.def.productTool === 'cubo') this.bubble(a.x, a.y - sz.h - 4, '#f6f2e8');
          else if (a.productReady && a.kind === 'chicken') this.bubble(a.x, a.y - sz.h - 2, '#f6efe0');
          if (a.extraReady) this.bubble(a.x + 8, a.y - sz.h - 4, '#f2eee4');
        } else if (d.crop) {
          var sw = 16;
          ctx.save();
          if (d.dead) ctx.globalAlpha = 0.75;
          ctx.drawImage(d.sheet, d.stage * sw, 0, sw, 22, Math.round(d.x - cam.x), Math.round(d.y - cam.y), sw, 22);
          if (d.dead) {
            ctx.globalAlpha = 0.5; ctx.fillStyle = '#6a5a3a';
            ctx.fillRect(Math.round(d.x - cam.x) + 4, Math.round(d.y - cam.y) + 10, 8, 10);
          }
          ctx.restore();
        } else {
          var ox = d.shake ? Math.round(Math.sin(d.shake * 60) * 2) : 0;
          ctx.drawImage(d.img, Math.round(d.x - cam.x) + ox, Math.round(d.y - cam.y));
        }
      }
      // decrementa el temblor de los árboles
      for (var j = 0; j < list.length; j++) if (list[j].obj && list[j].obj.shake) list[j].obj.shake = Math.max(0, list[j].obj.shake - 0.016);
    },

    bubble: function (x, y, color) {
      var ctx = this.ctx, cam = this.cam;
      var bx = Math.round(x - cam.x), by = Math.round(y - cam.y - 4 + Math.sin(Date.now() / 320) * 1.5);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(bx - 4, by - 4, 9, 9);
      ctx.fillStyle = color;
      ctx.fillRect(bx - 3, by - 3, 7, 7);
      ctx.fillStyle = 'rgba(255,255,255,.7)';
      ctx.fillRect(bx - 2, by - 2, 2, 2);
    },

    drawToolSwing: function (game, p) {
      var ctx = this.ctx, cam = this.cam;
      var tool = p.currentTool();
      var def = D.ITEMS[tool];
      if (!def) return;
      var icon = Art.icon(tool, def);
      var t = 1 - p.swing / 0.28;
      var ang = M.lerp(-0.9, 0.7, t);
      var dx = [0, 0, -1, 1][p.dir], dy = [1, -1, 0, 0][p.dir];
      var ox = p.x + dx * 9, oy = p.y - 12 + dy * 5;
      ctx.save();
      ctx.translate(Math.round(ox - cam.x), Math.round(oy - cam.y));
      ctx.rotate(ang * (p.dir === 2 ? -1 : 1));
      ctx.drawImage(icon, -8, -8);
      ctx.restore();
    },

    /* ----------------------------------------------------- iluminación --- */
    drawLighting: function (game) {
      var ctx = this.ctx, map = game.map(), clock = game.clock;
      var amb = clock.ambient();
      if (map.indoor) {
        // Dentro siempre hay algo de luz de hogar
        amb = [Math.max(amb[0], 0.62), Math.max(amb[1], 0.56), Math.max(amb[2], 0.52)];
      }
      var needLight = amb[0] < 0.99 || amb[1] < 0.99 || amb[2] < 0.99;
      if (!needLight) return;

      var lc = this.lightCtx;
      lc.setTransform(1, 0, 0, 1, 0, 0);
      lc.globalCompositeOperation = 'source-over';
      lc.fillStyle = 'rgb(' + Math.round(amb[0] * 255) + ',' + Math.round(amb[1] * 255) + ',' + Math.round(amb[2] * 255) + ')';
      lc.fillRect(0, 0, this.w, this.h);

      // Focos de luz: farolas, ventanas y el propio jugador de noche
      var dark = 1 - clock.daylight();
      if (dark > 0.05) {
        lc.globalCompositeOperation = 'lighter';
        var cam = this.cam;
        var sources = map.lightSources || [];
        for (var i = 0; i < sources.length; i++) {
          var s = sources[i];
          this.lightBlob(lc, s.x - cam.x, s.y - cam.y, s.r, dark * 0.9, '255,206,128');
        }
        if (!map.indoor) {
          // ventanas encendidas de las casas
          for (var j = 0; j < map.objects.length; j++) {
            var o = map.objects[j];
            if (o.kind !== 'building') continue;
            this.lightBlob(lc, o.px + o.img.width / 2 - cam.x, o.py + o.img.height * 0.70 - cam.y, 38, dark * 0.30, '255,200,120');
          }
        }
        this.lightBlob(lc, game.player.x - cam.x, game.player.y - 8 - cam.y, 46, dark * 0.42, '255,224,170');
        if (map.indoor) {
          for (var k = 0; k < map.objects.length; k++) {
            if (map.objects[k].kind === 'stove')
              this.lightBlob(lc, map.objects[k].px + 12 - cam.x, map.objects[k].py + 18 - cam.y, 56, 0.7, '255,180,90');
          }
        }
      }

      // Relámpago
      if (this.flashT > 0) {
        lc.globalCompositeOperation = 'lighter';
        lc.fillStyle = 'rgba(190,205,255,' + (this.flashT * 0.9).toFixed(3) + ')';
        lc.fillRect(0, 0, this.w, this.h);
      }

      ctx.save();
      ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
      ctx.globalCompositeOperation = 'multiply';
      ctx.drawImage(this.light, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    },

    lightBlob: function (lc, x, y, r, intensity, rgb) {
      if (x < -r || y < -r || x > this.w + r || y > this.h + r) return;
      var g = lc.createRadialGradient(x, y, 0, x, y, r);
      // Cúpulas suaves: si suman demasiado, la noche deja de parecer noche.
      g.addColorStop(0, 'rgba(' + rgb + ',' + (0.50 * intensity).toFixed(3) + ')');
      g.addColorStop(0.45, 'rgba(' + rgb + ',' + (0.20 * intensity).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(' + rgb + ',0)');
      lc.fillStyle = g;
      lc.fillRect(x - r, y - r, r * 2, r * 2);
    },

    /* --------------------------------------------------- meteorología ---- */
    updateWeather: function (game, dt) {
      var clock = game.clock, map = game.map();
      this.flashT = Math.max(0, this.flashT - dt * 2.2);
      var want = 0;
      if (!map.indoor) {
        if (clock.weather === 'lluvia') want = Math.round(this.w * this.h / 900);
        else if (clock.weather === 'tormenta') want = Math.round(this.w * this.h / 520);
        else if (clock.weather === 'nieve') want = Math.round(this.w * this.h / 1400);
      }
      var P = this.weatherParts;
      while (P.length < want) {
        P.push({
          x: Math.random() * this.w, y: Math.random() * this.h,
          v: clock.isSnowing() ? M.rndF(24, 46) : M.rndF(320, 460),
          drift: clock.isSnowing() ? M.rndF(-14, 14) : M.rndF(-40, -18),
          len: clock.isSnowing() ? 2 : M.rndInt(5, 9),
          ph: Math.random() * 6.28
        });
      }
      while (P.length > want) P.pop();
      var snow = clock.isSnowing();
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        p.y += p.v * dt;
        p.x += (snow ? Math.sin(p.ph + performance.now() / 900) * 12 : p.drift) * dt;
        if (p.y > this.h) { p.y = -4; p.x = Math.random() * this.w; }
        if (p.x < -8) p.x = this.w + 4;
        if (p.x > this.w + 8) p.x = -4;
      }
    },

    drawWeather: function (game) {
      var ctx = this.ctx, clock = game.clock;
      var P = this.weatherParts;
      if (!P.length) return;
      if (clock.isSnowing()) {
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        for (var i = 0; i < P.length; i++) ctx.fillRect(P[i].x | 0, P[i].y | 0, 2, 2);
      } else {
        ctx.strokeStyle = 'rgba(174,206,232,.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var j = 0; j < P.length; j++) {
          var p = P[j];
          ctx.moveTo(p.x | 0, p.y | 0);
          ctx.lineTo((p.x + p.drift * 0.02) | 0, (p.y + p.len) | 0);
        }
        ctx.stroke();
      }
      // Velo de niebla en tormenta
      if (clock.weather === 'tormenta') {
        ctx.fillStyle = 'rgba(40,50,70,.16)';
        ctx.fillRect(0, 0, this.w, this.h);
      }
    },

    lightning: function () { this.flashT = 1; },

    /* ---------------------------------------------------------- frame ---- */
    drawWorld: function (game, dt) {
      var ctx = this.ctx;
      this.waterT += dt;
      if (this.waterT > 0.22) { this.waterT = 0; this.waterFrame = (this.waterFrame + 1) % 4; }

      ctx.fillStyle = game.map().indoor ? '#241a12' : game.clock.skyColor();
      ctx.fillRect(0, 0, this.w, this.h);

      this.drawGround(game);
      this.drawEntities(game);
      game.fx.draw(ctx, this.cam);
      this.drawLighting(game);
      this.drawWeather(game);
    },

    FX: FX
  };

})(window);
