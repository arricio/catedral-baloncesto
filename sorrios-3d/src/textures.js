/* ============================================================================
   SORRÍOS DE ORDÁS 3D — textures.js
   Todas las texturas del juego se pintan por código en canvas y se convierten
   en texturas de WebGL, incluidos los mapas de normales (calculados con Sobel)
   para que la luz del sol dé relieve real a hierba, tierra, piedra y madera.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U;

  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }
  function ctx2(c) { return c.getContext('2d'); }

  function hex2rgb(h) {
    h = h.replace('#', '');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgb(r, g, b) { return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
  function mix(a, b, t) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return rgb(U.lerp(A[0], B[0], t), U.lerp(A[1], B[1], t), U.lerp(A[2], B[2], t));
  }

  /* --------------------------------------------------- mapa de normales -- */
  // Deriva un normal map de la luminancia de la textura (relieve aproximado).
  function normalMapFrom(canvas, strength) {
    var w = canvas.width, h = canvas.height;
    var src = ctx2(canvas).getImageData(0, 0, w, h).data;
    var out = cv(w, h), o = ctx2(out), img = o.createImageData(w, h);
    var lum = new Float32Array(w * h);
    for (var i = 0; i < w * h; i++) {
      lum[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
    }
    function L(x, y) { return lum[(U.mod(y, h) | 0) * w + (U.mod(x, w) | 0)]; }
    var k = strength || 2.2;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var dx = (L(x - 1, y - 1) + 2 * L(x - 1, y) + L(x - 1, y + 1)) -
                 (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1));
        var dy = (L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1)) -
                 (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1));
        var nx = dx * k, ny = dy * k, nz = 1;
        var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        var p = (y * w + x) * 4;
        img.data[p] = (nx / len * 0.5 + 0.5) * 255;
        img.data[p + 1] = (ny / len * 0.5 + 0.5) * 255;
        img.data[p + 2] = (nz / len * 0.5 + 0.5) * 255;
        img.data[p + 3] = 255;
      }
    }
    o.putImageData(img, 0, 0);
    return out;
  }

  // Mapa de rugosidad a partir de la luminancia (lo claro, más áspero).
  function roughFrom(canvas, lo, hi) {
    var w = canvas.width, h = canvas.height;
    var src = ctx2(canvas).getImageData(0, 0, w, h).data;
    var out = cv(w, h), o = ctx2(out), img = o.createImageData(w, h);
    for (var i = 0; i < w * h; i++) {
      var l = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
      var v = U.lerp(lo == null ? 0.55 : lo, hi == null ? 1 : hi, l) * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    o.putImageData(img, 0, 0);
    return out;
  }

  function tex(canvas, repeat, aniso) {
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat, repeat);
    t.anisotropy = aniso || 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function texLinear(canvas, repeat, aniso) {
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (repeat) t.repeat.set(repeat, repeat);
    t.anisotropy = aniso || 8;
    return t;
  }

  /* ---------------------------------------------------------- generadores */
  function noiseFill(c, base, dark, light, scale, oct) {
    var x = ctx2(c), w = c.width, h = c.height;
    var n = S.Noise(Math.floor(Math.random() * 10000));
    var img = x.createImageData(w, h);
    var B = hex2rgb(base), D = hex2rgb(dark), L = hex2rgb(light);
    for (var j = 0; j < h; j++) {
      for (var i = 0; i < w; i++) {
        var v = n.fbm(i / w * scale, j / h * scale, oct || 4);
        var p = (j * w + i) * 4;
        var col = v < 0.5 ? [U.lerp(D[0], B[0], v * 2), U.lerp(D[1], B[1], v * 2), U.lerp(D[2], B[2], v * 2)]
                          : [U.lerp(B[0], L[0], (v - 0.5) * 2), U.lerp(B[1], L[1], (v - 0.5) * 2), U.lerp(B[2], L[2], (v - 0.5) * 2)];
        img.data[p] = col[0]; img.data[p + 1] = col[1]; img.data[p + 2] = col[2]; img.data[p + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // Césped: base de ruido + miles de briznas finas dibujadas encima.
  function grassCanvas(season, size) {
    var c = cv(size || 512), x = ctx2(c), w = c.width;
    var pal = [
      { b: '#4a7a2e', d: '#2f5a1d', l: '#79a844' },   // primavera
      { b: '#517f2c', d: '#33581b', l: '#86ad46' },   // verano
      { b: '#6f7c30', d: '#4c5720', l: '#a9a44e' },
      { b: '#7d8a76', d: '#5b6656', l: '#c8d2cc' }    // invierno (hierba helada)
    ][season];
    noiseFill(c, pal.b, pal.d, pal.l, 5, 5);
    // briznas
    var rnd = S.RNG(700 + season);
    for (var i = 0; i < w * 9; i++) {
      var bx = rnd() * w, by = rnd() * w;
      var len = 3 + rnd() * 7, ang = -1.5 + (rnd() - 0.5) * 1.5;
      var t = rnd();
      x.strokeStyle = t < 0.4 ? pal.d : (t < 0.8 ? pal.l : mix(pal.b, '#ffffff', 0.25));
      x.globalAlpha = 0.35 + rnd() * 0.5;
      x.lineWidth = rnd() < 0.7 ? 1 : 2;
      x.beginPath(); x.moveTo(bx, by);
      x.lineTo(bx + Math.cos(ang) * len * 0.4, by + Math.sin(ang) * len);
      x.stroke();
    }
    x.globalAlpha = 1;
    // florecillas según la estación
    var flor = [['#f2e6a0', '#ffffff', '#e6c0e0'], ['#f2d96a', '#ffffff', '#e08a4a'], ['#d9a24a', '#c08a3a'], null][season];
    if (flor) {
      for (var f = 0; f < w / 4; f++) {
        x.fillStyle = flor[Math.floor(rnd() * flor.length)];
        var fx = rnd() * w, fy = rnd() * w, r = 1 + rnd() * 1.6;
        x.beginPath(); x.arc(fx, fy, r, 0, 6.284); x.fill();
      }
    }
    return c;
  }

  function dirtCanvas(size, snowy) {
    var c = cv(size || 512), x = ctx2(c), w = c.width;
    noiseFill(c, snowy ? '#8f8a80' : '#6b4f34', snowy ? '#6d6a63' : '#4a3623', snowy ? '#cfd6da' : '#8f6f4c', 6, 5);
    var rnd = S.RNG(21);
    // gravilla y piedrecillas
    for (var i = 0; i < w * 2.2; i++) {
      var r = 0.6 + rnd() * 2.4;
      x.fillStyle = rnd() < 0.5 ? 'rgba(120,110,95,.55)' : 'rgba(60,48,34,.5)';
      x.beginPath(); x.arc(rnd() * w, rnd() * w, r, 0, 6.284); x.fill();
    }
    return c;
  }

  // Tierra arada: surcos paralelos con terrones.
  function plowedCanvas(size) {
    var c = cv(size || 512), x = ctx2(c), w = c.width;
    noiseFill(c, '#5a3f28', '#3b2817', '#7a583a', 7, 4);
    var rnd = S.RNG(33);
    for (var r = 0; r < 16; r++) {
      var y = r * (w / 16);
      var g = x.createLinearGradient(0, y, 0, y + w / 16);
      g.addColorStop(0, 'rgba(255,220,180,.16)');
      g.addColorStop(0.45, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,.30)');
      x.fillStyle = g;
      x.fillRect(0, y, w, w / 16);
    }
    for (var i = 0; i < w * 2; i++) {
      x.fillStyle = rnd() < 0.5 ? 'rgba(40,28,16,.5)' : 'rgba(150,120,90,.35)';
      x.beginPath(); x.arc(rnd() * w, rnd() * w, 0.8 + rnd() * 2.6, 0, 6.284); x.fill();
    }
    return c;
  }

  function stoneWallCanvas(size) {
    var W = size || 512;
    var c = cv(W, W), x = ctx2(c), rnd = S.RNG(55);
    // mortero de fondo
    noiseFill(c, '#5f584e', '#4a443c', '#736b60', 10, 4);
    var y = 0, fila = 0;
    while (y < W) {
      var alto = W / 9 * (0.85 + rnd() * 0.3);
      var xx = -rnd() * (W / 6);
      while (xx < W) {
        var ancho = W / 7 * (0.7 + rnd() * 0.8);
        var m = 3;                                  // junta
        var px0 = xx + m, py0 = y + m;
        var pw = ancho - m * 2, ph = alto - m * 2;
        var tono = rnd();
        var base = tono < 0.3 ? '#9c9184' : (tono < 0.55 ? '#867c70' : (tono < 0.8 ? '#b0a698' : '#776e63'));
        // cara del sillar con iluminación propia (arriba claro, abajo oscuro)
        var g = x.createLinearGradient(px0, py0, px0, py0 + ph);
        g.addColorStop(0, mix(base, '#ffffff', 0.22));
        g.addColorStop(0.55, base);
        g.addColorStop(1, mix(base, '#000000', 0.30));
        x.fillStyle = g;
        var r = 3 + rnd() * 3;
        x.beginPath();
        x.moveTo(px0 + r, py0);
        x.arcTo(px0 + pw, py0, px0 + pw, py0 + ph, r);
        x.arcTo(px0 + pw, py0 + ph, px0, py0 + ph, r);
        x.arcTo(px0, py0 + ph, px0, py0, r);
        x.arcTo(px0, py0, px0 + pw, py0, r);
        x.closePath(); x.fill();
        // grano y desconchones de la piedra
        for (var k = 0; k < 26; k++) {
          x.globalAlpha = 0.10 + rnd() * 0.18;
          x.fillStyle = rnd() < 0.5 ? '#2f2b26' : '#ded6c8';
          x.fillRect(px0 + rnd() * pw, py0 + rnd() * ph, 1 + rnd() * 4, 1 + rnd() * 3);
        }
        x.globalAlpha = 1;
        // sombra proyectada dentro de la junta
        x.fillStyle = 'rgba(30,26,22,.45)';
        x.fillRect(px0, py0 + ph, pw + m, m);
        x.fillRect(px0 + pw, py0, m, ph + m);
        xx += ancho;
      }
      y += alto; fila++;
    }
    // manchas de humedad y musgo
    x.globalAlpha = 0.10;
    for (var i = 0; i < 26; i++) {
      x.fillStyle = rnd() < 0.5 ? '#4a5a34' : '#2b2620';
      x.beginPath(); x.arc(rnd() * W, rnd() * W, 8 + rnd() * 30, 0, 6.284); x.fill();
    }
    x.globalAlpha = 1;
    return c;
  }

  function roofTilesCanvas(size, color) {
    var W = size || 512;
    var c = cv(W, W), x = ctx2(c), rnd = S.RNG(71);
    var base = color || '#a34b30';
    x.fillStyle = mix(base, '#000000', 0.45);
    x.fillRect(0, 0, W, W);
    var filas = 8, cols = 9;
    var th = W / filas, tw = W / cols;
    for (var r = 0; r < filas; r++) {
      var py = r * th;
      for (var i = -1; i <= cols; i++) {
        var px0 = i * tw + (r % 2 ? tw / 2 : 0);
        var tono = rnd();
        var col = tono < 0.28 ? mix(base, '#000000', 0.24)
                : (tono < 0.56 ? mix(base, '#ffffff', 0.16)
                : (tono < 0.8 ? base : mix(base, '#6a5a3a', 0.3)));
        // teja árabe: canal curvo con brillo a un lado y sombra al otro
        var g = x.createLinearGradient(px0, 0, px0 + tw, 0);
        g.addColorStop(0, mix(col, '#000000', 0.42));
        g.addColorStop(0.30, mix(col, '#ffffff', 0.20));
        g.addColorStop(0.62, col);
        g.addColorStop(1, mix(col, '#000000', 0.48));
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(px0 + 1, py + th);
        x.lineTo(px0 + 1, py + th * 0.34);
        x.quadraticCurveTo(px0 + tw / 2, py - th * 0.16, px0 + tw - 1, py + th * 0.34);
        x.lineTo(px0 + tw - 1, py + th);
        x.closePath(); x.fill();
        // remate inferior de la hilada (la sombra que deja el solape)
        x.fillStyle = 'rgba(28,14,8,.55)';
        x.fillRect(px0 + 1, py + th - 3, tw - 2, 3);
      }
      // línea de solape entre hiladas
      x.fillStyle = 'rgba(20,10,6,.35)';
      x.fillRect(0, py + th - 1, W, 2);
    }
    // musgo y suciedad acumulada
    x.globalAlpha = 0.13;
    for (var m = 0; m < 45; m++) {
      x.fillStyle = rnd() < 0.55 ? '#54683a' : '#2e211a';
      x.beginPath(); x.arc(rnd() * W, rnd() * W, 4 + rnd() * 16, 0, 6.284); x.fill();
    }
    x.globalAlpha = 1;
    return c;
  }

  function woodCanvas(size, color) {
    var c = cv(size || 512), x = ctx2(c), w = c.width;
    var base = color || '#8a6038';
    noiseFill(c, base, mix(base, '#000000', 0.4), mix(base, '#ffffff', 0.28), 3, 4);
    var rnd = S.RNG(91);
    // veta
    for (var i = 0; i < 160; i++) {
      x.strokeStyle = rnd() < 0.5 ? 'rgba(60,38,20,.30)' : 'rgba(210,175,130,.22)';
      x.lineWidth = 0.7 + rnd() * 2;
      x.beginPath();
      var y0 = rnd() * w;
      x.moveTo(0, y0);
      for (var px = 0; px <= w; px += 32) x.lineTo(px, y0 + Math.sin(px * 0.02 + i) * 3 + (rnd() - 0.5) * 2);
      x.stroke();
    }
    // tablas
    for (var b = 0; b <= 4; b++) {
      x.strokeStyle = 'rgba(35,20,10,.55)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(0, b * w / 4); x.lineTo(w, b * w / 4); x.stroke();
    }
    return c;
  }

  function plasterCanvas(size, color) {
    var c = cv(size || 512);
    var base = color || '#d8c9a8';
    noiseFill(c, base, mix(base, '#000000', 0.22), mix(base, '#ffffff', 0.18), 4, 5);
    var x = ctx2(c), w = c.width, rnd = S.RNG(101);
    x.globalAlpha = 0.10;
    for (var i = 0; i < 200; i++) {
      x.fillStyle = rnd() < 0.5 ? '#000000' : '#ffffff';
      x.fillRect(rnd() * w, rnd() * w, 1 + rnd() * 3, 1 + rnd() * 3);
    }
    x.globalAlpha = 1;
    return c;
  }

  function hayCanvas(size) {
    var c = cv(size || 512), x = ctx2(c), w = c.width;
    noiseFill(c, '#c7a04a', '#8f7434', '#e8d089', 6, 3);
    var rnd = S.RNG(111);
    for (var i = 0; i < w * 8; i++) {
      var bx = rnd() * w, by = rnd() * w, len = 6 + rnd() * 16, ang = rnd() * 6.284;
      x.strokeStyle = rnd() < 0.5 ? 'rgba(240,215,140,.7)' : 'rgba(130,100,45,.6)';
      x.lineWidth = 0.8 + rnd();
      x.beginPath(); x.moveTo(bx, by);
      x.lineTo(bx + Math.cos(ang) * len, by + Math.sin(ang) * len); x.stroke();
    }
    return c;
  }

  // Piel de vaca frisona: manchas negras irregulares sobre blanco.
  function cowHideCanvas(size, spotColor, coverage) {
    var c = cv(size || 512), x = ctx2(c), w = c.width;
    noiseFill(c, '#f2efe6', '#ddd8cc', '#ffffff', 5, 3);
    var rnd = S.RNG(131);
    var n = coverage == null ? 16 : coverage;
    x.fillStyle = spotColor || '#2b241e';
    for (var i = 0; i < n; i++) {
      var cx = rnd() * w, cy = rnd() * w, R = 22 + rnd() * 70;
      x.beginPath();
      var steps = 14;
      for (var s2 = 0; s2 <= steps; s2++) {
        var a = s2 / steps * 6.284;
        var rr = R * (0.55 + 0.65 * Math.abs(Math.sin(a * 2.3 + i) * Math.cos(a * 1.7 + i)));
        var px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        if (s2 === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.closePath(); x.fill();
    }
    // pelo
    x.globalAlpha = 0.12;
    for (var h = 0; h < w * 4; h++) {
      x.strokeStyle = rnd() < 0.5 ? '#000000' : '#ffffff';
      var hx = rnd() * w, hy = rnd() * w;
      x.beginPath(); x.moveTo(hx, hy); x.lineTo(hx + (rnd() - 0.5) * 5, hy + 3 + rnd() * 4); x.stroke();
    }
    x.globalAlpha = 1;
    return c;
  }

  function woolCanvas(size, color) {
    var c = cv(size || 512), x = ctx2(c), w = c.width;
    var base = color || '#efe9dc';
    noiseFill(c, base, mix(base, '#000000', 0.22), '#ffffff', 8, 3);
    var rnd = S.RNG(151);
    for (var i = 0; i < w * 3; i++) {
      var cx = rnd() * w, cy = rnd() * w, r = 4 + rnd() * 10;
      x.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,.55)' : 'rgba(150,140,125,.45)';
      x.lineWidth = 1.4;
      x.beginPath(); x.arc(cx, cy, r, rnd() * 6, rnd() * 6 + 3); x.stroke();
    }
    return c;
  }

  function featherCanvas(size, base, tip) {
    var c = cv(size || 256), x = ctx2(c), w = c.width;
    noiseFill(c, base || '#e8dcc4', mix(base || '#e8dcc4', '#000000', 0.3), '#ffffff', 6, 3);
    var rnd = S.RNG(171);
    for (var i = 0; i < w * 4; i++) {
      var fx = rnd() * w, fy = rnd() * w, len = 5 + rnd() * 12, a = 1.2 + (rnd() - 0.5) * 0.8;
      x.strokeStyle = rnd() < 0.6 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.5)';
      x.lineWidth = 1 + rnd() * 1.6;
      x.beginPath(); x.moveTo(fx, fy);
      x.quadraticCurveTo(fx + Math.cos(a) * len * 0.6, fy + Math.sin(a) * len * 0.6,
                         fx + Math.cos(a) * len, fy + Math.sin(a) * len);
      x.stroke();
    }
    if (tip) {
      x.globalAlpha = 0.35; x.fillStyle = tip;
      for (var t = 0; t < 40; t++) { x.beginPath(); x.arc(rnd() * w, rnd() * w, 6 + rnd() * 18, 0, 6.284); x.fill(); }
      x.globalAlpha = 1;
    }
    return c;
  }

  function barkCanvas(size) {
    var c = cv(size || 256), x = ctx2(c), w = c.width;
    noiseFill(c, '#5f4630', '#3a2a1b', '#7d6144', 4, 5);
    var rnd = S.RNG(191);
    for (var i = 0; i < 90; i++) {
      x.strokeStyle = rnd() < 0.5 ? 'rgba(30,20,12,.55)' : 'rgba(160,130,95,.3)';
      x.lineWidth = 1 + rnd() * 3;
      var sx = rnd() * w;
      x.beginPath(); x.moveTo(sx, 0);
      for (var y = 0; y <= w; y += 24) x.lineTo(sx + Math.sin(y * 0.05 + i) * 5, y);
      x.stroke();
    }
    return c;
  }

  function skinCanvas(size, color) {
    var c = cv(size || 128);
    noiseFill(c, color || '#d8a97e', mix(color || '#d8a97e', '#000000', 0.18), mix(color || '#d8a97e', '#ffffff', 0.12), 4, 3);
    return c;
  }

  function clothCanvas(size, color) {
    var c = cv(size || 256), x = ctx2(c), w = c.width;
    noiseFill(c, color, mix(color, '#000000', 0.25), mix(color, '#ffffff', 0.18), 5, 3);
    // trama del tejido
    x.globalAlpha = 0.10;
    for (var i = 0; i < w; i += 3) {
      x.fillStyle = '#000000'; x.fillRect(i, 0, 1, w);
      x.fillStyle = '#ffffff'; x.fillRect(0, i, w, 1);
    }
    x.globalAlpha = 1;
    return c;
  }

  function metalCanvas(size, color) {
    var c = cv(size || 256), x = ctx2(c), w = c.width;
    noiseFill(c, color, mix(color, '#000000', 0.2), mix(color, '#ffffff', 0.25), 3, 3);
    var rnd = S.RNG(211);
    x.globalAlpha = 0.16;
    for (var i = 0; i < 120; i++) {
      x.strokeStyle = rnd() < 0.5 ? '#000000' : '#ffffff';
      x.lineWidth = 0.6 + rnd();
      var y = rnd() * w;
      x.beginPath(); x.moveTo(0, y); x.lineTo(w, y + (rnd() - 0.5) * 6); x.stroke();
    }
    x.globalAlpha = 1;
    return c;
  }

  function tireCanvas(size) {
    var c = cv(size || 256), x = ctx2(c), w = c.width;
    noiseFill(c, '#232323', '#141414', '#3a3a3a', 4, 3);
    // tacos de tractor en V
    x.fillStyle = '#2e2e2e';
    for (var i = 0; i < 12; i++) {
      var y = i * (w / 12);
      x.save();
      x.translate(0, y);
      x.beginPath();
      x.moveTo(0, 0); x.lineTo(w * 0.5, w / 26); x.lineTo(w * 0.5, w / 12); x.lineTo(0, w / 20);
      x.closePath(); x.fill();
      x.beginPath();
      x.moveTo(w, 0); x.lineTo(w * 0.5, w / 26); x.lineTo(w * 0.5, w / 12); x.lineTo(w, w / 20);
      x.closePath(); x.fill();
      x.restore();
    }
    return c;
  }

  function waterNormalCanvas(size) {
    var c = cv(size || 256);
    noiseFill(c, '#808080', '#606060', '#a0a0a0', 6, 4);
    return normalMapFrom(c, 1.1);
  }

  /* ------------------------------------------------------------- fachadas */
  // Fachada completa de casa de pueblo: piedra + ventanas + puerta pintadas.
  function facadeCanvas(o) {
    var W = 512, H = 512;
    var c = cv(W, H), x = ctx2(c);
    var wall = stoneWallCanvas(512);
    x.drawImage(wall, 0, 0, W, H);
    var rnd = S.RNG(o.seed || 5);

    function window_(wx, wy, ww, wh, lit) {
      // marco
      x.fillStyle = '#e8e0cf'; x.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(wx - 6, wy + wh + 2, ww + 12, 4);
      // cristal
      var g = x.createLinearGradient(wx, wy, wx, wy + wh);
      if (lit) { g.addColorStop(0, '#ffdd9a'); g.addColorStop(1, '#e0a05a'); }
      else { g.addColorStop(0, '#7fa3bd'); g.addColorStop(0.5, '#33506b'); g.addColorStop(1, '#22384d'); }
      x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
      // cuarterones
      x.strokeStyle = '#f2ece0'; x.lineWidth = 5;
      x.beginPath();
      x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh);
      x.moveTo(wx, wy + wh / 2); x.lineTo(wx + ww, wy + wh / 2);
      x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(wx + 4, wy + wh - 6); x.lineTo(wx + ww - 6, wy + 6); x.stroke();
      // contraventanas
      x.fillStyle = o.shutter || '#3f5f3a';
      x.fillRect(wx - 26, wy - 6, 20, wh + 12);
      x.fillRect(wx + ww + 6, wy - 6, 20, wh + 12);
      x.fillStyle = 'rgba(0,0,0,.25)';
      for (var s = 0; s < 7; s++) {
        x.fillRect(wx - 26, wy + s * (wh / 7) + 3, 20, 3);
        x.fillRect(wx + ww + 6, wy + s * (wh / 7) + 3, 20, 3);
      }
    }
    if (o.windows !== false) {
      window_(90, 90, 90, 110, o.lit);
      window_(330, 90, 90, 110, o.lit);
      if (o.tall) { window_(90, 300, 90, 110, o.lit); window_(330, 300, 90, 110, o.lit); }
    }
    return c;
  }

  function doorCanvas(color) {
    var c = cv(256, 512), x = ctx2(c);
    var wood = woodCanvas(256, color || '#6b4526');
    x.drawImage(wood, 0, 0, 256, 512);
    x.strokeStyle = 'rgba(30,18,8,.7)'; x.lineWidth = 8;
    x.strokeRect(14, 14, 228, 484);
    x.strokeRect(34, 40, 188, 190);
    x.strokeRect(34, 260, 188, 210);
    // herrajes
    x.fillStyle = '#3a3a3a';
    x.beginPath(); x.arc(210, 256, 12, 0, 6.284); x.fill();
    x.fillStyle = '#5a5a5a';
    x.fillRect(20, 60, 40, 14); x.fillRect(20, 420, 40, 14);
    return c;
  }

  /* --------------------------------------------------------------- caché */
  var cache = {};
  function make(key, fn) {
    if (!cache[key]) cache[key] = fn();
    return cache[key];
  }

  var T = S.TX = {
    cv: cv, ctx2: ctx2, mix: mix, noiseFill: noiseFill,
    normalMapFrom: normalMapFrom, roughFrom: roughFrom, tex: tex, texLinear: texLinear,
    grassCanvas: grassCanvas, dirtCanvas: dirtCanvas, plowedCanvas: plowedCanvas,
    stoneWallCanvas: stoneWallCanvas, roofTilesCanvas: roofTilesCanvas, woodCanvas: woodCanvas,
    plasterCanvas: plasterCanvas, hayCanvas: hayCanvas, cowHideCanvas: cowHideCanvas,
    woolCanvas: woolCanvas, featherCanvas: featherCanvas, barkCanvas: barkCanvas,
    skinCanvas: skinCanvas, clothCanvas: clothCanvas, metalCanvas: metalCanvas,
    tireCanvas: tireCanvas, waterNormalCanvas: waterNormalCanvas,
    facadeCanvas: facadeCanvas, doorCanvas: doorCanvas,

    // Material estándar con color + normal + rugosidad derivados de un canvas
    matFrom: function (canvas, opts) {
      opts = opts || {};
      var m = new THREE.MeshStandardMaterial({
        map: tex(canvas, opts.repeat || 1, opts.aniso),
        normalMap: texLinear(normalMapFrom(canvas, opts.bump == null ? 2.2 : opts.bump), opts.repeat || 1),
        roughnessMap: texLinear(roughFrom(canvas, opts.roughLo, opts.roughHi), opts.repeat || 1),
        roughness: opts.roughness == null ? 1 : opts.roughness,
        metalness: opts.metalness == null ? 0 : opts.metalness,
        color: opts.color == null ? 0xffffff : opts.color
      });
      if (opts.normalScale) m.normalScale.set(opts.normalScale, opts.normalScale);
      return m;
    },
    make: make,
    cache: cache
  };

})(window);
