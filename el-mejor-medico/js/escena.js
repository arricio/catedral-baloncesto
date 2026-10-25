// EL MEJOR MÉDICO — mundo 3D: personajes, consulta, sala de hospitalización, quirófano y estudio del creador.
import * as THREE from 'three';
import { RoomEnvironment } from '../vendor/RoomEnvironment.js';
import { RoundedBoxGeometry } from '../vendor/RoundedBoxGeometry.js';
import { dibujarRx, ecgValor } from './imagenes.js';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/SkeletonUtils.js';

const T = THREE;
const PI = Math.PI;

// ───────────────────────── utilidades ─────────────────────────
function lienzo(w, h, fn, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8;
  t.userData.canvas = c;
  return t;
}
const std = (color, o = {}) => new T.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, envMapIntensity: 0.4, ...o });
function sombra(m, cast = true, rec = true) { m.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = rec; } }); return m; }
function caja(w, h, d, m, r = 0) { const g = r ? new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)) : new T.BoxGeometry(w, h, d); const me = new T.Mesh(g, m); me.castShadow = me.receiveShadow = true; return me; }
function cil(rt, rb, h, m, seg = 24, abierto = false) { const me = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg, 1, abierto), m); me.castShadow = me.receiveShadow = true; return me; }
function esf(r, m, ws = 24, hs = 16) { const me = new T.Mesh(new T.SphereGeometry(r, ws, hs), m); me.castShadow = me.receiveShadow = true; return me; }
function cap(r, l, m) { const me = new T.Mesh(new T.CapsuleGeometry(r, l, 6, 16), m); me.castShadow = me.receiveShadow = true; return me; }
function pon(o, padre, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); padre.add(o); return o; }
function plano(w, h, m) { const me = new T.Mesh(new T.PlaneGeometry(w, h), m); me.receiveShadow = true; return me; }
function tubo(puntos, r, m) { const c = new T.CatmullRomCurve3(puntos.map(p => new T.Vector3(...p))); const me = new T.Mesh(new T.TubeGeometry(c, 40, r, 8), m); me.castShadow = true; return me; }
// pieza orgánica por torno: perfil [[radio, y], ...]
function torno(perfil, m, seg = 28) { const me = new T.Mesh(new T.LatheGeometry(perfil.map(([r, y]) => new T.Vector2(r, y)), seg), m); me.castShadow = me.receiveShadow = true; return me; }
// extremidad que se estrecha (de r1 arriba a r2 abajo), con extremos redondeados, colgando desde y=0 hasta y=-L
function miembro(r1, r2, L, m) {
  const p = [];
  for (let i = 0; i <= 6; i++) { const a = (i / 6) * PI / 2; p.push([Math.sin(a) * r2, -L - Math.cos(a) * r2 * 0.8]); }
  for (let i = 1; i < 6; i++) { const t = i / 6; p.push([r2 + (r1 - r2) * t + Math.sin(t * PI) * (r1 - r2) * 0.25 + Math.sin(t * PI) * r1 * 0.06, -L + L * t]); }
  for (let i = 0; i <= 6; i++) { const a = PI / 2 - (i / 6) * PI / 2; p.push([Math.sin(a) * r1, Math.cos(a) * r1 * 0.8]); }
  p[p.length - 1][0] = 0.0001;
  return torno(p, m, 20);
}
const mezcla = (a, b, t) => '#' + new T.Color(a).lerp(new T.Color(b), t).getHexString();
// sombra de contacto suave (oclusión falsa) bajo muebles y personas
let texSombra = null;
function sombraSuelo(w, d, op = 0.45) {
  texSombra = texSombra || lienzo(128, 128, (c) => { const g = c.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); });
  const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ map: texSombra, transparent: true, opacity: op, depthWrite: false }));
  m.rotation.x = -PI / 2; m.position.y = 0.004; m.renderOrder = 1;
  return m;
}

// ───────────────────────── texturas ─────────────────────────
const TX = {};
function texturas() {
  if (TX.suelo) return TX;
  TX.suelo = lienzo(512, 512, (c, w, h) => {
    c.fillStyle = '#c4c8ca'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = 120 + Math.random() * 120 | 0; c.fillStyle = `rgba(${v},${v},${v + 4},${0.25 + Math.random() * 0.35})`; c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2); }
    c.strokeStyle = 'rgba(90,95,100,0.25)'; c.lineWidth = 2; c.strokeRect(0, 0, w, h);
  }, [6, 6]);
  TX.sueloQ = lienzo(512, 512, (c, w, h) => {
    c.fillStyle = '#9ea4a8'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) { const v = 100 + Math.random() * 110 | 0; c.fillStyle = `rgba(${v},${v},${v},0.4)`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  }, [8, 8]);
  TX.techo = lienzo(512, 512, (c, w, h) => {
    c.fillStyle = '#e9eaea'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) { c.fillStyle = 'rgba(150,150,150,0.25)'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
    c.strokeStyle = '#b9bcbe'; c.lineWidth = 6; c.strokeRect(0, 0, w, h);
  }, [8, 8]);
  TX.pared = lienzo(256, 256, (c, w, h) => { c.fillStyle = '#eef0ef'; c.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [4, 2]);
  TX.azulejo = lienzo(256, 256, (c, w, h) => { c.fillStyle = '#e4e8ea'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c9cfd2'; c.lineWidth = 3; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, h); c.moveTo(0, i * 64); c.lineTo(w, i * 64); c.stroke(); } }, [6, 3]);
  TX.madera = lienzo(512, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#b48553'); g.addColorStop(1, '#a87a49'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) { c.strokeStyle = `rgba(${90 + Math.random() * 40 | 0},${55 + Math.random() * 25 | 0},25,${0.12 + Math.random() * 0.2})`; c.lineWidth = 1 + Math.random() * 2; c.beginPath(); const y = Math.random() * h; c.moveTo(0, y); for (let x = 0; x <= w; x += 32) c.lineTo(x, y + Math.sin(x * 0.02 + i) * 4); c.stroke(); }
  });
  TX.listones = lienzo(512, 512, (c, w, h) => {
    for (let x = 0; x < w; x += 8) { const v = 150 + Math.random() * 60 | 0; c.fillStyle = `rgb(${v},${v - 6},${v - 14})`; c.fillRect(x, 0, 8, h); }
    for (let i = 0; i < 600; i++) { c.fillStyle = 'rgba(80,70,60,0.12)'; c.fillRect(Math.random() * w, Math.random() * h, 1, 30 + Math.random() * 80); }
  }, [1, 1]);
  TX.bata = lienzo(256, 256, (c, w, h) => {
    c.fillStyle = '#cbdcec'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#5b7fae';
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 8; x < w; x += 16) { c.beginPath(); c.moveTo(x, y - 3); c.lineTo(x + 3, y); c.lineTo(x, y + 3); c.lineTo(x - 3, y); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,0.5)'; for (let y = 8; y < h; y += 16) for (let x = 0; x < w; x += 16) c.fillRect(x, y, 2, 2);
  }, [3, 3]);
  TX.manta = lienzo(256, 256, (c, w, h) => {
    c.fillStyle = '#f2f2f0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#9a9c9f'; c.lineWidth = 3;
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x + 16, y + 4); c.lineTo(x + 28, y + 16); c.lineTo(x + 16, y + 28); c.lineTo(x + 4, y + 16); c.closePath(); c.stroke(); c.strokeRect(x + 12, y + 12, 8, 8); }
  }, [3, 3]);
  TX.exterior = lienzo(1024, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h * 0.6); g.addColorStop(0, '#9cc6ea'); g.addColorStop(1, '#e6f1f6'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#d7dde0'; c.fillRect(w * 0.55, h * 0.3, w * 0.25, h * 0.4); for (let i = 0; i < 8; i++) { c.fillStyle = '#9fb3c1'; c.fillRect(w * 0.57 + i * 30, h * 0.36, 16, 20); c.fillRect(w * 0.57 + i * 30, h * 0.48, 16, 20); }
    for (let i = 0; i < 60; i++) { const x = Math.random() * w, y = h * (0.15 + Math.random() * 0.35), r = 40 + Math.random() * 90; const gg = c.createRadialGradient(x, y, 0, x, y, r); const v = 60 + Math.random() * 60 | 0; gg.addColorStop(0, `rgba(${v - 20},${v + 50},${30},0.95)`); gg.addColorStop(0.7, `rgba(${v - 30},${v + 30},25,0.8)`); gg.addColorStop(1, 'rgba(40,80,20,0)'); c.fillStyle = gg; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    for (let i = 0; i < 18; i++) { c.fillStyle = '#4a3b2c'; c.fillRect(Math.random() * w, h * 0.45, 6, h * 0.25); }
    c.fillStyle = '#3f6e2b'; c.fillRect(0, h * 0.62, w, h * 0.1); c.fillStyle = '#6b9a3f'; c.fillRect(0, h * 0.72, w, h * 0.28);
    for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(${40 + Math.random() * 40},${90 + Math.random() * 60},30,0.5)`; c.fillRect(Math.random() * w, h * (0.62 + Math.random() * 0.38), 2, 4); }
  });
  TX.cuadro1 = lienzo(256, 160, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9fbcd1'); g.addColorStop(0.55, '#e9eef0'); g.addColorStop(0.6, '#7a8d6b'); g.addColorStop(1, '#4f5f45'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(Math.random() * w, 20 + Math.random() * 40, 30, 8, 0, 0, 7); c.fill(); } });
  TX.cuadro2 = lienzo(256, 160, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f0c9a0'); g.addColorStop(0.5, '#f7e3cf'); g.addColorStop(0.55, '#8b8f7a'); g.addColorStop(1, '#5b5e50'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#6b6f62'; c.beginPath(); c.moveTo(0, 90); c.lineTo(60, 60); c.lineTo(120, 85); c.lineTo(190, 50); c.lineTo(256, 80); c.lineTo(256, 100); c.lineTo(0, 100); c.fill(); });
  TX.esqueleto = lienzo(512, 680, (c, w, h) => {
    c.fillStyle = '#f6f4ee'; c.fillRect(0, 0, w, h); c.fillStyle = '#1b1b1b'; c.font = 'bold 34px Georgia'; c.textAlign = 'center'; c.fillText('EL ESQUELETO HUMANO', w / 2, 50);
    c.strokeStyle = '#d8b56a'; c.fillStyle = '#e9cf8d'; c.lineCap = 'round';
    const L = (a, b, x, y, wd = 9) => { c.lineWidth = wd; c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); };
    c.beginPath(); c.ellipse(256, 115, 34, 40, 0, 0, 7); c.fill(); c.fillStyle = '#5a4a2a'; c.beginPath(); c.arc(243, 110, 7, 0, 7); c.arc(269, 110, 7, 0, 7); c.fill();
    L(256, 158, 256, 380, 8); for (let i = 0; i < 8; i++) { c.lineWidth = 5; c.beginPath(); c.ellipse(256, 200 + i * 17, 60 - i * 2, 10, 0, 0.2, PI - 0.2); c.stroke(); }
    L(200, 175, 312, 175, 7); L(205, 180, 175, 290); L(175, 290, 160, 390); L(307, 180, 337, 290); L(337, 290, 352, 390);
    c.fillStyle = '#e9cf8d'; c.beginPath(); c.ellipse(256, 400, 52, 26, 0, 0, 7); c.fill();
    L(232, 420, 222, 540, 11); L(222, 540, 220, 640, 9); L(280, 420, 290, 540, 11); L(290, 540, 292, 640, 9);
    c.fillStyle = '#333'; c.font = '13px sans-serif'; ['Cráneo', 'Clavícula', 'Costillas', 'Húmero', 'Columna', 'Pelvis', 'Fémur', 'Tibia'].forEach((t, i) => { c.textAlign = i % 2 ? 'left' : 'right'; c.fillText(t, i % 2 ? 400 : 112, 120 + i * 65); L(i % 2 ? 395 : 117, 116 + i * 65, i % 2 ? 330 : 190, 116 + i * 65, 1); });
    // calavera
    c.fillStyle = '#efe6cf'; c.beginPath(); c.ellipse(90, 590, 55, 60, 0, 0, 7); c.fill(); c.fillStyle = '#3b3326'; c.beginPath(); c.ellipse(70, 585, 13, 15, 0, 0, 7); c.ellipse(110, 585, 13, 15, 0, 0, 7); c.fill();
  });
  TX.cajaLuz = lienzo(1024, 512, (c, w, h) => {
    c.fillStyle = '#dfe9ef'; c.fillRect(0, 0, w, h);
    const tmp = document.createElement('canvas'); tmp.width = 240; tmp.height = 240; const tc = tmp.getContext('2d');
    const zonas = ['tobillo', 'muneca', 'craneo', 'muneca', 'tobillo', 'abdomen', 'muneca', 'tobillo'];
    zonas.forEach((z, i) => { dibujarRx(tc, 240, 240, { zona: z, seed: i + 3 }); c.drawImage(tmp, 8 + (i % 4) * 254, 8 + Math.floor(i / 4) * 252, 246, 244); });
  });
  TX.monitorPared = lienzo(256, 128, (c, w, h) => { c.fillStyle = '#e9eef2'; c.fillRect(0, 0, w, h); });
  TX.cajasMed = lienzo(512, 256, (c, w, h) => { c.fillStyle = '#f4f4f4'; c.fillRect(0, 0, w, h); const col = ['#e05a5a', '#5a8de0', '#f1c24a', '#69b36b', '#c46bd1', '#f08c3a', '#3fb3b3']; for (let y = 0; y < 4; y++) for (let x = 0; x < 12; x++) { c.fillStyle = '#fff'; c.fillRect(x * 42 + 2, y * 64 + 10, 38, 50); c.fillStyle = col[(x * 3 + y) % col.length]; c.fillRect(x * 42 + 2, y * 64 + 10 + 10, 38, 14); } });
  TX.papel = lienzo(256, 340, (c, w, h) => { c.fillStyle = '#f7f6f1'; c.fillRect(0, 0, w, h); c.fillStyle = '#333'; c.font = 'bold 18px sans-serif'; c.fillText('FICHA DEL PACIENTE', 30, 34); c.fillStyle = '#aaa'; for (let i = 0; i < 14; i++) c.fillRect(24, 60 + i * 18, 150 + Math.random() * 60, 3); });
  TX.celdasLuz = lienzo(256, 256, (c, w, h) => { c.fillStyle = '#1b1d20'; c.fillRect(0, 0, w, h); for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) { const px = 28 + x * 33 + (y % 2) * 16, py = 28 + y * 30; if (Math.hypot(px - 128, py - 128) > 115) continue; const g = c.createRadialGradient(px, py, 0, px, py, 14); g.addColorStop(0, '#fffef8'); g.addColorStop(0.6, '#e9eef5'); g.addColorStop(1, '#4a4f55'); c.fillStyle = g; c.beginPath(); c.arc(px, py, 13, 0, 7); c.fill(); } });
  return TX;
}
export function texDiploma(nombre) {
  return lienzo(512, 384, (c, w, h) => {
    c.fillStyle = '#f8f3e3'; c.fillRect(0, 0, w, h); c.strokeStyle = '#b39b5b'; c.lineWidth = 10; c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = '#2c2416'; c.textAlign = 'center'; c.font = 'bold 30px Georgia'; c.fillText('UNIVERSIDAD DE LEÓN', w / 2, 80);
    c.font = 'italic 20px Georgia'; c.fillText('Facultad de Medicina', w / 2, 112); c.font = '18px Georgia'; c.fillText('otorga el título de Licenciado en Medicina a', w / 2, 170);
    c.font = 'bold italic 32px Georgia'; c.fillText(nombre || 'Dr. Médico', w / 2, 220);
    c.fillStyle = '#b5332b'; c.beginPath(); c.arc(w / 2, 300, 34, 0, 7); c.fill();
  });
}
// Hoja de receta con el texto exacto que ha escrito el jugador
export function texReceta(lineas, { hospital = 'Hospital San Marcos', medico = '', paciente = '' } = {}) {
  const t = lienzo(512, 720, (c, w, h) => {
    c.fillStyle = '#fbfaf4'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#2e5aa8'; c.fillRect(0, 0, w, 70);
    c.fillStyle = '#fff'; c.font = 'bold 26px "Barlow Condensed", Arial'; c.textAlign = 'left'; c.fillText(hospital.toUpperCase(), 24, 32); c.font = '20px "Barlow Condensed", Arial'; c.fillText('RECETA MÉDICA', 24, 58);
    c.fillStyle = '#5d646b'; c.font = '20px Barlow, Arial'; c.fillText(`Paciente: ${paciente}`, 24, 104);
    c.strokeStyle = '#c9c3b3'; c.lineWidth = 2; c.beginPath(); c.moveTo(24, 118); c.lineTo(w - 24, 118); c.stroke();
    c.fillStyle = '#1d3a8a'; c.font = '30px Caveat, "Segoe Print", cursive';
    let y = 160;
    const ancho = w - 48;
    for (const l of lineas) {
      const palabras = String(l).split(/\s+/); let fila = '';
      for (const p of palabras) { const prueba = fila ? `${fila} ${p}` : p; if (c.measureText(prueba).width > ancho && fila) { c.fillText(fila, 24, y); y += 34; fila = p; } else fila = prueba; }
      if (fila) { c.fillText(fila, 24, y); y += 40; }
      if (y > h - 120) break;
    }
    c.strokeStyle = '#5d646b'; c.beginPath(); c.moveTo(w - 230, h - 70); c.lineTo(w - 24, h - 70); c.stroke();
    c.fillStyle = '#5d646b'; c.font = '18px Barlow, Arial'; c.fillText(medico, w - 230, h - 44);
    c.fillStyle = '#1d3a8a'; c.font = '34px Caveat, cursive'; c.fillText('~ Firma ~', w - 210, h - 80);
  });
  t.userData.lineas = [...lineas];
  return t;
}

// ───────────────────────── ropa ─────────────────────────
export const ROPAS = {
  bata_clasica: { n: 'Bata larga clásica', torso: '#f6f6f3', manga: 'larga', mangaColor: '#f6f6f3', pantalon: '#2e3440', falda: 0.62, faldaColor: '#f6f6f3', camisa: '#cfe0f5', corbata: '#7a1f2b', bata: true },
  bata_corbata_azul: { n: 'Bata larga con corbata azul', torso: '#f6f6f3', manga: 'larga', mangaColor: '#f6f6f3', pantalon: '#4a4f57', falda: 0.62, faldaColor: '#f6f6f3', camisa: '#ffffff', corbata: '#1e3a6e', bata: true },
  bata_corta: { n: 'Bata corta sobre pijama', torso: '#f6f6f3', manga: 'larga', mangaColor: '#f6f6f3', pantalon: '#3d6fa8', falda: 0.32, faldaColor: '#f6f6f3', camisa: '#3d6fa8', bata: true },
  bata_moderna: { n: 'Bata moderna (cuello azul)', torso: '#fbfbfb', manga: 'larga', mangaColor: '#fbfbfb', pantalon: '#1d2b4f', falda: 0.5, faldaColor: '#fbfbfb', camisa: '#1d2b4f', cuello: '#1d2b4f', bata: true },
  pijama_azul: { n: 'Pijama azul', torso: '#3d6fa8', manga: 'corta', mangaColor: '#3d6fa8', pantalon: '#3d6fa8', camisa: null },
  pijama_verde: { n: 'Pijama verde quirófano', torso: '#2f7f6f', manga: 'corta', mangaColor: '#2f7f6f', pantalon: '#2f7f6f' },
  pijama_granate: { n: 'Pijama granate', torso: '#7d2335', manga: 'corta', mangaColor: '#7d2335', pantalon: '#7d2335' },
  pijama_negro: { n: 'Pijama negro', torso: '#25282d', manga: 'corta', mangaColor: '#25282d', pantalon: '#25282d' },
  pijama_rosa: { n: 'Pijama rosa', torso: '#d77fa1', manga: 'corta', mangaColor: '#d77fa1', pantalon: '#d77fa1' },
  // ropa de otros personajes
  paciente: { n: 'Bata de paciente', torso: 'bata', manga: 'corta', mangaColor: 'bata', pantalon: 'piel', falda: 0.42, faldaColor: 'bata' },
  paciente_sin: { n: 'Paciente sin camisa', torso: 'piel', manga: 'ninguna', pantalon: '#8fa6bf', falda: 0 },
  cirujano: { n: 'Cirujano', torso: '#2f6f8f', manga: 'corta', mangaColor: '#2f6f8f', pantalon: '#2f6f8f', gorro: '#2f6f8f', mascarilla: '#9cc7e0' },
  enfermera: { n: 'Enfermera', torso: '#f2f4f6', manga: 'corta', mangaColor: '#f2f4f6', pantalon: '#f2f4f6', falda: 0.3, faldaColor: '#f2f4f6', gorro: '#f2f4f6', mascarilla: '#bcd8ec' },
  calle: { n: 'Ropa de calle', torso: '#6b5a48', manga: 'larga', mangaColor: '#6b5a48', pantalon: '#34404f', calle: true },
  nino: { n: 'Ropa de niño', torso: '#4fa3e0', manga: 'corta', mangaColor: '#4fa3e0', pantalon: '#2f4b7c', zapato: '#e8556d' },
  nino_sin: { n: 'Niño sin camiseta', torso: 'piel', manga: 'ninguna', pantalon: '#2f4b7c', zapato: '#e8556d', pantFin: 0.48 },
  bebe: { n: 'Pelele', torso: '#bfe0f6', manga: 'larga', mangaColor: '#bfe0f6', pantalon: '#bfe0f6', zapato: '#bfe0f6' },
  bebe_sin: { n: 'Pañal', torso: 'piel', manga: 'ninguna', pantalon: '#ffffff', zapato: 'piel', pantFin: 0.72 },
};
export const PELOS_NOMBRES = ['Calvo', 'Corto', 'Rapado', 'Con flequillo', 'Media melena', 'Melena larga', 'Moño', 'Coleta'];
export const BARBAS_NOMBRES = ['Sin vello', 'Barba de tres días', 'Barba completa', 'Bigote', 'Perilla', 'Bigote y perilla'];
export const GAFAS_NOMBRES = ['Sin gafas', 'Redondas metálicas', 'Rectangulares negras', 'De pasta marrón'];

// ───────────────────────── personajes ─────────────────────────
function crearHumanoProc(ap, ropaId = 'paciente') {
  const raiz = new T.Group();
  const c = ap.complexion || 1, cara = ap.cara || 1;
  let colPiel = new T.Color(ap.piel || '#e0b090');
  if (ap.palido) colPiel.lerp(new T.Color('#e8e3dc'), 0.35);
  if (ap.edad > 70) colPiel.lerp(new T.Color('#c9b3a3'), 0.1);
  const piel = new T.MeshPhysicalMaterial({ color: colPiel, envMapIntensity: 0.35, roughness: 0.58, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new T.Color('#ff9a7a').multiplyScalar(0.25) });
  const pelo = std(ap.pelo || '#3a2617', { roughness: 0.85 });
  const tela = (col) => col === 'bata' ? std('#ffffff', { map: texturas().bata, roughness: 0.9 }) : col === 'piel' ? piel : std(col, { roughness: 0.85 });
  const r = ropaParte(ropaId);
  const mTorso = tela(r.torso), mManga = r.manga === 'ninguna' ? piel : tela(r.mangaColor), mPant = tela(r.pantalon);
  const partes = {};

  const pelvis = pon(new T.Group(), raiz, 0, 0.93, 0);
  partes.pelvis = pelvis;
  const cad = torno([[0.0001, -0.11], [0.07, -0.105], [0.125, -0.07], [0.145, -0.01], [0.14, 0.04], [0.128, 0.08], [0.0001, 0.085]], r.falda && r.faldaColor === 'bata' ? tela('bata') : mPant);
  pon(cad, pelvis, 0, 0, 0).scale.set(1.18 * c * (ap.sexo === 'm' ? 1.06 : 1), 1, 0.78 * c);
  // piernas
  for (const sg of [-1, 1]) {
    const cad = pon(new T.Group(), pelvis, sg * 0.088 * c, -0.03, 0);
    const muslo = pon(miembro(0.078 * Math.sqrt(c), 0.052, 0.42, r.falda && r.faldaColor === 'bata' ? tela('bata') : mPant), cad, 0, 0, 0);
    const rod = pon(new T.Group(), cad, 0, -0.44, 0);
    pon(miembro(0.053, 0.034, 0.4, r.pantalon === 'piel' || ropaId === 'paciente' ? piel : mPant), rod, 0, 0, 0);
    const tob = pon(new T.Group(), rod, 0, -0.43, 0);
    pon(caja(0.09, 0.065, 0.24, std(ropaId === 'paciente' || ropaId === 'paciente_sin' ? '#d9d9d9' : ropaId.startsWith('pijama') || ropaId === 'cirujano' ? '#f2f2f2' : '#22252a', { roughness: 0.5 }), 0.03), tob, 0, -0.025, 0.055);
    partes[sg < 0 ? 'cadD' : 'cadI'] = cad; partes[sg < 0 ? 'rodD' : 'rodI'] = rod;
    partes[sg < 0 ? 'musloD' : 'musloI'] = muslo;
  }
  // falda de bata / bata de médico
  if (r.falda) {
    const f = pon(cil(0.19 * c, 0.245 * c, r.falda, tela(r.faldaColor), 28, true), pelvis, 0, 0.04 - r.falda / 2, 0);
    f.material = f.material.clone(); f.material.side = T.DoubleSide; f.scale.z = 0.85;
    partes.falda = f;
  }
  // tronco
  const columna = pon(new T.Group(), pelvis, 0, 0.05, 0);
  partes.columna = columna;
  const mujer = ap.sexo === 'm';
  const perfil = [[0.0001, -0.02], [0.128, -0.015], [0.124, 0.06], [mujer ? 0.108 : 0.118, 0.15], [0.128, 0.24], [0.142, 0.33], [0.15, 0.4], [0.146, 0.45], [0.125, 0.5], [0.085, 0.535], [0.052, 0.55], [0.0001, 0.552]];
  const torso = pon(torno(perfil, mTorso, 32), columna, 0, 0, 0);
  torso.scale.set(1.22 * c, 1, 0.66 * c);
  if (mujer) for (const sg of [-1, 1]) pon(esf(0.058, mTorso, 24, 16), columna, sg * 0.062 * c, 0.33, 0.066 * c).scale.set(1, 0.85, 0.5);
  partes.torso = torso;
  if (r.camisa) {
    // escote en V de la bata con camisa
    const fr = 0.15 * 0.66 * c;
    const v = new T.Shape(); v.moveTo(-0.07, 0); v.lineTo(0.07, 0); v.lineTo(0, -0.2); v.closePath();
    const camisa = pon(new T.Mesh(new T.ShapeGeometry(v), std(r.camisa, { roughness: 0.8 })), columna, 0, 0.5, fr + 0.004);
    camisa.rotation.x = -0.12;
    if (r.corbata) { const cs = new T.Shape(); cs.moveTo(-0.014, 0); cs.lineTo(0.014, 0); cs.lineTo(0.022, -0.17); cs.lineTo(0, -0.2); cs.lineTo(-0.022, -0.17); cs.closePath(); pon(new T.Mesh(new T.ShapeGeometry(cs), std(r.corbata, { roughness: 0.5 })), camisa, 0, -0.01, 0.002); }
    if (r.bata) {
      // solapas, bolsillo, bolígrafos y tarjeta
      for (const sg of [-1, 1]) { const so = pon(caja(0.05, 0.22, 0.01, tela(r.cuello || r.torso)), columna, sg * 0.06, 0.4, fr + 0.01, 0, 0, sg * 0.32); so.castShadow = false; }
      pon(caja(0.1, 0.11, 0.008, tela(r.torso)), columna, 0.09 * c, 0.3, fr + 0.006);
      [['#1d4fbf', -0.025], ['#c62828', 0], ['#222', 0.02]].forEach(([col, dx]) => pon(cil(0.005, 0.005, 0.08, std(col)), columna, 0.09 * c + dx, 0.37, fr + 0.012));
      pon(caja(0.06, 0.04, 0.004, std('#ffffff', { emissive: '#222' })), columna, -0.09 * c, 0.38, fr + 0.01);
    }
  }
  // cuello y cabeza
  const cuello = pon(new T.Group(), columna, 0, 0.54, 0);
  pon(cil(0.05, 0.055, 0.12, piel), cuello, 0, 0.04, 0);
  const cabeza = pon(new T.Group(), cuello, 0, 0.15, 0.005);
  partes.cabeza = cabeza;
  const rc = rasgosCara(cabeza, ap, { piel, pelo, tela, r, colPiel, cara, craneo: true });
  Object.assign(partes, rc);
  // brazos
  for (const sg of [-1, 1]) {
    const hom = pon(new T.Group(), columna, sg * 0.185 * c, 0.47, 0);
    pon(esf(0.052 * Math.sqrt(c), r.manga === 'ninguna' ? piel : mManga), hom, -sg * 0.012, 0.004, 0).scale.set(1.15, 0.9, 1);
    pon(miembro(0.05 * Math.sqrt(c), 0.038, 0.28, r.manga === 'ninguna' ? piel : mManga), hom, 0, 0, 0);
    const codo = pon(new T.Group(), hom, 0, -0.29, 0);
    pon(miembro(0.039, 0.029, 0.25, r.manga === 'larga' ? mManga : piel), codo, 0, 0, 0);
    if (r.manga === 'larga') pon(cil(0.046, 0.046, 0.03, mManga), codo, 0, -0.245, 0);
    const mun = pon(new T.Group(), codo, 0, -0.27, 0);
    crearMano(mun, ropaId === 'cirujano' ? std('#e6d6b8', { roughness: 0.4 }) : piel, sg);
    partes[sg < 0 ? 'homD' : 'homI'] = hom; partes[sg < 0 ? 'codoD' : 'codoI'] = codo; partes[sg < 0 ? 'munD' : 'munI'] = mun;
  }
  // estetoscopio al cuello para médicos
  if (r.bata) {
    const fr = 0.15 * 0.66 * c;
    const est = tubo([[-0.07, 0.55, 0.0], [-0.1, 0.48, fr * 0.7], [-0.06, 0.34, fr + 0.01], [0, 0.3, fr + 0.02], [0.05, 0.36, fr + 0.01], [0.09, 0.48, fr * 0.7], [0.07, 0.55, 0]], 0.006, std('#1d1f23', { roughness: 0.4 }));
    columna.add(est);
    pon(cil(0.018, 0.018, 0.012, std('#cfd3d6', { metalness: 1, roughness: 0.2 })), columna, 0, 0.29, fr + 0.025, PI / 2, 0, 0);
  }
  raiz.scale.setScalar(ap.altura || 1);
  sombra(raiz);
  // la cara no recibe sombras propias (si no, la barbilla parece barba)
  cabeza.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
  const sb = sombraSuelo(0.9, 0.7, 0.35); raiz.add(sb); partes.sombra = sb;
  // puntos de auscultación (anclados al tronco)
  const fr = 0.15 * 0.66 * c, puntos = { espalda: [], pecho: [] };
  [[-0.06, 0.4], [0.06, 0.4], [-0.075, 0.28], [0.075, 0.28], [-0.07, 0.16], [0.07, 0.16]].forEach(([x, y]) => { const o = pon(new T.Object3D(), columna, x * c, y, -fr - 0.005); puntos.espalda.push(o); });
  [[0.035, 0.38], [-0.035, 0.38], [-0.02, 0.24], [0.06, 0.22]].forEach(([x, y]) => { const o = pon(new T.Object3D(), columna, x * c, y, fr + 0.005); puntos.pecho.push(o); });
  partes.puntos = puntos;

  const h = { raiz, partes, ap, ropaId, hablando: false, mirar: null, _parpadeo: 2 + Math.random() * 3, _t: Math.random() * 10, pose: 'depie', gesto: 0 };
  h.ponerPose = (nombre) => poseHumano(h, nombre);
  h.actualizar = (dt, t) => animarHumano(h, dt, t);
  poseHumano(h, 'depie');
  return h;
}
function rasgosCara(cabeza, ap, { piel, pelo, tela, r, colPiel, cara, craneo }) {
  const out = {};
  const R0 = 0.105;
  if (craneo) pon(esf(R0, piel, 40, 28), cabeza, 0, 0, 0).scale.set(0.9 * cara, 1.07, 1.0);
  const mandibulaMat = ap.barba === 1 ? piel.clone() : piel;
  if (ap.barba === 1) mandibulaMat.color.lerp(new T.Color(ap.pelo), 0.38);
  if (craneo) { const mand = pon(esf(R0 * 0.76, mandibulaMat, 32, 20), cabeza, 0, -0.047, 0.022); mand.scale.set(0.86 * cara, 0.72, 0.9); }
  else if (ap.barba === 1) { const sb = pelo.clone(); sb.transparent = true; sb.opacity = 0.42; sb.depthWrite = false; const b = pon(new T.Mesh(new T.SphereGeometry(R0 * 0.8, 28, 16, 0, PI * 2, PI * 0.5, PI * 0.5), sb), cabeza, 0, -0.036, 0.008); b.scale.set(0.9 * cara, 0.95, 0.97); }
  // ojos
  const ojos = [], cejas = [];
  for (const sg of [-1, 1]) {
    const g = pon(new T.Group(), cabeza, sg * 0.036 * cara, 0.012, 0.084);
    pon(esf(0.0145, std('#f7f5f0', { roughness: 0.2 }), 16, 12), g, 0, 0, 0);
    pon(esf(0.0082, std(ap.ojos || '#4a2e1a', { roughness: 0.15 }), 12, 8), g, 0, 0, 0.0088);
    pon(esf(0.004, std('#050505', { roughness: 0.1 }), 8, 6), g, 0, 0, 0.0128);
    // párpado
    const p = pon(esf(0.0152, piel, 16, 10), g, 0, 0.0004, 0); p.scale.set(1.04, 0.42, 1.0); p.position.y = 0.011;
    ojos.push({ g, p });
    // ceja
    const ceja = pon(caja(0.03, 0.0055, 0.008, pelo, 0.002), cabeza, sg * 0.037 * cara, 0.04, 0.097, 0, 0, -sg * 0.1);
    cejas.push({ m: ceja, sg, y: 0.04, rz: -sg * 0.1 });
    // oreja
    if (craneo) pon(esf(0.026, piel, 12, 10), cabeza, sg * 0.098 * cara, 0, -0.005).scale.set(0.35, 1, 0.7);
  }
  // nariz
  const nz = ap.nariz || 1;
  if (craneo) { pon(cap(0.0105 * nz, 0.028 * nz, piel), cabeza, 0, -0.008, 0.103, -0.38, 0, 0); pon(esf(0.013 * nz, piel, 12, 8), cabeza, 0, -0.024, 0.107).scale.set(1.3, 0.8, 0.9); }
  // boca
  const boca = pon(esf(0.017, std('#3a1214', { roughness: 0.7 }), 16, 8), cabeza, 0, -0.043, 0.104); boca.scale.set(1.2, 0.18, 0.4);
  const labioMat = std(mezcla(colPiel.getHexString().replace(/^/, '#'), '#a8474b', 0.45), { roughness: 0.45 });
  const labioS = pon(cap(0.006, 0.026, labioMat), cabeza, 0, -0.037, 0.106, 0, 0, PI / 2);
  const labioI = pon(cap(0.0068, 0.024, labioMat), cabeza, 0, -0.049, 0.105, 0, 0, PI / 2);
  // pelo
  if (!ap._sinPelo) ponerPelo(cabeza, ap, pelo, piel, R0, cara);
  // vello facial
  if (ap.barba === 2) { const b = pon(new T.Mesh(new T.SphereGeometry(R0 * 0.8, 28, 16, 0, PI * 2, PI * 0.5, PI * 0.5), pelo), cabeza, 0, -0.035, 0.012); b.scale.set(0.9 * cara, 0.95, 0.98); b.castShadow = true; }
  if (ap.barba === 3 || ap.barba === 5) pon(cap(0.0075, 0.036, pelo), cabeza, 0, -0.03, 0.103, 0, 0, PI / 2);
  if (ap.barba === 4 || ap.barba === 5) pon(esf(0.018, pelo, 12, 10), cabeza, 0, -0.075, 0.085).scale.set(1, 1.2, 0.8);
  // gafas
  if (ap.gafas) {
    const gm = ap.gafas === 1 ? std('#c9a94e', { metalness: 0.9, roughness: 0.25 }) : ap.gafas === 2 ? std('#111', { roughness: 0.3 }) : std('#5a3a22', { roughness: 0.35 });
    const grosor = ap.gafas === 3 ? 0.0035 : 0.0018;
    for (const sg of [-1, 1]) {
      const aro = ap.gafas === 1 ? new T.Mesh(new T.TorusGeometry(0.019, grosor, 8, 24), gm) : new T.Mesh(new T.TorusGeometry(0.02, grosor, 6, 4), gm);
      if (ap.gafas !== 1) { aro.rotation.z = PI / 4; aro.scale.set(1.25, 0.85, 1); }
      pon(aro, cabeza, sg * 0.036 * cara, 0.012, 0.104);
      const pat = pon(cil(grosor, grosor, 0.1, gm, 6), cabeza, sg * 0.092 * cara, 0.016, 0.055, PI / 2, 0, 0);
      pat.castShadow = false;
    }
    pon(cil(grosor, grosor, 0.02, gm, 6), cabeza, 0, 0.016, 0.106, 0, 0, PI / 2);
  }
  if (r.gorro) { const g = pon(new T.Mesh(new T.SphereGeometry(R0 * 1.1, 28, 14, 0, PI * 2, 0, PI * 0.52), tela(r.gorro)), cabeza, 0, 0.008, -0.005); g.rotation.x = -0.25; g.scale.set(0.95 * cara, 1.05, 1.05); }
  if (r.mascarilla) { const m = pon(caja(0.11 * cara, 0.07, 0.03, tela(r.mascarilla), 0.012), cabeza, 0, -0.042, 0.098); out.mascarilla = m; }
  return Object.assign(out, { ojos, boca, labioI, labioS, cejas });
}

// ───────────────────────── expresiones y boca ─────────────────────────
// ceja: subida; rz: cejas en pico (tristeza, miedo); ojo: apertura; sonrisa: comisuras (negativo = triste)
const EXPRESIONES = {
  neutra: { ceja: 0, rz: 0, ojo: 1, sonrisa: 0, cabeza: 0 },
  alegria: { ceja: 0.003, rz: -0.05, ojo: 0.9, sonrisa: 1, cabeza: -0.03 },
  dolor: { ceja: -0.003, rz: 0.28, ojo: 0.55, sonrisa: -0.6, cabeza: 0.06 },
  tristeza: { ceja: 0.001, rz: 0.32, ojo: 0.8, sonrisa: -0.7, cabeza: 0.12 },
  miedo: { ceja: 0.006, rz: 0.22, ojo: 1.35, sonrisa: -0.3, cabeza: 0.02 },
  preocupacion: { ceja: 0.002, rz: 0.16, ojo: 1, sonrisa: -0.25, cabeza: 0.04 },
};
// apertura de la boca: sigue las palabras que marca la voz; sin marcas, un movimiento natural de habla
function aperturaBoca(h) {
  if (h.llorando) return 1.1 + Math.sin(h._t * 6) * 0.3;
  if (h.hablando) {
    const dtp = (performance.now() - (h.pulso || 0)) / 1000;
    if (h.conPulsos) {
      if (dtp > 0.55) return 0.06;
      const k = Math.min(1, dtp / (h.pulsoDur || 0.3));
      return 0.15 + Math.sin(PI * k) * 0.78 * (0.7 + 0.3 * Math.abs(Math.sin(h._t * 17)));
    }
    return 0.25 + Math.abs(Math.sin(h._t * 13) * Math.sin(h._t * 5.3)) * 0.9;
  }
  return h.dolor ? 0.5 : 0;
}
function aplicarExpresion(h, p, dt) {
  const obj = EXPRESIONES[h.emocion || (h.dolor ? 'dolor' : 'neutra')] || EXPRESIONES.neutra;
  const e = h._exp || (h._exp = { ...EXPRESIONES.neutra });
  const k = Math.min(1, dt * 4);
  for (const c in e) e[c] += (obj[c] - e[c]) * k;
  if (p.cejas) for (const c of p.cejas) { c.m.position.y = c.y + e.ceja; c.m.rotation.z = c.rz + c.sg * e.rz; }
  if (p.labioI) { p.labioI.scale.y = 1 + Math.max(0, e.sonrisa) * 0.25; p.boca.scale.x = 1.2 * (1 + e.sonrisa * 0.12); }
  if (p.labioS) p.labioS.position.y = -0.037 + Math.max(0, e.sonrisa) * 0.0015;
  return e;
}

function ropaParte(id) { return ROPAS[id] || ROPAS.paciente; }
// ropa para explorar sin camiseta según la edad
export const ropaSin = (ap) => ap.ropa === 'bebe' ? 'bebe_sin' : ap.ropa === 'nino' ? 'nino_sin' : 'paciente_sin';
// proporciones del cuerpo según la edad (respecto al modelo adulto)
const interp = (t, x) => { if (x <= t[0][0]) return t[0][1]; for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const [a, va] = t[i - 1], [b, vb] = t[i]; return va + (vb - va) * (x - a) / (b - a); } return t[t.length - 1][1]; };
export function proporciones(edad = 35, mujer = false) {
  const adulto = mujer ? 1.64 : 1.77;
  const alto = interp([[0.1, 0.55], [0.5, 0.68], [1, 0.76], [2, 0.88], [4, 1.03], [6, 1.16], [8, 1.28], [10, 1.39], [12, 1.5], [14, mujer ? 1.58 : 1.62], [16, mujer ? 1.62 : 1.72], [18, adulto]], edad);
  let s = alto / adulto;
  if (edad > 70) s *= 0.97;
  const cabeza = interp([[0.1, 0.62], [1, 0.76], [2, 0.82], [4, 0.87], [6, 0.9], [10, 0.94], [14, 0.98], [18, 1]], edad);
  return {
    s, cabeza: cabeza / Math.min(1, alto / adulto),
    piernas: interp([[0.1, 0.7], [1, 0.76], [2, 0.82], [4, 0.88], [8, 0.95], [12, 1]], edad),
    brazos: interp([[0.1, 0.78], [1, 0.82], [2, 0.86], [4, 0.9], [8, 0.96], [12, 1]], edad),
    ancho: interp([[0.1, 1.28], [1, 1.22], [2, 1.12], [4, 1.04], [7, 0.98], [12, 0.95], [18, 1]], edad),
    cuello: interp([[0.1, 0.55], [1, 0.65], [3, 0.8], [8, 0.92], [14, 1]], edad),
  };
}

function crearMano(padre, mat, sg) {
  const palma = pon(caja(0.075, 0.085, 0.028, mat, 0.012), padre, 0, -0.05, 0);
  for (let i = 0; i < 4; i++) pon(cap(0.0085, 0.05 - Math.abs(i - 1.5) * 0.006, mat), padre, (i - 1.5) * 0.018, -0.115 + Math.abs(i - 1.5) * 0.004, 0.002);
  pon(cap(0.01, 0.038, mat), padre, sg * 0.04, -0.06, 0.014, 0.4, 0, sg * 0.6);
  return palma;
}

function ponerPelo(cabeza, ap, pelo, piel, R0, cara) {
  R0 *= ap._escPelo || 1;
  const est = ap.estilo ?? 1;
  if (est === 0) { // calvo con coronilla lateral en mayores
    if (ap.edad > 50) { const f = pon(new T.Mesh(new T.CylinderGeometry(R0 * 1.0, R0 * 0.98, 0.05, 32, 1, true, PI * 0.35, PI * 1.3), pelo), cabeza, 0, -0.005, -0.005); f.material = pelo.clone(); f.material.side = T.DoubleSide; f.scale.x = 0.92 * cara; }
    return;
  }
  const casquete = (theta, esc = 1.06, rotX = -0.72) => { const m = pon(new T.Mesh(new T.SphereGeometry(R0 * esc, 36, 20, 0, PI * 2, 0, theta), est === 2 ? (() => { const mm = pelo.clone(); mm.color.lerp(piel.color, 0.35); return mm; })() : pelo), cabeza, 0, 0.004, -0.006); m.rotation.x = rotX; m.scale.set(0.92 * cara, 1.05, 1.03); m.castShadow = true; return m; };
  if (est === 1) casquete(1.75);
  if (est === 2) casquete(1.7, 1.02, -0.66);
  if (est === 3) { casquete(1.78); const fl = pon(esf(R0 * 0.62, pelo, 20, 12), cabeza, 0.02, 0.06, 0.06); fl.scale.set(1.25 * cara, 0.45, 0.6); fl.rotation.z = -0.25; }
  if (est >= 4) {
    casquete(1.82, 1.08, -0.74);
    const largo = est === 4 ? 0.16 : est === 5 ? 0.33 : 0;
    if (largo) {
      const atras = pon(esf(0.11, pelo, 28, 18), cabeza, 0, -largo * 0.42, -0.045); atras.scale.set(0.98 * cara, 1 + largo * 4.2, 0.62);
      for (const sg of [-1, 1]) { const lado = pon(esf(0.05, pelo, 16, 12), cabeza, sg * 0.086 * cara, -largo * 0.3, -0.01); lado.scale.set(0.55, 1 + largo * 5.5, 1.1); }
    }
    if (est === 6) pon(esf(0.045, pelo), cabeza, 0, 0.07, -0.1);
    if (est === 7) { pon(esf(0.022, pelo), cabeza, 0, 0.0, -0.11); pon(cap(0.024, 0.16, pelo), cabeza, 0, -0.11, -0.118, 0.15, 0, 0); }
  }
}

function poseHumano(h, nombre) {
  const p = h.partes; h.pose = nombre;
  const reset = ['cadD', 'cadI', 'rodD', 'rodI', 'homD', 'homI', 'codoD', 'codoI', 'munD', 'munI'];
  reset.forEach(k => p[k].rotation.set(0, 0, 0));
  p.columna.rotation.set(0, 0, 0); p.cabeza.rotation.set(0, 0, 0);
  h.raiz.rotation.set(0, 0, 0);
  p.pelvis.position.y = 0.93;
  if (p.falda) p.falda.visible = true;
  p.sombra.visible = true;
  if (nombre === 'depie' || nombre === 'espalda') {
    p.homD.rotation.z = -0.1; p.homI.rotation.z = 0.1; p.codoD.rotation.x = -0.15; p.codoI.rotation.x = -0.15;
    if (nombre === 'espalda') h.raiz.rotation.y = PI;
  } else if (nombre === 'sentado') {
    p.pelvis.position.y = 0.5;
    p.cadD.rotation.x = p.cadI.rotation.x = -PI / 2 + 0.05; p.rodD.rotation.x = p.rodI.rotation.x = PI / 2 - 0.05;
    p.cadD.rotation.z = -0.06; p.cadI.rotation.z = 0.06;
    p.homD.rotation.x = p.homI.rotation.x = -0.35; p.codoD.rotation.x = p.codoI.rotation.x = -0.95;
    p.homD.rotation.z = -0.12; p.homI.rotation.z = 0.12;
    p.munD.rotation.x = p.munI.rotation.x = 0.4;
    p.columna.rotation.x = 0.06;
    if (p.falda) p.falda.visible = false;
  } else if (nombre === 'tumbado') {
    h.raiz.rotation.x = -PI / 2;
    p.homD.rotation.z = -0.12; p.homI.rotation.z = 0.12;
    p.sombra.visible = false;
    if (p.falda) p.falda.visible = false;
  } else if (nombre === 'brazos_cruzados') {
    p.homD.rotation.set(-0.5, 0, -0.25); p.homI.rotation.set(-0.5, 0, 0.25); p.codoD.rotation.set(-1.9, 0, 0); p.codoI.rotation.set(-1.75, 0, 0);
    p.codoD.rotation.y = -0.6; p.codoI.rotation.y = 0.6;
  } else if (nombre === 'manos_juntas') {
    p.homD.rotation.set(-0.35, 0, -0.1); p.homI.rotation.set(-0.35, 0, 0.1); p.codoD.rotation.set(-1.0, -0.5, 0); p.codoI.rotation.set(-1.0, 0.5, 0);
  }
  h.basePose = { colX: p.columna.rotation.x };
}

const _v = new T.Vector3(), _q = new T.Quaternion();
function animarHumano(h, dt, t) {
  const p = h.partes; h._t += dt;
  // respiración
  const resp = Math.sin(h._t * (h.agitado ? 3.2 : 1.6));
  p.torso.scale.y = 1 + resp * 0.012 * (h.agitado ? 2 : 1);
  if (h.pose !== 'tumbado') p.columna.rotation.x = h.basePose.colX + resp * 0.008;
  // parpadeo
  h._parpadeo -= dt;
  const cerrado = h.dormido || (h._parpadeo < 0.12 && h._parpadeo > 0);
  if (h._parpadeo < 0) h._parpadeo = 2.5 + Math.random() * 3.5;
  aplicarExpresion(h, p, dt);
  for (const o of p.ojos) { o.p.scale.y = cerrado ? 1.0 : 0.42; o.p.position.y = cerrado ? 0.0 : 0.011; }
  // boca
  const ab = aperturaBoca(h);
  p.boca.scale.y = 0.18 + ab * 0.55; p.labioI.position.y = -0.049 - ab * 0.008;
  if (h.llorando) for (const o of p.ojos) { o.p.scale.y = 0.9; o.p.position.y = 0.003; }
  // cabeza: mirar objetivo + balanceo
  let yaw = Math.sin(h._t * 0.35) * 0.06, pitch = Math.sin(h._t * 0.5) * 0.03;
  if (h.hablando) { yaw += Math.sin(h._t * 1.7) * 0.05; pitch += Math.sin(h._t * 2.3) * 0.04; }
  if (h.mirar && h.pose !== 'tumbado' && h.pose !== 'espalda') {
    p.cabeza.parent.getWorldPosition(_v);
    const dx = h.mirar.x - _v.x, dz = h.mirar.z - _v.z, dy = h.mirar.y - _v.y;
    h.raiz.getWorldQuaternion(_q);
    const giroRaiz = new T.Euler().setFromQuaternion(_q, 'YXZ').y;
    let y = Math.atan2(dx, dz) - giroRaiz; while (y > PI) y -= 2 * PI; while (y < -PI) y += 2 * PI;
    yaw += Math.max(-0.7, Math.min(0.7, y));
    pitch += Math.max(-0.4, Math.min(0.4, -Math.atan2(dy, Math.hypot(dx, dz))));
  }
  if (h.dolor) pitch += 0.1;
  p.cabeza.rotation.y += (yaw - p.cabeza.rotation.y) * Math.min(1, dt * 4);
  p.cabeza.rotation.x += (pitch - p.cabeza.rotation.x) * Math.min(1, dt * 4);
  // gesto con las manos al hablar (sentado)
  if (h.pose === 'sentado' && h.hablando) { p.codoD.rotation.x = -0.95 - Math.max(0, Math.sin(h._t * 2.1)) * 0.35; }
  else if (h.pose === 'sentado') p.codoD.rotation.x += (-0.95 - p.codoD.rotation.x) * Math.min(1, dt * 3);
}


// ───────────────────────── personajes modelados en Blender ─────────────────────────
// modelos/personajes.glb: cuerpo de una pieza con esqueleto (H = hombre, M = mujer).
// Three.js quita los puntos de los nombres: «brazo.L» llega como «brazoL».
// La ropa se pinta en el sombreador según la posición de reposo de cada vértice.
const PLANTILLAS = {};
export async function cargarModelos(url = 'modelos/personajes.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  for (const k of ['H', 'M']) {
    const esq = gltf.scene.getObjectByName(`${k}_Esqueleto`);
    if (!esq) continue;
    esq.parent.remove(esq);
    esq.position.set(0, 0, 0);
    PLANTILLAS[k] = esq;
  }
  // peinados modelados en Blender sobre la misma forma de cráneo (opcional)
  try {
    const p = await new GLTFLoader().loadAsync('modelos/pelo.glb');
    for (let i = 0; i < 8; i++) {
      const o = p.scene.getObjectByName(`Pelo_${i}`);
      if (!o) continue;
      o.parent.remove(o); o.position.set(0, 0, 0);
      PELOS[i] = o;
    }
  } catch (e) { console.warn('Sin peinados de Blender:', e); }
  return Object.keys(PLANTILLAS).length === 2;
}
const PELOS = {};
// pelo de Blender pegado al hueso de la cabeza, sin escalar: así sigue la forma real del cráneo
function ponerPeloGLB(padre, ap, pelo, piel, esc) {
  const est = ap.estilo ?? 1;
  if (!PELOS[est] || (est === 0 && !(ap.edad > 50))) return null;
  const m = est === 2 ? (() => { const mm = pelo.clone(); mm.color.lerp(piel.color, 0.35); return mm; })() : pelo;
  const o = PELOS[est].clone(true);
  o.traverse(x => { if (x.isMesh) { x.material = m; x.castShadow = true; x.receiveShadow = true; } });
  o.scale.setScalar(esc);
  padre.add(o);
  return o;
}
export const modelosListos = () => !!(PLANTILLAS.H && PLANTILLAS.M);

export function crearHumano(ap, ropaId = 'paciente') {
  return modelosListos() ? crearHumanoGLB(ap, ropaId) : crearHumanoProc(ap, ropaId);
}

const colorV = (c) => new T.Color(c === 'piel' || c === 'bata' || !c ? '#ffffff' : c);
function materialCuerpo(colPiel, r, mujer, offX = 0, edad = 35) {
  const esc = mujer ? 0.95 : 1;
  const u = {
    uSujetador: { value: mujer && r.torso === 'piel' && (edad ?? 35) >= 11 ? 1 : 0 },
    uSujAbajo: { value: 1.215 }, uSujArriba: { value: 1.345 },
    uOffX: { value: offX }, uCintura: { value: r.torso === 'piel' ? 0.99 : 0.84 },
    uPiel: { value: colPiel.clone() },
    uTorso: { value: colorV(r.torso) }, uTorsoPiel: { value: r.torso === 'piel' ? 1 : 0 }, uTorsoBata: { value: r.torso === 'bata' ? 1 : 0 },
    uManga: { value: colorV(r.mangaColor) }, uMangaLarga: { value: r.manga === 'larga' ? 1 : 0 }, uMangaCorta: { value: r.manga === 'corta' || r.manga === 'larga' ? 1 : 0 },
    uPant: { value: colorV(r.pantalon) }, uPantPiel: { value: r.pantalon === 'piel' ? 1 : 0 }, uPantFin: { value: r.pantFin ?? (r.torso === 'bata' ? 0.48 : 0.1) }, uZapatoPiel: { value: r.zapato === 'piel' ? 1 : 0 },
    uZapato: { value: new T.Color(r.zapato && r.zapato !== 'piel' ? r.zapato : (r.bata || r.calle ? '#23262b' : '#e9e9e9')) },
    uCamisa: { value: colorV(r.camisa) }, uConCamisa: { value: r.camisa ? 1 : 0 },
    uCorbata: { value: colorV(r.corbata) }, uConCorbata: { value: r.corbata ? 1 : 0 },
    uEsc: { value: esc },
  };
  const m = new T.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.6, sheen: 0.45, sheenRoughness: 0.6, sheenColor: new T.Color('#ff9a7a').multiplyScalar(0.2), envMapIntensity: 0.35 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRep;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvRep = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vRep;
uniform vec3 uPiel, uTorso, uManga, uPant, uZapato, uCamisa, uCorbata;
uniform float uTorsoPiel, uTorsoBata, uMangaLarga, uMangaCorta, uPantPiel, uPantFin, uZapatoPiel, uConCamisa, uConCorbata, uEsc, uOffX, uCintura, uSujetador, uSujAbajo, uSujArriba;
float tela;
vec3 ropa() {
  vec3 p = (vRep - vec3(uOffX, 0.0, 0.0)) / uEsc;
  float ax = abs(p.x);
  float brazo = max(smoothstep(0.18, 0.19, ax), smoothstep(0.155, 0.165, ax) * (1.0 - smoothstep(1.36, 1.38, p.y)));
  // a la altura de la cadera sólo es brazo lo que queda por fuera de ella
  brazo *= mix(smoothstep(0.2, 0.21, ax), 1.0, smoothstep(1.1, 1.12, p.y));
  float torso = smoothstep(uCintura - 0.005, uCintura + 0.005, p.y) * (1.0 - brazo);
  // escote: la tela cubre los hombros y deja libre el cuello
  float limite = 1.445 + smoothstep(0.065, 0.1, ax) * 0.12 - max(0.0, p.z) * 0.12;
  torso *= 1.0 - smoothstep(limite - 0.004, limite + 0.004, p.y);
  float pierna = (1.0 - smoothstep(uCintura - 0.005, uCintura + 0.005, p.y)) * (1.0 - brazo);
  float pie = 1.0 - smoothstep(0.095, 0.105, p.y);
  float mangaC = brazo * smoothstep(1.195, 1.205, p.y) * uMangaCorta;
  float mangaL = brazo * smoothstep(0.93, 0.94, p.y) * uMangaLarga;
  float pantalon = pierna * (1.0 - pie) * (1.0 - uPantPiel) * smoothstep(uPantFin - 0.005, uPantFin + 0.005, p.y);
  pie *= 1.0 - uZapatoPiel;
  vec3 c = uPiel; tela = 0.0;
  vec3 ct = uTorso;
  if (uTorsoBata > 0.5) { vec2 q = fract(vec2(p.x + p.z, p.y) * 62.0) - 0.5; float d = abs(q.x) + abs(q.y); ct = mix(vec3(0.36, 0.5, 0.68), vec3(0.8, 0.86, 0.93), smoothstep(0.17, 0.22, d)); }
  if (uConCamisa > 0.5 && p.z > 0.0) {
    float v = smoothstep(0.0, 0.006, (1.47 - p.y) * 0.32 - ax) * smoothstep(1.17, 1.18, p.y);
    vec3 cc = uCamisa;
    if (uConCorbata > 0.5) cc = mix(cc, uCorbata, (1.0 - smoothstep(0.012, 0.016, ax + max(0.0, 1.42 - p.y) * 0.03)) * smoothstep(1.2, 1.21, p.y));
    ct = mix(ct, cc, v);
  }
  c = mix(c, ct, torso * (1.0 - uTorsoPiel));
  // sujetador para las pacientes sin bata
  float suj = uSujetador * (1.0 - brazo) * max(smoothstep(uSujAbajo, uSujAbajo + 0.01, p.y) * (1.0 - smoothstep(uSujArriba - 0.01, uSujArriba, p.y)),
    smoothstep(1.3, 1.31, p.y) * (1.0 - smoothstep(1.48, 1.49, p.y)) * smoothstep(0.062, 0.066, ax) * (1.0 - smoothstep(0.08, 0.084, ax)));
  c = mix(c, vec3(0.93, 0.93, 0.95), suj);
  c = mix(c, uManga, max(mangaC, mangaL));
  c = mix(c, uPant, pantalon);
  c = mix(c, uZapato, pie);
  tela = max(max(max(torso * (1.0 - uTorsoPiel), suj), max(mangaC, mangaL)), max(pantalon, pie));
  return c;
}`).replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= ropa();')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.88, tela);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_SHEEN\nmaterial.sheenColor *= (1.0 - tela);\n#endif');
  };
  m.customProgramCacheKey = () => 'cuerpo-ropa';
  return m;
}

// Talla del pecho: se rehace la parte delantera del torso femenino con una forma de pecho
// (polo superior suave, inferior lleno con su pliegue, caída según el tamaño y canalillo)
export const FORMA_PECHO = { nina: [0.003, 0.05], pequeno: [0.022, 0.056], normal: [0.036, 0.063], grande: [0.053, 0.072], muy_grande: [0.072, 0.082] };
const cachePecho = new Map();
const _ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function centroPecho(talla) {
  const [A, R] = FORMA_PECHO[talla] || FORMA_PECHO.normal;
  return { A, R, cx: 0.056 + R * 0.18, cy: 1.24 - A * 0.4 };
}
function alturaPecho(x, y, talla) {
  const { A, R, cx, cy } = centroPecho(talla);
  let h = 0;
  for (const c of [-cx, cx]) {
    const u = (x - c) / R;
    const v0 = (y - cy) / R;
    // arriba baja suave, abajo es más redondo (transición continua, sin picos)
    const v = v0 * (0.62 + 0.6 * (1 - _ss(-0.35, 0.35, v0)));
    const t = 1 - u * u - v * v;
    if (t <= 0) continue;
    const e = 0.55 + 0.75 * _ss(-0.3, 0.7, v0);
    h = Math.max(h, A * Math.pow(t, e));
  }
  return h;
}
function formarPecho(geo, offX, talla) {
  if (!FORMA_PECHO[talla]) return geo;
  const clave = geo.uuid + talla;
  if (cachePecho.has(clave)) return cachePecho.get(clave);
  const g = geo.clone(), pos = g.attributes.position;
  // pared del pecho: sección elíptica del torso modelado en Blender
  const pared = (x) => 0.1035 * Math.sqrt(Math.max(0, 1 - (x / 0.143) ** 2)) - 0.004;
  const { R, cy } = centroPecho(talla);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) - offX, y = pos.getY(i), z = pos.getZ(i);
    if (Math.abs(x) > 0.138 || y < cy - R * 1.25 || y > cy + R * 1.9 || z < 0.03) continue;
    const zw = pared(x);
    if (z < zw - 0.03) continue;
    // fundido suave en el borde de la zona
    const borde = (1 - _ss(0.118, 0.138, Math.abs(x))) * _ss(cy - R * 1.25, cy - R * 1.05, y) * (1 - _ss(cy + R * 1.6, cy + R * 1.9, y));
    const zn = zw + alturaPecho(x, y, talla);
    pos.setZ(i, z + (zn - z) * borde);
  }
  pos.needsUpdate = true; g.computeVertexNormals();
  cachePecho.set(clave, g);
  return g;
}

function crearHumanoGLB(ap, ropaId) {
  const mujer = ap.sexo === 'm', k = mujer ? 'M' : 'H', esc = mujer ? 0.95 : 1;
  const r = { ...ropaParte(ropaId) };
  if (ap.colorRopa && (ropaId === 'nino' || ropaId === 'bebe' || ropaId === 'nino_sin')) {
    const cr = ap.colorRopa;
    if (cr.torso && r.torso !== 'piel') { r.torso = cr.torso; r.mangaColor = cr.torso; if (ropaId === 'bebe') { r.pantalon = cr.torso; r.zapato = cr.torso; } }
    if (cr.pantalon && ropaId !== 'bebe') r.pantalon = cr.pantalon;
  }
  const prop = proporciones(ap.edad ?? 35, mujer);
  const raiz = new T.Group();
  const esq = SkeletonUtils.clone(PLANTILLAS[k]);
  raiz.add(esq);
  const c = ap.complexion || 1, cara = ap.cara || 1;
  esq.scale.set(c * prop.ancho, 1, Math.sqrt(c) * prop.ancho);
  let colPiel = new T.Color(ap.piel || '#e0b090');
  if (ap.palido) colPiel.lerp(new T.Color('#e8e3dc'), 0.35);
  if (ap.edad > 70) colPiel.lerp(new T.Color('#c9b3a3'), 0.12);
  if (ap.edad < 2) colPiel.lerp(new T.Color('#ffd6c9'), 0.15);
  const piel = new T.MeshPhysicalMaterial({ color: colPiel, envMapIntensity: 0.35, roughness: 0.58, sheen: 0.5, sheenRoughness: 0.6, sheenColor: new T.Color('#ff9a7a').multiplyScalar(0.25) });
  const pelo = std(ap.pelo || '#3a2617', { roughness: 0.85 });
  const tela = (col) => col === 'bata' ? std('#ffffff', { map: texturas().bata, roughness: 0.9 }) : col === 'piel' ? piel : std(col, { roughness: 0.85 });
  const cuerpo = esq.getObjectByName(`${k}_Cuerpo`);
  // en Blender cada modelo estaba a un lado: la posición de reposo trae ese desplazamiento
  cuerpo.geometry.computeBoundingBox();
  const offX = (cuerpo.geometry.boundingBox.min.x + cuerpo.geometry.boundingBox.max.x) / 2;
  const talla = mujer ? (ap.pecho || (ap.edad < 10 ? 'nina' : ap.edad < 14 ? 'pequeno' : 'normal')) : null;
  if (mujer) cuerpo.geometry = formarPecho(cuerpo.geometry, offX, talla);
  cuerpo.material = materialCuerpo(colPiel, r, mujer, offX, ap.edad);
  if (mujer) { const cp = centroPecho(talla); const u = cuerpo.material.userData; cuerpo.material.onBeforeCompile = ((f) => (sh) => { f(sh); sh.uniforms.uSujAbajo.value = (cp.cy - cp.R * 0.95) / 0.95; sh.uniforms.uSujArriba.value = (cp.cy + cp.R * 0.75) / 0.95; })(cuerpo.material.onBeforeCompile); }
  cuerpo.frustumCulled = false;
  const faldon = esq.getObjectByName(`${k}_Faldon`);
  if (r.falda) {
    faldon.material = tela(r.faldaColor).clone(); faldon.material.side = T.DoubleSide;
    // largo de la bata o del faldón: se recorta desde la cintura
    const g = faldon.geometry.clone(), pos = g.attributes.position, top = 1.03 * esc, k2 = r.falda / (0.6 * esc);
    for (let i = 0; i < pos.count; i++) pos.setY(i, top - (top - pos.getY(i)) * k2);
    pos.needsUpdate = true; g.computeVertexNormals(); faldon.geometry = g;
    faldon.frustumCulled = false;
  } else faldon.visible = false;
  esq.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const B = (n) => esq.getObjectByName(n);
  const huesos = {};
  // los huesos repetidos entre los dos modelos llegan como «pelvis_1»
  esq.traverse(o => { if (o.isBone) huesos[o.name.replace(/_\d+$/, '')] = o; });
  const reposo = {}; for (const n in huesos) reposo[n] = huesos[n].quaternion.clone();
  // cabeza procedimental (ojos, boca, pelo...) pegada al hueso de la cabeza
  const hc = huesos.cabeza;
  esq.updateMatrixWorld(true);
  const cabeza = new T.Group();
  hc.add(cabeza);
  const centro = new T.Vector3(0, 1.705 * esc, 0.008 * esc);
  const inv = new T.Matrix4().copy(hc.matrixWorld).invert();
  const rootM = esq.matrixWorld.clone();
  cabeza.position.copy(centro.clone().applyMatrix4(rootM).applyMatrix4(inv));
  const qh = new T.Quaternion(); hc.getWorldQuaternion(qh);
  const qr = new T.Quaternion(); esq.getWorldQuaternion(qr);
  cabeza.quaternion.copy(qh.invert().multiply(qr));
  cabeza.scale.set(0.92 / c, 1.07, 1.0 / Math.sqrt(c));
  const cabezaFino = new T.Group(); cabeza.add(cabezaFino); cabezaFino.position.set(0, -0.004, -0.012);
  const peloGLB = !r.gorro && PELOS[1];
  const rc = rasgosCara(cabezaFino, { ...ap, _escPelo: 1.07, _sinPelo: peloGLB }, { piel, pelo, tela, r, colPiel, cara, craneo: false });
  if (peloGLB) {
    const craneo = new T.Group(); hc.add(craneo);
    craneo.position.copy(cabeza.position); craneo.quaternion.copy(cabeza.quaternion);
    ponerPeloGLB(craneo, ap, pelo, piel, esc);
  }
  // accesorios del médico pegados al pecho
  const pecho = new T.Group(); huesos.pecho.add(pecho);
  const qp = new T.Quaternion(); huesos.pecho.getWorldQuaternion(qp);
  pecho.quaternion.copy(qp.clone().invert().multiply(qr));
  pecho.position.copy(new T.Vector3(0, 0, 0).applyMatrix4(rootM).applyMatrix4(new T.Matrix4().copy(huesos.pecho.matrixWorld).invert()));
  if (r.bata) {
    const fz = 0.112 * esc;
    [['#1d4fbf', -0.025], ['#c62828', 0], ['#222', 0.02]].forEach(([col, dx]) => pon(cil(0.005, 0.005, 0.08, std(col)), pecho, 0.085 + dx, 1.3 * esc, fz + (mujer ? 0.02 : 0)));
    pon(caja(0.06, 0.04, 0.004, std('#ffffff', { emissive: '#222' })), pecho, -0.085, 1.31 * esc, fz + (mujer ? 0.022 : 0.002));
    const est = tubo([[-0.06, 1.5, 0.0], [-0.09, 1.43, 0.08], [-0.05, 1.3, fz + 0.012], [0, 1.26, fz + 0.02], [0.05, 1.3, fz + 0.012], [0.09, 1.43, 0.08], [0.06, 1.5, 0]].map(([x, y, z]) => [x, y * esc, z]), 0.006, std('#1d1f23', { roughness: 0.4 }));
    pecho.add(est);
    pon(cil(0.018, 0.018, 0.012, std('#cfd3d6', { metalness: 1, roughness: 0.2 })), pecho, 0, 1.25 * esc, fz + 0.025, PI / 2, 0, 0);
  }
  // puntos de auscultación
  const puntos = { espalda: [], pecho: [] };
  [[-0.06, 1.38], [0.06, 1.38], [-0.075, 1.27], [0.075, 1.27], [-0.07, 1.16], [0.07, 1.16]].forEach(([x, y]) => puntos.espalda.push(pon(new T.Object3D(), pecho, x, y * esc, -0.1 * esc)));
  [[0.035, 1.37, 0.098], [-0.035, 1.37, 0.098], [-0.02, 1.24, 0.11], [0.065, 1.21, mujer ? 0.13 : 0.11]].forEach(([x, y, z]) => puntos.pecho.push(pon(new T.Object3D(), pecho, x, y * esc, z * esc)));
  // tamaño según la edad: cabeza más grande, piernas y brazos más cortos en los pequeños
  huesos.cuello.scale.setScalar(prop.cuello);
  huesos.cabeza.scale.setScalar(prop.cabeza / prop.cuello);
  for (const L of ['L', 'R']) { huesos[`muslo${L}`].scale.setScalar(prop.piernas); huesos[`brazo${L}`].scale.setScalar(prop.brazos); }
  const S = (ap.altura || 1) * prop.s;
  raiz.scale.setScalar(S);
  const sb = sombraSuelo(0.9, 0.7, 0.35); raiz.add(sb);
  const partes = { ...rc, cabeza, torso: cuerpo, sombra: sb, puntos, falda: r.falda ? faldon : null, columna: huesos.columna };
  const h = { glb: true, raiz, esq, huesos, reposo, partes, ap, ropaId, esc, S, dy: -(1 - prop.piernas) * 0.88 * esc, mayor: (ap.edad || 0) >= 72, hablando: false, mirar: null, _parpadeo: 2 + Math.random() * 3, _t: Math.random() * 10, pose: 'depie' };
  h.ponerPose = (n) => poseGLB(h, n);
  h.actualizar = (dt, t) => animarGLB(h, dt, t);
  h.girar = (n, eje, ang) => girarHueso(h, n, eje, ang);
  poseGLB(h, 'depie');
  return h;
}

const EJES = { x: new T.Vector3(1, 0, 0), y: new T.Vector3(0, 1, 0), z: new T.Vector3(0, 0, 1) };
const _q1 = new T.Quaternion(), _q2 = new T.Quaternion(), _q3 = new T.Quaternion();
// gira un hueso alrededor de un eje expresado en el marco del personaje (x izquierda, y arriba, z delante)
function girarHueso(h, nombre, eje, ang) {
  const b = h.huesos[nombre]; if (!b) return;
  h.esq.updateMatrixWorld(true);
  b.parent.getWorldQuaternion(_q1);
  h.esq.getWorldQuaternion(_q2);
  const qp = _q2.invert().multiply(_q1); // padre en el marco del personaje
  _q3.setFromAxisAngle(EJES[eje], ang);
  const delta = qp.clone().invert().multiply(_q3).multiply(qp);
  b.quaternion.premultiply(delta);
}
function poseGLB(h, nombre) {
  h.pose = nombre;
  for (const n in h.huesos) h.huesos[n].quaternion.copy(h.reposo[n]);
  h.raiz.rotation.set(0, 0, 0);
  h.esq.position.set(0, h.dy || 0, 0);
  const p = h.partes;
  if (p.falda) p.falda.visible = true;
  p.sombra.visible = true;
  const G = (n, e, a) => girarHueso(h, n, e, a);
  for (const L of ['L', 'R']) { const sg = L === 'L' ? 1 : -1; G(`brazo${L}`, 'z', -sg * 0.1); G(`antebrazo${L}`, 'x', -0.12); }
  if (nombre === 'espalda') h.raiz.rotation.y = PI;
  else if (nombre === 'sentado') {
    h.esq.position.y = 0.49 / h.S - 0.9 * h.esc;
    for (const L of ['L', 'R']) {
      const sg = L === 'L' ? 1 : -1;
      G(`muslo${L}`, 'x', -PI / 2 + 0.06); G(`muslo${L}`, 'y', sg * 0.06);
      G(`pierna${L}`, 'x', PI / 2 - 0.08);
      G(`brazo${L}`, 'x', -0.42); G(`brazo${L}`, 'z', sg * 0.06);
      G(`antebrazo${L}`, 'x', -0.85);
    }
    G('columna', 'x', 0.05);
    if (p.falda) p.falda.visible = false;
  } else if (nombre === 'tumbado') {
    h.raiz.rotation.x = -PI / 2;
    p.sombra.visible = false;
    if (p.falda) p.falda.visible = false;
  } else if (nombre === 'boca_abajo') {
    h.raiz.rotation.x = PI / 2;
    for (const L of ['L', 'R']) G(`brazo${L}`, 'x', -0.3);
    p.sombra.visible = false;
    if (p.falda) p.falda.visible = false;
  } else if (nombre === 'recostado') {
    // bebé en el portabebés
    h.raiz.rotation.x = -1.1;
    for (const L of ['L', 'R']) { const sg = L === 'L' ? 1 : -1; G(`muslo${L}`, 'x', -1.0); G(`muslo${L}`, 'y', sg * 0.25); G(`pierna${L}`, 'x', 0.9); G(`brazo${L}`, 'x', -0.35); G(`brazo${L}`, 'z', sg * 0.12); G(`antebrazo${L}`, 'x', -0.7); G(`antebrazo${L}`, 'y', -sg * 0.4); }
    p.sombra.visible = false;
  } else if (nombre === 'manos_juntas') {
    for (const L of ['L', 'R']) { const sg = L === 'L' ? 1 : -1; G(`brazo${L}`, 'x', -0.35); G(`antebrazo${L}`, 'x', -1.05); G(`antebrazo${L}`, 'y', -sg * 0.5); }
  } else if (nombre === 'brazos_cruzados') {
    for (const L of ['L', 'R']) { const sg = L === 'L' ? 1 : -1; G(`brazo${L}`, 'x', -0.45); G(`brazo${L}`, 'z', sg * 0.15); G(`antebrazo${L}`, 'x', -1.45); G(`antebrazo${L}`, 'y', -sg * 1.0); }
  }
  // las personas mayores, algo encorvadas
  if (h.mayor && (nombre === 'depie' || nombre === 'espalda' || nombre === 'sentado' || nombre === 'manos_juntas' || nombre === 'brazos_cruzados')) { G('pecho', 'x', 0.16); G('cuello', 'x', 0.1); }
  h.base = {}; for (const n of ['cabeza', 'cuello', 'pecho', 'columna', 'antebrazoR', 'antebrazoL', 'brazoR']) h.base[n] = h.huesos[n].quaternion.clone();
}
// inclina el tronco desde la pose actual (para el paciente encamado)
export function inclinarTronco(h, ang) {
  if (h.glb) { girarHueso(h, 'columna', 'x', ang); h.base.columna = h.huesos.columna.quaternion.clone(); }
  else { h.partes.columna.rotation.x = ang; h.basePose.colX = ang; }
}
function animarGLB(h, dt, t) {
  const p = h.partes; h._t += dt;
  const resp = Math.sin(h._t * (h.agitado ? 3.2 : 1.6));
  h.huesos.pecho.quaternion.copy(h.base.pecho);
  girarHueso(h, 'pecho', 'x', resp * 0.012 * (h.agitado ? 2 : 1));
  // parpadeo
  h._parpadeo -= dt;
  const cerrado = h.dormido || (h._parpadeo < 0.12 && h._parpadeo > 0);
  if (h._parpadeo < 0) h._parpadeo = 2.5 + Math.random() * 3.5;
  const ex = aplicarExpresion(h, p, dt);
  // el párpado tapa más o menos el ojo según la expresión (miedo: muy abierto; dolor: entornado)
  const abierto = Math.max(0.2, Math.min(0.75, 0.42 / ex.ojo));
  for (const o of p.ojos) { o.p.scale.y = cerrado ? 1.0 : abierto; o.p.position.y = cerrado ? 0.0 : 0.011; }
  const ab = aperturaBoca(h);
  p.boca.scale.y = 0.18 + ab * 0.55; p.labioI.position.y = -0.049 - ab * 0.008 + Math.max(0, ex.sonrisa) * 0.002;
  // cabeza
  let yaw = Math.sin(h._t * 0.35) * 0.06, pitch = Math.sin(h._t * 0.5) * 0.03 - ex.cabeza;
  if (h.hablando) { yaw += Math.sin(h._t * 1.7) * 0.05; pitch += Math.sin(h._t * 2.3) * 0.04; }
  if (h.mirar && h.pose !== 'tumbado' && h.pose !== 'espalda') {
    h.huesos.cabeza.getWorldPosition(_v);
    const dx = h.mirar.x - _v.x, dz = h.mirar.z - _v.z, dy = h.mirar.y - _v.y - 0.1;
    h.raiz.getWorldQuaternion(_q);
    const giroRaiz = new T.Euler().setFromQuaternion(_q, 'YXZ').y;
    let y = Math.atan2(dx, dz) - giroRaiz; while (y > PI) y -= 2 * PI; while (y < -PI) y += 2 * PI;
    yaw += Math.max(-0.7, Math.min(0.7, y));
    pitch += Math.max(-0.4, Math.min(0.4, -Math.atan2(dy, Math.hypot(dx, dz))));
  }
  if (h.dolor) pitch += 0.1;
  h._yaw = (h._yaw || 0) + (yaw - (h._yaw || 0)) * Math.min(1, dt * 4);
  h._pitch = (h._pitch || 0) + (pitch - (h._pitch || 0)) * Math.min(1, dt * 4);
  h.huesos.cabeza.quaternion.copy(h.base.cabeza);
  girarHueso(h, 'cabeza', 'y', h._yaw); girarHueso(h, 'cabeza', 'x', -h._pitch);
  // gesto con la mano al hablar sentado
  h.huesos['antebrazoR'].quaternion.copy(h.base['antebrazoR']);
  h.huesos['brazoR'].quaternion.copy(h.base['brazoR']);
  if (h.pose === 'sentado') { h._gesto = (h._gesto || 0) + ((h.hablando && !h.alcance ? Math.max(0, Math.sin(h._t * 2.1)) * 0.35 : 0) - (h._gesto || 0)) * Math.min(1, dt * 5); girarHueso(h, 'antebrazoR', 'x', -h._gesto); }
  // extiende el brazo derecho para recoger algo (la receta)
  if (h.alcance) { const k = h.alcance; girarHueso(h, 'brazoR', 'x', -0.75 * k); girarHueso(h, 'brazoR', 'z', 0.12 * k); girarHueso(h, 'antebrazoR', 'x', 0.62 * k); }
}

// ───────────────────────── manos del médico en primera persona ─────────────────────────
function crearManosMedico(ap, ropaId) {
  const g = new T.Group();
  const r = ropaParte(ropaId);
  const piel = new T.MeshPhysicalMaterial({ color: ap.piel, roughness: 0.55, sheen: 0.4, sheenColor: new T.Color('#ff9a7a').multiplyScalar(0.2) });
  const manga = std(r.mangaColor === 'bata' ? '#fff' : r.mangaColor, { roughness: 0.85 });
  const brazos = [];
  for (const sg of [-1, 1]) {
    const b = pon(new T.Group(), g, sg * 0.19, -0.255, -0.5);
    b.rotation.set(1.38, 0, sg * 0.35);
    pon(cap(0.043, 0.3, r.manga === 'larga' ? manga : piel), b, 0, 0.17, 0);
    if (r.manga === 'larga') pon(cil(0.05, 0.05, 0.04, manga), b, 0, -0.04, 0);
    const mun = pon(new T.Group(), b, 0, -0.06, 0);
    crearMano(mun, piel, -sg);
    mun.rotation.set(-0.15, 0, sg * -0.1);
    brazos.push({ b, mun, sg, base: b.rotation.clone(), basePos: b.position.clone() });
  }
  g.userData.brazos = brazos;
  sombra(g, false, false);
  return g;
}

// ───────────────────────── paredes con huecos ─────────────────────────
function pared(padre, x1, z1, x2, z2, alto, mat, huecos = [], grosor = 0.1) {
  const g = new T.Group(); const L = Math.hypot(x2 - x1, z2 - z1);
  g.position.set(x1, 0, z1); g.rotation.y = -Math.atan2(z2 - z1, x2 - x1); padre.add(g);
  const tramo = (a, b, y0, y1) => { if (b - a < 0.001 || y1 - y0 < 0.001) return; const m = caja(b - a, y1 - y0, grosor, mat); m.position.set((a + b) / 2, (y0 + y1) / 2, 0); g.add(m); };
  let cur = 0; huecos.sort((p, q) => p.a - q.a);
  for (const hq of huecos) { tramo(cur, hq.a, 0, alto); tramo(hq.a, hq.b, 0, hq.y0); tramo(hq.a, hq.b, hq.y1, alto); cur = hq.b; }
  tramo(cur, L, 0, alto);
  return g;
}
function habitacion(escena, { x0, x1, z0, z1, alto, matPared, matSuelo, matTecho, banda = '#4a2f22', huecos = {} }) {
  const suelo = plano(x1 - x0, z1 - z0, matSuelo); suelo.rotation.x = -PI / 2; suelo.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2); escena.add(suelo);
  const techo = plano(x1 - x0, z1 - z0, matTecho); techo.rotation.x = PI / 2; techo.position.set((x0 + x1) / 2, alto, (z0 + z1) / 2); escena.add(techo);
  pared(escena, x0, z0, x1, z0, alto, matPared, huecos.fondo || []);
  pared(escena, x1, z1, x0, z1, alto, matPared, huecos.frente || []);
  pared(escena, x0, z1, x0, z0, alto, matPared, huecos.izq || []);
  pared(escena, x1, z0, x1, z1, alto, matPared, huecos.der || []);
  if (banda) {
    const mb = std(banda, { roughness: 0.5 });
    const tiras = [[x0, z0 + 0.06, x1, z0 + 0.06, huecos.fondo], [x0, z1 - 0.06, x1, z1 - 0.06, huecos.frente], [x0 + 0.06, z0, x0 + 0.06, z1, huecos.izq], [x1 - 0.06, z0, x1 - 0.06, z1, huecos.der]];
    for (const [a, b, c2, d, hq] of tiras) {
      const hs = (hq || []).filter(h => h.y0 < 1.0);
      const g = pared(escena, a, b, c2, d, 0, mb, [], 0.02);
      const L = Math.hypot(c2 - a, d - b); let cur = 0;
      const tramo = (p, q) => { if (q - p > 0.01) { const m = caja(q - p, 0.1, 0.025, mb); m.position.set((p + q) / 2, 0.95, 0); g.add(m); } };
      for (const h of hs.sort((p, q) => p.a - q.a)) { tramo(cur, h.a); cur = h.b; }
      tramo(cur, L);
    }
  }
  // zócalo
  return { suelo, techo };
}
function ventana(padre, ancho, alto, matMarco) {
  const g = new T.Group();
  const t = 0.05;
  pon(caja(ancho, t, 0.12, matMarco), g, 0, alto / 2, 0); pon(caja(ancho, t, 0.12, matMarco), g, 0, -alto / 2, 0);
  pon(caja(t, alto, 0.12, matMarco), g, -ancho / 2, 0, 0); pon(caja(t, alto, 0.12, matMarco), g, ancho / 2, 0, 0);
  const cr = new T.Mesh(new T.PlaneGeometry(ancho, alto), new T.MeshPhysicalMaterial({ color: '#cfe3ee', transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0, depthWrite: false }));
  g.add(cr);
  padre.add(g); return g;
}

// ───────────────────────── mobiliario ─────────────────────────
const M = {};
function materiales() {
  if (M.metal) return M;
  const tx = texturas();
  M.metal = std('#c9ced3', { metalness: 0.95, roughness: 0.22 });
  M.metalMate = std('#a7adb3', { metalness: 0.8, roughness: 0.45 });
  M.cromo = std('#e8ecef', { metalness: 1, roughness: 0.08 });
  M.blanco = std('#f3f4f4', { roughness: 0.35 });
  M.blancoMate = std('#e9eaea', { roughness: 0.7 });
  M.negro = std('#16181b', { roughness: 0.4 });
  M.grisOsc = std('#3a3f46', { roughness: 0.6 });
  M.tela = std('#3b4048', { roughness: 0.95 });
  M.marino = std('#1f2647', { roughness: 0.75 });
  M.verdeQ = std('#1e6f6c', { roughness: 0.9 });
  M.madera = std('#ffffff', { map: tx.madera, roughness: 0.55 });
  M.maderaOsc = std('#6e4a2c', { roughness: 0.6 });
  M.pared = std('#e3e5e4', { map: tx.pared, roughness: 0.92 });
  M.azulejo = std('#ffffff', { map: tx.azulejo, roughness: 0.4 });
  M.suelo = std('#ffffff', { map: tx.suelo, roughness: 0.5, metalness: 0.02 });
  M.sueloQ = std('#ffffff', { map: tx.sueloQ, roughness: 0.35 });
  M.techo = std('#ffffff', { map: tx.techo, roughness: 0.95 });
  M.cristal = new T.MeshPhysicalMaterial({ color: '#dfeef2', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.1, depthWrite: false });
  M.cristalOsc = new T.MeshPhysicalMaterial({ color: '#0d1114', roughness: 0.08, metalness: 0.4 });
  M.luz = new T.MeshBasicMaterial({ color: '#ffffff' });
  M.pantalla = std('#0a0d10', { roughness: 0.2, emissive: '#000' });
  return M;
}
function silla(padre, x, z, ry = 0) {
  const g = pon(new T.Group(), padre, x, 0, z, 0, ry, 0);
  pon(caja(0.5, 0.07, 0.47, M.tela, 0.03), g, 0, 0.45, 0);
  pon(caja(0.48, 0.45, 0.06, M.tela, 0.03), g, 0, 0.76, -0.23, -0.08, 0, 0);
  for (const sx of [-1, 1]) {
    pon(tubo([[sx * 0.24, 0, 0.22], [sx * 0.25, 0.42, 0.2], [sx * 0.27, 0.62, 0.15], [sx * 0.27, 0.62, -0.15], [sx * 0.25, 0.42, -0.2], [sx * 0.24, 0, -0.22]], 0.012, M.metalMate), g);
    pon(caja(0.05, 0.03, 0.32, M.negro, 0.01), g, sx * 0.27, 0.64, 0);
  }
  g.add(sombraSuelo(0.8, 0.8, 0.35));
  return g;
}
function archivador(padre, x, z) {
  const g = pon(new T.Group(), padre, x, 0, z);
  pon(caja(0.46, 1.32, 0.55, M.blanco, 0.01), g, 0, 0.66, 0);
  for (let i = 0; i < 4; i++) { pon(caja(0.43, 0.3, 0.02, M.blanco, 0.008), g, 0, 0.18 + i * 0.32, 0.28); pon(caja(0.14, 0.015, 0.025, M.grisOsc, 0.005), g, 0, 0.28 + i * 0.32, 0.3); }
  g.add(sombraSuelo(0.9, 0.9, 0.4));
  return g;
}
function vitrina(padre, x, z) {
  const g = pon(new T.Group(), padre, x, 0, z);
  pon(caja(0.68, 1.95, 0.4, M.blanco, 0.01), g, 0, 0.975, 0);
  const fondo = pon(plano(0.6, 1.2, std('#fff', { map: texturas().cajasMed, roughness: 0.8 })), g, 0, 1.25, 0.06);
  for (let i = 0; i < 4; i++) pon(caja(0.6, 0.015, 0.3, M.cristal), g, 0, 0.7 + i * 0.32, 0.08);
  pon(caja(0.62, 1.25, 0.01, M.cristal), g, 0, 1.25, 0.205);
  for (let i = 0; i < 2; i++) pon(caja(0.6, 0.28, 0.02, M.blanco, 0.01), g, 0, 0.2 + i * 0.3, 0.2);
  pon(caja(0.015, 0.12, 0.02, M.metal), g, 0.05, 1.2, 0.22);
  g.add(sombraSuelo(1, 0.8, 0.4));
  return g;
}
function cuadro(padre, tex, w, h, x, y, z, ry = 0) {
  const g = pon(new T.Group(), padre, x, y, z, 0, ry, 0);
  pon(caja(w + 0.06, h + 0.06, 0.025, M.negro, 0.005), g, 0, 0, 0);
  pon(plano(w + 0.02, h + 0.02, std('#fafafa')), g, 0, 0, 0.0135);
  const m = pon(plano(w * 0.86, h * 0.84, std('#fff', { map: tex, roughness: 0.6 })), g, 0, 0, 0.0145);
  g.userData.lienzo = m;
  return g;
}
function telefono(padre, x, y, z, ry) {
  const g = pon(new T.Group(), padre, x, y, z, 0, ry, 0);
  pon(caja(0.2, 0.05, 0.22, M.negro, 0.02), g, 0, 0.025, 0, -0.15, 0, 0);
  pon(caja(0.07, 0.03, 0.22, M.negro, 0.015), g, -0.06, 0.07, 0);
  for (let i = 0; i < 12; i++) pon(caja(0.022, 0.006, 0.018, M.grisOsc, 0.003), g, 0.01 + (i % 3) * 0.03, 0.055, -0.05 + Math.floor(i / 3) * 0.028);
  pon(caja(0.08, 0.002, 0.04, std('#9fb0a0', { emissive: '#223322' })), g, 0.04, 0.058, -0.085);
  return g;
}
function lampTecho(padre, x, y, z, w = 1.2, d = 0.6) {
  pon(caja(w, 0.03, d, M.blanco, 0.005), padre, x, y - 0.015, z);
  const l = pon(plano(w - 0.06, d - 0.06, std('#fff', { emissive: '#ffffff', emissiveIntensity: 1.6 })), padre, x, y - 0.031, z, PI / 2, 0, 0);
  return l;
}
function monitorMedico(padre, x, y, z, ry, ancho = 0.32) {
  const g = pon(new T.Group(), padre, x, y, z, 0, ry, 0);
  pon(caja(ancho + 0.04, ancho * 0.72 + 0.04, 0.06, std('#e8eaec', { roughness: 0.4 }), 0.012), g, 0, 0, 0);
  const c = document.createElement('canvas'); c.width = 320; c.height = 220;
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  const pant = pon(plano(ancho, ancho * 0.68, new T.MeshBasicMaterial({ map: t, toneMapped: false })), g, 0, 0, 0.031);
  g.userData.monitor = { c, ctx: c.getContext('2d'), t, x: 0, ultimo: 0, fase: 0, prevY: [0, 0, 0] };
  return g;
}
// dibuja la pantalla de un monitor de constantes (barrido como en los reales)
export function pintarMonitor(mon, dt, vit, ritmo = 'normal') {
  const { ctx, c } = mon; const w = c.width, h = c.height;
  if (!mon.iniciado) { ctx.fillStyle = '#05080a'; ctx.fillRect(0, 0, w, h); mon.iniciado = true; }
  const ancho = 210, vel = 70; // px/s
  const fc = Math.max(1, vit.fc || 75);
  const pasos = Math.max(1, Math.round(dt * vel));
  for (let s = 0; s < pasos; s++) {
    mon.x = (mon.x + 1) % ancho;
    mon.fase += fc / 60 / vel; mon.tt = (mon.tt || 0) + 1 / vel;
    const f = mon.fase % 1;
    ctx.fillStyle = '#05080a'; ctx.fillRect(mon.x, 0, 8, h);
    const filas = [
      [45, ecgValor(f, ritmo, mon.tt) * 26, '#3dff6e'],
      [115, ritmo === 'asistolia' || ritmo === 'fv' ? 0 : Math.max(0, Math.sin(f * PI * 2 - 1.2)) * 18 - 4, '#ff4d4d'],
      [175, ritmo === 'asistolia' ? 0 : Math.sin(f * PI * 2) * 10 + Math.sin(f * PI * 4) * 3, '#3fd0ff'],
    ];
    filas.forEach(([y0, v, col], i) => { const y = y0 - v; ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mon.x - 1, mon.prevY[i] || y); ctx.lineTo(mon.x, y); ctx.stroke(); mon.prevY[i] = y; });
  }
  mon.reloj = (mon.reloj || 0) + dt;
  if (mon.reloj > 0.5) {
    mon.reloj = 0;
    ctx.fillStyle = '#05080a'; ctx.fillRect(ancho + 2, 0, w - ancho - 2, h);
    ctx.font = 'bold 34px monospace'; ctx.fillStyle = '#3dff6e'; ctx.fillText(ritmo === 'fv' ? '---' : String(vit.fc | 0), ancho + 8, 58);
    ctx.font = '13px monospace'; ctx.fillText('FC', ancho + 8, 20);
    ctx.fillStyle = '#ff4d4d'; ctx.font = 'bold 18px monospace'; ctx.fillText(`${vit.tas | 0}/${vit.tad | 0}`, ancho + 6, 124); ctx.font = '13px monospace'; ctx.fillText('TA', ancho + 8, 92);
    ctx.fillStyle = '#3fd0ff'; ctx.font = 'bold 30px monospace'; ctx.fillText(String(vit.sat | 0), ancho + 8, 190); ctx.font = '13px monospace'; ctx.fillText('SpO2', ancho + 8, 156);
  }
  mon.t2 = (mon.t2 || 0) + dt;
}

// ───────────────────────── Mundo ─────────────────────────
export class Mundo {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.camara = new T.PerspectiveCamera(60, 1, 0.03, 60);
    this.reloj = new T.Clock();
    this.escenas = {};
    this.actual = null;
    this.humanos = [];
    this.monitores = [];
    this.vitales = { fc: 80, tas: 120, tad: 75, sat: 98 };
    this.ritmo = 'normal';
    this.tween = null;
    this.calidad = 'alta';
    this.ray = new T.Raycaster();
    this.alActualizar = [];
    const pm = new T.PMREMGenerator(this.renderer);
    this.env = pm.fromScene(new RoomEnvironment(this.renderer), 0.04).texture;
    materiales();
    this.redimensionar();
    addEventListener('resize', () => this.redimensionar());
    this.renderer.setAnimationLoop(() => this.bucle());
  }
  ponerCalidad(q) {
    this.calidad = q;
    this.renderer.shadowMap.enabled = q !== 'baja';
    Object.values(this.escenas).forEach(e => e.traverse(o => { if (o.isLight && o.shadow) o.castShadow = q !== 'baja' && o.userData.sombra; if (o.material) o.material.needsUpdate = true; }));
    this.redimensionar();
  }
  redimensionar() {
    const w = this.canvas.clientWidth || innerWidth, h = this.canvas.clientHeight || innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, this.calidad === 'alta' ? 2 : this.calidad === 'media' ? 1.3 : 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.camara.aspect = w / h;
    // en vertical se abre el campo de visión para que quepa la escena
    this.camara.fov = w / h < 0.8 ? 72 : w / h < 1.2 ? 64 : 55;
    // en vertical los paneles ocupan la parte de abajo: se sube la imagen
    if (w / h < 0.8 && !this.sinDesplazar) this.camara.setViewOffset(w, h, 0, h * 0.2, w, h); else this.camara.clearViewOffset();
    this.camara.updateProjectionMatrix();
    this.alRedimensionar && this.alRedimensionar();
  }
  nuevaEscena(nombre, fondo = '#cfd4d8') {
    const e = new T.Scene(); e.background = new T.Color(fondo); e.environment = this.env;
    this.escenas[nombre] = e; return e;
  }
  luzFoco(e, x, y, z, tx, ty, tz, intens = 30, sombra = true, ang = PI / 2.8, col = '#fff6ea') {
    const l = new T.SpotLight(col, intens, 14, ang, 0.85, 1.6);
    l.position.set(x, y, z); l.target.position.set(tx, ty, tz); e.add(l, l.target);
    l.userData.sombra = sombra;
    if (sombra) { l.castShadow = this.calidad !== 'baja'; l.shadow.mapSize.set(this.calidad === 'alta' ? 2048 : 1024, this.calidad === 'alta' ? 2048 : 1024); l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02; l.shadow.radius = 6; l.shadow.camera.near = 0.3; l.shadow.camera.far = 8; }
    return l;
  }
  mostrar(nombre) {
    this.actual = nombre;
    const e = this.escenas[nombre];
    if (this.camara.parent !== e) e.add(this.camara);
    if (this.manos) this.manos.visible = nombre === 'consulta' && this.vistaConsulta === 'escritorio';
  }
  irA(pos, mira, dur = 1.0, up = null) {
    const de = { p: this.camara.position.clone(), m: this._mira ? this._mira.clone() : new T.Vector3(...mira), up: this.camara.up.clone() };
    this.tween = { de, a: { p: new T.Vector3(...pos), m: new T.Vector3(...mira), up: up ? new T.Vector3(...up) : new T.Vector3(0, 1, 0) }, t: 0, dur };
    if (dur === 0) this.tween.t = 1;
  }
  bucle() {
    const dt = Math.min(0.05, this.reloj.getDelta()), t = this.reloj.elapsedTime;
    if (this.tween) {
      const tw = this.tween; tw.t = Math.min(1, tw.t + (tw.dur ? dt / tw.dur : 1));
      const k = tw.t < 0.5 ? 4 * tw.t ** 3 : 1 - (-2 * tw.t + 2) ** 3 / 2;
      this.camara.position.lerpVectors(tw.de.p, tw.a.p, k);
      this._mira = new T.Vector3().lerpVectors(tw.de.m, tw.a.m, k);
      this.camara.up.lerpVectors(tw.de.up, tw.a.up, k).normalize();
      this.camara.lookAt(this._mira);
      if (tw.t >= 1) this.tween = null;
    } else if (this._mira) {
      // leve movimiento de cámara en mano
      if (this.respirarCamara) { const b = this._base || (this._base = this.camara.position.clone()); }
    }
    if (this.orbita && this.actual === 'creador') {
      this.orbita.ang += dt * this.orbita.vel;
    }
    for (const h of this.humanos) if (h.raiz.parent && this.escenaDe(h.raiz) === this.escenas[this.actual]) h.actualizar(dt, t);
    if (this.manos && this.manos.visible) {
      for (const b of this.manos.userData.brazos) {
        const k = this.doctorHablando ? 1 : 0;
        b.gest = (b.gest || 0) + (k - (b.gest || 0)) * Math.min(1, dt * 5);
        const ext = b.extra || 0; // brazo extendido hacia el paciente (entregar la receta)
        // al extender, el antebrazo se pone casi horizontal y avanza hacia el paciente
        b.b.rotation.x = b.base.x + b.gest * (1 - ext) * (0.25 + Math.sin(t * 3.1 + b.sg) * 0.12) + ext * 0.14;
        b.b.rotation.z = b.gest * (1 - ext) * Math.sin(t * 2.3 + b.sg * 2) * 0.12;
        b.b.position.y = b.basePos.y + Math.sin(t * 1.2 + b.sg) * 0.004 + ext * 0.05;
        b.b.position.z = b.basePos.z - ext * 0.34;
        b.b.position.x = b.basePos.x - b.sg * ext * 0.06;
      }
    }
    for (const m of this.monitores) if (this.escenaDe(m.obj) === this.escenas[this.actual]) { pintarMonitor(m.mon, dt, m.vitales ? m.vitales() : this.vitales, m.ritmo ? m.ritmo() : this.ritmo); m.mon.t.needsUpdate = true; }
    for (const f of this.alActualizar) f(dt, t);
    if (this.actual) this.renderer.render(this.escenas[this.actual], this.camara);
  }
  escenaDe(o) { while (o.parent) o = o.parent; return o; }
  rayo(x, y, objs) {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new T.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camara);
    return this.ray.intersectObjects(objs, true)[0] || null;
  }
  aPantalla(v3) {
    const v = v3.clone().project(this.camara); const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, delante: v.z < 1 };
  }
  registrar(h) { this.humanos.push(h); return h; }
  quitar(h) { if (!h) return; h.raiz.parent && h.raiz.parent.remove(h.raiz); this.humanos = this.humanos.filter(x => x !== h); }

  // El médico entrega un papel (la receta) en mano: lo sostiene, extiende el brazo, el paciente
  // extiende el suyo, el papel pasa de una mano a otra y el paciente se lo queda.
  entregarPapel(receptor, textura, { duracion = 1 } = {}) {
    return new Promise(res => {
      const brazo = this.manos && this.manos.visible ? (this.manos.userData.brazos.find(b => b.sg === 1) || this.manos.userData.brazos[0]) : null;
      const mano = receptor && receptor.huesos && receptor.huesos.manoR;
      if (!brazo || !mano) return res(false);
      const papel = new T.Mesh(new T.PlaneGeometry(0.1, 0.14), new T.MeshStandardMaterial({ map: textura, side: T.DoubleSide, roughness: 0.92 }));
      papel.name = 'receta';
      brazo.mun.add(papel); papel.position.set(0.0, -0.085, -0.02); papel.rotation.set(-1.25, 0, 0.1);
      const ease = (x) => x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
      const D = duracion; // escala de tiempos
      const fase = { pasando: null, enMano: false };
      // dónde y cómo debe quedar el papel: delante de la mano del paciente y de cara al médico, como quien sujeta una hoja
      const _p = new T.Vector3(), _q = new T.Quaternion(), _qr = new T.Quaternion(), _qp = new T.Quaternion();
      const inclinacion = new T.Quaternion().setFromEuler(new T.Euler(-0.35, 0, 0));
      const objetivo = () => {
        receptor.raiz.updateMatrixWorld(true);
        mano.getWorldPosition(_p); receptor.raiz.getWorldQuaternion(_qr);
        _p.add(new T.Vector3(0, 0.02, 0.07).applyQuaternion(_qr));
        _q.copy(_qr).multiply(inclinacion);
      };
      // fija el papel (ya colgado de la mano) en la posición y orientación del objetivo
      const colocarEnMano = () => {
        objetivo();
        mano.getWorldQuaternion(_qp);
        papel.position.copy(mano.worldToLocal(_p.clone()));
        papel.quaternion.copy(_qp.invert().multiply(_q));
      };
      // con el reloj real: dura lo mismo aunque el dispositivo vaya a pocos fotogramas por segundo
      const t0 = performance.now();
      let t = 0;
      const paso = () => {
        t = (performance.now() - t0) / 1000 / D;
        brazo.extra = t < 1.0 ? ease(t) : t < 2.5 ? 1 : t < 3.4 ? 1 - ease((t - 2.5) / 0.9) : 0;
        receptor.alcance = t < 0.7 ? 0 : t < 1.6 ? ease((t - 0.7) / 0.9) : t < 2.7 ? 1 : t < 3.7 ? 1 - ease((t - 2.7) / 1.0) : 0;
        // las dos manos se encuentran: el papel pasa de la del médico a la del paciente
        if (t >= 1.6 && !fase.pasando) { this.escenas[this.actual].attach(papel); fase.pasando = { t0: t, p: papel.position.clone(), q: papel.quaternion.clone() }; }
        if (fase.pasando && !fase.enMano) {
          const k = ease(Math.min(1, (t - fase.pasando.t0) / 0.45));
          objetivo();
          papel.position.lerpVectors(fase.pasando.p, _p, k);
          papel.quaternion.slerpQuaternions(fase.pasando.q, _q, k);
          if (k >= 1) { mano.attach(papel); fase.enMano = true; }
        }
        // mientras el paciente recoge el brazo, el papel sigue en su mano y de cara al médico
        if (fase.enMano) colocarEnMano();
        if (t >= 3.8) {
          // en un dispositivo lento puede saltarse fotogramas: el papel acaba siempre en la mano del paciente
          if (!fase.enMano) { mano.attach(papel); fase.enMano = true; }
          receptor.alcance = 0; receptor.actualizar(0); colocarEnMano();
          this.alActualizar = this.alActualizar.filter(f => f !== paso);
          brazo.extra = 0; receptor.alcance = 0;
          res(true);
        }
      };
      this.alActualizar.push(paso);
    });
  }

  // ───────── CONSULTA ─────────
  construirConsulta(doctor) {
    const e = this.nuevaEscena('consulta');
    const tx = texturas();
    habitacion(e, { x0: -2.1, x1: 3.9, z0: -1.5, z1: 2.3, alto: 2.7, matPared: M.pared, matSuelo: M.suelo, matTecho: M.techo, huecos: { fondo: [{ a: 0.85 + 2.1, b: 1.75 + 2.1, y0: 0, y1: 2.12 }], izq: [{ a: 1.4, b: 3.0, y0: 0.95, y1: 2.15 }] } });
    // ventana izquierda con exterior
    const v = ventana(e, 1.6, 1.2, M.blanco); v.position.set(-2.1, 1.55, 0.1); v.rotation.y = PI / 2;
    pon(plano(9, 4.5, new T.MeshBasicMaterial({ map: tx.exterior, toneMapped: false })), e, -5.5, 1.6, 0.1, 0, PI / 2, 0);
    pon(caja(0.25, 0.04, 1.75, M.blanco), e, -2.0, 0.93, 0.1);
    const sol = new T.DirectionalLight('#fff3df', 2.2); sol.position.set(-6, 4.5, 1.2); sol.target.position.set(0, 0, -0.2); e.add(sol, sol.target);
    sol.castShadow = this.calidad !== 'baja'; sol.userData.sombra = true; sol.shadow.mapSize.set(1024, 1024); sol.shadow.camera.left = -4; sol.shadow.camera.right = 4; sol.shadow.camera.top = 4; sol.shadow.camera.bottom = -4; sol.shadow.bias = -0.0005; sol.shadow.radius = 5;
    e.add(new T.HemisphereLight('#ffffff', '#7a7570', 0.35));
    lampTecho(e, 0, 2.7, 0.2); lampTecho(e, 2.9, 2.7, -0.4, 0.6, 0.6);
    this.luzFoco(e, 0, 2.62, 0.4, 0, 0, -0.4, 34);
    this.luzFoco(e, 2.9, 2.62, 0.2, 2.9, 0.8, -0.8, 26);
    const relleno = new T.PointLight('#fff', 4, 6, 2); relleno.position.set(0.5, 1.8, 1.6); e.add(relleno);
    // puerta
    const pg = pon(new T.Group(), e, 1.3, 0, -1.47);
    pon(caja(0.92, 2.1, 0.06, std('#eef0f2', { roughness: 0.4 })), pg, 0, 1.05, -0.02);
    pon(caja(1.02, 0.06, 0.12, M.blanco), pg, 0, 2.13, 0); pon(caja(0.06, 2.12, 0.12, M.blanco), pg, -0.49, 1.06, 0); pon(caja(0.06, 2.12, 0.12, M.blanco), pg, 0.49, 1.06, 0);
    pon(esf(0.03, M.cromo), pg, -0.36, 1.02, 0.04); pon(cil(0.012, 0.012, 0.1, M.cromo), pg, -0.32, 1.02, 0.06, 0, 0, PI / 2);
    pon(caja(0.14, 0.2, 0.09, M.blanco, 0.02), e, 2.05, 1.35, -1.43); pon(caja(0.11, 0.07, 0.02, std('#3a7bd5', { roughness: 0.4 })), e, 2.05, 1.38, -1.385);
    // muebles fondo
    archivador(e, -1.78, -1.18); archivador(e, -1.3, -1.18);
    vitrina(e, -0.5, -1.27);
    this.diploma = cuadro(e, texDiploma(doctor.nombre), 0.42, 0.32, 0.4, 1.85, -1.44);
    // escritorio
    const mesa = pon(new T.Group(), e, 0, 0, 0.82);
    pon(caja(1.75, 0.045, 0.85, M.madera, 0.008), mesa, 0, 0.755, 0);
    pon(caja(1.7, 0.6, 0.03, M.madera, 0.005), mesa, 0, 0.43, -0.4);
    pon(caja(0.03, 0.73, 0.82, M.madera), mesa, -0.85, 0.37, 0); pon(caja(0.03, 0.73, 0.82, M.madera), mesa, 0.85, 0.37, 0);
    pon(caja(0.45, 0.6, 0.75, M.madera, 0.005), mesa, 0.6, 0.43, 0);
    pon(caja(1.0, 0.006, 0.52, std('#161718', { roughness: 0.85 })), mesa, 0, 0.781, 0.05);
    telefono(mesa, 0.62, 0.778, -0.03, -0.3);
    // carpeta con ficha y radiografía
    const carp = pon(new T.Group(), mesa, -0.58, 0.781, 0.12, 0, 0.35, 0);
    pon(caja(0.27, 0.012, 0.36, std('#111', { roughness: 0.5 })), carp, 0, 0, 0);
    pon(plano(0.22, 0.29, std('#fff', { map: tx.papel, roughness: 0.9 })), carp, 0.01, 0.0075, 0, -PI / 2, 0, 0);
    pon(caja(0.08, 0.02, 0.03, M.metal), carp, 0.01, 0.012, -0.16);
    const rxc = document.createElement('canvas'); rxc.width = rxc.height = 256; dibujarRx(rxc.getContext('2d'), 256, 256, { zona: 'torax', seed: 4 });
    const rxt = new T.CanvasTexture(rxc); rxt.colorSpace = T.SRGBColorSpace;
    pon(plano(0.24, 0.24, std('#fff', { map: rxt, roughness: 0.3 })), mesa, -0.68, 0.79, 0.3, -PI / 2, 0, 0.6);
    pon(caja(0.3, 0.012, 0.38, std('#c8a77a', { roughness: 0.8 })), mesa, 0.6, 0.784, 0.3, 0, -0.25, 0);
    pon(cil(0.005, 0.005, 0.14, std('#1d4fbf')), mesa, 0.25, 0.787, 0.2, 0, 0.4, PI / 2);
    e.add(pon(sombraSuelo(2.2, 1.4, 0.4), new T.Group(), 0, 0, 0.82));
    // sillas
    this.sillaPaciente = silla(e, 0.32, -0.3, 0);
    this.sillaAcomp = silla(e, -0.45, -0.38, 0.15);
    // portabebés sobre la silla del paciente (sólo con bebés)
    const pb = pon(new T.Group(), e, 0.32, 0.49, -0.25); pb.visible = false; this.portabebes = pb;
    pon(caja(0.42, 0.18, 0.62, std('#5b6470', { roughness: 0.7 }), 0.08), pb, 0, 0.09, 0);
    pon(caja(0.36, 0.06, 0.54, std('#e9dfd3', { roughness: 0.95 }), 0.03), pb, 0, 0.17, 0.02);
    pon(caja(0.42, 0.3, 0.08, std('#5b6470', { roughness: 0.7 }), 0.04), pb, 0, 0.27, -0.27, -0.35, 0, 0);
    pon(new T.Mesh(new T.TorusGeometry(0.22, 0.015, 8, 32, PI), std('#2f343b')), pb, 0, 0.17, -0.12, -1.25, 0, 0);
    sombra(pb);
    // zona de exploración (derecha)
    const caja_luz = pon(new T.Group(), e, 2.55, 1.55, -1.45);
    pon(caja(1.08, 0.66, 0.06, M.blanco, 0.01), caja_luz, 0, 0, 0);
    pon(plano(1.0, 0.58, new T.MeshBasicMaterial({ map: tx.cajaLuz, toneMapped: false, color: '#f4f8ff' })), caja_luz, 0, 0, 0.031);
    const ll = new T.PointLight('#e6f0ff', 3, 2.5, 2); ll.position.set(2.55, 1.55, -1.2); e.add(ll);
    // panel de diagnóstico de pared
    const pd = pon(new T.Group(), e, 3.35, 1.45, -1.46);
    pon(caja(0.62, 0.3, 0.03, M.cromo, 0.01), pd, 0, 0, 0);
    pon(caja(0.1, 0.12, 0.05, std('#fff'), 0.01), pd, -0.22, 0.05, 0.03); pon(cil(0.04, 0.04, 0.02, std('#222')), pd, -0.22, 0.05, 0.065, PI / 2, 0, 0);
    for (let i = 0; i < 2; i++) pon(cil(0.016, 0.016, 0.18, M.negro), pd, -0.08 + i * 0.07, 0.0, 0.04);
    for (let i = 0; i < 4; i++) pon(cil(0.012, 0.012, 0.22, M.negro), pd, 0.06 + i * 0.03, -0.02, 0.04);
    pon(caja(0.11, 0.14, 0.05, std('#fff'), 0.01), pd, 0.24, 0.05, 0.04); pon(caja(0.08, 0.06, 0.005, std('#1f4f9f', { emissive: '#0a2a5a' })), pd, 0.24, 0.07, 0.066);
    pon(tubo([[-0.1, -0.08, 0.05], [-0.12, -0.35, 0.08], [-0.05, -0.4, 0.06], [0.0, -0.1, 0.05]], 0.006, M.negro), pd);
    pon(tubo([[-0.22, -0.02, 0.05], [-0.25, -0.3, 0.07], [-0.2, -0.38, 0.05]], 0.005, M.negro), pd);
    // báscula
    const bas = pon(new T.Group(), e, 2.05, 0, -1.15);
    pon(caja(0.36, 0.06, 0.42, std('#d8d8d8'), 0.02), bas, 0, 0.03, 0); pon(cil(0.02, 0.02, 1.25, M.negro), bas, 0, 0.66, -0.15);
    pon(caja(0.42, 0.04, 0.04, M.cromo), bas, 0.1, 1.28, -0.15); pon(caja(0.08, 0.05, 0.06, M.negro), bas, 0.25, 1.28, -0.15);
    bas.add(sombraSuelo(0.7, 0.7, 0.3));
    // póster esqueleto en la pared derecha
    cuadro(e, tx.esqueleto, 0.62, 0.82, 3.84, 1.55, -0.55, -PI / 2);
    // camilla
    const cam = pon(new T.Group(), e, 3.4, 0, 1.0);
    pon(caja(0.7, 0.12, 1.85, std('#2a2d33', { roughness: 0.6 }), 0.04), cam, 0, 0.7, 0);
    pon(caja(0.55, 0.005, 1.8, std('#f7f7f2', { roughness: 0.95 })), cam, 0, 0.765, 0);
    pon(caja(0.6, 0.6, 1.7, M.blanco, 0.01), cam, 0, 0.32, 0);
    cam.add(sombraSuelo(1.2, 2.4, 0.4));
    pon(caja(0.3, 0.32, 0.12, M.blanco, 0.02), e, 3.83, 1.35, 0.3, 0, -PI / 2, 0);
    // manos del médico
    this.manos = crearManosMedico(doctor, doctor.ropa);
    this.camara.add(this.manos);
    this.posEscritorio = [[0, 1.26, 1.62], [0.05, 1.0, -0.45]];
    this.vistaConsulta = 'escritorio';
    // estetoscopio en mano para la exploración
    const et = new T.Group();
    pon(cil(0.026, 0.028, 0.014, M.cromo, 32), et, 0, 0, 0.007, PI / 2, 0, 0);
    pon(cil(0.022, 0.022, 0.004, std('#f4f6f8', { roughness: 0.15 })), et, 0, 0, -0.0005, PI / 2, 0, 0);
    pon(cil(0.03, 0.03, 0.006, M.negro, 32), et, 0, 0, 0.004, PI / 2, 0, 0);
    pon(cil(0.006, 0.006, 0.07, M.cromo), et, 0, -0.04, 0.03, -0.6, 0, 0);
    const manoE = pon(new T.Group(), et, 0.0, -0.05, 0.07, 0.6, 0, 0.2);
    crearMano(manoE, new T.MeshPhysicalMaterial({ color: doctor.piel, roughness: 0.55, sheen: 0.4 }), 1);
    manoE.scale.setScalar(1.05);
    et.visible = false; e.add(et); this.esteto = et;
    sombra(et, false, false);
    const marc = new T.Group(); e.add(marc); this.marcadores = marc;
    return e;
  }
  actualizarDoctor(doctor) {
    if (this.diploma) { const m = this.diploma.userData.lienzo; m.material.map = texDiploma(doctor.nombre); m.material.needsUpdate = true; }
    if (this.manos) { this.camara.remove(this.manos); this.manos = crearManosMedico(doctor, doctor.ropa); this.camara.add(this.manos); this.mostrar(this.actual || 'consulta'); }
  }
  vistaEscritorio(dur = 0.9) {
    this.vistaConsulta = 'escritorio';
    const [p, m] = this.posEscritorio;
    if (this.camara.aspect < 0.8) this.irA([0.22, 1.3, 1.75], [0.3, 1.0, -0.4], dur); else this.irA(p, m, dur);
    if (this.manos) this.manos.visible = true;
    this.esteto.visible = false;
  }
  vistaExplorar(lado = 'espalda', dur = 0.9, h = null) {
    this.vistaConsulta = 'explorar';
    if (this.manos) this.manos.visible = false;
    // se apunta al pecho del paciente, sea de la estatura que sea
    let c = new T.Vector3(2.9, 1.3, -0.6);
    if (h && h.huesos) { h.raiz.updateMatrixWorld(true); h.huesos.pecho.getWorldPosition(c); }
    if (h && (h.pose === 'tumbado' || h.pose === 'boca_abajo')) { const d = 0.35 + 0.35 * (h.S || 1); this.irA([c.x - d * 0.75, c.y + d, c.z + d * 0.3], [c.x, c.y, c.z], dur); return; }
    const d = 0.55 + 0.4 * Math.min(1, h?.S || 1);
    if (lado === 'espalda') this.irA([c.x, c.y + 0.15, c.z + d], [c.x, c.y - 0.02, c.z], dur);
    else this.irA([c.x, c.y + 0.18, c.z + d + 0.1], [c.x, c.y - 0.02, c.z], dur);
  }
  vistaDetalle(dur = 0.9) { this.vistaConsulta = 'detalle'; if (this.manos) this.manos.visible = false; this.irA([2.95, 1.62, 0.15], [2.9, 1.58, -0.6], dur); }
  ponerPacienteConsulta(h, donde = 'silla') {
    const e = this.escenas.consulta;
    if (h.raiz.parent !== e) e.add(h.raiz);
    if (donde === 'silla') { h.ponerPose('sentado'); h.raiz.position.set(0.32, 0, -0.27); h.raiz.rotation.y = 0; h.mirar = new T.Vector3(0, 1.26, 1.62); }
    else if (donde === 'acomp') { h.ponerPose('sentado'); h.raiz.position.set(-0.45, 0, -0.35); h.raiz.rotation.y = 0.15; h.mirar = new T.Vector3(0, 1.26, 1.62); }
    else if (donde === 'espalda') { h.ponerPose('espalda'); h.raiz.position.set(2.9, 0, -0.6); h.mirar = null; }
    else if (donde === 'frente') { h.ponerPose('depie'); h.raiz.position.set(2.9, 0, -0.6); h.mirar = new T.Vector3(2.9, 1.5, 0.45); }
    else if (donde === 'portabebes' || donde === 'camilla_arriba' || donde === 'camilla_abajo') {
      const S = h.S || 1, yPel = (0.9 * (h.esc || 1) + (h.dy || 0)) * S;
      if (donde === 'portabebes') {
        h.ponerPose('recostado');
        const th = -1.1, obj = new T.Vector3(0.32, 0.72, -0.18);
        h.raiz.position.set(obj.x, obj.y - yPel * Math.cos(th), obj.z - yPel * Math.sin(th));
        h.mirar = new T.Vector3(0, 1.26, 1.62);
      } else {
        h.ponerPose(donde === 'camilla_arriba' ? 'tumbado' : 'boca_abajo');
        const grosor = 0.1 * S * (h.ap.complexion || 1);
        h.raiz.position.set(3.4, 0.77 + grosor, donde === 'camilla_arriba' ? 1.15 + yPel : 0.75 - yPel);
        h.mirar = null;
      }
    }
    if (this.portabebes) this.portabebes.visible = donde === 'portabebes' || (this.portabebes.visible && donde !== 'silla');
    h.raiz.updateMatrixWorld(true);
  }

  // ───────── SALA ─────────
  construirSala() {
    const e = this.nuevaEscena('sala', '#e8eef2');
    const tx = texturas();
    habitacion(e, { x0: -2.2, x1: 2.2, z0: -2.2, z1: 2.5, alto: 2.7, matPared: M.pared, matSuelo: std('#fff', { map: tx.suelo, roughness: 0.6, color: '#e4e4e4' }), matTecho: M.techo, banda: '#1e2340', huecos: { der: [{ a: 0.3, b: 3.6, y0: 0.55, y1: 2.55 }] } });
    const v = ventana(e, 3.3, 2.0, M.blanco); v.position.set(2.2, 1.55, -0.25); v.rotation.y = -PI / 2;
    pon(plano(16, 7, new T.MeshBasicMaterial({ map: tx.exterior, toneMapped: false })), e, 9, 1.8, -0.2, 0, -PI / 2, 0);
    for (let i = 0; i < 9; i++) pon(caja(0.006, 2.0, 0.09, std('#f4f4f4', { roughness: 0.8 })), e, 2.08, 1.55, 1.42 - i * 0.07, 0, 0.6, 0);
    const sol = new T.DirectionalLight('#fff1d6', 3.0); sol.position.set(7, 5, 1); sol.target.position.set(-0.5, 0, -0.8); e.add(sol, sol.target);
    sol.castShadow = this.calidad !== 'baja'; sol.userData.sombra = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.camera.left = -4; sol.shadow.camera.right = 4; sol.shadow.camera.top = 4; sol.shadow.camera.bottom = -4; sol.shadow.bias = -0.0005; sol.shadow.radius = 6;
    e.add(new T.HemisphereLight('#ffffff', '#a39e98', 0.6));
    lampTecho(e, 0, 2.7, 0.2, 0.6, 0.6);
    const rej = pon(caja(0.6, 0.02, 0.6, std('#c9cccf', { metalness: 0.6, roughness: 0.4 })), e, 0.9, 2.69, 1.4);
    this.luzFoco(e, 0, 2.6, 0.3, -0.2, 0, -0.9, 18);
    // panel de madera detrás de la cama
    pon(caja(1.95, 2.2, 0.04, std('#fff', { map: tx.listones, roughness: 0.75 })), e, -0.15, 1.35, -2.13);
    pon(caja(2.05, 0.04, 0.08, M.blanco), e, -0.15, 2.46, -2.11); pon(caja(0.04, 2.25, 0.08, M.blanco), e, -1.17, 1.33, -2.11); pon(caja(0.04, 2.25, 0.08, M.blanco), e, 0.87, 1.33, -2.11);
    // toma de gases
    const tg = pon(new T.Group(), e, -0.15, 1.42, -2.06);
    pon(caja(1.55, 0.32, 0.07, M.blanco, 0.02), tg, 0, 0, 0); pon(caja(1.53, 0.08, 0.072, M.negro, 0.01), tg, 0, 0.1, 0.002);
    for (let i = 0; i < 6; i++) pon(cil(0.025, 0.025, 0.02, i % 2 ? M.negro : M.cromo), tg, -0.4 + i * 0.12, -0.02, 0.04, PI / 2, 0, 0);
    for (let i = 0; i < 4; i++) pon(caja(0.08, 0.06, 0.01, std('#f0f0f0')), tg, -0.65 + (i % 2) * 0.1, -0.06 + Math.floor(i / 2) * 0.08, 0.04);
    const mon = monitorMedico(e, 0.55, 1.52, -2.0, 0, 0.26); this.monitores.push({ obj: mon, mon: mon.userData.monitor, vitales: () => this.vitalesSala || this.vitales, ritmo: () => 'normal' });
    // cama
    const cama = pon(new T.Group(), e, -0.15, 0, -1.0); this.cama = cama;
    pon(caja(0.95, 0.12, 2.05, M.blanco, 0.02), cama, 0, 0.42, 0);
    pon(caja(0.9, 0.18, 1.95, M.marino, 0.05), cama, 0, 0.56, 0);
    for (const z of [-1.0, 1.02]) { const cab = pon(caja(1.0, z < 0 ? 0.55 : 0.42, 0.06, M.blanco, 0.03), cama, 0, z < 0 ? 0.82 : 0.76, z); pon(caja(0.86, 0.26, 0.065, M.marino, 0.02), cama, 0, z < 0 ? 0.78 : 0.72, z); }
    for (const sx of [-1, 1]) { for (let i = 0; i < 2; i++) pon(cil(0.012, 0.012, 0.75, M.blanco), cama, sx * 0.5, 0.82 + i * 0.12, -0.35, PI / 2, 0, 0); for (let i = 0; i < 5; i++) pon(cil(0.01, 0.01, 0.26, M.marino), cama, sx * 0.5, 0.82, -0.65 + i * 0.15); }
    for (const [x, z] of [[-0.4, -0.9], [0.4, -0.9], [-0.4, 0.9], [0.4, 0.9]]) { pon(cil(0.025, 0.025, 0.3, M.metalMate), cama, x, 0.2, z); pon(cil(0.05, 0.05, 0.04, M.negro), cama, x, 0.05, z, 0, 0, PI / 2); }
    pon(caja(0.6, 0.12, 0.35, std('#f7f7f7', { roughness: 0.9 }), 0.06), cama, 0, 0.7, -0.78);
    cama.add(sombraSuelo(1.6, 2.8, 0.5));
    this.manta = pon(caja(0.94, 0.07, 1.3, std('#fff', { map: tx.manta, roughness: 0.95 }), 0.03), cama, 0, 0.83, 0.38);
    // gotero
    const got = pon(new T.Group(), e, 0.55, 0, -1.25);
    pon(cil(0.012, 0.012, 2.0, M.metal), got, 0, 1.0, 0); for (let i = 0; i < 5; i++) pon(cil(0.012, 0.012, 0.25, M.metal), got, Math.cos(i * 1.256) * 0.12, 0.04, Math.sin(i * 1.256) * 0.12, 0, -i * 1.256, PI / 2);
    pon(cil(0.008, 0.008, 0.4, M.metal), got, 0, 2.0, 0, 0, 0, PI / 2);
    for (const sx of [-1, 1]) { const b = pon(caja(0.11, 0.18, 0.03, new T.MeshPhysicalMaterial({ color: '#eef6f8', transparent: true, opacity: 0.55, roughness: 0.15 }), 0.02), got, sx * 0.16, 1.82, 0); pon(tubo([[sx * 0.16, 1.72, 0], [sx * 0.1, 1.3, 0.05], [-0.2, 1.0, 0.2], [-0.45, 0.85, 0.3]], 0.0035, std('#eaf2f5', { transparent: true, opacity: 0.7 })), got); }
    got.add(sombraSuelo(0.5, 0.5, 0.3));
    // respirador
    const resp = pon(new T.Group(), e, -1.55, 0, -1.2, 0, 0.5, 0);
    pon(caja(0.55, 0.06, 0.5, M.negro, 0.02), resp, 0, 0.1, 0); for (const [x, z] of [[-0.22, -0.2], [0.22, -0.2], [-0.22, 0.2], [0.22, 0.2]]) pon(cil(0.03, 0.03, 0.04, M.negro), resp, x, 0.03, z, 0, 0, PI / 2);
    pon(cil(0.025, 0.025, 0.8, M.blanco), resp, 0, 0.5, -0.05);
    pon(caja(0.45, 0.5, 0.35, M.blanco, 0.03), resp, 0, 1.12, 0);
    pon(caja(0.38, 0.06, 0.02, std('#2a2a2a')), resp, 0, 1.25, 0.18); for (let i = 0; i < 6; i++) pon(cil(0.02, 0.02, 0.02, i % 2 ? std('#2d68c4') : M.negro), resp, -0.15 + i * 0.06, 1.0, 0.18, PI / 2, 0, 0);
    const mon2 = monitorMedico(resp, 0, 1.55, 0.05, 0, 0.24); this.monitores.push({ obj: mon2, mon: mon2.userData.monitor, vitales: () => this.vitalesSala || this.vitales, ritmo: () => 'normal' });
    pon(tubo([[0.15, 0.95, 0.15], [0.35, 0.7, 0.3], [0.6, 0.85, 0.2], [0.75, 0.9, -0.1]], 0.02, std('#f2f2f2', { roughness: 0.4 })), resp);
    pon(tubo([[0.05, 0.95, 0.15], [0.25, 0.6, 0.35], [0.5, 0.75, 0.3], [0.7, 0.85, 0.05]], 0.02, std('#f2f2f2', { roughness: 0.4 })), resp);
    pon(tubo([[-0.2, 1.4, 0], [-0.35, 1.7, 0.1], [-0.2, 1.9, 0.2], [0.05, 1.75, 0.2]], 0.012, M.negro), resp);
    resp.add(sombraSuelo(0.9, 0.9, 0.4));
    cuadro(e, tx.cuadro1, 0.75, 0.5, -2.14, 1.65, 0.6, PI / 2);
    cuadro(e, tx.cuadro2, 0.42, 0.3, 1.25, 1.7, -2.15);
    // lámpara de pie
    pon(cil(0.012, 0.012, 1.6, M.metal), e, 1.55, 0.8, -1.8); pon(esf(0.11, std('#f7f7f7', { emissive: '#fff8e8', emissiveIntensity: 0.4 })), e, 1.55, 1.62, -1.75).scale.y = 0.6;
    return e;
  }
  ponerPacienteCama(h) {
    const e = this.escenas.sala;
    if (h.raiz.parent !== e) e.add(h.raiz);
    h.ponerPose('tumbado');
    h.raiz.position.set(-0.15, 0.76, -0.1);
    inclinarTronco(h, 0.38);
    h.mirar = null;
    this.irA([0.85, 1.6, 1.05], [-0.25, 0.8, -1.15], 0);
  }

  // ───────── QUIRÓFANO ─────────
  construirQuirofano() {
    const e = this.nuevaEscena('quirofano', '#dfe4e7');
    const tx = texturas();
    habitacion(e, { x0: -3.2, x1: 3.2, z0: -3.2, z1: 3.2, alto: 3.0, matPared: std('#fff', { map: tx.azulejo, roughness: 0.45, color: '#f1f3f4' }), matSuelo: M.sueloQ, matTecho: M.techo, banda: null, huecos: { izq: [{ a: 1.6, b: 5.0, y0: 0.95, y1: 2.2 }], fondo: [{ a: 2.5, b: 4.3, y0: 0, y1: 2.3 }] } });
    for (let i = 0; i < 3; i++) { const cr = pon(caja(0.04, 1.25, 1.1, M.cristalOsc), e, -3.2, 1.57, 1.0 - i * 1.15); pon(caja(0.1, 1.3, 0.05, M.blanco), e, -3.17, 1.57, 1.57 - i * 1.15); }
    pon(caja(0.1, 0.06, 3.5, M.blanco), e, -3.15, 0.93, -0.15); pon(caja(0.1, 0.06, 3.5, M.blanco), e, -3.15, 2.22, -0.15);
    // siluetas al otro lado del cristal
    for (let i = 0; i < 2; i++) { const s = pon(cap(0.18, 0.9, std('#1d2328', { roughness: 0.9 })), e, -3.7, 1.25, 0.8 - i * 1.6); }
    // puertas dobles
    for (const sx of [-1, 1]) { const p = pon(caja(0.88, 2.25, 0.06, std('#e9ecee', { roughness: 0.35 })), e, -0.2 + sx * 0.45, 1.125, -3.17); pon(new T.Mesh(new T.CircleGeometry(0.15, 32), M.cristalOsc), e, -0.2 + sx * 0.45, 1.6, -3.135); const ar = pon(new T.Mesh(new T.TorusGeometry(0.15, 0.015, 8, 32), M.metal), e, -0.2 + sx * 0.45, 1.6, -3.13); }
    e.add(new T.HemisphereLight('#ffffff', '#8f9599', 0.7));
    for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8], [0, 0]]) lampTecho(e, x, 3.0, z, 0.9, 0.9);
    this.luzFoco(e, -1.5, 2.9, 1.5, 0, 0, 0, 24, false, PI / 2.2);
    this.luzFoco(e, 1.5, 2.9, -1.5, 0, 0, 0, 24, false, PI / 2.2);
    // mesa de operaciones
    const mesa = pon(new T.Group(), e, 0.4, 0, 0.3); this.mesaQ = mesa;
    pon(caja(0.5, 0.08, 0.7, M.grisOsc, 0.02), mesa, 0, 0.04, 0.2); pon(cil(0.1, 0.13, 0.75, M.metal), mesa, 0, 0.45, 0.2);
    pon(caja(0.56, 0.08, 1.95, M.metalMate, 0.01), mesa, 0, 0.84, 0);
    pon(caja(0.55, 0.09, 1.9, M.marino, 0.04), mesa, 0, 0.92, 0);
    for (const sx of [-1, 1]) pon(caja(0.015, 0.025, 1.9, M.cromo), mesa, sx * 0.3, 0.86, 0);
    const brazo = pon(new T.Group(), mesa, -0.32, 0.92, -0.1);
    pon(caja(0.55, 0.07, 0.15, M.marino, 0.03), brazo, -0.3, 0, 0); pon(caja(0.08, 0.03, 0.06, M.cromo), brazo, 0, -0.04, 0);
    const brazo2 = pon(new T.Group(), mesa, 0.32, 0.92, -0.1);
    pon(caja(0.55, 0.07, 0.15, M.marino, 0.03), brazo2, 0.3, 0, 0);
    // arco de anestesia
    pon(new T.Mesh(new T.TorusGeometry(0.34, 0.012, 8, 24, PI), M.cromo), mesa, 0, 0.98, -0.62);
    mesa.add(sombraSuelo(1.5, 2.6, 0.5));
    // paño quirúrgico
    const pano = std(tx.bata ? '#1e6f6c' : '#1e6f6c', { roughness: 0.95, side: T.DoubleSide });
    this.pano = pon(caja(0.95, 0.03, 1.55, pano, 0.01), mesa, 0, 1.12, 0.22);
    for (const sx of [-1, 1]) pon(plano(1.55, 0.35, pano), mesa, sx * 0.475, 0.96, 0.22, 0, sx * PI / 2, 0);
    pon(plano(0.95, 0.35, pano), mesa, 0, 0.96, 0.995, 0, 0, 0);
    pon(caja(0.8, 0.5, 0.02, pano), mesa, 0, 1.3, -0.56, -0.1, 0, 0); // pantalla de anestesia
    // campo operatorio
    const cc = document.createElement('canvas'); cc.width = cc.height = 1024;
    const ct = new T.CanvasTexture(cc); ct.colorSpace = T.SRGBColorSpace; ct.anisotropy = 8;
    const campo = pon(new T.Mesh(new T.PlaneGeometry(0.4, 0.4), std('#e9e9e9', { map: ct, roughness: 0.75, metalness: 0, envMapIntensity: 0.25 })), mesa, 0, 1.14, 0.1, -PI / 2, 0, 0);
    campo.receiveShadow = true;
    this.campo = { canvas: cc, ctx: cc.getContext('2d'), tex: ct, mesh: campo };
    // instrumento 3D que sigue al dedo
    this.instr = new T.Group(); e.add(this.instr); this.instr.visible = false;
    // lámparas quirúrgicas
    const brazoTecho = pon(new T.Group(), e, 0.4, 3.0, 0.3);
    pon(cil(0.1, 0.1, 0.12, M.blanco), brazoTecho, 0, -0.06, 0); pon(cil(0.035, 0.035, 0.6, M.blanco), brazoTecho, 0, -0.4, 0);
    const lampQ = (dx, dz, rx, rz) => {
      const g = pon(new T.Group(), e, 0.4 + dx, 2.15, 0.3 + dz, rx, 0, rz);
      pon(caja(0.06, 0.06, Math.hypot(dx, dz) + 0.1, M.blanco, 0.02), e, 0.4 + dx / 2, 2.55, 0.3 + dz / 2, 0, Math.atan2(dx, dz), 0);
      pon(cil(0.025, 0.025, 0.42, M.blanco), g, 0, 0.21, 0);
      const cab = pon(cil(0.34, 0.3, 0.1, std('#e9ebec', { roughness: 0.3, metalness: 0.2 }), 6), g, 0, 0, 0);
      pon(new T.Mesh(new T.CircleGeometry(0.3, 6), new T.MeshBasicMaterial({ map: tx.celdasLuz, toneMapped: false })), g, 0, -0.052, 0, PI / 2, 0, 0);
      pon(cil(0.03, 0.03, 0.12, M.cromo), g, 0, -0.1, 0);
      return g;
    };
    lampQ(-0.75, 0.15, 0.1, -0.5); lampQ(0.7, 0.55, -0.15, 0.45);
    this.luzQ = this.luzFoco(e, 0.4, 2.3, 0.5, 0.4, 1.1, 0.3, 22, true, PI / 9, '#ffffff');
    this.luzFoco(e, -0.35, 2.1, 0.45, 0.4, 1.1, 0.2, 20, false, PI / 8, '#ffffff');
    // carro de instrumental
    const carro = pon(new T.Group(), e, -0.8, 0, 1.3, 0, 0.25, 0);
    for (const [x, z] of [[-0.35, -0.22], [0.35, -0.22], [-0.35, 0.22], [0.35, 0.22]]) { pon(cil(0.012, 0.012, 0.95, M.metal), carro, x, 0.5, z); pon(esf(0.03, M.negro), carro, x, 0.03, z); }
    for (let i = 0; i < 3; i++) {
      pon(caja(0.74, 0.02, 0.48, M.metal, 0.005), carro, 0, 0.22 + i * 0.35, 0);
      pon(caja(0.6, 0.004, 0.36, std('#2e8b8b', { roughness: 0.9 })), carro, -0.02, 0.235 + i * 0.35, 0);
      for (let k = 0; k < 7; k++) pon(caja(0.008, 0.006, 0.14 + (k % 3) * 0.03, M.cromo), carro, -0.25 + k * 0.05, 0.242 + i * 0.35, -0.05);
    }
    for (const [x, z] of [[0.1, 0.05], [0.25, -0.05]]) { const b = pon(new T.Mesh(new T.SphereGeometry(0.09, 24, 12, 0, PI * 2, PI / 2, PI / 2), std('#d8dde1', { metalness: 1, roughness: 0.18, side: T.DoubleSide })), carro, x, 0.98, z); b.scale.y = 0.6; }
    pon(caja(0.36, 0.05, 0.26, M.metal, 0.01), carro, -0.15, 0.6, 0.05);
    carro.add(sombraSuelo(1.1, 0.9, 0.4));
    // monitor de constantes
    const mon = monitorMedico(e, 1.45, 1.65, -0.6, -0.6, 0.42); this.monitores.push({ obj: mon, mon: mon.userData.monitor });
    pon(cil(0.03, 0.03, 1.35, M.blanco), e, 1.5, 2.33, -0.65);
    // máquina de anestesia
    const an = pon(new T.Group(), e, 1.1, 0, -1.25, 0, -0.5, 0);
    pon(caja(0.65, 1.0, 0.55, M.blanco, 0.03), an, 0, 0.55, 0); pon(caja(0.7, 0.04, 0.6, M.grisOsc, 0.01), an, 0, 1.07, 0);
    pon(caja(0.5, 0.35, 0.05, M.negro, 0.02), an, 0, 1.4, -0.1, -0.2, 0, 0);
    for (let i = 0; i < 3; i++) pon(cil(0.03, 0.03, 0.22, ['#2c7be5', '#f2f2f2', '#2fb34a'][i] ? std(['#2c7be5', '#e9e9e9', '#2fb34a'][i]) : M.metal), an, -0.2 + i * 0.12, 0.95, 0.3);
    pon(tubo([[0, 1.0, 0.28], [-0.3, 1.1, 0.5], [-0.65, 1.1, 0.7], [-0.75, 1.05, 0.95]], 0.02, std('#3c8ad9', { roughness: 0.4 })), an);
    an.add(sombraSuelo(1, 1, 0.4));
    // desfibrilador
    const des = pon(new T.Group(), e, -1.95, 0, -1.25);
    pon(caja(0.9, 0.04, 0.5, M.metal, 0.01), des, 0, 0.88, 0); for (const [x, z] of [[-0.42, -0.22], [0.42, -0.22], [-0.42, 0.22], [0.42, 0.22]]) pon(cil(0.015, 0.015, 0.88, M.metal), des, x, 0.44, z);
    pon(caja(0.38, 0.22, 0.3, std('#e2e4e6', { roughness: 0.4 }), 0.03), des, 0.1, 1.01, 0);
    pon(caja(0.15, 0.1, 0.005, std('#1a2a1a', { emissive: '#0b3b12' })), des, 0.05, 1.04, 0.151);
    pon(caja(0.08, 0.04, 0.12, std('#d04030'), 0.01), des, -0.22, 0.92, 0.05);
    des.add(sombraSuelo(1.1, 0.8, 0.35));
    // cubo y soporte de cubetas
    const cubo = pon(cil(0.18, 0.15, 0.45, M.metal), e, -1.6, 0.25, 0.9); e.add(pon(sombraSuelo(0.6, 0.6, 0.4), new T.Group(), -1.6, 0, 0.9));
    const sop = pon(new T.Group(), e, 2.0, 0, 1.6);
    for (let i = 0; i < 4; i++) pon(cil(0.012, 0.012, 0.9, M.metal), sop, Math.cos(i * PI / 2) * 0.2, 0.45, Math.sin(i * PI / 2) * 0.2);
    for (const dx of [-0.13, 0.13]) { const b = pon(new T.Mesh(new T.SphereGeometry(0.12, 20, 10, 0, PI * 2, PI / 2, PI / 2), std('#d8dde1', { metalness: 1, roughness: 0.2, side: T.DoubleSide })), sop, dx, 0.92, 0); b.scale.y = 0.7; }
    return e;
  }
  prepararQuirofano(paciente, personal) {
    const e = this.escenas.quirofano;
    if (this.pacQ) this.quitar(this.pacQ);
    (this.personalQ || []).forEach(h => this.quitar(h));
    if (paciente) {
      const h = this.registrar(crearHumano(paciente, ropaSin(paciente)));
      e.add(h.raiz); h.ponerPose('tumbado');
      h.raiz.position.set(0.4, 0.97, -0.38);
      h.dormido = true; this.pacQ = h;
    }
    this.personalQ = personal.map(([ap, ropa, x, z, ry, pose]) => {
      const h = this.registrar(crearHumano(ap, ropa)); e.add(h.raiz); h.ponerPose(pose || 'manos_juntas');
      h.raiz.position.set(x, 0, z); h.raiz.rotation.y = ry; h.mirar = new T.Vector3(0.4, 1.1, 0.3); return h;
    });
  }
  // coloca el campo según la zona de la cirugía y devuelve la vista cenital
  colocarCampo(zona) {
    const pos = { fid: [-0.08, 0.32], hcd: [-0.09, 0.08], torax_izq: [0.1, -0.08], ingle: [-0.08, 0.5], cadera: [-0.2, 0.46], antebrazo: [-0.62, -0.1], muneca: [-0.62, -0.1] }[zona] || [0, 0.2];
    const brazo = zona === 'antebrazo' || zona === 'muneca';
    this.campo.mesh.position.set(pos[0], brazo ? 0.99 : 1.14, pos[1]);
    this.campo.mesh.scale.setScalar(brazo ? 0.75 : 1);
    this.mesaQ.updateMatrixWorld(true);
    const c = new T.Vector3(); this.campo.mesh.getWorldPosition(c);
    this.centroCampo = c;
    this.vistaCampo();
  }
  vistaCampo(dur = 1.2) {
    const c = this.centroCampo; const tam = 0.4 * this.campo.mesh.scale.x;
    const hfov = 2 * Math.atan(Math.tan(this.camara.fov * PI / 360) * this.camara.aspect);
    const vfov = this.camara.fov * PI / 180;
    const d = Math.max((tam * 0.62) / Math.tan(hfov / 2), (tam * 0.62) / Math.tan(vfov / 2));
    this.irA([c.x, c.y + d, c.z + d * 0.22], [c.x, c.y, c.z - 0.01], dur, [0, 0, -1]);
  }
  vistaQuirofanoGeneral(dur = 1.2) { this.irA([-2.1, 1.85, 2.5], [0.3, 1.0, 0.0], dur); }
  uvCampo(x, y) {
    const hit = this.rayo(x, y, [this.campo.mesh]);
    if (!hit || !hit.uv) return null;
    return { x: hit.uv.x * 1024, y: (1 - hit.uv.y) * 1024, p: hit.point };
  }
  // ───────── CREADOR ─────────
  construirCreador() {
    const e = this.nuevaEscena('creador', '#20262d');
    const fondo = lienzo(512, 512, (c, w, h) => { const g = c.createRadialGradient(w / 2, h * 0.45, 20, w / 2, h / 2, w * 0.7); g.addColorStop(0, '#5b6874'); g.addColorStop(1, '#151a1f'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    e.background = fondo;
    const suelo = pon(new T.Mesh(new T.CylinderGeometry(1.1, 1.15, 0.08, 64), std('#d6dadd', { roughness: 0.3, metalness: 0.1 })), e, 0, 0.04, 0); suelo.receiveShadow = true;
    pon(new T.Mesh(new T.TorusGeometry(1.1, 0.012, 8, 64), new T.MeshBasicMaterial({ color: '#59c3ff' })), e, 0, 0.085, 0, PI / 2, 0, 0);
    e.add(new T.HemisphereLight('#ffffff', '#3a3f45', 0.8));
    this.luzFoco(e, 1.5, 3.2, 2.2, 0, 1, 0, 60, true, PI / 6);
    this.luzFoco(e, -2.2, 2.0, -1.0, 0, 1.2, 0, 25, false, PI / 5, '#9fd4ff');
    const r = new T.PointLight('#fff', 6, 6, 2); r.position.set(-1, 1.6, 2.2); e.add(r);
    this.peana = pon(new T.Group(), e, 0, 0.08, 0);
    this.orbita = { ang: 0, vel: 0 };
    this.alActualizar.push((dt) => { if (this.actual === 'creador' && this.peana) this.peana.rotation.y += dt * (this.giroCreador ?? 0.25); });
    return e;
  }
  ponerDoctorCreador(ap) {
    if (this.docCreador) { this.quitar(this.docCreador); }
    const h = this.registrar(crearHumano(ap, ap.ropa));
    this.peana.add(h.raiz);
    h.ponerPose('depie');
    this.docCreador = h;
    return h;
  }
  vistaCreador(zoom = 'cuerpo', dur = 0.8) {
    const alt = (this.docCreador?.ap.altura || 1);
    if (zoom === 'cara') this.irA([0, 1.68 * alt, 0.75], [0, 1.64 * alt, 0], dur);
    else this.irA([0, 1.25, 3.4], [0, 0.95, 0], dur);
  }
}
