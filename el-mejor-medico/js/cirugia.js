// EL MEJOR MÉDICO — minijuego de cirugía sobre el campo operatorio (lienzo pintado sobre el paciente en 3D).
import { Sonido } from './audio.js';

const TAM = 1024;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export const HERRAMIENTAS = {
  betadine: 'Antiséptico',
  bisturi: 'Bisturí',
  separador: 'Separador',
  pinzas: 'Pinzas',
  tijeras: 'Tijeras',
  aspirador: 'Aspirador',
  gasas: 'Gasas',
  portaagujas: 'Portaagujas',
  malla: 'Malla / placa',
};
export const EMERGENCIAS = {
  oxigeno: 'Subir oxígeno',
  anestesia: 'Más anestesia',
  atropina: 'Atropina',
  adrenalina: 'Adrenalina',
  transfusion: 'Transfusión',
  desfibrilador: 'Desfibrilador',
};
const TEXTO_PASO = {
  desinfectar: 'Desinfecta la zona con el antiséptico',
  incision: 'Haz la incisión siguiendo la línea marcada',
  separar: 'Coloca el separador en los dos bordes',
  pinzar: 'Pinza los vasos que sangran',
  extirpar: 'Corta siguiendo la línea discontinua',
  aspirar: 'Aspira la sangre del campo',
  reducir: 'Arrastra el tejido a su sitio',
  malla: 'Coloca la malla y fíjala en los puntos',
  suturar: 'Sutura la herida punto por punto',
};
const HERR_PASO = { desinfectar: ['betadine'], incision: ['bisturi'], separar: ['separador'], pinzar: ['pinzas'], extirpar: ['tijeras', 'bisturi'], aspirar: ['aspirador', 'gasas'], reducir: ['pinzas'], malla: ['malla'], suturar: ['portaagujas'] };
const COMPLICACIONES = {
  hemorragia: { n: 'HEMORRAGIA', ayuda: 'Pinza los vasos y aspira. Si la tensión baja de 70, transfunde.' },
  fv: { n: 'FIBRILACIÓN VENTRICULAR', ayuda: 'Desfibrilador: carga y descarga. Adrenalina ayuda.' },
  desaturacion: { n: 'BAJA LA SATURACIÓN', ayuda: 'Sube el oxígeno.' },
  bradicardia: { n: 'BRADICARDIA', ayuda: 'Pon atropina.' },
  despertar: { n: '¡EL PACIENTE SE MUEVE!', ayuda: 'Necesita más anestesia.' },
  alergia: { n: 'REACCIÓN ALÉRGICA', ayuda: 'Pon adrenalina.' },
};

export class Cirugia {
  constructor(mundo, cir, op = {}) {
    this.m = mundo; this.cir = cir; this.op = op;
    this.ctx = mundo.campo.ctx; this.tex = mundo.campo.tex;
    this.pasos = cir.pasos.slice();
    this.iPaso = 0;
    this.herr = null;
    this.estado = 100;
    this.t = 0; this.tPaso = 0;
    this.vasos = []; this.charcos = []; this.puntos = [];
    this.abierto = 0; this.objAbierto = 0;
    this.corte = []; this.cortado = 0; this.errores = 0; this.sumaDesv = 0; this.nMuestras = 0;
    this.betadine = null; this.cobertura = 0;
    this.organoFuera = false;
    this.malla = null; this.tornillos = [];
    this.puntadas = []; this.iPuntada = 0;
    this.comp = null; this.compHechas = 0; this.compResueltas = 0;
    this.oxigeno = false; this.carga = 0;
    this.herramientaMal = 0;
    this.terminado = false;
    this.temblor = op.temblor ?? 1;
    this.puntero = null; this.pulsado = false;
    this.cbs = { paso: () => {}, aviso: () => {}, fin: () => {}, comp: () => {} };
    this.geometria();
    // complicaciones programadas
    this.programa = [];
    const n = Math.min(3, Math.floor(op.riesgo || 0) + (Math.random() < (op.riesgo % 1) ? 1 : 0));
    const tipos = ['hemorragia', 'fv', 'desaturacion', 'bradicardia', 'alergia'];
    for (let i = 0; i < n; i++) this.programa.push({ paso: 1 + Math.floor(Math.random() * Math.max(1, this.pasos.length - 1)), tipo: tipos[Math.floor(Math.random() * tipos.length)], t: 2 + Math.random() * 5 });
    if (op.anestesiaMal) this.programa.push({ paso: 1, tipo: 'despertar', t: 1.5 }, { paso: Math.min(3, this.pasos.length - 1), tipo: 'despertar', t: 3 });
    if (op.anestesiaExcesiva) this.programa.push({ paso: 2, tipo: 'desaturacion', t: 2 });
    this.preparar();
  }
  on(evento, fn) { this.cbs[evento] = fn; return this; }
  get paso() { return this.pasos[this.iPaso]; }
  geometria() {
    const z = this.cir.zona;
    const L = { fid: [[420, 600], [640, 720]], hcd: [[360, 380], [640, 470]], torax_izq: [[330, 560], [700, 460]], ingle: [[380, 520], [650, 640]], cadera: [[400, 330], [470, 700]], antebrazo: [[330, 512], [700, 512]], muneca: [[320, 520], [700, 520]] }[z] || [[350, 512], [680, 512]];
    this.A = { x: L[0][0], y: L[0][1] }; this.B = { x: L[1][0], y: L[1][1] };
    this.C = lerp(this.A, this.B, 0.5);
    const dx = this.B.x - this.A.x, dy = this.B.y - this.A.y, len = Math.hypot(dx, dy);
    this.dir = { x: dx / len, y: dy / len }; this.nor = { x: -dy / len, y: dx / len }; this.len = len;
    const o = this.C, n = this.nor, d = this.dir;
    // recorrido de la extirpación alrededor del órgano
    const org = this.cir.organo;
    if (org === 'tumor') this.rutaExt = [{ x: o.x - d.x * 110 + n.x * 20, y: o.y - d.y * 110 + n.y * 20 }, { x: o.x + n.x * 95, y: o.y + n.y * 95 }, { x: o.x + d.x * 110 + n.x * 20, y: o.y + d.y * 110 + n.y * 20 }];
    else this.rutaExt = [{ x: o.x - d.x * 60 - n.x * 30, y: o.y - d.y * 60 - n.y * 30 }, { x: o.x + n.x * 10, y: o.y + n.y * 10 }, { x: o.x + d.x * 60 - n.x * 30, y: o.y + d.y * 60 - n.y * 30 }].reverse();
    this.rutaExt = densificar(this.rutaExt, 12);
  }
  preparar() {
    // piel con poros y paño alrededor
    const piel = document.createElement('canvas'); piel.width = piel.height = TAM; const c = piel.getContext('2d');
    c.fillStyle = '#1d6f6c'; c.fillRect(0, 0, TAM, TAM);
    for (let i = 0; i < 2500; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; c.fillRect(Math.random() * TAM, Math.random() * TAM, 3, 3); }
    const tono = this.op.piel || '#e2b394';
    c.save(); c.beginPath(); c.roundRect(150, 150, 724, 724, 40); c.clip();
    const g = c.createRadialGradient(512, 512, 50, 512, 512, 520); g.addColorStop(0, tono); g.addColorStop(1, sombrear(tono, -25));
    c.fillStyle = g; c.fillRect(0, 0, TAM, TAM);
    for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(90,40,30,${Math.random() * 0.06})`; c.beginPath(); c.arc(Math.random() * TAM, Math.random() * TAM, Math.random() * 2.2, 0, 7); c.fill(); }
    c.restore();
    // borde del paño
    c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 14; c.beginPath(); c.roundRect(150, 150, 724, 724, 40); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 3; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 60 + i * 15); c.lineTo(TAM, 70 + i * 15); c.stroke(); }
    this.piel = piel;
    this.capaBet = document.createElement('canvas'); this.capaBet.width = this.capaBet.height = TAM;
    if (this.cir.organo === 'herida') { this.corte = [this.A, this.B]; this.cortado = this.len; this.abierto = 0.75; this.charcos.push({ x: this.C.x, y: this.C.y + 30, r: 50 }, { x: this.C.x + 60, y: this.C.y + 50, r: 38 }); }
    this.empezarPaso();
    this.dibujar();
  }
  empezarPaso() {
    this.tPaso = 0;
    const p = this.paso;
    if (!p) return this.terminar(true);
    if (p === 'separar') this.asas = [{ x: this.C.x + this.nor.x * 60, y: this.C.y + this.nor.y * 60, ok: false }, { x: this.C.x - this.nor.x * 60, y: this.C.y - this.nor.y * 60, ok: false }];
    if (p === 'pinzar') for (let i = 0; i < 3; i++) this.nuevoVaso();
    if (p === 'extirpar') { this.ext = { s: 0, activo: false }; }
    if (p === 'aspirar' && this.charcos.length < 2) for (let i = 0; i < 3; i++) this.nuevoCharco();
    if (p === 'reducir') { this.obj = { x: this.C.x + this.nor.x * 120 + this.dir.x * 40, y: this.C.y + this.nor.y * 120 + this.dir.y * 40, ok: false }; this.objDest = { x: this.C.x - this.nor.x * 10, y: this.C.y - this.nor.y * 10 }; }
    if (p === 'malla') { this.malla = null; this.tornillos = [-1, 0, 1].map(k => ({ x: this.C.x + this.dir.x * 55 * k + this.nor.x * (k ? -18 : 22), y: this.C.y + this.dir.y * 55 * k + this.nor.y * (k ? -18 : 22), ok: false })); }
    if (p === 'suturar') { const n = 6; this.puntadas = []; for (let i = 0; i < n; i++) { const t = (i + 0.7) / (n + 0.4); const b = lerp(this.A, this.B, t); this.puntadas.push({ x: b.x, y: b.y, ok: false }); } this.iPuntada = 0; }
    if (p === 'incision') this.inc = { s: 0, activo: false };
    this.cbs.paso(TEXTO_PASO[p], this.iPaso, this.pasos.length, HERR_PASO[p]);
  }
  pasoHecho() {
    Sonido.exito();
    this.iPaso++;
    if (this.iPaso >= this.pasos.length) return this.terminar(true);
    this.empezarPaso();
  }
  nuevoVaso() {
    const t = 0.2 + Math.random() * 0.6, b = lerp(this.A, this.B, t), off = (Math.random() - 0.5) * 50 * Math.max(0.3, this.abierto);
    this.vasos.push({ x: b.x + this.nor.x * off, y: b.y + this.nor.y * off, ok: false, fase: Math.random() * 6 });
  }
  nuevoCharco(x, y) {
    const t = 0.2 + Math.random() * 0.6, b = lerp(this.A, this.B, t);
    this.charcos.push({ x: x ?? b.x + (Math.random() - 0.5) * 80, y: y ?? b.y + (Math.random() - 0.5) * 80, r: 22 + Math.random() * 25 });
  }

  // ───── entrada ─────
  ponerHerramienta(h) { this.herr = h; }
  tembloroso(p) {
    const k = this.temblor * (this.comp && this.comp.tipo === 'despertar' ? 2.5 : 1);
    const t = this.t;
    return { x: p.x + (Math.sin(t * 13.1) + Math.sin(t * 7.7 + 1) * 0.6) * 5 * k, y: p.y + (Math.sin(t * 11.3 + 2) + Math.sin(t * 5.9) * 0.6) * 5 * k };
  }
  abajo(p) { this.pulsado = true; this.puntero = this.tembloroso(p); this.accion(this.puntero, true); }
  mover(p) { this.puntero = this.tembloroso(p); if (this.pulsado) this.accion(this.puntero, false); }
  arriba() { this.pulsado = false; if (this.inc) this.inc.activo = false; if (this.ext) this.ext.activo = false; if (this.arrastre) this.arrastre = false; }

  accion(p, inicio) {
    if (this.terminado || !p) return;
    const paso = this.paso, h = this.herr;
    if (!h) { if (inicio) this.cbs.aviso('Elige un instrumento de la bandeja'); return; }
    // pinzas y aspirador sirven siempre para controlar sangrados
    if (h === 'pinzas' && inicio) { const v = this.vasos.find(v => !v.ok && dist(v, p) < 38); if (v) { v.ok = true; Sonido.pinza(); this.revisarPinzado(); return; } }
    if ((h === 'aspirador' || h === 'gasas') && this.charcos.length) { this.aspirando = true; }
    if (!HERR_PASO[paso].includes(h)) {
      if (inicio && !(h === 'pinzas' && this.vasos.some(v => !v.ok)) && !(h === 'aspirador' || h === 'gasas')) { this.herramientaMal++; this.cbs.aviso(`Ahora no toca el ${HERRAMIENTAS[h].toLowerCase()}`); Sonido.fallo(); }
      return;
    }
    if (paso === 'desinfectar') {
      const c = this.capaBet.getContext('2d'); const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, 55); g.addColorStop(0, 'rgba(150,60,10,0.5)'); g.addColorStop(1, 'rgba(150,60,10,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 55, 0, 7); c.fill();
      this.medirCobertura();
    } else if (paso === 'incision') this.trazar(this.inc, [this.A, this.B], p, inicio, true);
    else if (paso === 'extirpar') this.trazar(this.ext, this.rutaExt, p, inicio, false);
    else if (paso === 'separar' && inicio) { const a = this.asas.find(a => !a.ok && dist(a, p) < 50); if (a) { a.ok = true; Sonido.pinza(); if (this.asas.every(a => a.ok)) { this.objAbierto = 1; setTimeout(() => this.pasoHecho(), 500); } } }
    else if (paso === 'reducir') {
      if (inicio && dist(this.obj, p) < 60) this.arrastre = true;
      if (this.arrastre) { this.obj.x = p.x; this.obj.y = p.y; if (dist(this.obj, this.objDest) < 28) { this.obj = { ...this.objDest, ok: true }; this.arrastre = false; this.pasoHecho(); } }
    } else if (paso === 'malla' && inicio) {
      if (!this.malla) { if (dist(p, this.C) < 80) { this.malla = { ...this.C }; Sonido.clic(); } else this.cbs.aviso('Coloca la malla sobre el defecto'); }
      else { const t = this.tornillos.find(t => !t.ok && dist(t, p) < 34); if (t) { t.ok = true; Sonido.pinza(); if (this.tornillos.every(t => t.ok)) this.pasoHecho(); } }
    } else if (paso === 'suturar' && inicio) {
      const s = this.puntadas[this.iPuntada];
      if (s && dist(s, p) < 34) { s.ok = true; this.iPuntada++; Sonido.pinza(); this.abierto = Math.max(0, this.abierto * (1 - 1 / (this.puntadas.length - this.iPuntada + 1))); this.objAbierto = this.abierto; if (this.iPuntada >= this.puntadas.length) { this.abierto = this.objAbierto = 0; this.pasoHecho(); } }
      else if (this.puntadas.some(q => !q.ok && dist(q, p) < 34)) { this.cbs.aviso('Sigue el orden de los puntos'); this.errores += 0.5; }
    }
  }
  trazar(est, ruta, p, inicio, esIncision) {
    const L = longitud(ruta);
    const actual = puntoEn(ruta, est.s);
    if (inicio) { if (dist(p, actual) < 55) { est.activo = true; Sonido.corte(); } else { this.cbs.aviso('Empieza en el punto marcado'); return; } }
    if (!est.activo) return;
    // proyección sobre la ruta cerca del avance actual
    let mejor = { d: 1e9, s: est.s };
    for (let s = Math.max(0, est.s - 10); s <= Math.min(L, est.s + 70); s += 2) { const q = puntoEn(ruta, s); const d = dist(q, p); if (d < mejor.d) mejor = { d, s }; }
    this.sumaDesv += mejor.d; this.nMuestras++;
    if (mejor.d > 60) {
      est.activo = false; this.errores++; this.estado -= 4; Sonido.fallo();
      this.cbs.aviso('¡Te has salido de la línea! Ha empezado a sangrar');
      this.vasos.push({ x: p.x, y: p.y, ok: false, fase: 0 }); this.nuevoCharco(p.x, p.y);
      return;
    }
    if (mejor.s > est.s) {
      est.s = mejor.s;
      if (esIncision) { this.corte.push({ x: p.x, y: p.y }); this.cortado = est.s; this.abierto = Math.min(0.35, est.s / L * 0.35); this.objAbierto = this.abierto; }
      else this.trazoExt = (this.trazoExt || []).concat([{ x: p.x, y: p.y }]);
      if (Math.random() < 0.12) Sonido.corte();
    }
    if (est.s >= L - 10) {
      est.activo = false;
      if (esIncision) { this.corte = [this.A, ...this.corte.slice(1), this.B]; this.vasos.push({ x: this.C.x + 10, y: this.C.y - 6, ok: false, fase: 1 }); }
      else this.organoFuera = true;
      this.pasoHecho();
    }
  }
  medirCobertura() {
    const c = this.capaBet.getContext('2d');
    const r = 220, n = 14; let tot = 0, ok = 0;
    const img = c.getImageData(this.C.x - r, this.C.y - r, r * 2, r * 2).data;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = (i + 0.5) / n * 2 * r, y = (j + 0.5) / n * 2 * r;
      if (Math.hypot(x - r, y - r) > r) continue; tot++;
      if (img[((y | 0) * r * 2 + (x | 0)) * 4 + 3] > 40) ok++;
    }
    this.cobertura = ok / tot;
    if (this.cobertura > 0.8 && this.paso === 'desinfectar') { this.cobertura = 1; this.pasoHecho(); }
  }
  revisarPinzado() {
    if (this.paso === 'pinzar' && this.vasos.every(v => v.ok)) this.pasoHecho();
    if (this.comp && this.comp.tipo === 'hemorragia' && this.vasos.every(v => v.ok)) this.resolver();
  }
  emergencia(a) {
    const c = this.comp;
    if (a === 'desfibrilador') {
      if (this.carga < 1) { this.carga = 0.001; Sonido.carga(); this.cbs.aviso('Cargando... ¡pulsa otra vez para descargar!'); return; }
      Sonido.descarga(); this.carga = 0;
      this.m.campo.mesh.position.y += 0.01; setTimeout(() => this.m.campo.mesh.position.y -= 0.01, 120);
      if (c && c.tipo === 'fv' && Math.random() < (c.adrenalina ? 0.85 : 0.6)) { this.resolver('Ritmo recuperado'); }
      else if (!c || c.tipo !== 'fv') { this.estado -= 15; this.cbs.aviso('¡Descarga sin necesidad! Has dañado al paciente'); }
      else this.cbs.aviso('Sigue en fibrilación. Vuelve a cargar.');
      return;
    }
    Sonido.clic();
    const ok = { oxigeno: 'desaturacion', atropina: 'bradicardia', anestesia: 'despertar', adrenalina: 'alergia' }[a];
    if (a === 'oxigeno') this.oxigeno = true;
    if (a === 'transfusion') { this.estado = Math.min(100, this.estado + 18); this.transfusiones = (this.transfusiones || 0) + 1; this.cbs.aviso('Transfusión en marcha'); if (c && c.tipo === 'hemorragia') c.transfundido = true; return; }
    if (a === 'adrenalina' && c && c.tipo === 'fv') { c.adrenalina = true; this.cbs.aviso('Adrenalina puesta. Ahora, desfibrila.'); return; }
    if (c && c.tipo === ok) return this.resolver();
    if (a === 'anestesia') { this.anestesiaExtra = (this.anestesiaExtra || 0) + 1; if (this.anestesiaExtra > 2) { this.estado -= 8; this.cbs.aviso('Demasiada anestesia: le baja la tensión'); } else this.cbs.aviso('Anestesia ajustada'); return; }
    if (a === 'atropina' || a === 'adrenalina') { this.estado -= 6; this.cbs.aviso('Medicación innecesaria: le ha disparado el pulso'); }
  }
  lanzar(tipo) {
    if (this.comp) return;
    this.comp = { tipo, t: 0 }; this.compHechas++;
    if (tipo === 'hemorragia') { for (let i = 0; i < 2; i++) this.nuevoVaso(); for (let i = 0; i < 2; i++) this.nuevoCharco(); }
    if (tipo === 'desaturacion') this.oxigeno = false;
    Sonido.alarma();
    this.cbs.comp(COMPLICACIONES[tipo]);
  }
  resolver(texto) { if (!this.comp) return; this.compResueltas++; this.comp = null; Sonido.exito(); this.cbs.comp(null); this.cbs.aviso(texto || 'Complicación controlada'); }

  // ───── simulación ─────
  vitales() {
    const e = Math.max(0, this.estado); const c = this.comp;
    let fc = 70 + (100 - e) * 0.55, tas = 122 - (100 - e) * 0.75, tad = 76 - (100 - e) * 0.4, sat = 99 - (100 - e) * 0.12;
    let ritmo = 'normal';
    if (c) {
      if (c.tipo === 'fv') { ritmo = 'fv'; fc = 0; tas = 40; tad = 20; }
      if (c.tipo === 'bradicardia') fc = 36 + Math.sin(this.t) * 2;
      if (c.tipo === 'desaturacion') sat = Math.max(72, 95 - c.t * 2);
      if (c.tipo === 'despertar') fc += 30;
      if (c.tipo === 'alergia') { tas -= 35; sat -= 6; fc += 25; }
      if (c.tipo === 'hemorragia') { tas -= 15 + c.t * 1.5; fc += 20; }
    }
    if (e <= 0) { ritmo = 'asistolia'; fc = 0; tas = 0; tad = 0; sat = 0; }
    return { fc: Math.max(0, fc), tas: Math.max(0, tas), tad: Math.max(0, tad), sat: Math.max(0, Math.min(100, sat)), ritmo, estado: e };
  }
  actualizar(dt) {
    if (this.terminado) return;
    this.t += dt; this.tPaso += dt;
    if (this.carga > 0 && this.carga < 1) this.carga = Math.min(1, this.carga + dt / 1.2);
    // programa de complicaciones
    for (const pr of this.programa) if (!pr.hecho && pr.paso <= this.iPaso && (pr.t -= dt) <= 0 && !this.comp) { pr.hecho = true; this.lanzar(pr.tipo); }
    const c = this.comp;
    let dren = 0;
    const abiertos = this.vasos.filter(v => !v.ok).length;
    dren += abiertos * 0.6;
    if (abiertos && Math.random() < dt * abiertos * 0.7) { const v = this.vasos.find(v => !v.ok); this.nuevoCharco(v.x + (Math.random() - 0.5) * 50, v.y + (Math.random() - 0.5) * 50); }
    const sangre = this.charcos.reduce((s, q) => s + q.r * q.r, 0) / 2500;
    dren += Math.max(0, sangre - 3) * 0.15;
    if (c) {
      c.t += dt;
      dren += { hemorragia: c.transfundido ? 0.6 : 1.6, fv: 4.5, desaturacion: 1.2 + c.t * 0.05, bradicardia: 1.0, despertar: 0.8, alergia: 2.0 }[c.tipo];
      if (c.tipo === 'despertar' && Math.random() < dt * 2) { this.m.campo.mesh.position.x += (Math.random() - 0.5) * 0.004; Sonido.ay(); }
      if (Math.random() < dt * 0.8) Sonido.alarma();
    } else if (!abiertos) this.estado = Math.min(100, this.estado + dt * 0.4);
    this.estado -= dren * dt;
    if (this.estado <= 0) { this.estado = 0; return this.terminar(false); }
    // aspirado
    if (this.aspirando && this.pulsado && this.puntero) {
      const vel = this.herr === 'aspirador' ? 70 : 32;
      for (const q of this.charcos) if (dist(q, this.puntero) < q.r + 25) q.r -= vel * dt;
      this.charcos = this.charcos.filter(q => q.r > 6);
      if (Math.random() < dt * 4) Sonido.aspirar();
      if (this.paso === 'aspirar' && this.charcos.length === 0) { this.aspirando = false; this.pasoHecho(); }
    } else this.aspirando = false;
    this.abierto += (this.objAbierto - this.abierto) * Math.min(1, dt * 3);
    // latido en el monitor
    const v = this.vitales();
    this._beat = (this._beat || 0) + dt * v.fc / 60;
    if (this._beat >= 1) { this._beat = 0; if (v.ritmo !== 'fv' && v.fc > 0) Sonido.pitido(v.sat < 90); }
    this.dibujar();
  }
  terminar(exito) {
    if (this.terminado) return; this.terminado = true;
    const precision = this.nMuestras ? Math.max(0, 1 - this.sumaDesv / this.nMuestras / 40) : 0.8;
    let punt = 40 + precision * 30 + this.estado * 0.3 - this.errores * 6 - this.herramientaMal * 2 - Math.max(0, this.t - 150) * 0.05 + this.compResueltas * 4;
    if (!exito) punt = 0;
    this.dibujar();
    this.cbs.fin({ exito, muerte: !exito, precision, estado: this.estado, tiempo: this.t, errores: this.errores, complicaciones: this.compHechas, resueltas: this.compResueltas, puntuacion: Math.round(Math.max(0, Math.min(100, punt))) });
  }

  // ───── dibujo ─────
  dibujar() {
    const c = this.ctx;
    c.drawImage(this.piel, 0, 0);
    c.drawImage(this.capaBet, 0, 0);
    const t = this.t;
    // línea de rotulador
    if (this.cir.organo !== 'herida') {
      c.save(); c.setLineDash([16, 12]); c.strokeStyle = 'rgba(110,40,160,0.85)'; c.lineWidth = 6; c.beginPath(); c.moveTo(this.A.x, this.A.y); c.lineTo(this.B.x, this.B.y); c.stroke(); c.restore();
    }
    // herida abierta
    if (this.corte.length > 1 || this.abierto > 0.01) this.dibujarHerida(c);
    // charcos de sangre
    for (const q of this.charcos) { const g = c.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r); g.addColorStop(0, 'rgba(110,0,8,0.95)'); g.addColorStop(0.7, 'rgba(150,10,15,0.85)'); g.addColorStop(1, 'rgba(150,10,15,0)'); c.fillStyle = g; c.beginPath(); c.arc(q.x, q.y, q.r, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.ellipse(q.x - q.r * 0.3, q.y - q.r * 0.35, q.r * 0.25, q.r * 0.12, -0.5, 0, 7); c.fill(); }
    // vasos
    for (const v of this.vasos) {
      if (v.ok) { dibujarPinza(c, v.x, v.y); continue; }
      const k = 0.5 + 0.5 * Math.sin(t * 9 + v.fase);
      c.fillStyle = `rgba(200,0,20,${0.6 + k * 0.4})`; c.beginPath(); c.arc(v.x, v.y, 9 + k * 7, 0, 7); c.fill();
      for (let i = 0; i < 3; i++) { const a = v.fase + i * 2.1 + t * 2; c.fillStyle = 'rgba(180,0,15,0.7)'; c.beginPath(); c.arc(v.x + Math.cos(a) * (12 + k * 18), v.y + Math.sin(a) * (12 + k * 18), 4, 0, 7); c.fill(); }
      anillo(c, v.x, v.y, 30 + k * 6, 'rgba(255,255,255,0.8)');
    }
    const p = this.paso;
    // indicaciones del paso
    if (p === 'desinfectar') { c.save(); c.setLineDash([10, 10]); c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 4; c.beginPath(); c.arc(this.C.x, this.C.y, 220, 0, 7); c.stroke(); c.restore(); }
    if (p === 'incision' && this.inc) { const q = puntoEn([this.A, this.B], this.inc.s); anillo(c, q.x, q.y, 26 + Math.sin(t * 6) * 4, '#ffffff'); flecha(c, q, this.B); }
    if (p === 'extirpar' && this.ext && !this.organoFuera) {
      c.save(); c.setLineDash([12, 10]); c.strokeStyle = '#ffffff'; c.lineWidth = 4; c.beginPath(); this.rutaExt.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke(); c.restore();
      const q = puntoEn(this.rutaExt, this.ext.s); anillo(c, q.x, q.y, 24 + Math.sin(t * 6) * 4, '#ffe14d');
      if (this.trazoExt) { c.strokeStyle = '#5a0008'; c.lineWidth = 5; c.beginPath(); this.trazoExt.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke(); }
    }
    if (p === 'separar' && this.asas) for (const a of this.asas) a.ok ? dibujarSeparador(c, a, this.C) : anillo(c, a.x, a.y, 30 + Math.sin(t * 6) * 4, '#ffffff');
    if (this.objAbierto >= 1 && p !== 'separar' && p !== 'suturar' && this.asas) for (const a of this.asas) dibujarSeparador(c, a, this.C);
    if (p === 'reducir' && this.obj) { c.fillStyle = this.cir.organo === 'hueso' ? '#efe6d2' : '#f2d27a'; c.beginPath(); c.ellipse(this.obj.x, this.obj.y, 46, 32, 0.3, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 3; c.stroke(); c.save(); c.setLineDash([8, 8]); anillo(c, this.objDest.x, this.objDest.y, 40, '#ffffff'); c.restore(); }
    if (p === 'malla' || (this.malla && this.iPaso > this.pasos.indexOf('malla'))) {
      if (this.malla) { c.save(); c.globalAlpha = 0.85; c.strokeStyle = this.cir.organo === 'hueso' ? '#b8c2cc' : '#e9f2f7'; c.lineWidth = this.cir.organo === 'hueso' ? 18 : 2; if (this.cir.organo === 'hueso') { c.beginPath(); c.moveTo(this.C.x - this.dir.x * 80, this.C.y - this.dir.y * 80); c.lineTo(this.C.x + this.dir.x * 80, this.C.y + this.dir.y * 80); c.stroke(); } else { for (let i = -60; i <= 60; i += 10) { c.beginPath(); c.moveTo(this.C.x + i, this.C.y - 60); c.lineTo(this.C.x + i, this.C.y + 60); c.moveTo(this.C.x - 60, this.C.y + i); c.lineTo(this.C.x + 60, this.C.y + i); c.stroke(); } } c.restore(); }
      else if (p === 'malla') anillo(c, this.C.x, this.C.y, 70 + Math.sin(t * 5) * 5, '#ffffff');
      for (const tr of this.tornillos) tr.ok ? (c.fillStyle = '#c9d2da', c.beginPath(), c.arc(tr.x, tr.y, 9, 0, 7), c.fill(), c.strokeStyle = '#555', c.lineWidth = 2, c.stroke()) : (this.malla && anillo(c, tr.x, tr.y, 20 + Math.sin(t * 6) * 3, '#ffe14d'));
    }
    if (this.puntadas.length) {
      for (let i = 0; i < this.puntadas.length; i++) {
        const s = this.puntadas[i];
        if (s.ok) { c.strokeStyle = '#1b2a6b'; c.lineWidth = 4; const n = this.nor; c.beginPath(); c.moveTo(s.x + n.x * 22 - this.dir.x * 8, s.y + n.y * 22 - this.dir.y * 8); c.lineTo(s.x - n.x * 22 + this.dir.x * 8, s.y - n.y * 22 + this.dir.y * 8); c.moveTo(s.x + n.x * 22 + this.dir.x * 8, s.y + n.y * 22 + this.dir.y * 8); c.lineTo(s.x - n.x * 22 - this.dir.x * 8, s.y - n.y * 22 - this.dir.y * 8); c.stroke(); }
        else if (i === this.iPuntada && p === 'suturar') { anillo(c, s.x, s.y, 22 + Math.sin(t * 6) * 4, '#ffe14d'); c.fillStyle = '#ffe14d'; c.font = 'bold 26px sans-serif'; c.fillText(String(i + 1), s.x + 26, s.y - 22); }
        else if (p === 'suturar') { c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(s.x, s.y, 6, 0, 7); c.fill(); }
      }
    }
    // instrumento en la mano
    if (this.puntero && this.herr) dibujarInstrumento(c, this.herr, this.puntero, this.pulsado);
    this.tex.needsUpdate = true;
  }
  dibujarHerida(c) {
    const ab = this.abierto;
    const ruta = this.corte.length > 1 ? this.corte : [this.A, this.A];
    const ancho = 8 + ab * 120;
    c.save();
    c.lineCap = 'round'; c.lineJoin = 'round';
    const traza = (w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); ruta.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke(); };
    traza(ancho + 18, 'rgba(160,40,40,0.35)');
    traza(ancho + 6, '#e9c879');
    traza(ancho, '#8a1018');
    traza(Math.max(2, ancho * 0.6), '#b8262c');
    // interior: tejido y órgano
    if (ab > 0.25) {
      c.save(); c.strokeStyle = 'rgba(0,0,0,0)'; c.beginPath(); c.lineWidth = ancho; ruta.forEach((q, i) => i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y));
      // recorte aproximado: elipse a lo largo del corte
      c.restore();
      c.save(); c.translate(this.C.x, this.C.y); c.rotate(Math.atan2(this.dir.y, this.dir.x));
      c.beginPath(); c.ellipse(0, 0, this.len / 2, ancho / 2, 0, 0, 7); c.clip();
      const g = c.createLinearGradient(0, -ancho / 2, 0, ancho / 2); g.addColorStop(0, '#6d0a10'); g.addColorStop(0.5, '#c2414a'); g.addColorStop(1, '#6d0a10'); c.fillStyle = g; c.fillRect(-this.len / 2, -ancho / 2, this.len, ancho);
      for (let i = 0; i < 40; i++) { c.strokeStyle = 'rgba(240,150,150,0.25)'; c.lineWidth = 2; c.beginPath(); const x = (Math.sin(i * 12.9) * 0.5) * this.len; c.moveTo(x, -ancho / 2); c.quadraticCurveTo(x + 20, 0, x - 10, ancho / 2); c.stroke(); }
      if (!this.organoFuera) dibujarOrgano(c, this.cir.organo, ab, this.t);
      c.restore();
    }
    c.restore();
  }
}

function densificar(r, paso) { const out = [r[0]]; for (let i = 1; i < r.length; i++) { const a = r[i - 1], b = r[i], n = Math.ceil(dist(a, b) / paso); for (let k = 1; k <= n; k++) out.push(lerp(a, b, k / n)); } return out; }
function longitud(r) { let L = 0; for (let i = 1; i < r.length; i++) L += dist(r[i - 1], r[i]); return L; }
function puntoEn(r, s) { for (let i = 1; i < r.length; i++) { const d = dist(r[i - 1], r[i]); if (s <= d) return lerp(r[i - 1], r[i], d ? s / d : 0); s -= d; } return r[r.length - 1]; }
function anillo(c, x, y, r, col) { c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); }
function flecha(c, a, b) { const d = Math.atan2(b.y - a.y, b.x - a.x); c.fillStyle = 'rgba(255,255,255,0.9)'; c.save(); c.translate(a.x + Math.cos(d) * 50, a.y + Math.sin(d) * 50); c.rotate(d); c.beginPath(); c.moveTo(14, 0); c.lineTo(-8, -10); c.lineTo(-8, 10); c.fill(); c.restore(); }
function sombrear(hex, k) { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, v + k)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function dibujarPinza(c, x, y) { c.save(); c.translate(x, y); c.rotate(-0.7); c.fillStyle = '#d9dee3'; c.strokeStyle = '#6b737a'; c.lineWidth = 2; c.beginPath(); c.roundRect(-4, -60, 8, 62, 3); c.fill(); c.stroke(); c.beginPath(); c.roundRect(6, -60, 8, 60, 3); c.fill(); c.stroke(); c.beginPath(); c.arc(-4, -72, 9, 0, 7); c.arc(14, -72, 9, 0, 7); c.stroke(); c.restore(); }
function dibujarSeparador(c, a, centro) { c.save(); c.strokeStyle = '#c7cdd3'; c.lineWidth = 14; c.lineCap = 'round'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(a.x + (a.x - centro.x) * 1.8, a.y + (a.y - centro.y) * 1.8); c.stroke(); c.strokeStyle = '#8b939a'; c.lineWidth = 3; c.stroke(); c.restore(); }
function dibujarOrgano(c, org, ab, t) {
  const lat = 1 + Math.sin(t * 6) * 0.02;
  if (org === 'apendice') { c.fillStyle = '#d4545a'; c.beginPath(); c.ellipse(10, 6, 70 * lat, 20, 0.25, 0, 7); c.fill(); c.fillStyle = 'rgba(255,240,200,0.35)'; c.beginPath(); c.ellipse(30, 2, 25, 8, 0.25, 0, 7); c.fill(); }
  if (org === 'vesicula') { c.fillStyle = '#4f8a52'; c.beginPath(); c.ellipse(0, 0, 80, 32 * lat, -0.1, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,220,0.5)'; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-25 + i * 22, 6, 7, 0, 7); c.fill(); } }
  if (org === 'tumor') { c.fillStyle = '#e8a3a8'; c.fillRect(-200, -80, 400, 160); c.fillStyle = '#bfb6ae'; c.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = 38 + Math.sin(i * 3.1) * 9; c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.8 + 5); } c.fill(); }
  if (org === 'hernia') { c.fillStyle = '#f0cf72'; c.beginPath(); c.ellipse(0, 0, 60, 28, 0, 0, 7); c.fill(); }
  if (org === 'hueso') { c.fillStyle = '#efe6d2'; c.fillRect(-150, -20, 140, 40); c.fillRect(10, -16, 140, 40); c.fillStyle = '#7a1a1a'; c.fillRect(-10, -22, 20, 46); }
}
function dibujarInstrumento(c, h, p, pulsado) {
  c.save(); c.translate(p.x, p.y);
  c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = pulsado ? 6 : 18; c.shadowOffsetX = pulsado ? 4 : 14; c.shadowOffsetY = pulsado ? 6 : 20;
  c.rotate(-0.75);
  const metal = (x, y, w, h2, r = 3) => { const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#9aa3ab'); g.addColorStop(0.5, '#f4f7f9'); g.addColorStop(1, '#8b939a'); c.fillStyle = g; c.beginPath(); c.roundRect(x, y, w, h2, r); c.fill(); };
  if (h === 'bisturi') { metal(-5, 30, 10, 140); c.fillStyle = '#dfe5ea'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(12, 12, 6, 32); c.lineTo(-5, 32); c.closePath(); c.fill(); }
  else if (h === 'pinzas' || h === 'tijeras' || h === 'portaagujas') { metal(-9, 0, 6, 120); metal(3, 0, 6, 120); c.strokeStyle = '#9aa3ab'; c.lineWidth = 5; c.beginPath(); c.arc(-10, 135, 12, 0, 7); c.arc(12, 135, 12, 0, 7); c.stroke(); if (h === 'portaagujas') { c.strokeStyle = '#555'; c.lineWidth = 2; c.beginPath(); c.arc(0, -4, 10, 0, Math.PI); c.stroke(); } }
  else if (h === 'aspirador') { metal(-6, 0, 12, 150, 6); c.fillStyle = '#e8eef2'; c.fillRect(-12, 150, 24, 60); }
  else if (h === 'separador') { metal(-6, 0, 12, 150); metal(-20, -6, 40, 12); }
  else if (h === 'betadine') { c.fillStyle = '#f2f2f2'; c.beginPath(); c.ellipse(0, 0, 22, 16, 0, 0, 7); c.fill(); c.fillStyle = '#9b4b12'; c.beginPath(); c.ellipse(0, 0, 18, 12, 0, 0, 7); c.fill(); metal(-4, 14, 8, 130); }
  else if (h === 'gasas') { c.fillStyle = '#ffffff'; c.fillRect(-30, -30, 60, 60); c.strokeStyle = '#ddd'; for (let i = -30; i < 30; i += 8) { c.beginPath(); c.moveTo(i, -30); c.lineTo(i, 30); c.stroke(); } }
  else if (h === 'malla') { c.strokeStyle = '#e9f2f7'; c.lineWidth = 2; for (let i = -30; i <= 30; i += 10) { c.beginPath(); c.moveTo(i, -30); c.lineTo(i, 30); c.moveTo(-30, i); c.lineTo(30, i); c.stroke(); } }
  c.restore();
}
