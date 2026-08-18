/* ============================================================================
   SORRÍOS DE ORDÁS 3D — game.js
   El valle, Nazario en tercera persona, la cámara, la interacción, la yunta
   de vacas o el burro Carolo con el arado y el carro, el ganado, los vecinos
   y el paso de los días. Aquí no hay maquinaria de ninguna clase.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, D = S.DATA, MD = S.Models, A = S.Actors, F = S.Farm;

  var V3 = function (x, y, z) { return new THREE.Vector3(x, y, z); };

  /* ============================================================= NAZARIO = */
  function Player() {
    this.nombre = 'Nazario';
    this.dinero = 2500;
    this.energia = 100; this.energiaMax = 100;
    this.inv = [];
    this.invMax = 28;
    this.cinturon = ['azada', 'guadana', 'caldero', 'regadera', 'aguijada'];
    this.slot = 0;
    this.agua = 20; this.aguaMax = 20;
    this.pareja = null; this.esposa = null;
    this.stats = { dias: 1, ordenos: 0, huevos: 0, cosechado: 0, segado: 0, ganado: 0 };
  }
  Player.prototype.cuantos = function (id) {
    for (var i = 0; i < this.inv.length; i++) if (this.inv[i].id === id) return this.inv[i].q;
    return 0;
  };
  Player.prototype.dar = function (id, q) {
    q = q || 1;
    if (!D.ITEMS[id]) return false;
    for (var i = 0; i < this.inv.length; i++) {
      if (this.inv[i].id === id) { this.inv[i].q += q; return true; }
    }
    if (this.inv.length >= this.invMax) return false;
    this.inv.push({ id: id, q: q });
    return true;
  };
  Player.prototype.quitar = function (id, q) {
    q = q || 1;
    for (var i = this.inv.length - 1; i >= 0; i--) {
      if (this.inv[i].id !== id) continue;
      var t = Math.min(q, this.inv[i].q);
      this.inv[i].q -= t; q -= t;
      if (this.inv[i].q <= 0) this.inv.splice(i, 1);
      if (q <= 0) return true;
    }
    return q <= 0;
  };
  Player.prototype.enMano = function () { return this.cinturon[this.slot]; };
  Player.prototype.gastar = function (n) { if (this.dinero < n) return false; this.dinero -= n; return true; };
  Player.prototype.cansar = function (n) { this.energia = Math.max(-15, this.energia - n); };

  /* ================================================================ JUEGO */
  var G = S.Game = {
    estado: 'titulo',
    guiando: false,          // ¿va Nazario detrás de la yunta?
    camModo: 0,
    camYaw: 0, camPitch: 0.22, camDist: 6.2,
    reloj: 0,

    init: function (canvas) {
      var self = this;
      this.q = S.quality();
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: this.q.antialias, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(this.q.pixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.02;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 2400);

      this.clock = new S.Clock();
      this.player = new Player();
      this.ui = new S.UI(this);
      this.milking = new F.Milking();
      this.colliders = [];
      this.interactivos = [];
      this.animales = [];
      this.npcs = [];
      this.hijos = [];
      this.plots = [];
      this.flags = {};

      window.addEventListener('resize', function () { self.resize(); });
      return this;
    },

    resize: function () {
      var w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
      if (this.post) this.post.resize(w, h, this.renderer.getPixelRatio());
    },

    cambiarCalidad: function () {
      var niveles = ['baja', 'media', 'alta'];
      var i = (niveles.indexOf(this.q.level) + 1) % 3;
      this.q.level = niveles[i];
      this.renderer.setPixelRatio(i === 2 ? Math.min(devicePixelRatio || 1, 2) : (i === 1 ? 1.25 : 1));
      this.sky.sun.shadow.mapSize.set(i === 2 ? 2048 : 1024, i === 2 ? 2048 : 1024);
      this.resize();
      this.ui.toast('Calidad: ' + this.q.level, 'info');
    },

    /* --------------------------------------------------------- el mundo -- */
    construirMundo: function (season) {
      var scene = this.scene;
      MD.initMaterials(season);
      this.sky = new S.Sky(scene, this.q);
      this.terrain = new S.Terrain(scene, this.q, season);
      this.grass = new S.Grass(scene, this.terrain, this.q, season);
      this.water = new S.Water(scene, this.terrain);
      this.spots = {};
      this.construirGranja();
      this.construirPueblo();
      this.construirCampos();
      this.construirVegetacion(season);
      this.yunta = new S.Yunta(scene, this.terrain, this);
      this.crearJugador();
      if (S.Post) this.post = new S.Post(this.renderer, this.scene, this.camera, this.q);
    },

    colisor: function (x, z, w, d) { this.colliders.push({ x: x, z: z, w: w, d: d }); },
    punto: function (x, z, r, tipo, datos) {
      var p = { x: x, z: z, r: r, tipo: tipo, datos: datos || {} };
      this.interactivos.push(p);
      return p;
    },

    poner: function (obj, x, z, ry, colision) {
      obj.position.set(x, this.terrain.heightAt(x, z), z);
      if (ry) obj.rotation.y = ry;
      this.scene.add(obj);
      if (colision && obj.userData.size) {
        var s = obj.userData.size;
        var gira = Math.abs(Math.sin(ry || 0)) > 0.5;
        this.colisor(x, z, (gira ? s.d : s.w) + 0.4, (gira ? s.w : s.d) + 0.4);
      }
      return obj;
    },

    construirGranja: function () {
      var T = this.terrain;
      // --- casa de Nazario ---
      this.poner(MD.house({ w: 10, d: 8, h: 5.4, windows: 2 }), -84, -50, 0, true);
      this.spots.casa_nazario = { x: -84, z: -44 };
      this.punto(-84, -42.2, 3.2, 'casa', {});
      // --- cuadra / corte del ganado ---
      this.poner(MD.barn({ w: 20, d: 12, h: 5.2 }), -60, -52, 0, true);
      this.spots.cuadra = { x: -60, z: -44 };
      this.punto(-60, -44.5, 4.0, 'cuadra', {});
      // --- pajar y tenada donde descansan los aperos ---
      this.poner(MD.shed({ w: 14, d: 8, h: 4.4 }), -54, -30, Math.PI, true);
      this.punto(-54, -25, 4.2, 'tenada', {});
      this.spots.tenada = { x: -54, z: -25 };
      // --- panera (el granero de siempre) ---
      this.poner(MD.panera({ w: 6.5, d: 4.4 }), -44, -46, 0.3, true);
      // --- gallinero ---
      this.poner(MD.coop({ w: 7, d: 5, h: 2.6 }), -86, -32, 0, true);
      this.spots.gallinero = { x: -86, z: -28 };
      this.punto(-86, -28.5, 3.0, 'gallinero', {});
      // --- pozo y comedero ---
      this.poner(MD.well(), -76, -44, 0, true);
      this.punto(-76, -44, 3.0, 'pozo', {});
      this.comedero = this.poner(MD.trough(), -66, -36, 0, false);
      this.punto(-66, -36, 3.2, 'comedero', {});
      // --- hierba amontonada y leña ---
      for (var b = 0; b < 5; b++) {
        this.poner(MD.roundBale(false), -50 + (b % 3) * 2.1, -34 - Math.floor(b / 3) * 1.7, Math.random(), false);
      }
      this.poner(MD.squareBale(), -58, -34, 0.4, false);

      // --- prado cercado ---
      var prado = { x: -66, z: -12, w: 44, d: 26 };
      this.prado = prado;
      var pts = [
        [prado.x - prado.w / 2, prado.z - prado.d / 2], [prado.x + prado.w / 2, prado.z - prado.d / 2],
        [prado.x + prado.w / 2, prado.z + prado.d / 2], [prado.x - prado.w / 2, prado.z + prado.d / 2],
        [prado.x - prado.w / 2, prado.z - prado.d / 2]
      ];
      new MD.FenceRun(this.scene, pts, { terrain: T, step: 2.4 });
      this.spots.prado = { x: prado.x, z: prado.z };
      this.spots.granja = { x: -70, z: -34 };

      // --- huerta de casa ---
      var huerta = new F.Plot({
        id: 'huerta', nombre: 'Huerta de casa', x: -76, z: -30, w: 14, d: 10, cell: 1,
        huerto: true, terrain: T, scene: this.scene
      });
      this.plots.push(huerta);
      this.huerta = huerta;
      this.spots.huerta = { x: -76, z: -30 };
      T.clearGrassRect(-76, -30, 15, 11);
      new MD.FenceRun(this.scene, [[-83.5, -35.5], [-68.5, -35.5], [-68.5, -24.5], [-83.5, -24.5], [-83.5, -35.5]],
        { terrain: T, step: 2.5 });
    },

    construirPueblo: function () {
      var self = this;
      function casa(x, z, ry, opt, spot) {
        var o = self.poner(MD.house(opt || {}), x, z, ry, true);
        if (spot) self.spots[spot] = { x: x, z: z + 6 };
        return o;
      }
      this.spots.plaza = { x: 70, z: 45 };
      this.farolas = [];
      for (var l = 0; l < 6; l++) {
        var ang = l / 6 * Math.PI * 2;
        var lx = 70 + Math.cos(ang) * 16, lz = 45 + Math.sin(ang) * 13;
        this.farolas.push(this.poner(MD.streetLamp(), lx, lz, 0, false));
      }
      this.poner(MD.well(), 70, 45, 0, true);

      // --- ermita ---
      this.poner(MD.ermita(), 54, 30, 0, true);
      this.spots.ermita = { x: 54, z: 44 };
      this.punto(54, 43, 4, 'ermita', {});

      // --- tiendas ---
      this.poner(MD.shop({ w: 11, d: 8, sign: 'ULTRAMARINOS', awning: 'rojo', signBg: '#3d2a18' }), 54, 54, 0, true);
      this.spots.tienda_comida = { x: 54, z: 60 };
      this.punto(54, 59, 3.4, 'tienda', { shop: 'comestibles' });
      this.poner(MD.shop({ w: 12, d: 9, sign: 'APEROS Y PIENSOS', awning: 'verde', darkRoof: true, signBg: '#1e3320' }), 88, 54, 0, true);
      this.spots.tienda_aperos = { x: 88, z: 60 };
      this.punto(88, 59.5, 3.6, 'tienda', { shop: 'aperos' });

      // --- panera del concejo: aquí se vende y se guarda la cosecha ---
      this.poner(MD.panera({ w: 9, d: 5.5 }), 36, 42, 0, true);
      this.poner(MD.shed({ w: 10, d: 7, h: 4.4 }), 36, 50, 0, true);
      this.spots.concejo = { x: 36, z: 54 };
      this.punto(36, 54, 4, 'concejo', {});

      // --- taberna de Arricio y casas ---
      this.poner(MD.shop({ w: 10, d: 8, sign: 'TABERNA', awning: 'rojo', signBg: '#3a1f14' }), 62, 68, 0, true);
      this.spots.taberna = { x: 62, z: 74 };
      this.punto(62, 74, 3.4, 'taberna', {});
      casa(80, 68, 0, { w: 10, d: 8, plaster: true }, 'casa_marinieves');
      casa(94, 58, -0.5, { w: 8, d: 7, slate: true }, 'casa_julita');
      casa(94, 34, 0.3, { w: 8, d: 7, plaster: true }, 'casa_nieves');
      this.spots.molino = { x: 94, z: 40 };
      casa(48, 64, 0, { w: 8, d: 7 }, 'casa_marinieves2');
      casa(58, 78, 0, { w: 8, d: 7, plaster: true }, 'casa_alfonso');
      casa(86, 74, 0, { w: 9, d: 8, darkRoof: true }, 'casa_mario');
      casa(100, 66, -0.4, { w: 8, d: 7 }, 'fragua');
      casa(46, 72, 0.2, { w: 7, d: 6, plaster: true }, 'casa_josep');
      casa(72, 78, 0, { w: 12, d: 8, plaster: true, windows: 3 }, 'escuela');
      this.spots.escuela = { x: 72, z: 84 };
      this.spots.rio = { x: 30, z: -100 };
      this.spots.puente = { x: 0, z: -95 };
    },

    construirCampos: function () {
      var T = this.terrain;
      var defs = [
        { id: 'tierra_norte', nombre: 'Tierra del Norte', x: -24, z: -74, w: 34, d: 24 },
        { id: 'tierra_rio', nombre: 'Tierra del Río', x: 22, z: -62, w: 30, d: 22 },
        { id: 'tierra_grande', nombre: 'Tierra Grande', x: -22, z: 8, w: 32, d: 22 }
      ];
      for (var i = 0; i < defs.length; i++) {
        var d = defs[i];
        this.plots.push(new F.Plot({
          id: d.id, nombre: d.nombre, x: d.x, z: d.z, w: d.w, d: d.d, cell: 1.5,
          terrain: T, scene: this.scene
        }));
        this.spots[d.id] = { x: d.x, z: d.z };
      }
    },

    // Viste el valle con la estación que toca: prado, arbolado y hierba.
    aplicarEstacion: function (season) {
      if (this.terrain) this.terrain.setSeason(season);
      if (this.grass) this.grass.setSeason(season);
      if (this.bosque) this.bosque.setSeason(season);
    },

    construirVegetacion: function (season) {
      var T = this.terrain, lista = [], rnd = S.RNG(4242);
      function libre(x, z) {
        if (Math.abs(x + 70) < 40 && Math.abs(z + 40) < 40) return false;
        if (Math.abs(x - 70) < 44 && Math.abs(z - 52) < 42) return false;
        if (Math.abs(x + 24) < 22 && Math.abs(z + 74) < 17) return false;
        if (Math.abs(x - 22) < 20 && Math.abs(z + 62) < 16) return false;
        if (Math.abs(x + 22) < 21 && Math.abs(z - 8) < 16) return false;
        if (Math.abs(x - 36) < 15 && Math.abs(z - 46) < 15) return false;
        if (T.isRoad(x, z)) return false;
        return true;
      }
      for (var i = 0; i < 900; i++) {
        var x = rnd.range(-200, 200), z = rnd.range(-200, 200);
        var d = Math.hypot(x, z);
        if (d > 195 || !libre(x, z)) continue;
        var borde = U.clamp((d - 90) / 70, 0, 1);
        if (rnd() > 0.18 + borde * 0.75) continue;
        var alt = T.heightAt(x, z);
        if (alt < -1.2) continue;
        var tipo = alt > 14 ? 'pino' : (rnd() < 0.34 ? 'pino' : (rnd() < 0.85 ? 'roble' : 'chopo'));
        lista.push({ x: x, z: z, t: tipo, s: 0.75 + rnd() * 0.7, r: rnd() * 6.28 });
      }
      for (var c = 0; c < 60; c++) {
        var rx = -190 + c * 6.4;
        var rz = T.riverZAt(rx) + (c % 2 ? 16 : -16) + rnd.range(-4, 4);
        if (Math.abs(rx) > 190) continue;
        lista.push({ x: rx, z: rz, t: 'chopo', s: 0.9 + rnd() * 0.5, r: rnd() * 6.28 });
      }
      this.bosque = new MD.Forest(this.scene, T, lista, season, this.q);

      for (var b = 0; b < 130; b++) {
        var bx = rnd.range(-170, 170), bz = rnd.range(-170, 170);
        if (!libre(bx, bz) || T.heightAt(bx, bz) < -1) continue;
        var o = rnd() < 0.6 ? MD.bushClump(this.clock.season) : MD.rock(0.4 + rnd() * 0.7);
        o.position.set(bx, T.heightAt(bx, bz), bz);
        this.scene.add(o);
      }
    },

    crearJugador: function () {
      // Nazario: boina negra, gafas cuadradas de pasta marrón y ropa remendada
      this.playerMesh = A.human({
        skin: '#d3a276', hair: '#3a2f22', shirt: '#75705a', pants: '#4a4234',
        hat: 'boina', hatColor: '#1b1b1f', beard: '#3a2f22', boots: '#3a2a1c',
        gafas: true, gafasColor: '#6b4423',
        remiendos: ['#5f5540', '#46474e', '#7a5238'],
        vest: '#5d5a48'
      });
      this.scene.add(this.playerMesh);
      this.farol = new THREE.PointLight(0xffd9a0, 0, 16, 2);
      this.scene.add(this.farol);
      this.pPos = new THREE.Vector3(-74, 0, -38);
      this.pHeading = 0;
      this.pSpeed = 0;
    },

    /* ------------------------------------------------------ partida nueva */
    nuevaPartida: function () {
      var p = this.player;
      p.dar('sem_patata', 12); p.dar('sem_lechuga', 8); p.dar('sem_trigo', 40);
      p.dar('heno', 12); p.dar('pienso', 8); p.dar('grano', 8); p.dar('pan', 2);
      p.dinero = 2500;
      this.pPos.set(-74, this.terrain.heightAt(-74, -38), -38);

      var inicial = [['vaca', 'Pinta'], ['vaca', 'Lucera'], ['vaca', 'Morena'],
                     ['oveja', 'Copo'], ['oveja', 'Nube'], ['cordero', 'Chispa'],
                     ['gallina', 'Cuca'], ['gallina', 'Pita'], ['pollo', 'Peque'], ['burro', 'Carolo']];
      for (var i = 0; i < inicial.length; i++) {
        var a = this.crearAnimal(inicial[i][0], inicial[i][1]);
        a.fed = true;
        if (a.def.prod) a.productReady = true;
      }
      this.crearNPCs();
      this.clock.tomorrow = this.clock.rollWeather();
      this.estado = 'juego';
      this.ui.hudVisible(true);
      this.ui.aviso('SORRÍOS DE ORDÁS', 'La casa de Nazario · ' + this.clock.dateString());
    },

    crearAnimal: function (kind, nombre, x, z) {
      var zona = D.ANIMALS[kind].casa === 'gallinero'
        ? { x: -86, z: -26, w: 10, d: 8 }
        : this.prado;
      var a = new F.Animal(kind, {
        nombre: nombre,
        x: x == null ? zona.x + U.rnd(-zona.w / 3, zona.w / 3) : x,
        z: z == null ? zona.z + U.rnd(-zona.d / 3, zona.d / 3) : z
      });
      a.zona = zona;
      this.scene.add(a.mesh);
      this.animales.push(a);
      return a;
    },

    crearNPCs: function () {
      for (var i = 0; i < D.NPCS.length; i++) {
        var n = new S.NPCs.NPC(D.NPCS[i], this.scene, this.terrain, this.spots);
        n.colocar(n.destinoAhora(this.clock));
        this.npcs.push(n);
      }
    },
    npc: function (id) { for (var i = 0; i < this.npcs.length; i++) if (this.npcs[i].id === id) return this.npcs[i]; return null; },

    /* ============================================================ UPDATE = */
    update: function (dt) {
      this.reloj += dt;
      var jugando = this.estado === 'juego';

      if (jugando || this.estado === 'dialogo' || this.estado === 'ordeno') {
        var ev = this.clock.update(dt);
        if (ev && ev.lightning) { this.sky.lightning(); S.Audio.fx('trueno'); }
        if (ev && ev.collapse) this.dormir(true);
      }

      if (jugando) {
        this.actualizarJugador(dt);
        this.comprobarEntradas();
      } else {
        this.pSpeed = 0;
        A.animateHuman(this.playerMesh, dt, 0);
      }
      if (this.estado === 'ordeno') this.actualizarOrdeno(dt);

      this.actualizarYunta(dt, jugando);
      this.actualizarAnimales(dt);
      this.actualizarNPCs(dt);
      this.actualizarCamara(dt);
      var wind = this.clock.isRaining() ? 2.2 : (this.clock.weather === 'tormenta' ? 3 : 1);
      this.grass.update(dt, this.camera.position, wind);
      this.water.update(dt);
      this.sky.update(dt, this.clock, this.camera.position, this.pPos);
      this.sky.refreshEnvironment(this.renderer, this.scene);
      this.actualizarFarolas();
      if (this.farol) {
        var oscuro = 1 - U.clamp(this.clock.daylight() * 2.2, 0, 1);
        this.farol.intensity = oscuro * 9;
        this.farol.position.set(this.pPos.x, this.pPos.y + 1.8, this.pPos.z);
      }
      this.actualizarAudio(dt);
      if (jugando) { this.limpiarCinturon(); this.ui.refrescar(); }
      S.Input.finFrame();
    },

    /* ------------------------------------------------------- movimiento -- */
    actualizarJugador: function (dt) {
      var I = S.Input, p = this.player;
      var mv = I.mover();

      // Si va guiando la yunta, Nazario camina agarrado a la mancera
      if (this.guiando && this.yunta.uncida) {
        var input = { avance: -mv.y, giro: mv.x };
        this.yunta.update(dt, input, true);
        var puesto = this.yunta.puestoDelGanadero();
        this.pPos.copy(puesto);
        this.pHeading = this.yunta.heading;
        this.pSpeed = Math.abs(this.yunta.speed);
        this.playerMesh.position.copy(this.pPos);
        this.playerMesh.rotation.y = this.pHeading + Math.PI;
        this.playerMesh.visible = this.camModo !== 1;
        A.animateHuman(this.playerMesh, dt, this.pSpeed, { armsBusy: true });
        // brazos hacia la mancera
        var d = this.playerMesh.userData;
        d.armL.root.rotation.x = -0.62; d.armR.root.rotation.x = -0.62;
        d.armL.root.rotation.z = 0.22; d.armR.root.rotation.z = -0.22;
        d.armL.fore.rotation.x = -0.30; d.armR.fore.rotation.x = -0.30;
        // el trabajo cansa
        if (this.pSpeed > 0.1) p.cansar(dt * (this.yunta.clavado ? 1.6 : 0.7));
        if (this.yunta.clavado && this.pSpeed > 0.15) this.trabajarTierra(dt);
        this._pasoT = (this._pasoT || 0) + dt * this.pSpeed;
        if (this._pasoT > 1.2) { this._pasoT = 0; S.Audio.fx('paso'); }
        for (var h = 0; h < this.hijos.length; h++) this.hijos[h].update(dt, this.pPos);
        return;
      }

      var correr = I.pulsado.correr && p.energia > 5;
      var vel = correr ? 5.0 : 2.4;
      var moviendo = mv.len > 0.08;
      if (moviendo) {
        var ang = Math.atan2(mv.x, mv.y);
        var dir = this.camYaw + ang + Math.PI;
        var nx = this.pPos.x - Math.sin(dir) * vel * mv.len * dt;
        var nz = this.pPos.z - Math.cos(dir) * vel * mv.len * dt;
        if (!this.chocaEn(nx, this.pPos.z, 0.45)) this.pPos.x = nx;
        if (!this.chocaEn(this.pPos.x, nz, 0.45)) this.pPos.z = nz;
        var lim = S.MAP_SIZE / 2 - 8;
        this.pPos.x = U.clamp(this.pPos.x, -lim, lim);
        this.pPos.z = U.clamp(this.pPos.z, -lim, lim);
        this.pHeading += U.angleDelta(this.pHeading, dir) * Math.min(1, dt * 12);
        this.pSpeed = vel * mv.len;
        if (correr) p.energia = Math.max(0, p.energia - dt * 0.9);
        this._pasoT = (this._pasoT || 0) + dt * this.pSpeed;
        if (this._pasoT > 1.55) {
          this._pasoT = 0;
          S.Audio.fx(this.terrain.isRoad(this.pPos.x, this.pPos.z) ? 'paso_duro' : 'paso');
        }
      } else this.pSpeed = U.damp(this.pSpeed, 0, 12, dt);

      this.pPos.y = this.terrain.heightAt(this.pPos.x, this.pPos.z);
      this.playerMesh.position.copy(this.pPos);
      this.playerMesh.rotation.set(0, this.pHeading + Math.PI, 0);
      this.playerMesh.visible = this.camModo !== 1;
      A.animateHuman(this.playerMesh, dt, this.pSpeed, { armsBusy: this._usando > 0 });
      if (this._usando > 0) this._usando -= dt;
      for (var i = 0; i < this.hijos.length; i++) this.hijos[i].update(dt, this.pPos);
    },

    chocaEn: function (x, z, r) {
      for (var i = 0; i < this.colliders.length; i++) {
        var c = this.colliders[i];
        if (Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r) return true;
      }
      return false;
    },

    /* ------------------------------------------------------------ yunta -- */
    actualizarYunta: function (dt, jugando) {
      if (!this.yunta) return;
      if (this.yunta.uncida && !(this.guiando && jugando)) this.yunta.update(dt, null, false);
    },

    trabajarTierra: function (dt) {
      var y = this.yunta;
      var wp = y.puntoTrabajo();
      var plot = null;
      for (var i = 0; i < this.plots.length; i++) {
        if (this.plots[i].contains(wp.x, wp.z)) { plot = this.plots[i]; break; }
      }
      if (!plot) return;
      var ancho = y.ancho();
      if (y.apero === 'arado') {
        var n = plot.arar(wp.x, wp.z, ancho, y.heading);
        if (n) {
          this._ruidoT = (this._ruidoT || 0) + dt;
          if (this._ruidoT > 0.7) { this._ruidoT = 0; S.Audio.fx('arar'); }
        }
      } else if (y.apero === 'grada') {
        // La grada deja la tierra fina y de paso siembra si llevas simiente
        var mano = this.player.enMano(), def = D.ITEMS[mano];
        if (def && def.t === 'seed' && this.player.cuantos(mano) > 0) {
          if (D.CROPS[def.crop].s.indexOf(this.clock.season) < 0) {
            this._avisoT = (this._avisoT || 0) - dt;
            if (this._avisoT <= 0) { this._avisoT = 4; this.ui.toast(D.CROPS[def.crop].n + ' no es de esta estación', 'malo'); }
            return;
          }
          var s = plot.sembrar(wp.x, wp.z, ancho, def.crop, y.heading);
          if (s) {
            this.player.quitar(mano, Math.max(1, Math.round(s / 3)));
            S.Audio.fx('sembrar');
          }
        } else {
          this._avisoT = (this._avisoT || 0) - dt;
          if (this._avisoT <= 0) { this._avisoT = 5; this.ui.toast('Lleva simiente en la mano para sembrar con la grada', 'malo'); }
        }
      }
    },

    /* ---------------------------------------------------------- animales */
    actualizarAnimales: function (dt) {
      var t = this.reloj;
      for (var i = 0; i < this.animales.length; i++) {
        var a = this.animales[i];
        if (a.enYunta) continue;            // esas las mueve la yunta
        var lejos = Math.hypot(a.pos.x - this.pPos.x, a.pos.z - this.pPos.z);
        if (lejos > 120) { a.mesh.visible = false; continue; }
        a.mesh.visible = true;
        a.update(lejos > 45 ? dt * 0.4 : dt, this.terrain, a.zona, t);
        a.sonidoT -= dt;
        if (a.sonidoT <= 0) {
          a.sonidoT = U.rnd(16, 45);
          if (lejos < 26 && U.chance(0.5)) S.Audio.fx(a.def.sonido);
        }
      }
    },

    actualizarNPCs: function (dt) {
      for (var i = 0; i < this.npcs.length; i++) {
        var n = this.npcs[i];
        var d = Math.hypot(n.pos.x - this.pPos.x, n.pos.z - this.pPos.z);
        n.mesh.visible = d < 130;
        if (d < 130) n.update(d > 40 ? dt * 0.5 : dt, this.clock, this.reloj);
      }
    },

    actualizarFarolas: function () {
      if (!this.farolas) return;
      var noche = this.clock.daylight() < 0.3;
      if (this._farolasOn === noche) return;
      this._farolasOn = noche;
      for (var i = 0; i < this.farolas.length; i++) {
        var f = this.farolas[i];
        if (f.userData.light) f.userData.light.intensity = noche ? 12 : 0;
        if (f.userData.lampGlass) f.userData.lampGlass.material.emissiveIntensity = noche ? 1.4 : 0;
      }
    },

    actualizarAudio: function (dt) {
      var c = this.clock;
      S.Audio.ambiente(c.isRaining() ? (c.weather === 'tormenta' ? 1.4 : 1) : 0, c.weather === 'tormenta' ? 1 : 0.35);
      this._pajaroT = (this._pajaroT || 3) - dt;
      if (this._pajaroT <= 0) {
        this._pajaroT = U.rnd(4, 14);
        if (c.daylight() > 0.4 && !c.isRaining() && U.chance(0.7)) S.Audio.pajaro();
      }
    },

    /* ------------------------------------------------------------ cámara */
    actualizarCamara: function (dt) {
      var I = S.Input;
      this.camYaw -= I.mirada.x;
      this.camPitch = U.clamp(this.camPitch + I.mirada.y, -0.45, 1.15);
      I.mirada.x = 0; I.mirada.y = 0;
      this.camDist = U.clamp(this.camDist + I.rueda * 2, 2.5, 14);

      if (I.tomar('camara')) {
        this.camModo = (this.camModo + 1) % 2;
        this.ui.toast(this.camModo ? 'Cámara en primera persona' : 'Cámara en tercera persona', 'info');
      }

      var objetivo = this.pPos.clone().add(V3(0, 1.62, 0));
      var dist = this.camModo === 1 ? 0 : this.camDist;

      if (dist < 0.4) {
        this.camera.position.copy(objetivo);
        var dir = V3(-Math.sin(this.camYaw) * Math.cos(this.camPitch), -Math.sin(this.camPitch), -Math.cos(this.camYaw) * Math.cos(this.camPitch));
        this.camera.lookAt(objetivo.clone().add(dir));
      } else {
        var off = V3(
          Math.sin(this.camYaw) * Math.cos(this.camPitch),
          Math.sin(this.camPitch) + 0.28,
          Math.cos(this.camYaw) * Math.cos(this.camPitch)
        ).multiplyScalar(dist);
        var libre = dist;
        for (var paso = 1; paso <= 10; paso++) {
          var t = paso / 10;
          var px2 = objetivo.x + off.x * t, pz2 = objetivo.z + off.z * t, py2 = objetivo.y + off.y * t;
          if (this.chocaEn(px2, pz2, 0.55) || py2 < this.terrain.heightAt(px2, pz2) + 0.55) {
            libre = dist * Math.max(0.22, t - 0.12);
            break;
          }
        }
        off.setLength(libre);
        var deseada = objetivo.clone().add(off);
        var suelo = this.terrain.heightAt(deseada.x, deseada.z) + 0.9;
        if (deseada.y < suelo) deseada.y = suelo;
        if (!this._camPos) this._camPos = deseada.clone();
        this._camPos.x = U.damp(this._camPos.x, deseada.x, 12, dt);
        this._camPos.y = U.damp(this._camPos.y, deseada.y, 10, dt);
        this._camPos.z = U.damp(this._camPos.z, deseada.z, 12, dt);
        this.camera.position.copy(this._camPos);
        this.camera.lookAt(objetivo);
      }
    },

    /* ------------------------------------------------------ interacción -- */
    objetivoCercano: function () {
      var mejor = null, md = 99;
      var px = this.pPos.x, pz = this.pPos.z;
      for (var i = 0; i < this.animales.length; i++) {
        var a = this.animales[i];
        var d = Math.hypot(a.pos.x - px, a.pos.z - pz);
        if (d < 2.8 && d < md) { md = d; mejor = { tipo: 'animal', animal: a, d: d }; }
      }
      for (var n = 0; n < this.npcs.length; n++) {
        var v = this.npcs[n];
        var dn = Math.hypot(v.pos.x - px, v.pos.z - pz);
        if (dn < 2.6 && dn < md) { md = dn; mejor = { tipo: 'npc', npc: v, d: dn }; }
      }
      for (var h = 0; h < this.hijos.length; h++) {
        var c = this.hijos[h];
        if (c.etapa === 0) continue;
        var dh = Math.hypot(c.pos.x - px, c.pos.z - pz);
        if (dh < 2.4 && dh < md) { md = dh; mejor = { tipo: 'hijo', hijo: c, d: dh }; }
      }
      for (var p = 0; p < this.interactivos.length; p++) {
        var it = this.interactivos[p];
        var di = Math.hypot(it.x - px, it.z - pz);
        if (di < it.r && di < md) { md = di; mejor = { tipo: it.tipo, punto: it, d: di }; }
      }
      // la yunta uncida, para ponerse detrás del arado
      if (this.yunta && this.yunta.uncida && !this.guiando) {
        var dy = Math.hypot(this.yunta.pos.x - px, this.yunta.pos.z - pz);
        if (dy < 4 && dy < md + 1) { md = dy; mejor = { tipo: 'yunta', d: dy }; }
      }
      return mejor;
    },

    comprobarEntradas: function () {
      var I = S.Input;
      if (I.tomar('menu')) { this.ui.abrirMenu(); return; }
      if (I.tomar('siguiente')) { this.player.slot = (this.player.slot + 1) % this.player.cinturon.length; S.Audio.fx('menu'); }
      if (I.tomar('anterior')) { this.player.slot = (this.player.slot + this.player.cinturon.length - 1) % this.player.cinturon.length; S.Audio.fx('menu'); }
      for (var k = 1; k <= 9; k++) if (I.tomar('r' + k) && this.player.cinturon[k - 1]) this.player.slot = k - 1;

      if (this.guiando) {
        if (I.tomar('bajar_apero')) this.clavarArado();
        if (I.tomar('cambiar_apero')) this.cambiarApero();
        if (I.tomar('montar')) this.soltarRiendas();
        if (I.tomar('accion')) this.clavarArado();
        this.ui.prompt(this.yunta.clavado ? 'H · levantar el apero   ·   T · soltar la yunta'
                                          : 'H · clavar el apero   ·   T · soltar la yunta', 'H');
        return;
      }

      var obj = this.objetivoCercano();
      this.mostrarPrompt(obj);
      if (I.tomar('montar')) this.uncirODesuncir(obj);
      if (I.tomar('accion') && obj) this.interactuar(obj);
      if (I.tomar('herramienta')) this.usarHerramienta(obj);
    },

    mostrarPrompt: function (obj) {
      if (!obj) { this.ui.prompt(null); return; }
      var mano = this.player.enMano(), def = D.ITEMS[mano];
      var txt = '';
      switch (obj.tipo) {
        case 'animal':
          var a = obj.animal;
          if (a.productReady && a.def.tool === 'caldero') txt = mano === 'caldero' ? 'Ordeñar a ' + a.nombre + ' <b>(F)</b>' : 'Coge el caldero para ordeñar a ' + a.nombre;
          else if (a.productReady && a.kind === 'gallina') txt = 'Recoger el huevo de ' + a.nombre;
          else if (a.extraReady) txt = mano === 'tijeras' ? 'Esquilar a ' + a.nombre + ' <b>(F)</b>' : 'Coge las tijeras para esquilar';
          else if (a.def.tira) txt = 'Acariciar a ' + a.nombre + '   ·   <b>T</b> uncir la yunta';
          else txt = 'Acariciar a ' + a.nombre;
          break;
        case 'npc':
          txt = 'Hablar con <b>' + obj.npc.nombre + '</b>';
          if (def && def.t !== 'tool' && def.t !== 'seed') txt += '   ·   <b>F</b> regalar ' + def.n.toLowerCase();
          break;
        case 'hijo': txt = 'Hablar con ' + obj.hijo.nombre; break;
        case 'casa': txt = 'Entrar en casa (dormir y cocinar)'; break;
        case 'cuadra': txt = 'Cuadra: dar de comer al ganado'; break;
        case 'tenada': txt = 'Tenada: aquí descansan el arado, la grada y el carro'; break;
        case 'gallinero': txt = 'Gallinero: recoger los huevos'; break;
        case 'pozo': txt = 'Llenar la regadera en el pozo'; break;
        case 'comedero': txt = 'Echar de comer al ganado'; break;
        case 'tienda': txt = 'Entrar en ' + D.SHOPS[obj.punto.datos.shop].n; break;
        case 'concejo': txt = 'Panera del concejo: vender la cosecha'; break;
        case 'taberna': txt = 'Taberna de Arricio'; break;
        case 'ermita': txt = 'Ermita de San Roque'; break;
        case 'yunta': txt = 'Ponerte detrás del arado <b>(T)</b>'; break;
      }
      this.ui.prompt(txt, obj.tipo === 'yunta' ? 'T' : 'E');
    },

    interactuar: function (obj) {
      var p = this.player;
      switch (obj.tipo) {
        case 'animal': return this.tocarAnimal(obj.animal);
        case 'npc': return this.hablar(obj.npc);
        case 'hijo': return this.ui.dialogo(obj.hijo.nombre, U.pick(obj.hijo.frases()));
        case 'casa': return this.menuCasa();
        case 'cuadra': return this.enCuadra();
        case 'comedero': return this.darDeComer();
        case 'tenada': return this.cambiarApero();
        case 'gallinero': return this.recogerHuevos();
        case 'pozo':
          p.agua = p.aguaMax; S.Audio.fx('agua');
          return this.ui.toast('Regadera llena', 'info');
        case 'tienda': return this.ui.abrirTienda(obj.punto.datos.shop);
        case 'concejo': return this.venderConcejo();
        case 'taberna': return this.ui.dialogo('Taberna de Arricio',
          'Huele a vino, a leña y a conversación. Arricio anda detrás del mostrador.');
        case 'ermita': return this.ui.dialogo('Ermita de San Roque',
          p.esposa ? 'Aquí os casasteis, con el pueblo entero a la puerta.'
                   : 'Una ermita pequeña, de piedra y espadaña. Aquí se casa quien trae anillo y novia.');
        case 'yunta': return this.tomarRiendas();
      }
    },

    /* ----------------------------------------------------- herramientas -- */
    usarHerramienta: function (obj) {
      var p = this.player, mano = p.enMano(), def = D.ITEMS[mano];
      this._usando = 0.5;
      if (!def) return;

      if (obj && obj.tipo === 'npc' && def.t !== 'tool' && def.t !== 'seed') {
        if (mano === 'ramo' || mano === 'anillo') return this.pedir(obj.npc, mano);
        return this.regalar(obj.npc, mano);
      }
      if (obj && obj.tipo === 'animal') {
        if (mano === 'caldero') return this.empezarOrdeno(obj.animal);
        if (mano === 'tijeras') return this.esquilar(obj.animal);
      }

      var frente = this.puntoFrente(1.1);
      var h = this.huerta;
      if (h.contains(frente.x, frente.z)) {
        if (mano === 'azada' || mano === 'azadon') return this.cavarMano(h, frente, mano === 'azadon');
        if (mano === 'regadera') return this.regarMano(h, frente);
        if (def.t === 'seed') return this.sembrarMano(h, frente, mano);
      }
      if (mano === 'guadana') return this.segar();
      if (mano === 'hoz') return this.segar(true);
      if (mano === 'regadera') {
        if (Math.abs(frente.z - this.terrain.riverZAt(frente.x)) < 14) {
          p.agua = p.aguaMax; S.Audio.fx('agua');
          return this.ui.toast('Regadera llena en el río', 'info');
        }
        return this.ui.toast('Aquí no hay nada que regar', 'info');
      }
      if (mano === 'horca') return this.cargarCarro();
    },

    puntoFrente: function (d) {
      return {
        x: this.pPos.x - Math.sin(this.pHeading) * d,
        z: this.pPos.z - Math.cos(this.pHeading) * d
      };
    },

    cavarMano: function (plot, f, ancho) {
      var p = this.player;
      if (p.energia < 2) return this.ui.toast('Estás agotado', 'malo');
      var n = plot.arar(f.x, f.z, ancho ? plot.cell * 2 : plot.cell, this.pHeading);
      if (n) { p.cansar(ancho ? 2.2 : 1.4); S.Audio.fx('azada'); }
      else this.ui.toast('Aquí ya está cavado o hay algo sembrado', 'info');
    },
    sembrarMano: function (plot, f, semilla) {
      var p = this.player, def = D.ITEMS[semilla];
      if (p.cuantos(semilla) <= 0) return this.ui.toast('No te quedan semillas', 'malo');
      if (D.CROPS[def.crop].s.indexOf(this.clock.season) < 0)
        return this.ui.toast(D.CROPS[def.crop].n + ' no es de ' + S.SEASONS[this.clock.season].toLowerCase(), 'malo');
      var n = plot.sembrar(f.x, f.z, plot.cell, def.crop, this.pHeading);
      if (n) { p.quitar(semilla, 1); p.cansar(0.6); S.Audio.fx('sembrar'); }
      else this.ui.toast('Primero hay que cavar con la azada', 'info');
    },
    regarMano: function (plot, f) {
      var p = this.player;
      if (p.agua <= 0) return this.ui.toast('La regadera está vacía: ve al pozo', 'malo');
      var n = plot.regar(f.x, f.z, 1.4, this.pHeading);
      if (n) { p.agua--; p.cansar(0.5); S.Audio.fx('agua'); }
      else this.ui.toast('Aquí no hay nada que regar', 'info');
    },

    // Segar la hierba del prado a guadaña
    segar: function (conHoz) {
      var p = this.player;
      if (p.energia < 3) return this.ui.toast('No te quedan fuerzas para segar', 'malo');
      if (this.terrain.isRoad(this.pPos.x, this.pPos.z))
        return this.ui.toast('Aquí no hay hierba que segar', 'info');
      p.cansar(conHoz ? 1.2 : 2.0);
      S.Audio.fx('arar');
      var cantidad = conHoz ? U.rndInt(1, 2) : U.rndInt(2, 4);
      p.stats.segado += cantidad;
      // Si el carro está enganchado y cerca, la hierba va al carro
      var y = this.yunta;
      if (y && y.uncida && y.apero === 'carro' && Math.hypot(y.pos.x - this.pPos.x, y.pos.z - this.pPos.z) < 12) {
        var puesto = y.cargar(cantidad);
        if (puesto > 0) {
          this.ui.toast('+' + puesto + ' hierba al carro (' + y.cargaCarro + ')', 'oro');
          return;
        }
        this.ui.toast('El carro va lleno', 'info');
      }
      if (p.dar('hierba', cantidad)) this.ui.toast('+' + cantidad + ' hierba segada', 'oro');
      else this.ui.toast('No puedes cargar más: engancha el carro', 'malo');
    },

    cargarCarro: function () {
      var y = this.yunta, p = this.player;
      if (!y.uncida || y.apero !== 'carro') return this.ui.toast('Engancha el carro a la yunta', 'info');
      if (Math.hypot(y.pos.x - this.pPos.x, y.pos.z - this.pPos.z) > 6) return this.ui.toast('Acércate al carro', 'info');
      var hierba = p.cuantos('hierba');
      if (hierba <= 0) return this.ui.toast('No llevas hierba que cargar', 'info');
      var n = y.cargar(hierba);
      p.quitar('hierba', n);
      p.cansar(1.5);
      S.Audio.fx('coger');
      this.ui.toast('Cargas ' + n + ' de hierba en el carro', 'oro');
    },

    enCuadra: function () {
      var y = this.yunta, p = this.player;
      // descargar el carro convierte la hierba en heno del pajar
      if (y && y.uncida && y.apero === 'carro' && y.cargaCarro > 0 &&
          Math.hypot(y.pos.x + 60, y.pos.z + 44) < 18) {
        var n = y.descargar();
        p.dar('heno', n);
        S.Audio.fx('ok');
        return this.ui.dialogo('El pajar', 'Descargas ' + n + ' de hierba en el pajar. Ya es heno para el invierno.');
      }
      return this.darDeComer();
    },

    /* -------------------------------------------------------- el ganado -- */
    tocarAnimal: function (a) {
      var p = this.player;
      if (a.kind === 'gallina' && a.productReady) {
        a.productReady = false;
        p.dar('huevo', 1); p.stats.huevos++;
        S.Audio.fx('coger');
        return this.ui.toast('+1 huevo de ' + a.nombre, 'oro');
      }
      if (a.productReady && a.def.tool === 'caldero') return this.empezarOrdeno(a);
      if (!a.pet) {
        a.pet = true;
        a.happy = U.clamp(a.happy + 8, 0, 100);
        S.Audio.fx(a.def.sonido);
        return this.ui.toast('Acaricias a ' + a.nombre, 'info');
      }
      var estado = a.happy > 80 ? 'Está contentísima.' : (a.happy > 55 ? 'Está a gusto.' : (a.happy > 30 ? 'Anda regular, dale de comer.' : 'Está triste y con hambre.'));
      this.ui.dialogo(a.nombre, a.def.n + '. ' + estado);
    },

    darDeComer: function () {
      var p = this.player;
      var pienso = ['hierba', 'heno', 'pienso', 'grano', 'alfalfa'].filter(function (f) { return p.cuantos(f) > 0; })[0];
      if (!pienso) return this.ui.toast('No llevas hierba ni pienso', 'malo');
      var n = 0;
      for (var i = 0; i < this.animales.length; i++) {
        var a = this.animales[i];
        if (a.fed) continue;
        if (a.def.come.indexOf(pienso) < 0 && pienso !== 'pienso') continue;
        if (p.cuantos(pienso) <= 0) break;
        p.quitar(pienso, 1);
        a.fed = true;
        a.happy = U.clamp(a.happy + 6, 0, 100);
        n++;
      }
      if (!n) return this.ui.toast('El ganado ya está comido', 'info');
      S.Audio.fx('ok');
      this.ui.toast('Das de comer a ' + n + ' animal' + (n > 1 ? 'es' : ''), 'oro');
    },

    recogerHuevos: function () {
      var n = 0, p = this.player;
      for (var i = 0; i < this.animales.length; i++) {
        var a = this.animales[i];
        if (a.kind === 'gallina' && a.productReady) { a.productReady = false; p.dar('huevo', 1); n++; }
      }
      if (!n) return this.ui.toast('Hoy no hay huevos que recoger', 'info');
      p.stats.huevos += n;
      S.Audio.fx('coger');
      this.ui.toast('+' + n + ' huevos', 'oro');
    },

    esquilar: function (a) {
      if (!a.def.extra) return this.ui.toast(a.nombre + ' no da lana', 'info');
      if (!a.extraReady) return this.ui.toast(a.nombre + ' aún no tiene lana suficiente', 'info');
      a.extraReady = false; a.extraT = 0; a.sheared = true;
      this.player.dar('lana', 1);
      this.player.cansar(3);
      S.Audio.fx('coger');
      this.ui.toast('¡Lana de ' + a.nombre + '!', 'oro');
    },

    /* ---------------------------------------------------------- ordeño -- */
    empezarOrdeno: function (a) {
      if (!a.def.prod || a.def.tool !== 'caldero') return this.ui.toast(a.nombre + ' no se ordeña', 'info');
      if (!a.productReady) return this.ui.toast(a.nombre + ' ya está ordeñada hoy', 'info');
      if (this.player.energia < 4) return this.ui.toast('No te quedan fuerzas', 'malo');
      this.milking.start(a, a.def.prod);
      this.estado = 'ordeno';
      this.ui.abrirOrdeno(a);
      this.ui.prompt(null);
    },
    ordenar: function (mano) {
      if (this.estado !== 'ordeno') return;
      var r = this.milking.press(mano);
      if (r === 'ok') S.Audio.fx('leche');
      else if (r === 'mal') S.Audio.fx('no');
    },
    actualizarOrdeno: function (dt) {
      var I = S.Input, m = this.milking;
      if (I.tomar('izq')) this.ordenar(0);
      if (I.tomar('der')) this.ordenar(1);
      if (I.tomar('herramienta')) this.ordenar(0);
      if (I.tomar('accion')) this.ordenar(1);
      m.update(dt);
      this.ui.refrescarOrdeno(m);
      if (!m.activo) {
        var got = m.rendimiento(), a = m.animal, p = this.player;
        this.ui.cerrarOrdeno();
        this.estado = 'juego';
        p.cansar(4);
        if (got > 0) {
          p.dar(m.producto, got);
          p.stats.ordenos++;
          a.productReady = false;
          a.happy = U.clamp(a.happy + 6, 0, 100);
          S.Audio.fx('logro');
          this.ui.toast('+' + got + ' ' + D.ITEMS[m.producto].n + ' en el caldero', 'oro');
        } else {
          a.happy = U.clamp(a.happy - 4, 0, 100);
          this.ui.toast(a.nombre + ' se ha movido. Inténtalo otra vez.', 'malo');
        }
      }
    },

    /* --------------------------------------------------------- vecinos -- */
    hablar: function (n) {
      if (!n.habladoHoy) {
        n.habladoHoy = true;
        if (n.sumarPuntos(18)) S.Audio.fx('corazon');
      }
      this.ui.dialogo(n.nombre, n.frase(this.clock), n);
    },
    regalar: function (n, id) {
      var p = this.player, def = D.ITEMS[id];
      if (n.regaladoHoy) return this.ui.dialogo(n.nombre, 'Ya me has dado algo hoy, ¡no te arruines!', n);
      if (p.cuantos(id) <= 0) return;
      var pts = 12, resp = 'Vaya, gracias, Nazario.';
      if (n.def.encanta && n.def.encanta.indexOf(id) >= 0) { pts = 65; resp = '¡Justo lo que más me gusta! Muchísimas gracias.'; }
      else if (n.def.gusta && n.def.gusta.indexOf(id) >= 0) { pts = 38; resp = '¡Qué detalle! Me encanta.'; }
      else if (id === 'piedra') { pts = -4; resp = '¿Una piedra? Anda, guárdala.'; }
      p.quitar(id, 1);
      n.regaladoHoy = true;
      var subio = n.sumarPuntos(pts);
      S.Audio.fx(pts > 0 ? 'corazon' : 'no');
      if (subio) { S.Audio.fx('logro'); this.ui.toast('¡' + n.nombre + ' te aprecia más! (' + n.corazones + '♥)', 'oro'); }
      this.ui.dialogo(n.nombre, resp, n);
    },
    pedir: function (n, que) {
      var p = this.player;
      if (!n.def.novia) return this.ui.dialogo(n.nombre, 'Muy amable, pero eso guárdalo para quien tú sabes.', n);
      if (que === 'ramo') {
        if (p.pareja || p.esposa) return this.ui.dialogo(n.nombre, 'Nazario, tú ya tienes a alguien. No está bien.', n);
        if (n.corazones < 8) return this.ui.dialogo(n.nombre, 'Es precioso… pero aún nos conocemos poco. (Hacen falta 8 ♥)', n);
        p.quitar('ramo', 1);
        n.novia = true; p.pareja = n.id;
        n.sumarPuntos(120);
        S.Audio.fx('logro');
        this.ui.aviso('¡' + n.nombre + ' acepta!', 'Ya sois novios');
        return this.ui.dialogo(n.nombre, 'Sí quiero salir contigo, Nazario. Todo el pueblo va a hablar de esto.', n);
      }
      if (p.esposa) return this.ui.dialogo(n.nombre, 'Pero si ya estás casado, hombre.', n);
      if (p.pareja !== n.id) return this.ui.dialogo(n.nombre, 'Primero habría que ser novios, ¿no te parece?', n);
      if (n.corazones < 10) return this.ui.dialogo(n.nombre, 'Casarnos es mucha palabra todavía… (Hacen falta 10 ♥)', n);
      p.quitar('anillo', 1);
      n.casado = true; p.esposa = n.id;
      this.flags.boda = this.clock.dayCount;
      S.Audio.fx('campana');
      this.ui.aviso('¡BODA EN LA ERMITA!', 'Se casa Nazario');
      this.ui.dialogo(n.nombre, 'Sí quiero. Me vengo contigo a la casa, Nazario.', n);
    },

    /* ---------------------------------------------------------- tiendas */
    comprar: function (id, q) {
      var p = this.player, def = D.ITEMS[id];
      var total = def.buy * q;
      if (p.dinero < total) { S.Audio.fx('no'); return this.ui.toast('No te llega el dinero', 'malo'); }
      if (def.t === 'tool') {
        if (p.cinturon.indexOf(id) >= 0) return this.ui.toast('Ya tienes ese apero', 'info');
        p.gastar(total); p.cinturon.push(id);
        this.ui.hotbarCache = '';
        S.Audio.fx('moneda');
        return this.ui.toast('Compras: ' + def.n, 'oro');
      }
      if (!p.dar(id, q)) return this.ui.toast('No puedes cargar más', 'malo');
      p.gastar(total);
      S.Audio.fx('moneda');
      this.ui.toast('Compras ' + q + ' × ' + def.n, 'oro');
    },
    vender: function (id, q) {
      var p = this.player, def = D.ITEMS[id];
      q = Math.min(q, p.cuantos(id));
      if (q <= 0) return;
      p.quitar(id, q);
      p.dinero += def.sell * q;
      S.Audio.fx('moneda');
    },
    comprarAnimal: function (kind) {
      var p = this.player, def = D.ANIMALS[kind];
      var mismos = this.animales.filter(function (a) { return a.def.casa === def.casa; }).length;
      var tope = def.casa === 'gallinero' ? 14 : 18;
      if (mismos >= tope) return this.ui.toast(def.casa === 'gallinero' ? 'El gallinero está lleno' : 'La cuadra está llena', 'malo');
      if (p.dinero < def.precio) { S.Audio.fx('no'); return this.ui.toast('No te llega el dinero', 'malo'); }
      p.gastar(def.precio);
      var a = this.crearAnimal(kind);
      a.fed = true;
      p.stats.ganado++;
      S.Audio.fx('logro'); S.Audio.fx(def.sonido);
      this.ui.toast('¡' + def.n + ' nueva: ' + a.nombre + '!', 'oro');
    },
    venderConcejo: function () {
      var p = this.player, total = 0, lineas = [];
      for (var i = p.inv.length - 1; i >= 0; i--) {
        var it = p.inv[i], def = D.ITEMS[it.id];
        if (def.t !== 'crop' && def.t !== 'prod') continue;
        if (it.id === 'hierba') continue;
        total += def.sell * it.q;
        lineas.push(it.q + ' × ' + def.n);
        p.quitar(it.id, it.q);
      }
      if (!total) return this.ui.toast('No traes cosecha que vender', 'info');
      p.dinero += total;
      S.Audio.fx('moneda');
      this.ui.dialogo('Panera del concejo',
        'Te compramos: ' + lineas.join(', ') + '. Son ' + U.fmtMoney(total) + '.');
    },

    /* ------------------------------------------------------------- casa */
    menuCasa: function () {
      var h = this.clock.hourF(), self = this;
      if (h >= 18 || h < 6) return this.dormir(false);
      var puede = D.RECETAS.filter(function (r) {
        return r.need.every(function (n) { return self.player.cuantos(n[0]) >= n[1]; });
      });
      if (!puede.length) return this.ui.dialogo('Casa de Nazario',
        'La lumbre está encendida, pero no tienes con qué cocinar. Vuelve por la tarde para dormir.');
      var r = puede[0];
      r.need.forEach(function (n) { self.player.quitar(n[0], n[1]); });
      this.player.dar(r.out[0], r.out[1]);
      S.Audio.fx('logro');
      this.ui.dialogo('La cocina', 'Has hecho ' + D.ITEMS[r.out[0]].n + '.');
    },

    dormir: function (desmayo) {
      this.estado = 'parte';
      this.ui.prompt(null);
      if (this.guiando) this.soltarRiendas();
      if (this.yunta.uncida) this.yunta.desuncir();
      var rep = this.nuevoDia(desmayo);
      if (desmayo) rep.eventos.unshift('Caíste rendido de cansancio. Amaneciste en la cama.');
      this.pPos.set(-84, this.terrain.heightAt(-84, -44), -44);
      this.ui.parteDelDia(rep);
      this.guardar(true);
    },

    /* --------------------------------------------------------- nuevo día */
    nuevoDia: function (desmayo) {
      var c = this.clock, p = this.player;
      var estacionAntes = c.season;
      c.nextDay();
      p.energia = desmayo ? p.energiaMax * 0.5 : p.energiaMax;
      p.agua = p.aguaMax;
      p.stats.dias++;
      var rep = { eventos: [] };

      var llueve = c.isRaining();
      var listos = 0;
      for (var i = 0; i < this.plots.length; i++) listos += this.plots[i].nuevoDia(llueve, c.season);
      if (listos) rep.eventos.push(listos + ' parcelas han llegado a punto de cosecha.');
      if (llueve) rep.eventos.push('Llueve: hoy no hace falta regar.');
      if (c.weather === 'nieve') rep.eventos.push('Ha nevado en Ordás. Mejor el ganado a cubierto.');
      if (c.weather === 'tormenta') rep.eventos.push('Tormenta: la huerta se riega sola… y truena.');
      if (estacionAntes !== c.season) {
        rep.eventos.push('Cambia la estación: entra ' + S.SEASONS[c.season] + '.');
        this.aplicarEstacion(c.season);
      }

      var crecidos = 0, producen = 0;
      for (var a = this.animales.length - 1; a >= 0; a--) {
        var an = this.animales[a];
        var crece = an.nuevoDia();
        if (crece) {
          this.scene.remove(an.mesh);
          var nuevo = this.crearAnimal(crece, an.nombre, an.pos.x, an.pos.z);
          nuevo.happy = an.happy;
          this.animales.splice(a, 1);
          crecidos++;
        } else if (an.productReady) producen++;
      }
      if (crecidos) rep.eventos.push('¡' + crecidos + ' cría' + (crecidos > 1 ? 's han' : ' ha') + ' crecido!');
      if (producen) rep.eventos.push(producen + ' animal' + (producen > 1 ? 'es tienen' : ' tiene') + ' algo que darte.');

      for (var n = 0; n < this.npcs.length; n++) {
        this.npcs[n].regaladoHoy = false;
        this.npcs[n].habladoHoy = false;
      }
      for (var h = 0; h < this.hijos.length; h++) {
        var kid = this.hijos[h];
        var et = kid.nuevoDia();
        if (et === 1) rep.eventos.push('¡' + kid.nombre + ' ya corre por la finca!');
        if (et === 2) rep.eventos.push('¡' + kid.nombre + ' se ha hecho moz' + (kid.nina ? 'a' : 'o') + ' y ayuda en todo!');
        if (kid.etapa >= 1) this.ayudaHijo(kid, rep);
      }
      if (p.esposa) {
        var sp = this.npc(p.esposa);
        if (sp) {
          if (U.chance(0.5)) {
            var regalo = U.pick(['pan', 'cafe', 'sopa', 'tortilla']);
            if (p.dar(regalo, 1)) rep.eventos.push(sp.nombre + ' te ha dejado ' + D.ITEMS[regalo].n.toLowerCase() + ' para el día.');
          }
          var desde = c.dayCount - (this.flags.boda || 0);
          if (desde > 10 && this.hijos.length < 3 && U.chance(0.08)) {
            var kid2 = new S.NPCs.Child(this.scene, this.terrain, { x: this.pPos.x, z: this.pPos.z });
            this.hijos.push(kid2);
            rep.eventos.push('¡Ha nacido ' + kid2.nombre + '! Ya sois familia.');
          }
        }
      }
      return rep;
    },

    ayudaHijo: function (kid, rep) {
      var reg = 0;
      for (var i = 0; i < this.plots.length; i++) {
        var pl = this.plots[i];
        for (var c = 0; c < pl.n && reg < (kid.etapa === 2 ? 60 : 20); c++) {
          if (pl.state[c] === F.SEMBRADO && !pl.wet[c]) { pl.wet[c] = 1; reg++; }
        }
      }
      if (reg) rep.eventos.push(kid.nombre + ' ha regado ' + reg + ' parcelas.');
      if (kid.etapa === 2) {
        var n = 0;
        for (var a = 0; a < this.animales.length; a++) if (!this.animales[a].fed) { this.animales[a].fed = true; n++; }
        if (n) rep.eventos.push(kid.nombre + ' ha dado de comer a ' + n + ' animales.');
      }
    },

    /* ------------------------------------------------------------ yunta */
    uncirODesuncir: function (obj) {
      var y = this.yunta;
      if (this.guiando) return this.soltarRiendas();
      if (y.uncida) {
        var d = Math.hypot(y.pos.x - this.pPos.x, y.pos.z - this.pPos.z);
        if (d < 5) return this.tomarRiendas();
        y.desuncir();
        return this.ui.toast('Sueltas la yunta', 'info');
      }
      if (this.player.enMano() !== 'aguijada') {
        var tiene = this.player.cinturon.indexOf('aguijada') >= 0;
        return this.ui.toast(tiene ? 'Coge la aguijada para uncir la yunta' : 'Necesitas una aguijada', 'malo');
      }
      var prefiere = (obj && obj.tipo === 'animal' && obj.animal.kind === 'burro') ? 'burro' : null;
      var tipo = y.uncir(this.animales, this.pPos, prefiere);
      if (!tipo) return this.ui.toast('Acércate a dos vacas o al burro Carolo', 'malo');
      S.Audio.fx(tipo === 'vacas' ? 'muu' : 'iaa');
      this.ui.toast(tipo === 'vacas' ? 'Unces la pareja de vacas al yugo' : 'Unces a Carolo al yugo', 'oro');
      this.tomarRiendas();
    },

    tomarRiendas: function () {
      if (!this.yunta.uncida) return;
      this.guiando = true;
      this.ui.toast('Detrás del arado · H clavar/levantar · C cambiar apero · T soltar', 'info');
    },
    soltarRiendas: function () {
      this.guiando = false;
      this.yunta.speed = 0;
      var s = this.yunta.sitioSalida();
      this.pPos.copy(s);
      this.ui.toast('Sueltas la mancera', 'info');
    },
    clavarArado: function () {
      var y = this.yunta;
      if (!y.uncida) return;
      if (y.apero === 'carro') return this.ui.toast('El carro no se clava: solo se carga', 'info');
      y.clavado = !y.clavado;
      S.Audio.fx(y.clavado ? 'arar' : 'ok');
      this.ui.toast(y.clavado ? 'Arado clavado: a labrar' : 'Apero levantado', 'info');
    },
    cambiarApero: function () {
      var y = this.yunta;
      var nuevo = y.cambiarApero();
      S.Audio.fx('menu');
      this.ui.toast('Apero: ' + y.nombreApero(), 'info');
      return nuevo;
    },

    /* ---------------------------------------------------------- varios -- */
    limpiarCinturon: function () {
      var p = this.player, cambio = false;
      for (var i = p.cinturon.length - 1; i >= 0; i--) {
        var def = D.ITEMS[p.cinturon[i]];
        if (def && def.t !== 'tool' && p.cuantos(p.cinturon[i]) <= 0) { p.cinturon.splice(i, 1); cambio = true; }
      }
      if (!p.cinturon.length) p.cinturon.push('azada');
      p.slot = U.clamp(p.slot, 0, p.cinturon.length - 1);
      if (cambio) this.ui.hotbarCache = '';
    },
    equipar: function (id) {
      var p = this.player;
      var i = p.cinturon.indexOf(id);
      if (i >= 0) { p.slot = i; return; }
      if (p.cinturon.length >= 9) p.cinturon.pop();
      p.cinturon.push(id);
      p.slot = p.cinturon.length - 1;
      this.ui.hotbarCache = '';
    },
    comer: function (id) {
      var p = this.player, def = D.ITEMS[id];
      if (!def.energy || p.cuantos(id) <= 0) return;
      p.quitar(id, 1);
      p.energia = U.clamp(p.energia + def.energy, 0, p.energiaMax);
      S.Audio.fx('ok');
      this.ui.toast('+' + def.energy + ' de fuerzas', 'oro');
    },
    resumenGranja: function () {
      var p = this.player, cuenta = {};
      this.animales.forEach(function (a) { cuenta[a.def.n] = (cuenta[a.def.n] || 0) + 1; });
      var ganado = Object.keys(cuenta).map(function (k) { return cuenta[k] + ' × ' + k; }).join(', ') || 'Sin animales';
      var sembradas = 0, listas = 0, cavadas = 0;
      this.plots.forEach(function (pl) {
        for (var i = 0; i < pl.n; i++) {
          if (pl.state[i] === F.ARADO) cavadas++;
          else if (pl.state[i] === F.SEMBRADO) sembradas++;
          else if (pl.state[i] === F.LISTO) listas++;
        }
      });
      var out = [
        ['Ganado', ganado],
        ['Tierra labrada', cavadas + ' parcelas'],
        ['Sembrado', sembradas + ' parcelas'],
        ['Listo para coger', listas + ' parcelas'],
        ['Días en el pueblo', this.clock.dayCount],
        ['Ordeños', p.stats.ordenos],
        ['Huevos recogidos', p.stats.huevos],
        ['Hierba segada', p.stats.segado],
        ['Cosechado', Math.round(p.stats.cosechado) + ' unidades'],
        ['Dinero', U.fmtMoney(p.dinero)]
      ];
      if (this.yunta && this.yunta.uncida) out.push(['Yunta', this.yunta.tipo === 'vacas' ? 'Pareja de vacas' : 'Carolo el burro']);
      if (p.esposa) out.push(['Casado con', (this.npc(p.esposa) || {}).nombre || '—']);
      else if (p.pareja) out.push(['Saliendo con', (this.npc(p.pareja) || {}).nombre || '—']);
      if (this.hijos.length) {
        out.push(['Hijos', this.hijos.map(function (k) {
          return k.nombre + ' (' + ['bebé', 'niñ' + (k.nina ? 'a' : 'o'), 'moz' + (k.nina ? 'a' : 'o')][k.etapa] + ')';
        }).join(', ')]);
      }
      return out;
    },

    /* --------------------------------------------------------- guardado */
    guardar: function (silencioso) {
      var p = this.player;
      var datos = {
        v: 2,
        clock: this.clock.save(),
        player: {
          dinero: p.dinero, energia: p.energia, inv: p.inv, cinturon: p.cinturon, slot: p.slot,
          agua: p.agua, pareja: p.pareja, esposa: p.esposa, stats: p.stats,
          x: this.pPos.x, z: this.pPos.z
        },
        animales: this.animales.map(function (a) { return a.save(); }),
        npcs: this.npcs.map(function (n) { return n.save(); }),
        hijos: this.hijos.map(function (h) { return h.save(); }),
        plots: this.plots.map(function (pl) { return pl.save(); }),
        yunta: this.yunta.save(),
        flags: this.flags
      };
      var ok = S.Storage.save(datos);
      if (ok && !silencioso) this.ui.toast('Partida guardada', 'oro');
      return ok;
    },

    cargar: function () {
      var d = S.Storage.load();
      if (!d) return false;
      try {
        this.clock.load(d.clock);
        // el valle se levantó con la estación de la partida nueva: al cargar
        // hay que vestirlo con la que traiga el guardado
        this.aplicarEstacion(this.clock.season);
        var p = this.player, s = d.player;
        p.dinero = s.dinero; p.energia = s.energia; p.inv = s.inv || [];
        p.cinturon = s.cinturon || p.cinturon; p.slot = s.slot || 0;
        p.agua = s.agua; p.pareja = s.pareja; p.esposa = s.esposa;
        p.stats = s.stats || p.stats;
        this.pPos.set(s.x || -74, 0, s.z || -38);
        this.pPos.y = this.terrain.heightAt(this.pPos.x, this.pPos.z);

        (d.animales || []).forEach(function (a) {
          var an = this.crearAnimal(a.kind, a.nombre, a.x, a.z);
          an.fed = a.fed; an.happy = a.happy; an.age = a.age;
          an.productReady = a.productReady; an.extraReady = a.extraReady;
          an.extraT = a.extraT || 0; an.sheared = a.sheared;
        }, this);

        this.crearNPCs();
        (d.npcs || []).forEach(function (sn) {
          var n = this.npc(sn.id);
          if (n) { n.puntos = sn.puntos; n.corazones = sn.corazones; n.casado = sn.casado; n.novia = sn.novia; }
        }, this);
        (d.hijos || []).forEach(function (h) {
          this.hijos.push(new S.NPCs.Child(this.scene, this.terrain, h));
        }, this);
        (d.plots || []).forEach(function (pd) {
          for (var i = 0; i < this.plots.length; i++) if (this.plots[i].id === pd.id) this.plots[i].load(pd);
        }, this);
        if (d.yunta) this.yunta.load(d.yunta);
        this.flags = d.flags || {};
        this.estado = 'juego';
        this.ui.hudVisible(true);
        this.ui.toast('¡Bienvenido de vuelta, Nazario!', 'oro');
        return true;
      } catch (e) {
        console.error('Error al cargar:', e);
        return false;
      }
    },

    render: function () {
      if (this.post && this.post.activo) this.post.render();
      else this.renderer.render(this.scene, this.camera);
    }
  };

})(window);
