// CHAPUZAS A DOMICILIO · Reformas Chapucilla S.L.
// Juego 3D de humor (three.js). Personajes y situaciones originales.
import * as THREE from 'three';

/* =========================================================================
   Utilidades
   ========================================================================= */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
function angLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
const euros = n => `${n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('es-ES')} €`;

/* =========================================================================
   Sonido (todo sintetizado con WebAudio, sin ficheros)
   ========================================================================= */
const Sonido = {
  ctx: null, master: null, musica: null, on: true, ruido: null,
  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 0.55 : 0;
    this.master.connect(this.ctx.destination);
    this.musica = this.ctx.createGain();
    this.musica.gain.value = 0.13;
    this.musica.connect(this.master);
    const len = this.ctx.sampleRate * 1.5;
    this.ruido = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  alternar() {
    this.on = !this.on;
    if (this.master) this.master.gain.value = this.on ? 0.55 : 0;
    return this.on;
  },
  tono(f, dur, tipo = 'square', vol = 0.15, f2 = null, cuando = 0, destino = null) {
    if (!this.ctx) return;
    const t = cuando || this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = tipo;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(destino || this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  ruidoF(dur, vol = 0.3, freq = 1000, tipo = 'lowpass', freq2 = null, cuando = 0) {
    if (!this.ctx) return;
    const t = cuando || this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.ruido;
    const f = this.ctx.createBiquadFilter();
    f.type = tipo; f.frequency.setValueAtTime(freq, t);
    if (freq2) f.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
  },
  // Efectos
  coger() { this.tono(660, 0.08, 'square', 0.12, 990); },
  boing() { this.tono(180, 0.25, 'sine', 0.35, 720); setTimeout(() => this.tono(720, 0.35, 'sine', 0.3, 140), 230); },
  chof() { this.ruidoF(0.7, 0.45, 1800, 'bandpass', 300); },
  zas() { this.tono(1400, 0.45, 'sawtooth', 0.18, 60); this.ruidoF(0.4, 0.25, 4000, 'highpass'); },
  clonc() { this.tono(900, 0.07, 'square', 0.15); this.tono(1450, 0.18, 'triangle', 0.12, 1300); },
  crash() { this.ruidoF(0.5, 0.5, 900, 'lowpass', 200); this.tono(140, 0.4, 'triangle', 0.3, 50); },
  fanfarria() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this.tono(f, i === 3 ? 0.45 : 0.12, 'square', 0.13, null, t + i * 0.1));
  },
  trombon() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [[392, 0.3], [370, 0.3], [349, 0.3], [330, 0.9]].forEach(([f, d], i) =>
      this.tono(f, d, 'sawtooth', 0.14, i === 3 ? 300 : null, t + i * 0.32));
  },
  miau() { this.tono(650, 0.15, 'sine', 0.2, 1100); setTimeout(() => this.tono(1100, 0.35, 'sine', 0.18, 520), 140); },
  nam() { for (let i = 0; i < 3; i++) setTimeout(() => this.ruidoF(0.09, 0.35, 700, 'lowpass'), i * 150); },
  timbre() { this.tono(988, 0.35, 'sine', 0.2); setTimeout(() => this.tono(784, 0.6, 'sine', 0.2), 330); },
  plop() { this.tono(300, 0.12, 'sine', 0.2, 900); },
  voz(base, n) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < n; i++) this.tono(base * rand(0.8, 1.3), 0.06, 'triangle', 0.06, null, t + i * 0.075);
  },
};

// Música: un pasodoblillo chiptune original en bucle
const Musica = {
  paso: 0, siguiente: 0, activa: false,
  // 0 = silencio
  melodia: [
    67, 0, 72, 0, 71, 72, 74, 72, 71, 0, 67, 0, 65, 64, 62, 0,
    64, 0, 65, 67, 69, 67, 65, 64, 62, 0, 67, 0, 60, 0, 0, 0,
    72, 0, 76, 0, 74, 72, 71, 72, 74, 0, 71, 0, 67, 0, 0, 0,
    69, 0, 72, 69, 67, 0, 65, 64, 62, 64, 65, 62, 60, 0, 0, 0,
  ],
  bajo: [48, 55, 48, 55, 43, 50, 43, 50, 41, 48, 41, 48, 43, 50, 48, 48,
         45, 52, 45, 52, 43, 50, 43, 50, 41, 48, 43, 50, 48, 55, 48, 48],
  tic() {
    const c = Sonido.ctx;
    if (!c || !this.activa) return;
    const dur = 0.19;
    if (this.siguiente < c.currentTime) this.siguiente = c.currentTime + 0.05;
    while (this.siguiente < c.currentTime + 0.25) {
      const i = this.paso % this.melodia.length;
      const m = this.melodia[i];
      const hz = n => 440 * Math.pow(2, (n - 69) / 12);
      if (m) Sonido.tono(hz(m), dur * 0.9, 'square', 0.5, null, this.siguiente, Sonido.musica);
      if (i % 2 === 0) {
        const b = this.bajo[(i / 2) % this.bajo.length];
        if (b) Sonido.tono(hz(b), dur * 1.6, 'triangle', 0.9, null, this.siguiente, Sonido.musica);
      }
      if (i % 4 === 2) Sonido.ruidoF(0.05, 0.05, 6000, 'highpass', null, this.siguiente);
      this.paso++;
      this.siguiente += dur;
    }
  },
};

/* =========================================================================
   Escena, cámara, luces
   ========================================================================= */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const CIELO = new THREE.Color(0x9fd3f0);
const CIELO_NOCHE = new THREE.Color(0x0d0f1a);
scene.background = CIELO.clone();
scene.fog = new THREE.Fog(0x9fd3f0, 34, 70);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 120);
camera.position.set(0, 14, 16);

const hemi = new THREE.HemisphereLight(0xfff4e0, 0x7a5f45, 1.25);
scene.add(hemi);
const sol = new THREE.DirectionalLight(0xfff0d0, 1.7);
sol.position.set(9, 20, 12);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 60 });
sol.shadow.bias = -0.0005;
scene.add(sol);
const linterna = new THREE.SpotLight(0xfff3c4, 0, 14, 0.6, 0.5, 1);
scene.add(linterna, linterna.target);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* =========================================================================
   Materiales, texturas y piezas básicas
   ========================================================================= */
const cacheMat = new Map();
function mat(color) {
  if (!cacheMat.has(color)) cacheMat.set(color, new THREE.MeshLambertMaterial({ color }));
  return cacheMat.get(color);
}
function caja(w, h, d, color, x = 0, y = 0, z = 0, padre = scene, sombra = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = sombra; m.receiveShadow = true;
  padre.add(m);
  return m;
}
function cilindro(rt, rb, h, color, x = 0, y = 0, z = 0, padre = scene, seg = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  padre.add(m);
  return m;
}
function esfera(r, color, x = 0, y = 0, z = 0, padre = scene, seg = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.75 | 0)), typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z); m.castShadow = true;
  padre.add(m);
  return m;
}
function texLienzo(w, h, dibujar, rep = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const texParquet = rep => texLienzo(256, 256, (g, w, h) => {
  for (let y = 0; y < h; y += 32) {
    const off = (y / 32) % 2 ? 0 : 96;
    for (let x = -128; x < w; x += 192) {
      g.fillStyle = `hsl(28, 45%, ${38 + Math.random() * 10}%)`;
      g.fillRect(x + off, y, 192, 32);
      g.strokeStyle = 'rgba(60,30,10,.55)'; g.lineWidth = 2;
      g.strokeRect(x + off, y, 192, 32);
    }
  }
}, rep);
const texBaldosa = (a, b, rep) => texLienzo(128, 128, (g) => {
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * 64, j * 64, 64, 64);
  }
  g.strokeStyle = 'rgba(0,0,0,.15)'; g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
}, rep);
const texAsfalto = rep => texLienzo(128, 128, (g) => {
  g.fillStyle = '#4a4a4f'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${Math.random() > .5 ? 255 : 0},${Math.random() > .5 ? 255 : 0},255,.06)`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
}, rep);
const texCesped = rep => texLienzo(128, 128, (g) => {
  g.fillStyle = '#7dbb5a'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) { g.fillStyle = `hsla(${90 + Math.random() * 30},50%,${35 + Math.random() * 20}%,.5)`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 4); }
}, rep);
function texCartel(lineas, fondo, tinta, w = 512, h = 128, borde = null) {
  return texLienzo(w, h, (g) => {
    g.fillStyle = fondo; g.fillRect(0, 0, w, h);
    if (borde) { g.strokeStyle = borde; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
    g.fillStyle = tinta; g.textAlign = 'center'; g.textBaseline = 'middle';
    lineas.forEach(([txt, tam, y]) => { g.font = `900 ${tam}px Nunito, Arial, sans-serif`; g.fillText(txt, w / 2, y); });
  });
}
function suelo(x1, x2, z1, z2, mapa, y = 0.01) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), new THREE.MeshLambertMaterial({ map: mapa }));
  m.rotation.x = -Math.PI / 2;
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

/* =========================================================================
   Colisiones
   ========================================================================= */
const colisiones = [];
const addCol = (minX, maxX, minZ, maxZ) => colisiones.push({ minX, maxX, minZ, maxZ });
function resolverColision(p, r) {
  for (const b of colisiones) {
    const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), em = r - d;
        p.x += dx / d * em; p.z += dz / d * em;
      } else {
        // Centro dentro de la caja: expulsar por el lado más cercano
        const opts = [[p.x - b.minX + r, -1, 0], [b.maxX - p.x + r, 1, 0], [p.z - b.minZ + r, 0, -1], [b.maxZ - p.z + r, 0, 1]];
        opts.sort((a, c) => a[0] - c[0]);
        p.x += opts[0][1] * opts[0][0]; p.z += opts[0][2] * opts[0][0];
      }
    }
  }
}

/* =========================================================================
   El piso de Doña Remedios
   ========================================================================= */
const T = 0.2, H_ALTA = 2.6, H_BAJA = 1.45;
const COL_PARED = 0xf3e3c3, COL_REMATE = 0x8a5a3a;

// Suelos
const cesped = suelo(-40, 40, -40, 40, texCesped([30, 30]), 0);
suelo(-40, 40, 10.6, 16, texAsfalto([20, 3]), 0.005);
suelo(-11.2, 11.2, 5, 10.6, texBaldosa('#cfcac0', '#bdb7ab', [11, 3]), 0.008);
suelo(-11, 0, -1.5, 5, texParquet([4, 2.5]));
suelo(-11, 0, -8, -1.5, texParquet([4, 2.5]));
suelo(0, 11, -1.5, 5, texBaldosa('#f4f1ea', '#2b2b2b', [6, 3.5]));
suelo(0, 11, -8, -1.5, texBaldosa('#ffffff', '#8fc3d9', [6, 3.5]));
// Raya de la carretera
for (let x = -38; x < 40; x += 4) caja(2, 0.02, 0.18, 0xf5f0d8, x, 0.01, 13.3, scene, false);

function pared(x1, z1, x2, z2, h) {
  const vert = x1 === x2;
  const len = vert ? Math.abs(z2 - z1) : Math.abs(x2 - x1);
  const w = vert ? T : len + T, d = vert ? len + T : T;
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  caja(w, h, d, COL_PARED, cx, h / 2, cz);
  caja(w + 0.04, 0.08, d + 0.04, COL_REMATE, cx, h, cz);
  caja(w + 0.03, 0.18, d + 0.03, 0xc9b28d, cx, 0.09, cz, scene, false); // rodapié
  addCol(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2);
}
pared(-11, -8, 11, -8, H_ALTA);
pared(-11, -8, -11, 5, H_ALTA);
pared(11, -8, 11, 5, H_ALTA);
pared(-11, 5, -3, 5, H_BAJA);
pared(-1, 5, 11, 5, H_BAJA);
pared(0, -8, 0, -5.5, H_BAJA);
pared(0, -3.5, 0, 1, H_BAJA);
pared(0, 3, 0, 5, H_BAJA);
pared(-11, -1.5, -6, -1.5, H_BAJA);
pared(-4, -1.5, 4, -1.5, H_BAJA);
pared(6, -1.5, 11, -1.5, H_BAJA);
// Límites de la calle (invisibles)
addCol(-13, 13, 10.6, 11.4);
addCol(-13, -11.3, 5, 11.4);
addCol(11.3, 13, 5, 11.4);

// Puerta de entrada abierta
const hoja = caja(0.1, 2.0, 1.9, 0x7b4a28, -3.05, 1.0, 5.95);
hoja.rotation.y = 0.0;
caja(0.08, 0.08, 0.08, 0xd4af37, -2.98, 1.0, 6.75);
// Felpudo
const felpudo = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshLambertMaterial({
  map: texCartel([['BIENVENIDOS', 52, 40], ['(a ser posible, limpios)', 26, 90]], '#a77b47', '#3b2410', 512, 128),
}));
felpudo.rotation.x = -Math.PI / 2; felpudo.position.set(-2, 0.02, 5.75); scene.add(felpudo);

// ---- Mobiliario ----
// Salón: sofá, mueble con tele, alfombra, planta
function sofa(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  caja(3, 0.45, 0.95, 0x6f9a52, 0, 0.3, 0, g);
  caja(3, 0.7, 0.25, 0x5f8a44, 0, 0.6, 0.36, g);
  caja(0.25, 0.6, 0.95, 0x5f8a44, -1.4, 0.45, 0, g);
  caja(0.25, 0.6, 0.95, 0x5f8a44, 1.4, 0.45, 0, g);
  caja(0.6, 0.35, 0.12, 0xe8c547, -0.7, 0.7, 0.18, g).rotation.x = -0.3; // cojín
  // Ganchillo encima (tapete)
  caja(0.5, 0.02, 0.3, 0xffffff, 0.6, 0.97, 0.36, g);
  addCol(x - 1.5, x + 1.5, z - 0.48, z + 0.48);
}
sofa(-8.5, 4.2);
caja(1.8, 0.55, 0.5, 0x8a5a3a, -8.5, 0.28, -1.0);
addCol(-9.4, -7.6, -1.3, -0.7);
const tele = caja(1.0, 0.75, 0.55, 0x2a2a2a, -8.5, 0.95, -1.05);
const pantalla = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.6), new THREE.MeshBasicMaterial({
  map: texCartel([['TELECOMPRA', 40, 50], ['¡LLAME YA!', 52, 110]], '#2e6fd8', '#fff', 256, 160),
}));
pantalla.position.set(-8.5, 0.95, -0.77); scene.add(pantalla);
const alfombra = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), new THREE.MeshLambertMaterial({
  map: texLienzo(256, 160, (g, w, h) => {
    g.fillStyle = '#9b2d2d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e7c46a'; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#e7c46a'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(40 + i * 44, 80, 12, 0, 7); g.fill(); }
  }),
}));
alfombra.rotation.x = -Math.PI / 2; alfombra.position.set(-8.3, 0.02, 1.6); alfombra.receiveShadow = true; scene.add(alfombra);
function planta(x, z) {
  cilindro(0.25, 0.2, 0.45, 0xb5562e, x, 0.22, z);
  esfera(0.45, 0x3d8b3d, x, 0.85, z);
  esfera(0.3, 0x4fa04f, x + 0.2, 1.15, z + 0.1);
  addCol(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
}
planta(-0.6, 4.4);
planta(10.4, 4.4);
// Foto de boda en la pared del fondo? No: reloj de cuco en el dormitorio
// Dormitorio: cama, mesita, armario
caja(2.2, 0.45, 3.0, 0x7b4a28, -9.7, 0.25, -6.3);
caja(2.1, 0.2, 2.6, 0xf1f1f1, -9.7, 0.55, -6.15);
caja(2.15, 0.22, 1.7, 0xc8506f, -9.7, 0.6, -5.6);
caja(0.8, 0.18, 0.45, 0xffffff, -10.1, 0.72, -7.35);
caja(0.8, 0.18, 0.45, 0xffffff, -9.25, 0.72, -7.35);
caja(2.2, 1.1, 0.12, 0x7b4a28, -9.7, 0.55, -7.85);
addCol(-10.8, -8.6, -7.8, -4.8);
caja(0.55, 0.55, 0.5, 0x8a5a3a, -10.5, 0.28, -4.3);
addCol(-10.8, -10.2, -4.55, -4.05);
caja(2.2, 2.1, 0.7, 0x9b6a3c, -2.5, 1.05, -7.6);
caja(0.02, 1.9, 0.02, 0x5a3a1c, -2.5, 1.05, -7.24);
addCol(-3.6, -1.4, -7.95, -7.25);
// Cocina: encimera, nevera, mesa
caja(4.0, 0.9, 0.85, 0xf0ede6, 8.9, 0.45, -1.0);
caja(4.06, 0.06, 0.9, 0x8f8f8f, 8.9, 0.93, -1.0);
for (let i = 0; i < 4; i++) caja(0.9, 0.7, 0.02, 0xd9d3c7, 7.4 + i * 1.0, 0.45, -0.57);
addCol(6.9, 10.9, -1.42, -0.55);
caja(0.95, 1.9, 0.8, 0xe9f0f2, 0.7, 0.95, -0.95);
caja(0.04, 0.5, 0.04, 0x888888, 1.1, 1.3, -0.53);
addCol(0.2, 1.2, -1.35, -0.53);
// Imanes de nevera
caja(0.15, 0.15, 0.02, 0xd8382c, 0.5, 1.5, -0.54); caja(0.12, 0.18, 0.02, 0x2f5fa8, 0.8, 1.2, -0.54);
caja(1.6, 0.08, 1.0, 0xc79a5b, 5, 0.8, 3.3);
for (const [dx, dz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) caja(0.08, 0.8, 0.08, 0x8a5a3a, 5 + dx, 0.4, 3.3 + dz);
addCol(4.2, 5.8, 2.8, 3.8);
const frutero = esfera(0.14, 0xff9f1a, 5.1, 0.95, 3.3); esfera(0.12, 0xd8382c, 4.85, 0.93, 3.2);
// Baño: bañera, lavabo, espejo
caja(2.6, 0.6, 0.8, 0xfafafa, 2.3, 0.3, -7.5);
caja(2.3, 0.05, 0.55, 0x8fc3d9, 2.3, 0.58, -7.5, scene, false);
addCol(1.0, 3.6, -7.9, -7.1);
// Patito de goma
esfera(0.1, 0xffd23f, 2.6, 0.68, -7.45); esfera(0.07, 0xffd23f, 2.68, 0.8, -7.45); caja(0.06, 0.03, 0.05, 0xff8a1a, 2.76, 0.8, -7.45);
cilindro(0.12, 0.16, 0.8, 0xfafafa, 6.5, 0.4, -7.6);
caja(0.7, 0.18, 0.5, 0xfafafa, 6.5, 0.85, -7.6);
caja(0.7, 0.9, 0.04, 0xbfe3f2, 6.5, 1.7, -7.88);
addCol(6.15, 6.85, -7.9, -7.35);

// ---- La calle: furgoneta y mesa de herramientas ----
function furgoneta(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  caja(3.3, 1.9, 2.1, 0xf4f4f0, -0.5, 1.3, 0, g);
  caja(1.3, 1.3, 2.0, 0xf4f4f0, 1.65, 1.0, 0, g);
  caja(0.05, 0.6, 1.7, 0x6fb3d9, 2.32, 1.35, 0, g, false);
  caja(0.9, 0.55, 0.05, 0x6fb3d9, 1.65, 1.35, 1.01, g, false);
  caja(0.2, 0.25, 2.1, 0xd8382c, 2.35, 0.55, 0, g);
  for (const [wx, wz] of [[-1.4, 1.02], [1.4, 1.02], [-1.4, -1.02], [1.4, -1.02]]) {
    const r = cilindro(0.42, 0.42, 0.3, 0x1e1e1e, wx, 0.42, wz, g, 16); r.rotation.x = Math.PI / 2;
    const l = cilindro(0.2, 0.2, 0.32, 0xbdbdbd, wx, 0.42, wz, g, 10); l.rotation.x = Math.PI / 2;
  }
  // Rótulo de la empresa
  const rotulo = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.5), new THREE.MeshLambertMaterial({
    map: texLienzo(512, 256, (c, w, h) => {
      c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2a33a'; c.fillRect(0, 150, w, 40);
      c.fillStyle = '#1f4e8c'; c.textAlign = 'center';
      c.font = '900 54px Nunito, Arial'; c.fillText('REFORMAS', w / 2, 62);
      c.font = '900 64px Nunito, Arial'; c.fillText('CHAPUCILLA S.L.', w / 2, 128);
      c.fillStyle = '#2a1e12'; c.font = '800 26px Nunito, Arial'; c.fillText('Fontanería · Pintura · Electricidad · Lo que sea', w / 2, 179);
      c.font = '800 28px Nunito, Arial'; c.fillText('«Si no lo arreglamos, lo dejamos peor»', w / 2, 230);
    }),
  }));
  rotulo.position.set(-0.5, 1.35, 1.06); g.add(rotulo);
  // Escalera en la baca
  caja(3.0, 0.06, 0.12, 0xb0b0b0, -0.5, 2.32, -0.3, g); caja(3.0, 0.06, 0.12, 0xb0b0b0, -0.5, 2.32, 0.3, g);
  for (let i = 0; i < 7; i++) caja(0.05, 0.05, 0.6, 0xb0b0b0, -1.9 + i * 0.47, 2.32, 0, g);
  addCol(x - 2.0, x + 2.4, z - 1.1, z + 1.1);
}
furgoneta(-7.5, 7.8);
// Cubo donde se sienta Ramón a almorzar
cilindro(0.25, 0.2, 0.45, 0x8f8f8f, -4.0, 0.22, 9.6);
// Mesa de herramientas
caja(4.8, 0.08, 0.9, 0x9b6a3c, 2.9, 0.85, 8.0);
for (const [dx, dz] of [[-2.3, -0.38], [2.3, -0.38], [-2.3, 0.38], [2.3, 0.38]]) caja(0.08, 0.85, 0.08, 0x6b4321, 2.9 + dx, 0.42, 8.0 + dz);
addCol(0.5, 5.3, 7.55, 8.45);
const cartelHerr = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshLambertMaterial({
  map: texCartel([['🧰 HERRAMIENTAS 🧰', 60, 64]], '#ffd23f', '#2a1e12', 512, 110, '#2a1e12'),
}));
cartelHerr.position.set(2.9, 2.25, 8.45); scene.add(cartelHerr);
caja(0.06, 1.5, 0.06, 0x6b4321, 1.7, 1.6, 8.43); caja(0.06, 1.5, 0.06, 0x6b4321, 4.1, 1.6, 8.43);

// Decorado: farolas, árboles, edificios al fondo
function farola(x, z) { cilindro(0.07, 0.09, 3.6, 0x333333, x, 1.8, z); esfera(0.22, 0xfff3b0, x, 3.7, z); }
farola(-10.6, 10.2); farola(10.6, 10.2);
function arbol(x, z, s = 1) {
  cilindro(0.18 * s, 0.25 * s, 1.6 * s, 0x7b4a28, x, 0.8 * s, z);
  esfera(1.1 * s, 0x4f9a3f, x, 2.2 * s, z); esfera(0.8 * s, 0x5fae4a, x + 0.6 * s, 2.7 * s, z + 0.2);
}
[[-14, -3], [-15, 4], [14, -2], [15, 5], [-6, -12], [3, -13], [10, -11.5], [-12, -11]].forEach(([x, z], i) => arbol(x, z, 0.9 + (i % 3) * 0.2));
const coloresEdif = [0xe8b07a, 0xd98c6a, 0xf0d39a, 0xc9a07a, 0xe3c4a0];
for (let i = 0; i < 9; i++) {
  const x = -32 + i * 8, h = rand(5, 10);
  const e = caja(7, h, 5, coloresEdif[i % 5], x, h / 2, 20);
  for (let fy = 1.5; fy < h - 1; fy += 2) for (let fx = -2.4; fx <= 2.4; fx += 1.6) caja(0.8, 1.0, 0.05, 0x6fa7c8, x + fx, fy, 17.48, scene, false);
}

/* =========================================================================
   Personajes
   ========================================================================= */
function crearPersonaje(o) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);
  const s = o.ancho || 1;
  const piel = mat(o.piel || 0xf1c7a0);
  const matCuerpo = new THREE.MeshLambertMaterial({ color: o.cuerpo });
  const colorCuerpo = new THREE.Color(o.cuerpo);
  const matPiernas = o.piernas === 'mono' ? matCuerpo : mat(o.piernas);
  const piernas = [], brazos = [];
  for (const lado of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(0.14 * s * lado, 0.78, 0); cuerpo.add(p);
    caja(0.2, 0.74, 0.22, matPiernas, 0, -0.37, 0, p);
    caja(0.22, 0.12, 0.34, o.zapatos || 0x3b2a1c, 0, -0.74, 0.05, p);
    piernas.push(p);
  }
  caja(0.62 * s, 0.72, 0.4 * s, matCuerpo, 0, 1.14, 0, cuerpo);
  if (o.barriga) { const b = esfera(0.36, matCuerpo, 0, 1.02, 0.12, cuerpo); b.scale.set(1.15, 1, 0.9); }
  if (o.bolsillo) caja(0.2, 0.18, 0.02, o.bolsillo, 0.13 * s, 1.25, 0.21 * s, cuerpo);
  for (const lado of [-1, 1]) {
    const b = new THREE.Group(); b.position.set((0.31 * s + 0.1) * lado, 1.44, 0); cuerpo.add(b);
    caja(0.16, 0.6, 0.18, o.mangas || matCuerpo, 0, -0.3, 0, b);
    esfera(0.1, piel, 0, -0.66, 0, b, 8);
    brazos.push(b);
  }
  const mano = new THREE.Group(); mano.position.set(0, -0.68, 0.06); brazos[1].add(mano);
  const cabeza = new THREE.Group(); cabeza.position.set(0, 1.78, 0); cuerpo.add(cabeza);
  esfera(0.27, piel, 0, 0, 0, cabeza, 14);
  for (const lado of [-1, 1]) {
    esfera(0.045, 0x1b1b1b, 0.1 * lado, 0.04, 0.24, cabeza, 6);
    esfera(0.06, piel, 0.27 * lado, 0, 0, cabeza, 6); // orejas
  }
  esfera(0.07, o.nariz || 0xe8a682, 0, -0.03, 0.28, cabeza, 8);
  caja(0.12, 0.025, 0.02, 0x7a2b22, 0, -0.13, 0.25, cabeza, false);
  if (o.bigote) caja(0.26, 0.06, 0.06, 0x2a1a10, 0, -0.08, 0.27, cabeza, false);
  if (o.gorra) {
    const gc = cilindro(0.28, 0.28, 0.16, o.gorra, 0, 0.18, 0, cabeza, 14);
    caja(0.32, 0.03, 0.22, o.gorra, 0, 0.12, 0.3, cabeza);
  }
  if (o.calvo) {
    caja(0.06, 0.16, 0.2, 0x3a2a1c, -0.27, 0.07, -0.05, cabeza); caja(0.06, 0.16, 0.2, 0x3a2a1c, 0.27, 0.07, -0.05, cabeza);
    const brillo = esfera(0.05, 0xffffff, 0.08, 0.25, 0.08, cabeza, 6); brillo.material = new THREE.MeshBasicMaterial({ color: 0xfff3e6 });
    caja(0.03, 0.03, 0.18, 0xe8c547, 0.29, 0.1, 0.02, cabeza); // lápiz en la oreja
  }
  if (o.rulos) {
    esfera(0.25, 0x9a9a9a, 0, 0.1, -0.05, cabeza, 10);
    const cols = [0xff8fb1, 0x8fd3ff, 0xfff08f, 0xb1ff8f];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = cilindro(0.06, 0.06, 0.14, cols[i % 4], Math.cos(a) * 0.17, 0.22, Math.sin(a) * 0.17 - 0.03, cabeza, 8);
      r.rotation.z = Math.PI / 2;
    }
    for (const lado of [-1, 1]) { // gafas
      const gafa = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14), mat(0x6b3a2a));
      gafa.position.set(0.1 * lado, 0.04, 0.26); cabeza.add(gafa);
    }
  }
  if (o.pelo) { const p = esfera(0.28, o.pelo, 0, 0.07, -0.04, cabeza, 12); p.scale.set(1, 0.75, 1); }
  // Pelos de punta (se ven al electrocutarse)
  const pelosPunta = new THREE.Group(); cabeza.add(pelosPunta); pelosPunta.visible = false;
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 5), mat(0x2a1a10));
    const a = (i / 9) * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.15, 0.32, Math.sin(a) * 0.15);
    c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    pelosPunta.add(c);
  }
  if (o.escala) g.scale.setScalar(o.escala);
  scene.add(g);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { g, cuerpo, piernas, brazos, mano, cabeza, matCuerpo, colorCuerpo, pelosPunta, fase: 0 };
}

function animarAndar(c, dt, vel, trabajando = false) {
  const v = Math.min(1, vel / 3);
  c.fase += dt * (4 + vel * 2.2);
  const sw = Math.sin(c.fase) * 0.65 * v;
  c.piernas[0].rotation.x = lerp(c.piernas[0].rotation.x, sw, 0.4);
  c.piernas[1].rotation.x = lerp(c.piernas[1].rotation.x, -sw, 0.4);
  c.brazos[0].rotation.x = lerp(c.brazos[0].rotation.x, -sw * 0.8, 0.4);
  if (trabajando) {
    c.brazos[1].rotation.x = -1.3 + Math.sin(performance.now() / 55) * 0.6;
  } else {
    c.brazos[1].rotation.x = lerp(c.brazos[1].rotation.x, sw * 0.8, 0.4);
  }
  c.cuerpo.position.y = Math.abs(Math.sin(c.fase)) * 0.05 * v;
}

function crearGato() {
  const g = new THREE.Group();
  const naranja = 0xe98a2e, blanco = 0xfff3e0;
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  const tronco = esfera(0.22, naranja, 0, 0.3, 0, cuerpo, 10); tronco.scale.set(0.8, 0.8, 1.5);
  const cab = new THREE.Group(); cab.position.set(0, 0.48, 0.32); cuerpo.add(cab);
  esfera(0.16, naranja, 0, 0, 0, cab, 10);
  esfera(0.08, blanco, 0, -0.04, 0.12, cab, 8);
  for (const l of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), mat(naranja)); o.position.set(0.09 * l, 0.15, 0); cab.add(o);
    esfera(0.025, 0x1b1b1b, 0.06 * l, 0.03, 0.14, cab, 6);
  }
  const patas = [];
  for (const [x, z] of [[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.18], [0.1, -0.18]]) {
    const p = caja(0.07, 0.22, 0.07, blanco, x, 0.11, z, cuerpo); patas.push(p);
  }
  const cola = new THREE.Group(); cola.position.set(0, 0.36, -0.3); cuerpo.add(cola);
  const cc = cilindro(0.03, 0.04, 0.45, naranja, 0, 0.2, 0, cola, 6);
  cola.rotation.x = -0.5;
  scene.add(g);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { g, cuerpo, patas, cola, cab, fase: 0 };
}

/* =========================================================================
   Herramientas
   ========================================================================= */
const HERRAMIENTAS = {
  llave: { nombre: 'la llave inglesa', corto: 'Llave inglesa', icono: '🔧' },
  destornillador: { nombre: 'el destornillador', corto: 'Destornillador', icono: '🪛' },
  brocha: { nombre: 'la brocha', corto: 'Brocha y pintura', icono: '🖌️' },
  martillo: { nombre: 'el martillo', corto: 'Martillo', icono: '🔨' },
  bombilla: { nombre: 'la bombilla nueva', corto: 'Bombilla nueva', icono: '💡' },
  desatascador: { nombre: 'el desatascador', corto: 'Desatascador', icono: '🪠' },
};
const ORDEN_HERR = ['llave', 'destornillador', 'brocha', 'martillo', 'bombilla', 'desatascador'];

function crearHerramienta(id) {
  const g = new THREE.Group();
  const gris = 0x9aa3ab, madera = 0xa86b35;
  switch (id) {
    case 'llave':
      caja(0.06, 0.4, 0.03, gris, 0, 0.2, 0, g);
      caja(0.16, 0.06, 0.04, gris, 0.03, 0.42, 0, g); caja(0.04, 0.1, 0.04, gris, 0.09, 0.48, 0, g); caja(0.04, 0.1, 0.04, gris, -0.04, 0.48, 0, g);
      break;
    case 'destornillador':
      cilindro(0.04, 0.035, 0.18, 0xffc21a, 0, 0.09, 0, g, 8);
      cilindro(0.012, 0.012, 0.24, gris, 0, 0.3, 0, g, 6);
      break;
    case 'brocha':
      cilindro(0.025, 0.025, 0.25, madera, 0, 0.12, 0, g, 6);
      caja(0.12, 0.05, 0.05, gris, 0, 0.27, 0, g);
      caja(0.11, 0.12, 0.04, 0xf2a33a, 0, 0.35, 0, g);
      break;
    case 'martillo':
      cilindro(0.025, 0.03, 0.36, madera, 0, 0.18, 0, g, 6);
      caja(0.22, 0.07, 0.07, 0x555b61, 0, 0.38, 0, g);
      break;
    case 'bombilla':
      cilindro(0.04, 0.04, 0.07, gris, 0, 0.035, 0, g, 8);
      { const b = esfera(0.08, 0xfff7c2, 0, 0.14, 0, g, 10); b.material = new THREE.MeshLambertMaterial({ color: 0xfff7c2, emissive: 0x5a5020 }); }
      break;
    case 'desatascador':
      cilindro(0.022, 0.022, 0.42, madera, 0, 0.27, 0, g, 6);
      { const v = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc0262b)); v.rotation.x = Math.PI; v.position.y = 0.08; g.add(v); }
      break;
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}
// Herramientas en la mesa
const ranuras = ORDEN_HERR.map((id, i) => {
  const x = 0.9 + i * 0.8, z = 8.0;
  const m = crearHerramienta(id);
  m.rotation.z = Math.PI / 2; m.rotation.y = 0.3;
  m.scale.setScalar(1.7);
  m.position.set(x + 0.3, 0.96, z - 0.1);
  scene.add(m);
  return { id, x, z: 7.15, malla: m, base: m.position.clone() };
});

/* =========================================================================
   Partículas
   ========================================================================= */
const particulas = [];
const geoPart = new THREE.SphereGeometry(1, 6, 4);
const geoCubo = new THREE.BoxGeometry(1, 1, 1);
const matPart = new Map();
function matP(c, brilla = false) {
  const k = c + (brilla ? 'b' : '');
  if (!matPart.has(k)) matPart.set(k, brilla ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshLambertMaterial({ color: c }));
  return matPart.get(k);
}
function emitir(x, y, z, n, o = {}) {
  for (let i = 0; i < n; i++) {
    if (particulas.length > 450) particulas.shift().m.removeFromParent();
    const color = Array.isArray(o.color) ? pick(o.color) : (o.color ?? 0xffffff);
    const m = new THREE.Mesh(o.cubo ? geoCubo : geoPart, matP(color, o.brilla));
    const tam = (o.tam ?? 0.06) * rand(0.6, 1.3);
    m.scale.setScalar(tam);
    m.position.set(x + rand(-1, 1) * (o.disp ?? 0.1), y, z + rand(-1, 1) * (o.disp ?? 0.1));
    scene.add(m);
    const v = o.vel ?? 2, sube = o.sube ?? 2;
    const a = rand(0, Math.PI * 2);
    particulas.push({
      m, tam,
      vx: Math.cos(a) * rand(0, v) + (o.vx ?? 0), vy: rand(sube * 0.5, sube), vz: Math.sin(a) * rand(0, v) + (o.vz ?? 0),
      g: o.gravedad ?? 9, vida: (o.vida ?? 1) * rand(0.7, 1.2), vidaMax: o.vida ?? 1, crece: o.crece ?? 0, gira: o.gira ?? 0,
    });
  }
}
function actualizarParticulas(dt) {
  for (let i = particulas.length - 1; i >= 0; i--) {
    const p = particulas[i];
    p.vida -= dt;
    p.vy -= p.g * dt;
    p.m.position.x += p.vx * dt; p.m.position.y += p.vy * dt; p.m.position.z += p.vz * dt;
    if (p.gira) p.m.rotation.y += p.gira * dt;
    if (p.m.position.y < 0.02) { p.m.position.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
    const k = clamp(p.vida / p.vidaMax, 0, 1);
    p.m.scale.setScalar(Math.max(0.001, p.tam * (p.crece ? (1 + (1 - k) * p.crece) * k : Math.min(1, k * 2))));
    if (p.vida <= 0) { p.m.removeFromParent(); particulas.splice(i, 1); }
  }
}
const estrellitas = (x, y, z) => emitir(x, y, z, 14, { color: [0xffd23f, 0xffffff, 0xfff08f], brilla: true, vel: 2.5, sube: 4, gravedad: 6, tam: 0.07, vida: 0.9, cubo: true, gira: 8 });

/* =========================================================================
   Peligros: charcos y cáscaras de plátano
   ========================================================================= */
const peligros = [];
function crearCharco(x, z, r = 1.0, color = 0x5fb6e6) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.75 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.025, z);
  m.scale.setScalar(0.1);
  scene.add(m);
  peligros.push({ tipo: 'charco', x, z, r, m, vida: 28, crece: 0 });
}
function crearPlatano(x, z) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 10, Math.PI * 1.1), mat(0xf3d23a));
  m.rotation.x = -Math.PI / 2; m.rotation.z = rand(0, 6);
  m.position.set(x, 0.05, z);
  m.castShadow = true;
  scene.add(m);
  peligros.push({ tipo: 'platano', x, z, r: 0.3, m, vida: 60 });
}
function limpiarPeligros() { peligros.forEach(p => p.m.removeFromParent()); peligros.length = 0; }

/* =========================================================================
   Encargos (los «trabajos») y sus objetos en el piso
   ========================================================================= */
const ENCARGOS = {
  grifo: { nombre: 'Grifo que gotea', herr: 'llave', sitio: 'Cocina', icono: '🚰', pie: [8.5, 0.05] },
  enchufe: { nombre: 'Enchufe que echa chispas', herr: 'destornillador', sitio: 'Cocina', icono: '🔌', pie: [10.1, 3.0] },
  pared: { nombre: 'Pintar la pared del salón', herr: 'brocha', sitio: 'Salón', icono: '🎨', pie: [-10.05, 1.5] },
  cuadro: { nombre: 'Colgar el cuadro de la abuela', herr: 'martillo', sitio: 'Dormitorio', icono: '🖼️', pie: [-7, -7.05] },
  bombilla: { nombre: 'Cambiar la bombilla', herr: 'bombilla', sitio: 'Salón', icono: '💡', pie: [-6.3, 3.45] },
  vater: { nombre: 'Váter atascado', herr: 'desatascador', sitio: 'Baño', icono: '🚽', pie: [9.6, -6.35] },
};
const TIPOS = Object.keys(ENCARGOS);
const DESPERFECTOS = {
  grifo: 'Géiser decorativo en la cocina',
  enchufe: 'Apagón general + cejas chamuscadas',
  pared: 'Pared en color «chillón de feria»',
  cuadro: 'Cuadro de la abuela en el suelo (otra vez)',
  bombilla: 'Bombilla reventada y salón a oscuras',
  vater: 'Inundación aromática del baño',
};

// --- Grifo ---
const grifo = new THREE.Group(); grifo.position.set(8.5, 0.96, -1.2); scene.add(grifo);
caja(0.8, 0.05, 0.5, 0x6b6b6b, 0, -0.01, 0.1, grifo, false); // pila
cilindro(0.04, 0.04, 0.35, 0xc9ced3, 0, 0.17, -0.1, grifo, 8);
caja(0.05, 0.05, 0.25, 0xc9ced3, 0, 0.33, 0.02, grifo);
caja(0.12, 0.05, 0.05, 0xd8382c, -0.1, 0.25, -0.1, grifo); caja(0.12, 0.05, 0.05, 0x2f5fa8, 0.1, 0.25, -0.1, grifo);
// --- Enchufe ---
const enchufe = caja(0.05, 0.22, 0.22, 0xffffff, 10.86, 0.5, 3.0);
const quemadura = new THREE.Mesh(new THREE.CircleGeometry(0.45, 14), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.8 }));
quemadura.rotation.y = -Math.PI / 2; quemadura.position.set(10.885, 0.55, 3.0); quemadura.visible = false; scene.add(quemadura);
// Tostadora al lado (víctima potencial)
caja(0.3, 0.22, 0.2, 0xc9ced3, 10.4, 1.07, -1.0); caja(0.2, 0.04, 0.03, 0x333333, 10.4, 1.19, -1.0);
// --- Pared del salón ---
const texDesconchada = texLienzo(256, 192, (g, w, h) => {
  g.fillStyle = '#e8d8b6'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(${120 + Math.random() * 40},${100 + Math.random() * 30},80,.45)`;
    g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, rand(6, 28), rand(4, 18), rand(0, 3), 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(90,60,40,.6)'; g.lineWidth = 2;
  for (let i = 0; i < 5; i++) { g.beginPath(); let x = rand(0, w), y = rand(0, h); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += rand(-25, 25); y += rand(5, 25); g.lineTo(x, y); } g.stroke(); }
});
const colorChillon = () => pick(['#ff2fd1', '#39ff14', '#ff6a00', '#00e5ff', '#fff200']);
const texChillona = () => texLienzo(256, 192, (g, w, h) => {
  g.fillStyle = colorChillon(); g.fillRect(0, 0, w, h);
  for (let i = 0; i < 18; i++) { g.fillStyle = colorChillon(); g.beginPath(); g.arc(Math.random() * w, Math.random() * h, rand(8, 30), 0, 7); g.fill(); }
  g.fillStyle = '#2a1e12'; g.font = '900 34px Nunito, Arial'; g.textAlign = 'center'; g.fillText('¿moderno?', w / 2, h - 20);
});
const COLORES_BONITOS = ['#f6c89f', '#cfe8c8', '#c9dcf2', '#f2d0dd', '#fbe7a1'];
const muroPared = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.1), new THREE.MeshLambertMaterial({ color: COL_PARED }));
muroPared.rotation.y = Math.PI / 2; muroPared.position.set(-10.885, 1.2, 1.5); muroPared.receiveShadow = true; scene.add(muroPared);
const botePintura = cilindro(0.18, 0.18, 0.3, 0xf2a33a, -10.4, 0.15, 0.4);
// --- Cuadro de la abuela ---
const cuadro = new THREE.Group(); scene.add(cuadro);
caja(1.0, 1.2, 0.06, 0xb07a2a, 0, 0, 0, cuadro);
{
  const lienzo = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.02), new THREE.MeshLambertMaterial({
    map: texLienzo(128, 160, (g, w, h) => {
      g.fillStyle = '#c9b48a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#7a7a7a'; g.beginPath(); g.ellipse(64, 60, 30, 34, 0, 0, 7); g.fill();
      g.fillStyle = '#f1c7a0'; g.beginPath(); g.ellipse(64, 72, 24, 28, 0, 0, 7); g.fill();
      g.fillStyle = '#222'; g.fillRect(52, 66, 6, 4); g.fillRect(70, 66, 6, 4);
      g.strokeStyle = '#7a2b22'; g.lineWidth = 2; g.beginPath(); g.arc(64, 84, 8, 0.2, Math.PI - 0.2); g.stroke();
      g.fillStyle = '#3a3a3a'; g.fillRect(28, 104, 72, 56);
      g.fillStyle = '#2a1e12'; g.font = 'italic 900 13px Georgia'; g.textAlign = 'center'; g.fillText('La abuela, 1953', 64, 150);
    }),
  }));
  lienzo.position.z = 0.035; cuadro.add(lienzo);
}
const clavo = caja(0.04, 0.04, 0.1, 0x777777, -7, 1.95, -7.85);
const POS_CUADRO_COLGADO = { p: new THREE.Vector3(-7, 1.5, -7.85), r: new THREE.Euler(0, 0, 0) };
const POS_CUADRO_SUELO = { p: new THREE.Vector3(-7.4, 0.62, -7.6), r: new THREE.Euler(-0.28, 0, 0.05) };
// --- Lámpara de pie y bombilla ---
const lampara = new THREE.Group(); lampara.position.set(-6.3, 0, 4.3); scene.add(lampara);
cilindro(0.25, 0.3, 0.06, 0x5a3a1c, 0, 0.03, 0, lampara);
cilindro(0.03, 0.03, 1.6, 0x5a3a1c, 0, 0.83, 0, lampara, 6);
const pantallaLamp = cilindro(0.2, 0.38, 0.4, 0xf3e0a8, 0, 1.75, 0, lampara, 14);
pantallaLamp.material = new THREE.MeshLambertMaterial({ color: 0xf3e0a8, side: THREE.DoubleSide, emissive: 0x000000 });
const bulbo = esfera(0.09, 0xffffff, 0, 1.62, 0, lampara, 10);
bulbo.material = new THREE.MeshBasicMaterial({ color: 0xfff5c0 });
const luzLampara = new THREE.PointLight(0xffd98a, 6, 7, 1.6);
luzLampara.position.set(-6.3, 1.6, 4.3); scene.add(luzLampara);
addCol(-6.55, -6.05, 4.05, 4.55);
// --- Váter ---
const vater = new THREE.Group(); vater.position.set(9.6, 0, -7.45); scene.add(vater);
cilindro(0.17, 0.2, 0.4, 0xffffff, 0, 0.2, 0.05, vater);
const taza = cilindro(0.28, 0.2, 0.15, 0xffffff, 0, 0.45, 0.1, vater, 14);
caja(0.5, 0.45, 0.2, 0xffffff, 0, 0.75, -0.25, vater);
const aguaVater = cilindro(0.22, 0.22, 0.02, 0x8fc3d9, 0, 0.52, 0.1, vater, 14);
const tapa = caja(0.52, 0.04, 0.5, 0xf2f2f2, 0, 0.55, 0.12, vater);
const rollo = cilindro(0.08, 0.08, 0.1, 0xffffff, 0.55, 0.65, 0.2, vater, 10); rollo.rotation.z = Math.PI / 2;
addCol(9.25, 9.95, -7.9, -7.05);

// Estado visual de cada sitio: 'ok' | 'roto' | 'chapuza'
const Visual = {
  estado: {}, t: {},
  poner(tipo, est) {
    this.estado[tipo] = est; this.t[tipo] = 0;
    switch (tipo) {
      case 'enchufe': quemadura.visible = est === 'chapuza'; break;
      case 'pared':
        if (est === 'roto') { muroPared.material.map = texDesconchada; muroPared.material.color.set(0xffffff); }
        else if (est === 'chapuza') { muroPared.material.map = texChillona(); muroPared.material.color.set(0xffffff); }
        else { muroPared.material.map = null; muroPared.material.color.set(this._yaPintada ? pick(COLORES_BONITOS) : COL_PARED); }
        muroPared.material.needsUpdate = true;
        break;
      case 'cuadro':
        this.caida = 0;
        if (est === 'roto') { cuadro.position.copy(POS_CUADRO_SUELO.p); cuadro.rotation.copy(POS_CUADRO_SUELO.r); }
        else if (est === 'chapuza') { cuadro.position.copy(POS_CUADRO_COLGADO.p); cuadro.rotation.set(0, 0, 0.7); this.caida = 0.01; }
        else { cuadro.position.copy(POS_CUADRO_COLGADO.p); cuadro.rotation.set(0, 0, 0); }
        break;
      case 'bombilla':
        bulbo.material.color.set(est === 'ok' ? 0xfff5c0 : est === 'chapuza' ? 0x222222 : 0x8a8a7a);
        luzLampara.intensity = est === 'ok' ? 6 : 0;
        break;
      case 'vater':
        aguaVater.material = mat(est === 'ok' ? 0x8fc3d9 : est === 'chapuza' ? 0x6b7a2a : 0x8a7a4a);
        tapa.rotation.x = 0; tapa.position.set(0, 0.55, 0.12);
        break;
    }
  },
  actualizar(dt) {
    for (const tipo of TIPOS) {
      const est = this.estado[tipo];
      this.t[tipo] = (this.t[tipo] || 0) + dt;
      const t = this.t[tipo];
      if (tipo === 'grifo' && est === 'roto' && Math.random() < dt * 2.5)
        emitir(8.5, 1.25, -1.0, 1, { color: 0x5fb6e6, vel: 0, sube: 0.1, gravedad: 9, tam: 0.04, vida: 0.5, brilla: true });
      if (tipo === 'grifo' && est === 'chapuza' && t < 3)
        emitir(8.5, 1.3, -1.05, 4, { color: [0x5fb6e6, 0xbfe8ff, 0xffffff], vel: 1.4, sube: 7, gravedad: 9, tam: 0.07, vida: 1.2, brilla: true });
      if (tipo === 'enchufe' && est === 'roto' && Math.random() < dt * 1.8)
        emitir(10.8, 0.5, 3.0, 5, { color: [0xffd23f, 0xffffff], brilla: true, vel: 1.2, sube: 1.5, tam: 0.03, vida: 0.35, vx: -1 });
      if (tipo === 'enchufe' && est === 'chapuza' && t < 4 && Math.random() < dt * 4)
        emitir(10.7, 0.6, 3.0, 2, { color: [0x555555, 0x333333], vel: 0.3, sube: 1.2, gravedad: -0.6, tam: 0.12, vida: 1.6, crece: 2 });
      if (tipo === 'bombilla' && est === 'roto') {
        const parpadeo = Math.sin(t * 23) > 0.6 && Math.random() < 0.5;
        luzLampara.intensity = parpadeo ? 3 : 0;
        bulbo.material.color.set(parpadeo ? 0xfff5c0 : 0x8a8a7a);
      }
      if (tipo === 'vater' && est === 'roto') {
        if (Math.random() < dt * 3) emitir(9.6, 0.55, -7.35, 1, { color: 0x9a8a5a, vel: 0.1, sube: 0.8, gravedad: 0.5, tam: 0.05, vida: 0.8 });
        // moscas en círculo
        if (Math.random() < dt * 2) emitir(9.6 + rand(-0.3, 0.3), 1.0, -7.3, 1, { color: 0x111111, brilla: true, vel: 1.5, sube: 0.6, gravedad: 0, tam: 0.025, vida: 1.2 });
        tapa.rotation.x = Math.sin(t * 9) * 0.06 - 0.03;
      }
      if (tipo === 'vater' && est === 'chapuza' && t < 4 && Math.random() < dt * 6)
        emitir(9.6, 0.8, -7.3, 2, { color: [0x9acd32, 0x7bb026, 0xb8e05a], vel: 0.6, sube: 1.4, gravedad: -0.4, tam: 0.16, vida: 2, crece: 2.5 });
      if (tipo === 'cuadro' && est === 'chapuza' && this.caida > 0) {
        this.caida += dt;
        if (this.caida > 1.6) {
          const k = clamp((this.caida - 1.6) / 0.45, 0, 1);
          cuadro.position.lerpVectors(POS_CUADRO_COLGADO.p, POS_CUADRO_SUELO.p, k);
          cuadro.rotation.z = lerp(0.7, 1.4, k); cuadro.rotation.x = lerp(0, -0.3, k);
          if (k >= 1) { this.caida = 0; Sonido.crash(); emitir(-7.3, 0.4, -7.5, 18, { color: [0xb07a2a, 0xc9b48a], cubo: true, vel: 2, sube: 3, tam: 0.06, vida: 1 }); G.temblor = 0.25; }
        }
      }
    }
  },
};

/* =========================================================================
   Navegación sencilla por habitaciones
   ========================================================================= */
const CENTROS = { calle: [-2, 7.5], salon: [-5.5, 1.75], cocina: [5.5, 1.75], dorm: [-5.5, -4.75], bano: [5.5, -4.75] };
const PUERTAS = [
  { a: 'calle', b: 'salon', x: -2, z: 5, eje: 'z' },
  { a: 'salon', b: 'cocina', x: 0, z: 2, eje: 'x' },
  { a: 'salon', b: 'dorm', x: -5, z: -1.5, eje: 'z' },
  { a: 'cocina', b: 'bano', x: 5, z: -1.5, eje: 'z' },
  { a: 'dorm', b: 'bano', x: 0, z: -4.5, eje: 'x' },
];
function zona(x, z) {
  if (z > 5) return 'calle';
  if (z > -1.5) return x < 0 ? 'salon' : 'cocina';
  return x < 0 ? 'dorm' : 'bano';
}
function calcularRuta(x0, z0, x1, z1) {
  const za = zona(x0, z0), zb = zona(x1, z1);
  if (za === zb) return [[x1, z1]];
  const prev = { [za]: null }, cola = [za];
  while (cola.length) {
    const z = cola.shift();
    if (z === zb) break;
    for (const p of PUERTAS) {
      const otra = p.a === z ? p.b : p.b === z ? p.a : null;
      if (otra && !(otra in prev)) { prev[otra] = { desde: z, puerta: p }; cola.push(otra); }
    }
  }
  const pasos = [];
  let z = zb;
  while (prev[z]) { pasos.unshift({ de: prev[z].desde, a: z, p: prev[z].puerta }); z = prev[z].desde; }
  const ruta = [];
  for (const { de, a, p } of pasos) {
    const k = p.eje === 'x' ? 0 : 1;
    const ladoDe = Math.sign(CENTROS[de][k] - (k ? p.z : p.x));
    const ladoA = Math.sign(CENTROS[a][k] - (k ? p.z : p.x));
    ruta.push(k === 0 ? [p.x + ladoDe * 0.7, p.z] : [p.x, p.z + ladoDe * 0.7]);
    ruta.push(k === 0 ? [p.x + ladoA * 0.7, p.z] : [p.x, p.z + ladoA * 0.7]);
  }
  ruta.push([x1, z1]);
  return ruta;
}
function irA(e, x, z) { e.ruta = calcularRuta(e.c.g.position.x, e.c.g.position.z, x, z); }
// Devuelve true al llegar
function caminar(e, dt, vel) {
  const p = e.c.g.position;
  if (!e.ruta || !e.ruta.length) { e.vel = 0; return true; }
  const [tx, tz] = e.ruta[0];
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.12) { e.ruta.shift(); if (!e.ruta.length) { e.vel = 0; return true; } return false; }
  const paso = Math.min(vel * dt, d);
  p.x += dx / d * paso; p.z += dz / d * paso;
  e.c.g.rotation.y = angLerp(e.c.g.rotation.y, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
  e.vel = vel;
  return false;
}
const PUNTOS_PASEO = [[-5, 2.5], [-3, 0.5], [-8, 2], [3, 1], [6, 0.8], [8, 3.5], [-5, -3.5], [-7, -5], [-4.5, -6], [4, -4], [6.5, -5], [8, -3.5], [-1, 7], [7, 7]];

/* =========================================================================
   Diálogos (el alma del juego)
   ========================================================================= */
const FRASES = {
  remediosNuevo: {
    grifo: ['¡Paco! ¡El grifo de la cocina gotea! ¡Plic, plic, plic, toda la noche!', '¡Que el grifo hace plic-plic! ¡Me va a volver loca!', '¡El grifo! ¡Que me sale más agua por fuera que por dentro!'],
    enchufe: ['¡El enchufe de la cocina echa chispas! ¡Y he enchufado la tostadora!', 'Paco, el enchufe hace «bzzzz». ¿Eso es normal?', '¡El enchufe huele a chamusquina! ¡Como la paella de mi cuñada!'],
    pared: ['¡Quiero la pared del salón en color «melocotón del Mediterráneo»!', '¡Esa pared está más desconchada que el portal de mi hermana!', '¡Píntenme la pared, que viene la del tercero a cotillear!'],
    cuadro: ['¡Se ha caído el cuadro de la abuela! ¡Cuélguenlo, que me mira mal desde el suelo!', '¡El cuadro de mi madre! ¡En el suelo! ¡Qué disgusto!', '¡Cuelguen el cuadro, que viene mi hermana el domingo!'],
    bombilla: ['¡Se ha fundido la bombilla del salón! ¡No veo ni la tele!', '¡La lámpara! ¡Que hace como en las películas de miedo!', '¡Paco, la bombilla! ¡Que me como el mueble a oscuras!'],
    vater: ['¡El váter! ¡EL VÁTER! ¡No pregunten y vengan!', 'Paco, el váter hace «glu-glu». Y no debería hacer «glu-glu».', '¡El váter se ha atascado! ¡Y tengo visita a las cinco!'],
  },
  remediosFino: ['¡Anda! Si hasta ha quedado bien.', '¡Qué manos tiene usted, Paco! Ni mi difunto, que en paz descanse.', 'Bueno... no está mal. Pero no se lo digan a nadie.', '¡Esto lo cuento en la peluquería!'],
  remediosBien: ['Pse. Pasable.', 'Ha quedado... apañao.', 'Bueno, mientras funcione...', 'Yo lo habría hecho mejor, pero vale.'],
  remediosChapuza: ['¡¿PERO QUÉ HA HECHO?!', '¡Esto lo pago yo de mi pensión!', '¡Ay, mi casa! ¡Ay, mi casita!', '¡Llamo a los de consumo! ¡Ahora mismo llamo!', '¡Mi hermana tenía razón con ustedes!', '¡Esto no lo arregla ni el Papa!'],
  remediosExpira: ['¡Pues ya lo arreglará mi sobrino, que hace un curso por internet!', '¡Me harto! ¡Eso se queda así y punto!', '¡Llevo media hora esperando! ¡Ni que fueran del Ayuntamiento!', '¡Esto lo arreglo yo con una horquilla!'],
  remediosCharla: ['¿Quieren un cafelito? Bueno, no, que luego se entretienen.', 'Mi sobrino dice que esto lo arregla él con un vídeo de internet.', 'No pisen la alfombra, que es persa. De los chinos, pero persa.', '¿Y ustedes tienen seguro? Lo digo por nada.', 'Paco, ¿usted no salía con la del quinto?', '¿Ese señor gordito trabaja con usted o se ha colado?', 'En mis tiempos los fontaneros venían con corbata.'],
  remediosIdle: ['¡Michi! ¡Deja a los señores!', 'Ay, qué cruz, Señor, qué cruz...', 'Esto en mis tiempos se hacía en un periquete.', 'Ya verás cuando se entere mi hermana...', '¿Y eso del suelo quién lo va a limpiar?'],
  remediosResbalon: ['¡Ay, que se mata! ¡Y en mi casa!', '¡Si se rompe algo no me denuncie, eh!', '¡Cuidado con mi suelo, que está recién fregao!'],
  ramonAlmuerzo: ['Primero el almuerzo, que sin gasolina el motor no arranca.', 'Un bocata de chorizo y estoy contigo, Paco.', '¿Tú sabes lo que es trabajar con el estómago vacío? Yo tampoco, ni pienso averiguarlo.', 'Es mi descanso sindical, Paco.'],
  ramonSiesta: ['Me echo cinco minutillos... para pensar la estrategia.', 'No estoy durmiendo. Estoy midiendo el techo con los ojos cerrados.', 'Zzz... ¡Ya voy, ya voy!... Zzz...'],
  ramonPasea: ['Voy a hacer un estudio de la situación.', 'Aquí lo que hace falta es una reforma integral, Paco.', '¿Esta pared es de carga? Yo creo que es de carga.', 'Esto con pladur quedaba precioso.', 'Hmmm. Hmmmm. Sí. Hmmm.'],
  ramonPlatano: ['Uy, la cáscara. Bueno, ya la recojo luego.', 'Vitaminas, Paco. Potasio. Lo dicen los médicos.', 'La dejo aquí, que así sé dónde está.'],
  ramonAyuda: ['¡Quita, quita, que esto lo hago yo en un pispás!', 'Déjamelo a mí, que tengo un primo que es fontanero.', 'Esto lo vi en un tutorial. Bueno, el principio.'],
  ramonBien: ['¿Has visto, Paco? ¡Ni yo me lo creo!', '¡Toma! ¡Aprende, aprende!', '¡Manos de seda, Paco! ¡De seda!'],
  ramonChapuza: ['Esto ya venía así de fábrica.', 'Ha sido culpa del de antes, que lo dejó fatal.', 'Ups. Bueno, así tiene más personalidad.', '¡Yo no he tocado nada! Bueno, un poquito.'],
  ramonOrden: ['¡Voy, voy! Qué estrés, Paco, qué estrés.', 'Que síííí, que ya voy. Siempre igual.', '¿Yo? Bueno, vale, pero luego me invitas a un café.', '¡A sus órdenes, mi general!'],
  ramonOrdenSin: ['No hay nada que hacer, jefe. Me vuelvo a mi bocata.', 'Todo arreglado. Bueno, todo «arreglado».', 'Si no hay faena, no hay Ramón.'],
  ramonTarde: ['Anda, ya está hecho. Pues nada, me vuelvo.', 'Llego tarde por los pelos. Qué pena, oye.'],
  ramonApagon: ['¿Quién ha apagado la luz? ¡Yo no he sido, eh!', '¡Paco! ¡No veo! Bueno, nunca veo, pero ahora menos.'],
  ramonBocata: ['Ñam. ¿Era tuyo, Paco?', 'Estaba aquí solo, abandonado... Lo he adoptado.', '¡Calamares! ¡Esto es una señal divina!'],
  pacoChapuza: ['Esto ya estaba así cuando llegamos.', 'Es un estilo nuevo. Se lleva mucho en Milán.', 'Tranquila, señora, que esto con cinta americana queda como nuevo.', '¡Ha sido el gato!', 'Técnicamente... funciona. A su manera.'],
  pacoFino: ['¡Lo que yo te diga, Ramón: manos de cirujano!', '¡Trabajo fino, señora!', '¡Y sin cinta americana!'],
  pacoResbalon: ['¡Uuuuuy!', '¡Mi madre!', '¡Ramóóóóón!', '¡Mis lumbares!', '¡¿Quién ha dejado esto aquí?!'],
  pacoMalaHerr: ['¿Con {h}? Bueno... por probar...', 'Con {h} también se puede. Creo.', 'Un buen profesional lo arregla con lo que sea. Incluso con {h}.'],
  pacoSinHerr: ['Necesito {h}. Está en la mesa, junto a la furgoneta.', 'Sin {h} no hay manera. ¡A la furgoneta!'],
  pacoGato: ['¡Michi, quita de en medio!', '¡Este gato me quiere matar!', '¡Gato del demonio!'],
  michi: ['¡MIAAAAU!', 'Miau. (Te juzga en silencio)', 'Prrrrr...', '¡FFFFSSSS!'],
};
const frase = (lista, h) => pick(lista).replace('{h}', h || '');

/* Globos de texto encima de los personajes */
const capaGlobos = $('bocadillos');
const vTmp = new THREE.Vector3();
function decir(e, texto, dur = 3.2) {
  if (!e.globo) {
    e.globo = document.createElement('div');
    e.globo.className = `globo ${e.clase}`;
    capaGlobos.appendChild(e.globo);
  }
  e.globo.innerHTML = `<b>${e.nombre}</b>${texto}`;
  e.globo.style.display = 'block';
  e.globoT = dur;
  Sonido.voz(e.voz, clamp(Math.round(texto.length / 7), 2, 8));
}
function actualizarGlobos(dt) {
  const w = window.innerWidth, h = window.innerHeight;
  for (const e of entidades) {
    if (!e.globo) continue;
    if (e.globoT > 0) {
      e.globoT -= dt;
      vTmp.set(e.c.g.position.x, e.c.g.position.y + e.alturaGlobo, e.c.g.position.z).project(camera);
      if (vTmp.z > 1) { e.globo.style.display = 'none'; continue; }
      const x = clamp((vTmp.x + 1) / 2 * w, 90, w - 90), y = clamp((1 - vTmp.y) / 2 * h, 70, h);
      e.globo.style.left = x + 'px'; e.globo.style.top = y + 'px';
      e.globo.style.display = 'block';
      e.globo.style.opacity = clamp(e.globoT * 3, 0, 1);
    } else e.globo.style.display = 'none';
  }
}

/* =========================================================================
   Entidades
   ========================================================================= */
const paco = {
  nombre: 'Paco', clase: 'paco', voz: 330, alturaGlobo: 2.35,
  c: crearPersonaje({ cuerpo: 0x2f5fa8, piernas: 'mono', gorra: 0xd8382c, bolsillo: 0xf2a33a, zapatos: 0x3b2a1c }),
  estado: 'normal', t: 0, vel: 0, vx: 0, vz: 0, herr: null, mallaHerr: null, tinte: 0, boost: 0,
};
const ramon = {
  nombre: 'Ramón', clase: 'ramon', voz: 190, alturaGlobo: 2.45,
  c: crearPersonaje({ cuerpo: 0xe0782a, piernas: 'mono', ancho: 1.3, barriga: true, bigote: true, calvo: true, zapatos: 0x2a1a10 }),
  estado: 'idle', t: 0, vel: 0, ruta: null, encargo: null,
};
const remedios = {
  nombre: 'Doña Remedios', clase: 'remedios', voz: 520, alturaGlobo: 2.2,
  c: crearPersonaje({ cuerpo: 0xd9709d, piernas: 0xf1c7a0, rulos: true, escala: 0.92, zapatos: 0xff9ec4, mangas: mat(0xd9709d) }),
  estado: 'idle', t: 0, vel: 0, ruta: null, charlaT: 8,
};
// Bata de flores
{
  const tf = texLienzo(64, 64, (g) => {
    g.fillStyle = '#d9709d'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 6; i++) { const x = rand(6, 58), y = rand(6, 58); g.fillStyle = '#fff3a0'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 4, y + Math.sin(k * 1.26) * 4, 3, 0, 7); g.fill(); } g.fillStyle = '#e8573a'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
  }, [2, 2]);
  remedios.c.matCuerpo.map = tf; remedios.c.matCuerpo.color.set(0xffffff); remedios.c.colorCuerpo.set(0xffffff); remedios.c.matCuerpo.needsUpdate = true;
}
const michi = { nombre: 'Michi', clase: 'michi', voz: 900, alturaGlobo: 0.9, c: crearGato(), estado: 'idle', t: 0, vel: 0, ruta: null, cdTropiezo: 0 };
const entidades = [paco, ramon, remedios, michi];

// Bocadillo de ramón en la mano (sólo visible al almorzar)
const bocataRamon = new THREE.Group();
{ const pan = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.25, 4, 8), mat(0xd9a45a)); pan.rotation.z = Math.PI / 2; bocataRamon.add(pan); }
bocataRamon.position.set(0, 0, 0.1); bocataRamon.visible = false; ramon.c.mano.add(bocataRamon);

// Bocata de calamares (power-up)
const bocata = new THREE.Group();
{
  const pan = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.38, 4, 10), mat(0xd9a45a)); pan.rotation.z = Math.PI / 2; pan.castShadow = true; bocata.add(pan);
  for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.022, 5, 10), mat(0xf6e7b0)); a.position.set(-0.15 + i * 0.1, 0.06, 0.06); bocata.add(a); }
}
bocata.visible = false; scene.add(bocata);
const PUNTOS_BOCATA = [[-3.5, 7.8], [6, 6.6], [-8, 2.6], [3.5, 0.6], [-5, -4], [4, -4.5], [8.5, 6.8], [-2.5, 2.5]];

/* =========================================================================
   Estado de la partida
   ========================================================================= */
const DURACION = 240; // segundos reales = 9:00 a 18:00
const G = {
  jugando: false, pausa: false, fin: false, t: 0, dinero: 0, paciencia: 100,
  encargos: {}, spawnT: 0, mini: null, apagon: 0, temblor: 0, cola: [], bocataT: 20,
  stats: null, accion: false,
};
function nuevasStats() {
  return { fino: 0, bien: 0, chapuza: 0, expirado: 0, ramonBien: 0, ramonChapuza: 0, bocatasRamon: 0, resbalones: 0, desperfectos: [], bocatasPaco: 0 };
}
const luego = (seg, fn) => G.cola.push({ t: G.t + seg, fn });
const progreso = () => clamp(G.t / DURACION, 0, 1);

function reiniciar() {
  G.t = 0; G.dinero = 0; G.paciencia = 100; G.spawnT = 3.5; G.mini = null; G.apagon = 0; G.temblor = 0; G.cola = []; G.fin = false; G.pausa = false;
  G.bocataT = 25; bocata.visible = false;
  G.stats = nuevasStats();
  TIPOS.forEach(t => { G.encargos[t] = { activo: false, t: 0, max: 0, ramon: false, cd: 0 }; Visual._yaPintada = false; Visual.poner(t, 'ok'); });
  limpiarPeligros();
  particulas.forEach(p => p.m.removeFromParent()); particulas.length = 0;
  paco.c.brazos[0].rotation.z = 0;
  paco.c.g.position.set(-1, 0, 7.6); paco.c.g.rotation.y = Math.PI; paco.estado = 'normal'; paco.vx = paco.vz = 0; paco.tinte = 0; paco.boost = 0;
  soltarHerramienta();
  restaurarTinte(paco);
  ramon.c.g.position.set(-3.6, 0, 7.2); ramon.estado = 'idle'; ramon.t = 4; ramon.ruta = null; ramon.encargo = null; bocataRamon.visible = false; ramon.c.cuerpo.rotation.set(0, 0, 0); ramon.c.cuerpo.position.set(0, 0, 0); ramon.dormido = ramon.sentado = false; ramon.trabajaT = 0; restaurarTinte(ramon);
  remedios.c.g.position.set(-3.5, 0, 3); remedios.c.g.rotation.y = 0; remedios.estado = 'idle'; remedios.ruta = null; remedios.charlaT = 10;
  michi.c.g.position.set(-7, 0, -4); michi.ruta = null; michi.t = 2;
  entidades.forEach(e => { e.globoT = 0; if (e.globo) e.globo.style.display = 'none'; });
  $('mini').classList.add('oculto');
  $('lista-encargos').innerHTML = ''; firmaLista = '';
}

/* =========================================================================
   Entrada: teclado y táctil
   ========================================================================= */
const teclas = new Set();
const joy = { x: 0, z: 0, activo: false };
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  if (e.repeat) { teclas.add(k); return; }
  teclas.add(k);
  if (!G.jugando) return;
  if (k === 'e' || k === ' ' || k === 'enter') G.accion = true;
  if (k === 'p' || k === 'escape') alternarPausa();
  if (k === 'm') alternarSonido();
});
window.addEventListener('keyup', e => teclas.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { teclas.clear(); if (G.jugando && !G.pausa && !G.fin) alternarPausa(); });

const esTactil = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
{
  const zona = $('joy'), bola = zona.querySelector('i');
  let id = null;
  const mover = ev => {
    const r = zona.getBoundingClientRect();
    let dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy), max = r.width / 2 - 10;
    if (d > max) { dx *= max / d; dy *= max / d; }
    bola.style.transform = `translate(${dx}px,${dy}px)`;
    joy.x = dx / max; joy.z = dy / max; joy.activo = true;
  };
  zona.addEventListener('pointerdown', ev => { id = ev.pointerId; zona.setPointerCapture(id); mover(ev); });
  zona.addEventListener('pointermove', ev => { if (ev.pointerId === id) mover(ev); });
  const fin = ev => { if (ev.pointerId !== id) return; id = null; joy.x = joy.z = 0; joy.activo = false; bola.style.transform = ''; };
  zona.addEventListener('pointerup', fin); zona.addEventListener('pointercancel', fin);
  $('btn-accion').addEventListener('pointerdown', ev => { ev.preventDefault(); if (G.jugando) G.accion = true; });
}

function alternarPausa() {
  if (G.fin) return;
  G.pausa = !G.pausa;
  $('pausa').classList.toggle('oculto', !G.pausa);
  Musica.activa = !G.pausa;
}
function alternarSonido() { $('btn-sonido').textContent = Sonido.alternar() ? '🔊' : '🔇'; }
$('btn-pausa').addEventListener('click', alternarPausa);
$('btn-seguir').addEventListener('click', alternarPausa);
$('btn-sonido').addEventListener('click', alternarSonido);
$('btn-empezar').addEventListener('click', empezar);

function empezar() {
  Sonido.init();
  reiniciar();
  $('portada').classList.add('oculto');
  $('final').classList.add('oculto');
  $('hud').classList.remove('oculto');
  $('botones').classList.remove('oculto');
  $('tactil').classList.toggle('oculto', !esTactil);
  G.jugando = true;
  Musica.activa = true; Musica.paso = 0; Musica.siguiente = 0;
  Sonido.timbre();
  luego(0.6, () => decir(remedios, '¡Por fin! Les llamé el martes... ¡del mes pasado!', 3.5));
  luego(4.2, () => decir(ramon, 'Es que había un atasco en la circunvalación, señora.', 3.2));
  luego(7.6, () => decir(paco, '¡Venga, Ramón! ¡CHAPUZAS A DOMICILIO, AL ATAQUE!', 2.8));
}

/* =========================================================================
   HUD
   ========================================================================= */
let firmaLista = '';
function toast(txt, tipo = '') {
  const d = document.createElement('div');
  d.className = `panel toast ${tipo}`; d.textContent = txt;
  $('toasts').appendChild(d);
  setTimeout(() => d.remove(), 3300);
  while ($('toasts').children.length > 3) $('toasts').firstChild.remove();
}
function rotulo(txt, tipo) {
  const r = $('rotulo');
  r.className = ''; void r.offsetWidth;
  r.textContent = txt; r.className = `ver ${tipo}`;
}
function sumar(cant, motivo) {
  G.dinero += cant;
  if (motivo) toast(`${cant >= 0 ? '+' : ''}${euros(cant)} · ${motivo}`, cant >= 0 ? 'mas' : 'menos');
}
function paciencia(d) { G.paciencia = clamp(G.paciencia + d, 0, 100); }
function actualizarHUD() {
  const min = 9 * 60 + Math.floor(progreso() * 540);
  $('reloj').firstChild.nodeValue = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  const din = $('dinero');
  din.textContent = euros(G.dinero); din.classList.toggle('negativo', G.dinero < 0);
  const p = G.paciencia, barra = $('paciencia');
  barra.style.width = p + '%';
  barra.style.background = p > 60 ? 'var(--verde)' : p > 30 ? '#e9a527' : 'var(--rojo)';
  $('cara').textContent = p > 75 ? '😊' : p > 55 ? '🙂' : p > 35 ? '😒' : p > 15 ? '😠' : '🤬';
  const h = paco.herr ? HERRAMIENTAS[paco.herr] : null;
  $('herramienta').textContent = h ? `${h.icono} En la mano: ${h.corto}` : '🧰 Manos vacías';
  // Lista de encargos
  const activos = TIPOS.filter(t => G.encargos[t].activo).sort((a, b) => G.encargos[a].t - G.encargos[b].t);
  const firma = activos.map(t => t + (G.encargos[t].ramon ? 'R' : '')).join('|');
  const lista = $('lista-encargos');
  if (firma !== firmaLista) {
    firmaLista = firma;
    lista.innerHTML = activos.length ? '' : '<div class="panel encargo"><span class="ico">☕</span><span class="info">Nada pendiente.<br><span class="sub">Disfruta mientras dure.</span></span></div>';
    for (const t of activos) {
      const d = ENCARGOS[t], e = G.encargos[t];
      const div = document.createElement('div');
      div.className = 'panel encargo' + (e.ramon ? ' ramon' : '');
      div.dataset.tipo = t;
      div.innerHTML = `<span class="ico">${d.icono}</span><span class="info">${d.nombre}<br><span class="sub">${d.sitio} · ${e.ramon ? 'Ramón va «a ayudar»' : HERRAMIENTAS[d.herr].icono + ' ' + HERRAMIENTAS[d.herr].corto}</span></span><span class="t"></span>`;
      lista.appendChild(div);
    }
  }
  for (const div of lista.children) {
    const t = div.dataset.tipo; if (!t) continue;
    const e = G.encargos[t];
    div.querySelector('.t').textContent = Math.ceil(e.t) + 's';
    div.classList.toggle('urgente', e.t < 10);
  }
}

/* =========================================================================
   Lógica de encargos
   ========================================================================= */
function maxActivos() { const p = progreso(); return p < 0.2 ? 2 : p < 0.6 ? 3 : 4; }
function generarEncargo() {
  const libres = TIPOS.filter(t => !G.encargos[t].activo && G.encargos[t].cd <= 0);
  if (!libres.length) return;
  const tipo = pick(libres);
  const e = G.encargos[tipo];
  e.activo = true; e.ramon = false;
  e.max = e.t = lerp(58, 36, progreso()) + rand(-3, 3);
  if (tipo === 'pared') Visual._yaPintada = true;
  Visual.poner(tipo, 'roto');
  if (tipo === 'bombilla' || tipo === 'vater' || tipo === 'cuadro') Sonido.crash(); else Sonido.timbre();
  decir(remedios, frase(FRASES.remediosNuevo[tipo]), 3.6);
  toast(`📞 Nuevo encargo: ${ENCARGOS[tipo].icono} ${ENCARGOS[tipo].nombre}`, '');
}
function cerrarEncargo(tipo) {
  const e = G.encargos[tipo];
  e.activo = false; e.ramon = false; e.cd = 9;
}

// resultado: 'fino' | 'bien' | 'chapuza'; quien: 'paco' | 'ramon'
function resolver(tipo, resultado, quien = 'paco', malaHerr = false) {
  const d = ENCARGOS[tipo];
  cerrarEncargo(tipo);
  const [px, pz] = d.pie;
  const autor = quien === 'paco' ? paco : ramon;
  if (resultado === 'chapuza') {
    Visual.poner(tipo, 'chapuza');
    G.stats.chapuza++; if (quien === 'ramon') G.stats.ramonChapuza++;
    G.stats.desperfectos.push(tipo);
    sumar(-25, `Desperfecto: ${DESPERFECTOS[tipo]}`);
    paciencia(-12);
    rotulo('¡CHAPUZA!', 'malo');
    Sonido.trombon();
    G.temblor = 0.35;
    efectoChapuza(tipo, autor);
    luego(0.3, () => decir(autor, quien === 'paco' ? frase(FRASES.pacoChapuza) : frase(FRASES.ramonChapuza), 3));
    luego(2.2, () => decir(remedios, frase(FRASES.remediosChapuza), 3));
  } else {
    Visual.poner(tipo, 'ok');
    const fino = resultado === 'fino';
    let pago = fino ? 60 : 40;
    if (quien === 'ramon') { pago = 20; G.stats.ramonBien++; } else if (fino) G.stats.fino++; else G.stats.bien++;
    sumar(pago, quien === 'ramon' ? `Ramón: ${d.nombre} (de milagro)` : `${d.nombre}${fino ? ' (¡fino!)' : ''}`);
    paciencia(fino ? 8 : 4);
    rotulo(quien === 'ramon' ? '¡DE MILAGRO!' : fino ? '¡TRABAJO FINO!' : '¡APAÑAO!', 'bueno');
    if (fino) Sonido.fanfarria(); else Sonido.clonc();
    estrellitas(px, 1.4, pz);
    if (quien === 'ramon') decir(ramon, frase(FRASES.ramonBien), 2.8);
    else if (fino && Math.random() < 0.6) decir(paco, frase(FRASES.pacoFino), 2.5);
    luego(1.6, () => decir(remedios, frase(fino ? FRASES.remediosFino : FRASES.remediosBien), 3));
  }
}

function efectoChapuza(tipo, autor) {
  const [px, pz] = ENCARGOS[tipo].pie;
  switch (tipo) {
    case 'grifo':
      Sonido.chof();
      luego(0.5, () => crearCharco(px, pz + 0.3, 1.25));
      break;
    case 'enchufe':
      Sonido.zas();
      emitir(10.75, 0.55, 3, 40, { color: [0xffd23f, 0xffffff, 0x8fd3ff], brilla: true, vel: 4, sube: 4, tam: 0.04, vida: 0.6 });
      electrocutar(autor);
      empezarApagon(9);
      break;
    case 'pared': {
      Sonido.chof();
      const col = new THREE.Color(colorChillon()).getHex();
      emitir(-10.6, 1.2, 1.5, 40, { color: col, vel: 3, sube: 3, tam: 0.08, vida: 1.2, vx: 1.5 });
      teñir(autor, col, 14);
      if (autor === paco) luego(3.5, () => decir(paco, '¿Me queda bien este color?', 2.5));
      break;
    }
    case 'cuadro':
      Sonido.clonc();
      break;
    case 'bombilla':
      Sonido.zas();
      emitir(-6.3, 1.65, 4.3, 30, { color: [0xffffff, 0xd8f2ff], brilla: true, vel: 3, sube: 3, tam: 0.04, vida: 0.8, cubo: true });
      empezarApagon(11);
      break;
    case 'vater':
      Sonido.chof();
      Sonido.plop();
      luego(0.6, () => crearCharco(px, pz + 0.4, 1.3, 0x9ab86a));
      luego(1.5, () => decir(michi, '¡FFFFSSSS! (huye del olor)', 2));
      break;
  }
}

function empezarApagon(seg) {
  G.apagon = Math.max(G.apagon, seg);
  luego(1.5, () => decir(ramon, frase(FRASES.ramonApagon), 3));
}
function electrocutar(e) {
  if (e === paco) {
    paco.estado = 'electro'; paco.t = 1.6;
    paco.c.pelosPunta.visible = true;
    teñir(paco, 0x2a2a2a, 9);
    luego(0.1, () => decir(paco, '¡¡BZZZZZZZT!!', 1.5));
  } else {
    e.c.pelosPunta.visible = true;
    teñir(e, 0x2a2a2a, 9);
    luego(6, () => { e.c.pelosPunta.visible = false; });
  }
}
function teñir(e, color, seg) { e.c.matCuerpo.color.set(color); e.tinte = seg; }
function restaurarTinte(e) { e.c.matCuerpo.color.copy(e.c.colorCuerpo); e.c.pelosPunta.visible = false; e.tinte = 0; }

function resbalar(motivo) {
  if (paco.estado === 'resbalon' || paco.estado === 'mini') return;
  if (G.mini) cancelarMini();
  paco.estado = 'resbalon'; paco.t = 0; paco.dur = motivo === 'gato' ? 1.2 : 1.7;
  G.stats.resbalones++;
  sumar(2, 'Plus de peligrosidad (resbalón)');
  Sonido.boing();
  decir(paco, motivo === 'gato' ? frase(FRASES.pacoGato) : frase(FRASES.pacoResbalon), 2.2);
  if (dist2D(paco.c.g.position.x, paco.c.g.position.z, remedios.c.g.position.x, remedios.c.g.position.z) < 7)
    luego(1.3, () => decir(remedios, frase(FRASES.remediosResbalon), 2.6));
}

/* =========================================================================
   Minijuego de precisión
   ========================================================================= */
function empezarMini(tipo) {
  const p = progreso();
  const ancho = lerp(0.3, 0.17, p);
  const centro = rand(0.15 + ancho / 2, 0.85 - ancho / 2);
  G.mini = { tipo, p: Math.random() < 0.5 ? 0 : 1, dir: 1, vel: lerp(0.85, 1.6, p) * rand(0.9, 1.15), centro, ancho, fino: ancho * 0.3 };
  if (G.mini.p === 1) G.mini.dir = -1;
  const e = G.encargos[tipo];
  if (e.ramon) { e.ramon = false; if (ramon.encargo === tipo) { ramon.encargo = null; ramon.trabajaT = 0; ramon.estado = 'idle'; ramon.t = 1; decir(ramon, 'Vale, vale, hazlo tú, que yo te superviso.', 2.5); } }
  paco.estado = 'mini';
  $('mini-titulo').textContent = `${ENCARGOS[tipo].icono} ${ENCARGOS[tipo].nombre}`;
  $('mini-verde').style.left = (centro - ancho / 2) * 100 + '%';
  $('mini-verde').style.width = ancho * 100 + '%';
  $('mini-oro').style.left = (centro - G.mini.fino / 2) * 100 + '%';
  $('mini-oro').style.width = G.mini.fino * 100 + '%';
  $('mini').classList.remove('oculto');
  // Cara a la faena
  const [px, pz] = ENCARGOS[tipo].pie;
  const obj = { grifo: [8.5, -1.2], enchufe: [10.9, 3], pared: [-10.9, 1.5], cuadro: [-7, -7.9], bombilla: [-6.3, 4.3], vater: [9.6, -7.45] }[tipo];
  paco.c.g.rotation.y = Math.atan2(obj[0] - px, obj[1] - pz);
}
function cancelarMini() { G.mini = null; $('mini').classList.add('oculto'); if (paco.estado === 'mini') paco.estado = 'normal'; }
function pararMini() {
  const m = G.mini;
  const d = Math.abs(m.p - m.centro);
  const res = d <= m.fino / 2 ? 'fino' : d <= m.ancho / 2 ? 'bien' : 'chapuza';
  cancelarMini();
  Sonido.clonc();
  resolver(m.tipo, res, 'paco');
}

/* =========================================================================
   Interacciones de Paco
   ========================================================================= */
function objetivoCercano() {
  const p = paco.c.g.position;
  // Herramientas de la mesa
  let mejor = null, md = 0.85;
  for (const r of ranuras) {
    if (paco.herr === r.id) continue;
    const d = dist2D(p.x, p.z, r.x, r.z);
    if (d < md) { md = d; mejor = r; }
  }
  if (mejor) return { tipo: 'herr', r: mejor };
  // Encargos
  for (const t of TIPOS) {
    const e = G.encargos[t];
    if (!e.activo) continue;
    const [x, z] = ENCARGOS[t].pie;
    if (dist2D(p.x, p.z, x, z) < 1.25) return { tipo: 'encargo', t };
  }
  const cerca = (e, r) => dist2D(p.x, p.z, e.c.g.position.x, e.c.g.position.z) < r;
  if (cerca(ramon, 1.7)) return { tipo: 'ramon' };
  if (cerca(remedios, 1.7)) return { tipo: 'remedios' };
  if (cerca(michi, 1.3)) return { tipo: 'michi' };
  return null;
}
function textoPista(o) {
  if (!o) return null;
  const H = HERRAMIENTAS;
  switch (o.tipo) {
    case 'herr': return `<kbd>E</kbd> Coger ${H[o.r.id].icono} ${H[o.r.id].corto}${paco.herr ? ` (dejas ${H[paco.herr].corto.toLowerCase()})` : ''}`;
    case 'encargo': {
      const d = ENCARGOS[o.t];
      if (!paco.herr) return `Necesitas ${H[d.herr].icono} ${H[d.herr].corto} · está en la mesa de la furgoneta`;
      if (paco.herr === d.herr) return `<kbd>E</kbd> ¡A arreglarlo! ${d.icono} ${d.nombre}`;
      return `<kbd>E</kbd> Intentarlo con ${H[paco.herr].icono} ${H[paco.herr].corto.toLowerCase()}… (mala idea)`;
    }
    case 'ramon': return `<kbd>E</kbd> «¡Ramón, a trabajar!»`;
    case 'remedios': return `<kbd>E</kbd> Charlar con Doña Remedios`;
    case 'michi': return `<kbd>E</kbd> Acariciar a Michi`;
  }
}
function coger(id) {
  soltarHerramienta();
  paco.herr = id;
  const r = ranuras.find(x => x.id === id);
  r.malla.visible = false;
  const m = crearHerramienta(id);
  m.rotation.x = Math.PI / 2;
  m.position.set(0, -0.02, 0.02);
  paco.c.mano.add(m);
  paco.mallaHerr = m;
  Sonido.coger();
  if (Math.random() < 0.35) decir(paco, pick([`¡${HERRAMIENTAS[id].corto}! Justo lo que necesitaba.`, `Esto es una herramienta de profesional.`, `Con esto y un bizcocho...`]), 2);
}
function soltarHerramienta() {
  if (paco.mallaHerr) { paco.mallaHerr.removeFromParent(); paco.mallaHerr = null; }
  if (paco.herr) { const r = ranuras.find(x => x.id === paco.herr); r.malla.visible = true; }
  paco.herr = null;
}
function accion() {
  if (G.mini) { pararMini(); return; }
  if (paco.estado !== 'normal') return;
  const o = objetivoCercano();
  if (!o) { if (Math.random() < 0.3) decir(paco, pick(['A ver, a ver...', '¿Dónde he dejado yo...?', 'Hmm.']), 1.4); return; }
  switch (o.tipo) {
    case 'herr': coger(o.r.id); break;
    case 'encargo': {
      const d = ENCARGOS[o.t];
      if (!paco.herr) { decir(paco, frase(FRASES.pacoSinHerr, HERRAMIENTAS[d.herr].nombre), 2.6); return; }
      if (paco.herr === d.herr) { empezarMini(o.t); return; }
      decir(paco, frase(FRASES.pacoMalaHerr, HERRAMIENTAS[paco.herr].nombre), 2.4);
      paco.estado = 'trabajando'; paco.t = 1.1;
      luego(1.1, () => { if (G.encargos[o.t].activo) resolver(o.t, 'chapuza', 'paco', true); });
      break;
    }
    case 'ramon': ordenarRamon(); break;
    case 'remedios': decir(remedios, frase(FRASES.remediosCharla), 3.2); break;
    case 'michi': Sonido.miau(); decir(michi, pick(['Prrrrr...', 'Miau. (Te tolera)', '¡MIAU! (Te muerde un poco)']), 1.8); estrellitas(michi.c.g.position.x, 0.8, michi.c.g.position.z); break;
  }
}

/* =========================================================================
   Ramón: el socio
   ========================================================================= */
function ordenarRamon() {
  const libres = TIPOS.filter(t => G.encargos[t].activo && !G.encargos[t].ramon);
  ramon.c.cuerpo.rotation.set(0, 0, 0); ramon.c.cuerpo.position.set(0, 0, 0); bocataRamon.visible = false;
  ramon.dormido = false; ramon.sentado = false;
  if (!libres.length) { if (ramon.estado === 'siesta' || ramon.estado === 'almuerzo') { ramon.estado = 'idle'; ramon.t = 3; } }
  if (!libres.length) { decir(ramon, frase(FRASES.ramonOrdenSin), 2.6); return; }
  decir(ramon, frase(FRASES.ramonOrden), 2.6);
  asignarRamon(libres.sort((a, b) => G.encargos[a].t - G.encargos[b].t)[0], 3.2);
}
function asignarRamon(tipo, vel = 2.3) {
  if (ramon.encargo) G.encargos[ramon.encargo].ramon = false;
  ramon.estado = 'ayudar'; ramon.encargo = tipo; ramon.velAyuda = vel; ramon.trabajaT = 0;
  G.encargos[tipo].ramon = true;
  const [x, z] = ENCARGOS[tipo].pie;
  irA(ramon, x, z);
}
function actualizarRamon(dt) {
  const r = ramon;
  r.t -= dt;
  const pos = r.c.g.position;
  let trabajando = false;
  switch (r.estado) {
    case 'idle':
      r.vel = 0;
      if (r.t <= 0) {
        const libres = TIPOS.filter(t => G.encargos[t].activo && !G.encargos[t].ramon);
        const tirada = Math.random();
        if (libres.length && tirada < 0.28) { decir(r, frase(FRASES.ramonAyuda), 2.6); asignarRamon(pick(libres)); }
        else if (tirada < 0.55) { r.estado = 'almuerzo'; irA(r, -4.0, 9.15); decir(r, frase(FRASES.ramonAlmuerzo), 3); }
        else if (tirada < 0.7) { r.estado = 'siesta'; irA(r, -8.5, 3.55); }
        else { r.estado = 'pasea'; const [x, z] = pick(PUNTOS_PASEO); irA(r, x, z); if (Math.random() < 0.5) decir(r, frase(FRASES.ramonPasea), 2.6); }
      }
      break;
    case 'pasea':
      if (caminar(r, dt, 1.9)) {
        if (Math.random() < 0.45 && zona(pos.x, pos.z) !== 'calle') { crearPlatano(pos.x + rand(-0.3, 0.3), pos.z + rand(-0.3, 0.3)); decir(r, frase(FRASES.ramonPlatano), 2.6); }
        r.estado = 'idle'; r.t = rand(1.5, 4);
      }
      break;
    case 'almuerzo':
      if (r.sentado) {
        bocataRamon.visible = true;
        r.c.brazos[1].rotation.x = -1.6 + Math.sin(performance.now() / 180) * 0.25;
        if (r.t <= 0) { r.sentado = false; bocataRamon.visible = false; r.c.cuerpo.position.y = 0; r.estado = 'idle'; r.t = rand(1, 3); G.stats.bocatasRamon++; sumar(-3, 'Bocadillo de Ramón (a cuenta de la empresa)'); }
      } else if (caminar(r, dt, 2.0)) {
        r.sentado = true; r.t = rand(9, 14); r.c.g.rotation.y = Math.PI; r.c.cuerpo.position.y = -0.32;
      }
      break;
    case 'siesta':
      if (r.dormido) {
        if (Math.random() < dt * 1.3) emitir(pos.x, 1.4, pos.z + 0.2, 1, { color: 0xffffff, brilla: true, cubo: true, vel: 0.2, sube: 0.6, gravedad: -0.2, tam: 0.09, vida: 1.6 });
        if (r.t <= 0) { r.dormido = false; r.c.cuerpo.rotation.set(0, 0, 0); r.c.cuerpo.position.y = 0; r.estado = 'idle'; r.t = rand(1, 3); decir(r, '¡Estoy despierto! ¡Estoy despierto!', 2); }
      } else if (caminar(r, dt, 1.9)) {
        r.dormido = true; r.t = rand(9, 13); r.c.g.rotation.y = 0;
        r.c.cuerpo.rotation.set(0, 0, Math.PI / 2 - 0.1); r.c.cuerpo.position.set(-0.8, 0.75, 0.2);
        decir(r, frase(FRASES.ramonSiesta), 3);
      }
      break;
    case 'ayudar': {
      const e = G.encargos[r.encargo];
      if (!r.encargo || !e || !e.activo) { if (r.encargo) decir(r, frase(FRASES.ramonTarde), 2.5); r.encargo = null; r.estado = 'idle'; r.t = 2; break; }
      if (r.trabajaT > 0) {
        r.trabajaT -= dt; trabajando = true;
        if (Math.random() < dt * 6) emitir(pos.x, 1.2, pos.z, 2, { color: [0xbdbdbd, 0xffd23f], vel: 1.5, sube: 2, tam: 0.04, vida: 0.4, cubo: true });
        if (r.trabajaT <= 0) {
          const tipo = r.encargo; r.encargo = null; r.estado = 'idle'; r.t = rand(2, 4);
          resolver(tipo, Math.random() < 0.55 ? 'chapuza' : 'bien', 'ramon');
        }
      } else if (caminar(r, dt, r.velAyuda || 2.3)) {
        r.trabajaT = 3;
        const obj = { grifo: [8.5, -1.2], enchufe: [10.9, 3], pared: [-10.9, 1.5], cuadro: [-7, -7.9], bombilla: [-6.3, 4.3], vater: [9.6, -7.45] }[r.encargo];
        r.c.g.rotation.y = Math.atan2(obj[0] - pos.x, obj[1] - pos.z);
      }
      break;
    }
  }
  if (r.estado !== 'siesta' && r.estado !== 'almuerzo') animarAndar(r.c, dt, r.vel, trabajando);
  else if (!r.sentado && !r.dormido) animarAndar(r.c, dt, r.vel);
  if (r.tinte > 0) { r.tinte -= dt; if (r.tinte <= 0) restaurarTinte(r); }
}

/* =========================================================================
   Doña Remedios y Michi
   ========================================================================= */
function actualizarRemedios(dt) {
  const r = remedios;
  r.t -= dt; r.charlaT -= dt;
  const activos = TIPOS.filter(t => G.encargos[t].activo).sort((a, b) => G.encargos[a].t - G.encargos[b].t);
  if (r.t <= 0) {
    r.t = 2.5;
    let dest;
    if (activos.length) {
      const [x, z] = ENCARGOS[activos[0]].pie;
      const c = CENTROS[zona(x, z)];
      const dx = c[0] - x, dz = c[1] - z, d = Math.hypot(dx, dz) || 1;
      dest = [x + dx / d * 1.6, z + dz / d * 1.6];
    } else if (!r.ruta || !r.ruta.length) {
      if (Math.random() < 0.4) dest = pick([[-4, 2.5], [-6.5, 0.5], [3.5, 2], [-3, 3.5]]);
    }
    if (dest && (!r.dest || dist2D(dest[0], dest[1], r.dest[0], r.dest[1]) > 0.5)) { r.dest = dest; irA(r, dest[0], dest[1]); }
  }
  const llegado = caminar(r, dt, 1.7);
  if (llegado) {
    const p = paco.c.g.position, q = r.c.g.position;
    r.c.g.rotation.y = angLerp(r.c.g.rotation.y, Math.atan2(p.x - q.x, p.z - q.z), 1 - Math.exp(-3 * dt));
    // Brazos en jarras si está enfadada
    if (G.paciencia < 40) { r.c.brazos[0].rotation.z = 0.6; r.c.brazos[1].rotation.z = -0.6; }
    else { r.c.brazos[0].rotation.z = 0; r.c.brazos[1].rotation.z = 0; }
  }
  if (r.charlaT <= 0) { r.charlaT = rand(14, 22); if (!(r.globoT > 0)) decir(r, frase(FRASES.remediosIdle), 2.8); }
  animarAndar(r.c, dt, r.vel);
}
function actualizarMichi(dt) {
  const m = michi;
  m.t -= dt; m.cdTropiezo -= dt;
  if (m.t <= 0 && (!m.ruta || !m.ruta.length)) {
    m.t = rand(2, 6);
    // A veces va directo a ponerse en medio
    if (Math.random() < 0.3 && zona(paco.c.g.position.x, paco.c.g.position.z) !== 'calle') irA(m, paco.c.g.position.x + rand(-1, 1), paco.c.g.position.z + rand(-1, 1));
    else { const [x, z] = pick(PUNTOS_PASEO.filter(p => p[1] < 5)); irA(m, x, z); }
  }
  caminar(m, dt, 2.4);
  const c = m.c;
  c.fase += dt * 12 * (m.vel > 0 ? 1 : 0);
  c.patas.forEach((p, i) => { p.rotation.x = Math.sin(c.fase + (i % 2) * Math.PI) * 0.6 * (m.vel > 0 ? 1 : 0); });
  c.cola.rotation.z = Math.sin(performance.now() / 300) * 0.5;
  // Tropezón
  const p = paco.c.g.position, q = c.g.position;
  if (m.cdTropiezo <= 0 && paco.estado === 'normal' && paco.vel > 1.5 && dist2D(p.x, p.z, q.x, q.z) < 0.55) {
    m.cdTropiezo = 6;
    Sonido.miau();
    decir(m, frase(FRASES.michi), 1.8);
    resbalar('gato');
    irA(m, ...pick(PUNTOS_PASEO.filter(pp => pp[1] < 5)));
  }
}

/* =========================================================================
   Paco: movimiento y estados
   ========================================================================= */
const vMov = new THREE.Vector3();
function actualizarPaco(dt) {
  const c = paco.c, p = c.g.position;
  if (paco.tinte > 0) { paco.tinte -= dt; if (paco.tinte <= 0) restaurarTinte(paco); }
  if (paco.boost > 0) {
    paco.boost -= dt;
    if (Math.random() < dt * 10) emitir(p.x, 0.2, p.z, 1, { color: [0xffd23f, 0xff9f1a], brilla: true, vel: 0.4, sube: 1, gravedad: 0, tam: 0.05, vida: 0.5 });
  }
  switch (paco.estado) {
    case 'normal': {
      let ix = 0, iz = 0;
      if (teclas.has('w') || teclas.has('arrowup')) iz -= 1;
      if (teclas.has('s') || teclas.has('arrowdown')) iz += 1;
      if (teclas.has('a') || teclas.has('arrowleft')) ix -= 1;
      if (teclas.has('d') || teclas.has('arrowright')) ix += 1;
      if (joy.activo) { ix += joy.x; iz += joy.z; }
      const len = Math.hypot(ix, iz);
      if (len > 1) { ix /= len; iz /= len; }
      const corre = teclas.has('shift') || (joy.activo && Math.hypot(joy.x, joy.z) > 0.92);
      const vmax = (corre ? 6.2 : 4.3) * (paco.boost > 0 ? 1.45 : 1);
      const k = 1 - Math.exp(-12 * dt);
      paco.vx = lerp(paco.vx, ix * vmax, k); paco.vz = lerp(paco.vz, iz * vmax, k);
      p.x += paco.vx * dt; p.z += paco.vz * dt;
      paco.vel = Math.hypot(paco.vx, paco.vz);
      if (len > 0.1) c.g.rotation.y = angLerp(c.g.rotation.y, Math.atan2(ix, iz), 1 - Math.exp(-14 * dt));
      animarAndar(c, dt, paco.vel);
      c.cuerpo.rotation.set(0, 0, 0);
      break;
    }
    case 'mini':
      paco.vel = 0; paco.vx = paco.vz = 0;
      animarAndar(c, dt, 0, true);
      break;
    case 'trabajando':
      paco.t -= dt; paco.vel = 0; paco.vx = paco.vz = 0;
      animarAndar(c, dt, 0, true);
      if (paco.t <= 0) paco.estado = 'normal';
      break;
    case 'electro':
      paco.t -= dt; paco.vel = 0;
      c.cuerpo.position.set(rand(-0.06, 0.06), rand(0, 0.08), rand(-0.06, 0.06));
      c.brazos[0].rotation.x = c.brazos[1].rotation.x = -2.8 + rand(-0.3, 0.3);
      if (Math.random() < dt * 20) emitir(p.x, rand(0.5, 2), p.z, 2, { color: [0xffd23f, 0x8fd3ff], brilla: true, vel: 2, sube: 1, tam: 0.03, vida: 0.3 });
      if (paco.t <= 0) {
        paco.estado = 'normal'; c.cuerpo.position.set(0, 0, 0);
        emitir(p.x, 1.9, p.z, 8, { color: 0x555555, vel: 0.3, sube: 1, gravedad: -0.5, tam: 0.12, vida: 1.5, crece: 2 });
        luego(4, () => { if (paco.estado === 'normal') paco.c.pelosPunta.visible = false; });
      }
      break;
    case 'resbalon': {
      paco.t += dt;
      const t = paco.t, dur = paco.dur;
      paco.vx *= Math.exp(-2 * dt); paco.vz *= Math.exp(-2 * dt);
      p.x += paco.vx * dt; p.z += paco.vz * dt;
      paco.vel = 0;
      if (t < 0.45) { c.g.rotation.y += dt * 22; c.cuerpo.position.y = Math.sin(t / 0.45 * Math.PI) * 0.5; }
      else if (t < 0.65) { c.cuerpo.rotation.x = lerp(0, -1.45, (t - 0.45) / 0.2); c.cuerpo.position.y = 0.15; }
      else if (t < dur - 0.35) {
        c.cuerpo.rotation.x = -1.45; c.cuerpo.position.y = 0.15;
        c.piernas[0].rotation.x = Math.sin(t * 20) * 0.5; c.piernas[1].rotation.x = -Math.sin(t * 20) * 0.5;
        if (Math.random() < dt * 8) { // estrellitas alrededor de la cabeza
          const a = t * 6, cx = p.x - Math.sin(c.g.rotation.y) * 1.5, cz = p.z - Math.cos(c.g.rotation.y) * 1.5;
          emitir(cx + Math.cos(a) * 0.3, 0.6, cz + Math.sin(a) * 0.3, 1, { color: 0xffd23f, brilla: true, cubo: true, vel: 0.2, sube: 0.4, gravedad: 0, tam: 0.07, vida: 0.6, gira: 6 });
        }
      } else c.cuerpo.rotation.x = lerp(-1.45, 0, clamp((t - (dur - 0.35)) / 0.35, 0, 1));
      if (t >= dur) { paco.estado = 'normal'; c.cuerpo.rotation.set(0, 0, 0); c.cuerpo.position.set(0, 0, 0); }
      break;
    }
  }
  resolverColision(p, 0.33);
  // Peligros
  if (paco.estado === 'normal' && paco.vel > 1.2) {
    for (let i = peligros.length - 1; i >= 0; i--) {
      const h = peligros[i];
      if (dist2D(p.x, p.z, h.x, h.z) < h.r * (h.m.scale.x) + 0.15) {
        resbalar(h.tipo);
        if (h.tipo === 'platano') { h.m.removeFromParent(); peligros.splice(i, 1); }
        break;
      }
    }
  }
  // Bocata
  if (bocata.visible && dist2D(p.x, p.z, bocata.position.x, bocata.position.z) < 0.75) {
    bocata.visible = false; G.bocataT = rand(30, 42);
    paco.boost = 10; G.stats.bocatasPaco++;
    Sonido.nam();
    decir(paco, pick(['¡Bocata de calamares! ¡Esto da alas!', '¡Ñam! ¡Turbo de calamares activado!', 'Esto no se lo digas a Ramón...']), 2.5);
    estrellitas(p.x, 1.2, p.z);
  }
}

function actualizarBocata(dt) {
  if (!bocata.visible) {
    G.bocataT -= dt;
    if (G.bocataT <= 0) {
      const [x, z] = pick(PUNTOS_BOCATA);
      bocata.position.set(x, 0.5, z); bocata.visible = true;
      toast('🥖 ¡Ha aparecido un bocata de calamares! (turbo de velocidad)', 'mas');
    }
    return;
  }
  bocata.rotation.y += dt * 2;
  bocata.position.y = 0.5 + Math.sin(performance.now() / 300) * 0.1;
  // Ramón también lo quiere
  const q = ramon.c.g.position;
  if (dist2D(q.x, q.z, bocata.position.x, bocata.position.z) < 0.8 && !ramon.dormido) {
    bocata.visible = false; G.bocataT = rand(30, 42);
    Sonido.nam();
    decir(ramon, frase(FRASES.ramonBocata), 2.6);
  }
}

function actualizarPeligros(dt) {
  for (let i = peligros.length - 1; i >= 0; i--) {
    const h = peligros[i];
    h.vida -= dt;
    if (h.tipo === 'charco') {
      const s = h.vida < 3 ? Math.max(0.01, h.vida / 3) : Math.min(1, h.m.scale.x + dt * 1.5);
      h.m.scale.setScalar(s);
    }
    if (h.vida <= 0) { h.m.removeFromParent(); peligros.splice(i, 1); }
  }
}

/* =========================================================================
   Iluminación (apagones) y cámara
   ========================================================================= */
const colTmp = new THREE.Color();
function actualizarLuces(dt) {
  if (G.apagon > 0) G.apagon -= dt;
  const oscuro = G.apagon > 0 ? 1 : 0;
  const k = 1 - Math.exp(-4 * dt);
  hemi.intensity = lerp(hemi.intensity, oscuro ? 0.08 : 1.25, k);
  sol.intensity = lerp(sol.intensity, oscuro ? 0.05 : 1.7, k);
  linterna.intensity = lerp(linterna.intensity, oscuro ? 60 : 0, k);
  colTmp.copy(CIELO).lerp(CIELO_NOCHE, clamp(1 - hemi.intensity / 1.25, 0, 1));
  scene.background.copy(colTmp); scene.fog.color.copy(colTmp);
  const p = paco.c.g.position;
  linterna.position.set(p.x, 3.2, p.z + 0.5);
  linterna.target.position.set(p.x + Math.sin(paco.c.g.rotation.y) * 2.5, 0, p.z + Math.cos(paco.c.g.rotation.y) * 2.5);
}
const camObjetivo = new THREE.Vector3(), camMira = new THREE.Vector3();
function actualizarCamara(dt, inmediato = false) {
  const p = paco.c.g.position;
  const lejos = camera.aspect < 1 ? 1.55 : camera.aspect < 1.4 ? 1.2 : 1;
  camObjetivo.set(p.x * 0.85, 12.5 * lejos, p.z + 9.5 * lejos);
  if (inmediato) camera.position.copy(camObjetivo);
  else camera.position.lerp(camObjetivo, 1 - Math.exp(-4 * dt));
  camMira.set(camera.position.x, 0.6, camera.position.z - 9.5 * lejos - 0.6);
  if (G.temblor > 0) {
    G.temblor -= dt;
    camera.position.x += rand(-1, 1) * G.temblor * 0.6;
    camera.position.y += rand(-1, 1) * G.temblor * 0.6;
  }
  camera.lookAt(camMira);
}

/* =========================================================================
   Final de la jornada: la factura
   ========================================================================= */
function terminar(motivo) {
  if (G.fin) return;
  G.fin = true; G.jugando = false;
  Musica.activa = false;
  cancelarMini();
  $('hud').classList.add('oculto'); $('botones').classList.add('oculto'); $('tactil').classList.add('oculto');
  entidades.forEach(e => { if (e.globo) e.globo.style.display = 'none'; });
  const S = G.stats;
  const lineas = [];
  if (S.fino) lineas.push([`Trabajos finos (${S.fino} × 60 €)`, S.fino * 60]);
  if (S.bien) lineas.push([`Trabajos apañaos (${S.bien} × 40 €)`, S.bien * 40]);
  if (S.ramonBien) lineas.push([`Trabajos de Ramón que salieron bien, sorprendentemente (${S.ramonBien} × 20 €)`, S.ramonBien * 20]);
  const cuenta = {};
  S.desperfectos.forEach(t => cuenta[t] = (cuenta[t] || 0) + 1);
  for (const [t, n] of Object.entries(cuenta)) lineas.push([`Desperfecto: ${DESPERFECTOS[t]}${n > 1 ? ` (×${n})` : ''}`, -25 * n]);
  if (S.bocatasRamon) lineas.push([`Bocadillos de Ramón (${S.bocatasRamon} × 3 €)`, -3 * S.bocatasRamon]);
  if (S.resbalones) lineas.push([`Plus de peligrosidad por resbalones (${S.resbalones} × 2 €)`, 2 * S.resbalones]);
  if (!lineas.length) lineas.push(['Visita técnica (no se hizo nada, pero se vino)', 0]);
  const base = lineas.reduce((a, l) => a + l[1], 0);
  const iva = base > 0 ? Math.round(base * 0.21) : 0;
  const total = base + iva;
  const nota = clamp(Math.round((base / 70 + G.paciencia / 25) / 1.8), 0, 5);
  const estrellas = motivo === 'fuera' ? 0 : Math.max(1, nota);
  const opiniones = [
    'No vuelvo a llamarles. Bueno, igual el martes.',
    'No vuelvo a llamarles. Bueno, igual el martes.',
    'Lo han dejado... distinto. Mi hermana dice que «con personalidad».',
    'Ni tan mal. Para lo que cobran, ni tan mal.',
    'Muy apañaos. Les voy a recomendar a la del quinto. Y a la del sexto, que es muy pesada.',
    '¡Unos artistas! Paco, si quiere se queda a comer. Ramón no, que ya ha comido.',
  ];
  const fecha = new Date().toLocaleDateString('es-ES');
  const filas = lineas.map(([t, v]) => `<tr><td>${t}</td><td class="${v < 0 ? 'neg' : ''}">${euros(v)}</td></tr>`).join('');
  $('final-contenido').innerHTML = `
    ${motivo === 'fuera'
      ? `<div class="sello-fuera">¡FUERA DE MI CASA!</div><p class="lema">Doña Remedios os ha echado a escobazos a las ${$('reloj').firstChild.nodeValue}. Ramón ha salvado el bocadillo.</p>`
      : `<h1 class="titulo" style="font-size:54px">¡Fin de la jornada!</h1><p class="lema" style="margin-top:12px">Son las 18:00. Ramón ya está en la furgoneta desde las 17:45.</p>`}
    <div class="factura">
      <h2>FACTURA ${String(Math.floor(rand(1, 999))).padStart(3, '0')}/B</h2>
      <div class="cab">REFORMAS CHAPUCILLA S.L. · Cliente: Dña. Remedios · ${fecha}</div>
      <table>${filas}
        <tr><td>Base imponible</td><td>${euros(base)}</td></tr>
        <tr><td>IVA (21 %)</td><td>${euros(iva)}</td></tr>
        <tr class="total"><td>TOTAL</td><td class="${total < 0 ? 'neg' : ''}">${euros(total)}</td></tr>
      </table>
      <div class="pie">${total < 0 ? '* Sí: con esta jornada, la empresa le debe dinero a la clienta.' : '* Ramón pregunta si se puede pagar «en especie» (croquetas).'}<br>
      * Encargos sin atender: ${S.expirado}. Resbalones: ${S.resbalones}. Bocatas de calamares: Paco ${S.bocatasPaco}, Ramón «ninguno, lo juro».</div>
    </div>
    <div class="valoracion">Valoración de Doña Remedios<div class="estrellas">${'★'.repeat(estrellas)}${'☆'.repeat(5 - estrellas)}</div>
      <q>${motivo === 'fuera' ? '¡Y no vuelvan! ¡Y llévense al gato! ...No, al gato no.' : opiniones[estrellas]}</q></div>
    <button class="boton" id="btn-otra">Otra jornada</button>`;
  $('btn-otra').addEventListener('click', empezar);
  $('final').classList.remove('oculto');
  if (motivo === 'fuera') Sonido.trombon(); else Sonido.fanfarria();
}

/* =========================================================================
   Bucle principal
   ========================================================================= */
function actualizarJuego(dt) {
  G.t += dt;
  // Cola de eventos diferidos
  for (let i = G.cola.length - 1; i >= 0; i--) if (G.cola[i].t <= G.t) { const f = G.cola[i].fn; G.cola.splice(i, 1); f(); }
  // Aparición de encargos
  G.spawnT -= dt;
  const activos = TIPOS.filter(t => G.encargos[t].activo).length;
  if (G.spawnT <= 0) {
    if (activos < maxActivos()) generarEncargo();
    G.spawnT = lerp(15, 7, progreso()) + rand(-2, 2);
  }
  for (const t of TIPOS) {
    const e = G.encargos[t];
    if (e.cd > 0) e.cd -= dt;
    if (!e.activo) continue;
    if (G.mini && G.mini.tipo === t) continue; // mientras trabajas, el reloj de ese encargo se para
    if (ramon.encargo === t && ramon.trabajaT > 0) continue;
    e.t -= dt;
    if (e.t <= 0) {
      cerrarEncargo(t);
      Visual.poner(t, 'ok');
      G.stats.expirado++;
      paciencia(-18);
      toast(`⌛ ${ENCARGOS[t].nombre}: Doña Remedios se ha hartado`, 'menos');
      decir(remedios, frase(FRASES.remediosExpira), 3.2);
      Sonido.trombon();
    }
  }
  // Minijuego
  if (G.mini) {
    const m = G.mini;
    m.p += m.dir * m.vel * dt;
    if (m.p > 1) { m.p = 1; m.dir = -1; } else if (m.p < 0) { m.p = 0; m.dir = 1; }
    $('mini-aguja').style.left = (m.p * 100) + '%';
  }
  if (G.accion) { G.accion = false; accion(); }
  actualizarPaco(dt);
  actualizarRamon(dt);
  actualizarRemedios(dt);
  actualizarMichi(dt);
  actualizarBocata(dt);
  actualizarPeligros(dt);
  Visual.actualizar(dt);
  // Pista
  const pista = $('pista');
  const txt = G.mini || paco.estado !== 'normal' ? null : textoPista(objetivoCercano());
  if (txt) { pista.innerHTML = esTactil ? txt.replace(/<kbd>E<\/kbd>/g, '<kbd>¡DALE!</kbd>') : txt; pista.classList.remove('oculto'); }
  else pista.classList.add('oculto');
  actualizarHUD();
  if (G.paciencia <= 0) terminar('fuera');
  else if (G.t >= DURACION) terminar('tiempo');
}

// Escena de portada: los personajes posan
reiniciar();
paco.c.g.position.set(-0.5, 0, 7.4); ramon.c.g.position.set(-2.4, 0, 7.6); ramon.c.g.rotation.y = 0.5; paco.c.g.rotation.y = -0.3;
actualizarCamara(0, true);

let ultimo = performance.now();
function bucle(ahora) {
  requestAnimationFrame(bucle);
  const dt = Math.min(0.05, (ahora - ultimo) / 1000);
  ultimo = ahora;
  if (G.jugando && !G.pausa) actualizarJuego(dt);
  else if (!G.jugando && !G.fin) { // animación de portada
    animarAndar(paco.c, dt, 0); animarAndar(ramon.c, dt, 0);
    paco.c.brazos[0].rotation.z = Math.sin(ahora / 300) * 0.3 + 2.6; // saluda
  }
  if (!G.pausa) { actualizarParticulas(dt); actualizarLuces(dt); actualizarGlobos(dt); }
  Musica.tic();
  actualizarCamara(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(bucle);

// Ganchos de depuración (sólo con ?debug en la URL)
if (location.search.includes('debug')) window.__j = { G, paco, ramon, remedios, michi, resolver, generarEncargo, empezarMini, coger, terminar, ordenarRamon, crearPlatano, resbalar };
