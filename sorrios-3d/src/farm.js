/* ============================================================================
   SORRÍOS DE ORDÁS 3D — farm.js
   Parcelas (campos de tractor y huerto de casa) con labrado, siembra, riego,
   crecimiento y cosecha en 3D; el ganado con su comportamiento; y el ordeño
   a mano, que es un minijuego de ritmo con las dos manos.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, TX = S.TX, D = S.DATA, A = S.Actors;

  var VACIO = 0, ARADO = 1, SEMBRADO = 2, LISTO = 3;

  /* ============================================================== PARCELA */
  function Plot(o) {
    this.id = o.id;
    this.nombre = o.nombre;
    this.x = o.x; this.z = o.z;
    this.w = o.w; this.d = o.d;
    this.cell = o.cell || 2;
    this.huerto = !!o.huerto;
    this.cols = Math.floor(o.w / this.cell);
    this.rows = Math.floor(o.d / this.cell);
    this.n = this.cols * this.rows;
    this.state = new Uint8Array(this.n);
    this.crop = new Array(this.n);
    this.grow = new Float32Array(this.n);
    this.wet = new Uint8Array(this.n);
    this.terrain = o.terrain;
    this.scene = o.scene;
    this.layers = {};
    this.buildSoil();
  }

  Plot.prototype.cellCenter = function (i) {
    var cx = i % this.cols, cz = Math.floor(i / this.cols);
    return {
      x: this.x - this.w / 2 + (cx + 0.5) * this.cell,
      z: this.z - this.d / 2 + (cz + 0.5) * this.cell
    };
  };
  Plot.prototype.cellAt = function (x, z) {
    var cx = Math.floor((x - (this.x - this.w / 2)) / this.cell);
    var cz = Math.floor((z - (this.z - this.d / 2)) / this.cell);
    if (cx < 0 || cz < 0 || cx >= this.cols || cz >= this.rows) return -1;
    return cz * this.cols + cx;
  };
  Plot.prototype.contains = function (x, z) {
    return Math.abs(x - this.x) <= this.w / 2 && Math.abs(z - this.z) <= this.d / 2;
  };

  // Capa de tierra labrada: un cuadrado por celda que aparece al arar
  Plot.prototype.buildSoil = function () {
    var geo = new THREE.PlaneGeometry(this.cell * 1.02, this.cell * 1.02);
    geo.rotateX(-Math.PI / 2);
    var canvas = TX.plowedCanvas(512);
    if (!S.MATS_PLOW) {
      S.MATS_PLOW = {
        seco: TX.matFrom(canvas, { repeat: 1, bump: 3.2, roughness: 1 }),
        humedo: TX.matFrom(canvas, { repeat: 1, bump: 3.2, roughness: 0.75, color: 0x9a8a7a })
      };
    }
    var m = new THREE.InstancedMesh(geo, S.MATS_PLOW.seco, this.n);
    m.receiveShadow = true;
    m.castShadow = false;
    m.frustumCulled = false;
    var dummy = new THREE.Object3D();
    for (var i = 0; i < this.n; i++) {
      dummy.position.set(0, -999, 0);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    this.soilMesh = m;
    this.scene.add(m);
    this._dummy = dummy;
  };

  Plot.prototype.refreshSoil = function (i) {
    var c = this.cellCenter(i);
    var d = this._dummy;
    if (this.state[i] === VACIO) d.position.set(0, -999, 0);
    else d.position.set(c.x, this.terrain.heightAt(c.x, c.z) + 0.03, c.z);
    d.rotation.set(0, 0, 0);
    d.scale.set(1, 1, 1);
    d.updateMatrix();
    this.soilMesh.setMatrixAt(i, d.matrix);
    this.soilMesh.instanceMatrix.needsUpdate = true;
  };

  /* --------------------------------------------- geometría de los cultivos */
  function cropGeometry(tipo) {
    var parts = [];
    function addBox(w, h, dp, x, y, z, rx, rz) {
      var g = new THREE.BoxGeometry(w, h, dp);
      g.translate(0, h / 2, 0);
      if (rx) g.rotateX(rx);
      if (rz) g.rotateZ(rz);
      g.translate(x, y, z);
      parts.push(g);
    }
    var rnd = S.RNG(tipo.length * 17 + 3);
    if (tipo === 'cereal') {
      // Mata densa: un campo de trigo no son cuatro cañas sueltas
      for (var i = 0; i < 34; i++) {
        var a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.68;
        var alt = 0.62 + rnd() * 0.22;
        addBox(0.022, alt, 0.022, Math.cos(a) * r, 0, Math.sin(a) * r,
          (rnd() - 0.5) * 0.22, (rnd() - 0.5) * 0.22);
        addBox(0.045, 0.17, 0.045, Math.cos(a) * r, alt - 0.03, Math.sin(a) * r, 0, 0);
      }
    } else if (tipo === 'maiz') {
      for (var m = 0; m < 4; m++) {
        var am = rnd() * 6.28, rm = rnd() * 0.5;
        addBox(0.07, 1.9, 0.07, Math.cos(am) * rm, 0, Math.sin(am) * rm, 0, 0);
        for (var h = 0; h < 4; h++) {
          addBox(0.42, 0.05, 0.13, Math.cos(am) * rm + (h % 2 ? 0.2 : -0.2), 0.5 + h * 0.35, Math.sin(am) * rm,
            0, (h % 2 ? 1 : -1) * 0.55);
        }
      }
    } else if (tipo === 'forraje') {
      for (var f = 0; f < 36; f++) {
        var af = rnd() * 6.28, rf = Math.sqrt(rnd()) * 0.66;
        addBox(0.028, 0.34 + rnd() * 0.18, 0.028, Math.cos(af) * rf, 0, Math.sin(af) * rf,
          (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6);
      }
    } else if (tipo === 'hoja') {
      for (var l = 0; l < 7; l++) {
        var al = l / 7 * 6.28;
        addBox(0.30, 0.05, 0.20, Math.cos(al) * 0.14, 0.10, Math.sin(al) * 0.14, 0, -0.7 + rnd() * 0.2);
      }
      addBox(0.16, 0.18, 0.16, 0, 0.02, 0, 0, 0);
    } else if (tipo === 'mata' || tipo === 'fruto') {
      addBox(0.05, 0.55, 0.05, 0, 0, 0, 0, 0);
      for (var b = 0; b < 8; b++) {
        var ab = b / 8 * 6.28;
        addBox(0.22, 0.04, 0.14, Math.cos(ab) * 0.13, 0.18 + (b % 3) * 0.14, Math.sin(ab) * 0.13, 0, -0.5);
      }
    } else { // tubérculo / bulbo
      for (var t = 0; t < 6; t++) {
        var at = t / 6 * 6.28;
        addBox(0.05, 0.36, 0.05, Math.cos(at) * 0.09, 0, Math.sin(at) * 0.09,
          Math.sin(at) * 0.35, Math.cos(at) * 0.35);
      }
    }
    // fusión manual de todas las piezas
    var total = 0, idxTotal = 0;
    parts.forEach(function (g) { total += g.attributes.position.count; idxTotal += g.index.count; });
    var pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    var idx = new Uint16Array(idxTotal);
    var vo = 0, io = 0;
    parts.forEach(function (g) {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      uv.set(g.attributes.uv.array, vo * 2);
      var gi = g.index.array;
      for (var k = 0; k < gi.length; k++) idx[io + k] = gi[k] + vo;
      vo += g.attributes.position.count;
      io += gi.length;
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }

  var cropGeoCache = {};
  Plot.prototype.layerFor = function (cropId) {
    if (this.layers[cropId]) return this.layers[cropId];
    var def = D.CROPS[cropId];
    if (!cropGeoCache[def.tipo]) cropGeoCache[def.tipo] = cropGeometry(def.tipo);
    var mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.92, flatShading: false, side: THREE.DoubleSide
    });
    var m = new THREE.InstancedMesh(cropGeoCache[def.tipo], mat, this.n);
    m.castShadow = true; m.receiveShadow = true;
    m.frustumCulled = false;
    var d = new THREE.Object3D();
    d.position.set(0, -999, 0); d.updateMatrix();
    for (var i = 0; i < this.n; i++) m.setMatrixAt(i, d.matrix);
    m.instanceMatrix.needsUpdate = true;
    this.scene.add(m);
    this.layers[cropId] = m;
    return m;
  };

  Plot.prototype.refreshCrop = function (i) {
    var cid = this.crop[i];
    // ocultar en todas las capas
    for (var k in this.layers) {
      var d0 = this._dummy;
      d0.position.set(0, -999, 0); d0.scale.set(1, 1, 1); d0.rotation.set(0, 0, 0); d0.updateMatrix();
      this.layers[k].setMatrixAt(i, d0.matrix);
      this.layers[k].instanceMatrix.needsUpdate = true;
    }
    if (!cid || this.state[i] < SEMBRADO) return;
    var def = D.CROPS[cid];
    var layer = this.layerFor(cid);
    var c = this.cellCenter(i);
    var t = U.clamp(this.grow[i] / def.dias, 0, 1);
    var d = this._dummy;
    d.position.set(c.x, this.terrain.heightAt(c.x, c.z), c.z);
    d.rotation.set(0, (i * 37 % 100) / 100 * 6.28, 0);
    var s = 0.25 + t * 0.85;
    d.scale.set(this.huerto ? s * 0.8 : s, s, this.huerto ? s * 0.8 : s);
    d.updateMatrix();
    layer.setMatrixAt(i, d.matrix);
    // color: verde tierno al principio, dorado o maduro al final
    var col = new THREE.Color(def.col).lerp(new THREE.Color(def.fruto), Math.pow(t, 1.6));
    layer.setColorAt(i, col);
    layer.instanceMatrix.needsUpdate = true;
    if (layer.instanceColor) layer.instanceColor.needsUpdate = true;
  };


  // Celdas cubiertas por un apero: "ancho" perpendicular al avance y "largo"
  // en el sentido de la marcha. Sin esto el arado solo tocaba una franja fija.
  Plot.prototype.celdas = function (x, z, ancho, largo, dir) {
    dir = dir || 0;
    var fx = -Math.sin(dir), fz = -Math.cos(dir);      // adelante
    var px = -Math.cos(dir), pz = Math.sin(dir);       // costado
    var paso = Math.min(this.cell * 0.5, 0.5);
    var out = [];
    for (var u = -ancho / 2; u <= ancho / 2 + 0.001; u += paso) {
      for (var v = -largo / 2; v <= largo / 2 + 0.001; v += paso) {
        var wx = x + px * u + fx * v;
        var wz = z + pz * u + fz * v;
        var i = this.cellAt(wx, wz);
        if (i >= 0 && out.indexOf(i) < 0) out.push(i);
      }
    }
    return out;
  };
  /* ---------------------------------------------------------- operaciones */
  Plot.prototype.arar = function (x, z, ancho, dir) {
    var cs = this.celdas(x, z, ancho || this.cell, this.cell, dir), n = 0;
    for (var k = 0; k < cs.length; k++) {
      var i = cs[k];
      if (this.state[i] !== VACIO) continue;
      this.state[i] = ARADO;
      this.crop[i] = null; this.grow[i] = 0;
      this.refreshSoil(i);
      this.refreshCrop(i);
      var c = this.cellCenter(i);
      this.terrain.clearGrass(c.x, c.z, this.cell * 0.75);
      n++;
    }
    return n;
  };

  Plot.prototype.sembrar = function (x, z, ancho, cropId, dir) {
    var cs = this.celdas(x, z, ancho || this.cell, this.cell, dir), n = 0;
    for (var k = 0; k < cs.length; k++) {
      var i = cs[k];
      if (this.state[i] !== ARADO) continue;
      this.state[i] = SEMBRADO;
      this.crop[i] = cropId;
      this.grow[i] = 0;
      this.refreshCrop(i);
      n++;
    }
    return n;
  };

  Plot.prototype.regar = function (x, z, radio, dir) {
    var cs = this.celdas(x, z, radio || this.cell, radio || this.cell, dir), n = 0;
    for (var k = 0; k < cs.length; k++) {
      var i = cs[k];
      if (this.state[i] < ARADO || this.wet[i]) continue;
      this.wet[i] = 1; n++;
    }
    return n;
  };

  // Devuelve {crop, cantidad} de lo cosechado
  Plot.prototype.cosechar = function (x, z, ancho, dir) {
    var cs = this.celdas(x, z, ancho || this.cell, this.cell, dir), out = null;
    for (var k = 0; k < cs.length; k++) {
      var i = cs[k];
      if (this.state[i] !== LISTO) continue;
      var cid = this.crop[i];
      var def = D.CROPS[cid];
      var q = U.rndInt(def.rinde[0], def.rinde[1]);
      out = out || { crop: cid, cantidad: 0, celdas: 0 };
      out.cantidad += q;
      out.celdas++;
      if (def.rebrota) {
        this.state[i] = SEMBRADO;
        this.grow[i] = Math.max(0, def.dias - def.rebrota);
      } else {
        this.state[i] = ARADO;
        this.crop[i] = null; this.grow[i] = 0;
      }
      this.refreshCrop(i);
      this.refreshSoil(i);
    }
    return out;
  };

  Plot.prototype.infoAt = function (x, z) {
    var i = this.cellAt(x, z);
    if (i < 0) return null;
    return { i: i, state: this.state[i], crop: this.crop[i], grow: this.grow[i], wet: this.wet[i] };
  };

  Plot.prototype.nuevoDia = function (llueve, season) {
    var listos = 0;
    for (var i = 0; i < this.n; i++) {
      if (llueve) this.wet[i] = 1;
      if (this.state[i] === SEMBRADO && this.crop[i]) {
        var def = D.CROPS[this.crop[i]];
        var enTemporada = def.s.indexOf(season) >= 0;
        // El huerto hay que regarlo a mano; los campos grandes son de secano
        // y crecen solos, algo más despacio si no llueve.
        var avanza = this.huerto ? (this.wet[i] ? 1 : 0) : (this.wet[i] ? 1 : 0.7);
        if (avanza > 0 && enTemporada) {
          this.grow[i] += avanza;
          if (this.grow[i] >= def.dias) { this.state[i] = LISTO; listos++; }
          this.refreshCrop(i);
        }
      }
      this.wet[i] = llueve ? 1 : 0;
    }
    return listos;
  };

  Plot.prototype.save = function () {
    return { id: this.id, state: Array.from(this.state), crop: this.crop.slice(),
             grow: Array.from(this.grow), wet: Array.from(this.wet) };
  };
  Plot.prototype.load = function (d) {
    if (!d) return;
    for (var i = 0; i < this.n && i < d.state.length; i++) {
      this.state[i] = d.state[i];
      this.crop[i] = d.crop[i];
      this.grow[i] = d.grow[i];
      this.wet[i] = d.wet[i];
      if (this.state[i] > VACIO) this.refreshSoil(i);
      if (this.crop[i]) this.refreshCrop(i);
    }
  };

  /* ============================================================== GANADO = */
  var animalSeq = 1;
  function Animal(kind, opts) {
    opts = opts || {};
    this.id = opts.id || ('a' + (animalSeq++));
    this.kind = kind;
    this.def = D.ANIMALS[kind];
    this.nombre = opts.nombre || Animal.nombreAl(kind);
    this.variant = opts.variant == null ? U.rndInt(0, 2) : opts.variant;
    this.mesh = Animal.crear(kind, this.variant);
    this.pos = new THREE.Vector3(opts.x || 0, 0, opts.z || 0);
    this.heading = Math.random() * 6.28;
    this.speed = 0;
    this.state = 'quieto';
    this.stateT = U.rnd(1, 4);
    this.target = null;
    this.fed = false; this.pet = false;
    this.happy = 55;
    this.age = 0;
    this.productReady = false;
    this.extraReady = false;
    this.extraT = 0;
    this.sheared = false;
    this.sonidoT = U.rnd(5, 25);
  }
  Animal.NOMBRES = {
    vaca: ['Pinta', 'Lucera', 'Morena', 'Estrella', 'Bonita', 'Careta', 'Rubia', 'Gallarda', 'Marquesa'],
    oveja: ['Copo', 'Nube', 'Lana', 'Blanca', 'Rizos', 'Mota'],
    cordero: ['Chispa', 'Bolita', 'Pelusa', 'Tirso'],
    gallina: ['Cuca', 'Pita', 'Coca', 'Trufa', 'Pinta'],
    pollo: ['Peque', 'Piolín', 'Chispi', 'Motita'],
    burro: ['Platero', 'Rucio', 'Manchas', 'Trotón']
  };
  Animal.nombreAl = function (k) { return U.pick(Animal.NOMBRES[k] || ['Animal']); };
  Animal.crear = function (kind, variant) {
    switch (kind) {
      case 'vaca': return A.cow(variant % 3);
      case 'oveja': return A.sheep(false);
      case 'cordero': return A.lamb();
      case 'gallina': return A.chicken(variant % 3);
      case 'pollo': return A.chick();
      case 'burro': return A.donkey();
    }
    return A.sheep(false);
  };

  Animal.prototype.update = function (dt, terrain, zona, t) {
    this.stateT -= dt;
    if (this.state === 'anda' && this.target) {
      var dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
      var dist = Math.hypot(dx, dz);
      if (dist < 0.5 || this.stateT <= 0) {
        this.state = U.chance(0.6) ? 'pasta' : 'quieto';
        this.stateT = U.rnd(3, 9);
        this.speed = 0;
      } else {
        var v = (this.def.vel || 1) * 0.75;
        this.speed = v;
        this.pos.x += dx / dist * v * dt;
        this.pos.z += dz / dist * v * dt;
        var want = Math.atan2(dx, dz);
        this.heading += U.angleDelta(this.heading, want) * Math.min(1, dt * 3.5);
      }
    } else {
      this.speed = 0;
      if (this.stateT <= 0) {
        if (U.chance(0.6) && zona) {
          this.target = {
            x: zona.x + U.rnd(-zona.w / 2 + 1, zona.w / 2 - 1),
            z: zona.z + U.rnd(-zona.d / 2 + 1, zona.d / 2 - 1)
          };
          this.state = 'anda'; this.stateT = U.rnd(4, 12);
        } else {
          this.state = U.chance(0.5) ? 'pasta' : 'quieto';
          this.stateT = U.rnd(3, 8);
        }
      }
    }
    this.mesh.userData.grazing = (this.state === 'pasta');
    this.pos.y = terrain.heightAt(this.pos.x, this.pos.z);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    A.animateAnimal(this.mesh, dt, this.speed, t);
  };

  Animal.prototype.nuevoDia = function () {
    this.age++;
    if (this.fed) this.happy = U.clamp(this.happy + (this.pet ? 12 : 6), 0, 100);
    else this.happy = U.clamp(this.happy - 16, 0, 100);
    var crecio = false;
    if (this.def.crece && this.age >= this.def.dias) {
      crecio = this.def.crece;
    }
    if (this.def.prod && this.fed && this.happy > 20) this.productReady = true;
    if (this.def.extra) {
      this.extraT++;
      if (this.extraT >= this.def.extraCada && this.fed) { this.extraReady = true; this.sheared = false; }
    }
    this.fed = false; this.pet = false;
    return crecio;
  };

  Animal.prototype.save = function () {
    return { id: this.id, kind: this.kind, nombre: this.nombre, variant: this.variant,
             x: this.pos.x, z: this.pos.z, fed: this.fed, happy: this.happy, age: this.age,
             productReady: this.productReady, extraReady: this.extraReady, extraT: this.extraT, sheared: this.sheared };
  };

  /* ============================================================== ORDEÑO = */
  function Milking() { this.activo = false; }
  Milking.prototype.start = function (animal, producto) {
    this.activo = true;
    this.animal = animal;
    this.producto = producto;
    this.mano = 0;
    this.lleno = 0;
    this.fallos = 0;
    this.tiros = 0;
    this.ventana = 0;
    this.compas = 1.05;
    this.resultado = null;
    this.flash = 0;
    this.msg = 'Alterna las manos siguiendo el compás';
  };
  Milking.prototype.press = function (mano) {
    if (!this.activo || this.resultado) return;
    var t = this.ventana / this.compas;
    if (mano !== this.mano) { this.fallar('¡Esa mano no!'); return; }
    if (t > 0.48) {
      var cal = t > 0.78 ? 1.6 : 1.0;
      this.lleno = Math.min(100, this.lleno + 7 * cal);
      this.tiros++;
      this.mano = 1 - this.mano;
      this.ventana = 0;
      this.compas = Math.max(0.5, this.compas - 0.022);
      this.flash = 0.14;
      this.msg = cal > 1.2 ? '¡Buen chorro!' : 'Bien.';
      if (this.lleno >= 100) this.terminar(true);
      return 'ok';
    }
    this.fallar('Demasiado pronto…');
    return 'mal';
  };
  Milking.prototype.fallar = function (msg) {
    this.fallos++;
    this.lleno = Math.max(0, this.lleno - 4);
    this.compas = Math.min(1.15, this.compas + 0.05);
    this.msg = msg;
    if (this.fallos >= 6) this.terminar(false);
  };
  Milking.prototype.terminar = function (ok) { this.resultado = ok ? 'ok' : 'mal'; this.resultadoT = 1.5; };
  Milking.prototype.update = function (dt) {
    if (!this.activo) return;
    if (this.flash > 0) this.flash -= dt;
    if (this.resultado) {
      this.resultadoT -= dt;
      if (this.resultadoT <= 0) this.activo = false;
      return;
    }
    this.ventana += dt;
    if (this.ventana > this.compas) { this.ventana = 0; this.fallar('Se te fue el ritmo.'); }
  };
  Milking.prototype.rendimiento = function () {
    if (this.lleno >= 100) return this.tiros > 12 ? 2 : 1;
    return this.lleno >= 55 ? 1 : 0;
  };

  S.Farm = {
    Plot: Plot, Animal: Animal, Milking: Milking,
    VACIO: VACIO, ARADO: ARADO, SEMBRADO: SEMBRADO, LISTO: LISTO,
    cropGeometry: cropGeometry
  };

})(window);
