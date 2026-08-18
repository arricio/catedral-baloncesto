/* ============================================================================
   SORRÍOS DE ORDÁS 3D — npcs.js
   Vecinos del pueblo con rutina diaria, amistad, noviazgo, boda e hijos que
   crecen y acaban ayudando en la granja.
   ========================================================================== */
(function (global) {
  'use strict';
  var S = global.SORRIOS3D, U = S.U, D = S.DATA, A = S.Actors;

  function NPC(def, scene, terrain, spots) {
    this.def = def;
    this.id = def.id;
    this.nombre = def.n;
    this.terrain = terrain;
    this.spots = spots;
    this.mesh = A.human(def.look);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.target = null;
    this.idleT = 0;
    this.corazones = 0;
    this.puntos = 0;
    this.regaladoHoy = false;
    this.habladoHoy = false;
    this.casado = false;
    this.novia = false;
    this.rutina = NPC.rutinaDe(def.id);
    this.destino = null;
  }

  // Rutina por horas: a dónde va cada vecino a lo largo del día
  NPC.rutinaDe = function (id) {
    switch (id) {
      case 'noemi':      return [[6, 'tienda_comida'], [20, 'plaza'], [22, 'taberna'], [23.5, 'tienda_comida']];
      case 'jeremias':   return [[6, 'tienda_aperos'], [19, 'taberna'], [23, 'tienda_aperos']];
      case 'marinieves': return [[7, 'granja'], [11, 'prado'], [15, 'plaza'], [20, 'taberna'], [22.5, 'casa_marinieves']];
      case 'julita':     return [[8, 'escuela'], [16, 'plaza'], [18, 'rio'], [21, 'casa_julita']];
      case 'nieves':     return [[7, 'molino'], [13, 'plaza'], [16, 'molino'], [20, 'taberna'], [23, 'casa_nieves']];
      case 'arricio':    return [[5, 'taberna']];
      case 'alfonso':    return [[6, 'prado'], [14, 'rio'], [19, 'taberna'], [23, 'casa_alfonso']];
      case 'josep':      return [[7, 'huerta'], [12, 'concejo'], [16, 'plaza'], [20, 'taberna'], [23, 'casa_josep']];
      case 'tornillos':  return [[8, 'fragua'], [18, 'taberna'], [23, 'fragua']];
      case 'mario':      return [[8, 'plaza'], [11, 'puente'], [14, 'concejo'], [19, 'taberna'], [23, 'casa_mario']];
      default:           return [[8, 'plaza'], [21, 'plaza']];
    }
  };

  NPC.prototype.destinoAhora = function (clock, jugador) {
    // Si es tu pareja, vive en la granja
    if (this.casado) {
      var h = clock.hourF();
      return (h >= 10 && h < 18) ? 'huerta' : 'casa_nazario';
    }
    var hf = clock.hourF();
    var cur = this.rutina[0];
    for (var i = 0; i < this.rutina.length; i++) if (hf >= this.rutina[i][0]) cur = this.rutina[i];
    return cur[1];
  };

  NPC.prototype.colocar = function (spotName) {
    var s = this.spots[spotName] || this.spots.plaza;
    if (!s) return;
    this.pos.set(s.x + U.rnd(-2, 2), 0, s.z + U.rnd(-2, 2));
    this.pos.y = this.terrain.heightAt(this.pos.x, this.pos.z);
    this.mesh.position.copy(this.pos);
    this.destino = spotName;
  };

  NPC.prototype.update = function (dt, clock, t) {
    var dest = this.destinoAhora(clock);
    if (dest !== this.destino) {
      var s = this.spots[dest];
      if (s) {
        // Si el sitio está lejos, aparece allí (no simulamos viajes largos)
        var d = Math.hypot(s.x - this.pos.x, s.z - this.pos.z);
        if (d > 60) this.colocar(dest);
        else { this.destino = dest; this.target = { x: s.x + U.rnd(-3, 3), z: s.z + U.rnd(-3, 3) }; }
      }
      this.destino = dest;
    }
    // deambular alrededor del destino
    this.idleT -= dt;
    if (!this.target && this.idleT <= 0) {
      var sp = this.spots[this.destino];
      if (sp && U.chance(0.6)) this.target = { x: sp.x + U.rnd(-5, 5), z: sp.z + U.rnd(-5, 5) };
      this.idleT = U.rnd(3, 8);
    }
    if (this.target) {
      var dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z;
      var dist = Math.hypot(dx, dz);
      if (dist < 0.4) { this.target = null; this.speed = 0; }
      else {
        var v = Math.min(1.5, 0.6 + dist * 0.2);
        this.speed = v;
        this.pos.x += dx / dist * v * dt;
        this.pos.z += dz / dist * v * dt;
        var want = Math.atan2(dx, dz);
        this.heading += U.angleDelta(this.heading, want) * Math.min(1, dt * 5);
      }
    } else this.speed = 0;
    this.pos.y = this.terrain.heightAt(this.pos.x, this.pos.z);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    A.animateHuman(this.mesh, dt, this.speed);
  };

  NPC.prototype.sumarPuntos = function (n) {
    this.puntos = U.clamp(this.puntos + n, 0, 1000);
    var c = Math.min(10, Math.floor(this.puntos / 100));
    var subio = c > this.corazones;
    this.corazones = c;
    return subio;
  };

  NPC.prototype.frase = function (clock) {
    var f = this.def.frases;
    var keys = Object.keys(f).map(Number).sort(function (a, b) { return a - b; });
    var best = keys[0];
    for (var i = 0; i < keys.length; i++) if (this.corazones >= keys[i]) best = keys[i];
    var pool = f[best].slice();
    if (U.chance(0.3)) {
      var meteo = {
        sol: ['Buen día hace, ¿eh?', 'Con este sol el campo crece solo.'],
        nubes: ['Está el cielo pesado, va a llover.', 'Ni frío ni calor: día de trabajar.'],
        lluvia: ['Menuda agua cae. Buena para el campo.', 'Con esta lluvia hoy no riega nadie.'],
        tormenta: ['¡Qué tronada! Métete bajo techo.', 'Los truenos asustan al ganado.'],
        nieve: ['Nieve en Ordás: esto ya es invierno de verdad.', 'Abrígate, que hiela.']
      }[clock.weather];
      if (meteo) pool = pool.concat(meteo);
    }
    if (U.chance(0.25)) {
      pool = pool.concat([
        ['Ya huele a primavera.', 'Este año viene bien de agua.'],
        ['Aprieta el calor en el valle.', 'A ver si sale buena cosecha.'],
        ['Se acorta el día, ya es otoño.', 'Hay que hacer la matanza pronto.'],
        ['Frío de Ordás, del que pela.', 'A ver si pasa pronto el invierno.']
      ][clock.season]);
    }
    return U.pick(pool);
  };

  NPC.prototype.save = function () {
    return { id: this.id, puntos: this.puntos, corazones: this.corazones, casado: this.casado, novia: this.novia };
  };

  /* ================================================================ HIJOS */
  var NOMBRES_M = ['Nicolás', 'Diego', 'Mateo', 'Bruno', 'Tomás', 'Adrián'];
  var NOMBRES_F = ['Lucía', 'Carmen', 'Sara', 'Julia', 'Nora', 'Elena'];

  function Child(scene, terrain, opts) {
    opts = opts || {};
    this.nina = opts.nina == null ? U.chance(0.5) : opts.nina;
    this.nombre = opts.nombre || U.pick(this.nina ? NOMBRES_F : NOMBRES_M);
    this.edad = opts.edad || 0;
    this.etapa = opts.etapa || 0;   // 0 bebé, 1 niño, 2 mozo
    this.terrain = terrain;
    this.mesh = A.human({
      child: this.etapa < 2,
      skin: this.nina ? '#e8b98c' : '#dda97e',
      hair: this.nina ? '#5a3a1a' : '#33251a',
      hairStyle: this.nina ? 'largo' : 'corto',
      shirt: this.nina ? '#c46a8a' : '#6a8ac4',
      pants: '#40454f'
    });
    this.mesh.scale.setScalar(this.etapa === 2 ? 0.9 : (this.etapa === 1 ? 0.72 : 0.5));
    this.mesh.visible = this.etapa > 0;
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(opts.x || 0, 0, opts.z || 0);
    this.heading = 0;
    this.speed = 0;
    this.ayudoHoy = false;
  }
  Child.prototype.update = function (dt, jugadorPos) {
    if (this.etapa === 0) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    var dx = jugadorPos.x - this.pos.x, dz = jugadorPos.z - this.pos.z;
    var dist = Math.hypot(dx, dz);
    if (dist > 3.2) {
      var v = Math.min(3.4, 1.2 + dist * 0.25);
      this.speed = v;
      this.pos.x += dx / dist * v * dt;
      this.pos.z += dz / dist * v * dt;
      var want = Math.atan2(dx, dz);
      this.heading += U.angleDelta(this.heading, want) * Math.min(1, dt * 6);
      if (dist > 30) { this.pos.x = jugadorPos.x - 2; this.pos.z = jugadorPos.z - 2; }
    } else this.speed = 0;
    this.pos.y = this.terrain.heightAt(this.pos.x, this.pos.z);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    A.animateHuman(this.mesh, dt, this.speed);
  };
  Child.prototype.nuevoDia = function () {
    this.edad++;
    var antes = this.etapa;
    if (this.edad >= 28) this.etapa = 2;
    else if (this.edad >= 10) this.etapa = 1;
    this.ayudoHoy = false;
    if (this.etapa !== antes) {
      this.mesh.scale.setScalar(this.etapa === 2 ? 0.9 : (this.etapa === 1 ? 0.72 : 0.5));
      return this.etapa;
    }
    return -1;
  };
  Child.prototype.frases = function () {
    return this.etapa === 1
      ? ['¡Papá! ¿Puedo dar de comer a las gallinas?', '¿Cuándo me dejas ordeñar a mí?',
         'He visto un corzo en el prado.', '¿Me dejas guiar la yunta?']
      : ['Padre, ya he regado el huerto.', 'He echado pienso al ganado, no te preocupes.',
         'Cuando quieras me quedo yo con la cuadra.', 'Este año la cosecha viene buena.',
         'He segado el prado de abajo con la guadaña.'];
  };
  Child.prototype.save = function () {
    return { nombre: this.nombre, nina: this.nina, edad: this.edad, etapa: this.etapa };
  };

  S.NPCs = { NPC: NPC, Child: Child, NOMBRES_M: NOMBRES_M, NOMBRES_F: NOMBRES_F };

})(window);
