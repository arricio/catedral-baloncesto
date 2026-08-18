/* ============================================================================
   SORRÍOS DE ORDÁS 3D — models.js
   Construcción procedural de edificios (casa, cuadra, gallinero, tiendas,
   iglesia, silo), vegetación instanciada, vallas y aperos de la granja.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, TX = S.TX;

  var MAT = {};   // materiales compartidos

  function initMaterials(season) {
    MAT.stone = TX.matFrom(TX.stoneWallCanvas(512), { repeat: 1, bump: 2.6, roughness: 1 });
    MAT.stoneWall = TX.matFrom(TX.stoneWallCanvas(512), { repeat: 3, bump: 2.6 });
    MAT.plaster = TX.matFrom(TX.plasterCanvas(512, '#ddceac'), { repeat: 2, bump: 1.2 });
    MAT.plasterWhite = TX.matFrom(TX.plasterCanvas(512, '#e8e2d2'), { repeat: 2, bump: 1.2 });
    MAT.roof = TX.matFrom(TX.roofTilesCanvas(512, '#a34b30'), { repeat: 4, bump: 3.0 });
    MAT.roofDark = TX.matFrom(TX.roofTilesCanvas(512, '#6d4432'), { repeat: 4, bump: 3.0 });
    MAT.roofSlate = TX.matFrom(TX.roofTilesCanvas(512, '#5a5f66'), { repeat: 4, bump: 2.6 });
    MAT.wood = TX.matFrom(TX.woodCanvas(512, '#8a6038'), { repeat: 2, bump: 2.0 });
    MAT.woodDark = TX.matFrom(TX.woodCanvas(512, '#5f4128'), { repeat: 2, bump: 2.0 });
    MAT.woodRed = TX.matFrom(TX.woodCanvas(512, '#9a3b2c'), { repeat: 3, bump: 2.0 });
    MAT.door = TX.matFrom(TX.doorCanvas('#6b4526'), { repeat: 1, bump: 2.0 });
    MAT.hay = TX.matFrom(TX.hayCanvas(512), { repeat: 2, bump: 2.4 });
    MAT.bark = TX.matFrom(TX.barkCanvas(256), { repeat: 2, bump: 2.6 });
    MAT.metal = TX.matFrom(TX.metalCanvas(256, '#b9bfc6'), { repeat: 2, bump: 0.8, metalness: 0.75, roughness: 0.42 });
    MAT.metalGreen = TX.matFrom(TX.metalCanvas(256, '#2f6b34'), { repeat: 1, bump: 0.6, metalness: 0.55, roughness: 0.4 });
    MAT.metalRed = TX.matFrom(TX.metalCanvas(256, '#a02a22'), { repeat: 1, bump: 0.6, metalness: 0.5, roughness: 0.42 });
    MAT.tire = TX.matFrom(TX.tireCanvas(256), { repeat: 1, bump: 3.2, roughness: 0.95 });
    MAT.glass = new THREE.MeshPhysicalMaterial({
      color: 0x9fc4d8, transparent: true, opacity: 0.34, roughness: 0.06,
      metalness: 0, transmission: 0.0, side: THREE.DoubleSide
    });
    MAT.concrete = TX.matFrom(TX.plasterCanvas(512, '#a8a49c'), { repeat: 3, bump: 1.4 });
    S.MAT = MAT;
    return MAT;
  }

  /* ------------------------------------------------------------ ayudantes */
  // Clona un material ajustando la repetición de sus texturas al tamaño real
  // de la superficie: sin esto, los tejados y muros grandes se ven "de topos".
  var _scaledCache = {};
  function matScaled(mat, u, v) {
    var key = (mat.uuid || 'm') + '_' + u.toFixed(2) + '_' + v.toFixed(2);
    if (_scaledCache[key]) return _scaledCache[key];
    var m = mat.clone();
    ['map', 'normalMap', 'roughnessMap'].forEach(function (k) {
      if (mat[k]) {
        var t = mat[k].clone();
        t.needsUpdate = true;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(u, v);
        m[k] = t;
      }
    });
    _scaledCache[key] = m;
    return m;
  }

  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cyl(rt, rb, h, seg, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // Tejado a dos aguas con alero, construido a mano para que las tejas caigan bien
  function gableRoof(w, d, h, mat, overhang) {
    var g = new THREE.Group();
    var o = overhang == null ? 0.45 : overhang;
    var W = w + o * 2, D = d + o * 2;
    var slope = Math.atan2(h, W / 2);
    var len = Math.sqrt(h * h + (W / 2) * (W / 2));
    var thick = 0.16;
    var roofMat = matScaled(mat, Math.max(1, len * 0.30), Math.max(1, D * 0.30));
    for (var s = -1; s <= 1; s += 2) {
      var pane = new THREE.Mesh(new THREE.BoxGeometry(len, thick, D), roofMat);
      pane.position.set(s * W / 4, h / 2, 0);
      pane.rotation.z = -s * slope;
      pane.castShadow = true; pane.receiveShadow = true;
      // que las tejas repitan según el tamaño real
      pane.geometry = pane.geometry.clone();
      g.add(pane);
    }
    // frontones triangulares
    var tri = new THREE.Shape();
    tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, h); tri.closePath();
    var tg = new THREE.ExtrudeGeometry(tri, { depth: 0.22, bevelEnabled: false });
    tg.translate(0, 0, -0.11);
    for (var f = -1; f <= 1; f += 2) {
      var gm = new THREE.Mesh(tg, MAT.plaster);
      gm.position.z = f * d / 2;
      gm.castShadow = true; gm.receiveShadow = true;
      g.add(gm);
    }
    return g;
  }

  function windowFrame(w, h, mat) {
    var g = new THREE.Group();
    var glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.glass);
    g.add(glass);
    var t = 0.09;
    var frame = MAT.plasterWhite;
    g.add(box(w + t * 2, t, t, frame, 0, h / 2, 0.03));
    g.add(box(w + t * 2, t, t, frame, 0, -h / 2, 0.03));
    g.add(box(t, h, t, frame, -w / 2, 0, 0.03));
    g.add(box(t, h, t, frame, w / 2, 0, 0.03));
    g.add(box(t * 0.7, h, t * 0.7, frame, 0, 0, 0.03));
    g.add(box(w, t * 0.7, t * 0.7, frame, 0, 0, 0.03));
    // contraventanas
    var sh = box(w * 0.5, h, 0.06, MAT.woodDark, -w * 0.75, 0, 0.06);
    var sh2 = box(w * 0.5, h, 0.06, MAT.woodDark, w * 0.75, 0, 0.06);
    g.add(sh); g.add(sh2);
    // alféizar
    g.add(box(w + 0.4, 0.1, 0.3, MAT.stone, 0, -h / 2 - 0.08, 0.12));
    return g;
  }

  /* ============================================================ EDIFICIOS */
  // Casa de pueblo leonesa: mampostería, tejado de teja curva y balconada.
  function house(o) {
    o = o || {};
    var w = o.w || 9, d = o.d || 7, h = o.h || 5.2;
    var g = new THREE.Group();
    var wallMat = o.plaster ? MAT.plaster : MAT.stoneWall;

    var walls = box(w, h, d, matScaled(wallMat, w * 0.28, h * 0.28), 0, h / 2, 0);
    g.add(walls);
    // zócalo de piedra
    g.add(box(w + 0.2, 0.9, d + 0.2, MAT.stone, 0, 0.45, 0));
    // tejado
    var roof = gableRoof(w, d, o.roofH || 2.3, o.slate ? MAT.roofSlate : (o.darkRoof ? MAT.roofDark : MAT.roof), 0.5);
    roof.position.y = h;
    g.add(roof);
    // puerta
    var door = box(1.25, 2.3, 0.16, MAT.door, o.doorX || 0, 1.15, d / 2 + 0.02);
    g.add(door);
    g.add(box(1.75, 0.18, 0.5, MAT.stone, o.doorX || 0, 2.38, d / 2 + 0.1));
    // ventanas frontales y laterales
    var wins = o.windows == null ? 2 : o.windows;
    for (var i = 0; i < wins; i++) {
      var wx = -w / 2 + (i + 0.5) * (w / wins);
      if (Math.abs(wx - (o.doorX || 0)) < 1.6) wx += 2.2;
      var wf = windowFrame(1.05, 1.25, wallMat);
      wf.position.set(wx, h * 0.62, d / 2 + 0.06);
      g.add(wf);
    }
    var side = windowFrame(1.0, 1.2, wallMat);
    side.position.set(w / 2 + 0.06, h * 0.6, 0);
    side.rotation.y = Math.PI / 2;
    g.add(side);
    var side2 = windowFrame(1.0, 1.2, wallMat);
    side2.position.set(-w / 2 - 0.06, h * 0.6, 0);
    side2.rotation.y = -Math.PI / 2;
    g.add(side2);
    // la parte de atrás también tiene ventanas: si no, la casa se ve "hueca"
    for (var t = 0; t < 2; t++) {
      var back = windowFrame(1.0, 1.15, wallMat);
      back.position.set(-w / 4 + t * (w / 2), h * 0.62, -d / 2 - 0.06);
      back.rotation.y = Math.PI;
      g.add(back);
    }
    // chimenea humeante
    var ch = box(0.8, 2.2, 0.8, MAT.stone, w * 0.28, h + 1.9, -d * 0.2);
    g.add(ch);
    g.add(box(1.0, 0.18, 1.0, MAT.stone, w * 0.28, h + 3.0, -d * 0.2));
    g.userData.chimney = new THREE.Vector3(w * 0.28, h + 3.1, -d * 0.2);
    g.userData.size = { w: w, d: d, h: h };
    g.userData.door = new THREE.Vector3(o.doorX || 0, 0, d / 2 + 1.2);
    return g;
  }

  // Nave / cuadra grande con portón, típica de explotación ganadera.
  function barn(o) {
    o = o || {};
    var w = o.w || 20, d = o.d || 12, h = o.h || 5.5;
    var g = new THREE.Group();
    g.add(box(w, h, d, matScaled(MAT.woodRed, w * 0.22, h * 0.22), 0, h / 2, 0));
    g.add(box(w + 0.2, 1.0, d + 0.2, MAT.concrete, 0, 0.5, 0));
    // vigas blancas
    for (var i = -2; i <= 2; i++) {
      g.add(box(0.35, h, 0.2, MAT.plasterWhite, i * (w / 5), h / 2, d / 2 + 0.05));
      g.add(box(0.35, h, 0.2, MAT.plasterWhite, i * (w / 5), h / 2, -d / 2 - 0.05));
    }
    g.add(box(w, 0.4, 0.22, MAT.plasterWhite, 0, h - 0.3, d / 2 + 0.05));
    g.add(box(w, 0.4, 0.22, MAT.plasterWhite, 0, h - 0.3, -d / 2 - 0.05));
    var roof = gableRoof(w, d, 3.2, MAT.roofDark, 0.6);
    roof.position.y = h;
    g.add(roof);
    // portón corredero
    var pw = 5.5;
    g.add(box(pw, 4.0, 0.2, MAT.woodDark, 0, 2.0, d / 2 + 0.06));
    g.add(box(pw - 0.3, 3.7, 0.1, MAT.wood, 0, 2.0, d / 2 + 0.16));
    g.add(box(pw + 0.6, 0.22, 0.3, MAT.metal, 0, 4.15, d / 2 + 0.12));
    // ventanuco del henil
    var hv = box(2.0, 1.4, 0.2, MAT.woodDark, 0, h + 1.3, d / 2 + 0.05);
    g.add(hv);
    g.userData.size = { w: w, d: d, h: h };
    g.userData.door = new THREE.Vector3(0, 0, d / 2 + 1.6);
    return g;
  }

  function coop(o) {
    o = o || {};
    var w = o.w || 6, d = o.d || 4.5, h = o.h || 2.4;
    var g = new THREE.Group();
    g.add(box(w, h, d, MAT.wood, 0, h / 2, 0));
    var roof = gableRoof(w, d, 1.1, MAT.roofDark, 0.35);
    roof.position.y = h;
    g.add(roof);
    g.add(box(1.0, 1.6, 0.12, MAT.woodDark, 0, 0.8, d / 2 + 0.02));
    // rampa y palo de gallinas
    var ramp = box(0.9, 0.08, 1.6, MAT.woodDark, 0, 0.35, d / 2 + 0.8);
    ramp.rotation.x = -0.35;
    g.add(ramp);
    g.add(box(w - 0.6, 0.12, 0.12, MAT.woodDark, 0, h * 0.6, -d / 2 + 0.3));
    g.userData.size = { w: w, d: d, h: h };
    g.userData.door = new THREE.Vector3(0, 0, d / 2 + 1.2);
    return g;
  }

  // Silo metálico: la silueta más reconocible de una granja moderna.
  function silo(o) {
    o = o || {};
    var r = o.r || 2.6, h = o.h || 12;
    var g = new THREE.Group();
    var body = cyl(r, r, h, 20, MAT.metal, 0, h / 2, 0);
    g.add(body);
    // aros
    for (var i = 1; i < 6; i++) {
      var ring = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.06, 6, 20), MAT.metal);
      ring.position.y = i * (h / 6);
      ring.rotation.x = Math.PI / 2;
      ring.castShadow = true;
      g.add(ring);
    }
    var cone = new THREE.Mesh(new THREE.ConeGeometry(r + 0.25, 1.6, 20), MAT.metal);
    cone.position.y = h + 0.8; cone.castShadow = true;
    g.add(cone);
    g.add(cyl(0.12, 0.12, 1.2, 8, MAT.metal, 0, h + 2.1, 0));
    // escalerilla
    for (var s = 0; s < h * 2; s++) {
      g.add(box(0.5, 0.05, 0.05, MAT.metal, 0, 0.4 + s * 0.5, r + 0.18));
    }
    g.add(box(0.05, h, 0.05, MAT.metal, -0.25, h / 2, r + 0.18));
    g.add(box(0.05, h, 0.05, MAT.metal, 0.25, h / 2, r + 0.18));
    g.userData.size = { w: r * 2, d: r * 2, h: h };
    return g;
  }

  // Cobertizo abierto para el tractor y los aperos
  function shed(o) {
    o = o || {};
    var w = o.w || 12, d = o.d || 7, h = o.h || 4.2;
    var g = new THREE.Group();
    g.add(box(w, h, 0.3, MAT.woodRed, 0, h / 2, -d / 2));
    g.add(box(0.3, h, d, MAT.woodRed, -w / 2, h / 2, 0));
    g.add(box(0.3, h, d, MAT.woodRed, w / 2, h / 2, 0));
    var roof = gableRoof(w, d, 1.6, MAT.roofDark, 0.5);
    roof.position.y = h;
    g.add(roof);
    for (var i = -1; i <= 1; i += 2) g.add(box(0.28, h, 0.28, MAT.woodDark, i * w * 0.32, h / 2, d / 2 - 0.2));
    g.add(box(w, 0.05, d, MAT.concrete, 0, 0.03, 0));
    g.userData.size = { w: w, d: d, h: h };
    return g;
  }

  function shop(o) {
    o = o || {};
    var g = house({ w: o.w || 10, d: o.d || 8, h: 5, plaster: true, windows: 2, darkRoof: o.darkRoof });
    // toldo
    var awn = box((o.w || 10) * 0.62, 0.12, 1.6, o.awning === 'verde' ? MAT.metalGreen : MAT.metalRed, 0, 3.0, (o.d || 8) / 2 + 0.8);
    awn.rotation.x = 0.22;
    g.add(awn);
    // cartel
    var canvas = TX.cv(512, 128), cx = canvas.getContext('2d');
    cx.fillStyle = o.signBg || '#3d2a18'; cx.fillRect(0, 0, 512, 128);
    cx.strokeStyle = '#d9b45c'; cx.lineWidth = 8; cx.strokeRect(8, 8, 496, 112);
    cx.fillStyle = o.signFg || '#f2d98a';
    cx.font = 'bold 54px Georgia, serif';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(o.sign || 'TIENDA', 256, 66);
    var signMat = new THREE.MeshStandardMaterial({ map: TX.tex(canvas, 1, 8), roughness: 0.7 });
    var sign = new THREE.Mesh(new THREE.BoxGeometry((o.w || 10) * 0.6, 1.1, 0.16), [
      MAT.woodDark, MAT.woodDark, MAT.woodDark, MAT.woodDark, signMat, MAT.woodDark
    ]);
    sign.position.set(0, 3.9, (o.d || 8) / 2 + 0.14);
    sign.castShadow = true;
    g.add(sign);
    return g;
  }

  function church(o) {
    o = o || {};
    var g = new THREE.Group();
    var w = 12, d = 18, h = 7;
    g.add(box(w, h, d, matScaled(MAT.stoneWall, w * 0.25, h * 0.25), 0, h / 2, 0));
    var roof = gableRoof(w, d, 3.0, MAT.roofSlate, 0.5);
    roof.position.y = h;
    g.add(roof);
    // torre del campanario
    var tw = 5, th = 15;
    var tower = box(tw, th, tw, MAT.stoneWall, 0, th / 2, -d / 2 - tw / 2 + 0.4);
    g.add(tower);
    var spire = new THREE.Mesh(new THREE.ConeGeometry(tw * 0.78, 5, 4), MAT.roofSlate);
    spire.position.set(0, th + 2.5, -d / 2 - tw / 2 + 0.4);
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = true;
    g.add(spire);
    // vanos del campanario
    for (var s = 0; s < 4; s++) {
      var a = s * Math.PI / 2;
      var hole = box(1.6, 2.4, 0.3, MAT.woodDark,
        Math.sin(a) * (tw / 2), th - 2.2, -d / 2 - tw / 2 + 0.4 + Math.cos(a) * (tw / 2));
      hole.rotation.y = a;
      g.add(hole);
    }
    // cruz
    g.add(box(0.16, 1.8, 0.16, MAT.metal, 0, th + 6.0, -d / 2 - tw / 2 + 0.4));
    g.add(box(0.9, 0.16, 0.16, MAT.metal, 0, th + 6.4, -d / 2 - tw / 2 + 0.4));
    // portada y rosetón
    g.add(box(2.0, 3.2, 0.2, MAT.door, 0, 1.6, d / 2 + 0.02));
    var rose = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), MAT.glass);
    rose.position.set(0, 5.2, d / 2 + 0.06);
    g.add(rose);
    var arch = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.14, 6, 16), MAT.stone);
    arch.position.set(0, 5.2, d / 2 + 0.08);
    g.add(arch);
    // ventanales laterales
    for (var i = -1; i <= 1; i++) {
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var wf = windowFrame(0.9, 2.2, MAT.stoneWall);
        wf.position.set(sgn * (w / 2 + 0.06), 4.2, i * 4.5);
        wf.rotation.y = sgn * Math.PI / 2;
        g.add(wf);
      }
    }
    g.userData.size = { w: w, d: d + tw, h: h };
    g.userData.door = new THREE.Vector3(0, 0, d / 2 + 1.4);
    return g;
  }

  /* ============================================================ APEROS === */
  function trough() {
    var g = new THREE.Group();
    var m = MAT.woodDark;
    g.add(box(3.2, 0.12, 0.9, m, 0, 0.34, 0));
    g.add(box(3.2, 0.5, 0.1, m, 0, 0.55, 0.4));
    g.add(box(3.2, 0.5, 0.1, m, 0, 0.55, -0.4));
    g.add(box(0.1, 0.5, 0.9, m, 1.6, 0.55, 0));
    g.add(box(0.1, 0.5, 0.9, m, -1.6, 0.55, 0));
    for (var i = -1; i <= 1; i += 2) {
      g.add(box(0.14, 0.35, 0.14, m, i * 1.4, 0.17, 0.35));
      g.add(box(0.14, 0.35, 0.14, m, i * 1.4, 0.17, -0.35));
    }
    var feed = box(3.0, 0.22, 0.72, MAT.hay, 0, 0.5, 0);
    feed.name = 'comida';
    g.add(feed);
    g.userData.feedMesh = feed;
    return g;
  }

  // Bala redonda de forraje: icono absoluto del simulador agrícola
  function roundBale(wrapped) {
    var g = new THREE.Group();
    var mat = wrapped
      ? new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.42, metalness: 0.02 })
      : MAT.hay;
    var b = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 20), mat);
    b.rotation.z = Math.PI / 2;
    b.position.y = 0.75;
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
    if (!wrapped) {
      for (var i = 0; i < 3; i++) {
        var band = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.02, 5, 18), MAT.metal);
        band.position.set(-0.35 + i * 0.35, 0.75, 0);
        band.rotation.y = Math.PI / 2;
        g.add(band);
      }
    }
    return g;
  }

  function squareBale() {
    var g = new THREE.Group();
    var b = box(1.1, 0.5, 0.5, MAT.hay, 0, 0.25, 0);
    g.add(b);
    for (var i = -1; i <= 1; i += 2) {
      var s = box(1.12, 0.03, 0.03, MAT.woodDark, 0, 0.25, i * 0.15);
      g.add(s);
    }
    return g;
  }

  function well() {
    var g = new THREE.Group();
    var ring = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 1.0, 16), MAT.stone);
    ring.position.y = 0.5; ring.castShadow = true; ring.receiveShadow = true;
    g.add(ring);
    var water = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16),
      new THREE.MeshStandardMaterial({ color: 0x1e4356, roughness: 0.1, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.72;
    g.add(water);
    g.add(box(0.14, 1.9, 0.14, MAT.woodDark, -0.85, 1.4, 0));
    g.add(box(0.14, 1.9, 0.14, MAT.woodDark, 0.85, 1.4, 0));
    var roof = gableRoof(2.3, 1.5, 0.55, MAT.roofDark, 0.12);
    roof.position.y = 2.25;
    roof.scale.set(0.85, 1, 0.85);
    g.add(roof);
    g.add(cyl(0.09, 0.09, 1.6, 8, MAT.wood, 0, 2.1, 0).rotateZ(Math.PI / 2));
    var bucket = cyl(0.2, 0.16, 0.3, 10, MAT.metal, 0, 1.4, 0);
    g.add(bucket);
    return g;
  }

  function streetLamp() {
    var g = new THREE.Group();
    g.add(cyl(0.08, 0.12, 4.2, 8, MAT.metal, 0, 2.1, 0));
    g.add(box(0.5, 0.1, 0.5, MAT.metal, 0, 4.15, 0));
    var glass = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xffe4a8, emissive: 0xffc864, emissiveIntensity: 0, roughness: 0.3 }));
    glass.position.y = 3.85;
    g.add(glass);
    g.userData.lampGlass = glass;
    var light = new THREE.PointLight(0xffc981, 0, 16, 2);
    light.position.y = 3.8;
    g.add(light);
    g.userData.light = light;
    return g;
  }

  function fenceSection() {
    var g = new THREE.Group();
    g.add(box(0.14, 1.35, 0.14, MAT.woodDark, 0, 0.67, 0));
    return g;
  }

  /* -------------------------------------------------- vallas instanciadas */
  function FenceRun(scene, points, opts) {
    opts = opts || {};
    var step = opts.step || 2.2;
    var terrain = opts.terrain;
    var posts = [], rails = [];
    for (var i = 0; i < points.length - 1; i++) {
      var a = points[i], b = points[i + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var len = Math.hypot(dx, dz);
      var n = Math.max(1, Math.round(len / step));
      for (var k = 0; k < n; k++) {
        var t0 = k / n, t1 = (k + 1) / n;
        var x0 = a[0] + dx * t0, z0 = a[1] + dz * t0;
        var x1 = a[0] + dx * t1, z1 = a[1] + dz * t1;
        posts.push([x0, z0]);
        rails.push([x0, z0, x1, z1]);
      }
      if (i === points.length - 2) posts.push([b[0], b[1]]);
    }
    var postGeo = new THREE.BoxGeometry(0.13, 1.35, 0.13);
    postGeo.translate(0, 0.67, 0);
    var pm = new THREE.InstancedMesh(postGeo, MAT.woodDark, posts.length);
    pm.castShadow = true; pm.receiveShadow = true;
    var dummy = new THREE.Object3D();
    for (var p = 0; p < posts.length; p++) {
      var y = terrain ? terrain.heightAt(posts[p][0], posts[p][1]) : 0;
      dummy.position.set(posts[p][0], y, posts[p][1]);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pm.setMatrixAt(p, dummy.matrix);
    }
    pm.instanceMatrix.needsUpdate = true;
    scene.add(pm);

    var railGeo = new THREE.BoxGeometry(1, 0.11, 0.07);
    var rm = new THREE.InstancedMesh(railGeo, MAT.wood, rails.length * 2);
    rm.castShadow = true; rm.receiveShadow = true;
    var idx = 0;
    for (var r = 0; r < rails.length; r++) {
      var rr = rails[r];
      var mx = (rr[0] + rr[2]) / 2, mz = (rr[1] + rr[3]) / 2;
      var ln = Math.hypot(rr[2] - rr[0], rr[3] - rr[1]);
      var ang = Math.atan2(rr[3] - rr[1], rr[2] - rr[0]);
      var yy = terrain ? terrain.heightAt(mx, mz) : 0;
      for (var lvl = 0; lvl < 2; lvl++) {
        dummy.position.set(mx, yy + 0.55 + lvl * 0.45, mz);
        dummy.rotation.set(0, -ang, 0);
        dummy.scale.set(ln, 1, 1);
        dummy.updateMatrix();
        rm.setMatrixAt(idx++, dummy.matrix);
      }
    }
    rm.instanceMatrix.needsUpdate = true;
    scene.add(rm);
    this.posts = posts;
    this.meshes = [pm, rm];
  }

  /* ============================================================ ÁRBOLES = */
  function foliageGeometry(r, seed) {
    var geo = new THREE.IcosahedronGeometry(r, 1);
    var pos = geo.attributes.position;
    var rnd = S.RNG(seed || 7);
    for (var i = 0; i < pos.count; i++) {
      var v = new THREE.Vector3().fromBufferAttribute(pos, i);
      var f = 0.78 + rnd() * 0.42;
      v.multiplyScalar(f);
      v.y *= 0.86;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  var SEASON_LEAF = [
    { c: 0x4f8a2f, c2: 0x6fae45 },   // primavera
    { c: 0x3d7a28, c2: 0x5f9c3a },   // verano
    { c: 0xb4702a, c2: 0xd39a3a },   // otoño
    { c: 0x6b6f5e, c2: 0x8a8e7c }    // invierno (rama pelada)
  ];

  // Bosque instanciado: un solo par de mallas para cientos de árboles.
  function Forest(scene, terrain, list, season, quality) {
    this.groups = [];
    var byType = { roble: [], pino: [], chopo: [] };
    for (var i = 0; i < list.length; i++) {
      (byType[list[i].t] || byType.roble).push(list[i]);
    }
    var dummy = new THREE.Object3D();
    var leaf = SEASON_LEAF[season];

    function build(items, kind) {
      if (!items.length) return;
      var trunkGeo, folGeo, folMat, trunkH;
      if (kind === 'pino') {
        trunkH = 2.2;
        trunkGeo = new THREE.CylinderGeometry(0.16, 0.34, 6.5, 8);
        trunkGeo.translate(0, 3.25, 0);
        folGeo = new THREE.ConeGeometry(2.1, 6.4, 9);
        folGeo.translate(0, 5.6, 0);
        folMat = new THREE.MeshStandardMaterial({
          color: season === 3 ? 0x2f5c46 : 0x2c6b3a, roughness: 0.95, flatShading: true
        });
      } else if (kind === 'chopo') {
        trunkGeo = new THREE.CylinderGeometry(0.14, 0.3, 8, 8);
        trunkGeo.translate(0, 4, 0);
        folGeo = new THREE.SphereGeometry(1.5, 8, 8);
        folGeo.scale(1, 2.6, 1);
        folGeo.translate(0, 7.4, 0);
        folMat = new THREE.MeshStandardMaterial({
          color: leaf.c2, roughness: 0.92, flatShading: true, transparent: season === 3, opacity: season === 3 ? 0.35 : 1
        });
      } else {
        trunkGeo = new THREE.CylinderGeometry(0.24, 0.55, 3.4, 9);
        trunkGeo.translate(0, 1.7, 0);
        folGeo = foliageGeometry(2.5, 11);
        folGeo.translate(0, 4.6, 0);
        folMat = new THREE.MeshStandardMaterial({
          color: leaf.c, roughness: 0.94, flatShading: true,
          transparent: season === 3, opacity: season === 3 ? 0.3 : 1
        });
      }
      var tm = new THREE.InstancedMesh(trunkGeo, MAT.bark, items.length);
      var fm = new THREE.InstancedMesh(folGeo, folMat, items.length);
      // Segunda copa desplazada: rompe la silueta y da volumen al árbol
      var fol2 = folGeo.clone();
      fol2.scale(0.68, 0.62, 0.68);
      fol2.translate(0.9, kind === 'pino' ? -1.4 : 1.1, -0.6);
      var fm2 = new THREE.InstancedMesh(fol2, folMat, items.length);
      [tm, fm, fm2].forEach(function (m) { m.castShadow = true; m.receiveShadow = true; });
      var col = new THREE.Color();
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var y = terrain.heightAt(it.x, it.z);
        var s = it.s || 1;
        dummy.position.set(it.x, y, it.z);
        dummy.rotation.set(0, it.r || 0, 0);
        dummy.scale.set(s, s * (0.9 + Math.random() * 0.25), s);
        dummy.updateMatrix();
        tm.setMatrixAt(i, dummy.matrix);
        fm.setMatrixAt(i, dummy.matrix);
        fm2.setMatrixAt(i, dummy.matrix);
        // cada árbol con su tono: un bosque monocromo canta muchísimo
        var v = 0.78 + Math.random() * 0.42;
        col.setRGB(v * (0.92 + Math.random() * 0.16), v, v * (0.85 + Math.random() * 0.2));
        fm.setColorAt(i, col);
        col.multiplyScalar(0.88);
        fm2.setColorAt(i, col);
      }
      tm.instanceMatrix.needsUpdate = true;
      fm.instanceMatrix.needsUpdate = true;
      fm2.instanceMatrix.needsUpdate = true;
      if (fm.instanceColor) fm.instanceColor.needsUpdate = true;
      if (fm2.instanceColor) fm2.instanceColor.needsUpdate = true;
      scene.add(tm); scene.add(fm); scene.add(fm2);
      return { trunk: tm, foliage: fm, foliage2: fm2 };
    }
    this.roble = build(byType.roble, 'roble');
    this.pino = build(byType.pino, 'pino');
    this.chopo = build(byType.chopo, 'chopo');
  }

  function bushClump(season) {
    var g = new THREE.Group();
    var leaf = SEASON_LEAF[season];
    var mat = new THREE.MeshStandardMaterial({ color: leaf.c, roughness: 0.95, flatShading: true });
    for (var i = 0; i < 3; i++) {
      var r = 0.5 + Math.random() * 0.4;
      var m = new THREE.Mesh(foliageGeometry(r, 20 + i), mat);
      m.position.set((Math.random() - 0.5) * 0.9, r * 0.75, (Math.random() - 0.5) * 0.9);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    }
    return g;
  }

  function rock(scale) {
    var geo = new THREE.DodecahedronGeometry(scale || 0.6, 0);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var v = new THREE.Vector3().fromBufferAttribute(pos, i);
      v.multiplyScalar(0.75 + Math.random() * 0.5);
      v.y *= 0.7;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, MAT.stone);
    m.castShadow = true; m.receiveShadow = true;
    m.position.y = (scale || 0.6) * 0.35;
    return m;
  }

  S.Models = {
    initMaterials: initMaterials, MAT: MAT,
    box: box, cyl: cyl, gableRoof: gableRoof, windowFrame: windowFrame, matScaled: matScaled,
    house: house, barn: barn, coop: coop, silo: silo, shed: shed, shop: shop, church: church,
    trough: trough, roundBale: roundBale, squareBale: squareBale, well: well,
    streetLamp: streetLamp, fenceSection: fenceSection, FenceRun: FenceRun,
    Forest: Forest, bushClump: bushClump, rock: rock, foliageGeometry: foliageGeometry,
    SEASON_LEAF: SEASON_LEAF
  };

})(window);
