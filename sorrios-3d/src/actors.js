/* ============================================================================
   SORRÍOS DE ORDÁS 3D — actors.js
   Personas y animales construidos por piezas articuladas, con proporciones
   reales (una vaca frisona mide ~1,45 m a la cruz y ~2,4 m de largo) y
   animación de marcha, cabeceo, orejas y rabo.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, TX = S.TX;

  function mesh(geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function capsule(r, len, mat) {
    return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
  }
  function sphere(r, mat, seg) {
    return new THREE.Mesh(new THREE.SphereGeometry(r, seg || 14, seg || 12), mat);
  }
  function boxM(w, h, d, mat) {
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }
  function shadowOn(root) {
    root.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return root;
  }

  /* ============================================================= PERSONAS */
  // Rig humano sencillo pero con articulaciones: caderas, piernas, brazos y cuello.
  function human(o) {
    o = o || {};
    var skin = new THREE.MeshStandardMaterial({
      map: TX.tex(TX.skinCanvas(128, o.skin || '#d8a97e'), 1), roughness: 0.82
    });
    var shirt = new THREE.MeshStandardMaterial({
      map: TX.tex(TX.clothCanvas(256, o.shirt || '#3f6f9e'), 1), roughness: 0.92
    });
    var pants = new THREE.MeshStandardMaterial({
      map: TX.tex(TX.clothCanvas(256, o.pants || '#2f3b52'), 1), roughness: 0.94
    });
    var boot = new THREE.MeshStandardMaterial({ color: o.boots || 0x3a2a1c, roughness: 0.7 });
    var hair = new THREE.MeshStandardMaterial({ color: o.hair || 0x2e2018, roughness: 0.95 });

    var scale = o.child ? 0.62 : 1;
    var root = new THREE.Group();
    var body = new THREE.Group();
    body.scale.setScalar(scale);
    root.add(body);

    // --- tronco ---
    var hips = new THREE.Group();
    hips.position.y = 0.92;
    body.add(hips);

    var torso = capsule(0.19, 0.34, shirt);
    torso.position.y = 0.28;
    torso.scale.set(1.15, 1, 0.78);
    hips.add(torso);
    var pelvis = capsule(0.17, 0.1, pants);
    pelvis.position.y = 0.02;
    pelvis.scale.set(1.15, 1, 0.8);
    hips.add(pelvis);

    // chaleco o mandil
    if (o.vest) {
      var vest = capsule(0.20, 0.3, new THREE.MeshStandardMaterial({
        map: TX.tex(TX.clothCanvas(256, o.vest), 1), roughness: 0.9
      }));
      vest.position.y = 0.28; vest.scale.set(1.14, 1, 0.8);
      hips.add(vest);
    }
    // Ropa remendada: parches cosidos de otro color y otra tela
    if (o.remiendos) {
      var parches = o.remiendos.length ? o.remiendos : ['#6a5a3a', '#4a4a52', '#7a4a3a'];
      var rp = S.RNG(21);
      for (var pr = 0; pr < 5; pr++) {
        var pm = new THREE.MeshStandardMaterial({
          map: TX.tex(TX.clothCanvas(128, parches[pr % parches.length]), 1), roughness: 0.98
        });
        var ang = rp() * 6.283;
        var alto = pr < 3 ? 0.18 + rp() * 0.34 : -0.12 - rp() * 0.22;
        var parche = new THREE.Mesh(new THREE.PlaneGeometry(0.10 + rp() * 0.05, 0.09 + rp() * 0.05), pm);
        var radio = pr < 3 ? 0.195 : 0.175;
        parche.position.set(Math.sin(ang) * radio, alto, Math.cos(ang) * radio * 0.8);
        parche.lookAt(parche.position.clone().multiplyScalar(3));
        hips.add(parche);
      }
    }

    // --- cuello y cabeza ---
    var neck = new THREE.Group();
    neck.position.y = 0.53;
    hips.add(neck);
    neck.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.09, 8), skin, 0, 0.04, 0));
    var head = new THREE.Group();
    head.position.y = 0.09;
    neck.add(head);
    var skull = sphere(0.113, skin, 18);
    skull.scale.set(0.94, 1.12, 1.0);
    skull.position.y = 0.10;
    head.add(skull);
    // mandíbula y barbilla: sin esto la cabeza es una bola
    var jaw = sphere(0.092, skin, 14);
    jaw.scale.set(0.94, 0.62, 0.94);
    jaw.position.set(0, 0.038, 0.016);
    head.add(jaw);
    var chin = sphere(0.042, skin, 10);
    chin.scale.set(1.0, 0.78, 0.9);
    chin.position.set(0, 0.026, 0.070);
    head.add(chin);
    // nariz y orejas
    head.add(mesh(new THREE.ConeGeometry(0.022, 0.05, 6), skin, 0, 0.095, 0.108).rotateX(Math.PI / 2));
    head.add(mesh(new THREE.SphereGeometry(0.028, 8, 6), skin, 0.108, 0.10, 0));
    head.add(mesh(new THREE.SphereGeometry(0.028, 8, 6), skin, -0.108, 0.10, 0));
    // ojos
    var eyeMat = new THREE.MeshStandardMaterial({ color: 0xe6e2da, roughness: 0.18 });
    var pupMat = new THREE.MeshStandardMaterial({ color: o.eyes || 0x3a2a18, roughness: 0.15 });
    var cejaMat = new THREE.MeshStandardMaterial({ color: o.hair || 0x3a2f22, roughness: 1 });
    var lidMat = new THREE.MeshStandardMaterial({ color: TX.mix(o.skin || '#d8a97e', '#000000', 0.16), roughness: 0.9 });
    [-1, 1].forEach(function (s) {
      // cuenca: hueco oscuro para que el ojo no parezca pegado en la frente
      var cu = sphere(0.030, lidMat, 10);
      cu.scale.set(1.0, 0.72, 0.42);
      cu.position.set(s * 0.042, 0.122, 0.083);
      head.add(cu);
      // globo ocular, casi todo dentro de la cabeza: sólo asoma la almendra
      var e = sphere(0.0185, eyeMat, 12);
      e.scale.set(1, 0.78, 0.7);
      e.position.set(s * 0.042, 0.1225, 0.0885);
      head.add(e);
      var p = sphere(0.0082, pupMat, 8);
      p.scale.set(1, 1, 0.6);
      p.position.set(s * 0.043, 0.1225, 0.0985);
      head.add(p);
      // párpado superior
      var pd = sphere(0.021, lidMat, 10);
      pd.scale.set(1.05, 0.42, 0.6);
      pd.position.set(s * 0.042, 0.1345, 0.086);
      head.add(pd);
      // ceja
      var cj = mesh(new THREE.BoxGeometry(0.036, 0.008, 0.012), cejaMat, s * 0.043, 0.1475, 0.089);
      cj.rotation.z = -s * 0.16;
      head.add(cj);
    });
    // pelo / boina / pañuelo
    if (o.hat && o.hat !== 'panuelo') {
      // greñas que asoman por debajo de la boina o del sombrero
      var gre = sphere(0.116, hair, 12);
      gre.scale.set(1.02, 0.62, 1.02);
      gre.position.y = 0.108;
      head.add(gre);
      var pat2 = sphere(0.05, hair, 8);
      pat2.scale.set(0.5, 1.0, 0.7);
      pat2.position.set(0, 0.085, -0.095);
      head.add(pat2);
    }
    if (o.hat === 'boina') {
      var boinaMat = TX.matFrom(TX.clothCanvas(128, o.hatColor || '#1b1b1f'),
        { repeat: 3, bump: 1.6, roughness: 1 });
      var b = sphere(0.128, boinaMat, 20);
      b.scale.set(1.10, 0.46, 1.10); b.position.y = 0.186;
      b.rotation.x = 0.10;
      head.add(b);
      // cinta de cuero del borde
      var cinta = mesh(new THREE.TorusGeometry(0.126, 0.011, 8, 22), boinaMat, 0, 0.160, 0.004);
      cinta.rotation.x = Math.PI / 2 + 0.10;
      head.add(cinta);
      // el rabillo de la boina
      head.add(mesh(new THREE.SphereGeometry(0.013, 6, 6), boinaMat, 0, 0.243, -0.008));
    } else if (o.hat === 'paja') {
      var pj = new THREE.MeshStandardMaterial({ color: 0xd9b45c, roughness: 0.95 });
      head.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.015, 16), pj, 0, 0.175, 0));
      head.add(mesh(new THREE.CylinderGeometry(0.115, 0.125, 0.10, 14), pj, 0, 0.225, 0));
    } else if (o.hat === 'panuelo') {
      var pn = sphere(0.122, new THREE.MeshStandardMaterial({ color: o.hatColor || 0xb8455e, roughness: 0.95 }));
      pn.scale.set(1.05, 0.85, 1.05); pn.position.y = 0.135;
      head.add(pn);
    } else {
      var hc = sphere(0.118, hair);
      hc.scale.set(1.0, 0.95, 1.0);
      hc.position.y = 0.125;
      head.add(hc);
      if (o.hairStyle === 'largo') {
        var back = capsule(0.085, 0.2, hair);
        back.position.set(0, 0.03, -0.08);
        back.scale.set(1.3, 1, 0.6);
        head.add(back);
      } else if (o.hairStyle === 'monyo') {
        head.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), hair, 0, 0.13, -0.115));
      }
    }
    // --- gafas cuadradas de pasta, de las de antes ---
    if (o.gafas) {
      var pasta = new THREE.MeshStandardMaterial({
        color: o.gafasColor || 0x5b3a1e, roughness: 0.35, metalness: 0.05
      });
      var cristal = new THREE.MeshPhysicalMaterial({
        color: 0xcfe0e8, transparent: true, opacity: 0.22, roughness: 0.05,
        metalness: 0, side: THREE.DoubleSide
      });
      var gaf = new THREE.Group();
      gaf.position.set(0, 0.123, 0.103);
      head.add(gaf);
      [-1, 1].forEach(function (sg) {
        var cx = sg * 0.050;
        // marco cuadrado: cuatro varillas de pasta
        gaf.add(mesh(new THREE.BoxGeometry(0.060, 0.011, 0.011), pasta, cx, 0.023, 0));
        gaf.add(mesh(new THREE.BoxGeometry(0.060, 0.011, 0.011), pasta, cx, -0.023, 0));
        gaf.add(mesh(new THREE.BoxGeometry(0.011, 0.057, 0.011), pasta, cx - 0.028, 0, 0));
        gaf.add(mesh(new THREE.BoxGeometry(0.011, 0.057, 0.011), pasta, cx + 0.028, 0, 0));
        var lente = mesh(new THREE.PlaneGeometry(0.054, 0.049), cristal, cx, 0, -0.002);
        gaf.add(lente);
        // patilla hasta la oreja
        var pat = mesh(new THREE.BoxGeometry(0.008, 0.008, 0.075), pasta, sg * 0.070, 0.006, -0.038);
        pat.rotation.y = sg * 0.22;
        gaf.add(pat);
      });
      // puente sobre la nariz
      gaf.add(mesh(new THREE.BoxGeometry(0.026, 0.009, 0.009), pasta, 0, 0.012, 0));
    }

    if (o.beard) {
      var beardMat = new THREE.MeshStandardMaterial({ color: o.beard, roughness: 1 });
      var bd = sphere(0.100, beardMat, 16);
      bd.scale.set(0.95, 0.46, 0.86);
      bd.position.set(0, 0.026, 0.012);
      head.add(bd);
      // patillas hasta la oreja
      [-1, 1].forEach(function (sb) {
        var pt = sphere(0.030, beardMat, 8);
        pt.scale.set(0.45, 1.5, 0.75);
        pt.position.set(sb * 0.098, 0.072, 0.006);
        head.add(pt);
      });
      // bigote: fino y justo bajo la nariz
      var big = sphere(0.026, beardMat, 10);
      big.scale.set(1.25, 0.30, 0.50);
      big.position.set(0, 0.066, 0.095);
      head.add(big);
    }

    // --- brazos ---
    function arm(side) {
      var g = new THREE.Group();
      g.position.set(side * 0.21, 0.46, 0);
      hips.add(g);
      var upper = capsule(0.055, 0.20, shirt);
      upper.position.y = -0.14;
      g.add(upper);
      var fore = new THREE.Group();
      fore.position.y = -0.28;
      g.add(fore);
      var f = capsule(0.048, 0.19, o.sleeves === false ? skin : shirt);
      f.position.y = -0.13;
      fore.add(f);
      var hand = sphere(0.055, skin, 10);
      hand.position.y = -0.26;
      hand.scale.set(1, 1.15, 0.75);
      fore.add(hand);
      return { root: g, fore: fore, hand: hand };
    }
    var armL = arm(-1), armR = arm(1);

    // --- piernas ---
    function leg(side) {
      var g = new THREE.Group();
      g.position.set(side * 0.095, 0.0, 0);
      hips.add(g);
      var thigh = capsule(0.075, 0.24, pants);
      thigh.position.y = -0.19;
      g.add(thigh);
      var shinG = new THREE.Group();
      shinG.position.y = -0.40;
      g.add(shinG);
      var shin = capsule(0.062, 0.24, pants);
      shin.position.y = -0.18;
      shinG.add(shin);
      var foot = boxM(0.11, 0.075, 0.24, boot);
      foot.position.set(0, -0.36, 0.05);
      shinG.add(foot);
      return { root: g, shin: shinG, foot: foot };
    }
    var legL = leg(-1), legR = leg(1);

    shadowOn(root);
    root.userData = {
      kind: 'humano', body: body, hips: hips, torso: torso, neck: neck, head: head,
      armL: armL, armR: armR, legL: legL, legR: legR,
      phase: Math.random() * 6.28, scale: scale,
      height: 1.78 * scale
    };
    return root;
  }

  // Animación de marcha para personas
  function animateHuman(root, dt, speed, extra) {
    var d = root.userData;
    var moving = speed > 0.1;
    var freq = moving ? U.clamp(speed * 1.7, 3, 11) : 0;
    d.phase += dt * freq;
    var amp = U.clamp(speed / 4, 0, 1);
    var sw = Math.sin(d.phase) * amp;
    var sw2 = Math.sin(d.phase + Math.PI) * amp;

    d.legL.root.rotation.x = sw * 0.75;
    d.legR.root.rotation.x = sw2 * 0.75;
    d.legL.shin.rotation.x = Math.max(0, -Math.sin(d.phase - 0.7)) * amp * 0.95;
    d.legR.shin.rotation.x = Math.max(0, -Math.sin(d.phase + Math.PI - 0.7)) * amp * 0.95;

    if (!extra || !extra.armsBusy) {
      d.armL.root.rotation.x = sw2 * 0.62;
      d.armR.root.rotation.x = sw * 0.62;
      d.armL.fore.rotation.x = -Math.abs(sw2) * 0.4 - 0.12;
      d.armR.fore.rotation.x = -Math.abs(sw) * 0.4 - 0.12;
      d.armL.root.rotation.z = 0.09;
      d.armR.root.rotation.z = -0.09;
    }
    // balanceo del cuerpo
    d.hips.position.y = 0.92 + Math.abs(Math.sin(d.phase)) * 0.035 * amp;
    d.hips.rotation.z = Math.sin(d.phase) * 0.03 * amp;
    d.torso.rotation.y = Math.sin(d.phase) * 0.09 * amp;
    d.body.rotation.x = U.damp(d.body.rotation.x, moving ? 0.06 : 0, 6, dt);
    if (!moving) {
      // respiración en reposo
      var br = Math.sin(performance.now() * 0.0016) * 0.012;
      d.torso.scale.y = 1 + br;
      d.hips.position.y = 0.92 + br * 0.4;
    } else d.torso.scale.y = 1;
  }

  // Postura sentada: para el tractor, con las piernas dobladas y las manos
  // al volante en lugar de ir de pie sobre la cabina.
  function poseSentado(root, t) {
    var d = root.userData;
    if (!d || !d.legL) return;
    d.legL.root.rotation.x = -1.35; d.legR.root.rotation.x = -1.35;
    d.legL.shin.rotation.x = 1.35; d.legR.shin.rotation.x = 1.35;
    d.armL.root.rotation.x = -1.0; d.armR.root.rotation.x = -1.0;
    d.armL.root.rotation.z = 0.28; d.armR.root.rotation.z = -0.28;
    d.armL.fore.rotation.x = -0.35; d.armR.fore.rotation.x = -0.35;
    d.hips.position.y = 0.92;
    d.hips.rotation.z = 0;
    d.torso.rotation.y = Math.sin((t || 0) * 1.6) * 0.03;
  }

  /* ============================================================= ANIMALES */
  // Constructor genérico de cuadrúpedo con las medidas de cada especie.
  function quadruped(cfg) {
    var root = new THREE.Group();
    var g = new THREE.Group();
    root.add(g);

    var bodyMat = cfg.bodyMat;
    var legMat = cfg.legMat || bodyMat;

    // --- tronco ---
    var trunk = new THREE.Group();
    trunk.position.y = cfg.bodyY;
    g.add(trunk);
    var body = capsule(cfg.bodyR, cfg.bodyLen, bodyMat);
    body.rotation.x = Math.PI / 2;
    body.scale.set(cfg.bodyW || 1, 1, cfg.bodyH || 1);
    trunk.add(body);
    // cruz / grupa más marcadas
    if (cfg.withers) {
      var w = sphere(cfg.bodyR * 0.95, bodyMat, 12);
      w.position.set(0, cfg.bodyR * 0.22, cfg.bodyLen * 0.34);
      w.scale.set(cfg.bodyW || 1, 0.9, 0.85);
      trunk.add(w);
      var rump = sphere(cfg.bodyR * 0.98, bodyMat, 12);
      rump.position.set(0, cfg.bodyR * 0.1, -cfg.bodyLen * 0.42);
      rump.scale.set(cfg.bodyW || 1, 0.95, 0.9);
      trunk.add(rump);
    }

    // --- cuello y cabeza ---
    var neck = new THREE.Group();
    neck.position.set(0, cfg.neckY, cfg.neckZ);
    trunk.add(neck);
    var neckM = mesh(new THREE.CylinderGeometry(cfg.neckR2 || cfg.neckR * 0.8, cfg.neckR, cfg.neckLen, 10), bodyMat, 0, cfg.neckLen / 2, 0);
    neck.add(neckM);
    neck.rotation.x = cfg.neckAngle == null ? -0.9 : cfg.neckAngle;

    var head = new THREE.Group();
    head.position.set(0, cfg.neckLen, 0);
    neck.add(head);
    head.rotation.x = cfg.headAngle == null ? 0.9 : cfg.headAngle;
    if (cfg.buildHead) cfg.buildHead(head, bodyMat);

    // --- patas ---
    var legs = [];
    var lp = cfg.legs;   // [{x,z,front}]
    for (var i = 0; i < lp.length; i++) {
      var L = lp[i];
      var hip = new THREE.Group();
      hip.position.set(L.x, cfg.hipY, L.z);
      g.add(hip);
      var upperLen = cfg.upperLen, lowerLen = cfg.lowerLen;
      var upper = capsule(cfg.legR, upperLen, legMat);
      upper.position.y = -upperLen / 2 - cfg.legR * 0.2;
      hip.add(upper);
      var knee = new THREE.Group();
      knee.position.y = -(upperLen + cfg.legR * 0.6);
      hip.add(knee);
      var lower = capsule(cfg.legR * 0.72, lowerLen, legMat);
      lower.position.y = -lowerLen / 2;
      knee.add(lower);
      var hoofMat = cfg.hoofMat || new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 0.75 });
      var hoof = mesh(new THREE.CylinderGeometry(cfg.legR * 0.95, cfg.legR * 1.05, cfg.legR * 1.4, 8), hoofMat,
        0, -lowerLen - cfg.legR * 0.5, 0);
      knee.add(hoof);
      legs.push({ hip: hip, knee: knee, front: L.front, side: L.x > 0 ? 1 : -1 });
    }

    // --- rabo ---
    var tail = null;
    if (cfg.tail) {
      tail = new THREE.Group();
      tail.position.set(0, cfg.bodyR * 0.7, -cfg.bodyLen / 2 - cfg.bodyR * 0.55);
      trunk.add(tail);
      var tm = mesh(new THREE.CylinderGeometry(cfg.tail.r * 0.5, cfg.tail.r, cfg.tail.len, 6), bodyMat, 0, -cfg.tail.len / 2, 0);
      tail.add(tm);
      if (cfg.tail.tuft) {
        var tuft = sphere(cfg.tail.r * 2.2, cfg.tail.tuftMat || legMat, 8);
        tuft.position.y = -cfg.tail.len;
        tuft.scale.set(0.8, 1.5, 0.8);
        tail.add(tuft);
      }
      tail.rotation.x = -0.25;
    }

    shadowOn(root);
    root.userData = {
      kind: 'animal', g: g, trunk: trunk, neck: neck, head: head, legs: legs, tail: tail,
      phase: Math.random() * 6.28, cfg: cfg, ears: cfg._ears || []
    };
    return root;
  }

  function animateAnimal(root, dt, speed, t) {
    var d = root.userData, cfg = d.cfg;
    var moving = speed > 0.05;
    var freq = moving ? U.clamp(speed * (cfg.gaitFreq || 2.6), 1.6, 9) : 0;
    d.phase += dt * freq;
    var amp = moving ? U.clamp(speed / (cfg.gaitSpeed || 1.4), 0, 1) : 0;

    for (var i = 0; i < d.legs.length; i++) {
      var L = d.legs[i];
      // marcha diagonal: delantera izq. con trasera der.
      var ph = d.phase + ((L.front ? 0 : Math.PI) + (L.side > 0 ? Math.PI : 0));
      var sw = Math.sin(ph);
      L.hip.rotation.x = sw * 0.55 * amp;
      L.knee.rotation.x = Math.max(0, -Math.sin(ph - 0.8)) * 0.75 * amp;
    }
    // cabeceo y balanceo
    d.trunk.position.y = cfg.bodyY + Math.abs(Math.sin(d.phase * 2)) * 0.035 * amp;
    d.trunk.rotation.z = Math.sin(d.phase) * 0.035 * amp;
    d.neck.rotation.x = (cfg.neckAngle == null ? -0.9 : cfg.neckAngle) + Math.sin(d.phase) * 0.08 * amp;

    // rabo espantando moscas y orejas
    if (d.tail) {
      d.tail.rotation.z = Math.sin(t * 1.6 + d.phase) * 0.35;
      d.tail.rotation.x = -0.25 + Math.sin(t * 2.1) * 0.12;
    }
    for (var e = 0; e < d.ears.length; e++) {
      d.ears[e].rotation.z = d.ears[e].userData.base + Math.sin(t * 2.4 + e * 2) * 0.16;
    }
    // pastando: baja la cabeza
    if (d.grazing) {
      d.neck.rotation.x = U.damp(d.neck.rotation.x, -0.05, 3, dt);
      d.head.rotation.x = U.damp(d.head.rotation.x, 0.15, 3, dt);
    } else if (!moving) {
      d.head.rotation.x = U.damp(d.head.rotation.x, cfg.headAngle == null ? 0.9 : cfg.headAngle, 3, dt);
    }
  }

  /* ------------------------------------------------------------- la vaca */
  function cow(variant) {
    var hide = TX.cowHideCanvas(512,
      variant === 1 ? '#6b4426' : (variant === 2 ? '#3a2f26' : '#241f1b'),
      variant === 1 ? 10 : 15);
    var bodyMat = new THREE.MeshStandardMaterial({
      map: TX.tex(hide, 1, 8),
      normalMap: TX.texLinear(TX.normalMapFrom(hide, 1.1), 1),
      roughness: 0.86
    });
    var darkMat = new THREE.MeshStandardMaterial({ color: 0x2a241f, roughness: 0.8 });
    var pinkMat = new THREE.MeshStandardMaterial({ color: 0xe8a79c, roughness: 0.75 });
    var ears = [];

    var cfg = {
      bodyMat: bodyMat, hoofMat: darkMat,
      bodyY: 0.92, bodyR: 0.42, bodyLen: 1.15, bodyW: 0.92, bodyH: 1.0, withers: true,
      neckY: 0.30, neckZ: 0.86, neckR: 0.30, neckR2: 0.20, neckLen: 0.42, neckAngle: -0.55, headAngle: 0.5,
      hipY: 0.95, upperLen: 0.40, lowerLen: 0.36, legR: 0.105,
      gaitFreq: 2.2, gaitSpeed: 1.3,
      legs: [
        { x: 0.26, z: 0.62, front: true }, { x: -0.26, z: 0.62, front: true },
        { x: 0.28, z: -0.60, front: false }, { x: -0.28, z: -0.60, front: false }
      ],
      tail: { r: 0.035, len: 0.62, tuft: true, tuftMat: darkMat },
      buildHead: function (head, mat) {
        var skull = capsule(0.135, 0.16, mat);
        skull.rotation.x = Math.PI / 2;
        skull.scale.set(0.92, 1, 1);
        skull.position.z = 0.05;
        head.add(skull);
        // morro
        var muzzle = mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.16, 12), pinkMat, 0, 0, 0.25);
        muzzle.rotation.x = Math.PI / 2;
        head.add(muzzle);
        head.add(mesh(new THREE.SphereGeometry(0.024, 8, 6), darkMat, 0.045, 0.02, 0.33));
        head.add(mesh(new THREE.SphereGeometry(0.024, 8, 6), darkMat, -0.045, 0.02, 0.33));
        // ojos
        [-1, 1].forEach(function (s) {
          var e = sphere(0.035, new THREE.MeshStandardMaterial({ color: 0x140f0c, roughness: 0.15 }), 10);
          e.position.set(s * 0.115, 0.055, 0.10);
          head.add(e);
        });
        // orejas
        [-1, 1].forEach(function (s) {
          var ear = new THREE.Group();
          ear.position.set(s * 0.15, 0.06, -0.05);
          ear.userData.base = s * 0.9;
          ear.rotation.z = s * 0.9;
          var em = capsule(0.035, 0.11, mat);
          em.scale.set(1, 1, 0.45);
          em.position.y = 0.07;
          ear.add(em);
          head.add(ear);
          ears.push(ear);
        });
        // testuz
        var top = sphere(0.10, mat, 10);
        top.scale.set(1, 0.6, 0.9);
        top.position.set(0, 0.10, -0.02);
        head.add(top);
      }
    };
    cfg._ears = ears;
    var c = quadruped(cfg);
    // ubre con pezones: lo que se ordeña a mano
    var udder = sphere(0.22, pinkMat, 12);
    udder.scale.set(1.0, 0.8, 1.15);
    udder.position.set(0, 0.52, -0.30);
    c.userData.g.add(udder);
    c.userData.udder = udder;
    var teats = [];
    [[0.09, -0.2], [-0.09, -0.2], [0.08, -0.42], [-0.08, -0.42]].forEach(function (p) {
      var t = mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.11, 7), pinkMat, p[0], 0.38, p[1] - 0.05);
      c.userData.g.add(t);
      teats.push(t);
    });
    c.userData.teats = teats;
    shadowOn(c);
    c.userData.species = 'vaca';
    return c;
  }

  /* ------------------------------------------------------------ la oveja */
  function sheep(sheared) {
    var woolC = TX.woolCanvas(512, '#efe9dc');
    var woolMat = new THREE.MeshStandardMaterial({
      map: TX.tex(woolC, 2, 8),
      normalMap: TX.texLinear(TX.normalMapFrom(woolC, 3.2), 2),
      roughness: 0.98
    });
    var shornMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc8, roughness: 0.9 });
    var faceMat = new THREE.MeshStandardMaterial({ color: 0x33302c, roughness: 0.85 });
    var bodyMat = sheared ? shornMat : woolMat;
    var ears = [];

    var cfg = {
      bodyMat: bodyMat, hoofMat: faceMat,
      bodyY: 0.60, bodyR: 0.30, bodyLen: 0.55, bodyW: 0.95, bodyH: 1.0, withers: false,
      neckY: 0.16, neckZ: 0.44, neckR: 0.16, neckR2: 0.11, neckLen: 0.22, neckAngle: -0.5, headAngle: 0.45,
      hipY: 0.62, upperLen: 0.24, lowerLen: 0.22, legR: 0.055,
      gaitFreq: 3.0, gaitSpeed: 1.1,
      legMat: faceMat,
      legs: [
        { x: 0.17, z: 0.28, front: true }, { x: -0.17, z: 0.28, front: true },
        { x: 0.18, z: -0.28, front: false }, { x: -0.18, z: -0.28, front: false }
      ],
      tail: { r: 0.03, len: 0.14, tuft: true, tuftMat: bodyMat },
      buildHead: function (head) {
        var skull = capsule(0.075, 0.10, faceMat);
        skull.rotation.x = Math.PI / 2;
        skull.position.z = 0.04;
        head.add(skull);
        head.add(mesh(new THREE.SphereGeometry(0.062, 10, 8), faceMat, 0, -0.01, 0.13));
        [-1, 1].forEach(function (s) {
          var e = sphere(0.022, new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 0.2 }), 8);
          e.position.set(s * 0.062, 0.03, 0.06);
          head.add(e);
          var ear = new THREE.Group();
          ear.position.set(s * 0.075, 0.03, -0.02);
          ear.userData.base = s * 1.25;
          ear.rotation.z = s * 1.25;
          var em = capsule(0.022, 0.07, faceMat);
          em.scale.set(1, 1, 0.4); em.position.y = 0.05;
          ear.add(em);
          head.add(ear); ears.push(ear);
        });
        if (!sheared) {
          var tuft = sphere(0.085, bodyMat, 10);
          tuft.position.set(0, 0.075, -0.02);
          tuft.scale.set(1, 0.85, 0.9);
          head.add(tuft);
        }
      }
    };
    cfg._ears = ears;
    var s = quadruped(cfg);
    if (!sheared) {
      // vellón: bultos de lana repartidos por el lomo
      var rnd = S.RNG(31);
      for (var i = 0; i < 14; i++) {
        var b = sphere(0.14 + rnd() * 0.07, woolMat, 8);
        b.position.set((rnd() - 0.5) * 0.42, 0.60 + (rnd() - 0.3) * 0.22, (rnd() - 0.5) * 0.95);
        b.castShadow = true; b.receiveShadow = true;
        s.userData.g.add(b);
      }
    }
    // ubre pequeña (las ovejas también se ordeñan)
    var udder = sphere(0.10, new THREE.MeshStandardMaterial({ color: 0xe8b4a8, roughness: 0.8 }), 10);
    udder.scale.set(1, 0.8, 1.1);
    udder.position.set(0, 0.36, -0.18);
    s.userData.g.add(udder);
    s.userData.udder = udder;
    var teats = [];
    [[0.05, -0.13], [-0.05, -0.13]].forEach(function (p) {
      var t = mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.06, 6),
        new THREE.MeshStandardMaterial({ color: 0xe8b4a8, roughness: 0.8 }), p[0], 0.29, p[1] - 0.05);
      s.userData.g.add(t); teats.push(t);
    });
    s.userData.teats = teats;
    shadowOn(s);
    s.userData.species = 'oveja';
    return s;
  }

  function lamb() {
    var s = sheep(false);
    s.scale.setScalar(0.55);
    s.userData.species = 'cordero';
    return s;
  }

  /* ---------------------------------------------------------- la gallina */
  function chicken(variant) {
    var col = ['#f0e4d0', '#a8552c', '#3a3530'][variant || 0];
    var fc = TX.featherCanvas(256, col, variant === 1 ? '#7a3a1c' : null);
    var mat = new THREE.MeshStandardMaterial({
      map: TX.tex(fc, 2, 8),
      normalMap: TX.texLinear(TX.normalMapFrom(fc, 2.4), 2),
      roughness: 0.9
    });
    var combMat = new THREE.MeshStandardMaterial({ color: 0xc0342a, roughness: 0.6 });
    var beakMat = new THREE.MeshStandardMaterial({ color: 0xe0a63a, roughness: 0.55 });

    var root = new THREE.Group();
    var g = new THREE.Group();
    root.add(g);
    var trunk = new THREE.Group();
    trunk.position.y = 0.24;
    g.add(trunk);
    var body = sphere(0.15, mat, 14);
    body.scale.set(0.85, 0.95, 1.15);
    trunk.add(body);
    // cola
    var tail = new THREE.Group();
    tail.position.set(0, 0.07, -0.15);
    trunk.add(tail);
    for (var i = 0; i < 4; i++) {
      var f = boxM(0.02, 0.13, 0.09, mat);
      f.position.set((i - 1.5) * 0.025, 0.06, -0.04);
      f.rotation.x = -0.9 - i * 0.08;
      f.rotation.z = (i - 1.5) * 0.14;
      tail.add(f);
    }
    // alas
    [-1, 1].forEach(function (s) {
      var w = sphere(0.09, mat, 10);
      w.scale.set(0.35, 0.75, 1.25);
      w.position.set(s * 0.13, 0.0, 0.0);
      trunk.add(w);
    });
    // cuello y cabeza
    var neck = new THREE.Group();
    neck.position.set(0, 0.10, 0.11);
    trunk.add(neck);
    neck.add(mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.10, 8), mat, 0, 0.05, 0));
    var head = new THREE.Group();
    head.position.y = 0.10;
    neck.add(head);
    var skull = sphere(0.062, mat, 12);
    head.add(skull);
    head.add(mesh(new THREE.ConeGeometry(0.025, 0.07, 6), beakMat, 0, -0.005, 0.075).rotateX(Math.PI / 2));
    [-1, 1].forEach(function (s) {
      var e = sphere(0.014, new THREE.MeshStandardMaterial({ color: 0x100c08, roughness: 0.2 }), 8);
      e.position.set(s * 0.04, 0.02, 0.045);
      head.add(e);
    });
    // cresta y barbillas
    for (var c = 0; c < 3; c++) {
      var cm = boxM(0.012, 0.035 - c * 0.005, 0.03, combMat);
      cm.position.set(0, 0.062, 0.03 - c * 0.028);
      head.add(cm);
    }
    head.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), combMat, 0.015, -0.045, 0.045));
    head.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), combMat, -0.015, -0.045, 0.045));
    // patas
    var legs = [];
    [-1, 1].forEach(function (s) {
      var hip = new THREE.Group();
      hip.position.set(s * 0.055, 0.20, 0.01);
      g.add(hip);
      hip.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 6), beakMat, 0, -0.07, 0));
      var foot = new THREE.Group();
      foot.position.y = -0.14;
      hip.add(foot);
      for (var t = -1; t <= 1; t++) {
        var toe = boxM(0.012, 0.012, 0.06, beakMat);
        toe.position.set(t * 0.018, 0, 0.028);
        toe.rotation.y = t * 0.4;
        foot.add(toe);
      }
      legs.push({ hip: hip, knee: foot, front: s > 0, side: s });
    });
    shadowOn(root);
    root.userData = {
      kind: 'ave', g: g, trunk: trunk, neck: neck, head: head, legs: legs, tail: null,
      phase: Math.random() * 6.28, ears: [], species: 'gallina',
      cfg: { bodyY: 0.24, gaitFreq: 6, gaitSpeed: 0.8 }
    };
    return root;
  }

  function chick() {
    var mat = new THREE.MeshStandardMaterial({ color: 0xf5d84e, roughness: 0.95 });
    var beak = new THREE.MeshStandardMaterial({ color: 0xe0a63a, roughness: 0.6 });
    var root = new THREE.Group();
    var g = new THREE.Group(); root.add(g);
    var trunk = new THREE.Group(); trunk.position.y = 0.075; g.add(trunk);
    var body = sphere(0.062, mat, 12);
    body.scale.set(0.9, 0.95, 1.05);
    trunk.add(body);
    var neck = new THREE.Group(); neck.position.set(0, 0.045, 0.035); trunk.add(neck);
    var head = new THREE.Group(); head.position.y = 0.03; neck.add(head);
    head.add(sphere(0.042, mat, 10));
    head.add(mesh(new THREE.ConeGeometry(0.014, 0.035, 6), beak, 0, 0, 0.045).rotateX(Math.PI / 2));
    [-1, 1].forEach(function (s) {
      var e = sphere(0.009, new THREE.MeshStandardMaterial({ color: 0x120d09 }), 6);
      e.position.set(s * 0.026, 0.012, 0.03);
      head.add(e);
    });
    var legs = [];
    [-1, 1].forEach(function (s) {
      var hip = new THREE.Group();
      hip.position.set(s * 0.026, 0.062, 0);
      g.add(hip);
      hip.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 5), beak, 0, -0.03, 0));
      var foot = new THREE.Group(); foot.position.y = -0.06; hip.add(foot);
      foot.add(boxM(0.022, 0.008, 0.03, beak));
      legs.push({ hip: hip, knee: foot, front: s > 0, side: s });
    });
    shadowOn(root);
    root.userData = {
      kind: 'ave', g: g, trunk: trunk, neck: neck, head: head, legs: legs, tail: null,
      phase: Math.random() * 6.28, ears: [], species: 'pollo',
      cfg: { bodyY: 0.075, gaitFreq: 9, gaitSpeed: 0.6 }
    };
    return root;
  }

  /* ------------------------------------------------------------- el burro */
  function donkey() {
    var coat = TX.noiseFill(TX.cv(256), '#8d857b', '#6a635b', '#a9a199', 5, 4);
    var mat = new THREE.MeshStandardMaterial({
      map: TX.tex(coat, 2, 8),
      normalMap: TX.texLinear(TX.normalMapFrom(coat, 1.4), 2),
      roughness: 0.9
    });
    var dark = new THREE.MeshStandardMaterial({ color: 0x4a443c, roughness: 0.9 });
    var pale = new THREE.MeshStandardMaterial({ color: 0xcfc7b8, roughness: 0.9 });
    var ears = [];
    var cfg = {
      bodyMat: mat, legMat: mat, hoofMat: dark,
      bodyY: 0.86, bodyR: 0.34, bodyLen: 0.95, bodyW: 0.88, bodyH: 1.0, withers: true,
      neckY: 0.28, neckZ: 0.72, neckR: 0.24, neckR2: 0.15, neckLen: 0.44, neckAngle: -0.65, headAngle: 0.62,
      hipY: 0.88, upperLen: 0.36, lowerLen: 0.34, legR: 0.085,
      gaitFreq: 2.4, gaitSpeed: 1.3,
      legs: [
        { x: 0.21, z: 0.52, front: true }, { x: -0.21, z: 0.52, front: true },
        { x: 0.22, z: -0.50, front: false }, { x: -0.22, z: -0.50, front: false }
      ],
      tail: { r: 0.028, len: 0.5, tuft: true, tuftMat: dark },
      buildHead: function (head) {
        var skull = capsule(0.10, 0.20, mat);
        skull.rotation.x = Math.PI / 2;
        skull.position.z = 0.08;
        head.add(skull);
        head.add(mesh(new THREE.SphereGeometry(0.085, 10, 8), dark, 0, -0.01, 0.24));
        head.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), pale, 0, -0.04, 0.20));
        [-1, 1].forEach(function (s) {
          var e = sphere(0.028, new THREE.MeshStandardMaterial({ color: 0x120e0a, roughness: 0.2 }), 8);
          e.position.set(s * 0.088, 0.055, 0.06);
          head.add(e);
          // orejas largas, la seña del burro
          var ear = new THREE.Group();
          ear.position.set(s * 0.055, 0.10, -0.04);
          ear.userData.base = s * 0.22;
          ear.rotation.z = s * 0.22;
          var em = capsule(0.032, 0.20, mat);
          em.scale.set(1, 1, 0.5);
          em.position.y = 0.13;
          ear.add(em);
          var inner = capsule(0.02, 0.16, dark);
          inner.scale.set(1, 1, 0.3);
          inner.position.set(0, 0.13, 0.02);
          ear.add(inner);
          head.add(ear); ears.push(ear);
        });
        // crin
        for (var i = 0; i < 7; i++) {
          var h = boxM(0.03, 0.09, 0.05, dark);
          h.position.set(0, 0.10 - i * 0.005, -0.02 - i * 0.055);
          head.add(h);
        }
      }
    };
    cfg._ears = ears;
    var d = quadruped(cfg);
    // franja dorsal y cruz oscuras, y vientre claro
    var stripe = boxM(0.07, 0.03, 1.5, dark);
    stripe.position.set(0, 1.20, 0);
    d.userData.g.add(stripe);
    var cross = boxM(0.55, 0.03, 0.07, dark);
    cross.position.set(0, 1.16, 0.45);
    d.userData.g.add(cross);
    var belly = capsule(0.30, 0.8, pale);
    belly.rotation.x = Math.PI / 2;
    belly.scale.set(0.8, 1, 0.55);
    belly.position.set(0, 0.72, 0);
    d.userData.g.add(belly);
    // crin del cuello
    for (var i = 0; i < 6; i++) {
      var m = boxM(0.035, 0.10, 0.06, dark);
      m.position.set(0, 0.10 + i * 0.06, 0);
      m.rotation.x = -0.5;
      d.userData.neck.add(m);
    }
    shadowOn(d);
    d.userData.species = 'burro';
    return d;
  }

  S.Actors = {
    human: human, animateHuman: animateHuman, poseSentado: poseSentado,
    cow: cow, sheep: sheep, lamb: lamb, chicken: chicken, chick: chick, donkey: donkey,
    animateAnimal: animateAnimal, quadruped: quadruped,
    mesh: mesh, capsule: capsule, sphere: sphere, boxM: boxM
  };

})(window);
