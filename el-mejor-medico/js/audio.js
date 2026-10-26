// EL MEJOR MÉDICO — voces en español (síntesis de voz del dispositivo) y sonidos generados.

let voces = [];
// En la aplicación de Android, el WebView no trae voces: se usan las del sistema (VozNativaPlugin.kt).
// Se imita la interfaz de speechSynthesis para que el resto del código sea el mismo.
const vozNativa = typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins?.VozNativa : null;
let nativas = [];
const synthNativo = vozNativa && {
  getVoices: () => nativas,
  cancel: () => { vozNativa.parar().catch(() => {}); },
  speak(u) {
    const id = 'u' + Math.random().toString(36).slice(2);
    let escucha = null;
    // según la versión de Capacitor, addListener devuelve el oyente o una promesa del oyente
    Promise.resolve(vozNativa.addListener('palabra', (d) => { if (d.id === id) u.onboundary && u.onboundary({ name: 'word', charLength: d.largo }); })).then(h => { escucha = h; });
    vozNativa.hablar({ texto: u.text, voz: u.voice?.name || null, tono: u.pitch, vel: u.rate, id })
      .then(() => u.onend && u.onend(), () => u.onerror && u.onerror())
      .finally(() => escucha?.remove());
  },
};
if (vozNativa) vozNativa.voces().then(r => {
  // sólo voces instaladas en el móvil (sin Internet); las de red, únicamente si no hay ninguna
  const todas = (r.voces || []).map(v => ({ ...v, voiceURI: v.name }));
  const locales = todas.filter(v => !v.red && v.instalada);
  nativas = locales.length ? locales : todas;
  cargarVoces(); synthNativo.onvoiceschanged?.();
}).catch(() => {});
const synth = synthNativo || (typeof window !== 'undefined' ? window.speechSynthesis : null);
const FEM = /(monica|mónica|paulina|lucia|lucía|elena|laura|helena|conchita|marisol|esperanza|sabina|paloma|dalia|elvira|abril|ximena|hortensia|carmen|isabel|female|mujer|femenin|woman|es-es-x-eea|es-us-x-esc|es-es-x-eec)/i;
const MAS = /(jorge|diego|juan|pablo|alvaro|álvaro|enrique|carlos|raul|raúl|jose|josé|antonio|alonso|jaime|gonzalo|male|hombre|masculin|man\b|es-es-x-eed|es-es-x-eef|es-us-x-esd|es-us-x-esf)/i;

function cargarVoces() {
  if (!synth) return;
  const todas = synth.getVoices();
  // sólo español de España; las de otros países únicamente si el dispositivo no tiene ninguna de España
  const espana = todas.filter(v => /^es[-_]ES/i.test(v.lang));
  voces = espana.length ? espana : todas.filter(v => /^es([-_]|$)/i.test(v.lang));
  // primero las de mejor calidad (online/natural/neural); el nombre deja el orden estable entre sesiones
  const calidad = v => (/natural|neural|online|premium|enhanced|google/i.test(v.name) ? 2 : 0);
  voces.sort((a, b) => calidad(b) - calidad(a) || a.name.localeCompare(b.name));
}
if (synth) { cargarVoces(); synth.onvoiceschanged = cargarVoces; }

const generoVoz = (v) => FEM.test(v.name) || FEM.test(v.voiceURI || '') ? 'm' : MAS.test(v.name) || MAS.test(v.voiceURI || '') ? 'h' : null;
function elegirVoz(genero, semilla = 0) {
  if (!voces.length) cargarVoces();
  if (!voces.length) return null;
  const del = voces.filter(v => generoVoz(v) === genero);
  const lista = del.length ? del : voces;
  return lista[Math.abs(semilla) % lista.length];
}

// ───────────────────────── Perfiles de voz por edad ─────────────────────────
// La síntesis del dispositivo no trae voces infantiles ni de ancianos: cada grupo de edad usa la voz
// (masculina o femenina) que mejor encaja y le aplica su propio tono y ritmo. Cada personaje recibe
// además una variación estable sacada de su semilla, para que no suenen todos iguales.
export const GRUPOS_VOZ = [
  { id: 'bebe', n: 'Bebé', de: 0, a: 2.99, h: { voz: 'm', tono: 1.95, vel: 1.0 }, m: { voz: 'm', tono: 1.95, vel: 1.0 } },
  { id: 'infantil', n: 'Niño o niña de 3 a 6 años', de: 3, a: 6.99, h: { voz: 'm', tono: 1.62, vel: 1.1 }, m: { voz: 'm', tono: 1.78, vel: 1.08 } },
  { id: 'escolar', n: 'Niño o niña de 7 a 12 años', de: 7, a: 12.99, h: { voz: 'm', tono: 1.42, vel: 1.08 }, m: { voz: 'm', tono: 1.55, vel: 1.06 } },
  { id: 'adolescente', n: 'Adolescente de 13 a 17 años', de: 13, a: 17.99, h: { voz: 'h', tono: 1.14, vel: 1.08 }, m: { voz: 'm', tono: 1.18, vel: 1.08 } },
  { id: 'joven', n: 'Joven de 18 a 30 años', de: 18, a: 30.99, h: { voz: 'h', tono: 1.02, vel: 1.06 }, m: { voz: 'm', tono: 1.08, vel: 1.05 } },
  { id: 'mediana', n: 'Adulto de 31 a 60 años', de: 31, a: 60.99, h: { voz: 'h', tono: 0.92, vel: 1.0 }, m: { voz: 'm', tono: 0.98, vel: 1.0 } },
  { id: 'mayor', n: 'Mayor de 61 a 75 años', de: 61, a: 75.99, h: { voz: 'h', tono: 0.82, vel: 0.9 }, m: { voz: 'm', tono: 0.88, vel: 0.9 } },
  { id: 'anciano', n: 'Abuelo o abuela de 76 años o más', de: 76, a: 200, h: { voz: 'h', tono: 0.72, vel: 0.8 }, m: { voz: 'm', tono: 0.78, vel: 0.82 } },
];
export const grupoVoz = (edad) => GRUPOS_VOZ.find(g => edad >= g.de && edad <= g.a) || GRUPOS_VOZ[5];
// pseudoaleatorio estable a partir de un número
const ruidoEstable = (n, k) => { const x = Math.sin((n + 1) * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
export function perfilVoz({ edad = 40, sexo = 'h', semilla = 0, rol = 'paciente', vozElegida = null }) {
  const g = grupoVoz(edad), base = g[sexo === 'm' ? 'm' : 'h'];
  if (rol === 'doctor') return { grupo: 'doctor', genero: vozElegida || sexo, tono: 0.98, vel: 0.97, semilla: 0 };
  const varTono = (ruidoEstable(semilla, 1) - 0.5) * 0.12, varVel = (ruidoEstable(semilla, 2) - 0.5) * 0.08;
  return { grupo: g.id, genero: base.voz, tono: +(base.tono + varTono).toFixed(3), vel: +(base.vel + varVel).toFixed(3), semilla: Math.floor(ruidoEstable(semilla, 3) * 1000) };
}
// Emociones: cambian el tono y el ritmo de la frase
export const EMOCIONES = {
  neutra: { tono: 1, vel: 1 },
  asustado: { tono: 1.07, vel: 1.08 },
  preocupado: { tono: 0.98, vel: 0.95 },
  dolor: { tono: 0.96, vel: 0.88 },
  nervioso: { tono: 1.05, vel: 1.12 },
  agradecido: { tono: 1.04, vel: 0.98 },
  triste: { tono: 0.94, vel: 0.88 },
  alegre: { tono: 1.06, vel: 1.04 },
};

export const Voz = {
  activa: true,
  hablando: false,
  quien: null,
  onCambio: null,
  _cola: Promise.resolve(),
  // se llama en cada palabra que pronuncia la voz (si el sintetizador lo permite), para mover la boca
  alPalabra: null,
  // última voz y ajustes usados: sirven para las pruebas y para la pantalla de ajustes
  ultima: null,
  get disponible() { return !!synth && voces.length > 0; },
  get nombres() { return voces.map(v => `${v.name} (${v.lang})`); },
  vozPara(genero, semilla) { const v = elegirVoz(genero, semilla); return v ? `${v.name} (${v.lang})` : null; },
  callar() {
    if (synth) synth.cancel();
    this.hablando = false; this.quien = null;
    this.onCambio && this.onCambio(null);
  },
  // Habla un texto; resuelve al terminar. Las voces suelen cortarse en textos largos: se trocea en frases.
  hablar(texto, { genero = 'h', tono = 1, vel = 1, quien = null, semilla = 0, emocion = 'neutra' } = {}) {
    return new Promise(res => {
      const em = EMOCIONES[emocion] || EMOCIONES.neutra;
      tono *= em.tono; vel *= em.vel;
      const duracion = Math.max(1200, texto.length * 62 / vel);
      const fin = () => { if (this.quien === quien) { this.hablando = false; this.quien = null; this.onCambio && this.onCambio(null); } res(); };
      this.hablando = true; this.quien = quien; this.onCambio && this.onCambio(quien);
      const voz = synth ? elegirVoz(genero, semilla) : null;
      // Si no hay voz del sexo pedido, se diferencia a hombres y mujeres con el tono
      const unica = !voz || generoVoz(voz) !== genero;
      const tonoFinal = Math.max(0.1, Math.min(2, tono * (unica ? (genero === 'm' ? 1.18 : 0.82) : 1)));
      this.ultima = { texto, voz: voz ? `${voz.name} (${voz.lang})` : null, genero, tono: +tonoFinal.toFixed(3), vel: +Math.max(0.6, Math.min(1.5, vel)).toFixed(3), emocion };
      if (!synth || !this.activa) {
        // sin voz: la boca se mueve igualmente al ritmo estimado de las palabras
        const palabras = texto.split(/\s+/); let k = 0; const paso = duracion / Math.max(1, palabras.length);
        const tic = () => { if (this.quien !== quien || k >= palabras.length) return; this.alPalabra && this.alPalabra(palabras[k++].length); setTimeout(tic, paso); };
        tic(); setTimeout(fin, duracion); return;
      }
      synth.cancel();
      const frases = texto.match(/[^.!?¿¡]*[.!?]+["»]?|[^.!?]+$/g) || [texto];
      let i = 0, vigilante;
      const sig = () => {
        if (this.quien !== quien) return res();
        if (i >= frases.length) { clearTimeout(vigilante); return fin(); }
        const u = synthNativo ? { text: frases[i++].trim() } : new SpeechSynthesisUtterance(frases[i++].trim());
        u.lang = voz ? voz.lang : 'es-ES';
        if (voz) u.voice = voz;
        u.pitch = tonoFinal;
        u.rate = Math.max(0.6, Math.min(1.5, vel));
        u.volume = 1;
        u.onend = sig;
        u.onerror = sig;
        u.onboundary = (ev) => { if (ev.name === 'word' || ev.name === undefined) this.alPalabra && this.alPalabra(ev.charLength || 5); };
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
  // llanto de bebé: «bua» con vibrato
  llanto(veces = 2) {
    const c = ac(); if (!c) return;
    for (let i = 0; i < veces; i++) {
      const t = c.currentTime + i * 1.1;
      const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
      o.type = 'sawtooth'; f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.2;
      o.frequency.setValueAtTime(420, t); o.frequency.linearRampToValueAtTime(560, t + 0.25); o.frequency.linearRampToValueAtTime(380, t + 0.95);
      const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 7; lg.gain.value = 18; lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.08); g.gain.setValueAtTime(0.16, t + 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.connect(f).connect(g).connect(master); o.start(t); o.stop(t + 1.05); lfo.start(t); lfo.stop(t + 1.05);
    }
  },
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
