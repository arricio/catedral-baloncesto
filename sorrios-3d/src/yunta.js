/* ============================================================================
   SORRÍOS DE ORDÁS 3D — yunta.js
   Tracción animal: se uncen dos vacas (o el burro Carolo) al yugo y se les
   engancha el arado de madera, la grada o el carro del país. Nazario va detrás
   agarrando la mancera, con la aguijada en la mano. Aquí no hay motores.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, MD = S.Models, A = S.Actors;

  var APEROS = ['arado', 'grada', 'carro'];

  function Yunta(scene, terrain, game) {
    this.scene = scene;
    this.terrain = terrain;
    this.game = game;

    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.speed = 0;
    this.uncida = false;
    this.tipo = null;             // 'vacas' | 'burro'
    this.animales = [];           // objetos Animal del rebaño
    this.apero = 'arado';
    this.clavado = false;         // el arado metido en la tierra
    this.fatiga = 0;              // 0..1, las bestias se cansan
    this.cargaCarro = 0;          // hierba cargada en el carro

    // El grupo que lleva el yugo y el apero; los animales van sueltos
    this.grupo = new THREE.Group();
    scene.add(this.grupo);

    this.yugo = MD.yugo(1.9);
    this.yugo.visible = false;
    scene.add(this.yugo);

    this.aperos = {
      arado: MD.arado(),
      grada: MD.grada(),
      carro: MD.carro()
    };
    for (var k in this.aperos) {
      this.aperos[k].visible = false;
      scene.add(this.aperos[k]);
    }
    // Cuando no se usan, los aperos descansan junto a la tenada
    this.sitioAperos = { x: -54, z: -26 };
    this.guardarAperos();
  }

  Yunta.prototype.guardarAperos = function () {
    var t = this.terrain, s = this.sitioAperos, i = 0;
    for (var k in this.aperos) {
      var a = this.aperos[k];
      a.visible = true;
      var x = s.x + (i - 1) * 3.2, z = s.z;
      a.position.set(x, t.heightAt(x, z), z);
      a.rotation.set(0, 0.4 + i * 0.5, 0);
      i++;
    }
    this.yugo.visible = true;
    this.yugo.position.set(s.x + 4.4, t.heightAt(s.x + 4.4, s.z) + 0.5, s.z);
    this.yugo.rotation.set(0, 0.2, 0.15);
  };

  // ¿Qué animales pueden tirar? Dos vacas hacen yunta; el burro va solo.
  Yunta.prototype.candidatos = function (animales, cerca) {
    var vacas = [], burro = null;
    for (var i = 0; i < animales.length; i++) {
      var a = animales[i];
      if (!a.def.tira) continue;
      if (cerca && Math.hypot(a.pos.x - cerca.x, a.pos.z - cerca.z) > 9) continue;
      if (a.kind === 'vaca') vacas.push(a);
      else if (a.kind === 'burro') burro = burro || a;
    }
    return { vacas: vacas, burro: burro };
  };

  Yunta.prototype.uncir = function (animales, cerca, prefiere) {
    var c = this.candidatos(animales, cerca);
    var elegidos = null, tipo = null;
    if (prefiere === 'burro' && c.burro) { elegidos = [c.burro]; tipo = 'burro'; }
    else if (c.vacas.length >= 2) { elegidos = [c.vacas[0], c.vacas[1]]; tipo = 'vacas'; }
    else if (c.burro) { elegidos = [c.burro]; tipo = 'burro'; }
    else return null;

    this.animales = elegidos;
    this.tipo = tipo;
    this.uncida = true;
    this.clavado = false;
    this.fatiga = 0;
    for (var i = 0; i < elegidos.length; i++) elegidos[i].enYunta = true;

    // La yunta se coloca donde estén las bestias
    this.pos.set(elegidos[0].pos.x, 0, elegidos[0].pos.z);
    this.heading = elegidos[0].heading;
    this.colocar(0);
    return tipo;
  };

  Yunta.prototype.desuncir = function () {
    for (var i = 0; i < this.animales.length; i++) {
      var a = this.animales[i];
      a.enYunta = false;
      a.state = 'quieto';
      a.stateT = U.rnd(1, 3);
    }
    this.animales = [];
    this.uncida = false;
    this.clavado = false;
    this.speed = 0;
    this.guardarAperos();
  };

  Yunta.prototype.cambiarApero = function () {
    var i = APEROS.indexOf(this.apero);
    this.apero = APEROS[(i + 1) % APEROS.length];
    this.clavado = false;
    return this.apero;
  };

  Yunta.prototype.aperoActual = function () { return this.aperos[this.apero]; };
  Yunta.prototype.nombreApero = function () { return this.aperos[this.apero].userData.nombre; };
  Yunta.prototype.ancho = function () { return this.aperos[this.apero].userData.ancho || 1; };

  // Punto donde muerde la reja del arado (o pasa la grada)
  Yunta.prototype.puntoTrabajo = function () {
    var d = this.apero === 'grada' ? 0.5 : 0.9;
    return new THREE.Vector3(
      this.pos.x + Math.sin(this.heading) * d,
      this.pos.y,
      this.pos.z + Math.cos(this.heading) * d
    );
  };

  // Dónde va Nazario: detrás, agarrando la mancera
  Yunta.prototype.puestoDelGanadero = function () {
    var atras = this.apero === 'carro' ? 1.0 : 1.35;
    return new THREE.Vector3(
      this.pos.x + Math.sin(this.heading) * atras,
      this.terrain.heightAt(this.pos.x + Math.sin(this.heading) * atras, this.pos.z + Math.cos(this.heading) * atras),
      this.pos.z + Math.cos(this.heading) * atras
    );
  };

  Yunta.prototype.sitioSalida = function () {
    var lado = new THREE.Vector3(-2.4, 0, 1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    var p = this.pos.clone().add(lado);
    p.y = this.terrain.heightAt(p.x, p.z);
    return p;
  };

  // Coloca bestias, yugo y apero según el rumbo actual
  Yunta.prototype.colocar = function (dt) {
    var t = this.terrain;
    var fx = -Math.sin(this.heading), fz = -Math.cos(this.heading);   // adelante
    var px = -Math.cos(this.heading), pz = Math.sin(this.heading);    // costado

    this.pos.y = t.heightAt(this.pos.x, this.pos.z);

    // --- los animales, delante del apero ---
    var sep = this.tipo === 'vacas' ? 0.62 : 0;
    var delante = this.tipo === 'vacas' ? 2.65 : 2.35;
    for (var i = 0; i < this.animales.length; i++) {
      var a = this.animales[i];
      var lado = (this.animales.length === 1) ? 0 : (i === 0 ? -sep : sep);
      var ax = this.pos.x + fx * delante + px * lado;
      var az = this.pos.z + fz * delante + pz * lado;
      a.pos.set(ax, t.heightAt(ax, az), az);
      // las bestias miran hacia donde tiran, no hacia el arado
      a.heading = this.heading + Math.PI;
      a.mesh.position.copy(a.pos);
      a.mesh.rotation.y = a.heading;
      A.animateAnimal(a.mesh, dt || 0.016, Math.abs(this.speed), this.game ? this.game.reloj : 0);
    }

    // --- el yugo, sobre la testuz ---
    var altura = this.tipo === 'vacas' ? 1.46 : 1.16;
    var zYugo = delante + (this.tipo === 'vacas' ? 0.72 : 0.66);
    this.yugo.visible = this.uncida;
    this.yugo.position.set(this.pos.x + fx * zYugo, t.heightAt(this.pos.x + fx * zYugo, this.pos.z + fz * zYugo) + altura, this.pos.z + fz * zYugo);
    this.yugo.rotation.set(0, this.heading, 0);
    this.yugo.scale.setScalar(this.tipo === 'vacas' ? 1 : 0.62);

    // --- el apero, detrás ---
    for (var k in this.aperos) this.aperos[k].visible = (k === this.apero && this.uncida);
    var ap = this.aperos[this.apero];
    ap.position.set(this.pos.x, this.pos.y, this.pos.z);
    ap.rotation.set(0, this.heading, 0);
    // inclinación del terreno
    var n = t.normalAt(this.pos.x, this.pos.z);
    var fwd = new THREE.Vector3(fx, 0, fz);
    var der = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    var cabeceo = Math.asin(U.clamp(-n.dot(fwd), -0.5, 0.5));
    var balanceo = Math.asin(U.clamp(-n.dot(der), -0.5, 0.5));
    ap.rotation.x = cabeceo + (this.apero !== 'carro' && !this.clavado ? -0.16 : 0);
    ap.rotation.z = -balanceo;
    if (this.apero !== 'carro') ap.position.y += this.clavado ? 0 : 0.30;

    // ruedas del carro
    if (this.apero === 'carro' && ap.userData.ruedas) {
      this._giroRueda = (this._giroRueda || 0) + this.speed * (dt || 0) / 0.72;
      ap.userData.ruedas[0].rotation.x = -this._giroRueda;
      ap.userData.ruedas[1].rotation.x = -this._giroRueda;
      if (ap.userData.carga) ap.userData.carga.visible = this.cargaCarro > 0;
    }
  };

  Yunta.prototype.update = function (dt, input, llevandoRiendas) {
    if (!this.uncida) return false;
    var maxVel = this.tipo === 'vacas' ? 1.25 : 1.45;
    if (this.clavado && this.apero !== 'carro') maxVel *= 0.62;
    if (this.apero === 'carro' && this.cargaCarro > 0) maxVel *= 0.85;
    maxVel *= (1 - this.fatiga * 0.45);

    if (llevandoRiendas && input) {
      var acel = 1.5;
      if (input.avance > 0.05) this.speed += acel * dt * (1 - this.speed / maxVel);
      else if (input.avance < -0.05) this.speed -= acel * 0.5 * dt;
      else this.speed *= Math.exp(-2.2 * dt);
      this.speed = U.clamp(this.speed, -0.5, maxVel);
      // las bestias giran despacio
      var giro = input.giro * U.clamp(Math.abs(this.speed) / 0.7, 0, 1) * 0.85 * U.sign(this.speed || 1);
      this.heading -= giro * dt;
      // cansancio
      var esfuerzo = (this.clavado ? 0.0055 : 0.0022) * (Math.abs(this.speed) / Math.max(0.2, maxVel));
      this.fatiga = U.clamp(this.fatiga + esfuerzo * dt - (Math.abs(this.speed) < 0.05 ? 0.03 * dt : 0), 0, 1);
    } else {
      this.speed *= Math.exp(-3 * dt);
      this.fatiga = Math.max(0, this.fatiga - 0.025 * dt);
    }

    if (Math.abs(this.speed) > 0.001) {
      this.pos.x -= Math.sin(this.heading) * this.speed * dt;
      this.pos.z -= Math.cos(this.heading) * this.speed * dt;
      var lim = S.MAP_SIZE / 2 - 12;
      this.pos.x = U.clamp(this.pos.x, -lim, lim);
      this.pos.z = U.clamp(this.pos.z, -lim, lim);
    }
    this.colocar(dt);

    // mugidos y resoplidos al trabajar
    this._sonT = (this._sonT || U.rnd(6, 14)) - dt;
    if (this._sonT <= 0) {
      this._sonT = U.rnd(10, 26);
      if (Math.abs(this.speed) > 0.2) S.Audio.fx(this.tipo === 'vacas' ? 'muu' : 'iaa');
    }
    return Math.abs(this.speed) > 0.05;
  };

  Yunta.prototype.kmh = function () { return Math.abs(this.speed) * 3.6; };

  Yunta.prototype.cargar = function (n) {
    if (this.apero !== 'carro') return 0;
    var hueco = 40 - this.cargaCarro;
    var puesto = Math.min(hueco, n);
    this.cargaCarro += puesto;
    return puesto;
  };
  Yunta.prototype.descargar = function () {
    var n = this.cargaCarro;
    this.cargaCarro = 0;
    return n;
  };

  Yunta.prototype.save = function () {
    return {
      x: this.pos.x, z: this.pos.z, h: this.heading, apero: this.apero,
      carga: this.cargaCarro
    };
  };
  Yunta.prototype.load = function (d) {
    if (!d) return;
    this.pos.set(d.x || 0, 0, d.z || 0);
    this.heading = d.h || 0;
    this.apero = d.apero || 'arado';
    this.cargaCarro = d.carga || 0;
    this.guardarAperos();
  };

  S.Yunta = Yunta;
  S.APEROS = APEROS;

})(window);
