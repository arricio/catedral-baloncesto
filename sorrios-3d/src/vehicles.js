/* ============================================================================
   SORRÍOS DE ORDÁS 3D — vehicles.js
   El tractor con cabina, ruedas motrices, faros y enganche de tres puntos,
   más sus aperos: arado, sembradora y segadora-cosechadora.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, TX = S.TX, MD = S.Models;

  function mat(color, rough, metal) {
    return new THREE.MeshStandardMaterial({ color: color, roughness: rough == null ? 0.45 : rough, metalness: metal == null ? 0.55 : metal });
  }

  /* ------------------------------------------------------------- la rueda */
  function wheel(r, w, tireMat, rimMat) {
    var g = new THREE.Group();
    var tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 22), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true; tire.receiveShadow = true;
    g.add(tire);
    // tacos del neumático
    var lugMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
    for (var i = 0; i < 14; i++) {
      var a = i / 14 * Math.PI * 2;
      var lug = new THREE.Mesh(new THREE.BoxGeometry(w * 0.92, r * 0.14, r * 0.34), lugMat);
      lug.position.set(0, Math.cos(a) * r, Math.sin(a) * r);
      lug.rotation.x = -a + (i % 2 ? 0.5 : -0.5);
      lug.castShadow = true;
      g.add(lug);
    }
    var rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.52, r * 0.52, w * 1.04, 16), rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.castShadow = true;
    g.add(rim);
    var hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, w * 1.12, 10), rimMat);
    hub.rotation.z = Math.PI / 2;
    g.add(hub);
    for (var b = 0; b < 6; b++) {
      var ab = b / 6 * Math.PI * 2;
      var bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, w * 1.15, 6), rimMat);
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(0, Math.cos(ab) * r * 0.34, Math.sin(ab) * r * 0.34);
      g.add(bolt);
    }
    return g;
  }

  /* --------------------------------------------------------- el tractor -- */
  function buildTractor(color) {
    var body = mat(color || 0x2f6b34, 0.42, 0.5);
    var dark = mat(0x2a2d31, 0.6, 0.4);
    var rim = mat(0xd8d4c8, 0.45, 0.6);
    var chrome = mat(0xc8ccd2, 0.22, 0.9);
    var tireMat = TX.matFrom(TX.tireCanvas(256), { repeat: 1, bump: 2.6, roughness: 0.95 });
    var glass = new THREE.MeshPhysicalMaterial({
      color: 0xbcd8e8, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide
    });

    var g = new THREE.Group();
    var parts = {};

    // --- chasis ---
    var chassis = MD.box(0.9, 0.42, 3.2, dark, 0, 0.82, 0);
    g.add(chassis);
    // --- capó ---
    var hood = MD.box(1.15, 0.72, 1.75, body, 0, 1.16, 1.02);
    g.add(hood);
    var hoodTop = MD.box(0.98, 0.22, 1.7, body, 0, 1.55, 1.04);
    g.add(hoodTop);
    // rejilla y faros
    g.add(MD.box(1.0, 0.34, 0.1, dark, 0, 1.12, 1.92));
    var lights = [];
    [-1, 1].forEach(function (s) {
      var l = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.08, 12),
        new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffd98a, emissiveIntensity: 0, roughness: 0.2 }));
      l.rotation.x = Math.PI / 2;
      l.position.set(s * 0.36, 1.42, 1.9);
      g.add(l);
      lights.push(l);
      var beam = new THREE.SpotLight(0xffe0a8, 0, 34, 0.5, 0.45, 1.2);
      beam.position.set(s * 0.36, 1.42, 1.9);
      beam.target.position.set(s * 0.5, 0.2, 14);
      g.add(beam); g.add(beam.target);
      lights.push(beam);
    });
    parts.lights = lights;
    // tubo de escape
    var exh = MD.cyl(0.055, 0.07, 1.25, 10, chrome, 0.44, 2.05, 1.45);
    g.add(exh);
    g.add(MD.cyl(0.085, 0.075, 0.14, 10, chrome, 0.44, 2.7, 1.45));
    parts.exhaust = new THREE.Vector3(0.44, 2.78, 1.45);

    // --- cabina ---
    var cabY = 1.35;
    var cab = new THREE.Group();
    cab.position.set(0, cabY, -0.45);
    g.add(cab);
    var floor = MD.box(1.32, 0.1, 1.5, dark, 0, 0, 0);
    cab.add(floor);
    // montantes
    var px = 0.62, pz = 0.72;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) {
      cab.add(MD.box(0.09, 1.35, 0.09, body, p[0] * px, 0.68, p[1] * pz));
    });
    // techo
    cab.add(MD.box(1.5, 0.14, 1.75, body, 0, 1.4, 0));
    cab.add(MD.box(1.56, 0.06, 1.82, dark, 0, 1.47, 0));
    // cristales
    var wsh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.25), glass);
    wsh.position.set(0, 0.7, pz + 0.02); cab.add(wsh);
    var rear = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.25), glass);
    rear.position.set(0, 0.7, -pz - 0.02); cab.add(rear);
    [-1, 1].forEach(function (s) {
      var side = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.25), glass);
      side.position.set(s * (px + 0.02), 0.7, 0);
      side.rotation.y = Math.PI / 2;
      cab.add(side);
    });
    // asiento
    cab.add(MD.box(0.5, 0.12, 0.5, dark, 0, 0.35, -0.2));
    cab.add(MD.box(0.5, 0.5, 0.12, dark, 0, 0.6, -0.42));
    // volante
    var wheelG = new THREE.Group();
    wheelG.position.set(0, 0.72, 0.28);
    wheelG.rotation.x = -0.5;
    var ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.028, 8, 20), dark);
    wheelG.add(ring);
    wheelG.add(MD.box(0.34, 0.03, 0.03, dark, 0, 0, 0));
    cab.add(wheelG);
    parts.steeringWheel = wheelG;
    // faros del techo
    [-1, 1].forEach(function (s) {
      var rl = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffd98a, emissiveIntensity: 0 }));
      rl.position.set(s * 0.5, 1.4, pz + 0.05);
      cab.add(rl);
      parts.lights.push(rl);
    });

    // --- ruedas ---
    var rr = 0.78, fr = 0.5;
    var wheels = { fl: null, fr: null, rl: null, rr: null };
    var frontAxle = new THREE.Group();
    frontAxle.position.set(0, fr, 1.35);
    g.add(frontAxle);
    var flPivot = new THREE.Group(); flPivot.position.set(-0.72, 0, 0); frontAxle.add(flPivot);
    var frPivot = new THREE.Group(); frPivot.position.set(0.72, 0, 0); frontAxle.add(frPivot);
    wheels.fl = wheel(fr, 0.34, tireMat, rim); flPivot.add(wheels.fl);
    wheels.fr = wheel(fr, 0.34, tireMat, rim); frPivot.add(wheels.fr);
    parts.flPivot = flPivot; parts.frPivot = frPivot;
    g.add(MD.box(1.5, 0.16, 0.16, dark, 0, fr, 1.35));

    wheels.rl = wheel(rr, 0.52, tireMat, rim); wheels.rl.position.set(-0.82, rr, -1.15); g.add(wheels.rl);
    wheels.rr = wheel(rr, 0.52, tireMat, rim); wheels.rr.position.set(0.82, rr, -1.15); g.add(wheels.rr);
    parts.wheels = wheels;
    // guardabarros
    [-1, 1].forEach(function (s) {
      var fend = new THREE.Mesh(new THREE.CylinderGeometry(rr + 0.14, rr + 0.14, 0.58, 16, 1, true, 0, Math.PI), body);
      fend.rotation.z = Math.PI / 2;
      fend.position.set(s * 0.82, rr + 0.02, -1.15);
      fend.castShadow = true;
      g.add(fend);
    });

    // --- enganche de tres puntos ---
    var hitch = new THREE.Group();
    hitch.position.set(0, 0.62, -1.85);
    g.add(hitch);
    hitch.add(MD.box(0.9, 0.1, 0.1, dark, 0, 0, 0));
    hitch.add(MD.box(0.1, 0.1, 0.45, dark, -0.4, -0.1, -0.2));
    hitch.add(MD.box(0.1, 0.1, 0.45, dark, 0.4, -0.1, -0.2));
    parts.hitch = hitch;

    // matrícula y detalles
    g.add(MD.box(0.36, 0.14, 0.03, new THREE.MeshStandardMaterial({ color: 0xf0e8d8, roughness: 0.6 }), 0, 0.62, -2.02));

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return { group: g, parts: parts };
  }

  /* ----------------------------------------------------------- los aperos */
  function buildPlow() {           // arado de vertedera
    var g = new THREE.Group();
    var m = mat(0x9a2f26, 0.55, 0.45);
    var steel = mat(0xb8bcc2, 0.28, 0.85);
    g.add(MD.box(0.22, 0.22, 2.6, m, 0, 0.72, -0.6));
    g.add(MD.box(1.9, 0.18, 0.18, m, 0, 0.72, 0.5));
    for (var i = 0; i < 4; i++) {
      var z = -0.1 - i * 0.62;
      var x = (i % 2 ? 0.42 : -0.42);
      g.add(MD.box(0.12, 0.62, 0.12, m, x, 0.42, z));
      var share = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 5), steel);
      share.rotation.x = -Math.PI / 2;
      share.rotation.z = 0.5;
      share.position.set(x, 0.14, z - 0.12);
      g.add(share);
      var mold = MD.box(0.34, 0.34, 0.5, steel, x + (i % 2 ? 0.14 : -0.14), 0.2, z);
      mold.rotation.z = i % 2 ? -0.7 : 0.7;
      g.add(mold);
    }
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData = { tipo: 'arado', ancho: 2.4, nombre: 'Arado de vertedera' };
    return g;
  }

  function buildSeeder() {         // sembradora con tolva
    var g = new THREE.Group();
    var body = mat(0x2f5f9e, 0.5, 0.45);
    var steel = mat(0xb8bcc2, 0.3, 0.8);
    // tolva
    var hop = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.0), body);
    hop.position.set(0, 1.25, -0.6);
    g.add(hop);
    var funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.3, 0.6, 4), body);
    funnel.rotation.y = Math.PI / 4;
    funnel.position.set(0, 0.78, -0.6);
    funnel.scale.set(1.15, 1, 0.45);
    g.add(funnel);
    g.add(MD.box(2.8, 0.16, 0.16, body, 0, 0.55, 0.1));
    // rejas de siembra
    for (var i = 0; i < 7; i++) {
      var x = -1.2 + i * 0.4;
      g.add(MD.box(0.08, 0.5, 0.08, steel, x, 0.35, -0.15));
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 12), steel);
      disc.rotation.z = Math.PI / 2;
      disc.position.set(x, 0.19, -0.15);
      g.add(disc);
    }
    // ruedas de apoyo
    [-1, 1].forEach(function (s) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.16, 14), mat(0x24262a, 0.9, 0.2));
      w.rotation.z = Math.PI / 2;
      w.position.set(s * 1.35, 0.32, -1.0);
      g.add(w);
    });
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData = { tipo: 'sembradora', ancho: 2.8, nombre: 'Sembradora' };
    return g;
  }

  function buildHarvester() {      // segadora-cosechadora arrastrada
    var g = new THREE.Group();
    var body = mat(0xc8a12c, 0.5, 0.45);
    var steel = mat(0xb8bcc2, 0.3, 0.8);
    var dark = mat(0x2a2d31, 0.6, 0.4);
    g.add(MD.box(3.2, 0.9, 1.2, body, 0, 1.0, -0.9));
    g.add(MD.box(3.4, 0.5, 0.3, steel, 0, 0.45, 0.1));
    // molinete
    var reel = new THREE.Group();
    reel.position.set(0, 0.85, 0.55);
    g.add(reel);
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2;
      var bar = MD.box(3.1, 0.07, 0.07, dark, 0, Math.cos(a) * 0.36, Math.sin(a) * 0.36);
      reel.add(bar);
      for (var t = -3; t <= 3; t++) {
        var tooth = MD.box(0.03, 0.2, 0.03, dark, t * 0.45, Math.cos(a) * 0.36 - 0.1, Math.sin(a) * 0.36);
        reel.add(tooth);
      }
    }
    g.userData.reel = reel;
    // barra de corte
    g.add(MD.box(3.4, 0.1, 0.4, steel, 0, 0.22, 0.42));
    for (var s2 = 0; s2 < 16; s2++) {
      var tri = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 3), steel);
      tri.rotation.x = -Math.PI / 2;
      tri.position.set(-1.6 + s2 * 0.213, 0.22, 0.62);
      g.add(tri);
    }
    // tolva de grano y sinfín
    var hop = MD.box(1.6, 0.7, 1.0, body, 0, 1.75, -1.0);
    g.add(hop);
    var auger = MD.cyl(0.14, 0.14, 2.0, 10, steel, -1.3, 1.9, -1.0);
    auger.rotation.z = 0.5;
    g.add(auger);
    [-1, 1].forEach(function (s) {
      var w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.24, 14), mat(0x24262a, 0.9, 0.2));
      w.rotation.z = Math.PI / 2;
      w.position.set(s * 1.6, 0.42, -1.4);
      g.add(w);
    });
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    var ud = g.userData;
    g.userData = { tipo: 'cosechadora', ancho: 3.4, nombre: 'Segadora-cosechadora', reel: ud.reel };
    return g;
  }

  function buildTrailer() {
    var g = new THREE.Group();
    var body = mat(0x3f6f9e, 0.55, 0.4);
    var dark = mat(0x2a2d31, 0.6, 0.4);
    g.add(MD.box(2.2, 0.2, 4.0, dark, 0, 0.75, -1.4));
    ['x', 'z'].forEach(function () {});
    g.add(MD.box(2.2, 0.9, 0.12, body, 0, 1.25, -3.35));
    g.add(MD.box(2.2, 0.9, 0.12, body, 0, 1.25, 0.55));
    g.add(MD.box(0.12, 0.9, 4.0, body, -1.05, 1.25, -1.4));
    g.add(MD.box(0.12, 0.9, 4.0, body, 1.05, 1.25, -1.4));
    g.add(MD.box(0.14, 0.14, 1.4, dark, 0, 0.7, 0.9));
    [-1, 1].forEach(function (s) {
      [-1, 0.2].forEach(function (z) {
        var w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.26, 16), mat(0x24262a, 0.9, 0.2));
        w.rotation.z = Math.PI / 2;
        w.position.set(s * 1.1, 0.45, -1.4 + z);
        g.add(w);
      });
    });
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData = { tipo: 'remolque', ancho: 2.2, nombre: 'Remolque' };
    return g;
  }

  /* =========================================================== EL VEHÍCULO */
  function Tractor(scene, terrain, opts) {
    opts = opts || {};
    var built = buildTractor(opts.color);
    this.group = built.group;
    this.parts = built.parts;
    this.terrain = terrain;
    this.scene = scene;
    scene.add(this.group);

    this.pos = new THREE.Vector3(opts.x || 0, 0, opts.z || 0);
    this.heading = opts.heading || 0;
    this.speed = 0;
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.wheelSpin = 0;
    this.engineOn = false;
    this.fuel = 100;
    this.occupied = false;

    // aperos disponibles
    this.attachments = {
      arado: buildPlow(),
      sembradora: buildSeeder(),
      cosechadora: buildHarvester(),
      remolque: buildTrailer()
    };
    this.attached = null;
    this.lowered = false;
    for (var k in this.attachments) {
      this.attachments[k].visible = false;
      this.group.add(this.attachments[k]);
      this.attachments[k].position.set(0, 0, -2.4);
    }

    // humo del escape
    var smokeGeo = new THREE.BufferGeometry();
    var N = 40;
    this.smokeN = N;
    this.smokeData = new Float32Array(N * 4);
    smokeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    var smokeTex = (function () {
      var c = TX.cv(32, 32), x = c.getContext('2d');
      var gr = x.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(120,120,120,.85)');
      gr.addColorStop(1, 'rgba(120,120,120,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 32, 32);
      return new THREE.CanvasTexture(c);
    })();
    this.smoke = new THREE.Points(smokeGeo, new THREE.PointsMaterial({
      size: 0.5, map: smokeTex, transparent: true, opacity: 0.5, depthWrite: false, sizeAttenuation: true
    }));
    this.smoke.frustumCulled = false;
    scene.add(this.smoke);
    for (var i = 0; i < N; i++) this.smokeData[i * 4 + 3] = -1;

    this.setPosition(this.pos.x, this.pos.z, this.heading);
  }

  Tractor.prototype.setPosition = function (x, z, heading) {
    this.pos.set(x, this.terrain.heightAt(x, z), z);
    if (heading != null) this.heading = heading;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  };

  Tractor.prototype.attach = function (name) {
    for (var k in this.attachments) this.attachments[k].visible = false;
    this.attached = name && this.attachments[name] ? name : null;
    if (this.attached) this.attachments[this.attached].visible = true;
    return this.attached;
  };

  Tractor.prototype.toggleLower = function () {
    if (!this.attached) return false;
    this.lowered = !this.lowered;
    return this.lowered;
  };

  // Punto de trabajo del apero (donde labra/siembra/siega)
  Tractor.prototype.workPoint = function () {
    var back = new THREE.Vector3(0, 0, -3.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    return new THREE.Vector3(this.pos.x + back.x, this.pos.y, this.pos.z + back.z);
  };
  Tractor.prototype.workWidth = function () {
    if (!this.attached) return 0;
    return this.attachments[this.attached].userData.ancho || 2;
  };

  Tractor.prototype.update = function (dt, input, clock) {
    var moving = false;
    if (this.occupied && this.engineOn) {
      var power = 7.5, maxF = 8.4, maxR = -3.2;
      var target = input.throttle * (input.throttle > 0 ? maxF : -maxR);
      // el apero bajado frena y consume
      var drag = (this.lowered && this.attached ? 0.55 : 1);
      if (input.throttle > 0.05) this.speed += power * dt * drag * (1 - this.speed / (maxF * drag));
      else if (input.throttle < -0.05) this.speed -= power * 0.6 * dt;
      else this.speed *= Math.exp(-1.4 * dt);
      if (input.brake) this.speed *= Math.exp(-5.5 * dt);
      this.speed = U.clamp(this.speed, maxR, maxF * drag);
      // dirección: gira solo si rueda
      this.steer = U.damp(this.steer, input.steer, 8, dt);
      var turn = this.steer * U.clamp(Math.abs(this.speed) / 3.2, 0, 1) * 1.25 * U.sign(this.speed || 1);
      this.heading -= turn * dt;
      // consumo de gasóleo
      this.fuel = Math.max(0, this.fuel - dt * (0.05 + Math.abs(this.speed) * 0.02 + (this.lowered ? 0.05 : 0)));
      if (this.fuel <= 0) this.engineOn = false;
      moving = Math.abs(this.speed) > 0.05;
    } else {
      this.speed *= Math.exp(-2.5 * dt);
    }

    // avance
    if (Math.abs(this.speed) > 0.001) {
      this.pos.x -= Math.sin(this.heading) * this.speed * dt;
      this.pos.z -= Math.cos(this.heading) * this.speed * dt;
      var lim = S.MAP_SIZE / 2 - 12;
      this.pos.x = U.clamp(this.pos.x, -lim, lim);
      this.pos.z = U.clamp(this.pos.z, -lim, lim);
    }
    this.pos.y = this.terrain.heightAt(this.pos.x, this.pos.z);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;

    // inclinación con el terreno
    var n = this.terrain.normalAt(this.pos.x, this.pos.z);
    var fwd = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    var right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    var pitch = Math.asin(U.clamp(-n.dot(fwd), -0.6, 0.6));
    var roll = Math.asin(U.clamp(-n.dot(right), -0.6, 0.6));
    this.group.rotation.x = U.damp(this.group.rotation.x, pitch, 6, dt);
    this.group.rotation.z = U.damp(this.group.rotation.z, -roll, 6, dt);

    // ruedas
    this.wheelSpin += this.speed * dt / 0.78;
    var w = this.parts.wheels;
    w.rl.rotation.x = w.rr.rotation.x = this.wheelSpin;
    w.fl.rotation.x = w.fr.rotation.x = this.wheelSpin * 1.56;
    this.parts.flPivot.rotation.y = this.steer * 0.5;
    this.parts.frPivot.rotation.y = this.steer * 0.5;
    if (this.parts.steeringWheel) this.parts.steeringWheel.rotation.z = -this.steer * 2.2;

    // apero: subir o bajar
    if (this.attached) {
      var a = this.attachments[this.attached];
      a.position.y = U.damp(a.position.y, this.lowered ? 0 : 0.55, 6, dt);
      a.rotation.x = U.damp(a.rotation.x, this.lowered ? 0 : -0.15, 6, dt);
      if (a.userData.reel && this.lowered) a.userData.reel.rotation.x -= dt * (2 + Math.abs(this.speed));
    }

    // faros
    var night = clock ? clock.daylight() < 0.32 : false;
    var on = night && this.engineOn;
    for (var i = 0; i < this.parts.lights.length; i++) {
      var L = this.parts.lights[i];
      if (L.isSpotLight) L.intensity = on ? 55 : 0;
      else if (L.material) L.material.emissiveIntensity = on ? 1.6 : 0;
    }

    this.updateSmoke(dt);
    return moving;
  };

  Tractor.prototype.updateSmoke = function (dt) {
    var arr = this.smoke.geometry.attributes.position.array;
    var origin = this.parts.exhaust.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading).add(this.pos);
    var emit = this.engineOn ? (0.6 + Math.abs(this.speed) * 0.4) : 0;
    this._smokeAcc = (this._smokeAcc || 0) + dt * emit * 14;
    for (var i = 0; i < this.smokeN; i++) {
      var p = i * 4;
      if (this.smokeData[p + 3] < 0) {
        if (this._smokeAcc >= 1) {
          this._smokeAcc -= 1;
          this.smokeData[p] = origin.x; this.smokeData[p + 1] = origin.y; this.smokeData[p + 2] = origin.z;
          this.smokeData[p + 3] = 1.4;
        }
      } else {
        this.smokeData[p + 1] += dt * 1.4;
        this.smokeData[p] += dt * 0.35;
        this.smokeData[p + 3] -= dt;
      }
      var alive = this.smokeData[p + 3] > 0;
      arr[i * 3] = alive ? this.smokeData[p] : 0;
      arr[i * 3 + 1] = alive ? this.smokeData[p + 1] : -999;
      arr[i * 3 + 2] = alive ? this.smokeData[p + 2] : 0;
    }
    this.smoke.geometry.attributes.position.needsUpdate = true;
  };

  Tractor.prototype.seatPosition = function () {
    // altura del asiento en la cabina, para que el conductor quede dentro
    var v = new THREE.Vector3(0, 0.86, -0.62).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    return this.pos.clone().add(v);
  };
  Tractor.prototype.exitPosition = function () {
    var v = new THREE.Vector3(-2.2, 0, -0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    return this.pos.clone().add(v);
  };
  Tractor.prototype.kmh = function () { return Math.abs(this.speed) * 3.6; };

  S.Vehicles = {
    Tractor: Tractor, buildTractor: buildTractor, buildPlow: buildPlow,
    buildSeeder: buildSeeder, buildHarvester: buildHarvester, buildTrailer: buildTrailer, wheel: wheel
  };

})(window);
