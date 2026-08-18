/* ============================================================================
   SORRÍOS DE ORDÁS 3D — game.js
   Montaje del valle, jugador en tercera persona, cámara, interacción,
   conducción del tractor, labores del campo, ganado, vecinos y el paso
   de los días.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, D = S.DATA, MD = S.Models, A = S.Actors, F = S.Farm;

  var V3 = function (x, y, z) { return new THREE.Vector3(x, y, z); };

  /* ============================================================= JUGADOR = */
  function Player() {
    this.nombre = 'Arricio';
    this.dinero = 2500;
    this.energia = 100; this.energiaMax = 100;
    this.inv = [];
    this.invMax = 28;
    this.cinturon = ['azada', 'regadera', 'cubo', 'hoz', 'tijeras'];
    this.slot = 0;
    this.agua = 20; this.aguaMax = 20;
    this.pareja = null; this.esposa = null;
    this.stats = { dias: 1, ordenos: 0, huevos: 0, cosechado: 0, hectareas: 0, ganado: 0 };
  }
  Player.prototype.cuantos = function (id) {
    for (var i = 0; i < this.inv.length; i++) if (this.inv[i].id === id) return this.inv[i].q;
    return 0;
  };
  Player.prototype.dar = function (id, q) {
    q = q || 1;
    var def = D.ITEMS[id];
    if (!def) return false;
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
    conduciendo: false,
    camModo: 0,          // 0 tercera persona, 1 primera persona
    camYaw: 0, camPitch: 0.22, camDist: 6.2,
    reloj: 0,

    /* ------------------------------------------------------------ arranque */
    init: function (canvas, onProgreso) {
      var self = this;
      this.q = S.quality();
      this.canvas = canvas;
      this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: this.q.antialias, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(this.q.pixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 2400);

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
    },

    cambiarCalidad: function () {
      var niveles = ['baja', 'media', 'alta'];
      var i = (niveles.indexOf(this.q.level) + 1) % 3;
      this.q.level = niveles[i];
      this.renderer.setPixelRatio(i === 2 ? Math.min(devicePixelRatio || 1, 2) : (i === 1 ? 1.25 : 1));
      this.sky.sun.shadow.mapSize.set(i === 2 ? 2048 : 1024, i === 2 ? 2048 : 1024);
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
      this.tractor = new S.Vehicles.Tractor(scene, this.terrain, { x: -58, z: -24, heading: Math.PI });
      this.tractor.attach('arado');
      this.crearJugador();
    },

    // Registra un obstáculo con el que choca el jugador
    colisor: function (x, z, w, d) { this.colliders.push({ x: x, z: z, w: w, d: d }); },
    // Registra un punto con el que se puede interactuar
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
      var T = this.terrain, self = this;
      // --- casa ---
      var casa = this.poner(MD.house({ w: 10, d: 8, h: 5.4, windows: 2 }), -84, -50, 0, true);
      this.spots.casa_arricio = { x: -84, z: -44 };
      this.punto(-84, -42.2, 3.2, 'casa', {});
      // --- nave/cuadra ---
      var nave = this.poner(MD.barn({ w: 22, d: 13, h: 5.8 }), -60, -52, 0, true);
      this.spots.cuadra = { x: -60, z: -44 };
      this.punto(-60, -44.5, 4.0, 'cuadra', {});
      // --- silo y cobertizo ---
      this.poner(MD.silo({ r: 2.8, h: 13 }), -44, -54, 0, true);
      this.poner(MD.silo({ r: 2.2, h: 10 }), -38, -54, 0, true);
      this.poner(MD.shed({ w: 14, d: 8, h: 4.6 }), -58, -26, Math.PI, true);
      // --- gallinero ---
      this.poner(MD.coop({ w: 7, d: 5, h: 2.6 }), -86, -32, 0, true);
      this.spots.gallinero = { x: -86, z: -28 };
      this.punto(-86, -28.5, 3.0, 'gallinero', {});
      // --- pozo, comedero, balas ---
      this.poner(MD.well(), -76, -44, 0, true);
      this.punto(-76, -44, 3.0, 'pozo', {});
      var com = this.poner(MD.trough(), -66, -36, 0, false);
      this.punto(-66, -36, 3.2, 'comedero', {});
      this.comedero = com;
      for (var b = 0; b < 6; b++) {
        this.poner(MD.roundBale(b > 3), -50 + (b % 3) * 2.0, -30 - Math.floor(b / 3) * 1.6, Math.random(), false);
      }
      this.poner(MD.squareBale(), -54, -33, 0.4, false);
      // --- cerca del prado ---
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

      // --- huerto de casa (a mano) ---
      var huerto = new F.Plot({
        id: 'huerto', nombre: 'Huerto de casa', x: -76, z: -30, w: 14, d: 10, cell: 1,
        huerto: true, terrain: T, scene: this.scene
      });
      this.plots.push(huerto);
      this.huerto = huerto;
      this.spots.huerto = { x: -76, z: -30 };
      T.clearGrassRect(-76, -30, 15, 11);
      var hp = [[-83.5, -35.5], [-68.5, -35.5], [-68.5, -24.5], [-83.5, -24.5], [-83.5, -35.5]];
      new MD.FenceRun(this.scene, hp, { terrain: T, step: 2.5 });
    },

    construirPueblo: function () {
      var self = this;
      function casa(x, z, ry, opt, spot) {
        var o = self.poner(MD.house(opt || {}), x, z, ry, true);
        if (spot) self.spots[spot] = { x: x, z: z + 6 };
        return o;
      }
      // plaza y farolas
      this.spots.plaza = { x: 70, z: 45 };
      for (var l = 0; l < 6; l++) {
        var ang = l / 6 * Math.PI * 2;
        var lx = 70 + Math.cos(ang) * 16, lz = 45 + Math.sin(ang) * 13;
        var lamp = this.poner(MD.streetLamp(), lx, lz, 0, false);
        this.farolas = this.farolas || [];
        this.farolas.push(lamp);
      }
      this.poner(MD.well(), 70, 45, 0, true);

      // iglesia
      var igl = this.poner(MD.church(), 54, 30, 0, true);
      this.spots.iglesia = { x: 54, z: 40 };
      this.punto(54, 39.5, 4, 'iglesia', {});

      // tiendas
      var t1 = this.poner(MD.shop({ w: 11, d: 8, sign: 'ULTRAMARINOS', awning: 'rojo', signBg: '#3d2a18' }), 54, 54, 0, true);
      this.spots.tienda_comida = { x: 54, z: 60 };
      this.punto(54, 59, 3.4, 'tienda', { shop: 'comestibles' });
      var t2 = this.poner(MD.shop({ w: 12, d: 9, sign: 'APEROS Y PIENSOS', awning: 'verde', darkRoof: true, signBg: '#1e3320' }), 88, 54, 0, true);
      this.spots.tienda_aperos = { x: 88, z: 60 };
      this.punto(88, 59.5, 3.6, 'tienda', { shop: 'aperos' });

      // cooperativa: donde se vende el grano a granel
      this.poner(MD.silo({ r: 3.4, h: 16 }), 40, 40, 0, true);
      this.poner(MD.silo({ r: 3.4, h: 16 }), 33, 40, 0, true);
      this.poner(MD.shed({ w: 12, d: 8, h: 5 }), 36, 48, 0, true);
      this.spots.cooperativa = { x: 36, z: 52 };
      this.punto(36, 52, 4, 'cooperativa', {});

      // taberna y casas
      this.poner(MD.shop({ w: 10, d: 8, sign: 'TABERNA', awning: 'rojo', signBg: '#3a1f14' }), 62, 68, 0, true);
      this.spots.taberna = { x: 62, z: 74 };
      casa(80, 68, 0, { w: 10, d: 8, plaster: true }, 'casa_marina');
      casa(94, 58, -0.5, { w: 8, d: 7, slate: true }, 'casa_aurora');
      casa(94, 34, 0.3, { w: 8, d: 7, plaster: true }, 'casa_nieves');
      this.spots.molino = { x: 94, z: 40 };
      casa(48, 64, 0, { w: 8, d: 7 }, 'casa_herminia');
      casa(58, 78, 0, { w: 8, d: 7, plaster: true }, 'casa_tino');
      casa(86, 74, 0, { w: 9, d: 8, darkRoof: true }, 'casa_celso');
      casa(100, 66, -0.4, { w: 8, d: 7 }, 'casa_lucio');
      this.spots.fragua = { x: 100, z: 72 };
      casa(46, 72, 0.2, { w: 7, d: 6, plaster: true }, 'casa_chelo');
      casa(72, 78, 0, { w: 12, d: 8, plaster: true, windows: 3 }, 'escuela');
      this.spots.escuela = { x: 72, z: 84 };
      this.spots.ayuntamiento = { x: 76, z: 45 };
      this.spots.rio = { x: 30, z: -100 };
      this.spots.puente = { x: 0, z: -95 };
    },

    construirCampos: function () {
      var T = this.terrain;
      var defs = [
        { id: 'campo1', nombre: 'Campo del Norte', x: -20, z: -74, w: 56, d: 34 },
        { id: 'campo2', nombre: 'Campo del Río', x: 28, z: -62, w: 46, d: 30 },
        { id: 'campo3', nombre: 'Campo Grande', x: -22, z: 8, w: 52, d: 32 }
      ];
      for (var i = 0; i < defs.length; i++) {
        var d = defs[i];
        var p = new F.Plot({
          id: d.id, nombre: d.nombre, x: d.x, z: d.z, w: d.w, d: d.d, cell: 2,
          terrain: T, scene: this.scene
        });
        this.plots.push(p);
        // cartel del campo
        this.spots[d.id] = { x: d.x, z: d.z };
      }
    },

    construirVegetacion: function (season) {
      var T = this.terrain, lista = [], rnd = S.RNG(4242);
      function libre(x, z) {
        if (Math.abs(x + 70) < 40 && Math.abs(z + 40) < 40) return false;   // granja
        if (Math.abs(x - 70) < 44 && Math.abs(z - 52) < 42) return false;   // pueblo
        if (Math.abs(x + 20) < 34 && Math.abs(z + 74) < 24) return false;   // campos
        if (Math.abs(x - 28) < 29 && Math.abs(z + 62) < 22) return false;
        if (Math.abs(x + 22) < 32 && Math.abs(z - 8) < 22) return false;
        if (Math.abs(x - 36) < 16 && Math.abs(z - 44) < 16) return false;
        if (T.isRoad(x, z)) return false;
        return true;
      }
      for (var i = 0; i < 900; i++) {
        var x = rnd.range(-200, 200), z = rnd.range(-200, 200);
        var d = Math.hypot(x, z);
        if (d > 195) continue;
        if (!libre(x, z)) continue;
        var borde = U.clamp((d - 90) / 70, 0, 1);
        if (rnd() > 0.18 + borde * 0.75) continue;
        var alt = T.heightAt(x, z);
        if (alt < -1.2) continue;
        var tipo = alt > 14 ? 'pino' : (rnd() < 0.34 ? 'pino' : (rnd() < 0.85 ? 'roble' : 'chopo'));
        lista.push({ x: x, z: z, t: tipo, s: 0.75 + rnd() * 0.7, r: rnd() * 6.28 });
      }
      // chopos junto al río (típico de las riberas leonesas)
      for (var c = 0; c < 60; c++) {
        var rx = -190 + c * 6.4;
        var rz = T.riverZAt(rx) + (c % 2 ? 16 : -16) + rnd.range(-4, 4);
        if (Math.abs(rx) > 190) continue;
        lista.push({ x: rx, z: rz, t: 'chopo', s: 0.9 + rnd() * 0.5, r: rnd() * 6.28 });
      }
      new MD.Forest(this.scene, T, lista, season, this.q);

      // arbustos y piedras sueltas
      for (var b = 0; b < 130; b++) {
        var bx = rnd.range(-170, 170), bz = rnd.range(-170, 170);
        if (!libre(bx, bz) || T.heightAt(bx, bz) < -1) continue;
        if (rnd() < 0.6) {
          var arb = MD.bushClump(this.clock.season);
          arb.position.set(bx, T.heightAt(bx, bz), bz);
          this.scene.add(arb);
        } else {
          var pie = MD.rock(0.4 + rnd() * 0.7);
          pie.position.set(bx, T.heightAt(bx, bz), bz);
          this.scene.add(pie);
        }
      }
    },

    crearJugador: function () {
      this.playerMesh = A.human({
        skin: '#d8a97e', hair: '#33251a', shirt: '#3f6f9e', pants: '#33405a',
        hat: 'boina', hatColor: '#26262c', beard: '#33251a', boots: '#3a2a1c'
      });
      this.scene.add(this.playerMesh);
      // farol: de noche Arricio lleva luz propia para poder seguir trabajando
      this.farol = new THREE.PointLight(0xffd9a0, 0, 16, 2);
      this.farol.position.set(0, 1.7, 0);
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

      // ganado de partida
      var inicial = [['vaca', 'Pinta'], ['vaca', 'Lucera'], ['vaca', 'Morena'],
                     ['oveja', 'Copo'], ['oveja', 'Nube'], ['cordero', 'Chispa'],
                     ['gallina', 'Cuca'], ['gallina', 'Pita'], ['pollo', 'Peque'], ['burro', 'Platero']];
      for (var i = 0; i < inicial.length; i++) {
        var a = this.crearAnimal(inicial[i][0], inicial[i][1]);
        a.fed = true;
        if (a.def.prod) a.productReady = true;
      }
      this.crearNPCs();
      this.clock.tomorrow = this.clock.rollWeather();
      this.estado = 'juego';
      this.ui.hudVisible(true);
      this.ui.aviso('SORRÍOS DE ORDÁS', 'La finca de Arricio · ' + this.clock.dateString());
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
      var I = S.Input;
      this.reloj += dt;
      var jugando = this.estado === 'juego';

      // tiempo del mundo
      if (jugando || this.estado === 'dialogo' || this.estado === 'ordeno') {
        var ev = this.clock.update(dt);
        if (ev && ev.lightning) { this.sky.lightning(); S.Audio.fx('trueno'); }
        if (ev && ev.collapse) this.dormir(true);
      }

      if (jugando) {
        if (this.conduciendo) this.actualizarConduccion(dt);
        else this.actualizarJugador(dt);
        this.comprobarEntradas();
      } else {
        this.pSpeed = 0;
        A.animateHuman(this.playerMesh, dt, 0);
      }

      if (this.estado === 'ordeno') this.actualizarOrdeno(dt);

      // resto del mundo
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
      var correr = I.pulsado.correr && p.energia > 5;
      var vel = correr ? 5.2 : 2.5;
      var moviendo = mv.len > 0.08;

      if (moviendo) {
        // movimiento relativo a la cámara
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
      this.playerMesh.rotation.y = this.pHeading;
      this.playerMesh.visible = !(this.camModo === 1);
      A.animateHuman(this.playerMesh, dt, this.pSpeed, { armsBusy: this._usando > 0 });
      if (this._usando > 0) this._usando -= dt;

      // hijos siguiendo al padre
      for (var i = 0; i < this.hijos.length; i++) this.hijos[i].update(dt, this.pPos);
    },

    chocaEn: function (x, z, r) {
      for (var i = 0; i < this.colliders.length; i++) {
        var c = this.colliders[i];
        if (Math.abs(x - c.x) < c.w / 2 + r && Math.abs(z - c.z) < c.d / 2 + r) return true;
      }
      // el tractor también estorba (salvo si vamos dentro)
      if (!this.conduciendo && this.tractor) {
        var t = this.tractor.pos;
        if (Math.abs(x - t.x) < 1.6 + r && Math.abs(z - t.z) < 2.4 + r) return true;
      }
      return false;
    },

    /* --------------------------------------------------------- conducción */
    actualizarConduccion: function (dt) {
      var I = S.Input, tr = this.tractor;
      var mv = I.mover();
      var input = { throttle: -mv.y, steer: mv.x, brake: I.pulsado.correr };
      tr.occupied = true;
      tr.update(dt, input, this.clock);

      // el jugador va sentado en la cabina
      this.pPos.copy(tr.seatPosition());
      this.playerMesh.position.copy(this.pPos);
      this.playerMesh.rotation.set(tr.group.rotation.x, tr.heading, tr.group.rotation.z);
      this.playerMesh.visible = this.camModo !== 1;
      A.poseSentado(this.playerMesh, this.reloj);

      // trabajo del apero
      if (tr.attached && tr.lowered && Math.abs(tr.speed) > 0.4 && tr.engineOn) {
        this.trabajarCampo(tr, dt);
      }
      for (var i = 0; i < this.hijos.length; i++) this.hijos[i].update(dt, this.pPos);
    },

    trabajarCampo: function (tr, dt) {
      var wp = tr.workPoint();
      var plot = null;
      for (var i = 0; i < this.plots.length; i++) {
        if (!this.plots[i].huerto && this.plots[i].contains(wp.x, wp.z)) { plot = this.plots[i]; break; }
      }
      if (!plot) return;
      var tipo = tr.attachments[tr.attached].userData.tipo;
      var ancho = tr.workWidth();
      if (tipo === 'arado') {
        var n = plot.arar(wp.x, wp.z, ancho, tr.heading);
        if (n) {
          this.player.stats.hectareas += n * 0.0004;
          this._ruidoTrabajo = (this._ruidoTrabajo || 0) + dt;
          if (this._ruidoTrabajo > 0.55) { this._ruidoTrabajo = 0; S.Audio.fx('arar'); }
        }
      } else if (tipo === 'sembradora') {
        var mano = this.player.enMano();
        var def = D.ITEMS[mano];
        if (!def || def.t !== 'seed') {
          this._avisoSemilla = (this._avisoSemilla || 0) - dt;
          if (this._avisoSemilla <= 0) {
            this._avisoSemilla = 4;
            this.ui.toast('Lleva semilla en la mano para sembrar', 'malo');
          }
          return;
        }
        if (D.CROPS[def.crop].s.indexOf(this.clock.season) < 0) {
          this._avisoSemilla = (this._avisoSemilla || 0) - dt;
          if (this._avisoSemilla <= 0) {
            this._avisoSemilla = 4;
            this.ui.toast(D.CROPS[def.crop].n + ' no es de esta estación', 'malo');
          }
          return;
        }
        if (this.player.cuantos(mano) <= 0) return;
        var s = plot.sembrar(wp.x, wp.z, ancho, def.crop, tr.heading);
        if (s) {
          this.player.quitar(mano, Math.max(1, Math.round(s / 3)));
          S.Audio.fx('sembrar');
        }
      } else if (tipo === 'cosechadora') {
        var out = plot.cosechar(wp.x, wp.z, ancho, tr.heading);
        if (out) {
          var cantidad = out.cantidad * (D.CROPS[out.crop].campo ? 3 : 1);
          this.player.dar(out.crop, cantidad);
          this.player.stats.cosechado += cantidad;
          this._cosechaAcc = (this._cosechaAcc || 0) + cantidad;
          if (this._cosechaAcc > 12) {
            this.ui.toast('+' + Math.round(this._cosechaAcc) + ' ' + D.ITEMS[out.crop].n, 'oro');
            this._cosechaAcc = 0;
            S.Audio.fx('coger');
          }
        }
      }
    },

    /* ---------------------------------------------------------- animales */
    actualizarAnimales: function (dt) {
      var t = this.reloj;
      for (var i = 0; i < this.animales.length; i++) {
        var a = this.animales[i];
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
      if (this.conduciendo && this.tractor.engineOn) {
        S.Audio.motor(true, U.clamp(Math.abs(this.tractor.speed) / 8.4, 0.12, 1), this.tractor.lowered ? 1 : 0);
      } else S.Audio.motor(false, 0, 0);
      // pájaros de día
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

      var objetivo, dist = this.camDist, alturaOjo = 1.62;
      if (this.conduciendo) {
        objetivo = this.tractor.pos.clone().add(V3(0, 2.1, 0));
        dist = this.camModo === 1 ? 0 : Math.max(6.5, this.camDist);
      } else {
        objetivo = this.pPos.clone().add(V3(0, alturaOjo, 0));
        if (this.camModo === 1) dist = 0;
      }

      if (dist < 0.4) {
        // primera persona
        var mira = this.conduciendo ? this.tractor.seatPosition().add(V3(0, 0.35, 0)) : objetivo;
        this.camera.position.copy(mira);
        var dir = V3(-Math.sin(this.camYaw) * Math.cos(this.camPitch), -Math.sin(this.camPitch), -Math.cos(this.camYaw) * Math.cos(this.camPitch));
        this.camera.lookAt(mira.clone().add(dir));
      } else {
        var off = V3(
          Math.sin(this.camYaw) * Math.cos(this.camPitch),
          Math.sin(this.camPitch) + 0.28,
          Math.cos(this.camYaw) * Math.cos(this.camPitch)
        ).multiplyScalar(dist);
        // Colisión de cámara: acortamos la distancia si hay un edificio o el
        // terreno de por medio, para no acabar viendo el interior de un tejado.
        var libre = dist;
        for (var paso = 1; paso <= 10; paso++) {
          var t = paso / 10;
          var px2 = objetivo.x + off.x * t, pz2 = objetivo.z + off.z * t;
          var py2 = objetivo.y + off.y * t;
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
      // animales
      for (var i = 0; i < this.animales.length; i++) {
        var a = this.animales[i];
        var d = Math.hypot(a.pos.x - px, a.pos.z - pz);
        if (d < 2.6 && d < md) { md = d; mejor = { tipo: 'animal', animal: a, d: d }; }
      }
      // vecinos
      for (var n = 0; n < this.npcs.length; n++) {
        var v = this.npcs[n];
        var dn = Math.hypot(v.pos.x - px, v.pos.z - pz);
        if (dn < 2.6 && dn < md) { md = dn; mejor = { tipo: 'npc', npc: v, d: dn }; }
      }
      // hijos
      for (var h = 0; h < this.hijos.length; h++) {
        var c = this.hijos[h];
        if (c.etapa === 0) continue;
        var dh = Math.hypot(c.pos.x - px, c.pos.z - pz);
        if (dh < 2.4 && dh < md) { md = dh; mejor = { tipo: 'hijo', hijo: c, d: dh }; }
      }
      // puntos fijos
      for (var p = 0; p < this.interactivos.length; p++) {
        var it = this.interactivos[p];
        var di = Math.hypot(it.x - px, it.z - pz);
        if (di < it.r && di < md) { md = di; mejor = { tipo: it.tipo, punto: it, d: di }; }
      }
      // tractor
      if (this.tractor) {
        var dt2 = Math.hypot(this.tractor.pos.x - px, this.tractor.pos.z - pz);
        if (dt2 < 3.4 && dt2 < md + 1) { md = dt2; mejor = { tipo: 'tractor', d: dt2 }; }
      }
      return mejor;
    },

    comprobarEntradas: function () {
      var I = S.Input, self = this;

      if (I.tomar('menu')) { this.ui.abrirMenu(); return; }
      if (I.tomar('siguiente')) { this.player.slot = (this.player.slot + 1) % this.player.cinturon.length; S.Audio.fx('menu'); }
      if (I.tomar('anterior')) { this.player.slot = (this.player.slot + this.player.cinturon.length - 1) % this.player.cinturon.length; S.Audio.fx('menu'); }
      for (var k = 1; k <= 9; k++) if (I.tomar('r' + k) && this.player.cinturon[k - 1]) this.player.slot = k - 1;

      // tractor: subir/bajar, motor, apero
      if (I.tomar('montar')) this.montarDesmontar();
      if (this.conduciendo) {
        if (I.tomar('motor')) {
          this.tractor.engineOn = !this.tractor.engineOn;
          if (this.tractor.engineOn) { S.Audio.fx('arranque'); this.ui.toast('Motor en marcha', 'info'); }
          else this.ui.toast('Motor parado', 'info');
        }
        if (I.tomar('bajar_apero')) {
          var b = this.tractor.toggleLower();
          this.ui.toast(this.tractor.attached ? (b ? 'Apero bajado: trabajando' : 'Apero levantado') : 'No llevas apero', b == null ? 'malo' : 'info');
        }
        if (I.tomar('cambiar_apero')) this.cambiarApero();
          if (I.tomar('accion')) this.tractor.engineOn = !this.tractor.engineOn;
        this.ui.prompt(null);
        return;
      }

      var obj = this.objetivoCercano();
      this.mostrarPrompt(obj);
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
          if (a.productReady && a.def.tool === 'cubo') txt = mano === 'cubo' ? 'Ordeñar a ' + a.nombre + ' <b>(F)</b>' : 'Coge el cubo para ordeñar a ' + a.nombre;
          else if (a.productReady && a.kind === 'gallina') txt = 'Recoger el huevo de ' + a.nombre;
          else if (a.extraReady) txt = mano === 'tijeras' ? 'Esquilar a ' + a.nombre + ' <b>(F)</b>' : 'Coge las tijeras para esquilar';
          else txt = 'Acariciar a ' + a.nombre;
          break;
        case 'npc':
          txt = 'Hablar con <b>' + obj.npc.nombre + '</b>';
          if (def && def.t !== 'tool' && def.t !== 'seed') txt += '  ·  <b>F</b> regalar ' + def.n.toLowerCase();
          break;
        case 'hijo': txt = 'Hablar con ' + obj.hijo.nombre; break;
        case 'casa': txt = 'Entrar en casa (dormir y cocinar)'; break;
        case 'cuadra': txt = 'Cuadra: dar de comer al ganado'; break;
        case 'gallinero': txt = 'Gallinero: recoger huevos'; break;
        case 'pozo': txt = 'Llenar la regadera'; break;
        case 'comedero': txt = 'Echar de comer'; break;
        case 'tienda': txt = 'Entrar en ' + D.SHOPS[obj.punto.datos.shop].n; break;
        case 'cooperativa': txt = 'Cooperativa: vender la cosecha'; break;
        case 'iglesia': txt = 'Iglesia de San Roque'; break;
        case 'tractor': txt = 'Subir al tractor <b>(T)</b>'; break;
      }
      this.ui.prompt(txt, obj.tipo === 'tractor' ? 'T' : 'E');
    },

    interactuar: function (obj) {
      var p = this.player;
      switch (obj.tipo) {
        case 'animal': return this.tocarAnimal(obj.animal);
        case 'npc': return this.hablar(obj.npc);
        case 'hijo': return this.ui.dialogo(obj.hijo.nombre, U.pick(obj.hijo.frases()));
        case 'casa': return this.menuCasa();
        case 'cuadra': case 'comedero': return this.darDeComer();
        case 'gallinero': return this.recogerHuevos();
        case 'pozo':
          p.agua = p.aguaMax; S.Audio.fx('agua');
          return this.ui.toast('Regadera llena', 'info');
        case 'tienda': return this.ui.abrirTienda(obj.punto.datos.shop);
        case 'cooperativa': return this.venderCooperativa();
        case 'iglesia': return this.ui.dialogo('Iglesia de San Roque',
          p.esposa ? 'Aquí os casasteis. Don Casimiro aún lo recuerda.'
                   : 'Don Casimiro casa a quien traiga anillo y novia.');
        case 'tractor': return this.montarDesmontar();
      }
    },

    /* ----------------------------------------------------- herramientas -- */
    usarHerramienta: function (obj) {
      var p = this.player, mano = p.enMano(), def = D.ITEMS[mano];
      this._usando = 0.45;
      if (!def) return;

      // regalar a un vecino
      if (obj && obj.tipo === 'npc' && def.t !== 'tool' && def.t !== 'seed') {
        if (mano === 'ramo' || mano === 'anillo') return this.pedir(obj.npc, mano);
        return this.regalar(obj.npc, mano);
      }
      // ordeñar / esquilar
      if (obj && obj.tipo === 'animal') {
        if (mano === 'cubo') return this.empezarOrdeno(obj.animal);
        if (mano === 'tijeras') return this.esquilar(obj.animal);
      }
      // labores del huerto (a mano)
      var h = this.huerto;
      var frente = this.puntoFrente(1.1);
      if (h.contains(frente.x, frente.z)) {
        if (mano === 'azada') return this.ararMano(h, frente);
        if (mano === 'regadera') return this.regarMano(h, frente);
        if (def.t === 'seed') return this.sembrarMano(h, frente, mano);
      }
      if (mano === 'hoz') { S.Audio.fx('arar'); if (U.chance(0.35)) { p.dar('heno', 1); this.ui.toast('+1 heno', 'oro'); } return; }
      if (mano === 'regadera' && !h.contains(frente.x, frente.z)) {
        // rellenar en el río
        if (Math.abs(frente.z - this.terrain.riverZAt(frente.x)) < 14) {
          p.agua = p.aguaMax; S.Audio.fx('agua');
          return this.ui.toast('Regadera llena en el río', 'info');
        }
      }
    },

    puntoFrente: function (d) {
      return {
        x: this.pPos.x - Math.sin(this.pHeading) * d,
        z: this.pPos.z - Math.cos(this.pHeading) * d
      };
    },

    ararMano: function (plot, f) {
      var p = this.player;
      if (p.energia < 2) return this.ui.toast('Estás agotado', 'malo');
      var n = plot.arar(f.x, f.z, this.huerto.cell, this.pHeading);
      if (n) { p.cansar(1.4); S.Audio.fx('azada'); }
      else this.ui.toast('Aquí ya está labrado o hay algo sembrado', 'info');
    },
    sembrarMano: function (plot, f, semilla) {
      var p = this.player, def = D.ITEMS[semilla];
      if (p.cuantos(semilla) <= 0) return this.ui.toast('No te quedan semillas', 'malo');
      if (D.CROPS[def.crop].s.indexOf(this.clock.season) < 0)
        return this.ui.toast(D.CROPS[def.crop].n + ' no es de ' + S.SEASONS[this.clock.season].toLowerCase(), 'malo');
      var n = plot.sembrar(f.x, f.z, this.huerto.cell, def.crop, this.pHeading);
      if (n) { p.quitar(semilla, 1); p.cansar(0.6); S.Audio.fx('sembrar'); }
      else this.ui.toast('Primero hay que labrar con la azada', 'info');
    },
    regarMano: function (plot, f) {
      var p = this.player;
      if (p.agua <= 0) return this.ui.toast('La regadera está vacía: ve al pozo', 'malo');
      var n = plot.regar(f.x, f.z, 1.4, this.pHeading);
      if (n) { p.agua--; p.cansar(0.5); S.Audio.fx('agua'); }
      else this.ui.toast('Aquí no hay nada que regar', 'info');
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
      if (a.productReady && a.def.tool === 'cubo') return this.empezarOrdeno(a);
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
      var pienso = ['heno', 'pienso', 'grano', 'alfalfa'].filter(function (f) { return p.cuantos(f) > 0; })[0];
      if (!pienso) return this.ui.toast('No llevas pienso ni heno', 'malo');
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
      if (this.comedero && this.comedero.userData.feedMesh) this.comedero.userData.feedMesh.visible = true;
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
      if (!a.def.prod || a.def.tool !== 'cubo') return this.ui.toast(a.nombre + ' no se ordeña', 'info');
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
          this.ui.toast('+' + got + ' ' + D.ITEMS[m.producto].n, 'oro');
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
      var pts = 12, resp = 'Vaya, gracias, Arricio.';
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
        if (p.pareja || p.esposa) return this.ui.dialogo(n.nombre, 'Arricio, tú ya tienes a alguien. No está bien.', n);
        if (n.corazones < 8) return this.ui.dialogo(n.nombre, 'Es precioso… pero aún nos conocemos poco. (Hacen falta 8 ♥)', n);
        p.quitar('ramo', 1);
        n.novia = true; p.pareja = n.id;
        n.sumarPuntos(120);
        S.Audio.fx('logro');
        this.ui.aviso('¡' + n.nombre + ' acepta!', 'Ya sois novios');
        return this.ui.dialogo(n.nombre, 'Sí quiero salir contigo, Arricio. Todo el pueblo va a hablar de esto.', n);
      }
      if (p.esposa) return this.ui.dialogo(n.nombre, 'Pero si ya estás casado, hombre.', n);
      if (p.pareja !== n.id) return this.ui.dialogo(n.nombre, 'Primero habría que ser novios, ¿no te parece?', n);
      if (n.corazones < 10) return this.ui.dialogo(n.nombre, 'Casarnos es mucha palabra todavía… (Hacen falta 10 ♥)', n);
      p.quitar('anillo', 1);
      n.casado = true; p.esposa = n.id;
      this.flags.boda = this.clock.dayCount;
      S.Audio.fx('campana');
      this.ui.aviso('¡BODA EN SORRÍOS!', 'Don Casimiro os casa en San Roque');
      this.ui.dialogo(n.nombre, 'Sí quiero. Me vengo contigo a la finca, Arricio.', n);
    },

    /* ---------------------------------------------------------- tiendas */
    comprar: function (id, q) {
      var p = this.player, def = D.ITEMS[id];
      var total = def.buy * q;
      if (p.dinero < total) { S.Audio.fx('no'); return this.ui.toast('No te llega el dinero', 'malo'); }
      if (def.t === 'tool') {
        if (p.cinturon.indexOf(id) >= 0) return this.ui.toast('Ya tienes esa herramienta', 'info');
        p.gastar(total); p.cinturon.push(id);
        this.ui.hotbarCache = '';
        S.Audio.fx('moneda');
        return this.ui.toast('Compras: ' + def.n, 'oro');
      }
      if (id === 'gasoil') {
        p.gastar(total);
        this.tractor.fuel = 100;
        S.Audio.fx('moneda');
        return this.ui.toast('Depósito del tractor lleno', 'oro');
      }
      if (!p.dar(id, q)) return this.ui.toast('La mochila está llena', 'malo');
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
    venderCooperativa: function () {
      var p = this.player, total = 0, lineas = [];
      for (var i = p.inv.length - 1; i >= 0; i--) {
        var it = p.inv[i], def = D.ITEMS[it.id];
        if (def.t !== 'crop' && def.t !== 'prod') continue;
        total += def.sell * it.q;
        lineas.push(it.q + ' × ' + def.n);
        p.quitar(it.id, it.q);
      }
      if (!total) return this.ui.toast('No traes cosecha que vender', 'info');
      p.dinero += total;
      S.Audio.fx('moneda');
      this.ui.dialogo('Cooperativa de Ordás',
        'Te compramos: ' + lineas.join(', ') + '. Son ' + U.fmtMoney(total) + '.');
    },

    /* ------------------------------------------------------------- casa */
    menuCasa: function () {
      var h = this.clock.hourF();
      var self = this;
      if (h >= 18 || h < 6) return this.dormir(false);
      // de día: cocinar
      var puede = D.RECETAS.filter(function (r) {
        return r.need.every(function (n) { return self.player.cuantos(n[0]) >= n[1]; });
      });
      if (!puede.length) return this.ui.dialogo('Casa de Arricio',
        'La lumbre está encendida, pero no tienes con qué cocinar. Vuelve por la tarde para dormir.');
      var r = puede[0];
      r.need.forEach(function (n) { self.player.quitar(n[0], n[1]); });
      this.player.dar(r.out[0], r.out[1]);
      S.Audio.fx('logro');
      this.ui.dialogo('Cocina', 'Has cocinado ' + D.ITEMS[r.out[0]].n + '.');
    },

    dormir: function (desmayo) {
      var self = this;
      this.estado = 'parte';
      this.ui.prompt(null);
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

      // campos y huerto
      var llueve = c.isRaining();
      var listos = 0;
      for (var i = 0; i < this.plots.length; i++) listos += this.plots[i].nuevoDia(llueve, c.season);
      if (listos) rep.eventos.push(listos + ' parcelas han llegado a punto de cosecha.');
      if (llueve) rep.eventos.push('Llueve: hoy no hace falta regar.');
      if (c.weather === 'nieve') rep.eventos.push('Ha nevado en Ordás. Mejor el ganado a cubierto.');
      if (c.weather === 'tormenta') rep.eventos.push('Tormenta: el huerto se riega solo… y truena.');
      if (estacionAntes !== c.season) rep.eventos.push('Cambia la estación: entra ' + S.SEASONS[c.season] + '.');

      // ganado
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

      // vecinos
      for (var n = 0; n < this.npcs.length; n++) {
        this.npcs[n].regaladoHoy = false;
        this.npcs[n].habladoHoy = false;
      }
      // hijos
      for (var h = 0; h < this.hijos.length; h++) {
        var kid = this.hijos[h];
        var et = kid.nuevoDia();
        if (et === 1) rep.eventos.push('¡' + kid.nombre + ' ya corre por la finca!');
        if (et === 2) rep.eventos.push('¡' + kid.nombre + ' se ha hecho moz' + (kid.nina ? 'a' : 'o') + ' y ayuda en todo!');
        if (kid.etapa >= 1) this.ayudaHijo(kid, rep);
      }
      // la pareja
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
      // el tractor amanece donde se dejó
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

    /* --------------------------------------------------------- tractor -- */
    montarDesmontar: function () {
      if (this.conduciendo) {
        this.conduciendo = false;
        this.tractor.occupied = false;
        this.playerMesh.rotation.set(0, this.pHeading, 0);
        var salida = this.tractor.exitPosition();
        this.pPos.set(salida.x, this.terrain.heightAt(salida.x, salida.z), salida.z);
        this.ui.toast('Bajas del tractor', 'info');
        return;
      }
      var d = Math.hypot(this.tractor.pos.x - this.pPos.x, this.tractor.pos.z - this.pPos.z);
      if (d > 4) return this.ui.toast('Acércate al tractor', 'info');
      this.conduciendo = true;
      this.tractor.occupied = true;
      if (!this.tractor.engineOn && this.tractor.fuel > 0) {
        this.tractor.engineOn = true;
        S.Audio.fx('arranque');
      }
      this.ui.toast('Al volante · P motor · H apero · C cambiar apero · T bajar', 'info');
    },

    cambiarApero: function () {
      var orden = ['arado', 'sembradora', 'cosechadora', 'remolque', null];
      var i = orden.indexOf(this.tractor.attached);
      var next = orden[(i + 1) % orden.length];
      this.tractor.attach(next);
      this.tractor.lowered = false;
      this.ui.toast('Apero: ' + (next ? this.tractor.attachments[next].userData.nombre : 'ninguno'), 'info');
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
      var sembradas = 0, listas = 0, aradas = 0;
      this.plots.forEach(function (pl) {
        for (var i = 0; i < pl.n; i++) {
          if (pl.state[i] === F.ARADO) aradas++;
          else if (pl.state[i] === F.SEMBRADO) sembradas++;
          else if (pl.state[i] === F.LISTO) listas++;
        }
      });
      var out = [
        ['Ganado', ganado],
        ['Campos labrados', aradas + ' parcelas'],
        ['Sembrado', sembradas + ' parcelas'],
        ['Listo para cosechar', listas + ' parcelas'],
        ['Días en el pueblo', this.clock.dayCount],
        ['Ordeños', p.stats.ordenos],
        ['Huevos recogidos', p.stats.huevos],
        ['Cosechado', Math.round(p.stats.cosechado) + ' unidades'],
        ['Dinero', U.fmtMoney(p.dinero)]
      ];
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
        v: 1,
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
        tractor: { x: this.tractor.pos.x, z: this.tractor.pos.z, h: this.tractor.heading,
                   fuel: this.tractor.fuel, apero: this.tractor.attached },
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

        if (d.tractor) {
          this.tractor.setPosition(d.tractor.x, d.tractor.z, d.tractor.h);
          this.tractor.fuel = d.tractor.fuel;
          this.tractor.attach(d.tractor.apero);
        }
        this.flags = d.flags || {};
        this.estado = 'juego';
        this.ui.hudVisible(true);
        this.ui.toast('¡Bienvenido de vuelta, Arricio!', 'oro');
        return true;
      } catch (e) {
        console.error('Error al cargar:', e);
        return false;
      }
    },

    render: function () { this.renderer.render(this.scene, this.camera); }
  };

})(window);
