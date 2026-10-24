// EL MEJOR MÉDICO — voces en español (síntesis de voz del dispositivo) y sonidos generados.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let voces = [];
const FEM = /(monica|mónica|paulina|lucia|lucía|elena|laura|helena|conchita|marisol|esperanza|sabina|paloma|dalia|elvira|abril|ximena|hortensia|carmen|isabel|female|mujer|femenin|woman|es-es-x-eea|es-us-x-esc|es-es-x-eec)/i;
const MAS = /(jorge|diego|juan|pablo|alvaro|álvaro|enrique|carlos|raul|raúl|jose|josé|antonio|alonso|jaime|gonzalo|male|hombre|masculin|man\b|es-es-x-eed|es-es-x-eef|es-us-x-esd|es-us-x-esf)/i;

function cargarVoces() {
  if (!synth) return;
  const todas = synth.getVoices();
  voces = todas.filter(v => /^es([-_]|$)/i.test(v.lang));
  // primero las de España, luego las de mejor calidad (online/natural/neural)
  const calidad = v => (/natural|neural|online|premium|enhanced|google/i.test(v.name) ? 2 : 0) + (/es[-_]ES/i.test(v.lang) ? 3 : 0);
  voces.sort((a, b) => calidad(b) - calidad(a));
}
if (synth) { cargarVoces(); synth.onvoiceschanged = cargarVoces; }

function elegirVoz(genero, semilla = 0) {
  if (!voces.length) cargarVoces();
  if (!voces.length) return null;
  const re = genero === 'm' ? FEM : MAS;
  const del = voces.filter(v => re.test(v.name) || re.test(v.voiceURI || ''));
  const lista = del.length ? del : voces;
  return lista[semilla % lista.length];
}

export const Voz = {
  activa: true,
  hablando: false,
  quien: null,
  onCambio: null,
  _cola: Promise.resolve(),
  get disponible() { return !!synth && voces.length > 0; },
  get nombres() { return voces.map(v => `${v.name} (${v.lang})`); },
  callar() {
    if (synth) synth.cancel();
    this.hablando = false; this.quien = null;
    this.onCambio && this.onCambio(null);
  },
  // Habla un texto; resuelve al terminar. Las voces suelen cortarse en textos largos: se trocea en frases.
  hablar(texto, { genero = 'h', tono = 1, vel = 1, quien = null, semilla = 0 } = {}) {
    return new Promise(res => {
      const duracion = Math.max(1200, texto.length * 62 / vel);
      const fin = () => { if (this.quien === quien) { this.hablando = false; this.quien = null; this.onCambio && this.onCambio(null); } res(); };
      this.hablando = true; this.quien = quien; this.onCambio && this.onCambio(quien);
      if (!synth || !this.activa) { setTimeout(fin, duracion); return; }
      synth.cancel();
      const voz = elegirVoz(genero, semilla);
      // Si sólo hay una voz para todos, se diferencia a hombres y mujeres con el tono
      const unica = !voz || !(genero === 'm' ? FEM : MAS).test(voz.name);
      const frases = texto.match(/[^.!?¿¡]*[.!?]+["»]?|[^.!?]+$/g) || [texto];
      let i = 0, vigilante;
      const sig = () => {
        if (this.quien !== quien) return res();
        if (i >= frases.length) { clearTimeout(vigilante); return fin(); }
        const u = new SpeechSynthesisUtterance(frases[i++].trim());
        u.lang = voz ? voz.lang : 'es-ES';
        if (voz) u.voice = voz;
        u.pitch = Math.max(0.1, Math.min(2, tono * (unica ? (genero === 'm' ? 1.18 : 0.82) : 1)));
        u.rate = Math.max(0.6, Math.min(1.5, vel));
        u.volume = 1;
        u.onend = sig;
        u.onerror = sig;
        clearTimeout(vigilante);
        vigilante = setTimeout(sig, Math.max(4000, u.text.length * 120));
        synth.speak(u);
      };
      // Chrome necesita un respiro tras cancel()
      setTimeout(sig, 60);
    });
  },
};

// ───────────────────────── Sonidos ─────────────────────────
let ctx = null, master = null, ambiente = null;
function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
let ruidoBuf = null;
function ruido() {
  if (ruidoBuf) return ruidoBuf;
  const c = ac(); const n = c.sampleRate * 2;
  ruidoBuf = c.createBuffer(1, n, c.sampleRate);
  const d = ruidoBuf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return ruidoBuf;
}
function tono(f, dur, { tipo = 'sine', vol = 0.2, t0 = 0, ataque = 0.005, destino = null, glide = null } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + t0;
  const o = c.createOscillator(), g = c.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + ataque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(destino || master);
  o.start(t); o.stop(t + dur + 0.05);
}
function soplo(dur, { vol = 0.2, f = 800, q = 0.7, t0 = 0, tipo = 'bandpass', ataque = 0.3, destino = null } = {}) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + t0;
  const s = c.createBufferSource(); s.buffer = ruido(); s.loop = true;
  const fi = c.createBiquadFilter(); fi.type = tipo; fi.frequency.value = f; fi.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + ataque);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  s.connect(fi).connect(g).connect(destino || master);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

export const Sonido = {
  iniciar() { ac(); },
  clic() { tono(1400, 0.05, { tipo: 'triangle', vol: 0.08 }); },
  hoja() { soplo(0.25, { vol: 0.12, f: 3000, q: 0.5, ataque: 0.05 }); },
  exito() { [523, 659, 784, 1046].forEach((f, i) => tono(f, 0.35, { vol: 0.12, t0: i * 0.09, tipo: 'triangle' })); },
  fallo() { tono(220, 0.5, { tipo: 'sawtooth', vol: 0.08, glide: 110 }); },
  dinero() { [1318, 1760].forEach((f, i) => tono(f, 0.25, { vol: 0.1, t0: i * 0.08, tipo: 'square' })); },
  pitido(alto = false) { tono(alto ? 1100 : 880, 0.09, { vol: 0.07, tipo: 'sine' }); },
  alarma() { for (let i = 0; i < 3; i++) tono(960, 0.18, { vol: 0.12, t0: i * 0.25, tipo: 'square' }); },
  corte() { soplo(0.35, { vol: 0.15, f: 5000, q: 2, ataque: 0.02 }); },
  aspirar() { soplo(0.5, { vol: 0.18, f: 1200, q: 0.4, ataque: 0.05 }); },
  pinza() { tono(2600, 0.04, { tipo: 'square', vol: 0.06 }); tono(1900, 0.05, { tipo: 'square', vol: 0.05, t0: 0.05 }); },
  carga() { tono(300, 1.2, { tipo: 'sine', vol: 0.12, glide: 2800, ataque: 0.05 }); },
  descarga() { soplo(0.25, { vol: 0.5, f: 200, q: 0.3, ataque: 0.005, tipo: 'lowpass' }); tono(70, 0.3, { tipo: 'square', vol: 0.3 }); },
  puerta() { tono(90, 0.25, { tipo: 'sine', vol: 0.3 }); soplo(0.2, { vol: 0.1, f: 400, ataque: 0.01 }); },
  ay() { tono(420, 0.4, { tipo: 'sawtooth', vol: 0.05, glide: 300 }); },
  telefono() { for (let i = 0; i < 2; i++) { tono(440, 0.4, { vol: 0.08, t0: i * 0.5, tipo: 'square' }); tono(480, 0.4, { vol: 0.08, t0: i * 0.5, tipo: 'square' }); } },

  // Zumbido suave de hospital
  ambiente(on) {
    const c = ac(); if (!c) return;
    if (on && !ambiente) {
      const s = c.createBufferSource(); s.buffer = ruido(); s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
      const g = c.createGain(); g.gain.value = 0.035;
      const o = c.createOscillator(); o.frequency.value = 100; const og = c.createGain(); og.gain.value = 0.006;
      o.connect(og).connect(master);
      s.connect(f).connect(g).connect(master); s.start(); o.start();
      ambiente = { s, o };
    } else if (!on && ambiente) { ambiente.s.stop(); ambiente.o.stop(); ambiente = null; }
  },

  // Estetoscopio: devuelve una función para parar. tipo: normal | crepitantes | sibilancias | disminuido | corazon_*
  escuchar(tipo, fc = 75) {
    const c = ac(); if (!c) return () => {};
    const salida = c.createGain(); salida.gain.value = 1;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    salida.connect(lp).connect(master);
    let vivo = true; const timers = [];
    const prog = (fn, ms) => timers.push(setTimeout(() => vivo && fn(), ms));
    if (tipo.startsWith('corazon')) {
      const periodo = 60 / fc;
      const latido = () => {
        if (!vivo) return;
        const irreg = tipo === 'corazon_arritmia' ? 0.5 + Math.random() : 1;
        tono(55, 0.12, { vol: 0.9, destino: salida, ataque: 0.01 });
        tono(75, 0.1, { vol: 0.5, destino: salida, ataque: 0.01 });
        tono(65, 0.09, { vol: 0.65, destino: salida, t0: 0.3 * Math.min(1, periodo), ataque: 0.01 });
        if (tipo === 'corazon_soplo') soplo(0.25, { vol: 0.12, f: 350, q: 1.2, t0: 0.08, ataque: 0.08, destino: salida });
        prog(latido, periodo * 1000 * irreg);
      };
      latido();
    } else {
      const vol = tipo === 'disminuido' ? 0.05 : 0.22;
      const ciclo = () => {
        if (!vivo) return;
        soplo(1.6, { vol, f: 420, q: 0.6, ataque: 1.0, destino: salida });   // inspiración
        soplo(1.6, { vol: vol * 0.55, f: 300, q: 0.6, t0: 1.7, ataque: 0.25, destino: salida }); // espiración
        if (tipo === 'crepitantes') for (let i = 0; i < 14; i++) soplo(0.025, { vol: 0.5, f: 900 + Math.random() * 1200, q: 3, t0: 0.6 + Math.random() * 1.0, ataque: 0.004, destino: salida });
        if (tipo === 'sibilancias') { tono(480, 1.4, { tipo: 'sine', vol: 0.06, t0: 1.8, ataque: 0.3, destino: salida, glide: 420 }); tono(610, 1.2, { tipo: 'sine', vol: 0.04, t0: 1.9, ataque: 0.3, destino: salida, glide: 560 }); }
        prog(ciclo, 3800);
      };
      ciclo();
      // latido de fondo
      const fondo = () => { if (!vivo) return; tono(55, 0.1, { vol: 0.12, destino: salida }); prog(fondo, 60000 / fc); };
      fondo();
    }
    return () => { vivo = false; timers.forEach(clearTimeout); try { salida.gain.setTargetAtTime(0, c.currentTime, 0.05); setTimeout(() => salida.disconnect(), 400); } catch (e) {} };
  },
};
