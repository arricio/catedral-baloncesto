// CHAPUZAS A DOMICILIO · Arricio y Jeremías, reformas y chapuzas
// Juego 3D de humor (three.js). Personajes y situaciones originales.
import * as THREE from 'three';
import { RoundedBoxGeometry } from './lib/addons/RoundedBoxGeometry.js';
import { RoomEnvironment } from './lib/addons/RoomEnvironment.js';
import { GLTFLoader } from './lib/addons/GLTFLoader.js';

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
   Sonido (sintetizado con WebAudio)
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
    this.musica.gain.value = 0.08;
    this.musica.connect(this.master);
    const len = this.ctx.sampleRate * 1.5;
    this.ruido = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.ruido.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  },
  alternar() {
    this.on = !this.on;
    if (this.master) this.master.gain.value = this.on ? 0.55 : 0;
    if (!this.on) Voz.callar();
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
  ruidoF(dur, vol = 0.3, freq = 1000, tipo = 'lowpass', freq2 = null, cuando = 0, destino = null) {
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
    s.connect(f); f.connect(g); g.connect(destino || this.master);
    s.start(t); s.stop(t + dur + 0.05);
  },
  coger() { this.tono(660, 0.08, 'square', 0.1, 990); },
  boing() { this.tono(180, 0.25, 'sine', 0.35, 720); setTimeout(() => this.tono(720, 0.35, 'sine', 0.3, 140), 230); },
  chof() { this.ruidoF(0.7, 0.45, 1800, 'bandpass', 300); },
  zas() { this.tono(1400, 0.45, 'sawtooth', 0.16, 60); this.ruidoF(0.4, 0.22, 4000, 'highpass'); },
  clonc() { this.tono(900, 0.07, 'square', 0.13); this.tono(1450, 0.18, 'triangle', 0.1, 1300); },
  crash() { this.ruidoF(0.5, 0.5, 900, 'lowpass', 200); this.tono(140, 0.4, 'triangle', 0.3, 50); },
  fanfarria() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => this.tono(f, i === 3 ? 0.45 : 0.12, 'square', 0.11, null, t + i * 0.1));
  },
  trombon() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [[392, 0.3], [370, 0.3], [349, 0.3], [330, 0.9]].forEach(([f, d], i) =>
      this.tono(f, d, 'sawtooth', 0.12, i === 3 ? 300 : null, t + i * 0.32));
  },
  miau() { this.tono(650, 0.15, 'sine', 0.2, 1100); setTimeout(() => this.tono(1100, 0.35, 'sine', 0.18, 520), 140); },
  nam() { for (let i = 0; i < 3; i++) setTimeout(() => this.ruidoF(0.09, 0.35, 700, 'lowpass'), i * 150); },
  timbre() { this.tono(988, 0.35, 'sine', 0.18); setTimeout(() => this.tono(784, 0.6, 'sine', 0.18), 330); },
  ring() { // teléfono antiguo de campanilla
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 14; i++) this.tono(i % 2 ? 1180 : 1320, 0.05, 'square', 0.07, null, t + i * 0.055);
  },
  plop() { this.tono(300, 0.12, 'sine', 0.2, 900); },
  pasos() { this.ruidoF(0.05, 0.08, 500, 'lowpass'); },
  voz(base, n) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < n; i++) this.tono(base * rand(0.8, 1.3), 0.06, 'triangle', 0.05, null, t + i * 0.075);
  },
};

// Música: un pasodoblillo chiptune original en bucle (suave, para no tapar las voces)
const Musica = {
  paso: 0, siguiente: 0, activa: false,
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
      // Mientras alguien habla, la música baja
      const vol = Dialogo.actual ? 0.35 : 1;
      if (m) Sonido.tono(hz(m), dur * 0.9, 'square', 0.5 * vol, null, this.siguiente, Sonido.musica);
      if (i % 2 === 0) {
        const b = this.bajo[(i / 2) % this.bajo.length];
        if (b) Sonido.tono(hz(b), dur * 1.6, 'triangle', 0.9 * vol, null, this.siguiente, Sonido.musica);
      }
      this.paso++;
      this.siguiente += dur;
    }
  },
};

/* =========================================================================
   Voces: los personajes hablan con la voz del dispositivo (síntesis de voz)
   ========================================================================= */
const Voz = {
  ok: typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  voces: [],
  init() {
    if (!this.ok) return;
    const cargar = () => { try { this.voces = speechSynthesis.getVoices().filter(v => /^es/i.test(v.lang)); } catch (e) { /* nada */ } };
    cargar();
    try { speechSynthesis.addEventListener('voiceschanged', cargar); } catch (e) { /* nada */ }
    // En móviles, la voz se desbloquea con una locución dentro del primer toque
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* nada */ }
  },
  elegir(mujer) {
    if (!this.voces.length) return null;
    const esES = this.voces.filter(v => /es[-_]ES/i.test(v.lang));
    const lista = esES.length ? esES : this.voces;
    const fem = /m[oó]nica|paulina|helena|laura|elvira|luc[ií]a|carmen|marisol|conchita|sabina|elena|esperanza|female|mujer|^google espa/i;
    const cand = lista.filter(v => fem.test(v.name) === !!mujer);
    return cand[0] || lista[0];
  },
  hablar(texto, perfil, alAcabar, alEmpezar) {
    if (!this.ok || !Sonido.on || !perfil) return false;
    try {
      const limpio = texto.replace(/\([^)]*\)/g, ' ').replace(/[«»"*]/g, '')
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\s+/g, ' ').trim();
      if (!limpio) return false;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(limpio);
      u.lang = 'es-ES';
      const v = this.elegir(perfil.mujer);
      if (v) u.voice = v;
      u.pitch = perfil.tono; u.rate = perfil.ritmo; u.volume = 1;
      u.onstart = () => alEmpezar && alEmpezar();
      u.onend = () => alAcabar && alAcabar();
      u.onerror = () => alAcabar && alAcabar();
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  },
  callar() { try { if (this.ok) speechSynthesis.cancel(); } catch (e) { /* nada */ } },
  pausar(p) { try { if (this.ok) (p ? speechSynthesis.pause() : speechSynthesis.resume()); } catch (e) { /* nada */ } },
};

/* Diálogo: una sola frase cada vez, con tiempo de sobra para leerla.
   prioridad 0 = comentario prescindible, 1 = normal, 2 = importante (encargos, quejas) */
const Dialogo = {
  cola: [], actual: null, hueco: 0,
  decir(e, texto, prio = 1) {
    if (!e || !texto) return;
    if (prio === 0 && (this.actual || this.cola.length)) return;
    if (this.actual && this.actual.e === e && this.actual.texto === texto) return;
    if (this.cola.length >= 3) {
      const i = this.cola.findIndex(x => x.prio < prio);
      if (i >= 0) this.cola.splice(i, 1); else if (prio < 2) return;
    }
    this.cola.push({ e, texto, prio });
  },
  ocupado() { return !!this.actual || this.cola.length > 0; },
  actualizar(dt) {
    const a = this.actual;
    if (a) {
      a.t += dt;
      // Si la voz no arranca en 1,5 s (dispositivo sin voz en español), seguimos sin ella
      if (a.hablado && !a.empezo && a.t > 1.5) { a.hablado = false; Voz.callar(); }
      const vozLista = !a.hablado || a.vozFin;
      if ((vozLista && a.t >= a.dur) || a.t > a.dur + 7) { this.actual = null; this.hueco = 0.45; }
      return;
    }
    if (this.hueco > 0) { this.hueco -= dt; return; }
    const sig = this.cola.shift();
    if (!sig) return;
    const n = sig.texto.length;
    this.actual = { ...sig, t: 0, dur: clamp(1.4 + n * 0.065, 2.8, 8), vozFin: false, hablado: false };
    const act = this.actual;
    act.hablado = Voz.hablar(sig.texto, sig.e.perfil, () => { act.vozFin = true; }, () => { act.empezo = true; });
    if (!act.hablado) Sonido.voz(sig.e.voz || 400, clamp(Math.round(n / 7), 2, 8));
  },
  limpiar() { this.cola = []; this.actual = null; this.hueco = 0; Voz.callar(); },
};
const decir = (e, texto, prio = 1) => Dialogo.decir(e, texto, prio);

/* =========================================================================
   Escena, cámara, luces
   ========================================================================= */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
// Cielo con degradado
const texCielo = (() => {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#5f9fd6'); gr.addColorStop(0.6, '#a8d2ef'); gr.addColorStop(1, '#f6e3c4');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
scene.background = texCielo;
scene.fog = new THREE.Fog(0xcfe3f0, 45, 95);
// Iluminación ambiental de estudio para los materiales físicos
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
}

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 160);
camera.position.set(-22, 14, 14);

const hemi = new THREE.HemisphereLight(0xfff1dc, 0x6d5a48, 0.55);
scene.add(hemi);
const sol = new THREE.DirectionalLight(0xffe6c4, 2.3);
sol.castShadow = true;
sol.shadow.mapSize.set(2048, 2048);
Object.assign(sol.shadow.camera, { left: -17, right: 17, top: 17, bottom: -17, near: 1, far: 70 });
sol.shadow.bias = -0.0004;
sol.shadow.normalBias = 0.02;
scene.add(sol, sol.target);
const linterna = new THREE.SpotLight(0xfff3c4, 0, 16, 0.6, 0.5, 1);
scene.add(linterna, linterna.target);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* =========================================================================
   Materiales, geometrías y texturas
   ========================================================================= */
const cacheMat = new Map();
function mat(color, rough = 0.82, metal = 0) {
  const k = `${color}|${rough}|${metal}`;
  if (!cacheMat.has(k)) cacheMat.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return cacheMat.get(k);
}
const M = c => (typeof c === 'number' ? mat(c) : c);
const cacheGeo = new Map();
function geoCaja(w, h, d, r) {
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  const k = `${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${r.toFixed(3)}`;
  if (!cacheGeo.has(k)) cacheGeo.set(k, r > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d));
  return cacheGeo.get(k);
}
function caja(w, h, d, color, x = 0, y = 0, z = 0, padre = scene, sombra = true, r = 0) {
  const m = new THREE.Mesh(geoCaja(w, h, d, r), M(color));
  m.position.set(x, y, z);
  m.castShadow = sombra; m.receiveShadow = true;
  padre.add(m);
  return m;
}
const cajaR = (w, h, d, color, x, y, z, padre = scene, r = 0.04, sombra = true) => caja(w, h, d, color, x, y, z, padre, sombra, r);
function cilindro(rt, rb, h, color, x = 0, y = 0, z = 0, padre = scene, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(color));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  padre.add(m);
  return m;
}
function esfera(r, color, x = 0, y = 0, z = 0, padre = scene, seg = 16) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg * 0.75 | 0)), M(color));
  m.position.set(x, y, z); m.castShadow = true;
  padre.add(m);
  return m;
}
function capsula(r, largo, color, x = 0, y = 0, z = 0, padre = scene) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, largo, 6, 12), M(color));
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
  t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
}
const ruido = (g, w, h, n, a) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${Math.random() > .5 ? 255 : 0},${Math.random() > .5 ? 255 : 0},${Math.random() > .5 ? 255 : 0},${a})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } };
const texParquet = rep => texLienzo(512, 512, (g, w, h) => {
  for (let y = 0; y < h; y += 64) {
    const off = (y / 64) % 2 ? 0 : 192;
    for (let x = -256; x < w; x += 384) {
      const l = 36 + Math.random() * 12;
      g.fillStyle = `hsl(27, 48%, ${l}%)`; g.fillRect(x + off, y, 384, 64);
      for (let k = 0; k < 7; k++) { g.strokeStyle = `hsla(25,50%,${l - 10}%,.35)`; g.lineWidth = 1.5; g.beginPath(); const yy = y + rand(6, 58); g.moveTo(x + off, yy); g.bezierCurveTo(x + off + 120, yy + rand(-6, 6), x + off + 260, yy + rand(-6, 6), x + off + 384, yy); g.stroke(); }
      g.strokeStyle = 'rgba(50,25,10,.55)'; g.lineWidth = 2; g.strokeRect(x + off, y, 384, 64);
    }
  }
}, rep);
const texBaldosa = (a, b, rep) => texLienzo(256, 256, (g) => {
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * 128, j * 128, 128, 128); }
  ruido(g, 256, 256, 1500, 0.04);
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
}, rep);
const texHormigon = rep => texLienzo(256, 256, (g) => {
  g.fillStyle = '#9b9890'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(${rand(60, 140)},${rand(60, 130)},${rand(50, 120)},.12)`; g.beginPath(); g.arc(rand(0, 256), rand(0, 256), rand(4, 30), 0, 7); g.fill(); }
  ruido(g, 256, 256, 3000, 0.06);
  g.strokeStyle = 'rgba(40,40,40,.25)'; g.lineWidth = 2; g.strokeRect(0, 0, 256, 256);
}, rep);
const texAsfalto = rep => texLienzo(256, 256, (g) => { g.fillStyle = '#45464b'; g.fillRect(0, 0, 256, 256); ruido(g, 256, 256, 5000, 0.07); }, rep);
const texAcera = rep => texLienzo(256, 256, (g) => {
  g.fillStyle = '#a49c8e'; g.fillRect(0, 0, 256, 256);
  // Baldosa de cuatro pastillas, la típica de las aceras
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = `hsl(36,11%,${rand(58, 63)}%)`; g.beginPath(); g.roundRect(i * 128 + 8, j * 128 + 8, 112, 112, 18); g.fill(); }
  ruido(g, 256, 256, 2500, 0.05);
}, rep);
const texCesped = rep => texLienzo(256, 256, (g) => {
  g.fillStyle = '#6fae4c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1600; i++) { g.fillStyle = `hsla(${88 + Math.random() * 30},50%,${30 + Math.random() * 22}%,.55)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 5); }
}, rep);
const texLadrillo = rep => texLienzo(256, 256, (g) => {
  g.fillStyle = '#d9cfbf'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < 256; x += 64) {
    g.fillStyle = `hsl(${12 + rand(-4, 6)}, ${48 + rand(-8, 8)}%, ${44 + rand(-6, 6)}%)`; g.fillRect(x + 2, y + 2, 60, 28);
  }
  ruido(g, 256, 256, 2000, 0.06);
}, rep);
function texCartel(lineas, fondo, tinta, w = 512, h = 128, borde = null) {
  return texLienzo(w, h, (g) => {
    g.fillStyle = fondo; g.fillRect(0, 0, w, h);
    if (borde) { g.strokeStyle = borde; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
    g.fillStyle = tinta; g.textAlign = 'center'; g.textBaseline = 'middle';
    lineas.forEach(([txt, tam, y]) => { g.font = `900 ${tam}px Nunito, Arial, sans-serif`; g.fillText(txt, w / 2, y); });
  });
}
function plano(w, h, material, x, y, z, ry = 0, padre = scene) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true;
  padre.add(m);
  return m;
}
function suelo(x1, x2, z1, z2, mapa, y = 0.01, rough = 0.9) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), new THREE.MeshStandardMaterial({ map: mapa, roughness: rough }));
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
        const opts = [[p.x - b.minX + r, -1, 0], [b.maxX - p.x + r, 1, 0], [p.z - b.minZ + r, 0, -1], [b.maxZ - p.z + r, 0, 1]];
        opts.sort((a, c) => a[0] - c[0]);
        p.x += opts[0][1] * opts[0][0]; p.z += opts[0][2] * opts[0][0];
      }
    }
  }
}

/* =========================================================================
   EL BARRIO: la calle, el taller, el piso de Doña Remedios y el chalet
   ========================================================================= */
const T = 0.2, H_ALTA = 2.7, H_BAJA = 1.45;
const COL_PARED = 0xf1e2c4, COL_REMATE = 0x7d5235;

suelo(-70, 70, -50, 50, texCesped([40, 40]), 0, 1);
suelo(-70, 70, 10.6, 17.5, texAsfalto([28, 3]), 0.006);
suelo(-34, 38, 5, 10.6, texAcera([36, 3]), 0.008);
caja(72, 0.14, 0.25, 0xbab3a6, 2, 0.07, 10.6, scene, false); // bordillo
for (let x = -66; x < 70; x += 4) caja(2, 0.02, 0.18, 0xf5f0d8, x, 0.012, 14, scene, false);
// Pasos de cebra
for (let i = 0; i < 6; i++) caja(0.5, 0.02, 6.6, 0xf3f0e6, -8 + i * 0.9, 0.013, 14.1, scene, false);

function pared(x1, z1, x2, z2, h, color = COL_PARED) {
  const vert = x1 === x2;
  const len = vert ? Math.abs(z2 - z1) : Math.abs(x2 - x1);
  const w = vert ? T : len + T, d = vert ? len + T : T;
  const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
  caja(w, h, d, color, cx, h / 2, cz);
  caja(w + 0.05, 0.08, d + 0.05, COL_REMATE, cx, h, cz, scene, true, 0.02);
  caja(w + 0.03, 0.16, d + 0.03, 0xc9b28d, cx, 0.08, cz, scene, false);
  addCol(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2);
}
// Medianeras entre edificios (no se puede pasar)
const matLadrillo = new THREE.MeshStandardMaterial({ map: texLadrillo([2, 2]), roughness: 0.95 });
for (const x of [-12.5, 12.5]) { caja(3, 1.45, 13.2, matLadrillo, x, 0.725, -1.6); caja(3.06, 0.08, 13.26, COL_REMATE, x, 1.45, -1.6); addCol(x - 1.5, x + 1.5, -8.2, 5); }

/* ---------- 1. El taller de Arricio y Jeremías ---------- */
suelo(-31, -14, -6, 5, texHormigon([4, 3]), 0.01, 0.95);
pared(-31, -6, -14, -6, H_ALTA, 0xe6dccb);
pared(-31, -6, -31, 5, H_ALTA, 0xe6dccb);
pared(-14, -6, -14, 5, H_ALTA, 0xe6dccb);
pared(-31, 5, -24, 5, H_BAJA, 0xe6dccb);
pared(-20, 5, -14, 5, H_BAJA, 0xe6dccb);
// Persiana metálica enrollada sobre la puerta
for (const x of [-24, -20]) caja(0.18, 1.6, 0.24, mat(0x6d7278, 0.45, 0.6), x, 0.8, 5, scene, true, 0.03);
// Rótulos del taller (por fuera)
const rotuloTaller = plano(6.6, 1.15, new THREE.MeshStandardMaterial({
  roughness: 0.6,
  map: texLienzo(1024, 180, (g, w, h) => {
    g.fillStyle = '#1f4e8c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#f2a33a'; g.fillRect(0, h - 26, w, 26);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 78px Nunito, Arial'; g.fillText('ARRICIO Y JEREMÍAS', w / 2, 62);
    g.font = '800 36px Nunito, Arial'; g.fillText('REFORMAS · CHAPUZAS A DOMICILIO', w / 2, 128);
  }),
}), -27.5, 0.78, 5.115);
plano(5.6, 1.15, new THREE.MeshStandardMaterial({
  roughness: 0.6,
  map: texCartel([['☎ 91 555 12 34', 70, 55], ['Fontanería · Pintura · Albañilería · Electricidad', 30, 120]], '#f2a33a', '#2a1e12', 1024, 180),
}), -17, 0.78, 5.115);
// Estantería de herramientas
caja(8.9, 2.2, 0.06, 0x8a6a48, -24.6, 1.1, -5.86, scene, true);
for (const y of [0.45, 1.1, 1.75]) caja(8.9, 0.06, 0.6, 0xa8825a, -24.6, y, -5.56, scene, true, 0.01);
for (const x of [-29.05, -20.15]) caja(0.08, 2.2, 0.6, 0x8a6a48, x, 1.1, -5.56);
addCol(-29.1, -20.1, -5.9, -5.26);
// Botes y cajas en la balda de arriba y abajo
for (let i = 0; i < 9; i++) cilindro(0.13, 0.13, 0.28, pick([0xd8382c, 0x2f5fa8, 0xf2a33a, 0x3fae5a, 0xe9e2d0]), -28.6 + i * 0.95, 1.92, -5.55, scene, 14);
for (let i = 0; i < 4; i++) cajaR(0.8, 0.34, 0.45, 0xb0844f, -28.2 + i * 2.1, 0.65, -5.55, scene, 0.02);
// Banco de trabajo con tornillo
cajaR(0.8, 0.08, 4.0, 0x9b6a3c, -30.35, 0.9, -1.6, scene, 0.02);
for (const z of [-3.4, 0.2]) for (const x of [-30.65, -30.05]) caja(0.07, 0.9, 0.07, 0x6b4321, x, 0.45, z);
cajaR(0.25, 0.18, 0.3, 0x2f5fa8, -30.1, 1.03, -0.4, scene, 0.03);
cajaR(0.5, 0.1, 0.3, 0x9aa3ab, -30.3, 0.99, -2.4, scene, 0.02);
addCol(-30.8, -29.9, -3.6, 0.4);
// Panel de herramientas en la pared (siluetas pintadas)
plano(3.2, 1.2, new THREE.MeshStandardMaterial({
  roughness: 0.9,
  map: texLienzo(512, 192, (g, w, h) => {
    g.fillStyle = '#d7c39c'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = 10; x < w; x += 18) for (let y = 10; y < h; y += 18) g.fillRect(x, y, 4, 4);
    g.fillStyle = '#3b3b3b';
    g.fillRect(40, 30, 12, 120); g.fillRect(20, 30, 52, 18);
    g.fillRect(130, 40, 100, 14); g.fillRect(140, 54, 10, 80);
    g.beginPath(); g.moveTo(280, 30); g.lineTo(380, 30); g.lineTo(380, 60); g.lineTo(280, 140); g.fill();
    g.fillRect(420, 30, 16, 120); g.fillRect(410, 30, 36, 30);
  }),
}), -30.88, 1.8, -1.6, Math.PI / 2);
// Mostrador (aquí esperan los clientes que vienen al taller)
cajaR(2.5, 1.0, 0.7, 0x7b4a28, -25.8, 0.5, 1.25, scene, 0.03);
cajaR(2.6, 0.06, 0.8, 0xc79a5b, -25.8, 1.03, 1.25, scene, 0.02);
cajaR(0.45, 0.25, 0.35, 0x444444, -26.6, 1.18, 1.2, scene, 0.04); // caja registradora
cajaR(0.3, 0.03, 0.22, 0xfff6e4, -25.3, 1.08, 1.25, scene, 0.01); // libreta de encargos
addCol(-27.05, -24.55, 0.9, 1.6);
// Mesa del teléfono, teléfono antiguo y calendario
cajaR(1.6, 0.06, 1.0, 0x9b6a3c, -15.0, 0.78, -3.3, scene, 0.02);
for (const [dx, dz] of [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]]) caja(0.06, 0.78, 0.06, 0x6b4321, -15.0 + dx, 0.39, -3.3 + dz);
addCol(-15.8, -14.1, -3.8, -2.8);
const telefono = new THREE.Group(); telefono.position.set(-15.25, 0.81, -3.3); scene.add(telefono);
cajaR(0.34, 0.12, 0.28, 0xb8322b, 0, 0.06, 0, telefono, 0.05);
cilindro(0.09, 0.09, 0.02, 0xf2efe6, 0.02, 0.13, 0.04, telefono, 18);
const auricular = new THREE.Group(); auricular.position.set(0, 0.17, -0.02); telefono.add(auricular);
{ const a = capsula(0.035, 0.26, 0xb8322b, 0, 0, 0, auricular); a.rotation.z = Math.PI / 2; esfera(0.055, 0xb8322b, -0.15, -0.02, 0, auricular, 12); esfera(0.055, 0xb8322b, 0.15, -0.02, 0, auricular, 12); }
plano(0.9, 1.2, new THREE.MeshStandardMaterial({
  roughness: 0.9,
  map: texLienzo(180, 240, (g, w, h) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, 50);
    g.fillStyle = '#fff'; g.font = '900 20px Nunito, Arial'; g.textAlign = 'center'; g.fillText('FERRETERÍA', w / 2, 22); g.fillText('EL TORNILLO', w / 2, 42);
    g.fillStyle = '#2a1e12'; g.font = '800 16px Nunito, Arial'; g.fillText('NOVIEMBRE', w / 2, 74);
    g.font = '700 13px Nunito, Arial';
    for (let d = 1; d <= 30; d++) { const i = (d + 4) % 7, j = Math.floor((d + 4) / 7); g.fillStyle = i === 6 ? '#c0392b' : '#2a1e12'; g.fillText(d, 20 + i * 23, 100 + j * 26); }
  }),
}), -14.11, 1.75, -3.3, -Math.PI / 2);
// Sofá viejo (para la siesta del compañero) y mesita con radio
{
  const g = new THREE.Group(); g.position.set(-30.2, 0, 3.7); g.rotation.y = Math.PI / 2; scene.add(g);
  cajaR(2.4, 0.45, 0.9, 0x8a6a3a, 0, 0.3, 0, g, 0.08);
  cajaR(2.4, 0.65, 0.25, 0x7a5a2e, 0, 0.6, -0.34, g, 0.08);
  cajaR(0.25, 0.55, 0.9, 0x7a5a2e, -1.1, 0.45, 0, g, 0.08); cajaR(0.25, 0.55, 0.9, 0x7a5a2e, 1.1, 0.45, 0, g, 0.08);
  cajaR(0.5, 0.2, 0.4, 0x3f6f8f, 0.3, 0.6, 0.05, g, 0.06); // un cojín de otro sofá
  addCol(-30.75, -29.65, 2.5, 4.9);
}
cajaR(0.9, 0.05, 0.9, 0xc79a5b, -18, 0.72, 2.6, scene, 0.02);
for (const [dx, dz] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) caja(0.05, 0.72, 0.05, 0x6b4321, -18 + dx, 0.36, 2.6 + dz);
addCol(-18.45, -17.55, 2.15, 3.05);
cajaR(0.34, 0.2, 0.14, 0x3b3b3b, -18.15, 0.85, 2.5, scene, 0.03); // radio
cilindro(0.01, 0.01, 0.35, 0xbdbdbd, -18.0, 1.1, 2.48, scene, 6).rotation.z = -0.4;
cajaR(0.45, 0.06, 0.45, 0x8a5a3a, -18, 0.45, 3.5, scene, 0.02); // taburete
cilindro(0.03, 0.03, 0.45, 0x6b4321, -18, 0.22, 3.5, scene, 8);
// Sacos de cemento, cubos y escalera
for (let i = 0; i < 4; i++) cajaR(0.6, 0.22, 0.42, 0xd8d2c4, -15.6 + (i % 2) * 0.62, 0.11 + Math.floor(i / 2) * 0.22, 1.5, scene, 0.08);
addCol(-16.0, -14.3, 1.2, 1.8);
cilindro(0.2, 0.17, 0.35, 0x9aa3ab, -16.2, 0.18, 0.6, scene, 16).material = mat(0x9aa3ab, 0.4, 0.7);
{ const e = new THREE.Group(); e.position.set(-14.35, 0, -0.9); e.rotation.z = 0.18; scene.add(e); for (const z of [-0.25, 0.25]) caja(0.06, 2.4, 0.06, 0xb0b0b0, 0, 1.2, z, e); for (let i = 0; i < 7; i++) caja(0.05, 0.04, 0.5, 0xb0b0b0, 0, 0.3 + i * 0.32, 0, e); }
// Bombilla colgando del taller
const luzTaller = new THREE.PointLight(0xffe2b0, 10, 14, 1.5); luzTaller.position.set(-22, 2.6, -1); scene.add(luzTaller);
// Póster de fútbol (genérico)
plano(0.8, 1.1, new THREE.MeshStandardMaterial({ roughness: 0.9, map: texCartel([['⚽', 90, 70], ['EL EQUIPO', 30, 150], ['DEL BARRIO', 30, 190]], '#3fae5a', '#ffffff', 200, 260) }), -27, 1.8, -5.82);

/* ---------- 2. La calle: furgoneta, farolas, árboles, edificios ---------- */
function furgoneta(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const blanco = mat(0xf4f4f0, 0.35, 0.2);
  cajaR(3.4, 1.9, 2.1, blanco, -0.5, 1.3, 0, g, 0.18);
  cajaR(1.3, 1.3, 2.0, blanco, 1.6, 1.0, 0, g, 0.18);
  cajaR(0.06, 0.6, 1.7, mat(0x6fb3d9, 0.1, 0.3), 2.24, 1.38, 0, g, 0.02);
  cajaR(0.9, 0.55, 0.05, mat(0x6fb3d9, 0.1, 0.3), 1.6, 1.38, 1.0, g, 0.02);
  cajaR(0.2, 0.28, 2.15, 0x2b2b2b, 2.3, 0.55, 0, g, 0.05);
  for (const [wx, wz] of [[-1.4, 1.02], [1.4, 1.02], [-1.4, -1.02], [1.4, -1.02]]) {
    const r = cilindro(0.42, 0.42, 0.3, mat(0x1e1e1e, 0.9), wx, 0.42, wz, g, 22); r.rotation.x = Math.PI / 2;
    const l = cilindro(0.22, 0.22, 0.32, mat(0xcfcfcf, 0.3, 0.8), wx, 0.42, wz, g, 14); l.rotation.x = Math.PI / 2;
  }
  const rot = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.5), new THREE.MeshStandardMaterial({
    roughness: 0.5,
    map: texLienzo(512, 256, (c, w, h) => {
      c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2a33a'; c.fillRect(0, 150, w, 40);
      c.fillStyle = '#1f4e8c'; c.textAlign = 'center';
      c.font = '900 58px Nunito, Arial'; c.fillText('ARRICIO Y', w / 2, 62);
      c.font = '900 58px Nunito, Arial'; c.fillText('JEREMÍAS', w / 2, 124);
      c.fillStyle = '#2a1e12'; c.font = '800 26px Nunito, Arial'; c.fillText('Reformas y chapuzas a domicilio', w / 2, 179);
      c.font = '800 28px Nunito, Arial'; c.fillText('☎ 91 555 12 34', w / 2, 230);
    }),
  }));
  rot.position.set(-0.5, 1.35, 1.06); g.add(rot);
  // Escalera en la baca
  for (const zz of [-0.3, 0.3]) caja(3.0, 0.06, 0.1, 0xb0b0b0, -0.5, 2.32, zz, g);
  for (let i = 0; i < 7; i++) caja(0.05, 0.05, 0.6, 0xb0b0b0, -1.9 + i * 0.47, 2.32, 0, g);
  addCol(x - 2.0, x + 2.4, z - 1.1, z + 1.1);
}
furgoneta(-27.5, 8.4);
function farola(x, z) {
  cilindro(0.07, 0.1, 3.8, mat(0x2b2b2b, 0.5, 0.6), x, 1.9, z, scene, 10);
  const c = cajaR(0.32, 0.4, 0.32, mat(0xfff3b0, 0.2), x, 3.9, z, scene, 0.06); c.material = new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0x6a5a20, roughness: 0.3 });
  addCol(x - 0.15, x + 0.15, z - 0.15, z + 0.15);
}
[-32, -9, 8, 30].forEach(x => farola(x, 10.1));
function arbol(x, z, s = 1, alcorque = false) {
  if (alcorque) caja(1.1, 0.04, 1.1, 0x6b4f35, x, 0.02, z, scene, false);
  cilindro(0.16 * s, 0.24 * s, 1.8 * s, 0x6e4a2c, x, 0.9 * s, z, scene, 10);
  esfera(1.0 * s, mat(0x4f9a3f, 0.95), x, 2.4 * s, z, scene, 14);
  esfera(0.75 * s, mat(0x5fae4a, 0.95), x + 0.55 * s, 2.85 * s, z + 0.25, scene, 12);
  esfera(0.7 * s, mat(0x468a37, 0.95), x - 0.5 * s, 2.7 * s, z - 0.2, scene, 12);
  addCol(x - 0.25, x + 0.25, z - 0.25, z + 0.25);
}
[[-20, 9.9], [-4, 9.9], [16, 9.9], [35, 9.9]].forEach(([x, z]) => arbol(x, z, 0.9, true));
[[-36, -3], [-38, 4], [40, -2], [42, 6], [-6, -12], [3, -13], [10, -11.5], [-20, -10], [25, -13], [-28, -10]].forEach(([x, z], i) => arbol(x, z, 0.9 + (i % 3) * 0.25));
// Banco y contenedor
cajaR(1.6, 0.08, 0.45, 0x8a5a3a, 2, 0.48, 9.9, scene, 0.02); cajaR(1.6, 0.4, 0.06, 0x8a5a3a, 2, 0.75, 10.15, scene, 0.02);
for (const dx of [-0.65, 0.65]) caja(0.06, 0.48, 0.4, 0x333333, 2 + dx, 0.24, 9.95);
addCol(1.2, 2.8, 9.65, 10.2);
cajaR(1.4, 1.2, 1.0, mat(0x2e7d32, 0.5), 22, 0.6, 9.9, scene, 0.06); addCol(21.3, 22.7, 9.4, 10.4);
// Límites de la calle (invisibles)
addCol(-40, 44, 10.7, 11.5);
addCol(-36, -33.2, 5, 11.5);
addCol(37.2, 40, 5, 11.5);
// Edificios del barrio enfrente: ladrillo y balcones de hierro
const coloresEdif = [0xd98c6a, 0xe8b07a, 0xc9a07a, 0xe3c4a0, 0xcf7f5e];
for (let i = 0; i < 12; i++) {
  const x = -42 + i * 8, h = rand(9, 14);
  caja(7.6, h, 5, coloresEdif[i % 5], x, h / 2, 22.5);
  caja(7.8, 0.3, 5.2, 0x8a6a4a, x, h, 22.5);
  for (let fy = 3.2; fy < h - 1; fy += 2.8) for (let fx = -2.5; fx <= 2.5; fx += 2.5) {
    cajaR(1.0, 1.6, 0.08, mat(0x5d8fb3, 0.15, 0.3), x + fx, fy, 19.98, scene, 0.02);
    cajaR(1.4, 0.08, 0.6, 0x6b6b6b, x + fx, fy - 0.85, 19.7, scene, 0.02);
    for (let k = -3; k <= 3; k++) caja(0.03, 0.55, 0.03, 0x2b2b2b, x + fx + k * 0.2, fy - 0.55, 19.42, scene, false);
    caja(1.4, 0.04, 0.04, 0x2b2b2b, x + fx, fy - 0.27, 19.42, scene, false);
  }
  // Bajos comerciales
  cajaR(3, 2.2, 0.1, mat(0x7a5a3a, 0.6), x, 1.1, 19.98, scene, 0.02);
}
// Fachadas traseras sobre las casas (ladrillo), para cerrar el barrio
caja(26, 7, 1, matLadrillo, -22.5, 3.5, -7.2);

/* ---------- 3. El piso de Doña Remedios ---------- */
suelo(-11, 0, -1.5, 5, texParquet([3, 2]));
suelo(-11, 0, -8, -1.5, texParquet([3, 2]));
suelo(0, 11, -1.5, 5, texBaldosa('#f4f1ea', '#2b2b2b', [5, 3]));
suelo(0, 11, -8, -1.5, texBaldosa('#ffffff', '#8fc3d9', [5, 3]));
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
caja(0.1, 2.0, 1.9, 0x7b4a28, -3.05, 1.0, 5.95, scene, true, 0.02);
esfera(0.05, mat(0xd4af37, 0.3, 0.9), -2.98, 1.0, 6.75);
plano(3.6, 0.8, new THREE.MeshStandardMaterial({ roughness: 0.7, map: texCartel([['Nº 7 · 2º B · Remedios', 52, 64]], '#e9dfc8', '#3b2410', 768, 128) }), 5, 0.75, 5.115);
{
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshStandardMaterial({
    roughness: 1, map: texCartel([['BIENVENIDOS', 52, 40], ['(a ser posible, limpios)', 26, 90]], '#a77b47', '#3b2410', 512, 128),
  }));
  f.rotation.x = -Math.PI / 2; f.position.set(-2, 0.02, 5.75); scene.add(f);
}
// Salón
{
  const g = new THREE.Group(); g.position.set(-8.5, 0, 4.2); scene.add(g);
  cajaR(3, 0.45, 0.95, 0x6f9a52, 0, 0.3, 0, g, 0.1);
  cajaR(3, 0.7, 0.25, 0x5f8a44, 0, 0.62, 0.36, g, 0.1);
  cajaR(0.25, 0.6, 0.95, 0x5f8a44, -1.4, 0.45, 0, g, 0.1);
  cajaR(0.25, 0.6, 0.95, 0x5f8a44, 1.4, 0.45, 0, g, 0.1);
  cajaR(0.55, 0.35, 0.14, 0xe8c547, -0.7, 0.72, 0.18, g, 0.06).rotation.x = -0.3;
  cajaR(0.5, 0.02, 0.3, 0xffffff, 0.6, 0.98, 0.36, g, 0.01);
  addCol(-10, -7, 3.72, 4.68);
}
cajaR(1.8, 0.55, 0.5, 0x8a5a3a, -8.5, 0.28, -1.0, scene, 0.03);
addCol(-9.4, -7.6, -1.3, -0.7);
cajaR(1.0, 0.75, 0.55, 0x2a2a2a, -8.5, 0.95, -1.05, scene, 0.06);
{
  const p = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.6), new THREE.MeshBasicMaterial({ map: texCartel([['TELECOMPRA', 40, 50], ['¡LLAME YA!', 52, 110]], '#2e6fd8', '#fff', 256, 160) }));
  p.position.set(-8.5, 0.95, -0.77); scene.add(p);
}
{
  const a = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.2), new THREE.MeshStandardMaterial({
    roughness: 1,
    map: texLienzo(256, 160, (g, w, h) => {
      g.fillStyle = '#9b2d2d'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e7c46a'; g.lineWidth = 8; g.strokeRect(12, 12, w - 24, h - 24);
      g.fillStyle = '#e7c46a'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(40 + i * 44, 80, 12, 0, 7); g.fill(); }
    }),
  }));
  a.rotation.x = -Math.PI / 2; a.position.set(-8.3, 0.02, 1.6); a.receiveShadow = true; scene.add(a);
}
function planta(x, z) {
  cilindro(0.25, 0.2, 0.45, 0xb5562e, x, 0.22, z);
  esfera(0.45, mat(0x3d8b3d, 0.95), x, 0.85, z);
  esfera(0.3, mat(0x4fa04f, 0.95), x + 0.2, 1.15, z + 0.1);
  addCol(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
}
planta(-0.6, 4.4);
planta(10.4, 4.4);
// Dormitorio
cajaR(2.2, 0.45, 3.0, 0x7b4a28, -9.7, 0.25, -6.3, scene, 0.04);
cajaR(2.1, 0.2, 2.6, 0xf1f1f1, -9.7, 0.55, -6.15, scene, 0.08);
cajaR(2.15, 0.22, 1.7, 0xc8506f, -9.7, 0.6, -5.6, scene, 0.08);
cajaR(0.8, 0.18, 0.45, 0xffffff, -10.1, 0.72, -7.35, scene, 0.08);
cajaR(0.8, 0.18, 0.45, 0xffffff, -9.25, 0.72, -7.35, scene, 0.08);
cajaR(2.2, 1.1, 0.12, 0x7b4a28, -9.7, 0.55, -7.85, scene, 0.03);
addCol(-10.8, -8.6, -7.8, -4.8);
cajaR(0.55, 0.55, 0.5, 0x8a5a3a, -10.5, 0.28, -4.3, scene, 0.03);
addCol(-10.8, -10.2, -4.55, -4.05);
cajaR(2.2, 2.1, 0.7, 0x9b6a3c, -2.5, 1.05, -7.6, scene, 0.03);
caja(0.02, 1.9, 0.02, 0x5a3a1c, -2.5, 1.05, -7.24);
addCol(-3.6, -1.4, -7.95, -7.25);
// Cocina
cajaR(4.0, 0.9, 0.85, 0xf0ede6, 8.9, 0.45, -1.0, scene, 0.02);
cajaR(4.06, 0.06, 0.9, mat(0x8f8f8f, 0.3, 0.2), 8.9, 0.93, -1.0, scene, 0.01);
for (let i = 0; i < 4; i++) cajaR(0.9, 0.7, 0.02, 0xd9d3c7, 7.4 + i * 1.0, 0.45, -0.57, scene, 0.01);
addCol(6.9, 10.9, -1.42, -0.55);
cajaR(0.95, 1.9, 0.8, mat(0xe9f0f2, 0.3, 0.1), 0.7, 0.95, -0.95, scene, 0.08);
caja(0.04, 0.5, 0.04, 0x888888, 1.1, 1.3, -0.53);
addCol(0.2, 1.2, -1.35, -0.53);
addCol(4.2, 5.8, 2.8, 3.8); // la mesa de la cocina se construye más abajo (es un encargo)
// Baño
cajaR(2.6, 0.6, 0.8, 0xfafafa, 2.3, 0.3, -7.5, scene, 0.1);
caja(2.3, 0.05, 0.55, mat(0x8fc3d9, 0.1), 2.3, 0.58, -7.5, scene, false);
addCol(1.0, 3.6, -7.9, -7.1);
esfera(0.1, 0xffd23f, 2.6, 0.68, -7.45); esfera(0.07, 0xffd23f, 2.68, 0.8, -7.45);
cilindro(0.12, 0.16, 0.8, 0xfafafa, 6.5, 0.4, -7.6);
cajaR(0.7, 0.18, 0.5, 0xfafafa, 6.5, 0.85, -7.6, scene, 0.06);
cajaR(0.7, 0.9, 0.04, mat(0xbfe3f2, 0.05, 0.6), 6.5, 1.7, -7.88, scene, 0.01);
addCol(6.15, 6.85, -7.9, -7.35);

/* ---------- 4. El chalet de Don Leopoldo ---------- */
suelo(14, 36, -1, 5, texCesped([8, 3]), 0.01);
for (let z = -0.7; z < 5; z += 0.9) cajaR(1.1, 0.04, 0.6, 0xd8cfc0, 24.25, 0.03, z, scene, 0.03, false); // camino de losas
const matChalet = mat(0xf6efe2, 0.9);
caja(18, 3.4, 8, matChalet, 25, 1.7, -5);
caja(18.6, 0.3, 8.6, 0xb0533a, 25, 3.55, -5); // alero de teja
addCol(16, 34, -9, -1);
cajaR(1.4, 2.3, 0.12, 0x5a3a20, 24.25, 1.15, -0.98, scene, 0.03); // puerta principal
esfera(0.06, mat(0xd4af37, 0.3, 0.9), 24.75, 1.15, -0.9);
for (const x of [18.5, 21.2, 33]) {
  cajaR(1.5, 1.4, 0.08, mat(0x88b9d8, 0.08, 0.4), x, 1.7, -0.97, scene, 0.02);
  for (const dx of [-0.95, 0.95]) cajaR(0.4, 1.5, 0.06, 0x2f6b3f, x + dx, 1.7, -0.94, scene, 0.02); // contraventanas verdes
}
plano(2.6, 0.6, new THREE.MeshStandardMaterial({ roughness: 0.6, map: texCartel([['Villa Leopoldo', 64, 64]], '#2a1e12', '#e8c46a', 768, 128) }), 24.25, 2.75, -0.95);
// Valla blanca y cancela
for (const [a, b] of [[14, 23.2], [25.3, 36]]) { const w = b - a; cajaR(w, 0.9, 0.18, 0xfafafa, (a + b) / 2, 0.45, 5, scene, 0.04); addCol(a, b, 4.9, 5.1); }
for (const z of [[-1, 5]]) { cajaR(0.18, 0.9, 6, 0xfafafa, 14.1, 0.45, 2, scene, 0.04); cajaR(0.18, 0.9, 6, 0xfafafa, 35.9, 0.45, 2, scene, 0.04); }
addCol(13.9, 14.3, -1, 5); addCol(35.7, 36.1, -1, 5);
for (const x of [23.2, 25.3]) cajaR(0.3, 1.2, 0.3, 0xe9e2d0, x, 0.6, 5, scene, 0.04);
// Piscina, tumbona y sombrilla
caja(3.7, 0.12, 2.4, 0xeae2d2, 21.25, 0.06, 1.3, scene, true);
caja(3.3, 0.02, 2.0, mat(0x3fa7d6, 0.05, 0.1), 21.25, 0.125, 1.3, scene, false);
addCol(19.4, 23.1, 0.1, 2.5);
cajaR(0.7, 0.12, 1.8, 0xffffff, 31, 0.35, 2.8, scene, 0.04); cajaR(0.7, 0.08, 0.6, 0xffffff, 31, 0.55, 1.95, scene, 0.03).rotation.x = -0.6;
addCol(30.6, 31.4, 1.8, 3.7);
cilindro(0.03, 0.03, 2.2, 0xdddddd, 29.6, 1.1, 2.6, scene, 6);
{ const s = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.5, 10), mat(0xd8382c, 0.8)); s.position.set(29.6, 2.3, 2.6); s.castShadow = true; scene.add(s); }

/* =========================================================================
   Personajes
   ========================================================================= */
function crearPersonaje(o) {
  const g = new THREE.Group();
  const cuerpo = new THREE.Group();
  g.add(cuerpo);
  const s = o.ancho || 1;
  const piel = mat(o.piel || 0xf0c4a0, 0.6);
  const matRopa = new THREE.MeshStandardMaterial({ color: o.ropa, roughness: 0.92 });
  const colorRopa = new THREE.Color(o.ropa);
  const matPierna = o.pierna ? mat(o.pierna, 0.9) : matRopa;
  const piernas = [], brazos = [];
  for (const l of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(0.12 * s * l, 0.84, 0); cuerpo.add(p);
    capsula(0.095, 0.5, matPierna, 0, -0.37, 0, p);
    cajaR(0.2, 0.13, 0.34, mat(o.zapatos || 0x2b1d14, 0.6), 0, -0.77, 0.05, p, 0.05);
    piernas.push(p);
  }
  if (o.falda) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.27 * s, 0.36 * s, 0.6, 20), matRopa); f.position.y = 0.66; f.castShadow = true; cuerpo.add(f); }
  // Tronco
  cajaR(0.56 * s, 0.66, 0.34 * s, matRopa, 0, 1.17, 0, cuerpo, 0.13);
  const frente = 0.17 * s + (o.barriga ? 0.1 : 0);
  if (o.barriga) { const b = esfera(0.33, matRopa, 0, 1.06, 0.1, cuerpo, 20); b.scale.set(1.12, 1, 0.92); }
  if (o.peto) { // mono de trabajo: peto con bolsillo y tirantes
    cajaR(0.32 * s, 0.28, 0.04, mat(o.peto, 0.9), 0, 1.28, frente, cuerpo, 0.02);
    cajaR(0.14, 0.1, 0.02, mat(o.bolsillo || o.peto, 0.9), 0.05, 1.3, frente + 0.025, cuerpo, 0.01);
    for (const l of [-1, 1]) cajaR(0.06, 0.3, 0.04, mat(o.peto, 0.9), 0.12 * s * l, 1.48, 0.16 * s, cuerpo, 0.015);
  }
  if (o.camisaPecho) cajaR(0.16, 0.42, 0.02, mat(o.camisaPecho, 0.8), 0, 1.29, 0.172 * s, cuerpo, 0.01);
  if (o.corbata) cajaR(0.07, 0.36, 0.02, mat(o.corbata, 0.6), 0, 1.27, 0.185 * s, cuerpo, 0.01);
  cilindro(0.075, 0.085, 0.12, piel, 0, 1.53, 0, cuerpo, 12);
  for (const l of [-1, 1]) {
    const b = new THREE.Group(); b.position.set((0.28 * s + 0.07) * l, 1.44, 0); cuerpo.add(b);
    capsula(0.075, 0.38, o.manga ? mat(o.manga, 0.9) : matRopa, 0, -0.27, 0, b);
    esfera(0.085, piel, 0, -0.58, 0.01, b, 12);
    brazos.push(b);
  }
  const mano = new THREE.Group(); mano.position.set(0, -0.6, 0.06); brazos[1].add(mano);
  const manoIzq = new THREE.Group(); manoIzq.position.set(0, -0.6, 0.06); brazos[0].add(manoIzq);
  const cabeza = new THREE.Group(); cabeza.position.set(0, 1.8, 0); cuerpo.add(cabeza);
  const cr = esfera(0.25, piel, 0, 0, 0, cabeza, 24); cr.scale.set(1, 1.06, 0.98);
  const ojos = [];
  for (const l of [-1, 1]) {
    const ojo = new THREE.Group(); ojo.position.set(0.085 * l, 0.035, 0.2); cabeza.add(ojo);
    esfera(0.047, mat(0xffffff, 0.25), 0, 0, 0, ojo, 12);
    esfera(0.026, mat(0x1b1410, 0.2), 0, 0, 0.033, ojo, 10);
    ojos.push(ojo);
    const ceja = cajaR(0.095, 0.024, 0.03, o.cejas || 0x2a1a10, 0.09 * l, 0.125, 0.215, cabeza, 0.01); ceja.rotation.z = -0.14 * l;
    esfera(0.055, piel, 0.245 * l, 0, 0, cabeza, 10);
  }
  const nariz = esfera(0.055, mat(o.nariz || 0xe2a07e, 0.6), 0, -0.045, 0.245, cabeza, 12); nariz.scale.set(1, 1, 1.25);
  cajaR(0.1, 0.022, 0.02, 0x8a3a30, 0, -0.135, 0.222, cabeza, 0.01);
  if (o.bigote) cajaR(o.bigoteFino ? 0.16 : 0.22, o.bigoteFino ? 0.025 : 0.055, 0.05, o.bigote, 0, -0.095, 0.24, cabeza, 0.02);
  if (o.pelo) { const p = esfera(0.262, mat(o.pelo, 0.7), 0, 0.07, -0.05, cabeza, 20); p.scale.set(1.02, 0.84, 1); }
  if (o.patillas) for (const l of [-1, 1]) cajaR(0.05, 0.14, 0.18, o.patillas, 0.245 * l, 0.03, -0.05, cabeza, 0.02);
  let gorra = null;
  if (o.gorra) {
    gorra = new THREE.Group(); cabeza.add(gorra);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.268, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(o.gorra, 0.85));
    cup.position.y = 0.06; cup.scale.set(1, 0.85, 1); cup.castShadow = true; gorra.add(cup);
    const vis = cajaR(0.3, 0.03, 0.2, mat(o.gorra, 0.85), 0, 0.075, 0.28, gorra, 0.012); vis.rotation.x = 0.12;
    esfera(0.025, mat(o.gorra, 0.85), 0, 0.29, 0, gorra, 8);
  }
  if (o.lapiz) { const l = cajaR(0.025, 0.025, 0.2, 0xe8c547, 0.27, 0.05, 0.02, cabeza, 0.008); l.rotation.y = 0.2; }
  if (o.rulos) {
    esfera(0.262, mat(0xa8a8a8, 0.8), 0, 0.08, -0.05, cabeza, 18).scale.set(1.02, 0.85, 1);
    const cols = [0xff8fb1, 0x8fd3ff, 0xfff08f, 0xb1ff8f];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = cilindro(0.055, 0.055, 0.14, mat(cols[i % 4], 0.5), Math.cos(a) * 0.16, 0.24, Math.sin(a) * 0.16 - 0.04, cabeza, 10);
      r.rotation.z = Math.PI / 2;
    }
  }
  if (o.gafas) for (const l of [-1, 1]) {
    const gafa = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.011, 8, 18), mat(o.gafas, 0.4));
    gafa.position.set(0.085 * l, 0.035, 0.245); cabeza.add(gafa);
  }
  // Pelos de punta (al electrocutarse)
  const pelosPunta = new THREE.Group(); cabeza.add(pelosPunta); pelosPunta.visible = false;
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.3, 6), mat(0x2a1a10));
    const a = (i / 9) * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.15, 0.34, Math.sin(a) * 0.15);
    c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    pelosPunta.add(c);
  }
  if (o.escala) g.scale.setScalar(o.escala);
  scene.add(g);
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; } });
  return { g, cuerpo, piernas, brazos, mano, manoIzq, cabeza, ojos, matRopa, colorRopa, pelosPunta, gorra, fase: 0, parpadeo: rand(1, 4) };
}

function animarAndar(c, dt, vel, trabajando = false, forzar = null) {
  if (c.mixer) {
    const n = forzar || (trabajando ? 'Interact' : vel < 0.25 ? 'Idle' : vel < 5 ? 'Walk' : 'Run');
    const ritmo = n === 'Walk' ? clamp(vel / 2.0, 0.6, 1.7) : n === 'Run' ? clamp(vel / 5.6, 0.8, 1.4) : 1;
    c.anim(n, { ritmo, bucle: n !== 'Death' });
    c.mixer.update(dt);
    return;
  }
  const v = Math.min(1, vel / 3);
  c.fase += dt * (4 + vel * 2.2);
  const sw = Math.sin(c.fase) * 0.6 * v;
  const k = 1 - Math.exp(-14 * dt);
  c.piernas[0].rotation.x = lerp(c.piernas[0].rotation.x, sw, k);
  c.piernas[1].rotation.x = lerp(c.piernas[1].rotation.x, -sw, k);
  c.brazos[0].rotation.x = lerp(c.brazos[0].rotation.x, -sw * 0.8, k);
  if (trabajando) c.brazos[1].rotation.x = -1.3 + Math.sin(performance.now() / 55) * 0.6;
  else c.brazos[1].rotation.x = lerp(c.brazos[1].rotation.x, sw * 0.8, k);
  c.cuerpo.position.y = Math.abs(Math.sin(c.fase)) * 0.045 * v;
  // Respirar y parpadear
  c.cabeza.rotation.z = Math.sin(performance.now() / 900 + c.fase * 0.1) * 0.03;
  c.parpadeo -= dt;
  const cerrado = c.parpadeo < 0.12;
  c.ojos.forEach(o => { o.scale.y = cerrado ? 0.12 : 1; });
  if (c.parpadeo < 0) c.parpadeo = rand(2, 5);
}

function crearGato() {
  const g = new THREE.Group();
  const naranja = mat(0xe98a2e, 0.95), blanco = mat(0xfff3e0, 0.95);
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  const tronco = esfera(0.22, naranja, 0, 0.3, 0, cuerpo, 16); tronco.scale.set(0.8, 0.8, 1.5);
  const cab = new THREE.Group(); cab.position.set(0, 0.48, 0.32); cuerpo.add(cab);
  esfera(0.16, naranja, 0, 0, 0, cab, 16);
  esfera(0.08, blanco, 0, -0.04, 0.12, cab, 10);
  for (const l of [-1, 1]) {
    const o = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), naranja); o.position.set(0.09 * l, 0.15, 0); cab.add(o);
    esfera(0.03, mat(0xc8e04a, 0.3), 0.06 * l, 0.03, 0.135, cab, 8);
    esfera(0.015, mat(0x111111, 0.3), 0.06 * l, 0.03, 0.16, cab, 6);
  }
  const patas = [];
  for (const [x, z] of [[-0.1, 0.18], [0.1, 0.18], [-0.1, -0.18], [0.1, -0.18]]) patas.push(capsula(0.035, 0.16, blanco, x, 0.11, z, cuerpo));
  const cola = new THREE.Group(); cola.position.set(0, 0.36, -0.3); cuerpo.add(cola);
  capsula(0.035, 0.4, naranja, 0, 0.2, 0, cola);
  cola.rotation.x = -0.5;
  scene.add(g);
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return { g, cuerpo, patas, cola, cab, fase: 0 };
}

/* =========================================================================
   Personajes 3D con esqueleto y animaciones (modelos CC0 de Quaternius)
   ========================================================================= */
// Dibujos de la ropa calculados en el propio material: cuadros, manchas de pintura y flores
function aplicarPatron(malla, tipo) {
  const m = malla.material;
  malla.geometry.computeBoundingBox();
  const bb = malla.geometry.boundingBox;
  const alto = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z);
  const celda = alto / ({ cuadros: 11, manchas: 8, flores: 12 }[tipo]);
  m.customProgramCacheKey = () => 'patron-' + tipo;
  m.onBeforeCompile = sh => {
    sh.uniforms.uCelda = { value: celda };
    sh.vertexShader = 'varying vec3 vPat;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPat = position;');
    const comun = 'varying vec3 vPat;\nuniform float uCelda;\nfloat hashP(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n';
    const codigo = {
      cuadros: `
        vec3 q = vPat / uCelda;
        float a = step(0.5, fract(q.x)), b = step(0.5, fract(q.y)), c2 = step(0.5, fract(q.z));
        float linea = max(max(step(0.9, fract(q.x * 2.0)), step(0.9, fract(q.y * 2.0))), step(0.9, fract(q.z * 2.0)));
        vec3 col = mix(vec3(0.10, 0.16, 0.32), vec3(0.86, 0.87, 0.9), 0.3 * (a + b + c2));
        diffuseColor.rgb = mix(col, vec3(0.04), linea * 0.55);`,
      manchas: `
        vec3 q = vPat / uCelda; vec3 ce = floor(q); vec3 f = fract(q);
        float h = hashP(ce); vec3 o = vec3(hashP(ce + 1.3), hashP(ce + 2.7), hashP(ce + 4.1)) * 0.6 + 0.2;
        float d = length(f - o);
        if (h > 0.45 && d < 0.14 + 0.16 * hashP(ce + 9.1)) diffuseColor.rgb = h > 0.88 ? vec3(0.9, 0.9, 0.86) : vec3(0.2, 0.42, 0.8);`,
      flores: `
        vec3 q = vPat / uCelda; vec3 ce = floor(q); vec3 f = fract(q);
        float h = hashP(ce); vec3 o = vec3(hashP(ce + 1.3), hashP(ce + 2.7), hashP(ce + 4.1)) * 0.5 + 0.25;
        float d = length(f - o);
        if (h > 0.3) { if (d < 0.09) diffuseColor.rgb = vec3(0.86, 0.3, 0.2); else if (d < 0.24) diffuseColor.rgb = vec3(1.0, 0.92, 0.6); }`,
    }[tipo];
    sh.fragmentShader = comun + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n' + codigo);
  };
  m.needsUpdate = true;
}
// Gorra blanca de las de toda la vida (visera hacia delante o hacia atrás)
function gorraBlanca(radio, haciaAtras) {
  const g = new THREE.Group();
  const blanco = mat(0xf1f0ea, 0.85);
  const cup = new THREE.Mesh(new THREE.SphereGeometry(radio, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), blanco);
  cup.scale.set(1.02, 0.82, 1.08); cup.castShadow = true; g.add(cup);
  const visera = new THREE.Mesh(new THREE.CylinderGeometry(radio * 0.95, radio * 0.95, 0.012, 24, 1, false, -Math.PI / 2.6, Math.PI / 1.3), blanco);
  visera.position.set(0, 0.006, radio * 0.42); visera.scale.set(0.95, 1, 1.15); visera.rotation.x = 0.08; visera.castShadow = true; g.add(visera);
  esfera(radio * 0.08, blanco, 0, radio * 0.82, 0, g, 8);
  if (haciaAtras) g.rotation.y = Math.PI;
  return g;
}
const DEF_MODELOS = {
  arricio: {
    archivo: 'arricio', altura: 1.74, ancho: 1, cabeza: 'Farmer_Head_1', cuerpoMalla: 'Farmer_Body_1',
    ocultar: ['Farmer_Head_2', 'Farmer_Head_4'],
    colores: { Farmer_Pants: 0x8e9884, Farmer_Body_2: 0x8e9884, Farmer_Body_4: 0xc9a27e },
    patrones: { Farmer_Body_1: 'cuadros', Farmer_Pants: 'manchas', Farmer_Body_2: 'manchas' },
    tinte: ['Farmer_Pants', 'Farmer_Body_2'], gorra: 'delante', gorraY: -0.22, gorraR: 1.18,
  },
  jeremias: {
    archivo: 'jeremias', altura: 1.76, ancho: 1, cabeza: 'Punk_Head_1', cuerpoMalla: 'Punk_Body_3',
    ocultar: ['Punk_Head_2', 'Punk_Head_3', 'Punk_Head_4'],
    colores: { Punk_Body_1: 0xeaa3b4, Punk_Body_3: 0xeeeeea, Punk_Legs_1: 0x8a9580, Punk_Legs_2: 0x8a9580 },
    tinte: ['Punk_Body_1', 'Punk_Legs_1', 'Punk_Legs_2'], gorra: 'atras', gorraY: -0.72, gorraR: 1.08,
  },
  leopoldo: {
    archivo: 'leopoldo', altura: 1.8, ancho: 1, cabeza: 'Worker_Head_2', cuerpoMalla: 'Worker_Body_3',
    ocultar: ['Worker_Head_1'],
    colores: { Worker_Body_1: 0x2c313c, Worker_Body_2: 0x2c313c, Worker_Body_3: 0xf3f3f3, Worker_Legs_1: 0x2c313c, Worker_Legs_2: 0x2c313c, Worker_Head_5: 0x1a1410 },
    tinte: ['Worker_Body_2', 'Worker_Legs_1', 'Worker_Legs_2'], pelo: 0x141414, corbata: 0xa0182b,
  },
  remedios: {
    archivo: 'remedios', altura: 1.6, ancho: 1, cabeza: 'Suit_Head_1', cuerpoMalla: 'Suit_Body_1',
    ocultar: [],
    colores: { Suit_Body_1: 0xd9709d, Suit_Legs: 0xd9709d, Suit_Body_2: 0xf6d3df, Suit_Head_2: 0xb9b9b9, Suit_Head_3: 0xa8a8a8, Suit_Feet_1: 0xff9ec4 },
    patrones: { Suit_Body_1: 'flores', Suit_Legs: 'flores' },
    tinte: ['Suit_Body_1', 'Suit_Legs'], rulos: true, gafas: 0x6b3a2a,
  },
};
const cargadorGLTF = new GLTFLoader();
async function cargarModelo(def) {
  // En GitHub los modelos son .glb; en la página publicada van con extensión .wasm (mismo contenido binario)
  let gltf;
  try { gltf = await cargadorGLTF.loadAsync(`modelos/${def.archivo}.glb`); }
  catch (e) { gltf = await cargadorGLTF.loadAsync(`modelos/${def.archivo}.glb.wasm`); }
  const g = new THREE.Group();
  const cuerpo = new THREE.Group(); g.add(cuerpo);
  const modelo = gltf.scene; cuerpo.add(modelo);
  const mallas = {};
  modelo.traverse(o => {
    if (!o.isMesh) return;
    o.material = o.material.clone();
    o.material.roughness = 0.82; o.material.metalness = 0;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    mallas[o.name] = o;
    if (def.ocultar.includes(o.name)) o.visible = false;
    if (def.colores[o.name] != null) o.material.color.setHex(def.colores[o.name]);
    if (def.patrones?.[o.name]) aplicarPatron(o, def.patrones[o.name]);
  });
  // Escala a la altura deseada y con los pies en el suelo
  modelo.updateMatrixWorld(true);
  let caja = new THREE.Box3().setFromObject(modelo, true);
  const k = def.altura / (caja.max.y - caja.min.y);
  modelo.scale.set(k * def.ancho, k, k * def.ancho);
  modelo.updateMatrixWorld(true);
  caja = new THREE.Box3().setFromObject(modelo, true);
  modelo.position.y -= caja.min.y;
  modelo.updateMatrixWorld(true);
  const huesos = {};
  modelo.traverse(o => { if (o.isBone) huesos[o.name] = o; });
  const enHueso = (hueso, obj, pos) => { obj.position.copy(pos); obj.updateMatrixWorld(true); (hueso || modelo).attach(obj); };
  // Cabeza: se colocan gorra, pelo, rulos y gafas encima del hueso de la cabeza
  const cajaCab = new THREE.Box3().setFromObject(mallas[def.cabeza], true);
  const radio = (cajaCab.max.x - cajaCab.min.x) / 2;
  const centro = cajaCab.getCenter(new THREE.Vector3());
  const cabeza = new THREE.Group();
  enHueso(huesos.Head, cabeza, new THREE.Vector3(centro.x, cajaCab.max.y, centro.z));
  let gorra = null;
  if (def.gorra) { gorra = gorraBlanca(radio * (def.gorraR || 1.06), def.gorra === 'atras'); gorra.position.y = radio * (def.gorraY ?? -0.62); if (def.gorra === 'atras') gorra.rotation.z = 0.06; cabeza.add(gorra); }
  if (def.pelo) { const p = esfera(radio * 1.04, mat(def.pelo, 0.45), 0, -radio * 0.62, -radio * 0.08, cabeza, 22); p.scale.set(1, 0.72, 1); }
  if (def.rulos) {
    const cols = [0xff8fb1, 0x8fd3ff, 0xfff08f, 0xb1ff8f];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = cilindro(radio * 0.2, radio * 0.2, radio * 0.5, mat(cols[i % 4], 0.5), Math.cos(a) * radio * 0.62, -radio * 0.12, Math.sin(a) * radio * 0.62 - radio * 0.1, cabeza, 10);
      r.rotation.z = Math.PI / 2; r.rotation.y = -a;
    }
  }
  if (def.gafas) for (const l of [-1, 1]) {
    const gafa = new THREE.Mesh(new THREE.TorusGeometry(radio * 0.24, radio * 0.035, 8, 18), mat(def.gafas, 0.4));
    gafa.position.set(radio * 0.36 * l, -radio * 1.02, cajaCab.max.z - centro.z + 0.004); cabeza.add(gafa);
  }
  // Pelos de punta (al electrocutarse)
  const pelosPunta = new THREE.Group(); cabeza.add(pelosPunta); pelosPunta.visible = false;
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(radio * 0.14, radio * 1.1, 6), mat(0x2a1a10));
    const a = (i / 9) * Math.PI * 2;
    c.position.set(Math.cos(a) * radio * 0.55, radio * 0.35, Math.sin(a) * radio * 0.55);
    c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    pelosPunta.add(c);
  }
  if (def.corbata) {
    const cc = new THREE.Box3().setFromObject(mallas[def.cuerpoMalla], true);
    const corb = cajaR(0.06, 0.28, 0.015, mat(def.corbata, 0.5), 0, 0, 0, scene, 0.01);
    scene.remove(corb);
    enHueso(huesos.Chest || huesos.Torso, corb, new THREE.Vector3(cc.getCenter(new THREE.Vector3()).x, cc.max.y - 0.2, cc.max.z + 0.005));
  }
  // Manos: aquí van las herramientas y el bocadillo
  const pos = new THREE.Vector3();
  const mano = new THREE.Group(), manoIzq = new THREE.Group();
  huesos.WristR.getWorldPosition(pos); enHueso(huesos.WristR, mano, pos.clone().add(new THREE.Vector3(0, -0.07, 0.03)));
  huesos.WristL.getWorldPosition(pos); enHueso(huesos.WristL, manoIzq, pos.clone().add(new THREE.Vector3(0, -0.07, 0.03)));
  // Animaciones
  const mixer = new THREE.AnimationMixer(modelo);
  const acciones = {};
  for (const clip of gltf.animations) acciones[clip.name.replace('CharacterArmature|', '')] = mixer.clipAction(clip);
  const tinte = def.tinte.map(n => mallas[n]?.material).filter(Boolean);
  const c = {
    g, cuerpo, modelo, mixer, acciones, actual: null, accion: null,
    mano, manoIzq, cabeza, gorra, pelosPunta, fase: 0,
    piernas: [new THREE.Object3D(), new THREE.Object3D()], brazos: [new THREE.Object3D(), new THREE.Object3D()],
    matsTinte: tinte, coloresTinte: tinte.map(m => m.color.clone()),
    anim(nombre, { ritmo = 1, bucle = true, fundido = 0.22 } = {}) {
      const a = this.acciones[nombre] || this.acciones.Idle;
      if (!a) return;
      if (this.accion === a) { a.timeScale = ritmo; return; }
      a.reset(); a.setLoop(bucle ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.clampWhenFinished = !bucle; a.timeScale = ritmo;
      a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(fundido).play();
      if (this.accion) this.accion.fadeOut(fundido);
      this.accion = a; this.actual = nombre;
    },
  };
  c.anim('Idle', { fundido: 0 });
  mixer.update(0.01);
  scene.add(g);
  return c;
}
// Se cargan los cuatro personajes antes de empezar (si fallan, se usan los de piezas)
const PJ = {};
{
  const btn = $('btn-empezar');
  btn.disabled = true; const txt = btn.textContent; btn.textContent = 'Cargando…';
  await Promise.all(Object.entries(DEF_MODELOS).map(async ([id, def]) => {
    try { PJ[id] = await cargarModelo(def); } catch (e) { console.warn('No se pudo cargar el modelo', id, e); }
  }));
  btn.disabled = false; btn.textContent = txt;
}

/* =========================================================================
   Oficios y herramientas (en la estantería del taller)
   ========================================================================= */
const OFICIOS = {
  fontaneria: { nombre: 'Fontanería', persona: 'fontanero', icono: '🚿', color: '#2f7fd8' },
  electricidad: { nombre: 'Electricidad', persona: 'electricista', icono: '⚡', color: '#e0a800' },
  pintura: { nombre: 'Pintura', persona: 'pintor', icono: '🎨', color: '#d8509a' },
  carpinteria: { nombre: 'Carpintería', persona: 'carpintero', icono: '🪚', color: '#9b6a3c' },
  albanileria: { nombre: 'Albañilería', persona: 'albañil', icono: '🧱', color: '#c4541b' },
  jardineria: { nombre: 'Jardinería', persona: 'jardinero', icono: '🌿', color: '#3f9a3f' },
};
const HERRAMIENTAS = {
  llave: { nombre: 'la llave inglesa', corto: 'Llave inglesa', icono: '🔧', oficio: 'fontaneria' },
  desatascador: { nombre: 'el desatascador', corto: 'Desatascador', icono: '🪠', oficio: 'fontaneria' },
  destornillador: { nombre: 'el destornillador', corto: 'Destornillador', icono: '🪛', oficio: 'electricidad' },
  bombilla: { nombre: 'una bombilla nueva', corto: 'Bombillas', icono: '💡', oficio: 'electricidad' },
  brocha: { nombre: 'la brocha', corto: 'Brocha y pintura', icono: '🖌️', oficio: 'pintura' },
  rodillo: { nombre: 'el rodillo', corto: 'Rodillo', icono: '🧻', oficio: 'pintura' },
  martillo: { nombre: 'el martillo', corto: 'Martillo', icono: '🔨', oficio: 'carpinteria' },
  serrucho: { nombre: 'el serrucho', corto: 'Serrucho', icono: '🪚', oficio: 'carpinteria' },
  paleta: { nombre: 'la paleta y el cemento', corto: 'Paleta y cemento', icono: '🧱', oficio: 'albanileria' },
  tijeras: { nombre: 'las tijeras de podar', corto: 'Tijeras de podar', icono: '✂️', oficio: 'jardineria' },
};
const ORDEN_HERR = ['llave', 'desatascador', 'destornillador', 'bombilla', 'brocha', 'rodillo', 'martillo', 'serrucho', 'paleta', 'tijeras'];
const FRASE_OFICIO = {
  fontaneria: ['Fontanero titulado. Por correspondencia.', 'Hoy toca fontanería. Que tiemblen las tuberías.'],
  electricidad: ['Electricista. Si no da calambre, no cuenta.', 'Lo de los cables ya lo veremos sobre la marcha.'],
  pintura: ['Pintor de brocha gorda. Muy gorda.', 'Esto lo pinto yo con los ojos cerrados. Y se notará.'],
  carpinteria: ['Carpintero: mido una vez y corto tres.', 'Madera, clavos y fe. Mucha fe.'],
  albanileria: ['Albañil. ¡Masa, que se seca!', 'Un poco de cemento y como nuevo.'],
  jardineria: ['Jardinero. Las plantas me tienen miedo.', 'Esto se poda en un momentito.'],
};

function crearHerramienta(id) {
  const g = new THREE.Group();
  const gris = mat(0x9aa3ab, 0.35, 0.8), madera = mat(0xa86b35, 0.8);
  switch (id) {
    case 'llave':
      cajaR(0.06, 0.4, 0.03, gris, 0, 0.2, 0, g, 0.012);
      cajaR(0.16, 0.06, 0.04, gris, 0.03, 0.42, 0, g, 0.012); cajaR(0.04, 0.1, 0.04, gris, 0.09, 0.48, 0, g, 0.01); cajaR(0.04, 0.1, 0.04, gris, -0.04, 0.48, 0, g, 0.01);
      break;
    case 'destornillador':
      cilindro(0.04, 0.035, 0.18, mat(0xffc21a, 0.4), 0, 0.09, 0, g, 10);
      cilindro(0.012, 0.012, 0.24, gris, 0, 0.3, 0, g, 6);
      break;
    case 'brocha':
      cilindro(0.025, 0.025, 0.25, madera, 0, 0.12, 0, g, 8);
      cajaR(0.12, 0.05, 0.05, gris, 0, 0.27, 0, g, 0.01);
      cajaR(0.11, 0.12, 0.04, mat(0xf2a33a, 0.9), 0, 0.35, 0, g, 0.01);
      break;
    case 'martillo':
      cilindro(0.025, 0.03, 0.36, madera, 0, 0.18, 0, g, 8);
      cajaR(0.22, 0.07, 0.07, mat(0x555b61, 0.35, 0.8), 0, 0.38, 0, g, 0.015);
      break;
    case 'bombilla':
      cilindro(0.04, 0.04, 0.07, gris, 0, 0.035, 0, g, 10);
      esfera(0.08, new THREE.MeshStandardMaterial({ color: 0xfff7c2, emissive: 0x5a5020, roughness: 0.1 }), 0, 0.14, 0, g, 14);
      break;
    case 'desatascador':
      cilindro(0.022, 0.022, 0.42, madera, 0, 0.27, 0, g, 8);
      { const v = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xc0262b, 0.5)); v.rotation.x = Math.PI; v.position.y = 0.08; g.add(v); }
      break;
    case 'rodillo':
      cilindro(0.02, 0.02, 0.3, madera, 0, 0.15, 0, g, 8);
      cajaR(0.025, 0.025, 0.14, gris, 0, 0.31, 0.06, g, 0.008);
      { const r = cilindro(0.055, 0.055, 0.22, mat(0x7ec8e3, 0.95), 0, 0.31, 0.14, g, 14); r.rotation.z = Math.PI / 2; }
      break;
    case 'serrucho':
      cajaR(0.05, 0.12, 0.07, mat(0xc0392b, 0.5), 0, 0.06, 0, g, 0.015);
      caja(0.012, 0.42, 0.13, gris, 0, 0.33, 0.02, g);
      break;
    case 'paleta':
      cilindro(0.025, 0.03, 0.14, madera, 0, 0.07, 0, g, 8);
      caja(0.015, 0.06, 0.015, gris, 0, 0.17, 0, g);
      { const h = caja(0.012, 0.16, 0.16, gris, 0, 0.27, 0, g); h.rotation.x = Math.PI / 4; }
      esfera(0.05, mat(0x9a9a9a, 0.95), 0.02, 0.3, 0, g, 8);
      break;
    case 'tijeras':
      { const a = cajaR(0.02, 0.3, 0.04, gris, -0.02, 0.32, 0, g, 0.008); a.rotation.z = 0.15; const b = cajaR(0.02, 0.3, 0.04, gris, 0.02, 0.32, 0, g, 0.008); b.rotation.z = -0.15; }
      { const a = cajaR(0.03, 0.2, 0.04, mat(0xc0392b, 0.5), -0.05, 0.09, 0, g, 0.012); a.rotation.z = -0.2; const b = cajaR(0.03, 0.2, 0.04, mat(0xc0392b, 0.5), 0.05, 0.09, 0, g, 0.012); b.rotation.z = 0.2; }
      break;
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}
// Herramientas en la balda central de la estantería del taller
const ranuras = ORDEN_HERR.map((id, i) => {
  const x = -28.5 + i * 0.88;
  const m = crearHerramienta(id);
  m.rotation.z = Math.PI / 2; m.rotation.y = 0.25;
  m.scale.setScalar(1.6);
  m.position.set(x + 0.3, 1.16, -5.55);
  scene.add(m);
  return { id, x, z: -4.75, malla: m };
});
for (const [k, o] of Object.entries(OFICIOS)) {
  const rs = ranuras.filter(r => HERRAMIENTAS[r.id].oficio === k);
  const x0 = rs[0].x, x1 = rs[rs.length - 1].x, ancho = x1 - x0 + 0.8;
  plano(ancho, 0.24, new THREE.MeshStandardMaterial({
    roughness: 0.7, map: texCartel([[`${o.icono} ${o.nombre.toUpperCase()}`, 44, 34]], o.color, '#ffffff', Math.round(ancho * 300), 70),
  }), (x0 + x1) / 2 + 0.15, 0.95, -5.25);
}

/* =========================================================================
   Partículas
   ========================================================================= */
const particulas = [];
const geoPart = new THREE.SphereGeometry(1, 8, 6);
const geoCubo = new THREE.BoxGeometry(1, 1, 1);
const matPart = new Map();
function matP(c, brilla = false) {
  const k = c + (brilla ? 'b' : '');
  if (!matPart.has(k)) matPart.set(k, brilla ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
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
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.7, roughness: 0.05 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.025, z);
  m.scale.setScalar(0.1);
  scene.add(m);
  peligros.push({ tipo: 'charco', x, z, r, m, vida: 28 });
}
function crearPlatano(x, z) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 12, Math.PI * 1.1), mat(0xf3d23a, 0.6));
  m.rotation.x = -Math.PI / 2; m.rotation.z = rand(0, 6);
  m.position.set(x, 0.05, z);
  m.castShadow = true;
  scene.add(m);
  peligros.push({ tipo: 'platano', x, z, r: 0.3, m, vida: 60 });
}
function limpiarPeligros() { peligros.forEach(p => p.m.removeFromParent()); peligros.length = 0; }

/* =========================================================================
   Encargos de los clientes y los objetos que se arreglan (o se rompen más)
   ========================================================================= */
const ENCARGOS = {
  grifo: { nombre: 'Grifo que gotea', herr: 'llave', cliente: 'remedios', sitio: 'Cocina', icono: '🚰', pie: [8.5, 0.05], mira: [8.5, -1.2] },
  vater: { nombre: 'Váter atascado', herr: 'desatascador', cliente: 'remedios', sitio: 'Baño', icono: '🚽', pie: [9.6, -6.35], mira: [9.6, -7.45] },
  enchufe: { nombre: 'Enchufe que echa chispas', herr: 'destornillador', cliente: 'remedios', sitio: 'Cocina', icono: '🔌', pie: [10.1, 3.0], mira: [10.9, 3] },
  bombilla: { nombre: 'Cambiar la bombilla', herr: 'bombilla', cliente: 'remedios', sitio: 'Salón', icono: '💡', pie: [-6.3, 3.45], mira: [-6.3, 4.3] },
  pared: { nombre: 'Pintar la pared del salón', herr: 'brocha', cliente: 'remedios', sitio: 'Salón', icono: '🎨', pie: [-10.05, 1.5], mira: [-10.9, 1.5] },
  cuadro: { nombre: 'Colgar el cuadro de la abuela', herr: 'martillo', cliente: 'remedios', sitio: 'Dormitorio', icono: '🖼️', pie: [-7, -7.05], mira: [-7, -7.9] },
  mesa: { nombre: 'Arreglar la mesa coja', herr: 'serrucho', cliente: 'remedios', sitio: 'Cocina', icono: '🪑', pie: [5, 2.3], mira: [5, 3.3] },
  agujero: { nombre: 'Tapar el agujero de la pared', herr: 'paleta', cliente: 'remedios', sitio: 'Salón', icono: '🕳️', pie: [-0.95, -0.3], mira: [0, -0.3] },
  azulejos: { nombre: 'Poner los azulejos del baño', herr: 'paleta', cliente: 'remedios', sitio: 'Baño', icono: '🧱', pie: [10.1, -4.35], mira: [11, -4.35] },
  fachada: { nombre: 'Pintar la fachada del chalet', herr: 'rodillo', cliente: 'leopoldo', sitio: 'Fachada', icono: '🏠', pie: [29, -0.3], mira: [29, -1] },
  seto: { nombre: 'Podar el seto', herr: 'tijeras', cliente: 'leopoldo', sitio: 'Jardín', icono: '🌳', pie: [17.75, 3.0], mira: [17.75, 4.1] },
  farola: { nombre: 'Arreglar la farola del jardín', herr: 'bombilla', cliente: 'leopoldo', sitio: 'Jardín', icono: '🏮', pie: [32.6, 3.3], mira: [32.6, 4.2] },
};
for (const d of Object.values(ENCARGOS)) d.oficio = HERRAMIENTAS[d.herr].oficio;
const TIPOS = Object.keys(ENCARGOS);
const DESPERFECTOS = {
  grifo: 'Géiser decorativo en la cocina',
  vater: 'Inundación aromática del baño',
  enchufe: 'Apagón general + cejas chamuscadas',
  bombilla: 'Bombilla reventada y salón a oscuras',
  pared: 'Pared en color «chillón de feria»',
  cuadro: 'Cuadro de la abuela en el suelo (otra vez)',
  mesa: 'Mesa de cocina convertida en mesa para enanitos',
  agujero: 'Agujero el doble de grande + pegote de cemento',
  azulejos: 'Azulejos colocados «a lo loco»',
  fachada: 'Fachada estilo «discoteca de verano»',
  seto: 'Seto podado hasta dejarlo calvo',
  farola: 'Farola del jardín fundida a chispazos',
};
const QUEJAS = {
  grifo: '¡Que me han hecho una fuente en la cocina! ¡Como la de Cibeles!',
  vater: '¡Ay, qué peste! ¡Abran las ventanas, por Dios!',
  enchufe: '¡Se ha ido la luz en todo el edificio! ¡La del cuarto me va a matar!',
  bombilla: '¡Ahora no veo ni mis zapatillas!',
  pared: '¡Yo pedí melocotón, no «chillón de verbena»!',
  cuadro: '¡La abuela otra vez al suelo! ¡Que la pobre ya tiene una edad!',
  mesa: '¡Mi mesa! ¡Ahora es una mesa para enanitos!',
  agujero: '¡El agujero es más grande! ¡Ahora veo la cocina desde el sofá!',
  azulejos: '¡Los azulejos están torcidos! ¡Parece el baño de un barco!',
  fachada: '¡Mi fachada! ¡Parece una discoteca de verano! ¡Qué dirán en el club!',
  seto: '¡Mi seto! ¡Lo han dejado más pelado que una bombilla!',
  farola: '¡Mi farola! ¡Ha hecho más chispas que los fuegos artificiales del pueblo!',
};

// --- Grifo ---
const grifo = new THREE.Group(); grifo.position.set(8.5, 0.96, -1.2); scene.add(grifo);
caja(0.8, 0.05, 0.5, mat(0x6b6b6b, 0.3, 0.6), 0, -0.01, 0.1, grifo, false);
const cromo = mat(0xd9dde2, 0.15, 1);
cilindro(0.04, 0.04, 0.35, cromo, 0, 0.17, -0.1, grifo, 10);
cajaR(0.05, 0.05, 0.25, cromo, 0, 0.33, 0.02, grifo, 0.02);
cajaR(0.12, 0.05, 0.05, 0xd8382c, -0.1, 0.25, -0.1, grifo, 0.02); cajaR(0.12, 0.05, 0.05, 0x2f5fa8, 0.1, 0.25, -0.1, grifo, 0.02);
// --- Enchufe ---
cajaR(0.05, 0.22, 0.22, 0xffffff, 10.86, 0.5, 3.0, scene, 0.02);
const quemadura = new THREE.Mesh(new THREE.CircleGeometry(0.45, 18), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.8 }));
quemadura.rotation.y = -Math.PI / 2; quemadura.position.set(10.885, 0.55, 3.0); quemadura.visible = false; scene.add(quemadura);
cajaR(0.3, 0.22, 0.2, mat(0xc9ced3, 0.3, 0.7), 10.4, 1.07, -1.0, scene, 0.04);
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
});
const COLORES_BONITOS = ['#f6c89f', '#cfe8c8', '#c9dcf2', '#f2d0dd', '#fbe7a1'];
const muroPared = plano(3.2, 2.1, new THREE.MeshStandardMaterial({ color: COL_PARED, roughness: 0.95 }), -10.885, 1.2, 1.5, Math.PI / 2);
cilindro(0.18, 0.18, 0.3, 0xf2a33a, -10.4, 0.15, 0.4);
// --- Cuadro de la abuela ---
const cuadro = new THREE.Group(); scene.add(cuadro);
cajaR(1.0, 1.2, 0.06, mat(0xb07a2a, 0.4, 0.3), 0, 0, 0, cuadro, 0.02);
{
  const lienzo = new THREE.Mesh(new THREE.PlaneGeometry(0.82, 1.02), new THREE.MeshStandardMaterial({
    roughness: 0.8,
    map: texLienzo(128, 160, (g) => {
      g.fillStyle = '#c9b48a'; g.fillRect(0, 0, 128, 160);
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
caja(0.04, 0.04, 0.1, 0x777777, -7, 1.95, -7.85);
const POS_CUADRO_COLGADO = { p: new THREE.Vector3(-7, 1.5, -7.85) };
const POS_CUADRO_SUELO = { p: new THREE.Vector3(-7.4, 0.62, -7.6), r: new THREE.Euler(-0.28, 0, 0.05) };
// --- Lámpara de pie ---
const lampara = new THREE.Group(); lampara.position.set(-6.3, 0, 4.3); scene.add(lampara);
cilindro(0.25, 0.3, 0.06, mat(0x5a3a1c, 0.4, 0.4), 0, 0.03, 0, lampara);
cilindro(0.03, 0.03, 1.6, mat(0x5a3a1c, 0.4, 0.4), 0, 0.83, 0, lampara, 8);
{ const p = cilindro(0.2, 0.38, 0.4, 0xf3e0a8, 0, 1.75, 0, lampara, 18); p.material = new THREE.MeshStandardMaterial({ color: 0xf3e0a8, side: THREE.DoubleSide, roughness: 0.9 }); }
const bulbo = esfera(0.09, 0xffffff, 0, 1.62, 0, lampara, 12);
bulbo.material = new THREE.MeshBasicMaterial({ color: 0xfff5c0 });
const luzLampara = new THREE.PointLight(0xffd98a, 5, 7, 1.6);
luzLampara.position.set(-6.3, 1.6, 4.3); scene.add(luzLampara);
addCol(-6.55, -6.05, 4.05, 4.55);
// --- Váter ---
const vater = new THREE.Group(); vater.position.set(9.6, 0, -7.45); scene.add(vater);
const porcelana = mat(0xffffff, 0.15);
cilindro(0.17, 0.2, 0.4, porcelana, 0, 0.2, 0.05, vater);
cilindro(0.28, 0.2, 0.15, porcelana, 0, 0.45, 0.1, vater, 18);
cajaR(0.5, 0.45, 0.2, porcelana, 0, 0.75, -0.25, vater, 0.05);
const aguaVater = cilindro(0.22, 0.22, 0.02, 0x8fc3d9, 0, 0.52, 0.1, vater, 18);
const tapa = cajaR(0.52, 0.04, 0.5, 0xf2f2f2, 0, 0.55, 0.12, vater, 0.02);
addCol(9.25, 9.95, -7.9, -7.05);
// --- Mesa coja de la cocina ---
const mesaCocina = new THREE.Group(); mesaCocina.position.set(5, 0, 3.3); scene.add(mesaCocina);
const tablero = new THREE.Group(); mesaCocina.add(tablero);
cajaR(1.6, 0.08, 1.0, 0xc79a5b, 0, 0, 0, tablero, 0.02);
esfera(0.14, mat(0xff9f1a, 0.5), 0.1, 0.15, 0, tablero); esfera(0.12, mat(0xd8382c, 0.4), -0.15, 0.13, -0.1, tablero);
const patasMesa = [[-0.7, -0.4], [0.7, -0.4], [-0.7, 0.4], [0.7, 0.4]].map(([dx, dz]) => caja(0.08, 1, 0.08, 0x8a5a3a, dx, 0.5, dz, mesaCocina));
function alturaPatas(h, coja = false) {
  patasMesa.forEach((p, i) => { const hh = coja && i === 3 ? h * 0.72 : h; p.scale.y = hh; p.position.y = hh / 2; });
  tablero.position.y = h + 0.04; tablero.rotation.set(0, 0, 0);
}
// --- Agujero en la pared del salón ---
const agujero = new THREE.Mesh(new THREE.CircleGeometry(0.28, 18), new THREE.MeshBasicMaterial({ color: 0x1a1410 }));
agujero.rotation.y = -Math.PI / 2; agujero.position.set(-0.106, 0.8, -0.3); scene.add(agujero);
const pegote = new THREE.Group(); pegote.position.set(-0.15, 0, -0.3); scene.add(pegote);
{ const a = esfera(0.35, mat(0x9a9a9a, 1), 0, 0.75, 0, pegote, 10); a.scale.set(0.5, 1, 1.2); esfera(0.2, mat(0x8a8a8a, 1), -0.1, 0.25, 0.2, pegote, 10); cajaR(0.3, 0.25, 0.3, mat(0x9a9a9a, 1), -0.15, 0.12, -0.25, pegote, 0.05); }
// --- Azulejos del baño ---
const azulejos = [];
for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
  const color = (i + j) % 2 ? 0xffffff : 0x8fc3d9;
  const m = cajaR(0.03, 0.32, 0.32, mat(color, 0.15), 10.87, 0.5 + j * 0.34, -4.86 + i * 0.34, scene, 0.01, false);
  azulejos.push({ m, color, casa: m.position.clone() });
}
// --- Fachada del chalet ---
const muroFachada = plano(4, 2, new THREE.MeshStandardMaterial({ color: 0xf6efe2, roughness: 0.9 }), 29, 1.3, -0.985);
const texFachadaSucia = texLienzo(400, 200, (g, w, h) => {
  g.fillStyle = '#d6c9aa'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(90,80,60,${rand(0.15, 0.4)})`; g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(6, 30), rand(4, 14), 0, 0, 7); g.fill(); }
  g.save(); g.translate(w / 2, h / 2 + 8); g.rotate(-0.06);
  g.font = '900 30px Nunito, Arial'; g.textAlign = 'center'; g.fillStyle = '#3b5bdb'; g.fillText('AQUÍ ESTUVO EL NIETO', 0, 0); g.restore();
});
// --- Seto del jardín ---
const seto = new THREE.Group(); seto.position.set(17.75, 0, 4.1); scene.add(seto);
const setoBase = cajaR(3.2, 0.9, 0.7, mat(0x3f8f3f, 0.95), 0, 0.45, 0, seto, 0.12);
const setoPelos = new THREE.Group(); seto.add(setoPelos);
for (let i = 0; i < 18; i++) esfera(rand(0.15, 0.3), mat(pick([0x4fa04f, 0x3a8a3a, 0x5fb05f]), 0.95), rand(-1.5, 1.5), rand(0.75, 1.3), rand(-0.35, 0.4), setoPelos, 10);
const setoPino = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.3, 9), mat(0x3f8f3f, 0.95)); setoPino.position.set(0.9, 0.85, 0); setoPino.castShadow = true; seto.add(setoPino);
addCol(16.15, 19.35, 3.75, 4.45);
// --- Farola del jardín ---
const farolaJ = new THREE.Group(); farolaJ.position.set(32.6, 0, 4.2); scene.add(farolaJ);
cilindro(0.06, 0.09, 2.3, mat(0x1e1e1e, 0.4, 0.7), 0, 1.15, 0, farolaJ, 10);
const globoFarola = esfera(0.22, 0xffffff, 0, 2.45, 0, farolaJ, 16);
globoFarola.material = new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xffd98a, emissiveIntensity: 1, roughness: 0.2 });
const luzFarola = new THREE.PointLight(0xffd98a, 4, 6, 1.6); luzFarola.position.set(32.6, 2.4, 4.2); scene.add(luzFarola);
addCol(32.45, 32.75, 4.05, 4.35);

// Estado visual de cada sitio: 'ok' | 'roto' | 'chapuza'
const Visual = {
  estado: {}, t: {}, caida: 0,
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
        luzLampara.intensity = est === 'ok' ? 5 : 0;
        break;
      case 'vater':
        aguaVater.material = mat(est === 'ok' ? 0x8fc3d9 : est === 'chapuza' ? 0x6b7a2a : 0x8a7a4a, 0.1);
        tapa.rotation.x = 0;
        break;
      case 'mesa':
        alturaPatas(est === 'chapuza' ? 0.22 : 0.8, est === 'roto');
        break;
      case 'agujero':
        agujero.visible = est !== 'ok'; agujero.scale.setScalar(est === 'chapuza' ? 2.2 : 1);
        pegote.visible = est === 'chapuza';
        break;
      case 'azulejos':
        azulejos.forEach((a, i) => {
          a.m.position.copy(a.casa); a.m.rotation.set(0, 0, 0); a.m.material = mat(a.color, 0.15);
          if (est === 'roto' && i % 2 === 1) {
            a.m.position.set(10.35 + rand(-0.3, 0.2), 0.03, a.casa.z + rand(-0.4, 0.4));
            a.m.rotation.set(0, rand(0, 3), Math.PI / 2);
          }
          if (est === 'chapuza') { a.m.rotation.x = rand(-0.7, 0.7); a.m.position.y += rand(-0.08, 0.08); a.m.material = mat(pick([0xff8fb1, 0xfff08f, 0x9be38f, 0xffffff, 0xd8382c]), 0.15); }
        });
        break;
      case 'fachada':
        if (est === 'roto') { muroFachada.material.map = texFachadaSucia; muroFachada.material.color.set(0xffffff); }
        else if (est === 'chapuza') { muroFachada.material.map = texChillona(); muroFachada.material.color.set(0xffffff); }
        else { muroFachada.material.map = null; muroFachada.material.color.set(0xf6efe2); }
        muroFachada.material.needsUpdate = true;
        break;
      case 'seto':
        setoPelos.visible = est === 'roto'; setoPino.visible = est === 'chapuza';
        setoBase.scale.y = est === 'chapuza' ? 0.22 : 1; setoBase.position.y = est === 'chapuza' ? 0.1 : 0.45;
        break;
      case 'farola':
        globoFarola.material.emissiveIntensity = est === 'ok' ? 1 : 0;
        globoFarola.material.color.set(est === 'chapuza' ? 0x333333 : 0xfff6d0);
        luzFarola.intensity = est === 'ok' ? 4 : 0;
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
        const on = Math.sin(t * 23) > 0.6 && Math.random() < 0.5;
        luzLampara.intensity = on ? 3 : 0;
        bulbo.material.color.set(on ? 0xfff5c0 : 0x8a8a7a);
      }
      if (tipo === 'farola' && est === 'roto') {
        const on = Math.sin(t * 19) > 0.5 && Math.random() < 0.5;
        luzFarola.intensity = on ? 3 : 0; globoFarola.material.emissiveIntensity = on ? 1 : 0;
      }
      if (tipo === 'farola' && est === 'chapuza' && t < 2.5 && Math.random() < dt * 8)
        emitir(32.6, 2.45, 4.2, 3, { color: [0xffd23f, 0xffffff], brilla: true, vel: 2.5, sube: 2, tam: 0.035, vida: 0.5 });
      if (tipo === 'vater' && est === 'roto') {
        if (Math.random() < dt * 3) emitir(9.6, 0.55, -7.35, 1, { color: 0x9a8a5a, vel: 0.1, sube: 0.8, gravedad: 0.5, tam: 0.05, vida: 0.8 });
        if (Math.random() < dt * 2) emitir(9.6 + rand(-0.3, 0.3), 1.0, -7.3, 1, { color: 0x111111, brilla: true, vel: 1.5, sube: 0.6, gravedad: 0, tam: 0.025, vida: 1.2 });
        tapa.rotation.x = Math.sin(t * 9) * 0.06 - 0.03;
      }
      if (tipo === 'vater' && est === 'chapuza' && t < 4 && Math.random() < dt * 6)
        emitir(9.6, 0.8, -7.3, 2, { color: [0x9acd32, 0x7bb026, 0xb8e05a], vel: 0.6, sube: 1.4, gravedad: -0.4, tam: 0.16, vida: 2, crece: 2.5 });
      if (tipo === 'mesa' && est === 'roto') { tablero.rotation.z = -0.07 + Math.sin(t * 7) * 0.03; tablero.rotation.x = Math.sin(t * 5) * 0.02; }
      if (tipo === 'seto' && est === 'roto' && Math.random() < dt * 1.5)
        emitir(17.75 + rand(-1.4, 1.4), 1.2, 4.0, 1, { color: 0x4fa04f, vel: 0.3, sube: 0.2, gravedad: 1.5, tam: 0.05, vida: 1.4, cubo: true, gira: 4 });
      if (tipo === 'agujero' && est === 'roto' && Math.random() < dt * 1.2)
        emitir(-0.15, 0.75, -0.3, 1, { color: 0xcfc6b5, vel: 0.2, sube: 0.2, gravedad: 2, tam: 0.03, vida: 0.8, vx: -0.4 });
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
   Navegación por zonas (calle, taller, casa, jardín)
   ========================================================================= */
const CENTROS = { calle: [0, 7.8], taller: [-22, 0], jardin: [26, 2], salon: [-5.5, 1.75], cocina: [5.5, 1.75], dorm: [-5.5, -4.75], bano: [5.5, -4.75] };
const PUERTAS = [
  { a: 'calle', b: 'taller', x: -22, z: 5, eje: 'z' },
  { a: 'calle', b: 'salon', x: -2, z: 5, eje: 'z' },
  { a: 'calle', b: 'jardin', x: 24.25, z: 5, eje: 'z' },
  { a: 'salon', b: 'cocina', x: 0, z: 2, eje: 'x' },
  { a: 'salon', b: 'dorm', x: -5, z: -1.5, eje: 'z' },
  { a: 'cocina', b: 'bano', x: 5, z: -1.5, eje: 'z' },
  { a: 'dorm', b: 'bano', x: 0, z: -4.5, eje: 'x' },
];
const NOMBRE_ZONA = { calle: 'la calle', taller: 'el taller', jardin: 'el chalet de Don Leopoldo', salon: 'casa de Doña Remedios', cocina: 'casa de Doña Remedios', dorm: 'casa de Doña Remedios', bano: 'casa de Doña Remedios' };
function zona(x, z) {
  if (z > 5) return 'calle';
  if (x < -12.5) return 'taller';
  if (x > 12.5) return 'jardin';
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
function irA(e, x, z) { e.ruta = calcularRuta(e.c.g.position.x, e.c.g.position.z, x, z); e.dest = [x, z]; }
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
const PUNTOS_SOCIO = [[-22, -1], [-19, -3], [-27, -2.5], [-16, 7], [-6, 7.2], [8, 7.5], [-5, 2.5], [3, 1], [6, 0.8], [-5, -3.5], [4, -4], [26, 3], [-12, 7.5]];
const PUNTOS_MICHI = [[-5, 2.5], [-3, 0.5], [-8, 2], [3, 1], [6, 0.8], [8, 3.5], [-5, -3.5], [-7, -5], [-4.5, -6], [4, -4], [6.5, -5], [8, -3.5]];

/* =========================================================================
   Diálogos ({J} = el chapuzas que manejas, {S} = su compañero)
   ========================================================================= */
const FRASES = {
  pedido: {
    grifo: ['Mire, que el grifo de mi cocina gotea. Plic, plic, toda la noche. Vengan a mi casa, por favor.', 'El grifo de la cocina me sale más agua por fuera que por dentro. ¿Pueden venir?'],
    vater: ['Es una cosa delicada... El váter. Que no traga. Vengan rápido, por Dios.', 'El váter de mi casa hace «glu-glu». Y no debería hacer «glu-glu».'],
    enchufe: ['El enchufe de la cocina echa chispas. Y yo con la tostadora enchufada.', 'Tengo un enchufe que hace «bzzzz». ¿Eso es normal?'],
    bombilla: ['Se me ha fundido la bombilla del salón y no veo ni la tele.', 'La lámpara del salón parpadea como en las películas de miedo. Vengan a cambiarla.'],
    pared: ['Quiero pintar la pared del salón de color «melocotón del Mediterráneo».', 'La pared de mi salón está más desconchada que el portal de mi hermana.'],
    cuadro: ['Se me ha caído el cuadro de mi madre. Necesito que me lo cuelguen bien colgado.', 'Cuélguenme el cuadro de la abuela, que viene mi hermana el domingo.'],
    mesa: ['La mesa de la cocina cojea. Le he puesto un sobre de azúcar y nada.', 'Mi mesa baila más que yo en las fiestas del pueblo. Arréglenmela.'],
    agujero: ['Tengo un agujero en la pared del salón. Y creo que vive un ratón dentro.', 'Me ha salido un agujero en la pared. Yo no he sido, ¿eh?'],
    azulejos: ['Se me han caído los azulejos del baño. Casi me abro la cabeza.', 'Los azulejos del baño están en el suelo y no en la pared. Vengan a ponerlos.'],
    fachada: ['Buenas. Necesito que me pinten la fachada del chalet. Algo elegante, por favor.', 'Mi nieto me ha pintado la fachada con rotulador. Vengan a dejarla decente.'],
    seto: ['El seto de mi jardín parece una selva. Quiero que me lo poden con elegancia.', 'Necesito el seto recto como una regla. Pago bien... si queda bien.'],
    farola: ['La farola de mi jardín parpadea. Parece una discoteca. Vengan a arreglarla.', 'Se me ha fundido la farola del jardín. Y el sábado tengo una cena.'],
  },
  remediosLlega: ['¡Oiga! ¿Hay alguien en este taller?', '¡Buenos días! ¿Está {J}? Que vengo a encargarles una cosa.', '¡Holaaa! ¡Que vengo a encargar algo!'],
  leopoldoLlega: ['Buenos días. ¿Es aquí lo de las reformas? Huele a cemento.', 'Buenas. Vengo a contratar sus... servicios.'],
  plantado: { remedios: '¡Pues me voy a otro taller! ¡Aquí no atiende ni el gato!', leopoldo: 'Llevo esperando un buen rato. Buscaré a otros profesionales.' },
  aceptar: ['¡Ahora mismo vamos para allá!', '¡Eso está hecho! En un ratito estamos ahí.', '¡Marchando! Coja asiento en su casa, que ya vamos.'],
  telefonoCoge: ['¡Arricio y Jeremías, reformas! ¿Dígame?', '¿Sí? ¡Taller de Arricio y Jeremías, dígame!'],
  telefonoCuelga: ['¡Vamos para allá!', 'Apuntado. ¡En un momento estamos ahí!'],
  fino: {
    remedios: ['¡Anda! Si hasta ha quedado bien.', '¡Qué manos tiene usted, {J}! Ni mi difunto, que en paz descanse.', '¡Esto lo cuento en la peluquería!'],
    leopoldo: ['Impecable. Ni el jardinero de la embajada.', 'Vaya, vaya. Me han sorprendido. Gratamente.'],
  },
  bien: {
    remedios: ['Pse. Pasable.', 'Ha quedado... apañao.', 'Bueno, mientras funcione...'],
    leopoldo: ['Correcto. Sin más.', 'Bueno. Aceptable, para el barrio.'],
  },
  chapuza: {
    remedios: ['¡¿PERO QUÉ HAN HECHO?!', '¡Esto lo pago yo de mi pensión!', '¡Ay, mi casa! ¡Ay, mi casita!'],
    leopoldo: ['¡Esto es intolerable!', '¡Llamaré a mi abogado! ¡Y a mi otro abogado!'],
  },
  expira: {
    remedios: ['¡Pues ya lo arreglará mi sobrino, que hace un curso por internet!', '¡Llevo toda la mañana esperando! ¡Ni que fueran del Ayuntamiento!'],
    leopoldo: ['He llamado a una empresa seria. Si es que existe.', 'Ya no hace falta que vengan. Gracias por nada.'],
  },
  charla: {
    remedios: ['¿Quieren un cafelito? Bueno, no, que luego se entretienen.', 'No pisen la alfombra, que es persa. De los chinos, pero persa.', '{J}, ¿usted no salía con la del quinto?', 'Mi vecina dice que ustedes son los de la chapuza del ascensor.'],
    leopoldo: ['No pisen el césped, que es inglés.', '¿Ustedes hacen factura con membrete?', 'En mi club de golf no se hablaría de otra cosa.'],
  },
  socioAlmuerzo: ['Primero el almuerzo, que sin gasolina el motor no arranca.', 'Un bocata de chorizo y estoy contigo, {J}.', 'Es mi descanso sindical, {J}.'],
  socioSiesta: ['Me echo cinco minutillos... para pensar la estrategia.', 'No estoy durmiendo. Estoy midiendo el techo con los ojos cerrados.'],
  socioPasea: ['Voy a hacer un estudio de la situación.', 'Aquí lo que hace falta es una reforma integral, {J}.', 'Esto con pladur quedaba precioso.'],
  socioPlatano: ['Uy, la cáscara. Bueno, ya la recojo luego.', 'Vitaminas, {J}. Potasio. Lo dicen los médicos.'],
  socioAyuda: ['¡Quita, quita, que esto lo hago yo en un pispás!', 'Déjamelo a mí, que tengo un primo que es de esto.'],
  socioBien: ['¿Has visto, {J}? ¡Ni yo me lo creo!', '¡Toma! ¡Aprende, aprende!'],
  socioChapuza: ['Esto ya venía así de fábrica.', 'Ha sido culpa del de antes, que lo dejó fatal.', 'Ups. Bueno, así tiene más personalidad.'],
  socioOrden: ['¡Voy, voy! Qué estrés, {J}, qué estrés.', 'Que síííí, que ya voy. Siempre igual.', '¿Yo? Bueno, vale, pero luego me invitas a un café.'],
  socioOrdenSin: ['No hay nada que hacer, jefe. Me vuelvo a mi bocata.', 'Todo arreglado. Bueno, todo «arreglado».'],
  socioTarde: ['Anda, ya está hecho. Pues nada, me vuelvo.', 'Llego tarde por los pelos. Qué pena, oye.'],
  socioApagon: ['¿Quién ha apagado la luz? ¡Yo no he sido, eh!', '¡{J}! ¡No veo! Bueno, nunca veo, pero ahora menos.'],
  socioBocata: ['Ñam. ¿Era tuyo, {J}?', 'Estaba aquí solo, abandonado... Lo he adoptado.'],
  jugadorChapuza: ['Esto ya estaba así cuando llegamos.', 'Es un estilo nuevo. Se lleva mucho en Milán.', 'Tranquilo, que esto con cinta americana queda como nuevo.', 'Técnicamente... funciona. A su manera.'],
  jugadorFino: ['¡Lo que yo te diga, {S}: manos de cirujano!', '¡Trabajo fino!', '¡Y sin cinta americana!'],
  jugadorResbalon: ['¡Uuuuuy!', '¡Mi madre!', '¡{S}, socorroooo!', '¡Mis lumbares!'],
  jugadorMalaHerr: ['¿Con {h}? Bueno... por probar...', 'Con {h} también se puede. Creo.'],
  jugadorSinHerr: ['Para esto necesito {h}. Está en la estantería del taller.', 'Sin {h} no hay manera. ¡Al taller!'],
  jugadorGato: ['¡Michi, quita de en medio!', '¡Este gato me quiere matar!'],
};
const nombres = t => t.replaceAll('{J}', paco.nombre).replaceAll('{S}', ramon.nombre);
const frase = (lista, h) => nombres(pick(lista).replaceAll('{h}', h || ''));

/* =========================================================================
   Entidades
   ========================================================================= */
const CHAPUZAS = {
  arricio: {
    nombre: 'Arricio', clase: 'ramon', voz: 190, alturaGlobo: 2.45, perfil: { mujer: false, tono: 0.72, ritmo: 0.98 }, chapucero: 0.6,
    c: PJ.arricio || crearPersonaje({ ropa: 0x8e9884, peto: 0x7f8a76, manga: 0x24365c, ancho: 1.3, barriga: true, patillas: 0x3a2a1c, gorra: 0xf1f0ea, lapiz: true, zapatos: 0x2a1a10 }),
  },
  jeremias: {
    nombre: 'Jeremías', clase: 'paco', voz: 330, alturaGlobo: 2.35, perfil: { mujer: false, tono: 1.05, ritmo: 1.05 }, chapucero: 0.35,
    c: PJ.jeremias || crearPersonaje({ ropa: 0xeaa3b4, pierna: 0x8a9580, manga: 0xeaa3b4, pelo: 0x3a2a1c, gorra: 0xf1f0ea, zapatos: 0x3b2a1c }),
  },
};
const paco = { estado: 'normal', t: 0, vel: 0, vx: 0, vz: 0, herrs: [], mallas: [], tinte: 0, boost: 0 };
const ramon = { estado: 'idle', t: 0, vel: 0, ruta: null, encargo: null };
function asignarPapeles(quien) {
  const otro = quien === 'arricio' ? 'jeremias' : 'arricio';
  for (const [e, k] of [[paco, quien], [ramon, otro]]) {
    const m = CHAPUZAS[k];
    Object.assign(e, { id: k, nombre: m.nombre, clase: m.clase, voz: m.voz, alturaGlobo: m.alturaGlobo, perfil: m.perfil, chapucero: m.chapucero, c: m.c });
  }
  if (asignarPapeles.listo) ramon.c.mano.add(bocataSocio);
}
asignarPapeles('arricio');

const texBata = texLienzo(64, 64, (g) => {
  g.fillStyle = '#d9709d'; g.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 6; i++) { const x = rand(6, 58), y = rand(6, 58); g.fillStyle = '#fff3a0'; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 4, y + Math.sin(k * 1.26) * 4, 3, 0, 7); g.fill(); } g.fillStyle = '#e8573a'; g.beginPath(); g.arc(x, y, 2.5, 0, 7); g.fill(); }
}, [2, 2]);
const remedios = {
  id: 'remedios', nombre: 'Doña Remedios', clase: 'remedios', voz: 520, alturaGlobo: 2.15, perfil: { mujer: true, tono: 1.3, ritmo: 1.05 },
  c: PJ.remedios || crearPersonaje({ ropa: 0xd9709d, falda: true, pierna: 0xf0c4a0, rulos: true, gafas: 0x6b3a2a, escala: 0.92, zapatos: 0xff9ec4, cejas: 0x8a8a8a }),
  casa: [-3.5, 3], paseo: [[-4, 2.5], [-6.5, 0.5], [3.5, 2], [-3, 3.5]], espera: [-26.6, 2.6],
  estado: 'casa', t: 0, vel: 0, ruta: null, pedido: null, esperaT: 0, charlaT: 25,
};
if (!PJ.remedios) { remedios.c.matRopa.map = texBata; remedios.c.matRopa.needsUpdate = true; remedios.c.colorRopa.set(0xffffff); }
const leopoldo = {
  id: 'leopoldo', nombre: 'Don Leopoldo', clase: 'leopoldo', voz: 240, alturaGlobo: 2.4, perfil: { mujer: false, tono: 0.85, ritmo: 0.9 },
  c: PJ.leopoldo || crearPersonaje({ ropa: 0x3a3f4a, camisaPecho: 0xffffff, corbata: 0xa0182b, pelo: 0x141414, bigote: 0x141414, bigoteFino: true, zapatos: 0x111111, piel: 0xf3cfb0 }),
  casa: [26, 2.2], paseo: [[26, 2.2], [24, 3.8], [28, 3.2], [26.5, 0.4]], espera: [-25.0, 2.6],
  estado: 'casa', t: 0, vel: 0, ruta: null, pedido: null, esperaT: 0, charlaT: 30,
};
const CLIENTES = { remedios, leopoldo };
const michi = { nombre: 'Michi', clase: 'michi', voz: 900, alturaGlobo: 0.9, c: crearGato(), estado: 'idle', t: 0, vel: 0, ruta: null, cdTropiezo: 0 };
// El teléfono «habla» con la voz de quien llama
const telEnt = { nombre: '📞', clase: 'tel', voz: 400, alturaGlobo: 0.9, perfil: null, c: { g: telefono } };
const entidades = [paco, ramon, remedios, leopoldo, michi, telEnt];

const bocataSocio = new THREE.Group();
{ const pan = capsula(0.06, 0.25, mat(0xd9a45a, 0.9), 0, 0, 0, bocataSocio); pan.rotation.z = Math.PI / 2; }
bocataSocio.position.set(0, 0, 0.1); bocataSocio.visible = false; ramon.c.mano.add(bocataSocio); asignarPapeles.listo = true;

// Bocata de calamares (da velocidad)
const bocata = new THREE.Group();
{
  const pan = capsula(0.1, 0.38, mat(0xd9a45a, 0.9), 0, 0, 0, bocata); pan.rotation.z = Math.PI / 2;
  for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.022, 6, 12), mat(0xf6e7b0, 0.7)); a.position.set(-0.15 + i * 0.1, 0.06, 0.06); bocata.add(a); }
}
bocata.visible = false; scene.add(bocata);
const PUNTOS_BOCATA = [[-21, -1], [-3, 7.5], [6, 6.8], [-8, 2.6], [3.5, 0.6], [-5, -4], [19, 7.5], [27, 3.5], [-16, 6.5]];

// Marcadores flotantes: dónde hay que ir
const marcadores = [];
function crearMarcador(color) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 16), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.3 }));
  c.rotation.x = Math.PI; g.add(c);
  const a = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 8, 24), new THREE.MeshBasicMaterial({ color }));
  a.rotation.x = Math.PI / 2; a.position.y = -1.6; g.add(a);
  g.visible = false; scene.add(g);
  marcadores.push(g);
  return g;
}
const marcadoresEncargo = Object.fromEntries(TIPOS.map(t => [t, crearMarcador(0xffc21a)]));
const marcadorTel = crearMarcador(0xe53935);

/* =========================================================================
   Estado de la partida
   ========================================================================= */
const DURACION = 300; // segundos reales = de 9:00 a 18:00
const G = {
  jugando: false, pausa: false, fin: false, t: 0, dinero: 0, paciencia: 100,
  encargos: {}, pedidoT: 0, mini: null, apagon: 0, temblor: 0, cola: [], bocataT: 30, tel: null,
  stats: null, accion: false,
};
function nuevasStats() {
  return { fino: 0, bien: 0, chapuza: 0, expirado: 0, socioBien: 0, socioChapuza: 0, bocatasSocio: 0, resbalones: 0, desperfectos: [], bocatasJugador: 0, oficios: new Set(), llamadasPerdidas: 0, plantados: 0, clientes: new Set() };
}
const luego = (seg, fn) => G.cola.push({ t: G.t + seg, fn });
const progreso = () => clamp(G.t / DURACION, 0, 1);

function reiniciar() {
  Object.assign(G, { t: 0, dinero: 0, paciencia: 100, pedidoT: 7, mini: null, apagon: 0, temblor: 0, cola: [], fin: false, pausa: false, bocataT: 35, tel: null });
  bocata.visible = false;
  G.stats = nuevasStats();
  Visual._yaPintada = false;
  TIPOS.forEach(t => { G.encargos[t] = { activo: false, pedido: false, t: 0, max: 0, ramon: false, cd: 0 }; Visual.poner(t, 'ok'); });
  limpiarPeligros();
  particulas.forEach(p => p.m.removeFromParent()); particulas.length = 0;
  for (const m of Object.values(CHAPUZAS)) { m.c.brazos[0].rotation.z = 0; m.c.cuerpo.rotation.set(0, 0, 0); m.c.cuerpo.position.set(0, 0, 0); }
  paco.c.g.position.set(-22, 0, 0.5); paco.c.g.rotation.y = 0; Object.assign(paco, { estado: 'normal', vx: 0, vz: 0, tinte: 0, boost: 0 });
  soltarHerramientas();
  restaurarTinte(paco);
  ramon.c.g.position.set(-18.6, 0, 3.4); ramon.c.g.rotation.y = Math.PI;
  Object.assign(ramon, { estado: 'idle', t: 6, ruta: null, encargo: null, dormido: false, sentado: false, trabajaT: 0 });
  bocataSocio.visible = false; restaurarTinte(ramon);
  for (const cl of Object.values(CLIENTES)) {
    cl.c.g.position.set(cl.casa[0], 0, cl.casa[1]); cl.c.g.rotation.y = 0;
    Object.assign(cl, { estado: 'casa', t: rand(1, 3), ruta: null, pedido: null, esperaT: 0, charlaT: rand(25, 40), dest: null });
  }
  michi.c.g.position.set(-7, 0, -4); michi.ruta = null; michi.t = 2;
  marcadores.forEach(m => { m.visible = false; });
  Dialogo.limpiar();
  $('globo').classList.add('oculto');
  $('mini').classList.add('oculto');
  $('lista-encargos').innerHTML = ''; firmaLista = '';
  auricular.position.set(0, 0.17, -0.02); auricular.rotation.set(0, 0, 0);
}

/* =========================================================================
   Entrada: teclado y táctil
   ========================================================================= */
const teclas = new Set();
const joy = { x: 0, z: 0, activo: false };
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  teclas.add(k);
  if (e.repeat || !G.jugando) return;
  if (k === 'e' || k === ' ' || k === 'enter') G.accion = true;
  if (k === 'p' || k === 'escape') alternarPausa();
  if (k === 'm') alternarSonido();
});
window.addEventListener('keyup', e => teclas.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { teclas.clear(); if (G.jugando && !G.pausa && !G.fin) alternarPausa(); });

const esTactil = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
{
  const zonaJ = $('joy'), bola = zonaJ.querySelector('i');
  let id = null;
  const mover = ev => {
    const r = zonaJ.getBoundingClientRect();
    let dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy), max = r.width / 2 - 10;
    if (d > max) { dx *= max / d; dy *= max / d; }
    bola.style.transform = `translate(${dx}px,${dy}px)`;
    joy.x = dx / max; joy.z = dy / max; joy.activo = true;
  };
  zonaJ.addEventListener('pointerdown', ev => { id = ev.pointerId; try { zonaJ.setPointerCapture(id); } catch (e) { /* nada */ } mover(ev); });
  zonaJ.addEventListener('pointermove', ev => { if (ev.pointerId === id) mover(ev); });
  const fin = ev => { if (ev.pointerId !== id) return; id = null; joy.x = joy.z = 0; joy.activo = false; bola.style.transform = ''; };
  zonaJ.addEventListener('pointerup', fin); zonaJ.addEventListener('pointercancel', fin);
  $('btn-accion').addEventListener('pointerdown', ev => { ev.preventDefault(); if (G.jugando) G.accion = true; });
}

function alternarPausa() {
  if (G.fin) return;
  G.pausa = !G.pausa;
  $('pausa').classList.toggle('oculto', !G.pausa);
  Musica.activa = !G.pausa;
  Voz.pausar(G.pausa);
}
function alternarSonido() { $('btn-sonido').textContent = Sonido.alternar() ? '🔊' : '🔇'; }
function pantallaCompleta() {
  const d = document, el = d.documentElement;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
  } catch (e) { /* algunos móviles no lo permiten */ }
}
$('btn-pausa').addEventListener('click', alternarPausa);
$('btn-seguir').addEventListener('click', alternarPausa);
$('btn-sonido').addEventListener('click', alternarSonido);
$('btn-pantalla').addEventListener('click', pantallaCompleta);
$('btn-empezar').addEventListener('click', empezar);

let eleccion = 'arricio';
document.querySelectorAll('.opcion').forEach(b => b.addEventListener('click', () => {
  eleccion = b.dataset.pj;
  document.querySelectorAll('.opcion').forEach(o => o.setAttribute('aria-pressed', String(o === b)));
  Sonido.init(); Sonido.coger();
}));

function empezar() {
  asignarPapeles(eleccion);
  Sonido.init();
  Voz.init();
  if (esTactil && !document.fullscreenElement) pantallaCompleta();
  reiniciar();
  $('portada').classList.add('oculto');
  $('final').classList.add('oculto');
  $('hud').classList.remove('oculto');
  $('botones').classList.remove('oculto');
  $('tactil').classList.toggle('oculto', !esTactil);
  G.jugando = true;
  Musica.activa = true; Musica.paso = 0; Musica.siguiente = 0;
  decir(paco, nombres('Otro día en el taller. A ver si hoy suena el teléfono, {S}.'), 2);
  decir(ramon, 'Si suena, lo coges tú, que yo tengo las manos ocupadas con el bocadillo.', 2);
  toast('🧰 Las herramientas están en la estantería del fondo del taller');
}

/* =========================================================================
   HUD
   ========================================================================= */
let firmaLista = '';
function toast(txt, tipo = '') {
  const d = document.createElement('div');
  d.className = `panel toast ${tipo}`; d.textContent = txt;
  $('toasts').appendChild(d);
  setTimeout(() => d.remove(), 4200);
  while ($('toasts').children.length > 2) $('toasts').firstChild.remove();
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
const nombreCasa = cl => cl === 'leopoldo' ? 'Chalet de Don Leopoldo' : 'Casa de Doña Remedios';
function actualizarHUD() {
  const min = 9 * 60 + Math.floor(progreso() * 540);
  $('reloj').firstChild.nodeValue = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
  $('lugar').textContent = `📍 Estás en ${NOMBRE_ZONA[zona(paco.c.g.position.x, paco.c.g.position.z)]}`;
  const din = $('dinero');
  din.textContent = euros(G.dinero); din.classList.toggle('negativo', G.dinero < 0);
  const p = G.paciencia, barra = $('paciencia');
  barra.style.width = p + '%';
  barra.style.background = p > 60 ? 'var(--verde)' : p > 30 ? '#e9a527' : 'var(--rojo)';
  $('cara').textContent = p > 75 ? '😊' : p > 55 ? '🙂' : p > 35 ? '😒' : p > 15 ? '😠' : '🤬';
  $('herramienta').textContent = paco.herrs.length
    ? '🧰 Llevas: ' + paco.herrs.map(h => `${HERRAMIENTAS[h].icono} ${HERRAMIENTAS[h].corto}`).join(' + ')
    : '🧰 Manos vacías (herramientas en el taller)';
  // Lista: avisos (teléfono, clientes esperando) y encargos aceptados
  const activos = TIPOS.filter(t => G.encargos[t].activo).sort((a, b) => G.encargos[a].t - G.encargos[b].t);
  const esperando = Object.values(CLIENTES).filter(c => c.estado === 'esperando');
  const firma = (G.tel ? 'T|' : '') + esperando.map(c => c.id).join(',') + '|' + activos.map(t => t + (G.encargos[t].ramon ? 'R' : '')).join('|');
  const lista = $('lista-encargos');
  if (firma !== firmaLista) {
    firmaLista = firma;
    lista.innerHTML = '';
    if (G.tel) lista.insertAdjacentHTML('beforeend', `<div class="panel encargo aviso" data-aviso="tel"><span class="ico">📞</span><span class="info">¡Suena el teléfono!<br><span class="sub">Cógelo en el taller</span></span><span class="t"></span></div>`);
    for (const c of esperando) lista.insertAdjacentHTML('beforeend', `<div class="panel encargo aviso" data-cliente="${c.id}"><span class="ico">🚪</span><span class="info">${c.nombre} espera<br><span class="sub">En el mostrador del taller</span></span><span class="t"></span></div>`);
    for (const t of activos) {
      const d = ENCARGOS[t], e = G.encargos[t];
      lista.insertAdjacentHTML('beforeend', `<div class="panel encargo${e.ramon ? ' ramon' : ''}" data-tipo="${t}"><span class="ico">${d.icono}</span><span class="info">${d.nombre}<br><span class="sub">${nombreCasa(d.cliente)} · ${e.ramon ? ramon.nombre + ' va «a ayudar»' : HERRAMIENTAS[d.herr].icono + ' ' + HERRAMIENTAS[d.herr].corto}</span></span><span class="t"></span></div>`);
    }
    if (!lista.children.length) lista.innerHTML = '<div class="panel encargo"><span class="ico">☕</span><span class="info">Sin encargos.<br><span class="sub">Espera a que llame alguien.</span></span></div>';
  }
  for (const div of lista.children) {
    const el = div.querySelector('.t'); if (!el) continue;
    let s = null;
    if (div.dataset.tipo) s = G.encargos[div.dataset.tipo].t;
    else if (div.dataset.aviso && G.tel) s = G.tel.t;
    else if (div.dataset.cliente) s = CLIENTES[div.dataset.cliente].esperaT;
    if (s == null) continue;
    el.textContent = Math.ceil(s) + 's';
    div.classList.toggle('urgente', s < 10);
  }
}

/* =========================================================================
   Pedidos: llaman por teléfono o vienen al taller
   ========================================================================= */
function maxPendientes() { const p = progreso(); return p < 0.25 ? 2 : p < 0.6 ? 3 : 4; }
function generarPedido() {
  const pendientes = TIPOS.filter(t => G.encargos[t].activo || G.encargos[t].pedido).length;
  if (pendientes >= maxPendientes()) return;
  const libres = TIPOS.filter(t => !G.encargos[t].activo && !G.encargos[t].pedido && G.encargos[t].cd <= 0);
  if (!libres.length) return;
  const tipo = pick(libres);
  const cl = CLIENTES[ENCARGOS[tipo].cliente];
  const puedePersona = cl.estado === 'casa' && !cl.pedido && !TIPOS.some(t => G.encargos[t].activo && ENCARGOS[t].cliente === cl.id);
  const puedeTel = !G.tel;
  if (!puedePersona && !puedeTel) return;
  const canal = puedePersona && (!puedeTel || Math.random() < 0.45) ? 'persona' : 'tel';
  G.encargos[tipo].pedido = true;
  if (tipo === 'pared') Visual._yaPintada = true;
  Visual.poner(tipo, 'roto');
  if (canal === 'tel') {
    G.tel = { tipo, t: 18, ringT: 0 };
    toast('📞 ¡Suena el teléfono del taller!');
  } else {
    cl.pedido = tipo; cl.estado = 'yendoTaller';
    irA(cl, cl.espera[0], cl.espera[1]);
    toast(`🚶 ${cl.nombre} va de camino al taller`);
  }
}
function activarEncargo(tipo) {
  const e = G.encargos[tipo];
  e.activo = true; e.pedido = false; e.ramon = false;
  e.max = e.t = lerp(85, 60, progreso()) + rand(-4, 4);
  G.stats.clientes.add(ENCARGOS[tipo].cliente);
}
function cancelarPedido(tipo) {
  const e = G.encargos[tipo];
  e.pedido = false; e.cd = 12;
  Visual.poner(tipo, 'ok');
}
function cogerTelefono() {
  const tel = G.tel; if (!tel) return;
  G.tel = null;
  const tipo = tel.tipo, cl = CLIENTES[ENCARGOS[tipo].cliente];
  Object.assign(telEnt, { nombre: `📞 ${cl.nombre}`, perfil: cl.perfil, voz: cl.voz });
  auricular.position.set(0.1, 0.45, 0.25); auricular.rotation.set(0.3, 0, 0.4);
  decir(paco, pick(FRASES.telefonoCoge), 2);
  decir(telEnt, pick(FRASES.pedido[tipo]), 2);
  decir(paco, pick(FRASES.telefonoCuelga), 2);
  activarEncargo(tipo);
  luego(9, () => { auricular.position.set(0, 0.17, -0.02); auricular.rotation.set(0, 0, 0); });
}
function atenderCliente(cl) {
  const tipo = cl.pedido; if (!tipo) return;
  cl.pedido = null; cl.estado = 'volviendo';
  decir(cl, pick(FRASES.pedido[tipo]), 2);
  decir(paco, pick(FRASES.aceptar), 2);
  activarEncargo(tipo);
  luego(1, () => irA(cl, cl.casa[0], cl.casa[1]));
}

// resultado: 'fino' | 'bien' | 'chapuza'; quien: 'jugador' | 'socio'
function resolver(tipo, resultado, quien = 'jugador') {
  const d = ENCARGOS[tipo], e = G.encargos[tipo];
  e.activo = false; e.ramon = false; e.cd = 12;
  if (quien === 'jugador') G.stats.oficios.add(d.oficio);
  const [px, pz] = d.pie;
  const autor = quien === 'jugador' ? paco : ramon;
  const cl = CLIENTES[d.cliente];
  const cerca = dist2D(cl.c.g.position.x, cl.c.g.position.z, px, pz) < 14;
  if (resultado === 'chapuza') {
    Visual.poner(tipo, 'chapuza');
    G.stats.chapuza++; if (quien === 'socio') G.stats.socioChapuza++;
    G.stats.desperfectos.push(tipo);
    sumar(-25, `Desperfecto: ${DESPERFECTOS[tipo]}`);
    paciencia(-12);
    rotulo('¡CHAPUZA!', 'malo');
    Sonido.trombon();
    G.temblor = 0.35;
    efectoChapuza(tipo, autor);
    decir(autor, frase(quien === 'jugador' ? FRASES.jugadorChapuza : FRASES.socioChapuza), 1);
    if (cerca) decir(cl, Math.random() < 0.7 ? QUEJAS[tipo] : pick(FRASES.chapuza[cl.id]), 2);
  } else {
    Visual.poner(tipo, 'ok');
    const fino = resultado === 'fino';
    let pago = fino ? 60 : 40;
    if (quien === 'socio') { pago = 20; G.stats.socioBien++; } else if (fino) G.stats.fino++; else G.stats.bien++;
    sumar(pago, quien === 'socio' ? `${ramon.nombre}: ${d.nombre} (de milagro)` : `${d.nombre}${fino ? ' (¡fino!)' : ''}`);
    paciencia(fino ? 8 : 4);
    rotulo(quien === 'socio' ? '¡DE MILAGRO!' : fino ? '¡TRABAJO FINO!' : '¡APAÑAO!', 'bueno');
    if (fino) Sonido.fanfarria(); else Sonido.clonc();
    estrellitas(px, 1.4, pz);
    if (quien === 'socio') decir(ramon, frase(FRASES.socioBien), 1);
    else if (fino) decir(paco, frase(FRASES.jugadorFino), 0);
    if (cerca) decir(cl, frase(fino ? FRASES.fino[cl.id] : FRASES.bien[cl.id]), 1);
  }
}

function efectoChapuza(tipo, autor) {
  const [px, pz] = ENCARGOS[tipo].pie;
  switch (tipo) {
    case 'grifo': Sonido.chof(); luego(0.5, () => crearCharco(px, pz + 0.3, 1.25)); break;
    case 'enchufe':
      Sonido.zas();
      emitir(10.75, 0.55, 3, 40, { color: [0xffd23f, 0xffffff, 0x8fd3ff], brilla: true, vel: 4, sube: 4, tam: 0.04, vida: 0.6 });
      electrocutar(autor); empezarApagon(9);
      break;
    case 'pared': {
      Sonido.chof();
      const col = new THREE.Color(colorChillon()).getHex();
      emitir(-10.6, 1.2, 1.5, 40, { color: col, vel: 3, sube: 3, tam: 0.08, vida: 1.2, vx: 1.5 });
      teñir(autor, col, 14);
      break;
    }
    case 'fachada': {
      Sonido.chof();
      const col = new THREE.Color(colorChillon()).getHex();
      emitir(29, 1.2, -0.7, 40, { color: col, vel: 2.5, sube: 3, tam: 0.08, vida: 1.2, vz: 1.5 });
      teñir(autor, col, 14);
      break;
    }
    case 'cuadro': Sonido.clonc(); break;
    case 'bombilla':
      Sonido.zas();
      emitir(-6.3, 1.65, 4.3, 30, { color: [0xffffff, 0xd8f2ff], brilla: true, vel: 3, sube: 3, tam: 0.04, vida: 0.8, cubo: true });
      empezarApagon(10);
      break;
    case 'farola': Sonido.zas(); electrocutar(autor); break;
    case 'vater': Sonido.chof(); Sonido.plop(); luego(0.6, () => crearCharco(px, pz + 0.4, 1.3, 0x9ab86a)); break;
    case 'mesa':
      Sonido.crash();
      emitir(5, 0.5, 3.3, 30, { color: [0x8a5a3a, 0xc79a5b, 0xe8c99a], cubo: true, vel: 2.5, sube: 3, tam: 0.05, vida: 1.2 });
      break;
    case 'agujero':
      Sonido.crash(); G.temblor = 0.5;
      emitir(-0.3, 0.8, -0.3, 30, { color: [0xbdbdbd, 0x9a9a9a, 0xe0d8c8], vel: 1.5, sube: 1.5, gravedad: 0.5, tam: 0.12, vida: 1.6, crece: 2, vx: -1 });
      break;
    case 'azulejos':
      Sonido.clonc(); setTimeout(() => Sonido.clonc(), 180); setTimeout(() => Sonido.clonc(), 360);
      emitir(10.6, 0.9, -4.35, 20, { color: [0xffffff, 0x8fc3d9, 0xff8fb1], cubo: true, vel: 2, sube: 2.5, tam: 0.06, vida: 1, vx: -1.5 });
      break;
    case 'seto':
      Sonido.ruidoF(0.8, 0.35, 2500, 'bandpass', 600);
      emitir(17.75, 0.9, 4.1, 60, { color: [0x4fa04f, 0x3a8a3a, 0x5fb05f], cubo: true, vel: 3, sube: 3, tam: 0.07, vida: 1.5, gira: 6 });
      break;
  }
}
function empezarApagon(seg) { G.apagon = Math.max(G.apagon, seg); luego(1.5, () => decir(ramon, frase(FRASES.socioApagon), 0)); }
function electrocutar(e) {
  e.c.pelosPunta.visible = true;
  teñir(e, 0x2a2a2a, 9);
  if (e === paco) { paco.estado = 'electro'; paco.t = 1.6; }
  else luego(6, () => { e.c.pelosPunta.visible = false; });
}
function teñir(e, color, seg) {
  if (e.c.matsTinte) e.c.matsTinte.forEach(m => m.color.set(color));
  else { e.c.matRopa.color.set(color); e.c.matRopa.map = null; e.c.matRopa.needsUpdate = true; }
  e.tinte = seg;
}
function restaurarTinte(e) {
  if (e.c.matsTinte) e.c.matsTinte.forEach((m, i) => m.color.copy(e.c.coloresTinte[i]));
  else e.c.matRopa.color.copy(e.c.colorRopa);
  e.c.pelosPunta.visible = false; e.tinte = 0;
}

function resbalar(motivo) {
  if (paco.estado !== 'normal') return;
  paco.estado = 'resbalon'; paco.t = 0; paco.dur = motivo === 'gato' ? 1.2 : 1.7;
  G.stats.resbalones++;
  sumar(2, 'Plus de peligrosidad (resbalón)');
  Sonido.boing();
  decir(paco, motivo === 'gato' ? frase(FRASES.jugadorGato) : frase(FRASES.jugadorResbalon), 0);
}

/* =========================================================================
   Minijuego de precisión
   ========================================================================= */
function empezarMini(tipo) {
  const p = progreso();
  // Arricio es el más chapucero haciendo las cosas: le cuesta más acertar
  const ancho = lerp(0.3, 0.18, p) * (paco.id === 'arricio' ? 0.78 : 1);
  const centro = rand(0.15 + ancho / 2, 0.85 - ancho / 2);
  G.mini = { tipo, p: Math.random() < 0.5 ? 0 : 1, dir: 1, vel: lerp(0.8, 1.45, p) * rand(0.9, 1.1), centro, ancho, fino: ancho * 0.3 };
  if (G.mini.p === 1) G.mini.dir = -1;
  const e = G.encargos[tipo];
  if (e.ramon && ramon.encargo === tipo) { e.ramon = false; ramon.encargo = null; ramon.trabajaT = 0; ramon.estado = 'idle'; ramon.t = 2; decir(ramon, 'Vale, vale, hazlo tú, que yo te superviso.', 0); }
  paco.estado = 'mini';
  $('mini-titulo').textContent = `${ENCARGOS[tipo].icono} ${ENCARGOS[tipo].nombre}`;
  $('mini-verde').style.left = (centro - ancho / 2) * 100 + '%';
  $('mini-verde').style.width = ancho * 100 + '%';
  $('mini-oro').style.left = (centro - G.mini.fino / 2) * 100 + '%';
  $('mini-oro').style.width = G.mini.fino * 100 + '%';
  $('mini').classList.remove('oculto');
  const [px, pz] = ENCARGOS[tipo].pie, obj = ENCARGOS[tipo].mira;
  paco.c.g.rotation.y = Math.atan2(obj[0] - px, obj[1] - pz);
}
function cancelarMini() { G.mini = null; $('mini').classList.add('oculto'); if (paco.estado === 'mini') paco.estado = 'normal'; }
function pararMini() {
  const m = G.mini;
  const d = Math.abs(m.p - m.centro);
  const res = d <= m.fino / 2 ? 'fino' : d <= m.ancho / 2 ? 'bien' : 'chapuza';
  cancelarMini();
  Sonido.clonc();
  resolver(m.tipo, res, 'jugador');
}

/* =========================================================================
   Interacciones del jugador
   ========================================================================= */
function objetivoCercano() {
  const p = paco.c.g.position;
  const cerca = (x, z, r) => dist2D(p.x, p.z, x, z) < r;
  if (G.tel && cerca(-16.5, -3.3, 1.5)) return { tipo: 'tel' };
  for (const cl of Object.values(CLIENTES)) if (cl.estado === 'esperando' && cerca(cl.c.g.position.x, cl.c.g.position.z, 1.9)) return { tipo: 'cliente', cl };
  let mejor = null, md = 0.85;
  for (const r of ranuras) {
    if (paco.herrs.includes(r.id)) continue;
    const d = dist2D(p.x, p.z, r.x, r.z);
    if (d < md) { md = d; mejor = r; }
  }
  if (mejor) return { tipo: 'herr', r: mejor };
  for (const t of TIPOS) {
    if (!G.encargos[t].activo) continue;
    const [x, z] = ENCARGOS[t].pie;
    if (cerca(x, z, 1.25)) return { tipo: 'encargo', t };
  }
  if (cerca(ramon.c.g.position.x, ramon.c.g.position.z, 1.7)) return { tipo: 'socio' };
  for (const cl of Object.values(CLIENTES)) if (cerca(cl.c.g.position.x, cl.c.g.position.z, 1.7)) return { tipo: 'charla', cl };
  if (cerca(michi.c.g.position.x, michi.c.g.position.z, 1.3)) return { tipo: 'michi' };
  return null;
}
function textoPista(o) {
  if (!o) return null;
  const H = HERRAMIENTAS;
  switch (o.tipo) {
    case 'tel': return '<kbd>E</kbd> Coger el teléfono';
    case 'cliente': return `<kbd>E</kbd> Atender a ${o.cl.nombre}`;
    case 'herr': return `<kbd>E</kbd> Coger ${H[o.r.id].icono} ${H[o.r.id].corto}${paco.herrs.length >= 2 ? ` (dejas ${H[paco.herrs[0]].corto.toLowerCase()})` : ''}`;
    case 'encargo': {
      const d = ENCARGOS[o.t];
      if (G.encargos[o.t].ramon && ramon.trabajaT > 0 && ramon.encargo === o.t) return `${ramon.nombre} está en ello… (que Dios nos pille confesados)`;
      if (paco.herrs.includes(d.herr)) return `<kbd>E</kbd> ¡A trabajar! ${d.icono} ${d.nombre}`;
      if (!paco.herrs.length) return `Necesitas ${H[d.herr].icono} ${H[d.herr].corto} · está en el taller`;
      return `<kbd>E</kbd> Intentarlo con ${H[paco.herrs[0]].icono} ${H[paco.herrs[0]].corto.toLowerCase()}… (mala idea)`;
    }
    case 'socio': return `<kbd>E</kbd> «¡${ramon.nombre}, a trabajar!»`;
    case 'charla': return `<kbd>E</kbd> Hablar con ${o.cl.nombre}`;
    case 'michi': return '<kbd>E</kbd> Acariciar a Michi';
  }
}
function coger(id) {
  if (paco.herrs.length >= 2) soltarHerramienta(paco.herrs[0]);
  paco.herrs.push(id);
  ranuras.find(x => x.id === id).malla.visible = false;
  const m = crearHerramienta(id);
  m.rotation.x = Math.PI / 2; m.position.set(0, -0.02, 0.02);
  (paco.herrs.length === 1 ? paco.c.mano : paco.c.manoIzq).add(m);
  paco.mallas.push(m);
  Sonido.coger();
  if (Math.random() < 0.4) decir(paco, pick(FRASE_OFICIO[HERRAMIENTAS[id].oficio]), 0);
}
function soltarHerramienta(id) {
  const i = paco.herrs.indexOf(id); if (i < 0) return;
  paco.mallas[i].removeFromParent();
  paco.herrs.splice(i, 1); paco.mallas.splice(i, 1);
  ranuras.find(x => x.id === id).malla.visible = true;
  // La que queda pasa a la mano derecha
  paco.mallas.forEach((m, k) => (k === 0 ? paco.c.mano : paco.c.manoIzq).add(m));
}
function soltarHerramientas() { [...paco.herrs].forEach(soltarHerramienta); }
function accion() {
  if (G.mini) { pararMini(); return; }
  if (paco.estado !== 'normal') return;
  const o = objetivoCercano();
  if (!o) return;
  switch (o.tipo) {
    case 'tel': cogerTelefono(); break;
    case 'cliente': atenderCliente(o.cl); break;
    case 'herr': coger(o.r.id); break;
    case 'encargo': {
      const d = ENCARGOS[o.t];
      if (G.encargos[o.t].ramon && ramon.trabajaT > 0 && ramon.encargo === o.t) return;
      if (paco.herrs.includes(d.herr)) { empezarMini(o.t); return; }
      if (!paco.herrs.length) { decir(paco, frase(FRASES.jugadorSinHerr, HERRAMIENTAS[d.herr].nombre), 1); return; }
      decir(paco, frase(FRASES.jugadorMalaHerr, HERRAMIENTAS[paco.herrs[0]].nombre), 1);
      paco.estado = 'trabajando'; paco.t = 1.2;
      luego(1.2, () => { if (G.encargos[o.t].activo) resolver(o.t, 'chapuza', 'jugador'); });
      break;
    }
    case 'socio': ordenarSocio(); break;
    case 'charla': decir(o.cl, frase(FRASES.charla[o.cl.id]), 1); break;
    case 'michi': Sonido.miau(); estrellitas(michi.c.g.position.x, 0.8, michi.c.g.position.z); break;
  }
}

/* =========================================================================
   El compañero (lo controla el juego)
   ========================================================================= */
function ordenarSocio() {
  const libres = TIPOS.filter(t => G.encargos[t].activo && !G.encargos[t].ramon);
  ramon.c.cuerpo.rotation.set(0, 0, 0); ramon.c.cuerpo.position.set(0, 0, 0); bocataSocio.visible = false;
  ramon.dormido = false; ramon.sentado = false;
  if (!libres.length) { decir(ramon, frase(FRASES.socioOrdenSin), 1); ramon.estado = 'idle'; ramon.t = 4; return; }
  decir(ramon, frase(FRASES.socioOrden), 1);
  asignarSocio(libres.sort((a, b) => G.encargos[a].t - G.encargos[b].t)[0], 3.2);
}
function asignarSocio(tipo, vel = 2.4) {
  if (ramon.encargo && G.encargos[ramon.encargo]) G.encargos[ramon.encargo].ramon = false;
  Object.assign(ramon, { estado: 'ayudar', encargo: tipo, velAyuda: vel, trabajaT: 0 });
  G.encargos[tipo].ramon = true;
  const [x, z] = ENCARGOS[tipo].pie;
  irA(ramon, x, z);
}
const cercaJugador = (e, r = 13) => dist2D(e.c.g.position.x, e.c.g.position.z, paco.c.g.position.x, paco.c.g.position.z) < r;
function actualizarSocio(dt) {
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
        if (libres.length && tirada < 0.25) { if (cercaJugador(r)) decir(r, frase(FRASES.socioAyuda), 0); asignarSocio(pick(libres)); }
        else if (tirada < 0.5) { r.estado = 'almuerzo'; irA(r, -18, 3.55); if (cercaJugador(r)) decir(r, frase(FRASES.socioAlmuerzo), 0); }
        else if (tirada < 0.65) { r.estado = 'siesta'; irA(r, -29.2, 3.7); }
        else { r.estado = 'pasea'; const [x, z] = pick(PUNTOS_SOCIO); irA(r, x, z); if (Math.random() < 0.4 && cercaJugador(r)) decir(r, frase(FRASES.socioPasea), 0); }
      }
      break;
    case 'pasea':
      if (caminar(r, dt, 1.9)) {
        const z = zona(pos.x, pos.z);
        if (Math.random() < r.chapucero * 0.6 && z !== 'calle' && z !== 'taller') { crearPlatano(pos.x + rand(-0.3, 0.3), pos.z + rand(-0.3, 0.3)); if (cercaJugador(r)) decir(r, frase(FRASES.socioPlatano), 0); }
        r.estado = 'idle'; r.t = rand(2, 5);
      }
      break;
    case 'almuerzo':
      if (r.sentado) {
        bocataSocio.visible = true;
        animarAndar(r.c, dt, 0, false, r.c.mixer ? 'Idle_Neutral' : null);
        r.c.brazos[1].rotation.x = -1.6 + Math.sin(performance.now() / 180) * 0.25;
        if (r.t <= 0) { r.sentado = false; bocataSocio.visible = false; r.c.cuerpo.position.y = 0; r.estado = 'idle'; r.t = rand(1, 3); G.stats.bocatasSocio++; sumar(-3, `Bocadillo de ${r.nombre} (a cuenta del taller)`); }
      } else if (caminar(r, dt, 2.0)) {
        r.sentado = true; r.t = rand(10, 15); r.c.g.rotation.y = Math.PI; r.c.cuerpo.position.y = r.c.mixer ? 0 : -0.36;
      }
      break;
    case 'siesta':
      if (r.dormido) {
        animarAndar(r.c, dt, 0, false, r.c.mixer ? 'Idle_Neutral' : null);
        if (Math.random() < dt * 1.3) emitir(pos.x, 1.0, pos.z, 1, { color: 0xffffff, brilla: true, cubo: true, vel: 0.2, sube: 0.6, gravedad: -0.2, tam: 0.09, vida: 1.6 });
        if (r.t <= 0) { r.dormido = false; r.c.cuerpo.rotation.set(0, 0, 0); r.c.cuerpo.position.set(0, 0, 0); r.estado = 'idle'; r.t = rand(1, 3); }
      } else if (caminar(r, dt, 1.9)) {
        r.dormido = true; r.t = rand(10, 14); r.c.g.rotation.y = Math.PI / 2;
        r.c.cuerpo.rotation.set(0, 0, Math.PI / 2 - 0.1); r.c.cuerpo.position.set(-0.85, 0.62, 0);
        if (cercaJugador(r)) decir(r, frase(FRASES.socioSiesta), 0);
      }
      break;
    case 'ayudar': {
      const e = G.encargos[r.encargo];
      if (!r.encargo || !e || !e.activo) { if (r.encargo && cercaJugador(r)) decir(r, frase(FRASES.socioTarde), 0); r.encargo = null; r.estado = 'idle'; r.t = 3; break; }
      if (r.trabajaT > 0) {
        r.trabajaT -= dt; trabajando = true;
        if (Math.random() < dt * 6) emitir(pos.x, 1.2, pos.z, 2, { color: [0xbdbdbd, 0xffd23f], vel: 1.5, sube: 2, tam: 0.04, vida: 0.4, cubo: true });
        if (r.trabajaT <= 0) {
          const tipo = r.encargo; r.encargo = null; r.estado = 'idle'; r.t = rand(3, 5);
          resolver(tipo, Math.random() < r.chapucero ? 'chapuza' : 'bien', 'socio');
        }
      } else if (caminar(r, dt, r.velAyuda || 2.4)) {
        r.trabajaT = 3.5;
        const obj = ENCARGOS[r.encargo].mira;
        r.c.g.rotation.y = Math.atan2(obj[0] - pos.x, obj[1] - pos.z);
      }
      break;
    }
  }
  if (!r.sentado && !r.dormido) animarAndar(r.c, dt, r.vel, trabajando);
  if (r.tinte > 0) { r.tinte -= dt; if (r.tinte <= 0) restaurarTinte(r); }
}

/* =========================================================================
   Clientes y Michi
   ========================================================================= */
function actualizarCliente(cl, dt) {
  cl.t -= dt; cl.charlaT -= dt;
  switch (cl.estado) {
    case 'casa': {
      if (cl.t <= 0) {
        cl.t = 3;
        const suyos = TIPOS.filter(t => (G.encargos[t].activo || G.encargos[t].pedido) && ENCARGOS[t].cliente === cl.id).sort((a, b) => G.encargos[a].t - G.encargos[b].t);
        let dest = null;
        if (suyos.length) {
          const [x, z] = ENCARGOS[suyos[0]].pie;
          const c = CENTROS[zona(x, z)];
          const dx = c[0] - x, dz = c[1] - z, d = Math.hypot(dx, dz) || 1;
          dest = [x + dx / d * 1.6, z + dz / d * 1.6];
        } else if ((!cl.ruta || !cl.ruta.length) && Math.random() < 0.35) dest = pick(cl.paseo);
        if (dest && (!cl.dest || dist2D(dest[0], dest[1], cl.dest[0], cl.dest[1]) > 0.5)) irA(cl, dest[0], dest[1]);
      }
      if (caminar(cl, dt, 1.6)) {
        const p = paco.c.g.position, q = cl.c.g.position;
        if (dist2D(p.x, p.z, q.x, q.z) < 8) cl.c.g.rotation.y = angLerp(cl.c.g.rotation.y, Math.atan2(p.x - q.x, p.z - q.z), 1 - Math.exp(-3 * dt));
      }
      if (cl.charlaT <= 0) { cl.charlaT = rand(30, 45); if (cercaJugador(cl, 9)) decir(cl, frase(FRASES.charla[cl.id]), 0); }
      break;
    }
    case 'yendoTaller':
      if (caminar(cl, dt, 1.9)) {
        cl.estado = 'esperando'; cl.esperaT = 40; cl.c.g.rotation.y = Math.PI; cl.saludo = 2.2;
        Sonido.timbre();
        decir(cl, nombres(pick(cl.id === 'remedios' ? FRASES.remediosLlega : FRASES.leopoldoLlega)), 1);
      }
      break;
    case 'esperando': {
      cl.esperaT -= dt;
      const p = paco.c.g.position, q = cl.c.g.position;
      cl.c.g.rotation.y = angLerp(cl.c.g.rotation.y, Math.atan2(p.x - q.x, p.z - q.z), 1 - Math.exp(-3 * dt));
      // Impaciencia: da golpecitos con el pie
      cl.c.piernas[1].rotation.x = cl.esperaT < 15 ? Math.max(0, Math.sin(performance.now() / 120)) * -0.3 : 0;
      if (cl.esperaT <= 0) {
        decir(cl, FRASES.plantado[cl.id], 2);
        paciencia(-10); G.stats.plantados++;
        toast(`😤 ${cl.nombre} se ha ido sin que nadie le atienda`, 'menos');
        cancelarPedido(cl.pedido); cl.pedido = null;
        cl.estado = 'volviendo'; irA(cl, cl.casa[0], cl.casa[1]);
      }
      break;
    }
    case 'volviendo':
      if (caminar(cl, dt, 1.8)) { cl.estado = 'casa'; cl.t = 1; }
      break;
  }
  if (cl.saludo > 0) cl.saludo -= dt;
  if (cl.estado !== 'esperando') animarAndar(cl.c, dt, cl.vel);
  else animarAndar(cl.c, dt, 0, false, cl.saludo > 0 ? 'Wave' : null);
  // Brazos en jarras si los clientes están hartos
  const jarras = G.paciencia < 40;
  cl.c.brazos[0].rotation.z = jarras ? 0.6 : 0; cl.c.brazos[1].rotation.z = jarras ? -0.6 : 0;
}
function actualizarMichi(dt) {
  const m = michi;
  m.t -= dt; m.cdTropiezo -= dt;
  if (m.t <= 0 && (!m.ruta || !m.ruta.length)) {
    m.t = rand(2, 6);
    const zj = zona(paco.c.g.position.x, paco.c.g.position.z);
    if (Math.random() < 0.3 && ['salon', 'cocina', 'dorm', 'bano'].includes(zj)) irA(m, paco.c.g.position.x + rand(-1, 1), paco.c.g.position.z + rand(-1, 1));
    else { const [x, z] = pick(PUNTOS_MICHI); irA(m, x, z); }
  }
  caminar(m, dt, 2.4);
  const c = m.c;
  c.fase += dt * 12 * (m.vel > 0 ? 1 : 0);
  c.patas.forEach((p, i) => { p.rotation.x = Math.sin(c.fase + (i % 2) * Math.PI) * 0.6 * (m.vel > 0 ? 1 : 0); });
  c.cola.rotation.z = Math.sin(performance.now() / 300) * 0.5;
  const p = paco.c.g.position, q = c.g.position;
  if (m.cdTropiezo <= 0 && paco.estado === 'normal' && paco.vel > 1.5 && dist2D(p.x, p.z, q.x, q.z) < 0.55) {
    m.cdTropiezo = 8;
    Sonido.miau();
    resbalar('gato');
    irA(m, ...pick(PUNTOS_MICHI));
  }
}

/* =========================================================================
   El jugador: movimiento y estados
   ========================================================================= */
function actualizarJugador(dt) {
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
      const vmax = (corre ? 6.4 : 4.4) * (paco.boost > 0 ? 1.45 : 1);
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
      animarAndar(c, dt, 0, false, 'HitRecieve');
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
      if (c.mixer) {
        // Con esqueleto: vuelta en el aire y caída de verdad
        if (t < 0.45) { c.g.rotation.y += dt * 22; c.cuerpo.position.y = Math.sin(t / 0.45 * Math.PI) * 0.5; animarAndar(c, dt, 0, false, 'HitRecieve'); }
        else { c.cuerpo.position.y = 0; animarAndar(c, dt, 0, false, 'Death'); }
        if (t >= dur + 0.6) { paco.estado = 'normal'; c.cuerpo.rotation.set(0, 0, 0); c.cuerpo.position.set(0, 0, 0); }
        break;
      }
      if (t < 0.45) { c.g.rotation.y += dt * 22; c.cuerpo.position.y = Math.sin(t / 0.45 * Math.PI) * 0.5; }
      else if (t < 0.65) { c.cuerpo.rotation.x = lerp(0, -1.45, (t - 0.45) / 0.2); c.cuerpo.position.y = 0.15; }
      else if (t < dur - 0.35) {
        c.cuerpo.rotation.x = -1.45; c.cuerpo.position.y = 0.15;
        c.piernas[0].rotation.x = Math.sin(t * 20) * 0.5; c.piernas[1].rotation.x = -Math.sin(t * 20) * 0.5;
      } else c.cuerpo.rotation.x = lerp(-1.45, 0, clamp((t - (dur - 0.35)) / 0.35, 0, 1));
      if (t >= dur) { paco.estado = 'normal'; c.cuerpo.rotation.set(0, 0, 0); c.cuerpo.position.set(0, 0, 0); }
      break;
    }
  }
  resolverColision(p, 0.33);
  if (paco.estado === 'normal' && paco.vel > 1.2) {
    for (let i = peligros.length - 1; i >= 0; i--) {
      const h = peligros[i];
      if (dist2D(p.x, p.z, h.x, h.z) < h.r * h.m.scale.x + 0.15) {
        resbalar(h.tipo);
        if (h.tipo === 'platano') { h.m.removeFromParent(); peligros.splice(i, 1); }
        break;
      }
    }
  }
  if (bocata.visible && dist2D(p.x, p.z, bocata.position.x, bocata.position.z) < 0.75) {
    bocata.visible = false; G.bocataT = rand(35, 50);
    paco.boost = 12; G.stats.bocatasJugador++;
    Sonido.nam();
    decir(paco, nombres(pick(['¡Bocata de calamares! ¡Esto da alas!', 'Esto no se lo digas a {S}...'])), 0);
    estrellitas(p.x, 1.2, p.z);
  }
}
function actualizarBocata(dt) {
  if (!bocata.visible) {
    G.bocataT -= dt;
    if (G.bocataT <= 0) {
      const [x, z] = pick(PUNTOS_BOCATA);
      bocata.position.set(x, 0.5, z); bocata.visible = true;
      toast('🥖 ¡Un bocata de calamares por ahí! (corres más)', 'mas');
    }
    return;
  }
  bocata.rotation.y += dt * 2;
  bocata.position.y = 0.5 + Math.sin(performance.now() / 300) * 0.1;
  const q = ramon.c.g.position;
  if (dist2D(q.x, q.z, bocata.position.x, bocata.position.z) < 0.8 && !ramon.dormido) {
    bocata.visible = false; G.bocataT = rand(35, 50);
    Sonido.nam();
    if (cercaJugador(ramon)) decir(ramon, frase(FRASES.socioBocata), 0);
  }
}
function actualizarPeligros(dt) {
  for (let i = peligros.length - 1; i >= 0; i--) {
    const h = peligros[i];
    h.vida -= dt;
    if (h.tipo === 'charco') h.m.scale.setScalar(h.vida < 3 ? Math.max(0.01, h.vida / 3) : Math.min(1, h.m.scale.x + dt * 1.5));
    if (h.vida <= 0) { h.m.removeFromParent(); peligros.splice(i, 1); }
  }
}
function actualizarMarcadores(dt) {
  const tt = performance.now() / 1000;
  for (const t of TIPOS) {
    const m = marcadoresEncargo[t], e = G.encargos[t];
    m.visible = e.activo;
    if (!m.visible) continue;
    const [x, z] = ENCARGOS[t].pie;
    m.position.set(x, 2.2 + Math.sin(tt * 3 + x) * 0.12, z);
    m.children[0].rotation.y = tt * 2;
    const urg = e.t < 15;
    m.children[0].material.color.setHex(urg ? 0xe53935 : 0xffc21a); m.children[0].material.emissive.setHex(urg ? 0xe53935 : 0xffc21a);
  }
  marcadorTel.visible = !!G.tel;
  if (G.tel) { marcadorTel.position.set(-15.25, 2.4 + Math.sin(tt * 6) * 0.15, -3.3); telefono.rotation.z = Math.sin(tt * 60) * 0.05; }
  else telefono.rotation.z = 0;
}

/* =========================================================================
   Globo de diálogo (uno solo, el de quien está hablando)
   ========================================================================= */
const vTmp = new THREE.Vector3();
function actualizarGlobo() {
  const globo = $('globo');
  const a = Dialogo.actual;
  if (!a) { globo.classList.add('oculto'); globo._texto = null; return; }
  if (globo._texto !== a.texto || globo._e !== a.e) {
    globo._texto = a.texto; globo._e = a.e;
    globo.className = `globo ${a.e.clase}`;
    globo.innerHTML = `<b>${a.e.nombre}</b><span></span>`;
    globo.querySelector('span').textContent = a.texto;
  }
  const w = window.innerWidth, h = window.innerHeight;
  const pos = a.e.c.g.position;
  vTmp.set(pos.x, pos.y + a.e.alturaGlobo, pos.z).project(camera);
  const detras = vTmp.z > 1;
  let x = (vTmp.x + 1) / 2 * w, y = (1 - vTmp.y) / 2 * h;
  const fuera = detras || x < 0 || x > w || y < 0 || y > h;
  const mx = Math.min(150, w / 2 - 10);
  // El globo nunca se monta encima del panel de la izquierda (importante en el móvil)
  const tope = (w < 760 ? $('hud-izq').getBoundingClientRect().bottom : 0) + globo.offsetHeight + 18;
  x = clamp(x, mx, w - mx); y = clamp(y, Math.max(110, tope), h - 60);
  globo.style.left = x + 'px'; globo.style.top = y + 'px';
  globo.classList.toggle('lejos', fuera);
  globo.classList.remove('oculto');
}

/* =========================================================================
   Luces (apagones) y cámara
   ========================================================================= */
function actualizarLuces(dt) {
  if (G.apagon > 0) G.apagon -= dt;
  const oscuro = G.apagon > 0;
  const k = 1 - Math.exp(-4 * dt);
  renderer.toneMappingExposure = lerp(renderer.toneMappingExposure, oscuro ? 0.12 : 1.0, k);
  linterna.intensity = lerp(linterna.intensity, oscuro ? 400 : 0, k);
  const p = paco.c.g.position;
  linterna.position.set(p.x, 3.2, p.z + 0.5);
  linterna.target.position.set(p.x + Math.sin(paco.c.g.rotation.y) * 2.5, 0, p.z + Math.cos(paco.c.g.rotation.y) * 2.5);
  // El sol sigue al jugador para que las sombras sean nítidas
  sol.position.set(p.x + 10, 22, p.z + 12);
  sol.target.position.set(p.x, 0, p.z);
}
const camObjetivo = new THREE.Vector3(), camMira = new THREE.Vector3();
function actualizarCamara(dt, inmediato = false) {
  const p = paco.c.g.position;
  const lejos = (camera.aspect < 1 ? 1.5 : camera.aspect < 1.4 ? 1.18 : 1) * (G.zoom || 1);
  camObjetivo.set(p.x, 11.5 * lejos, p.z + 9.5 * lejos);
  if (inmediato) camera.position.copy(camObjetivo);
  else camera.position.lerp(camObjetivo, 1 - Math.exp(-4 * dt));
  camMira.set(camera.position.x, 0.8, camera.position.z - 9.5 * lejos - 0.4);
  if (G.temblor > 0) {
    G.temblor -= dt;
    camera.position.x += rand(-1, 1) * G.temblor * 0.6;
    camera.position.y += rand(-1, 1) * G.temblor * 0.6;
  }
  camera.lookAt(camMira);
}

/* =========================================================================
   Fin de la jornada: la factura
   ========================================================================= */
function terminar(motivo) {
  if (G.fin) return;
  G.fin = true; G.jugando = false;
  Musica.activa = false;
  cancelarMini();
  Dialogo.limpiar();
  $('globo').classList.add('oculto');
  $('hud').classList.add('oculto'); $('botones').classList.add('oculto'); $('tactil').classList.add('oculto');
  const S = G.stats;
  const lineas = [];
  if (S.fino) lineas.push([`Trabajos finos (${S.fino} × 60 €)`, S.fino * 60]);
  if (S.bien) lineas.push([`Trabajos apañaos (${S.bien} × 40 €)`, S.bien * 40]);
  if (S.socioBien) lineas.push([`Trabajos de ${ramon.nombre} que salieron bien, sorprendentemente (${S.socioBien} × 20 €)`, S.socioBien * 20]);
  const cuenta = {};
  S.desperfectos.forEach(t => cuenta[t] = (cuenta[t] || 0) + 1);
  for (const [t, n] of Object.entries(cuenta)) lineas.push([`Desperfecto: ${DESPERFECTOS[t]}${n > 1 ? ` (×${n})` : ''}`, -25 * n]);
  if (S.bocatasSocio) lineas.push([`Bocadillos de ${ramon.nombre} (${S.bocatasSocio} × 3 €)`, -3 * S.bocatasSocio]);
  if (S.resbalones) lineas.push([`Plus de peligrosidad por resbalones (${S.resbalones} × 2 €)`, 2 * S.resbalones]);
  if (!lineas.length) lineas.push(['Día de taller sin trabajo (se jugó al mus)', 0]);
  const base = lineas.reduce((a, l) => a + l[1], 0);
  const iva = base > 0 ? Math.round(base * 0.21) : 0;
  const total = base + iva;
  const nota = clamp(Math.round((base / 80 + G.paciencia / 25) / 1.8), 0, 5);
  const estrellas = motivo === 'fuera' ? 0 : Math.max(1, nota);
  const opiniones = [
    'No vuelvo a llamarles. Bueno, igual el martes.',
    'No vuelvo a llamarles. Bueno, igual el martes.',
    'Lo han dejado... distinto. Mi hermana dice que «con personalidad».',
    'Ni tan mal. Para lo que cobran, ni tan mal.',
    'Muy apañaos. Les voy a recomendar a la del quinto.',
    `¡Unos artistas! ${paco.nombre}, si quiere se queda a comer. ${ramon.nombre} no, que ya ha comido.`,
  ];
  const fecha = new Date().toLocaleDateString('es-ES');
  const filas = lineas.map(([t, v]) => `<tr><td>${t}</td><td class="${v < 0 ? 'neg' : ''}">${euros(v)}</td></tr>`).join('');
  $('final-contenido').innerHTML = `
    ${motivo === 'fuera'
      ? `<div class="sello-fuera">¡NOS HAN CERRADO EL TALLER!</div><p class="lema">Los clientes se han hartado a las ${$('reloj').firstChild.nodeValue}. ${ramon.nombre} ha salvado el bocadillo.</p>`
      : `<h1 class="titulo" style="font-size:54px">¡Fin de la jornada!</h1><p class="lema" style="margin-top:12px">Son las 18:00. ${ramon.nombre} ya ha bajado la persiana del taller.</p>`}
    <div class="factura">
      <h2>FACTURA ${String(Math.floor(rand(1, 999))).padStart(3, '0')}/B</h2>
      <div class="cab">ARRICIO Y JEREMÍAS · Reformas y chapuzas a domicilio · ${fecha}</div>
      <table>${filas}
        <tr><td>Base imponible</td><td>${euros(base)}</td></tr>
        <tr><td>IVA (21 %)</td><td>${euros(iva)}</td></tr>
        <tr class="total"><td>TOTAL</td><td class="${total < 0 ? 'neg' : ''}">${euros(total)}</td></tr>
      </table>
      <div class="pie">${total < 0 ? '* Sí: con esta jornada, el taller pierde dinero.' : `* ${ramon.nombre} pregunta si se puede cobrar «en especie» (croquetas).`}<br>
      * Llamadas sin coger: ${S.llamadasPerdidas}. Clientes que se fueron sin atender: ${S.plantados}. Encargos que caducaron: ${S.expirado}.<br>
      * Oficios de hoy: ${[...S.oficios].map(o => OFICIOS[o].persona).join(', ') || 'ninguno (se pasaron el día mirando)'}.</div>
    </div>
    <div class="valoracion">Opinión de los clientes<div class="estrellas">${'★'.repeat(estrellas)}${'☆'.repeat(5 - estrellas)}</div>
      <q>${motivo === 'fuera' ? '¡Y no vuelvan por el barrio! ...Bueno, a tomar café sí.' : opiniones[estrellas]}</q></div>
    <div class="botonera"><button class="boton" id="btn-otra">Otra jornada</button><button class="boton secundario" id="btn-portada">Cambiar de chapuzas</button></div>`;
  $('btn-otra').addEventListener('click', empezar);
  $('btn-portada').addEventListener('click', () => { $('final').classList.add('oculto'); $('portada').classList.remove('oculto'); posePortada(); });
  $('final').classList.remove('oculto');
  if (motivo === 'fuera') Sonido.trombon(); else Sonido.fanfarria();
}

/* =========================================================================
   Bucle principal
   ========================================================================= */
function actualizarJuego(dt) {
  G.t += dt;
  for (let i = G.cola.length - 1; i >= 0; i--) if (G.cola[i].t <= G.t) { const f = G.cola[i].fn; G.cola.splice(i, 1); f(); }
  G.pedidoT -= dt;
  if (G.pedidoT <= 0) { generarPedido(); G.pedidoT = lerp(20, 11, progreso()) + rand(-3, 3); }
  // Teléfono sonando
  if (G.tel) {
    G.tel.t -= dt; G.tel.ringT -= dt;
    if (G.tel.ringT <= 0) { Sonido.ring(); G.tel.ringT = 1.6; }
    if (G.tel.t <= 0) {
      const tipo = G.tel.tipo; G.tel = null;
      G.stats.llamadasPerdidas++; paciencia(-6);
      cancelarPedido(tipo);
      toast(`📞 Han colgado: ${CLIENTES[ENCARGOS[tipo].cliente].nombre} llamará a otro taller`, 'menos');
    }
  }
  for (const t of TIPOS) {
    const e = G.encargos[t];
    if (e.cd > 0) e.cd -= dt;
    if (!e.activo) continue;
    if (G.mini && G.mini.tipo === t) continue;
    if (ramon.encargo === t && ramon.trabajaT > 0) continue;
    e.t -= dt;
    if (e.t <= 0) {
      e.activo = false; e.ramon = false; e.cd = 12;
      Visual.poner(t, 'ok');
      G.stats.expirado++;
      paciencia(-15);
      const cl = CLIENTES[ENCARGOS[t].cliente];
      toast(`⌛ ${cl.nombre} se ha cansado de esperar: ${ENCARGOS[t].nombre}`, 'menos');
      if (cercaJugador(cl, 16)) decir(cl, pick(FRASES.expira[cl.id]), 1);
      Sonido.trombon();
    }
  }
  if (G.mini) {
    const m = G.mini;
    m.p += m.dir * m.vel * dt;
    if (m.p > 1) { m.p = 1; m.dir = -1; } else if (m.p < 0) { m.p = 0; m.dir = 1; }
    $('mini-aguja').style.left = (m.p * 100) + '%';
  }
  if (G.accion) { G.accion = false; accion(); }
  actualizarJugador(dt);
  actualizarSocio(dt);
  Object.values(CLIENTES).forEach(cl => actualizarCliente(cl, dt));
  actualizarMichi(dt);
  actualizarBocata(dt);
  actualizarPeligros(dt);
  actualizarMarcadores(dt);
  Visual.actualizar(dt);
  const pista = $('pista');
  const txt = G.mini || paco.estado !== 'normal' ? null : textoPista(objetivoCercano());
  if (txt) { pista.innerHTML = esTactil ? txt.replace(/<kbd>E<\/kbd>/g, '<kbd>¡DALE!</kbd>') : txt; pista.classList.remove('oculto'); }
  else pista.classList.add('oculto');
  actualizarHUD();
  if (G.paciencia <= 0) terminar('fuera');
  else if (G.t >= DURACION) terminar('tiempo');
}

// Portada: los dos chapuzas posan delante del taller
function posePortada() {
  reiniciar();
  const a = CHAPUZAS.arricio.c.g, j = CHAPUZAS.jeremias.c.g;
  a.position.set(-21, 0, 6.6); a.rotation.y = -0.3;
  j.position.set(-23.2, 0, 6.8); j.rotation.y = 0.4;
  actualizarCamara(0, true);
}
posePortada();

let ultimo = performance.now();
function bucle(ahora) {
  requestAnimationFrame(bucle);
  const dt = Math.min(0.05, (ahora - ultimo) / 1000);
  ultimo = ahora;
  if (G.jugando && !G.pausa) actualizarJuego(dt);
  else if (!G.jugando && !G.fin) {
    const elegido = CHAPUZAS[eleccion].c, otro = CHAPUZAS[eleccion === 'arricio' ? 'jeremias' : 'arricio'].c;
    animarAndar(elegido, dt, 0, false, 'Wave'); animarAndar(otro, dt, 0);
    elegido.brazos[0].rotation.z = Math.sin(ahora / 300) * 0.3 + 2.6;
    otro.brazos[0].rotation.z = lerp(otro.brazos[0].rotation.z, 0, 0.1);
    paco.c = elegido; // la cámara sigue al elegido en la portada
  }
  if (!G.pausa) { actualizarParticulas(dt); actualizarLuces(dt); Dialogo.actualizar(dt); actualizarGlobo(); }
  Musica.tic();
  actualizarCamara(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(bucle);

// Ganchos de depuración (sólo con ?debug en la URL)
if (location.search.includes('debug')) window.__j = { G, PJ, camera, CHAPUZAS, CLIENTES, asignarPapeles, paco, ramon, remedios, leopoldo, michi, resolver, generarPedido, activarEncargo, cogerTelefono, atenderCliente, empezarMini, coger, terminar, ordenarSocio, crearPlatano, resbalar, Dialogo, Voz };
