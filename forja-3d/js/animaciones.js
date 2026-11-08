// Biblioteca de animaciones procedurales. Funcionan sobre cualquier esqueleto
// cuyos huesos tengan un «rol» (los del rig local o los deducidos de un rig de IA).
import * as THREE from 'three';
import { guardarReposo, ponerReposo } from './geometria.js';

export const CATALOGO = {
  humanoide: [
    ['reposo', 'Reposo', '🧍'], ['caminar', 'Caminar', '🚶'], ['correr', 'Correr', '🏃'],
    ['saltar', 'Saltar', '🦘'], ['saludar', 'Saludar', '👋'], ['bailar', 'Bailar', '💃'],
    ['atacar', 'Golpear', '🥊'], ['girar', 'Girar', '🔄'],
  ],
  cuadrupedo: [
    ['reposo', 'Reposo', '🐕'], ['caminar', 'Caminar', '🐾'], ['trotar', 'Trotar', '🐎'],
    ['saltar', 'Saltar', '🦘'], ['cola', 'Mover la cola', '🐶'], ['girar', 'Girar', '🔄'],
  ],
  objeto: [
    ['rebotar', 'Rebotar', '⚽'], ['balancear', 'Balancearse', '🌿'], ['bailar_obj', 'Bailar', '🕺'],
    ['girar', 'Girar', '🔄'], ['flotar', 'Flotar', '🎈'], ['gelatina', 'Gelatina', '🍮'],
  ],
};

const RAD = Math.PI / 180;
const TAU = Math.PI * 2;
const sin = Math.sin, cos = Math.cos, max = Math.max, min = Math.min;
const bump = (t, a, b) => (t <= a || t >= b ? 0 : sin(Math.PI * (t - a) / (b - a)));

class Constructor {
  constructor(personaje) {
    this.personaje = personaje;
    this.rig = personaje.userData.rig;
    const set = new Set();
    personaje.traverse((o) => { if (o.isSkinnedMesh) o.skeleton.bones.forEach((b) => set.add(b)); });
    guardarReposo(personaje);
    ponerReposo(personaje);
    // Orden jerárquico (padres antes que hijos).
    const lista = [...set];
    const prof = (b) => { let n = 0, p = b; while (set.has(p.parent)) { n++; p = p.parent; } return n; };
    lista.sort((a, b) => prof(a) - prof(b));
    this.huesos = lista;
    this.set = set;
    const caja = new THREE.Box3().setFromObject(personaje);
    this.H = Math.max(1e-6, caja.max.y - caja.min.y);
    this.info = new Map();
    for (const b of lista) {
      const P = b.parent.getWorldQuaternion(new THREE.Quaternion());
      const wp = b.getWorldPosition(new THREE.Vector3());
      const hijo = b.children.find((c) => set.has(c));
      let dir;
      if (hijo) dir = hijo.getWorldPosition(new THREE.Vector3()).sub(wp);
      else if (set.has(b.parent)) dir = wp.clone().sub(b.parent.getWorldPosition(new THREE.Vector3()));
      else dir = new THREE.Vector3(0, 1, 0);
      if (dir.lengthSq() < 1e-12) dir.set(0, 1, 0);
      this.info.set(b, {
        P, Pinv: P.clone().invert(),
        reposo: b.quaternion.clone(),
        posReposo: b.position.clone(),
        escReposo: b.scale.clone(),
        dir: dir.normalize(),
        padreInv: b.parent.matrixWorld.clone().invert(),
        mundo: wp,
        rol: this.rig?.roles?.[b.name] ?? { rol: 'otro', lado: 0 },
      });
    }
  }

  /** Huesos que cumplen un rol (y opcionalmente un lado). */
  de(rol, filtro) {
    return this.huesos.filter((b) => {
      const r = this.info.get(b).rol;
      return r.rol === rol && (!filtro || filtro(r));
    });
  }

  raiz() { return this.huesos[0]; }

  /** Genera un AnimationClip muestreando `fn(t, pose)` con t en [0, 1). */
  clip(nombre, duracion, fn) {
    const fps = 30;
    const N = Math.max(2, Math.round(duracion * fps) + 1);
    const tiempos = new Float32Array(N);
    const rot = new Map(), posi = new Map(), esc = new Map();
    const W = new Map();
    const q = new THREE.Quaternion(), tmp = new THREE.Quaternion(), e = new THREE.Euler();
    const v = new THREE.Vector3(), dirAct = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      tiempos[i] = t * duracion;
      const pose = { giros: new Map(), apuntes: new Map(), mov: new Map(), esc: new Map() };
      const api = {
        girar: (huesos, x = 0, y = 0, z = 0) => {
          for (const b of [huesos].flat()) {
            if (!b) continue;
            e.set(x * RAD, y * RAD, z * RAD, 'YXZ');
            const d = new THREE.Quaternion().setFromEuler(e);
            const prev = pose.giros.get(b);
            pose.giros.set(b, prev ? d.multiply(prev) : d);
          }
        },
        apuntar: (huesos, dir, mezcla = 1) => {
          for (const b of [huesos].flat()) if (b) pose.apuntes.set(b, { dir: dir.clone().normalize(), mezcla });
        },
        mover: (b, x = 0, y = 0, z = 0) => { if (b) pose.mov.set(b, new THREE.Vector3(x, y, z).multiplyScalar(this.H)); },
        escalar: (b, x = 1, y = 1, z = 1) => { if (b) pose.esc.set(b, new THREE.Vector3(x, y, z)); },
      };
      fn(t, api, this);
      W.clear();
      for (const b of this.huesos) {
        const inf = this.info.get(b);
        const Wp = W.get(b.parent) ?? new THREE.Quaternion();
        let E = new THREE.Quaternion();
        const ap = pose.apuntes.get(b);
        if (ap) {
          dirAct.copy(inf.dir).applyQuaternion(Wp);
          const Q = new THREE.Quaternion().setFromUnitVectors(dirAct, ap.dir);
          Q.slerp(new THREE.Quaternion(), 1 - ap.mezcla);
          const Wb = Q.multiply(Wp.clone());
          E = Wp.clone().invert().multiply(Wb);
        }
        const g = pose.giros.get(b);
        if (g) E = g.clone().multiply(E);
        W.set(b, Wp.clone().multiply(E));
        if (ap || g || rot.has(b)) {
          if (!rot.has(b)) rot.set(b, new Float32Array(N * 4).map((_, k) => inf.reposo.toArray()[k % 4]));
          q.copy(inf.Pinv).multiply(E).multiply(inf.P).multiply(inf.reposo);
          q.toArray(rot.get(b), i * 4);
        }
        const m = pose.mov.get(b);
        if (m || posi.has(b)) {
          if (!posi.has(b)) posi.set(b, new Float32Array(N * 3).map((_, k) => inf.posReposo.toArray()[k % 3]));
          if (m) {
            v.copy(inf.mundo).add(m).applyMatrix4(inf.padreInv);
            v.toArray(posi.get(b), i * 3);
          }
        }
        const s = pose.esc.get(b);
        if (s || esc.has(b)) {
          if (!esc.has(b)) esc.set(b, new Float32Array(N * 3).map((_, k) => inf.escReposo.toArray()[k % 3]));
          if (s) tmp.set(0, 0, 0, 1), v.copy(inf.escReposo).multiply(s).toArray(esc.get(b), i * 3);
        }
      }
    }
    const pistas = [];
    for (const [b, arr] of rot) pistas.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, tiempos, arr));
    for (const [b, arr] of posi) pistas.push(new THREE.VectorKeyframeTrack(`${b.name}.position`, tiempos, arr));
    for (const [b, arr] of esc) pistas.push(new THREE.VectorKeyframeTrack(`${b.name}.scale`, tiempos, arr));
    return new THREE.AnimationClip(nombre, duracion, pistas);
  }
}

// ---------------------------------------------------------------------------
// Definiciones
// ---------------------------------------------------------------------------
const lados = (c, rol) => [1, -1].map((l) => ({ lado: l, huesos: c.de(rol, (r) => r.lado === l) }));

function piernasCaminar(t, a, c, { amp = 25, rodilla = 35, velocidad = 1 } = {}) {
  for (const { lado, huesos } of lados(c, 'muslo')) {
    const f = TAU * (t * velocidad + (lado > 0 ? 0 : 0.5));
    a.girar(huesos, -amp * sin(f));
    a.girar(c.de('pierna', (r) => r.lado === lado), 5 + rodilla * max(0, sin(f + 1.3)));
    a.girar(c.de('pie', (r) => r.lado === lado), -8 * sin(f));
  }
}

function brazosBalanceo(t, a, c, { amp = 22, codo = 15 } = {}) {
  for (const { lado, huesos } of lados(c, 'brazo')) {
    const f = TAU * (t + (lado > 0 ? 0 : 0.5));
    a.girar(huesos, amp * sin(f), 0, lado * 6);
    a.girar(c.de('antebrazo', (r) => r.lado === lado), -codo - 8 * max(0, sin(f)));
  }
}

function patasCaminar(t, a, c, { amp = 22, rodilla = 22 } = {}) {
  const fases = { '1true': 0, '-1false': 0, '-1true': 0.5, '1false': 0.5 };
  for (const b of c.de('pata')) {
    const r = c.info.get(b).rol;
    const f = TAU * (t + fases[`${r.lado}${r.delantera}`]);
    if (r.segmento === 0) a.girar(b, -amp * sin(f));
    else if (r.segmento === 1) a.girar(b, (r.delantera ? 1 : -1) * rodilla * max(0, sin(f + 1.3)));
    else a.girar(b, (r.delantera ? 1 : -1) * 8 * sin(f));
  }
}

function colaMover(t, a, c, amp = 15, frec = 1) {
  c.de('cola').forEach((b) => {
    const i = c.info.get(b).rol.indice ?? 0;
    a.girar(b, 0, amp * (1 + i * 0.4) * sin(TAU * (t * frec - i * 0.12)), 0);
  });
}

function cadenaOndular(t, a, c, amp, ejes = 'z', frec = 1) {
  c.de('cadena').forEach((b) => {
    const i = c.info.get(b).rol.indice ?? 1;
    const ang = amp * (0.6 + i * 0.5) * sin(TAU * (t * frec - i * 0.12));
    if (ejes.includes('z')) a.girar(b, 0, 0, ang);
    if (ejes.includes('x')) a.girar(b, ang * 0.5, 0, 0);
    if (ejes.includes('y')) a.girar(b, 0, ang, 0);
  });
}

const DEF = {
  reposo: [3, (t, a, c) => {
    const s = sin(TAU * t);
    a.girar(c.de('columna'), 1.5 * s);
    a.girar(c.de('pecho'), 1.5 * s);
    a.girar(c.de('cabeza'), 2 * s, 10 * sin(TAU * t + 0.6));
    for (const { lado, huesos } of lados(c, 'brazo')) a.girar(huesos, 0, 0, lado * (2 + 2 * s));
    a.mover(c.raiz(), 0, 0.004 * s, 0);
    patasCaminar(0.25, a, c, { amp: 0, rodilla: 0 });
    colaMover(t, a, c, 10, 2);
    cadenaOndular(t, a, c, 3);
  }],
  caminar: [1.1, (t, a, c) => {
    piernasCaminar(t, a, c);
    brazosBalanceo(t, a, c);
    patasCaminar(t, a, c);
    a.mover(c.raiz(), 0, 0.012 * cos(2 * TAU * t), 0);
    a.girar(c.raiz(), 0, 5 * sin(TAU * t), 0);
    a.girar(c.de('columna'), 0, -3 * sin(TAU * t));
    a.girar(c.de('cabeza'), 3 * sin(2 * TAU * t), 2 * sin(TAU * t));
    colaMover(t, a, c, 12, 1);
  }],
  correr: [0.7, (t, a, c) => {
    piernasCaminar(t, a, c, { amp: 42, rodilla: 75 });
    for (const { lado, huesos } of lados(c, 'brazo')) {
      const f = TAU * (t + (lado > 0 ? 0 : 0.5));
      a.girar(huesos, 40 * sin(f), 0, lado * 10);
      a.girar(c.de('antebrazo', (r) => r.lado === lado), -75);
    }
    a.girar(c.de('columna'), 8);
    a.girar(c.de('cabeza'), -6);
    a.mover(c.raiz(), 0, 0.03 * Math.abs(cos(TAU * t)) - 0.02, 0);
    a.girar(c.raiz(), 0, 7 * sin(TAU * t), 0);
  }],
  trotar: [0.6, (t, a, c) => {
    patasCaminar(t, a, c, { amp: 35, rodilla: 40 });
    a.mover(c.raiz(), 0, 0.025 * Math.abs(cos(TAU * t)), 0);
    a.girar(c.de('cabeza'), 6 * sin(2 * TAU * t));
    colaMover(t, a, c, 20, 2);
  }],
  saltar: [1.6, (t, a, c) => {
    const k = bump(t, 0, 0.3) + 0.7 * bump(t, 0.72, 1);
    const h = t > 0.25 && t < 0.75 ? 4 * ((t - 0.25) / 0.5) * (1 - (t - 0.25) / 0.5) : 0;
    a.mover(c.raiz(), 0, -0.08 * k + 0.32 * h, 0);
    a.girar(c.de('muslo'), -45 * k - 30 * h);
    a.girar(c.de('pierna'), 75 * k + 45 * h);
    a.girar(c.de('pie'), -30 * k);
    a.girar(c.de('columna'), 14 * k);
    for (const { lado, huesos } of lados(c, 'brazo')) {
      a.girar(huesos, 40 * k, 0, 0);
      if (h > 0) a.apuntar(huesos, new THREE.Vector3(lado * 0.45, 0.85, 0.2), h);
    }
    for (const b of c.de('pata')) {
      const r = c.info.get(b).rol;
      if (r.segmento === 0) a.girar(b, (r.delantera ? -1 : 1) * 30 * h + 15 * k);
      if (r.segmento === 1) a.girar(b, (r.delantera ? 1 : -1) * (40 * k + 40 * h));
    }
    cadenaOndular(t, a, c, 8 * k, 'x');
    colaMover(t, a, c, 20 * h, 1);
  }],
  saludar: [2, (t, a, c) => {
    DEF.reposo[1](t, a, c);
    const brazo = c.de('brazo', (r) => r.lado === -1);
    const ante = c.de('antebrazo', (r) => r.lado === -1);
    const subida = min(1, t / 0.12) * min(1, (1 - t) / 0.12);
    a.apuntar(brazo, new THREE.Vector3(-0.55, 0.8, 0.2), subida);
    a.apuntar(ante, new THREE.Vector3(-0.15 + 0.45 * sin(4 * TAU * t), 0.95, 0.15), subida);
    a.girar(c.de('cabeza'), 0, 0, -6 * subida);
  }],
  bailar: [1, (t, a, c) => {
    const s = sin(TAU * t);
    a.mover(c.raiz(), 0.03 * s, -0.02 * (1 + cos(2 * TAU * t)) / 2, 0);
    a.girar(c.raiz(), 0, 8 * s, 6 * s);
    a.girar(c.de('columna'), 0, 0, -8 * s);
    a.girar(c.de('pecho'), 0, 10 * s, 0);
    a.girar(c.de('cabeza'), 0, 0, 8 * sin(2 * TAU * t));
    for (const { lado, huesos } of lados(c, 'brazo')) {
      const m = (1 + lado * s) / 2;
      const abajo = new THREE.Vector3(lado * 0.7, -0.6, 0.25);
      const arriba = new THREE.Vector3(lado * 0.5, 0.85, 0.1);
      a.apuntar(huesos, abajo.lerp(arriba, m), 1);
      a.girar(c.de('antebrazo', (r) => r.lado === lado), -30 - 30 * m);
    }
    for (const { lado, huesos } of lados(c, 'muslo')) {
      const m = max(0, lado * s);
      a.girar(huesos, -20 * m);
      a.girar(c.de('pierna', (r) => r.lado === lado), 35 * m);
    }
  }],
  atacar: [1.1, (t, a, c) => {
    const g = bump(t, 0.25, 0.7);
    const prep = bump(t, 0, 0.35);
    for (const { lado, huesos } of lados(c, 'brazo')) {
      a.apuntar(huesos, new THREE.Vector3(lado * 0.35, -0.4, 0.85), 0.7);
      a.girar(c.de('antebrazo', (r) => r.lado === lado), -95);
    }
    const derecho = c.de('brazo', (r) => r.lado === -1);
    a.apuntar(derecho, new THREE.Vector3(-0.05, 0.1, 1), g);
    a.girar(c.de('antebrazo', (r) => r.lado === -1), 85 * g);
    a.girar(c.de('pecho'), 0, -25 * g + 15 * prep, 0);
    a.girar(c.de('columna'), 6, -10 * g, 0);
    a.mover(c.raiz(), 0, -0.02, 0.03 * g);
    a.girar(c.de('muslo', (r) => r.lado === 1), -20);
    a.girar(c.de('pierna'), 20);
  }],
  cola: [1, (t, a, c) => {
    colaMover(t, a, c, 35, 3);
    a.mover(c.raiz(), 0, 0.03 * Math.abs(sin(2 * TAU * t)), 0);
    a.girar(c.de('cabeza'), -8, 10 * sin(TAU * t), 6 * sin(2 * TAU * t));
    patasCaminar(t * 2, a, c, { amp: 6, rodilla: 6 });
  }],
  girar: [2.4, (t, a, c) => {
    a.girar(c.raiz(), 0, 360 * t, 0);
    a.mover(c.raiz(), 0, 0.03 * sin(Math.PI * t), 0);
  }],
  rebotar: [1, (t, a, c) => {
    const h = Math.abs(sin(Math.PI * t));
    const k = max(0, 1 - h * 5);
    a.mover(c.raiz(), 0, 0.25 * h, 0);
    a.escalar(c.raiz(), 1 + 0.12 * k, 1 - 0.2 * k, 1 + 0.12 * k);
    cadenaOndular(t, a, c, 4 * h, 'x', 2);
  }],
  balancear: [2, (t, a, c) => {
    cadenaOndular(t, a, c, 7, 'z');
    a.girar(c.raiz(), 0, 0, 2 * sin(TAU * t));
  }],
  bailar_obj: [1, (t, a, c) => {
    cadenaOndular(t, a, c, 9, 'yz', 1);
    a.mover(c.raiz(), 0.02 * sin(TAU * t), 0.04 * Math.abs(sin(2 * Math.PI * t)), 0);
    a.girar(c.raiz(), 0, 15 * sin(TAU * t), 0);
  }],
  flotar: [3, (t, a, c) => {
    a.mover(c.raiz(), 0, 0.06 + 0.05 * sin(TAU * t), 0);
    a.girar(c.raiz(), 3 * sin(TAU * t), 10 * sin(TAU * t / 1), 4 * cos(TAU * t));
    cadenaOndular(t, a, c, 3, 'z');
  }],
  gelatina: [1, (t, a, c) => {
    const s = sin(2 * TAU * t);
    a.escalar(c.raiz(), 1 - 0.06 * s, 1 + 0.1 * s, 1 - 0.06 * s);
    cadenaOndular(t, a, c, 6, 'xz', 2);
  }],
};

/** Crea todas las animaciones del catálogo para el tipo del personaje. */
export function crearAnimaciones(personaje) {
  const tipo = personaje.userData.rig?.tipo ?? 'objeto';
  const c = new Constructor(personaje);
  const lista = CATALOGO[tipo] ?? CATALOGO.objeto;
  const clips = lista.map(([id, nombre]) => {
    const [dur, fn] = DEF[id];
    const clip = c.clip(nombre, dur, fn);
    clip.userData = { id };
    return clip;
  });
  ponerReposo(personaje);
  return clips;
}

export function emojiDe(nombre) {
  for (const lista of Object.values(CATALOGO)) {
    const f = lista.find(([, n]) => n === nombre);
    if (f) return f[2];
  }
  return '🎬';
}
