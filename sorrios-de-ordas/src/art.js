/* ============================================================================
   SORRÍOS DE ORDÁS — art.js
   Generación procedural de todo el arte del juego (pixel art) en canvas
   offscreen. No hay ni un solo fichero de imagen: tiles, edificios, personajes,
   animales, cultivos e iconos se dibujan por código al arrancar y se cachean.
   ========================================================================== */
(function (global) {
  'use strict';
  var G = global.SORRIOS, M = G.M;

  var TILE = 16;

  /* ------------------------------------------------------------ helpers -- */
  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    return c;
  }
  function ctxOf(c) { var x = c.getContext('2d'); x.imageSmoothingEnabled = false; return x; }
  function px(x, cx, cy, w, h, col) { x.fillStyle = col; x.fillRect(cx | 0, cy | 0, w | 0, h | 0); }

  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb2hex(r, g, b) {
    return '#' + ((1 << 24) + (Math.round(M.clamp(r, 0, 255)) << 16) +
      (Math.round(M.clamp(g, 0, 255)) << 8) + Math.round(M.clamp(b, 0, 255))).toString(16).slice(1);
  }
  // amt > 0 aclara, amt < 0 oscurece
  function shade(hex, amt) {
    var c = hex2rgb(hex);
    if (amt >= 0) return rgb2hex(c[0] + (255 - c[0]) * amt, c[1] + (255 - c[1]) * amt, c[2] + (255 - c[2]) * amt);
    return rgb2hex(c[0] * (1 + amt), c[1] * (1 + amt), c[2] * (1 + amt));
  }
  function mix(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(M.lerp(A[0], B[0], t), M.lerp(A[1], B[1], t), M.lerp(A[2], B[2], t));
  }

  // Elipse rellena en píxeles enteros (sin antialias).
  function ellipse(x, cx, cy, rx, ry, col) {
    x.fillStyle = col;
    for (var y = -ry; y <= ry; y++) {
      var w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (w <= 0) continue;
      x.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2, 1);
    }
  }
  function circle(x, cx, cy, r, col) { ellipse(x, cx, cy, r, r, col); }

  function outlineDark(c, alpha) {
    // Contorno suave: copia oscurecida desplazada bajo el dibujo original.
    var w = c.width, h = c.height;
    var t = cv(w, h), tx = ctxOf(t);
    tx.drawImage(c, 0, 0);
    tx.globalCompositeOperation = 'source-in';
    tx.fillStyle = 'rgba(0,0,0,' + (alpha || 0.35) + ')';
    tx.fillRect(0, 0, w, h);
    var out = cv(w, h), ox = ctxOf(out);
    ox.drawImage(t, 0, 1);
    ox.drawImage(c, 0, 0);
    return out;
  }

  function tintCopy(c, color, alpha) {
    var t = cv(c.width, c.height), x = ctxOf(t);
    x.drawImage(c, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.globalAlpha = alpha;
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    return t;
  }

  /* ------------------------------------------------------------ paletas -- */
  var PAL = {
    // Hierba por estación: [base, oscuro, claro, mata]
    grass: [
      ['#5f9e3f', '#4d8433', '#79b854', '#8fc861'], // primavera
      ['#57943a', '#457a2f', '#71b04d', '#86bf58'], // verano
      ['#8a9440', '#6f7a34', '#a8ae55', '#c2b25a'], // otoño
      ['#d8e2e8', '#bcc9d2', '#f0f6fa', '#cfdbe4']  // invierno
    ],
    dirt: '#7a5a3a', dirtD: '#634631', dirtL: '#8f6c47',
    soil: '#5b4029', soilD: '#452f1e', soilWet: '#3b2817', soilWetD: '#2b1c10',
    stone: '#9a9287', stoneD: '#7c7469', stoneL: '#b5ada1',
    wood: '#8a5f39', woodD: '#6b4728', woodL: '#a67a4b',
    water: '#3f7fa8', waterD: '#2f6386', waterL: '#63a4c9',
    roof: '#a8442f', roofD: '#7f3122', roofL: '#c65b40',
    wall: '#c9b696', wallD: '#a3906f', wallL: '#e0d0b2',
    snow: '#eef4f8', snowD: '#cfdbe6'
  };

  var SEASON_TREE = [
    { leaf: '#4f9a3c', leaf2: '#3d7c2e', leaf3: '#6fb954', extra: '#f3b7d0' }, // primavera con flor
    { leaf: '#3f8a2f', leaf2: '#316f25', leaf3: '#5aa844', extra: null },
    { leaf: '#c07a22', leaf2: '#96581a', leaf3: '#dda94a', extra: '#e0663a' },
    { leaf: null, leaf2: null, leaf3: null, extra: '#eef4f8' }
  ];

  /* ============================================================== tiles == */
  function makeGrass(season, variant, seed) {
    var c = cv(TILE, TILE), x = ctxOf(c), rnd = G.RNG(seed);
    var p = PAL.grass[season];
    px(x, 0, 0, TILE, TILE, p[0]);
    // Textura: manchas de tono
    for (var i = 0; i < 26; i++) {
      var a = rnd(), col = a < 0.5 ? p[1] : p[2];
      px(x, rnd.int(0, 15), rnd.int(0, 15), 1, 1, col);
    }
    if (variant === 1) { // matas de hierba
      for (var j = 0; j < 4; j++) {
        var bx = rnd.int(2, 12), by = rnd.int(3, 12);
        px(x, bx, by, 1, 3, p[3]); px(x, bx + 1, by + 1, 1, 2, p[3]);
        px(x, bx - 1, by + 1, 1, 2, p[1]);
      }
    } else if (variant === 2) { // florecillas / detalle estacional
      var fcol = season === 0 ? '#f2e6a0' : season === 1 ? '#ffffff' : season === 2 ? '#d9a24a' : '#dbe7f0';
      for (var k = 0; k < 3; k++) {
        var fx = rnd.int(2, 13), fy = rnd.int(2, 13);
        px(x, fx, fy, 1, 1, fcol); px(x, fx + 1, fy + 1, 1, 1, fcol);
        px(x, fx, fy + 1, 1, 1, p[1]);
      }
    } else if (variant === 3) { // piedrecillas
      for (var s = 0; s < 3; s++) {
        var sx = rnd.int(1, 13), sy = rnd.int(1, 13);
        px(x, sx, sy, 2, 1, PAL.stone); px(x, sx, sy + 1, 2, 1, PAL.stoneD);
      }
    }
    return c;
  }

  function makeDirt(seed, snowy) {
    var c = cv(TILE, TILE), x = ctxOf(c), rnd = G.RNG(seed);
    px(x, 0, 0, TILE, TILE, snowy ? mix(PAL.dirt, PAL.snow, 0.55) : PAL.dirt);
    for (var i = 0; i < 30; i++)
      px(x, rnd.int(0, 15), rnd.int(0, 15), 1, 1, rnd() < 0.5 ?
        (snowy ? mix(PAL.dirtD, PAL.snow, 0.5) : PAL.dirtD) :
        (snowy ? PAL.snow : PAL.dirtL));
    return c;
  }

  function makePath(seed, snowy) {
    var c = cv(TILE, TILE), x = ctxOf(c), rnd = G.RNG(seed);
    var base = snowy ? mix('#a89f92', PAL.snow, 0.6) : '#a89f92';
    px(x, 0, 0, TILE, TILE, base);
    // Empedrado irregular
    for (var gy = 0; gy < 4; gy++) {
      for (var gx = 0; gx < 4; gx++) {
        var w = 3 + rnd.int(0, 1), h = 3 + rnd.int(0, 1);
        var ox = gx * 4 + rnd.int(0, 1), oy = gy * 4 + rnd.int(0, 1);
        var tone = rnd();
        var col = tone < 0.35 ? shade(base, -0.12) : (tone < 0.7 ? shade(base, 0.08) : shade(base, -0.04));
        px(x, ox, oy, w, h, col);
        px(x, ox, oy + h - 1, w, 1, shade(col, -0.18));
      }
    }
    return c;
  }

  function makeSoil(wet, seed) {
    var c = cv(TILE, TILE), x = ctxOf(c), rnd = G.RNG(seed);
    px(x, 0, 0, TILE, TILE, wet ? PAL.soilWet : PAL.soil);
    // Surcos de azada
    for (var r = 0; r < 4; r++) {
      var y = r * 4 + 1;
      px(x, 0, y, TILE, 2, wet ? PAL.soilWetD : PAL.soilD);
      px(x, 0, y + 2, TILE, 1, shade(wet ? PAL.soilWet : PAL.soil, 0.12));
    }
    for (var i = 0; i < 12; i++) px(x, rnd.int(0, 15), rnd.int(0, 15), 1, 1,
      shade(wet ? PAL.soilWet : PAL.soil, rnd() < 0.5 ? -0.2 : 0.15));
    return c;
  }

  function makeWater(frame) {
    var c = cv(TILE, TILE), x = ctxOf(c), rnd = G.RNG(77 + frame);
    px(x, 0, 0, TILE, TILE, PAL.water);
    for (var i = 0; i < 18; i++) px(x, rnd.int(0, 15), rnd.int(0, 15), 1, 1, PAL.waterD);
    // Brillos animados
    for (var r = 0; r < 3; r++) {
      var y = ((r * 5 + frame * 2) % 16);
      var xs = ((r * 7 + frame * 3) % 12);
      px(x, xs, y, 3, 1, PAL.waterL);
      px(x, xs + 5, (y + 3) % 16, 2, 1, shade(PAL.waterL, 0.2));
    }
    return c;
  }

  function makeFloor(kind, seed) {
    var c = cv(TILE, TILE), x = ctxOf(c), rnd = G.RNG(seed);
    if (kind === 'wood') {
      px(x, 0, 0, TILE, TILE, PAL.wood);
      for (var r = 0; r < 4; r++) {
        px(x, 0, r * 4 + 3, TILE, 1, PAL.woodD);
        for (var i = 0; i < 5; i++) px(x, rnd.int(0, 15), r * 4 + rnd.int(0, 2), rnd.int(1, 3), 1, PAL.woodL);
      }
      px(x, 8, 0, 1, 3, PAL.woodD); px(x, 4, 4, 1, 3, PAL.woodD); px(x, 12, 8, 1, 3, PAL.woodD);
    } else if (kind === 'stone') {
      px(x, 0, 0, TILE, TILE, '#b3aa9d');
      for (var gy = 0; gy < 2; gy++) for (var gx = 0; gx < 2; gx++) {
        var col = shade('#b3aa9d', (gx + gy) % 2 ? -0.08 : 0.06);
        px(x, gx * 8, gy * 8, 8, 8, col);
        px(x, gx * 8, gy * 8 + 7, 8, 1, shade(col, -0.2));
        px(x, gx * 8 + 7, gy * 8, 1, 8, shade(col, -0.2));
      }
    } else if (kind === 'hay') {
      px(x, 0, 0, TILE, TILE, '#c9a95c');
      for (var s = 0; s < 40; s++) {
        var sx = rnd.int(0, 14), sy = rnd.int(0, 15);
        px(x, sx, sy, rnd.int(2, 4), 1, rnd() < 0.5 ? '#e0c274' : '#a88a45');
      }
    } else if (kind === 'rug') {
      px(x, 0, 0, TILE, TILE, '#8f3b3b');
      px(x, 1, 1, 14, 14, '#a84a45');
      px(x, 3, 3, 10, 10, '#c46a55');
      px(x, 6, 6, 4, 4, '#e0a05a');
    }
    return c;
  }

  /* ============================================================ objetos == */
  function makeTree(kind, season, seed) {
    var rnd = G.RNG(seed);
    var w = 40, h = 52;
    var c = cv(w, h), x = ctxOf(c);
    var st = SEASON_TREE[season];
    var trunk = kind === 'pine' ? '#5b4227' : '#6b4a2c';
    // Tronco
    px(x, w / 2 - 3, h - 18, 6, 18, trunk);
    px(x, w / 2 - 3, h - 18, 2, 18, shade(trunk, 0.15));
    px(x, w / 2 + 1, h - 18, 2, 18, shade(trunk, -0.2));
    px(x, w / 2 - 5, h - 4, 10, 4, shade(trunk, -0.28));

    if (kind === 'pine') {
      var pc = season === 3 ? '#2f5c3a' : '#2f6b39';
      for (var t = 0; t < 4; t++) {
        var ty = 6 + t * 9, rw = 8 + t * 5;
        for (var yy = 0; yy < 12; yy++) {
          var ww = Math.round(rw * (yy / 12));
          px(x, w / 2 - ww, ty + yy, ww * 2, 1, yy < 3 ? shade(pc, 0.18) : (yy > 8 ? shade(pc, -0.2) : pc));
        }
      }
      if (season === 3) for (var s = 0; s < 30; s++) px(x, rnd.int(6, 33), rnd.int(6, 40), 2, 1, PAL.snow);
    } else if (season === 3) {
      // Árbol desnudo con nieve en las ramas
      for (var b = 0; b < 7; b++) {
        var ang = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
        var len = 10 + rnd() * 9;
        var bx = w / 2, by = h - 16;
        for (var i = 0; i < len; i++) {
          px(x, bx + Math.cos(ang) * i, by + Math.sin(ang) * i - i * 0.3, 2, 2, trunk);
        }
        px(x, bx + Math.cos(ang) * len, by + Math.sin(ang) * len - len * 0.3, 3, 1, PAL.snow);
      }
    } else {
      // Copa: cúmulo de elipses con volumen
      var blobs = [[0, 16, 15, 12], [-10, 22, 10, 8], [10, 22, 10, 8], [-6, 12, 9, 7], [7, 13, 9, 7]];
      for (var i2 = 0; i2 < blobs.length; i2++) {
        var b2 = blobs[i2];
        ellipse(x, w / 2 + b2[0], b2[1], b2[2], b2[3], st.leaf2);
        ellipse(x, w / 2 + b2[0], b2[1] - 1, b2[2] - 1, b2[3] - 1, st.leaf);
        ellipse(x, w / 2 + b2[0] - 2, b2[1] - 3, Math.max(2, b2[2] - 5), Math.max(2, b2[3] - 4), st.leaf3);
      }
      // Detalle: flores en primavera, frutos en otoño
      if (st.extra) {
        for (var f = 0; f < 22; f++) {
          var fx = rnd.int(6, w - 7), fy = rnd.int(6, 30);
          if (M.dist(fx, fy, w / 2, 18) < 16) px(x, fx, fy, 2, 2, st.extra);
        }
      }
      if (kind === 'apple' && season !== 3) {
        for (var a = 0; a < 6; a++) {
          var ax = rnd.int(8, w - 9), ay = rnd.int(10, 30);
          if (M.dist(ax, ay, w / 2, 18) < 15) { circle(x, ax, ay, 2, '#d0342c'); px(x, ax - 1, ay - 1, 1, 1, '#f07a6a'); }
        }
      }
    }
    return outlineDark(c, 0.28);
  }

  function makeBush(season, seed) {
    var c = cv(20, 18), x = ctxOf(c), rnd = G.RNG(seed);
    var st = SEASON_TREE[season];
    var col = st.leaf || '#7d8a76', col2 = st.leaf2 || '#5f6a5a', col3 = st.leaf3 || '#98a390';
    if (season === 3) { col = '#7d8a76'; col2 = '#5f6a5a'; col3 = PAL.snow; }
    ellipse(x, 10, 11, 9, 6, col2);
    ellipse(x, 8, 9, 7, 5, col);
    ellipse(x, 13, 10, 6, 4, col);
    ellipse(x, 8, 7, 4, 2, col3);
    if (season === 1) for (var i = 0; i < 5; i++) { var bx = rnd.int(4, 15), by = rnd.int(6, 13); px(x, bx, by, 2, 2, '#c0304a'); }
    return outlineDark(c, 0.25);
  }

  function makeRock(seed) {
    var c = cv(18, 16), x = ctxOf(c), rnd = G.RNG(seed);
    ellipse(x, 9, 10, 8, 5, PAL.stoneD);
    ellipse(x, 9, 8, 7, 4, PAL.stone);
    ellipse(x, 7, 6, 4, 2, PAL.stoneL);
    for (var i = 0; i < 6; i++) px(x, rnd.int(3, 14), rnd.int(5, 12), 1, 1, shade(PAL.stone, -0.25));
    return outlineDark(c, 0.3);
  }

  function makeFence(kind) {
    var c = cv(TILE, 20), x = ctxOf(c);
    var w = PAL.wood, wd = PAL.woodD, wl = PAL.woodL;
    if (kind === 'h') {
      px(x, 0, 8, TILE, 3, w); px(x, 0, 11, TILE, 1, wd);
      px(x, 0, 13, TILE, 3, w); px(x, 0, 16, TILE, 1, wd);
      px(x, 6, 4, 4, 16, w); px(x, 6, 4, 1, 16, wl); px(x, 9, 4, 1, 16, wd);
      px(x, 6, 4, 4, 1, wl);
    } else if (kind === 'v') {
      // Dos largueros continuos en vertical + poste cada dos tramos
      px(x, 4, 0, 3, 20, w); px(x, 4, 0, 1, 20, wl); px(x, 6, 0, 1, 20, wd);
      px(x, 10, 0, 3, 20, w); px(x, 10, 0, 1, 20, wl); px(x, 12, 0, 1, 20, wd);
      px(x, 2, 6, 13, 4, w); px(x, 2, 6, 13, 1, wl); px(x, 2, 9, 13, 1, wd);
    } else if (kind === 'gate') {
      px(x, 1, 6, 14, 3, wl); px(x, 1, 13, 14, 3, wl);
      px(x, 1, 6, 3, 12, w); px(x, 12, 6, 3, 12, w);
      px(x, 2, 8, 12, 2, shade(wl, -0.1));
    }
    return outlineDark(c, 0.25);
  }

  function makeBuilding(o) {
    // o: {tw, th, wall, roof, doorX, windows, style, sign}
    var tw = o.tw, th = o.th;
    var w = tw * TILE, h = th * TILE;
    var c = cv(w, h + 8), x = ctxOf(c);
    var wallH = Math.round(h * 0.55), roofH = h - wallH;
    var wall = o.wall || PAL.wall, roof = o.roof || PAL.roof;
    var wy = roofH;

    // Cuerpo de muro
    px(x, 2, wy, w - 4, wallH, wall);
    px(x, 2, wy, 2, wallH, shade(wall, 0.14));
    px(x, w - 4, wy, 2, wallH, shade(wall, -0.16));
    px(x, 2, wy + wallH - 3, w - 4, 3, shade(wall, -0.24));

    // Mampostería (estilo leonés: piedra vista)
    var rnd = G.RNG(o.seed || 5);
    if (o.style === 'stone') {
      for (var sy = wy + 2; sy < wy + wallH - 3; sy += 5) {
        for (var sx = 3; sx < w - 6; sx += 7) {
          var ox = sx + rnd.int(0, 2);
          var col = shade(wall, rnd() < 0.5 ? -0.1 : 0.08);
          px(x, ox, sy, 6, 4, col);
          px(x, ox, sy + 3, 6, 1, shade(col, -0.2));
        }
      }
    } else {
      for (var i = 0; i < w * 2; i++) px(x, rnd.int(3, w - 5), rnd.int(wy + 1, wy + wallH - 2), 1, 1, shade(wall, rnd() < .5 ? -0.08 : 0.08));
    }

    // Tejado de teja curva
    for (var ry = 0; ry < roofH; ry++) {
      var t = ry / roofH;
      var inset = Math.round((1 - t) * (w * 0.16));
      var col2 = mix(shade(roof, 0.18), shade(roof, -0.14), t);
      px(x, inset, ry, w - inset * 2, 1, col2);
    }
    // Alero y canalones de teja
    px(x, 0, roofH - 3, w, 3, shade(roof, -0.3));
    for (var tx = 1; tx < w; tx += 5) px(x, tx, 1, 1, roofH - 3, shade(roof, -0.22));
    px(x, 0, roofH - 6, w, 1, shade(roof, 0.22));

    // Chimenea
    if (o.chimney !== false) {
      var chx = Math.round(w * 0.72);
      px(x, chx, 0, 8, roofH - 2, shade(wall, -0.18));
      px(x, chx, 0, 8, 3, shade(wall, -0.34));
      px(x, chx + 1, 3, 6, roofH - 6, shade(wall, -0.05));
    }

    // Puerta
    var dx = (o.doorX != null ? o.doorX : Math.floor(tw / 2)) * TILE;
    var dh = Math.min(wallH - 4, 22), dw = 14;
    px(x, dx + 1, wy + wallH - dh, dw, dh, PAL.woodD);
    px(x, dx + 2, wy + wallH - dh + 1, dw - 2, dh - 1, PAL.wood);
    px(x, dx + 2 + (dw - 2) / 2 - 1, wy + wallH - dh + 1, 1, dh - 1, PAL.woodD);
    px(x, dx + dw - 3, wy + wallH - dh / 2, 2, 2, '#e6c86a'); // pomo
    px(x, dx, wy + wallH - dh - 2, dw + 2, 2, shade(wall, -0.3)); // dintel

    // Ventanas con contraventanas
    var wins = o.windows != null ? o.windows : Math.max(1, tw - 2);
    for (var k = 0; k < wins; k++) {
      var wx = Math.round((k + 0.5) * (w / wins)) - 6;
      if (Math.abs(wx - dx) < 16) continue;
      px(x, wx - 2, wy + 5, 16, 14, shade(wall, -0.25));
      px(x, wx, wy + 6, 12, 12, '#2b3a4a');
      px(x, wx, wy + 6, 12, 4, '#4e6b82');
      px(x, wx + 5, wy + 6, 2, 12, shade(wall, -0.3));
      px(x, wx, wy + 11, 12, 1, shade(wall, -0.3));
      px(x, wx - 3, wy + 5, 3, 14, o.shutter || '#4a6a45');
      px(x, wx + 12, wy + 5, 3, 14, o.shutter || '#4a6a45');
      px(x, wx - 3, wy + 19, 18, 2, shade(wall, -0.2)); // repisa
    }

    // Cartel de tienda
    if (o.sign) {
      var sx2 = Math.max(2, dx - 26);
      px(x, sx2, wy + 2, 26, 12, PAL.woodD);
      px(x, sx2 + 1, wy + 3, 24, 10, o.signColor || '#d9b45c');
      x.fillStyle = '#3a2a16';
      x.font = 'bold 7px monospace';
      x.textAlign = 'center';
      x.fillText(o.sign, sx2 + 13, wy + 11);
      x.textAlign = 'left';
    }
    return outlineDark(c, 0.3);
  }

  function makeBarn(tw, th) {
    var w = tw * TILE, h = th * TILE;
    var c = cv(w, h + 8), x = ctxOf(c);
    var roofH = Math.round(h * 0.42), wallH = h - roofH;
    var wall = '#b04a3a', wallD = shade(wall, -0.2);
    px(x, 2, roofH, w - 4, wallH, wall);
    px(x, 2, roofH, 3, wallH, shade(wall, 0.14));
    px(x, w - 5, roofH, 3, wallH, wallD);
    // Vigas blancas
    px(x, 2, roofH, w - 4, 3, '#efe6d2');
    px(x, 2, roofH + wallH - 4, w - 4, 4, '#efe6d2');
    for (var i = 0; i <= 3; i++) px(x, 2 + i * ((w - 6) / 3), roofH, 3, wallH, '#efe6d2');
    // Tejado a dos aguas
    for (var ry = 0; ry < roofH; ry++) {
      var t = ry / roofH, inset = Math.round((1 - t) * (w * 0.10));
      px(x, inset, ry, w - inset * 2, 1, mix('#6b4a2c', '#4a3220', t));
    }
    px(x, 0, roofH - 3, w, 3, '#3d2a1a');
    // Portón doble
    var dw = Math.min(40, w * 0.4), dx = (w - dw) / 2;
    px(x, dx, roofH + wallH - 34, dw, 34, '#6b4728');
    px(x, dx + 1, roofH + wallH - 33, dw / 2 - 2, 32, '#8a5f39');
    px(x, dx + dw / 2 + 1, roofH + wallH - 33, dw / 2 - 2, 32, '#8a5f39');
    px(x, dx, roofH + wallH - 22, dw, 2, '#5b3c22');
    // Ventanuco del henil
    px(x, w / 2 - 7, roofH - 14, 14, 12, '#3a2a1a');
    px(x, w / 2 - 5, roofH - 12, 10, 8, '#c9a95c');
    return outlineDark(c, 0.32);
  }

  function makeCoop(tw, th) {
    var w = tw * TILE, h = th * TILE;
    var c = cv(w, h + 8), x = ctxOf(c);
    var roofH = Math.round(h * 0.4), wallH = h - roofH;
    px(x, 2, roofH, w - 4, wallH, '#c8b189');
    px(x, 2, roofH, 2, wallH, '#ddc9a4');
    px(x, w - 4, roofH, 2, wallH, '#a4906c');
    for (var ry = 0; ry < roofH; ry++)
      px(x, Math.round((1 - ry / roofH) * 4), ry, w - Math.round((1 - ry / roofH) * 8), 1, mix('#5f7a4a', '#3f5632', ry / roofH));
    px(x, 0, roofH - 2, w, 2, '#33452a');
    // Puertecilla y rampa
    px(x, w / 2 - 7, roofH + wallH - 18, 14, 18, '#6b4728');
    px(x, w / 2 - 5, roofH + wallH - 16, 10, 16, '#3a2a1a');
    px(x, w / 2 - 6, roofH + wallH - 2, 12, 4, '#8a5f39');
    // Perchas
    px(x, 6, roofH + 6, w - 12, 2, '#8a5f39');
    return outlineDark(c, 0.3);
  }

  function makeWell() {
    var c = cv(28, 34), x = ctxOf(c);
    ellipse(x, 14, 26, 11, 6, PAL.stoneD);
    ellipse(x, 14, 24, 11, 6, PAL.stone);
    ellipse(x, 14, 23, 8, 4, '#2b4a5e');
    ellipse(x, 14, 23, 6, 3, PAL.water);
    px(x, 4, 22, 3, 8, PAL.stoneD); px(x, 21, 22, 3, 8, PAL.stoneD);
    px(x, 5, 6, 3, 18, PAL.wood); px(x, 20, 6, 3, 18, PAL.wood);
    for (var ry = 0; ry < 8; ry++) px(x, 1 + ry, ry, 26 - ry * 2, 1, mix('#8a4a34', '#5f3222', ry / 8));
    px(x, 6, 10, 16, 3, PAL.woodD);
    px(x, 13, 13, 2, 6, '#4a4a4a');
    px(x, 11, 19, 6, 5, PAL.woodD); px(x, 12, 20, 4, 4, '#6b8a9a');
    return outlineDark(c, 0.3);
  }

  function makeTrough() { // comedero
    var c = cv(30, 16), x = ctxOf(c);
    px(x, 0, 4, 30, 10, PAL.woodD);
    px(x, 1, 5, 28, 8, PAL.wood);
    px(x, 2, 5, 26, 3, '#c9a95c');
    for (var i = 0; i < 14; i++) px(x, 3 + i * 2, 5 + (i % 3), 2, 1, '#e0c274');
    px(x, 0, 12, 30, 2, shade(PAL.woodD, -0.2));
    return outlineDark(c, 0.28);
  }

  function makeHaystack() {
    var c = cv(30, 28), x = ctxOf(c), rnd = G.RNG(9);
    ellipse(x, 15, 22, 14, 6, '#a88a45');
    for (var y = 0; y < 18; y++) {
      var w = Math.round(14 * (0.35 + 0.65 * (y / 18)));
      px(x, 15 - w, 22 - 18 + y, w * 2, 1, mix('#e0c274', '#a88a45', y / 18));
    }
    for (var i = 0; i < 40; i++) px(x, rnd.int(3, 26), rnd.int(5, 24), rnd.int(1, 3), 1, rnd() < .5 ? '#f0d894' : '#8a6f38');
    return outlineDark(c, 0.28);
  }

  function makeSign(text) {
    var c = cv(30, 26), x = ctxOf(c);
    px(x, 13, 12, 4, 14, PAL.woodD);
    px(x, 1, 2, 28, 13, PAL.woodD);
    px(x, 2, 3, 26, 11, '#c9a95c');
    x.fillStyle = '#4a3218'; x.font = 'bold 6px monospace'; x.textAlign = 'center';
    var words = String(text).split('\n');
    for (var i = 0; i < words.length; i++) x.fillText(words[i], 15, 8 + i * 6);
    x.textAlign = 'left';
    return outlineDark(c, 0.3);
  }

  function makeChest() {
    var c = cv(20, 18), x = ctxOf(c);
    px(x, 1, 6, 18, 11, PAL.woodD);
    px(x, 2, 7, 16, 9, PAL.wood);
    px(x, 1, 2, 18, 5, '#a67a4b');
    px(x, 1, 2, 18, 2, '#c09263');
    px(x, 1, 6, 18, 1, '#4a3218');
    px(x, 8, 5, 4, 6, '#e6c86a');
    px(x, 9, 7, 2, 2, '#4a3218');
    return outlineDark(c, 0.3);
  }

  function makeBed() {
    var c = cv(32, 40), x = ctxOf(c);
    px(x, 2, 2, 28, 36, PAL.woodD);
    px(x, 3, 3, 26, 34, PAL.wood);
    px(x, 4, 12, 24, 25, '#7a4a5e');   // manta
    px(x, 4, 12, 24, 3, '#96607a');
    px(x, 5, 4, 22, 9, '#efe6d2');     // almohada
    px(x, 5, 4, 22, 3, '#ffffff');
    px(x, 4, 22, 24, 1, '#8f5a70');
    return outlineDark(c, 0.3);
  }

  function makeStove() {
    var c = cv(26, 28), x = ctxOf(c);
    px(x, 1, 6, 24, 22, '#4a4a52');
    px(x, 2, 7, 22, 20, '#5e5e68');
    px(x, 4, 12, 16, 10, '#2a2a30');
    px(x, 6, 16, 12, 5, '#e07a2a');
    px(x, 7, 18, 10, 3, '#f2c14a');
    px(x, 1, 2, 24, 5, '#6a6a74');
    px(x, 4, 0, 6, 3, '#3a3a42');
    return outlineDark(c, 0.3);
  }

  function makeCounter() {
    var c = cv(48, 22), x = ctxOf(c);
    px(x, 0, 4, 48, 18, PAL.woodD);
    px(x, 1, 5, 46, 16, PAL.wood);
    px(x, 0, 0, 48, 5, '#a67a4b');
    px(x, 0, 0, 48, 2, '#c09263');
    for (var i = 0; i < 4; i++) px(x, 4 + i * 12, 8, 8, 10, shade(PAL.wood, -0.12));
    return outlineDark(c, 0.3);
  }

  function makeShelf() {
    var c = cv(48, 34), x = ctxOf(c), rnd = G.RNG(31);
    px(x, 0, 0, 48, 34, PAL.woodD);
    px(x, 2, 2, 44, 30, '#7a5334');
    for (var r = 0; r < 3; r++) {
      var y = 4 + r * 10;
      px(x, 2, y + 8, 44, 2, PAL.wood);
      for (var i = 0; i < 7; i++) {
        var col = ['#c0402f', '#4a7a3a', '#d9b45c', '#8a5fa8', '#e0a05a'][rnd.int(0, 4)];
        px(x, 4 + i * 6, y + 2, 4, 6, col);
        px(x, 4 + i * 6, y + 2, 4, 2, shade(col, 0.2));
      }
    }
    return outlineDark(c, 0.3);
  }

  function makeLamp() {
    var c = cv(14, 40), x = ctxOf(c);
    px(x, 5, 8, 4, 30, '#3a3a42');
    px(x, 3, 36, 8, 4, '#2a2a30');
    px(x, 2, 2, 10, 8, '#4a4a52');
    px(x, 3, 3, 8, 6, '#f2d98a');
    px(x, 1, 0, 12, 2, '#2a2a30');
    return outlineDark(c, 0.3);
  }

  function makeFlowerPatch(season, seed) {
    var c = cv(16, 14), x = ctxOf(c), rnd = G.RNG(seed);
    var cols = season === 0 ? ['#f07aa8', '#f2e6a0', '#c07af0'] :
               season === 1 ? ['#f2c14a', '#f07a4a', '#ffffff'] :
               season === 2 ? ['#d97a3a', '#c04a4a', '#d9b45c'] : ['#dbe7f0', '#c0d0e0', '#ffffff'];
    for (var i = 0; i < 7; i++) {
      var fx = rnd.int(2, 13), fy = rnd.int(4, 12), col = rnd.pick(cols);
      px(x, fx, fy, 1, 3, '#4d8433');
      px(x, fx - 1, fy - 1, 3, 1, col);
      px(x, fx, fy - 2, 1, 3, col);
    }
    return c;
  }

  /* ========================================================== personajes == */
  // Rig paramétrico: 4 direcciones x 4 fotogramas, sprite 16x24 (adulto).
  var CH_W = 16, CH_H = 26, CH_FRAMES = 4, CH_DIRS = 4;

  function drawPerson(x, o, dir, frame) {
    var kid = !!o.child;
    var skin = o.skin || '#e0a97a', skinD = shade(skin, -0.18);
    var hair = o.hair || '#3a2a1a';
    var shirt = o.shirt || '#4a6a8a', shirtD = shade(shirt, -0.2), shirtL = shade(shirt, 0.16);
    var pants = o.pants || '#3a3f52', pantsD = shade(pants, -0.2);
    var boots = o.boots || '#4a3218';

    var baseY = kid ? 8 : 0;              // los niños son más bajos
    var headTop = baseY + 2;
    var headH = kid ? 7 : 8;
    var headW = kid ? 7 : 8;
    var hx = (CH_W - headW) / 2;
    var bodyTop = headTop + headH;
    var bodyH = kid ? 6 : 8;
    var legTop = bodyTop + bodyH;
    var legH = CH_H - legTop - 1;

    // Ciclo de andar
    var swing = [0, 1, 0, -1][frame];
    var bob = (frame === 1 || frame === 3) ? 1 : 0;
    headTop += bob * 0; // la cabeza sube muy poco
    var yoff = (frame % 2) ? 0 : 0;

    // Sombra
    x.globalAlpha = 0.22;
    ellipse(x, CH_W / 2, CH_H - 1, kid ? 4 : 5, 2, '#000000');
    x.globalAlpha = 1;

    // ---- piernas ----
    var lw = kid ? 2 : 3;
    var lx1 = CH_W / 2 - lw - 1, lx2 = CH_W / 2 + 1;
    if (dir === 2 || dir === 3) { // perfil: piernas casi juntas
      lx1 = CH_W / 2 - 3; lx2 = CH_W / 2 - 1;
      px(x, lx1, legTop, lw, legH - 2 + swing, pants);
      px(x, lx2, legTop, lw, legH - 2 - swing, pantsD);
      px(x, lx1, legTop + legH - 3 + swing, lw + 1, 3, boots);
      px(x, lx2, legTop + legH - 3 - swing, lw + 1, 3, shade(boots, -0.15));
    } else {
      px(x, lx1, legTop, lw, legH - 2 + swing, pants);
      px(x, lx2, legTop, lw, legH - 2 - swing, pants);
      px(x, lx1, legTop + legH - 3 + swing, lw, 3, boots);
      px(x, lx2, legTop + legH - 3 - swing, lw, 3, boots);
    }

    // ---- torso ----
    var bw = kid ? 8 : 10, bx = (CH_W - bw) / 2;
    if (dir === 2 || dir === 3) { bw = kid ? 6 : 8; bx = (CH_W - bw) / 2; }
    px(x, bx, bodyTop, bw, bodyH, shirt);
    px(x, bx, bodyTop, 2, bodyH, shirtL);
    px(x, bx + bw - 2, bodyTop, 2, bodyH, shirtD);
    if (o.apron) {
      px(x, bx + 1, bodyTop + 2, bw - 2, bodyH - 1, o.apron);
      px(x, bx + 2, bodyTop, 2, 3, o.apron);
      px(x, bx + bw - 4, bodyTop, 2, 3, o.apron);
    }
    if (o.vest) { px(x, bx, bodyTop, 3, bodyH, o.vest); px(x, bx + bw - 3, bodyTop, 3, bodyH, shade(o.vest, -0.15)); }

    // ---- brazos ----
    var aw = 2, ay = bodyTop + 1, ah = bodyH - 1;
    if (dir === 2) { // izquierda
      px(x, bx - 1, ay - swing, aw, ah, skin);
      px(x, bx - 1, ay - swing, aw, 3, shirtD);
    } else if (dir === 3) { // derecha
      px(x, bx + bw - 1, ay + swing, aw, ah, skin);
      px(x, bx + bw - 1, ay + swing, aw, 3, shirtD);
    } else {
      px(x, bx - 2, ay + swing, aw, ah, skin);
      px(x, bx - 2, ay + swing, aw, 3, shirt);
      px(x, bx + bw, ay - swing, aw, ah, skin);
      px(x, bx + bw, ay - swing, aw, 3, shirt);
    }

    // ---- cabeza ----
    px(x, hx, headTop, headW, headH, skin);
    px(x, hx, headTop, 1, headH, skinD);
    px(x, hx + headW - 1, headTop, 1, headH, skinD);
    px(x, hx, headTop + headH, headW, 1, skinD); // cuello

    if (dir === 0) { // mirando abajo
      px(x, hx + 2, headTop + 4, 1, 2, '#241a12');
      px(x, hx + headW - 3, headTop + 4, 1, 2, '#241a12');
      if (o.beard) { px(x, hx + 1, headTop + 6, headW - 2, 2, o.beard); px(x, hx + 2, headTop + 8, headW - 4, 1, o.beard); }
      else px(x, hx + 3, headTop + 6, 2, 1, shade(skin, -0.3));
    } else if (dir === 1) { // de espaldas
      px(x, hx, headTop, headW, headH - 2, hair);
    } else { // perfil
      var ex = dir === 2 ? hx + 1 : hx + headW - 2;
      px(x, ex, headTop + 4, 1, 2, '#241a12');
      if (o.beard) px(x, dir === 2 ? hx : hx + headW - 2, headTop + 5, 2, 3, o.beard);
      // nariz
      px(x, dir === 2 ? hx - 1 : hx + headW, headTop + 4, 1, 2, skin);
    }

    // ---- pelo / gorra ----
    var style = o.hairStyle || 'short';
    if (o.hat === 'boina') {
      px(x, hx - 1, headTop - 1, headW + 2, 3, o.hatColor || '#2a2a30');
      px(x, hx, headTop - 2, headW, 2, o.hatColor || '#2a2a30');
      px(x, hx + headW / 2, headTop - 3, 1, 1, shade(o.hatColor || '#2a2a30', 0.3));
      if (dir !== 1) px(x, hx, headTop + 1, headW, 1, hair);
    } else if (o.hat === 'paja') {
      px(x, hx - 3, headTop, headW + 6, 2, '#d9b45c');
      px(x, hx - 1, headTop - 3, headW + 2, 4, '#e6c87a');
      px(x, hx - 1, headTop - 1, headW + 2, 1, '#a88a45');
    } else if (o.hat === 'panuelo') {
      px(x, hx - 1, headTop - 1, headW + 2, 4, o.hatColor || '#c0405a');
      px(x, hx - 2, headTop + 2, 2, 3, o.hatColor || '#c0405a');
    } else {
      px(x, hx - 1, headTop - 1, headW + 2, 3, hair);
      px(x, hx - 1, headTop + 1, 2, 2, hair);
      px(x, hx + headW - 1, headTop + 1, 2, 2, hair);
      if (style === 'long') {
        px(x, hx - 2, headTop, 2, headH + 4, hair);
        px(x, hx + headW, headTop, 2, headH + 4, hair);
      } else if (style === 'bun') {
        px(x, hx - 1, headTop - 1, headW + 2, 3, hair);
        circle(x, CH_W / 2, headTop - 3, 2, hair);
      } else if (style === 'bald') {
        px(x, hx - 1, headTop - 1, headW + 2, 2, shade(skin, -0.05));
        px(x, hx - 1, headTop + 1, 2, 3, hair);
        px(x, hx + headW - 1, headTop + 1, 2, 3, hair);
      }
      px(x, hx, headTop - 1, 3, 1, shade(hair, 0.2));
    }
  }

  function makeCharSheet(o) {
    var c = cv(CH_W * CH_FRAMES, CH_H * CH_DIRS), x = ctxOf(c);
    for (var d = 0; d < CH_DIRS; d++) {
      for (var f = 0; f < CH_FRAMES; f++) {
        x.save();
        x.translate(f * CH_W, d * CH_H);
        drawPerson(x, o, d, f);
        x.restore();
      }
    }
    return c;
  }

  /* ============================================================ animales == */
  // Vista de perfil mirando a la derecha; se refleja para la izquierda.
  function drawCow(x, o, frame) {
    var body = o.body || '#f2efe6', spot = o.spot || '#3a3028';
    var W = 34, H = 24;
    var legSw = [0, 1, 0, -1][frame];
    x.globalAlpha = 0.22; ellipse(x, W / 2, H - 1, 12, 3, '#000'); x.globalAlpha = 1;
    // patas
    px(x, 8, 14, 3, 9 + legSw, body); px(x, 8, 21 + legSw, 3, 2, '#2a2018');
    px(x, 13, 14, 3, 9 - legSw, body); px(x, 13, 19 + 2 - legSw, 3, 2, '#2a2018');
    px(x, 22, 14, 3, 9 - legSw, body); px(x, 22, 21 - legSw, 3, 2, '#2a2018');
    px(x, 26, 14, 3, 9 + legSw, body); px(x, 26, 21 + legSw, 3, 2, '#2a2018');
    // cuerpo
    ellipse(x, 18, 12, 12, 7, body);
    px(x, 7, 8, 22, 8, body);
    ellipse(x, 18, 10, 11, 5, shade(body, 0.08));
    // manchas
    ellipse(x, 14, 12, 5, 3, spot);
    ellipse(x, 23, 10, 3, 2, spot);
    ellipse(x, 19, 15, 3, 2, spot);
    // ubre
    ellipse(x, 13, 17, 4, 2, '#f0b8b0');
    px(x, 11, 18, 1, 3, '#e8a09a'); px(x, 14, 18, 1, 3, '#e8a09a');
    // cabeza
    px(x, 27, 6, 8, 8, body);
    ellipse(x, 32, 12, 3, 3, '#f0d0c4'); // morro
    px(x, 31, 12, 1, 1, '#8a6a5a'); px(x, 33, 12, 1, 1, '#8a6a5a');
    px(x, 30, 8, 1, 2, '#241a12'); // ojo
    px(x, 26, 4, 3, 3, spot); // oreja
    px(x, 33, 4, 2, 2, '#e8e0d0'); px(x, 28, 3, 2, 2, '#e8e0d0'); // cuernos
    // cola
    px(x, 6, 8, 1, 8, spot); px(x, 5, 15, 2, 3, spot);
  }

  function drawSheep(x, o, frame) {
    var wool = o.wool || '#f0ece0', face = o.face || '#3a3028';
    var sheared = o.sheared;
    var W = 26, H = 20, legSw = [0, 1, 0, -1][frame];
    x.globalAlpha = 0.22; ellipse(x, W / 2, H - 1, 9, 2, '#000'); x.globalAlpha = 1;
    px(x, 6, 12, 2, 7 + legSw, face); px(x, 10, 12, 2, 7 - legSw, face);
    px(x, 16, 12, 2, 7 - legSw, face); px(x, 19, 12, 2, 7 + legSw, face);
    if (sheared) {
      ellipse(x, 13, 10, 9, 5, '#e8d8c8');
      ellipse(x, 13, 9, 8, 4, '#f2e4d4');
    } else {
      ellipse(x, 13, 10, 10, 6, shade(wool, -0.12));
      for (var i = 0; i < 8; i++) circle(x, 5 + i * 2.4, 7 + (i % 2), 3, wool);
      for (var j = 0; j < 6; j++) circle(x, 6 + j * 3, 11 + (j % 2), 3, shade(wool, -0.05));
    }
    px(x, 20, 5, 6, 7, face);       // cabeza
    ellipse(x, 24, 10, 2, 2, shade(face, 0.15));
    px(x, 22, 7, 1, 1, '#f0e8d8'); // ojo
    px(x, 19, 4, 3, 2, face);      // oreja
    if (!sheared) circle(x, 21, 4, 3, wool);
  }

  function drawLamb(x, o, frame) {
    var wool = '#faf6ee', face = '#4a4038';
    var legSw = [0, 1, 0, -1][frame];
    x.globalAlpha = 0.2; ellipse(x, 9, 13, 6, 2, '#000'); x.globalAlpha = 1;
    px(x, 4, 8, 2, 5 + legSw, face); px(x, 7, 8, 2, 5 - legSw, face);
    px(x, 11, 8, 2, 5 - legSw, face); px(x, 13, 8, 2, 5 + legSw, face);
    for (var i = 0; i < 5; i++) circle(x, 4 + i * 2.4, 6, 3, wool);
    px(x, 13, 3, 5, 5, face);
    px(x, 15, 5, 1, 1, '#f0e8d8');
    circle(x, 14, 2, 2, wool);
    px(x, 12, 2, 2, 2, face);
  }

  function drawChicken(x, o, frame) {
    var body = o.body || '#f2e6d2', comb = '#d0342c';
    var bob = [0, 1, 0, 0][frame];
    x.globalAlpha = 0.2; ellipse(x, 8, 15, 5, 2, '#000'); x.globalAlpha = 1;
    px(x, 5, 12 + bob, 1, 3, '#e0a03a');
    px(x, 9, 12 + bob, 1, 3, '#e0a03a');
    px(x, 4, 15, 3, 1, '#e0a03a'); px(x, 8, 15, 3, 1, '#e0a03a');
    ellipse(x, 7, 9 + bob, 5, 4, body);
    ellipse(x, 6, 8 + bob, 4, 3, shade(body, 0.1));
    px(x, 2, 8 + bob, 3, 2, shade(body, -0.15)); // cola
    px(x, 1, 6 + bob, 2, 3, shade(body, -0.2));
    px(x, 9, 4 + bob, 4, 5, body);  // cabeza
    px(x, 11, 6 + bob, 1, 1, '#241a12');
    px(x, 13, 6 + bob, 2, 1, '#e0a03a'); // pico
    px(x, 9, 2 + bob, 3, 2, comb);  // cresta
    px(x, 11, 8 + bob, 2, 2, comb); // barbilla
  }

  function drawChick(x, o, frame) {
    var body = '#f2d96a';
    var bob = [0, 1, 0, 0][frame];
    x.globalAlpha = 0.18; ellipse(x, 5, 9, 3, 1, '#000'); x.globalAlpha = 1;
    px(x, 3, 7 + bob, 1, 2, '#e0a03a'); px(x, 6, 7 + bob, 1, 2, '#e0a03a');
    ellipse(x, 5, 5 + bob, 4, 3, body);
    px(x, 6, 2 + bob, 3, 3, body);
    px(x, 7, 3 + bob, 1, 1, '#241a12');
    px(x, 9, 3 + bob, 1, 1, '#e0a03a');
  }

  function drawDonkey(x, o, frame) {
    var body = o.body || '#9a9086', dark = shade(body, -0.25), light = shade(body, 0.16);
    var legSw = [0, 1, 0, -1][frame];
    x.globalAlpha = 0.22; ellipse(x, 15, 23, 10, 3, '#000'); x.globalAlpha = 1;
    px(x, 7, 14, 3, 9 + legSw, body); px(x, 7, 21 + legSw, 3, 2, '#2a2018');
    px(x, 11, 14, 3, 9 - legSw, body); px(x, 11, 21 - legSw, 3, 2, '#2a2018');
    px(x, 18, 14, 3, 9 - legSw, body); px(x, 18, 21 - legSw, 3, 2, '#2a2018');
    px(x, 22, 14, 3, 9 + legSw, body); px(x, 22, 21 + legSw, 3, 2, '#2a2018');
    ellipse(x, 15, 11, 10, 6, body);
    px(x, 6, 8, 19, 7, body);
    px(x, 6, 8, 19, 2, light);
    px(x, 6, 14, 19, 1, dark);
    ellipse(x, 15, 12, 9, 3, shade(body, -0.06));
    px(x, 12, 6, 2, 10, dark); // cruz del burro
    px(x, 6, 9, 19, 1, dark);
    px(x, 23, 4, 6, 9, body);  // cabeza
    px(x, 26, 10, 4, 4, '#3a3028'); // morro
    px(x, 26, 6, 1, 2, '#241a12');
    px(x, 22, 0, 2, 6, body); px(x, 25, 0, 2, 6, body); // orejas largas
    px(x, 22, 0, 2, 3, dark); px(x, 25, 0, 2, 3, dark);
    px(x, 20, 3, 4, 4, dark); // crin
    px(x, 5, 8, 1, 8, dark); px(x, 4, 14, 2, 4, '#2a2018'); // cola
  }

  var ANIMAL_DEFS = {
    cow:     { w: 36, h: 24, draw: drawCow },
    sheep:   { w: 27, h: 20, draw: drawSheep },
    lamb:    { w: 19, h: 14, draw: drawLamb },
    chicken: { w: 16, h: 16, draw: drawChicken },
    chick:   { w: 11, h: 10, draw: drawChick },
    donkey:  { w: 31, h: 24, draw: drawDonkey }
  };

  function makeAnimalSheet(kind, opts) {
    var d = ANIMAL_DEFS[kind];
    var c = cv(d.w * 4, d.h), x = ctxOf(c);
    for (var f = 0; f < 4; f++) {
      x.save(); x.translate(f * d.w, 0);
      d.draw(x, opts || {}, f);
      x.restore();
    }
    return outlineDark(c, 0.22);
  }

  /* ============================================================ cultivos == */
  // 5 fases: 0 brote, 1 hoja, 2 planta, 3 con flor/fruto, 4 listo
  function makeCropSheet(def) {
    var W = 16, H = 22, N = 5;
    var c = cv(W * N, H), x = ctxOf(c);
    var leaf = def.leaf || '#4d8a33', leafD = shade(leaf, -0.22), leafL = shade(leaf, 0.18);
    var fruit = def.fruit || '#d0342c';
    for (var s = 0; s < N; s++) {
      x.save(); x.translate(s * W, 0);
      var t = s / (N - 1);
      var hgt = Math.round(3 + t * 14);
      var base = H - 2;
      if (s === 0) {
        px(x, 7, base - 3, 2, 3, leaf);
        px(x, 6, base - 4, 4, 1, leafL);
      } else {
        px(x, 7, base - hgt, 2, hgt, leafD);           // tallo
        px(x, 7, base - hgt, 1, hgt, leaf);
        var pairs = 1 + s;
        for (var p = 0; p < pairs; p++) {
          var ly = base - 2 - Math.round((p + 1) * (hgt / (pairs + 1)));
          var lw = 3 + s;
          ellipse(x, 7 - lw / 2, ly, lw / 2 + 1, 2, leaf);
          ellipse(x, 9 + lw / 2, ly, lw / 2 + 1, 2, leafD);
          px(x, 7 - lw, ly - 1, 2, 1, leafL);
        }
      }
      if (def.type === 'root' && s === 4) {
        // Tubérculo asomando en la tierra
        ellipse(x, 8, base, 5, 3, fruit);
        ellipse(x, 7, base - 1, 3, 2, shade(fruit, 0.18));
      } else if (def.type === 'leafy' && s >= 3) {
        var r = s === 3 ? 4 : 6;
        ellipse(x, 8, base - 4, r, r - 1, leaf);
        ellipse(x, 8, base - 5, r - 2, r - 3, leafL);
        ellipse(x, 8, base - 3, r - 1, r - 3, leafD);
      } else if (def.type === 'pod' && s >= 3) {
        for (var q = 0; q < (s === 3 ? 2 : 4); q++) {
          var qy = base - 6 - q * 4;
          px(x, 4, qy, 3, 5, s === 4 ? fruit : leafL);
          px(x, 10, qy - 2, 3, 5, s === 4 ? fruit : leafL);
        }
      } else if (def.type === 'fruit' && s >= 3) {
        var n = s === 3 ? 1 : 3;
        for (var q2 = 0; q2 < n; q2++) {
          var fx = 4 + q2 * 4, fy = base - 6 - (q2 % 2) * 4;
          circle(x, fx + 2, fy, s === 3 ? 2 : 3, s === 3 ? shade(fruit, 0.4) : fruit);
          px(x, fx + 1, fy - 2, 1, 1, shade(fruit, 0.35));
        }
      } else if (def.type === 'grain' && s >= 3) {
        for (var g = 0; g < 3; g++) {
          var gx = 5 + g * 3;
          px(x, gx, base - hgt - 2, 2, 7, fruit);
          px(x, gx, base - hgt - 3, 2, 2, shade(fruit, 0.3));
        }
      } else if (def.type === 'bulb' && s >= 3) {
        ellipse(x, 8, base - 1, 4, 4, fruit);
        ellipse(x, 8, base - 2, 3, 3, shade(fruit, 0.2));
        px(x, 7, base - 6, 2, 4, leaf);
      }
      x.restore();
    }
    return c;
  }

  /* ============================================================== iconos == */
  function iconBase() { return cv(16, 16); }

  function iconTool(kind) {
    var c = iconBase(), x = ctxOf(c);
    var handle = '#8a5f39', hl = '#a67a4b', metal = '#b8bcc4', metalD = '#7d838c';
    // mango en diagonal
    for (var i = 0; i < 12; i++) px(x, 3 + i, 14 - i, 2, 2, i % 3 === 0 ? hl : handle);
    if (kind === 'azada') {
      px(x, 11, 1, 5, 3, metal); px(x, 11, 4, 5, 2, metalD);
      px(x, 9, 1, 3, 2, metalD);
    } else if (kind === 'regadera') {
      var c2 = iconBase(), x2 = ctxOf(c2);
      px(x2, 3, 6, 9, 8, '#6d9dc5'); px(x2, 3, 6, 9, 2, '#8fbde0');
      px(x2, 3, 12, 9, 2, '#4a7ba0');
      px(x2, 11, 4, 4, 3, '#8fbde0');
      px(x2, 1, 5, 3, 5, '#4a7ba0');
      px(x2, 12, 2, 3, 3, '#8fbde0');
      px(x2, 14, 1, 2, 2, '#b8dcf0');
      return outlineDark(c2, 0.3);
    } else if (kind === 'cubo') {
      var c3 = iconBase(), x3 = ctxOf(c3);
      px(x3, 3, 5, 10, 9, '#a8adb6'); px(x3, 3, 5, 10, 2, '#c8ccd4');
      px(x3, 4, 12, 8, 2, '#7d838c');
      px(x3, 2, 3, 12, 2, '#7d838c');
      px(x3, 5, 7, 6, 4, '#f4f2ee');
      return outlineDark(c3, 0.3);
    } else if (kind === 'hoz') {
      px(x, 8, 1, 2, 2, metal);
      for (var a = 0; a < 8; a++) {
        var ang = -0.4 + a * 0.28;
        px(x, 9 + Math.cos(ang) * 6, 6 - Math.sin(ang) * 5, 2, 2, metal);
      }
    } else if (kind === 'hacha') {
      px(x, 10, 1, 5, 6, metal); px(x, 10, 5, 5, 2, metalD);
      px(x, 8, 2, 3, 4, metalD);
    } else if (kind === 'pala') {
      px(x, 10, 1, 5, 5, metal); px(x, 10, 5, 5, 1, metalD);
      px(x, 11, 0, 3, 1, metalD);
    } else if (kind === 'rastrillo') {
      px(x, 9, 1, 7, 2, metalD);
      for (var r = 0; r < 4; r++) px(x, 9 + r * 2, 3, 1, 3, metal);
    } else if (kind === 'tijeras') {
      px(x, 8, 2, 2, 6, metal); px(x, 11, 2, 2, 6, metal);
      px(x, 8, 8, 5, 2, metalD);
      px(x, 7, 10, 3, 4, handle); px(x, 11, 10, 3, 4, handle);
    }
    return outlineDark(c, 0.3);
  }

  function iconSeed(color) {
    var c = iconBase(), x = ctxOf(c);
    px(x, 2, 4, 12, 10, '#c9a95c');
    px(x, 2, 4, 12, 2, '#e0c274');
    px(x, 2, 12, 12, 2, '#a88a45');
    px(x, 3, 2, 10, 3, '#8a6f38');
    circle(x, 8, 9, 3, color);
    px(x, 7, 7, 1, 1, shade(color, 0.4));
    return outlineDark(c, 0.3);
  }

  function iconRound(color, opts) {
    var c = iconBase(), x = ctxOf(c);
    opts = opts || {};
    ellipse(x, 8, 9, opts.rx || 6, opts.ry || 5, shade(color, -0.18));
    ellipse(x, 8, 8, (opts.rx || 6) - 1, (opts.ry || 5) - 1, color);
    ellipse(x, 6, 6, 2, 1, shade(color, 0.4));
    if (opts.stem) { px(x, 8, 2, 2, 3, '#4d8a33'); px(x, 6, 2, 4, 1, '#5f9e3f'); }
    if (opts.leaf) { px(x, 9, 2, 4, 2, '#4d8a33'); px(x, 11, 1, 2, 2, '#5f9e3f'); }
    return outlineDark(c, 0.3);
  }

  function iconLeafy(color) {
    var c = iconBase(), x = ctxOf(c);
    ellipse(x, 8, 9, 6, 5, shade(color, -0.2));
    ellipse(x, 6, 8, 4, 4, color);
    ellipse(x, 10, 8, 4, 4, shade(color, 0.1));
    ellipse(x, 8, 6, 3, 3, shade(color, 0.25));
    return outlineDark(c, 0.3);
  }

  function iconPod(color) {
    var c = iconBase(), x = ctxOf(c);
    for (var i = 0; i < 3; i++) {
      var ox = 2 + i * 4, oy = 4 + (i % 2) * 3;
      px(x, ox, oy, 3, 8, color);
      px(x, ox, oy, 1, 8, shade(color, 0.25));
      px(x, ox + 1, oy + 2, 1, 1, shade(color, -0.3));
      px(x, ox + 1, oy + 5, 1, 1, shade(color, -0.3));
    }
    return outlineDark(c, 0.3);
  }

  function iconBottle(liq, glass) {
    var c = iconBase(), x = ctxOf(c);
    px(x, 6, 1, 4, 4, glass || '#cfe0e8');
    px(x, 4, 5, 8, 10, glass || '#cfe0e8');
    px(x, 5, 7, 6, 7, liq);
    px(x, 5, 7, 2, 7, shade(liq, 0.25));
    px(x, 6, 0, 4, 2, '#a8896a');
    return outlineDark(c, 0.3);
  }

  function iconEgg() {
    var c = iconBase(), x = ctxOf(c);
    ellipse(x, 8, 9, 5, 6, '#e8dcc4');
    ellipse(x, 8, 8, 4, 5, '#f6efe0');
    ellipse(x, 6, 6, 2, 2, '#ffffff');
    return outlineDark(c, 0.3);
  }

  function iconCheese() {
    var c = iconBase(), x = ctxOf(c);
    px(x, 2, 6, 12, 7, '#e6c05a');
    px(x, 2, 5, 12, 2, '#f2d97a');
    px(x, 2, 12, 12, 2, '#c09a3a');
    circle(x, 6, 9, 1, '#c09a3a'); circle(x, 10, 10, 1, '#c09a3a');
    return outlineDark(c, 0.3);
  }

  function iconWool() {
    var c = iconBase(), x = ctxOf(c);
    for (var i = 0; i < 6; i++) circle(x, 4 + (i % 3) * 4, 6 + Math.floor(i / 3) * 4, 3, '#f2eee4');
    for (var j = 0; j < 4; j++) circle(x, 5 + j * 2, 8, 2, '#e0dacc');
    return outlineDark(c, 0.3);
  }

  function iconSack(color, letter) {
    var c = iconBase(), x = ctxOf(c);
    px(x, 3, 5, 10, 10, color);
    px(x, 3, 5, 3, 10, shade(color, 0.2));
    px(x, 11, 5, 2, 10, shade(color, -0.2));
    px(x, 4, 2, 8, 4, shade(color, -0.1));
    px(x, 5, 1, 6, 2, shade(color, 0.15));
    if (letter) {
      x.fillStyle = 'rgba(0,0,0,.55)'; x.font = 'bold 7px monospace'; x.textAlign = 'center';
      x.fillText(letter, 8, 12); x.textAlign = 'left';
    }
    return outlineDark(c, 0.3);
  }

  function iconBread() {
    var c = iconBase(), x = ctxOf(c);
    ellipse(x, 8, 9, 6, 4, '#a8703a');
    ellipse(x, 8, 8, 5, 3, '#c9944a');
    px(x, 5, 6, 2, 1, '#e0b96a'); px(x, 9, 6, 2, 1, '#e0b96a');
    return outlineDark(c, 0.3);
  }

  function iconMeat() {
    var c = iconBase(), x = ctxOf(c);
    ellipse(x, 9, 9, 5, 4, '#8a2f34');
    ellipse(x, 9, 8, 4, 3, '#b44a48');
    for (var i = 0; i < 5; i++) px(x, 6 + i * 2, 7 + (i % 2) * 2, 1, 1, '#e8d0c4');
    px(x, 2, 10, 4, 2, '#e0d0b0');
    return outlineDark(c, 0.3);
  }

  function iconRing() {
    var c = iconBase(), x = ctxOf(c);
    for (var a = 0; a < 24; a++) {
      var ang = a / 24 * Math.PI * 2;
      px(x, 8 + Math.cos(ang) * 5, 10 + Math.sin(ang) * 4, 2, 2, '#e6c86a');
    }
    circle(x, 8, 4, 2, '#8fdcf0');
    px(x, 7, 3, 1, 1, '#ffffff');
    return outlineDark(c, 0.3);
  }

  function iconBouquet() {
    var c = iconBase(), x = ctxOf(c);
    px(x, 7, 8, 2, 7, '#4d8a33');
    px(x, 5, 10, 2, 4, '#5f9e3f'); px(x, 9, 10, 2, 4, '#5f9e3f');
    circle(x, 5, 6, 2, '#f07aa8'); circle(x, 11, 6, 2, '#f2d96a');
    circle(x, 8, 4, 3, '#e05a7a'); circle(x, 8, 4, 1, '#f2d96a');
    return outlineDark(c, 0.3);
  }

  function iconStar(color) {
    var c = iconBase(), x = ctxOf(c);
    px(x, 7, 2, 2, 12, color); px(x, 2, 7, 12, 2, color);
    px(x, 5, 5, 6, 6, color); px(x, 6, 4, 4, 8, shade(color, 0.25));
    return outlineDark(c, 0.3);
  }

  function iconWood() {
    var c = iconBase(), x = ctxOf(c);
    px(x, 1, 5, 14, 6, PAL.wood);
    px(x, 1, 5, 14, 2, PAL.woodL);
    px(x, 1, 10, 14, 2, PAL.woodD);
    ellipse(x, 13, 8, 2, 3, '#c9a95c');
    ellipse(x, 13, 8, 1, 1, PAL.woodD);
    return outlineDark(c, 0.3);
  }

  function iconStone() {
    var c = iconBase(), x = ctxOf(c);
    ellipse(x, 8, 10, 6, 4, PAL.stoneD);
    ellipse(x, 8, 8, 5, 3, PAL.stone);
    ellipse(x, 6, 7, 2, 1, PAL.stoneL);
    return outlineDark(c, 0.3);
  }

  /* =========================================================== partículas = */
  function makeParticles() {
    var out = {};
    var c = cv(4, 4), x = ctxOf(c);
    px(x, 0, 0, 4, 4, '#ffffff'); out.dot = c;
    var h = cv(9, 8), hx = ctxOf(h);
    circle(hx, 3, 3, 2, '#e8506a'); circle(hx, 6, 3, 2, '#e8506a');
    px(hx, 2, 4, 6, 2, '#e8506a'); px(hx, 3, 6, 4, 1, '#e8506a'); px(hx, 4, 7, 2, 1, '#c03a52');
    px(hx, 2, 2, 1, 1, '#ff9aae');
    out.heart = h;
    var s = cv(9, 9), sx = ctxOf(s);
    px(sx, 4, 0, 1, 9, '#fff6c8'); px(sx, 0, 4, 9, 1, '#fff6c8');
    px(sx, 3, 3, 3, 3, '#ffffff');
    out.sparkle = s;
    var z = cv(8, 8), zx = ctxOf(z);
    zx.fillStyle = '#cfe0e8'; zx.font = 'bold 8px monospace'; zx.fillText('z', 0, 7);
    out.zzz = z;
    var e = cv(6, 12), ex = ctxOf(e);
    px(ex, 2, 0, 2, 7, '#f2e04a'); px(ex, 2, 9, 2, 2, '#f2e04a');
    out.excl = e;
    return out;
  }

  /* ============================================================== build == */
  var Art = G.Art = {
    TILE: TILE, CH_W: CH_W, CH_H: CH_H, CH_FRAMES: CH_FRAMES,
    PAL: PAL, shade: shade, mix: mix, cv: cv, ctxOf: ctxOf, px: px,
    ellipse: ellipse, circle: circle, tintCopy: tintCopy, outlineDark: outlineDark,
    ANIMAL_DEFS: ANIMAL_DEFS,
    tiles: {}, obj: {}, chars: {}, animals: {}, crops: {}, icons: {}, fx: {},

    makeCharSheet: makeCharSheet,
    makeAnimalSheet: makeAnimalSheet,
    makeCropSheet: makeCropSheet,
    makeSign: makeSign,

    build: function () {
      var t = this.tiles, o = this.obj, s;

      // --- tiles de suelo, cuatro estaciones ---
      t.grass = [];
      for (s = 0; s < 4; s++) {
        var arr = [];
        for (var v = 0; v < 4; v++) arr.push(makeGrass(s, v, 1000 + s * 37 + v * 7));
        t.grass.push(arr);
      }
      t.dirt = [makeDirt(11, false), makeDirt(12, false), makeDirt(13, false)];
      t.dirtSnow = [makeDirt(11, true), makeDirt(12, true), makeDirt(13, true)];
      t.path = [makePath(21, false), makePath(22, false)];
      t.pathSnow = [makePath(21, true), makePath(22, true)];
      t.soil = [makeSoil(false, 31), makeSoil(false, 32)];
      t.soilWet = [makeSoil(true, 33), makeSoil(true, 34)];
      t.water = [makeWater(0), makeWater(1), makeWater(2), makeWater(3)];
      t.wood = [makeFloor('wood', 41), makeFloor('wood', 42)];
      t.stone = [makeFloor('stone', 43), makeFloor('stone', 44)];
      t.hay = [makeFloor('hay', 45), makeFloor('hay', 46)];
      t.rug = [makeFloor('rug', 47)];

      // --- objetos del mundo ---
      o.tree = []; o.pine = []; o.apple = []; o.bush = []; o.flowers = [];
      for (s = 0; s < 4; s++) {
        o.tree.push([makeTree('oak', s, 100 + s), makeTree('oak', s, 200 + s)]);
        o.pine.push([makeTree('pine', s, 300 + s)]);
        o.apple.push([makeTree('apple', s, 400 + s)]);
        o.bush.push([makeBush(s, 500 + s), makeBush(s, 600 + s)]);
        o.flowers.push([makeFlowerPatch(s, 700 + s), makeFlowerPatch(s, 800 + s)]);
      }
      o.rock = [makeRock(1), makeRock(2)];
      o.fenceH = makeFence('h'); o.fenceV = makeFence('v'); o.gate = makeFence('gate');
      o.well = makeWell();
      o.trough = makeTrough();
      o.haystack = makeHaystack();
      o.chest = makeChest();
      o.bed = makeBed();
      o.stove = makeStove();
      o.counter = makeCounter();
      o.shelf = makeShelf();
      o.lamp = makeLamp();

      // --- edificios ---
      o.house = makeBuilding({ tw: 7, th: 6, wall: '#cdb896', roof: '#a8442f', style: 'stone', doorX: 3, windows: 2, seed: 3 });
      o.houseBig = makeBuilding({ tw: 8, th: 7, wall: '#c2b8a0', roof: '#96402c', style: 'stone', doorX: 4, windows: 3, seed: 5 });
      o.houseSmall = makeBuilding({ tw: 5, th: 5, wall: '#d0bfa0', roof: '#b04a34', doorX: 2, windows: 1, seed: 7 });
      o.houseVilla = makeBuilding({ tw: 6, th: 6, wall: '#bdae94', roof: '#8a5f39', style: 'stone', doorX: 2, windows: 2, seed: 9, shutter: '#3a5a7a' });
      o.barn = makeBarn(8, 7);
      o.coop = makeCoop(5, 4);
      o.shopFood = makeBuilding({ tw: 7, th: 6, wall: '#e0d4b4', roof: '#3f6d8a', doorX: 3, windows: 2, seed: 11, sign: 'COMIDA', signColor: '#e8c87a', shutter: '#2f5a72' });
      o.shopFarm = makeBuilding({ tw: 8, th: 6, wall: '#d6c49c', roof: '#6a7f3f', doorX: 4, windows: 2, seed: 13, sign: 'APEROS', signColor: '#cfe0a0', shutter: '#4a6a35' });
      o.tavern = makeBuilding({ tw: 7, th: 6, wall: '#c9ab84', roof: '#7a3a2a', style: 'stone', doorX: 3, windows: 2, seed: 17, sign: 'TABERNA', signColor: '#e8b06a', shutter: '#6a3a2a' });
      o.church = (function () {
        var c = cv(9 * TILE, 11 * TILE), x = ctxOf(c);
        var body = makeBuilding({ tw: 7, th: 7, wall: '#c0b8a4', roof: '#8a6a4a', style: 'stone', doorX: 3, windows: 2, seed: 23, chimney: false });
        x.drawImage(body, TILE, 4 * TILE);
        // Campanario
        px(x, 5 * TILE, 2 * TILE, 3 * TILE, 6 * TILE, '#c0b8a4');
        px(x, 5 * TILE, 2 * TILE, 6, 6 * TILE, '#d4ccb8');
        px(x, 8 * TILE - 6, 2 * TILE, 6, 6 * TILE, '#a49c88');
        for (var ry = 0; ry < 22; ry++)
          px(x, 5 * TILE - 4 + Math.round(ry * 1.2), 2 * TILE - 22 + ry, 3 * TILE + 8 - Math.round(ry * 2.4), 1, mix('#6a4a34', '#3f2a1c', ry / 22));
        px(x, 5 * TILE + 10, 3 * TILE, 2 * TILE - 4, 2 * TILE, '#2b2a26');
        px(x, 5 * TILE + 16, 3 * TILE + 8, 12, 16, '#c9a95c'); // campana
        px(x, 6 * TILE + 6, 2 * TILE - 32, 4, 14, '#e6c86a');   // cruz
        px(x, 6 * TILE, 2 * TILE - 28, 16, 4, '#e6c86a');
        return outlineDark(c, 0.3);
      })();

      // --- personajes: se generan bajo demanda y se cachean ---
      this.chars = {};

      // --- animales ---
      this.animals = {
        cow: [makeAnimalSheet('cow', { body: '#f2efe6', spot: '#3a3028' }),
              makeAnimalSheet('cow', { body: '#b98a52', spot: '#5f3f22' }),
              makeAnimalSheet('cow', { body: '#8a7a68', spot: '#4a3a2a' })],
        sheep: [makeAnimalSheet('sheep', { wool: '#f0ece0', face: '#3a3028' }),
                makeAnimalSheet('sheep', { wool: '#e0d8c8', face: '#5a4a3a' })],
        sheepShorn: [makeAnimalSheet('sheep', { wool: '#f0ece0', face: '#3a3028', sheared: true }),
                     makeAnimalSheet('sheep', { wool: '#e0d8c8', face: '#5a4a3a', sheared: true })],
        lamb: [makeAnimalSheet('lamb', {})],
        chicken: [makeAnimalSheet('chicken', { body: '#f2e6d2' }),
                  makeAnimalSheet('chicken', { body: '#c07a4a' }),
                  makeAnimalSheet('chicken', { body: '#5a5048' })],
        chick: [makeAnimalSheet('chick', {})],
        donkey: [makeAnimalSheet('donkey', { body: '#9a9086' })]
      };

      this.fx = makeParticles();
      this.icons = {};
      return this;
    },

    // Cachea hojas de personaje por clave.
    charSheet: function (key, opts) {
      if (!this.chars[key]) this.chars[key] = makeCharSheet(opts);
      return this.chars[key];
    },

    icon: function (id, def) {
      if (this.icons[id]) return this.icons[id];
      var c;
      var k = def && def.icon || {};
      switch (k.type) {
        case 'tool': c = iconTool(k.kind); break;
        case 'seed': c = iconSeed(k.color); break;
        case 'round': c = iconRound(k.color, k); break;
        case 'leafy': c = iconLeafy(k.color); break;
        case 'pod': c = iconPod(k.color); break;
        case 'bottle': c = iconBottle(k.color, k.glass); break;
        case 'egg': c = iconEgg(); break;
        case 'cheese': c = iconCheese(); break;
        case 'wool': c = iconWool(); break;
        case 'sack': c = iconSack(k.color, k.letter); break;
        case 'bread': c = iconBread(); break;
        case 'meat': c = iconMeat(); break;
        case 'ring': c = iconRing(); break;
        case 'bouquet': c = iconBouquet(); break;
        case 'wood': c = iconWood(); break;
        case 'stone': c = iconStone(); break;
        case 'star': c = iconStar(k.color || '#f2d96a'); break;
        default: c = iconRound(k.color || '#c0c0c0', k);
      }
      this.icons[id] = c;
      return c;
    },

    cropSheet: function (id, def) {
      if (!this.crops[id]) this.crops[id] = makeCropSheet(def);
      return this.crops[id];
    }
  };

})(window);
