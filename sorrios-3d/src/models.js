/* ============================================================================
   SORRÍOS DE ORDÁS 3D — models.js
   Construcción procedural de edificios (casa, cuadra, gallinero, tiendas,
   ermita, panera), vegetación, vallas y aperos de tracción animal.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, TX = S.TX;

  var MAT = {};   // materiales compartidos

  function initMaterials(season) {
    MAT.stone = TX.matFrom(TX.stoneWallCanvas(512), { repeat: 1, bump: 2.6, roughness: 1 });
    MAT.stoneWall = TX.matFrom(TX.stoneWallCanvas(512), { repeat: 3, bump: 2.6 });
    MAT.plaster = TX.matFrom(TX.plasterCanvas(512, '#cfc0a2'), { repeat: 2, bump: 0.35, roughLo: 0.86, roughHi: 1 });
    MAT.plasterWhite = TX.matFrom(TX.plasterCanvas(512, '#ddd6c4'), { repeat: 2, bump: 0.35, roughLo: 0.86, roughHi: 1 });
    MAT.roof = TX.matFrom(TX.roofTilesCanvas(512, '#96513a'), { repeat: 4, bump: 3.0 });
    MAT.roofDark = TX.matFrom(TX.roofTilesCanvas(512, '#6d4d3a'), { repeat: 4, bump: 3.0 });
    MAT.roofSlate = TX.matFrom(TX.roofTilesCanvas(512, '#5a5f66'), { repeat: 4, bump: 2.6 });
    MAT.wood = TX.matFrom(TX.woodCanvas(512, '#7d5836'), { repeat: 2, bump: 2.0 });
    MAT.woodDark = TX.matFrom(TX.woodCanvas(512, '#573b24'), { repeat: 2, bump: 2.0 });
    // La tenada del país es de tablas viejas curtidas, no un granero rojo
    MAT.woodRed = TX.matFrom(TX.woodCanvas(512, '#6b4a33'), { repeat: 3, bump: 2.2 });
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
    g.add(box(w + 0.2, 0.9, d + 0.2, matScaled(MAT.stone, (w + 0.2) / 3.2, 0.9 / 2.2), 0, 0.45, 0));
    // tejado
    var roof = gableRoof(w, d, o.roofH || 2.3, o.slate ? MAT.roofSlate : (o.darkRoof ? MAT.roofDark : MAT.roof), 0.5);
    roof.position.y = h;
    g.add(roof);
    // puerta
    var door = box(1.25, 2.3, 0.16, MAT.door, o.doorX || 0, 1.15, d / 2 + 0.02);
    g.add(door);
    g.add(box(1.75, 0.18, 0.5, matScaled(MAT.stone, 1.75 / 3.2, 0.18 / 2.2), o.doorX || 0, 2.38, d / 2 + 0.1));
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
    var pie = matScaled(MAT.stone, 0.8 / 3.2, 2.2 / 2.2);
    var ch = box(0.8, 2.2, 0.8, pie, w * 0.28, h + 1.9, -d * 0.2);
    g.add(ch);
    g.add(box(1.0, 0.18, 1.0, pie, w * 0.28, h + 3.0, -d * 0.2));
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

  // Panera leonesa (hórreo): el granero de siempre, levantado sobre pilares
  // de piedra para que no suba la humedad ni los ratones.
  function panera(o) {
    o = o || {};
    var w = o.w || 6, d = o.d || 4.2, h = o.h || 2.6;
    var g = new THREE.Group();
    var suelo = 2.0;
    // pegollos (pilares) con su muela encima
    for (var i = -1; i <= 1; i += 2) {
      for (var j = -1; j <= 1; j += 2) {
        var px = i * (w / 2 - 0.6), pz = j * (d / 2 - 0.5);
        g.add(cyl(0.28, 0.36, suelo - 0.3, 8, MAT.stone, px, (suelo - 0.3) / 2, pz));
        var muela = cyl(0.62, 0.5, 0.22, 10, MAT.stone, px, suelo - 0.18, pz);
        g.add(muela);
      }
    }
    if (w > 7) {
      for (var k = -1; k <= 1; k += 2) {
        g.add(cyl(0.28, 0.36, suelo - 0.3, 8, MAT.stone, 0, (suelo - 0.3) / 2, k * (d / 2 - 0.5)));
        g.add(cyl(0.62, 0.5, 0.22, 10, MAT.stone, 0, suelo - 0.18, k * (d / 2 - 0.5)));
      }
    }
    // cuerpo de madera con tablas verticales
    g.add(box(w, 0.18, d, MAT.woodDark, 0, suelo, 0));
    var cuerpo = box(w - 0.2, h, d - 0.2, matScaled(MAT.wood, w * 0.5, h * 0.5), 0, suelo + h / 2 + 0.09, 0);
    g.add(cuerpo);
    for (var t = -Math.floor(w / 0.5) / 2; t <= Math.floor(w / 0.5) / 2; t++) {
      g.add(box(0.06, h, 0.06, MAT.woodDark, t * 0.5, suelo + h / 2 + 0.09, d / 2 - 0.08));
      g.add(box(0.06, h, 0.06, MAT.woodDark, t * 0.5, suelo + h / 2 + 0.09, -d / 2 + 0.08));
    }
    // puertecilla
    g.add(box(0.9, 1.5, 0.1, MAT.woodDark, 0, suelo + 0.84, d / 2 - 0.02));
    // tejado de teja
    var roof = gableRoof(w, d, 1.2, MAT.roof, 0.55);
    roof.position.y = suelo + h + 0.18;
    g.add(roof);
    // escalera de piedra
    for (var e = 0; e < 4; e++) {
      g.add(box(1.2, 0.22, 0.5, MAT.stone, 0, 0.11 + e * 0.44, d / 2 + 1.4 - e * 0.42));
    }
    g.userData.size = { w: w, d: d + 2, h: suelo + h + 1.2 };
    return g;
  }

  // Tenada: cobertizo abierto donde se guardan el carro y los aperos
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

  // Ermita del pueblo: pequeña, de mampostería, con espadaña de un ojo,
  // pórtico de madera y su campana. Nada de iglesia grande.
  function ermita(o) {
    o = o || {};
    var g = new THREE.Group();
    var w = 7, d = 11, h = 4.2;
    g.add(box(w, h, d, matScaled(MAT.stoneWall, w * 0.3, h * 0.3), 0, h / 2, 0));
    g.add(box(w + 0.25, 0.7, d + 0.25, MAT.stone, 0, 0.35, 0));
    var roof = gableRoof(w, d, 2.0, MAT.roof, 0.6);
    roof.position.y = h;
    g.add(roof);

    // espadaña: el muro que remata la fachada con el hueco de la campana
    var esp = new THREE.Group();
    esp.position.set(0, h + 2.0, d / 2 - 0.25);
    g.add(esp);
    esp.add(box(2.6, 2.6, 0.45, matScaled(MAT.stoneWall, 1.2, 1.2), 0, 1.3, 0));
    // hueco del campanario
    esp.add(box(1.0, 1.2, 0.5, new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 1 }), 0, 1.35, 0.02));
    var arco = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.16, 6, 12, Math.PI), MAT.stone);
    arco.position.set(0, 1.95, 0.02);
    esp.add(arco);
    // campana
    var campana = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.34, 10), MAT.metal);
    campana.position.set(0, 1.5, 0.02);
    esp.add(campana);
    esp.add(box(0.9, 0.07, 0.07, MAT.woodDark, 0, 1.78, 0.02));
    // remate y cruz
    for (var r = 0; r < 8; r++) esp.add(box(2.6 - r * 0.26, 0.14, 0.5, MAT.stone, 0, 2.6 + r * 0.13, 0));
    esp.add(box(0.1, 0.75, 0.1, MAT.metal, 0, 3.9, 0));
    esp.add(box(0.42, 0.1, 0.1, MAT.metal, 0, 4.05, 0));

    // pórtico de madera delante de la puerta
    var por = new THREE.Group();
    por.position.set(0, 0, d / 2 + 1.1);
    g.add(por);
    for (var i = -1; i <= 1; i += 2) por.add(box(0.2, 2.6, 0.2, MAT.woodDark, i * 1.5, 1.3, 0.7));
    var tej = gableRoof(4.0, 2.4, 0.7, MAT.roof, 0.35);
    tej.position.y = 2.6;
    por.add(tej);
    // puerta con clavos
    g.add(box(1.4, 2.4, 0.18, MAT.door, 0, 1.2, d / 2 + 0.02));
    g.add(box(1.8, 0.2, 0.5, MAT.stone, 0, 2.5, d / 2 + 0.12));
    // ventanuco lateral
    for (var lado = -1; lado <= 1; lado += 2) {
      var vt = windowFrame(0.6, 0.9, MAT.stoneWall);
      vt.position.set(lado * (w / 2 + 0.06), 2.4, -1.5);
      vt.rotation.y = lado * Math.PI / 2;
      g.add(vt);
    }
    g.userData.size = { w: w, d: d + 2, h: h };
    g.userData.door = new THREE.Vector3(0, 0, d / 2 + 2.4);
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


  /* ================================================ APEROS DE TIRO ====== */
  // Yugo de cornamenta: la pieza de madera labrada que se ata a la testuz de
  // las vacas con las coyundas de cuero.
  function yugo(largo) {
    var g = new THREE.Group();
    var L = largo || 1.9;
    var mad = matScaled(MAT.woodDark, 2, 1);
    var viga = box(L, 0.20, 0.24, mad, 0, 0, 0);
    g.add(viga);
    // remates tallados en los extremos
    for (var i = -1; i <= 1; i += 2) {
      g.add(box(0.26, 0.30, 0.30, mad, i * L / 2, 0.02, 0));
      // gamellas: los huecos donde apoya el testuz
      g.add(box(0.34, 0.12, 0.34, mad, i * (L / 2 - 0.42), -0.12, 0));
      // coyundas de cuero
      var cor = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 });
      for (var c = 0; c < 3; c++) {
        var cinta = box(0.05, 0.34, 0.30, cor, i * (L / 2 - 0.30 - c * 0.12), -0.20, 0);
        g.add(cinta);
      }
      // subiugas (los palos que sujetan por debajo)
      g.add(box(0.06, 0.34, 0.06, mad, i * (L / 2 - 0.60), -0.20, 0.14));
      g.add(box(0.06, 0.34, 0.06, mad, i * (L / 2 - 0.60), -0.20, -0.14));
    }
    // adorno tallado del centro
    g.add(box(0.40, 0.26, 0.28, mad, 0, 0.02, 0));
    // argolla central de donde tira el apero
    var anilla = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 6, 12), MAT.metal);
    anilla.rotation.x = Math.PI / 2;
    anilla.position.set(0, -0.16, 0);
    g.add(anilla);
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  // Arado romano de madera con reja de hierro: timón, mancera y dental.
  function arado() {
    var g = new THREE.Group();
    var mad = matScaled(MAT.wood, 2, 1);
    var hierro = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.42, metalness: 0.8 });
    // timón: la vara larga que va hasta el yugo
    var timon = box(0.11, 0.11, 3.1, mad, 0, 0.72, 1.15);
    timon.rotation.x = -0.14;
    g.add(timon);
    // cama y dental (la pieza que va por la tierra)
    g.add(box(0.13, 0.16, 1.15, mad, 0, 0.30, -0.35));
    // reja de hierro
    var reja = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.5, 4), hierro);
    reja.rotation.x = -Math.PI / 2 - 0.25;
    reja.rotation.y = Math.PI / 4;
    reja.position.set(0, 0.17, -0.92);
    g.add(reja);
    // orejeras que voltean la tierra
    for (var i = -1; i <= 1; i += 2) {
      var or = box(0.05, 0.26, 0.5, mad, i * 0.11, 0.30, -0.66);
      or.rotation.z = i * 0.5;
      g.add(or);
    }
    // esteva o mancera: el mango por donde se agarra
    var mancera = box(0.09, 1.05, 0.09, mad, 0, 0.80, -0.62);
    mancera.rotation.x = 0.22;
    g.add(mancera);
    g.add(box(0.34, 0.08, 0.08, mad, 0, 1.28, -0.72));
    // cuñas y clavijas
    g.add(box(0.06, 0.24, 0.06, MAT.woodDark, 0, 0.55, 0.32));
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData = { tipo: 'arado', ancho: 0.9, nombre: 'Arado de madera', engancheZ: 2.55 };
    return g;
  }

  // Rueda de carro de radios, con llanta de hierro
  function ruedaCarro(r) {
    var g = new THREE.Group();
    var mad = MAT.woodDark;
    var hierro = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.5, metalness: 0.7 });
    var llanta = new THREE.Mesh(new THREE.TorusGeometry(r, 0.055, 8, 22), hierro);
    g.add(llanta);
    var pina = new THREE.Mesh(new THREE.TorusGeometry(r - 0.07, 0.07, 6, 22), mad);
    g.add(pina);
    for (var i = 0; i < 10; i++) {
      var a = i / 10 * Math.PI * 2;
      var radio = box(0.055, r - 0.16, 0.055, mad, 0, 0, 0);
      radio.position.set(Math.cos(a) * (r / 2 - 0.02), Math.sin(a) * (r / 2 - 0.02), 0);
      radio.rotation.z = a - Math.PI / 2;
      g.add(radio);
    }
    g.add(cyl(0.11, 0.11, 0.26, 10, mad, 0, 0, 0).rotateX(Math.PI / 2));
    g.rotation.y = Math.PI / 2;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }

  // Carro del país: caja de tablas, dos ruedas grandes y pértigo hasta el yugo.
  function carro() {
    var g = new THREE.Group();
    var mad = matScaled(MAT.wood, 3, 1);
    var alturaEje = 0.72;
    // piso
    g.add(box(1.75, 0.12, 3.0, mad, 0, alturaEje + 0.18, -0.2));
    // adrales (los laterales de estacas)
    for (var i = -1; i <= 1; i += 2) {
      g.add(box(0.08, 0.55, 3.0, mad, i * 0.85, alturaEje + 0.5, -0.2));
      for (var e = 0; e < 6; e++) {
        g.add(box(0.07, 0.85, 0.07, MAT.woodDark, i * 0.85, alturaEje + 0.62, -1.6 + e * 0.56));
      }
    }
    g.add(box(1.75, 0.55, 0.08, mad, 0, alturaEje + 0.5, -1.72));
    // eje y ruedas
    g.add(box(2.0, 0.12, 0.12, MAT.woodDark, 0, alturaEje, -0.5));
    var r1 = ruedaCarro(0.72); r1.position.set(-1.02, alturaEje, -0.5); g.add(r1);
    var r2 = ruedaCarro(0.72); r2.position.set(1.02, alturaEje, -0.5); g.add(r2);
    g.userData.ruedas = [r1, r2];
    // pértigo (la lanza que llega al yugo)
    var pertigo = box(0.13, 0.13, 3.2, mad, 0, alturaEje + 0.12, 1.65);
    g.add(pertigo);
    g.add(box(0.5, 0.09, 0.09, MAT.woodDark, 0, alturaEje + 0.12, 3.1));
    // carga de hierba (se muestra cuando va lleno)
    var carga = new THREE.Group();
    var heno = MAT.hay;
    for (var h = 0; h < 5; h++) {
      var mont = new THREE.Mesh(new THREE.SphereGeometry(0.55 + Math.random() * 0.2, 8, 6), heno);
      mont.position.set((Math.random() - 0.5) * 1.1, alturaEje + 0.85 + Math.random() * 0.25, -1.4 + h * 0.62);
      mont.scale.set(1.3, 0.75, 1.1);
      mont.castShadow = true;
      carga.add(mont);
    }
    carga.visible = false;
    g.add(carga);
    g.userData.carga = carga;
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData.tipo = 'carro';
    g.userData.ancho = 1.9;
    g.userData.nombre = 'Carro del país';
    g.userData.engancheZ = 3.1;
    return g;
  }

  // Grada de ramas para desterronar después de arar
  function grada() {
    var g = new THREE.Group();
    var mad = MAT.woodDark;
    for (var i = 0; i < 4; i++) g.add(box(1.5, 0.08, 0.08, mad, 0, 0.25, -i * 0.28));
    for (var j = -2; j <= 2; j++) g.add(box(0.07, 0.08, 1.0, mad, j * 0.34, 0.25, -0.42));
    for (var k = -2; k <= 2; k++) {
      for (var r = 0; r < 4; r++) {
        g.add(box(0.05, 0.22, 0.05, mad, k * 0.34, 0.12, -r * 0.28));
      }
    }
    g.add(box(0.09, 0.09, 2.4, mad, 0, 0.30, 1.2));
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData = { tipo: 'grada', ancho: 1.5, nombre: 'Grada de madera', engancheZ: 2.3 };
    return g;
  }

  /* ============================================================ ÁRBOLES = */
  function foliageGeometry(r, seed, det) {
    var geo = new THREE.IcosahedronGeometry(r, det == null ? 1 : det);
    var pos = geo.attributes.position;
    var n = S.Noise(seed || 7);
    var rnd = S.RNG(seed || 7);
    for (var i = 0; i < pos.count; i++) {
      var v = new THREE.Vector3().fromBufferAttribute(pos, i);
      var d = v.clone().normalize();
      // bultos grandes (racimos de rama) + rizado fino del borde de la hoja
      var grande = n.fbm(d.x * 1.4 + 5, d.z * 1.4 + d.y * 1.4 + 5, 3);
      var fino = n.fbm(d.x * 6.0, d.z * 6.0 + d.y * 6.0, 2);
      var f = 0.72 + grande * 0.52 + (fino - 0.5) * 0.16 + rnd() * 0.06;
      v.multiplyScalar(f);
      v.y *= 0.88;
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    geo.computeVertexNormals();
    return geo;
  }

  // Copa de conífera: cono con el perfil roto en pisos de ramas
  function coneFoliage(r, h, seg) {
    var geo = new THREE.ConeGeometry(r, h, seg, 6);
    var pos = geo.attributes.position;
    var n = S.Noise(23);
    for (var i = 0; i < pos.count; i++) {
      var v = new THREE.Vector3().fromBufferAttribute(pos, i);
      var rad = Math.hypot(v.x, v.z);
      if (rad > 0.001) {
        var piso = 0.80 + Math.abs(Math.sin(v.y * 3.1)) * 0.34;
        var rug = 0.86 + n.fbm(v.x * 2.0 + 3, v.z * 2.0 + v.y * 2.0, 3) * 0.42;
        var f = piso * rug;
        v.x *= f; v.z *= f;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
    }
    geo.computeVertexNormals();
    return geo;
  }

  var SEASON_LEAF = [
    { c: 0x4a6b30, c2: 0x6b8c42, hex: '#4a6b30', alt: '#93b262' },   // primavera
    { c: 0x3f5f28, c2: 0x5c7d38, hex: '#3f5f28', alt: '#82a052' },   // verano
    { c: 0x9a6530, c2: 0xba8a42, hex: '#9a6530', alt: '#d8ae5c' },   // otoño
    { c: 0x5f6355, c2: 0x7b7f6f, hex: '#5f6355', alt: '#9aa08e' }    // invierno
  ];

  // Material de copa: hoja pintada, con relieve y rugosidad, en vez del
  // color plano de facetas que delataba el low-poly.
  function leafMaterial(season, oscuro, repeat) {
    var L = SEASON_LEAF[season];
    var key = 'hoja_' + season + '_' + (oscuro ? 'd' : 'c') + '_' + (repeat || 2);
    return TX.make(key, function () {
      var col = oscuro ? TX.mix(L.hex, '#000000', 0.30) : L.hex;
      var m = TX.matFrom(TX.leafCanvas(256, col, L.alt), {
        repeat: repeat || 2, bump: 2.4, roughLo: 0.80, roughHi: 1
      });
      m.normalScale.set(1.5, 1.5);
      return m;
    });
  }

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
        folGeo = coneFoliage(2.1, 6.4, 13);
        folGeo.translate(0, 5.6, 0);
        // la conífera tira a verde azulado, pero sin ennegrecerse
        folMat = leafMaterial(season === 3 ? 1 : season, false, 3).clone();
        folMat.color = new THREE.Color(0xa8c4a8);
      } else if (kind === 'chopo') {
        trunkGeo = new THREE.CylinderGeometry(0.14, 0.3, 8, 8);
        trunkGeo.translate(0, 4, 0);
        folGeo = foliageGeometry(1.5, 17, 2);
        folGeo.scale(1, 2.6, 1);
        folGeo.translate(0, 7.4, 0);
        folMat = leafMaterial(season, false, 3);
        if (season === 3) { folMat = folMat.clone(); folMat.transparent = true; folMat.opacity = 0.4; }
      } else {
        trunkGeo = new THREE.CylinderGeometry(0.24, 0.55, 3.4, 9);
        trunkGeo.translate(0, 1.7, 0);
        folGeo = foliageGeometry(2.5, 11, 2);
        folGeo.translate(0, 4.6, 0);
        folMat = leafMaterial(season, false, 3);
        if (season === 3) { folMat = folMat.clone(); folMat.transparent = true; folMat.opacity = 0.35; }
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
        var v = 0.80 + Math.random() * 0.26;
        col.setRGB(v * (0.94 + Math.random() * 0.11), v, v * (0.86 + Math.random() * 0.14));
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
    this.season = season;
  }

  // El arbolado cambia con la estación: flor, verde, hoja seca y rama pelada
  Forest.prototype.setSeason = function (season) {
    if (season === this.season) return;
    this.season = season;
    var self = this;
    function vestir(grupo, kind) {
      if (!grupo) return;
      var m;
      if (kind === 'pino') {
        m = leafMaterial(season === 3 ? 1 : season, false, 3).clone();
        m.color = new THREE.Color(0xa8c4a8);
      } else {
        m = leafMaterial(season, false, 3);
        if (season === 3) { m = m.clone(); m.transparent = true; m.opacity = 0.35; }
      }
      grupo.foliage.material = m;
      grupo.foliage2.material = m;
    }
    vestir(this.roble, 'roble');
    vestir(this.pino, 'pino');
    vestir(this.chopo, 'chopo');
  };

  function bushClump(season) {
    var g = new THREE.Group();
    var leaf = SEASON_LEAF[season];
    var mat = leafMaterial(season, false, 1);
    for (var i = 0; i < 3; i++) {
      var r = 0.5 + Math.random() * 0.4;
      var m = new THREE.Mesh(foliageGeometry(r, 20 + i, 2), mat);
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
    house: house, barn: barn, coop: coop, panera: panera, shed: shed, shop: shop, ermita: ermita,
    trough: trough, roundBale: roundBale, squareBale: squareBale, well: well,
    yugo: yugo, arado: arado, carro: carro, grada: grada, ruedaCarro: ruedaCarro,
    streetLamp: streetLamp, fenceSection: fenceSection, FenceRun: FenceRun,
    Forest: Forest, bushClump: bushClump, rock: rock, foliageGeometry: foliageGeometry,
    SEASON_LEAF: SEASON_LEAF
  };

})(window);
