// EL MEJOR MÉDICO — lógica del juego e interfaz.
import * as THREE from 'three';
import {
  azar, entre, entreInt, prob, normaliza, ENFERMEDADES, ENF, RECETARIO, CAT_NOMBRE, itemLibre, buscarReceta, PAUTAS, DURACIONES,
  RESPUESTAS_AUTORIDAD, fmt, tallaPecho, TALLAS_PECHO, generarPaciente, fraseHabitos, fraseAntecedentes, fraseAlergia, evaluarTratamiento, reaccionReceta,
  SANGRE, ORINA, PRUEBAS, ZONAS_RX, CIRUGIAS, ANESTESIAS, ANTECEDENTES, NOMBRES_H, NOMBRES_M, APELLIDOS, textoEdad, respondeAcomp, dialogo,
} from './datos.js';
import { Voz, Sonido, perfilVoz, grupoVoz } from './audio.js';
import { Mundo, crearHumano, cargarModelos, ropaSin, ROPAS, PELOS_NOMBRES, BARBAS_NOMBRES, GAFAS_NOMBRES, texReceta } from './escena.js';
import { IA_POR_DEFECTO, clasificar, intenciones, hablaDeTu, generarRespuesta, probarIA, respuestaGeneral, leerNatural, detectarOllama, elegirModelo, precalentar } from './ia.js';
import { Dictado } from './dictado.js';
import { Mando } from './mando.js';
import { dibujarRx, dibujarTac, dibujarEco, dibujarEcg, dibujarGarganta, ecgValor as ecgVal } from './imagenes.js';
import { Cirugia, HERRAMIENTAS, EMERGENCIAS } from './cirugia.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euros = (n) => `${Math.round(n).toLocaleString('es-ES')} €`;
const CLAVE = 'el-mejor-medico-v1';

// ───────────────────────── Estado ─────────────────────────
const PIELES = ['#f6d7c3', '#f1c7a8', '#e8b48f', '#d9a07a', '#c58c62', '#a86f4c', '#8a5638', '#6b3f28'];
const COLORES_PELO = ['#1f1611', '#3a2617', '#5b3a22', '#8a5a2b', '#b98b55', '#d8c08a', '#6b2b18', '#7c7c7c', '#bdbdbd', '#e6e6e6'];
const COLORES_OJOS = ['#4a2e1a', '#2b1a10', '#3d6a8a', '#4f6b3a', '#6b6f73', '#7a5a2a'];
const ROPA_MEDICO = ['bata_clasica', 'bata_corbata_azul', 'bata_corta', 'bata_moderna', 'pijama_azul', 'pijama_verde', 'pijama_granate', 'pijama_negro', 'pijama_rosa'];

function doctorPorDefecto() {
  return { nombre: 'Arricio Sorrios', sexo: 'h', voz: 'h', edad: 40, piel: '#e8b48f', pelo: '#3a2617', estilo: 1, barba: 2, gafas: 0, ojos: '#4a2e1a', complexion: 1, altura: 1.0, cara: 1, nariz: 1, ropa: 'bata_clasica' };
}
function estadoNuevo(doctor) {
  return {
    v: 1, doctor, hospital: 'Hospital San Marcos', renombrado: false,
    dia: 1, dinero: 3000, rep: 50, hora: 8 * 60,
    equipos: {}, inst: { camas: 3 }, personal: {},
    ingresados: [], historial: [], stats: { atendidos: 0, curados: 0, fallecidos: 0, operaciones: 0 },
    hoy: { ingresos: 0, gastos: 0, eventos: [], repIni: 50 },
    fase: 'consulta', pendientes: 0,
    ajustes: ajustesPorDefecto(),
  };
}
function ajustesPorDefecto() {
  return { voz: true, sonido: true, calidad: 'alta', velVoz: 1, ia: { ...IA_POR_DEFECTO }, mando: { sensibilidad: 1, zonaMuerta: 0.18 } };
}
function completarAjustes(a) {
  const d = ajustesPorDefecto();
  return { ...d, ...a, ia: { ...d.ia, ...(a?.ia || {}) }, mando: { ...d.mando, ...(a?.mando || {}) } };
}
let G = null;
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(G)); } catch (e) {} }
function cargar() { try { const s = localStorage.getItem(CLAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
const titulo = () => G.doctor.sexo === 'm' ? 'Dra.' : 'Dr.';
const nombreDoctor = () => `${titulo()} ${G.doctor.nombre}`;

// ───────────────────────── Mundo 3D ─────────────────────────
const canvas = $('#lienzo3d');
let mundo = null;
// el mundo 3D se crea después de cargar los modelos: lo que se registre antes espera aquí
const pendientesMundo = [];
function crearMundo() {
  mundo = new Mundo(canvas);
  mundo.ponerCalidad(G?.ajustes.calidad || (matchMedia('(max-width: 700px)').matches ? 'media' : 'alta'));
  mundo.construirConsulta(G ? G.doctor : doctorPorDefecto());
  mundo.construirSala();
  mundo.construirQuirofano();
  mundo.construirCreador();
  mundo.alActualizar.push(...pendientesMundo.splice(0));
  mundo.alRedimensionar = () => { if (modo === 'cirugia' && mundo.centroCampo) mundo.vistaCampo(0.01); };
}
Voz.onCambio = () => {};

// ───────────────────────── UI básica ─────────────────────────
let modo = 'inicio';
function aviso(txt, tipo = '') {
  const a = document.createElement('div'); a.className = `aviso ${tipo}`; a.textContent = txt;
  $('#avisos').appendChild(a);
  setTimeout(() => a.classList.add('fuera'), 2600); setTimeout(() => a.remove(), 3200);
}
function abrirModal(html, { clase = '', cerrable = true, alCerrar = null } = {}) {
  const fondo = document.createElement('div'); fondo.className = 'modal-fondo';
  fondo.innerHTML = `<div class="modal ${clase}">${cerrable ? '<button class="cerrar" aria-label="Cerrar">✕</button>' : ''}${html}</div>`;
  $('#modales').appendChild(fondo);
  const cerrar = () => { fondo.remove(); alCerrar && alCerrar(); };
  if (cerrable) { $('.cerrar', fondo).onclick = () => { Sonido.clic(); cerrar(); }; fondo.addEventListener('pointerdown', e => { if (e.target === fondo) cerrar(); }); }
  const m = $('.modal', fondo); m.cerrar = cerrar;
  return m;
}
function cerrarModales() { $$('#modales .modal-fondo').forEach(m => m.remove()); }
function fundido(fn, dur = 350) {
  const f = $('#fundido'); f.classList.add('on');
  return new Promise(res => setTimeout(async () => { await fn(); setTimeout(() => { f.classList.remove('on'); res(); }, 120); }, dur));
}
function hud() {
  if (!G) return;
  $('#hud-hospital').textContent = G.hospital;
  $('#hud-dia').textContent = `Día ${G.dia}`;
  $('#hud-hora').textContent = `${String(Math.floor(G.hora / 60) % 24).padStart(2, '0')}:${String(G.hora % 60).padStart(2, '0')}`;
  $('#hud-dinero').textContent = euros(G.dinero);
  $('#hud-dinero').classList.toggle('neg', G.dinero < 0);
  const est = Math.max(0, Math.min(5, G.rep / 20));
  $('#hud-rep').innerHTML = '★★★★★'.split('').map((s, i) => `<span class="${i < Math.round(est) ? 'on' : ''}">★</span>`).join('') + `<small>${Math.round(G.rep)}</small>`;
  $('#hud-medico').textContent = nombreDoctor();
}
function pasarTiempo(min) { G.hora += min; hud(); }
function dinero(n, motivo) {
  G.dinero += n;
  if (n > 0) { G.hoy.ingresos += n; Sonido.dinero(); } else G.hoy.gastos -= n;
  if (motivo) aviso(`${n > 0 ? '+' : ''}${euros(n)} · ${motivo}`, n > 0 ? 'bien' : 'mal');
  hud(); guardar();
}
function reputacion(n) { G.rep = Math.max(0, Math.min(100, G.rep + n)); hud(); }

// ───────────────────────── Voces y subtítulos ─────────────────────────
let cola = Promise.resolve(), hablandoN = 0;
let pac = null, hPac = null, hAcomp = null, acompDentro = false, hPacSin = null;
const esMujerAcomp = (p) => /mujer|hija|madre|hermana|abuela|nieta/.test(p.acompanante || '');
function parentesco(p) {
  const rel = (p.acompanante || 'acompañante').replace(/^su /, '');
  return `${rel[0].toUpperCase()}${rel.slice(1)} de ${p.nombre}`;
}
// ajusta «el niño / mi hijo» al sexo del paciente en las frases de los padres
function generoNino(t, p) {
  if (p.sexo === 'm') return t.replace(/\bel niño\b/g, 'la niña').replace(/\bEl niño\b/g, 'La niña').replace(/\b[Mm]i hijo\b/g, m => m[0] + 'i hija').replace(/\bmi bebé\b/gi, 'mi bebé').replace(/\bmuy flojo\b/g, 'muy floja').replace(/\bacatarrado\b/g, 'acatarrada').replace(/\bdecaído\b/g, 'decaída').replace(/\bquejoso\b/g, 'quejosa').replace(/\bdormido\b/g, 'dormida').replace(/\bronco\b/g, 'ronca').replace(/\bSu hermano\b/g, 'Su hermano').replace(/\btranquilo\b/g, 'tranquila').replace(/\brojo\b/g, 'roja');
  return t.replace(/\bla niña\b/g, 'el niño').replace(/\bLa niña\b/g, 'El niño');
}
// edad del acompañante: se fija al llegar el paciente; en partidas antiguas se estima por el parentesco
function edadAcomp(p) {
  if (p.acompEdad) return p.acompEdad;
  const rel = p.acompanante || '';
  return /abuel/.test(rel) ? 70 : /madre|padre/.test(rel) ? (p.edad < 18 ? 38 : Math.min(95, p.edad + 26)) : /nieto|nieta/.test(rel) ? 24 : /hija|hijo/.test(rel) ? Math.max(22, p.edad - 28) : 45;
}
function infoHablante(quien) {
  if (quien === 'doctor') return { nombre: nombreDoctor(), ...perfilVoz({ rol: 'doctor', sexo: G.doctor.sexo, vozElegida: G.doctor.voz }), clase: 'doctor' };
  if (quien === 'paciente' && pac) return { nombre: `${pac.nombre} ${pac.apellidos}`, ...perfilVoz({ edad: pac.edad, sexo: pac.sexo, semilla: pac.id }), clase: 'paciente', humano: modo === 'sala' ? hCama : (hPacSin && hPacSin.raiz.parent ? hPacSin : hPac) };
  if (quien === 'acomp' && pac) return { nombre: parentesco(pac), ...perfilVoz({ edad: edadAcomp(pac), sexo: esMujerAcomp(pac) ? 'm' : 'h', semilla: pac.id * 31 + 7 }), clase: 'acomp', humano: hAcomp };
  if (typeof quien === 'object') return { clase: 'otro', ...perfilVoz({ edad: quien.edad || 45, sexo: quien.genero || 'h', semilla: quien.semilla || 3 }), nombre: quien.nombre, humano: quien.humano };
  return { nombre: '', genero: 'h', tono: 1, vel: 1, clase: 'otro', semilla: 1 };
}
// emoción con la que se dice una frase (cambia la voz y la cara)
function emocionDe(quien, t, info) {
  if (quien === 'doctor') return { voz: 'neutra', cara: 'neutra' };
  const n = normaliza(t);
  if (/\(llor|lloros|snif/.test(n)) return { voz: 'triste', cara: 'tristeza' };
  if (/gracias|menos mal|que alivio|es usted un cielo|genial|estupend/.test(n)) return { voz: 'agradecido', cara: 'alegria' };
  if (/miedo|me van a pinchar|no quiero|dios mio|se va a morir|asust/.test(n)) return { voz: 'asustado', cara: 'miedo' };
  if (/\bay\b|duele|dolor|uf\b|no puedo/.test(n) || info.humano?.dolor) return { voz: 'dolor', cara: 'dolor' };
  if (/preocup|que tengo|es grave|me voy a curar/.test(n)) return { voz: 'preocupado', cara: 'preocupacion' };
  if (info.humano?.agitado) return { voz: 'nervioso', cara: 'preocupacion' };
  return { voz: 'neutra', cara: 'neutra' };
}
let hablanteActual = null;
Voz.alPalabra = (largo) => {
  const h = hablanteActual; if (!h) return;
  h.pulso = performance.now(); h.pulsoDur = Math.min(0.5, 0.08 + largo * 0.045); h.conPulsos = true;
};
// texto: lo que aparece en los subtítulos; opciones.leer: lo que pronuncia la voz (por ejemplo, abreviaturas desarrolladas)
function decir(quien, texto, { origen = null, leer = null } = {}) {
  hablandoN++; $('#panel').classList.add('ocupado'); actualizarCharla();
  cola = cola.then(async () => {
    const info = infoHablante(quien);
    let t = texto;
    if (quien !== 'doctor' && G.doctor.sexo === 'm') t = t.replace(/\b([Dd])octor\b/g, '$1octora');
    const sub = $('#subtitulo');
    const etiqueta = origen === 'ia' ? '<i class="origen ia" title="Respuesta generada por inteligencia artificial">IA</i>' : origen === 'predefinida' ? '<i class="origen pre" title="Respuesta escrita de antemano en el juego">predefinida</i>' : '';
    sub.innerHTML = `<b class="${info.clase}">${esc(info.nombre)}${etiqueta}</b><span>${esc(t)}</span>`;
    sub.classList.add('on');
    const bebe = quien === 'paciente' && pac && pac.edad < 1.5;
    const em = emocionDe(quien, t, info);
    if (info.humano) { info.humano.emocion = em.cara; if (bebe && /bua/i.test(t)) { info.humano.llorando = true; Sonido.llanto(2); } else { info.humano.hablando = true; info.humano.conPulsos = false; hablanteActual = info.humano; } }
    if (quien === 'doctor') mundo.doctorHablando = true;
    Voz.activa = G.ajustes.voz;
    await Voz.hablar((leer || t).replace(/\(.*?\)/g, ''), { genero: info.genero, tono: info.tono, vel: info.vel * (G.ajustes.velVoz || 1), quien: info.clase + Math.random(), semilla: info.semilla, emocion: em.voz });
    if (info.humano) { info.humano.hablando = false; info.humano.llorando = false; info.humano.conPulsos = false; if (hablanteActual === info.humano) hablanteActual = null; }
    mundo.doctorHablando = false;
    hablandoN--;
    if (!hablandoN) { $('#panel').classList.remove('ocupado'); setTimeout(() => { if (!hablandoN) sub.classList.remove('on'); }, 2500); }
    actualizarCharla();
  });
  return cola;
}
// Reacción física del paciente al explorarle (dolor, cosquillas, llanto del bebé): se ve en su cara y en los
// subtítulos, pero no habla. En la consulta sólo se habla al pulsar HABLAR MÉDICO o RESPONDER PACIENTE.
function reaccion(texto) {
  const h = hPacSin && hPacSin.raiz.parent && hPacSin.raiz.visible ? hPacSin : hPac;
  const n = normaliza(texto);
  if (h) {
    h.emocion = /\bay\b|duele|uuuh|llor|bua|mama/.test(n) ? 'dolor' : /je, je|cosquillas/.test(n) ? 'alegria' : 'neutra';
    if (/bua|llor/.test(n) && pac.edad < 3) { h.llorando = true; Sonido.llanto(2); setTimeout(() => { h.llorando = false; }, 2200); }
  }
  const sub = $('#subtitulo');
  sub.innerHTML = `<b class="paciente">${esc(`${pac.nombre} ${pac.apellidos}`)}<i class="origen accion">reacción</i></b><span><i>${esc(texto)}</i></span>`;
  sub.classList.add('on');
  setTimeout(() => { if (!hablandoN) sub.classList.remove('on'); }, 2600);
  return Promise.resolve();
}
// Lo que hace el médico al explorar: sólo se describe en los subtítulos, nunca se dice en voz alta
function narrar(texto) {
  const sub = $('#subtitulo');
  sub.innerHTML = `<b class="doctor">${esc(nombreDoctor())}<i class="origen accion">acción</i></b><span><i>${esc(texto)}</i></span>`;
  sub.classList.add('on');
  setTimeout(() => { if (!hablandoN) sub.classList.remove('on'); }, 2600);
  return Promise.resolve();
}
$('#subtitulo').addEventListener('click', () => Voz.callar());

// ───────────────────────── Conversación por turnos ─────────────────────────
// El jugador escribe (o dicta) lo que dice el médico y decide cuándo habla cada uno:
// HABLAR MÉDICO dice exactamente el texto del cuadro y RESPONDER PACIENTE hace que conteste el paciente.
// Nadie habla por su cuenta: los diálogos del guion también esperan a que se pulse el botón de cada uno.
const charla = {
  espera: null,      // turno del guion pendiente: { tipo: 'medico' | 'paciente', ..., resolver }
  pendiente: null,   // última frase libre del médico (o algo que el paciente quiere decir) sin respuesta todavía
  sugerencia: null,  // { texto, id, ctx }: pregunta elegida en el panel, para la mecánica del juego
  pensando: false, entregando: false, activa: false,
};
const cajaCharla = () => $('#ch-texto');
const textoCaja = () => cajaCharla().value.trim();
function ajustarAltura() { const c = cajaCharla(); c.style.height = 'auto'; c.style.height = `${Math.min(c.scrollHeight, 120)}px`; }
function mostrarCharla(on) { charla.activa = on; document.body.classList.toggle('con-charla', on); if (!on && Dictado.escuchando) Dictado.parar(); actualizarCharla(); }
function reiniciarCharla() { charla.espera = null; charla.pendiente = null; charla.sugerencia = null; charla.pensando = false; charla.entregando = false; cajaCharla().value = ''; cajaCharla().readOnly = false; proponer(null); ajustarAltura(); actualizarCharla(); }
// Una idea del juego para lo que podría decir el médico: NUNCA se escribe sola en el cuadro;
// sólo se copia si el jugador pulsa la sugerencia, y después la puede cambiar antes de enviarla.
let propuesta = null;
function proponer(texto, { id = null, ctx = null } = {}) {
  propuesta = texto ? { texto, id, ctx } : null;
  $('#ch-sug').hidden = !texto;
  $('#ch-sug-usar').textContent = texto || '';
  actualizarCharla();
}
$('#ch-sug-usar').onclick = () => { if (!propuesta) return; const p = propuesta; proponer(null); ponerTextoMedico(p.texto, { id: p.id, ctx: p.ctx }); if (Mando.ultimaEntrada !== 'mando') cajaCharla().focus(); };
function ponerTextoMedico(texto, { id = null, ctx = null, soloLectura = false } = {}) {
  const c = cajaCharla(); c.value = texto; c.readOnly = soloLectura; charla.sugerencia = { texto, id, ctx };
  ajustarAltura(); actualizarCharla();
  if (Mando.ultimaEntrada === 'mando') Mando.enfocar($('#ch-medico'));
}
function actualizarCharla() {
  const el = $('#charla'); if (!el || !G) return;
  const ocupado = hablandoN > 0 || charla.pensando || charla.entregando;
  const esperaPac = charla.espera?.tipo === 'paciente';
  const puedeMedico = !ocupado && !esperaPac && !!textoCaja();
  const puedePaciente = !ocupado && (esperaPac || (!charla.espera && !!charla.pendiente));
  $('#ch-medico').disabled = !puedeMedico;
  $('#ch-paciente').disabled = !puedePaciente;
  $('#ch-mic').classList.toggle('on', Dictado.escuchando);
  $('#ch-mic').setAttribute('aria-pressed', Dictado.escuchando ? 'true' : 'false');
  let estado, turno;
  const hablaMedico = String(Voz.quien || '').startsWith('doctor') || mundo?.doctorHablando;
  if (charla.pensando) { estado = G.ajustes.ia.modo === 'predefinida' ? 'El paciente va a responder…' : 'El paciente está pensando qué responder (IA)…'; turno = 'paciente'; }
  else if (charla.entregando) { estado = 'Entregando la receta en mano…'; turno = 'medico'; }
  else if (hablandoN) { estado = hablaMedico ? 'El médico está hablando…' : 'Está hablando el paciente…'; turno = hablaMedico ? 'medico' : 'paciente'; }
  else if (Dictado.escuchando) { estado = 'Escuchando el micrófono… habla y después revisa el texto.'; turno = 'medico'; }
  else if (puedePaciente) { estado = charla.pendiente?.ctx?.tipo === 'extra' || charla.pendiente?.ctx?.tipo === 'cuestiona' ? 'Parece que quieren decir algo: pulsa RESPONDER PACIENTE si quieres oírlo, o sigue preguntando.' : 'Turno del paciente: pulsa RESPONDER PACIENTE cuando quieras.'; turno = 'paciente'; }
  else { estado = charla.espera?.tipo === 'medico' ? (charla.espera.etiqueta || 'Turno del médico: revisa el texto y pulsa HABLAR MÉDICO.') : 'Turno del médico: escribe o dicta lo que quieres decir.'; turno = 'medico'; }
  // mientras un paciente quiere decir algo, el médico también puede seguir hablando
  if (charla.pendiente && !charla.espera && !ocupado && textoCaja()) $('#ch-medico').disabled = false;
  // se avisa siempre de si las respuestas son de IA o predefinidas
  if (turno === 'paciente' && !hablandoN && !charla.pensando) estado += iaMovil.carga ? ' (Cargando la IA del móvil…)' : G.ajustes.ia.modo === 'predefinida' ? ' (Sin IA instalada: respuestas predefinidas.)' : ` (IA: ${G.ajustes.ia.modelo}${G.ajustes.ia.modo === 'movil' ? ', en el móvil' : ''})`;
  $('#ch-estado').textContent = estado;
  el.dataset.turno = turno;
  if (el.offsetHeight) document.documentElement.style.setProperty('--alto-charla', `${el.offsetHeight}px`);
  $('#panel').classList.toggle('guion', !!charla.espera);
}
cajaCharla().addEventListener('input', () => { ajustarAltura(); actualizarCharla(); });
cajaCharla().addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); hablarMedico(); } });
$('#ch-escribir').onclick = () => { if (Mando.ultimaEntrada === 'mando') Mando.abrirTeclado(cajaCharla()); else cajaCharla().focus(); };
$('#ch-mic').onclick = () => alternarMicro(cajaCharla());
$('#ch-medico').onclick = () => hablarMedico();
$('#ch-paciente').onclick = () => responderPaciente();

// Micrófono: lo dicho se convierte en texto en el campo; el médico no habla hasta pulsar HABLAR MÉDICO
async function alternarMicro(campo) {
  if (Dictado.escuchando) { Dictado.parar(); return; }
  if (campo.readOnly) return aviso('Este texto no se puede cambiar: es la receta que has confirmado.', 'info');
  if (!Dictado.disponible) { aviso(Dictado.motivoNoDisponible, 'mal'); campo.focus(); return; }
  if (!G.ajustes.micAvisado) {
    const ok = await new Promise(res => {
      const m = abrirModal(`<h2>Usar el micrófono</h2><p>Vas a dictar lo que dirá el médico. Tu voz <b>sólo se convierte en texto</b>: no se guarda ni se reproduce. Después podrás corregir el texto antes de que el médico lo diga con su propia voz.</p>
        <p class="nota">${esApp() ? 'Android te pedirá permiso para usar el micrófono. Se usa el reconocedor de voz del propio móvil; funciona sin Internet si tienes descargado el español (Ajustes de Android › Google › Voz › Reconocimiento sin conexión).' : 'El navegador te pedirá permiso para usar el micrófono. En Chrome y Edge el reconocimiento de voz necesita conexión a Internet.'}</p>
        <div class="botones"><button class="btn sec" id="mi-no">Ahora no</button><button class="btn grande" id="mi-si">Permitir y dictar</button></div>`, { clase: 'pequeno', alCerrar: () => res(false) });
      $('#mi-si', m).onclick = () => { m.parentElement.remove(); res(true); };
      $('#mi-no', m).onclick = () => { m.cerrar(); };
    });
    if (!ok) return;
    G.ajustes.micAvisado = true; guardar();
  }
  const base = campo.value.trim();
  await Dictado.iniciar({
    alTexto: (t) => { campo.value = (base ? `${base} ` : '') + t; campo.dispatchEvent(new Event('input', { bubbles: true })); },
    alFin: (err) => { if (err) aviso(err, 'mal'); actualizarCharla(); try { campo.focus(); } catch (e) {} },
  });
  actualizarCharla();
}

async function hablarMedico() {
  if ($('#ch-medico').disabled) return;
  if (Dictado.escuchando) Dictado.parar();
  const texto = textoCaja();
  if (!texto) return;
  const sug = charla.sugerencia && charla.sugerencia.texto.trim() === texto ? charla.sugerencia : null;
  const espera = charla.espera?.tipo === 'medico' ? charla.espera : null;
  const leer = espera && espera.leer && texto === espera.texto.trim() ? espera.leer : null;
  cajaCharla().value = ''; cajaCharla().readOnly = false; charla.sugerencia = null; proponer(null); ajustarAltura();
  if (pac) (pac.charla ||= []).push({ quien: 'medico', texto });
  if (espera) charla.espera = null; else charla.pendiente = null;
  Sonido.clic();
  await decir('doctor', texto, { leer });
  if (espera) espera.resolver(texto);
  else charla.pendiente = { texto, id: sug?.id || null, ctx: sug?.ctx || null };
  actualizarCharla();
}
async function responderPaciente() {
  if ($('#ch-paciente').disabled) return;
  Sonido.clic();
  if (charla.espera?.tipo === 'paciente') {
    const e = charla.espera; charla.espera = null;
    await responderCon(e.quien, e.referencia, e);
    e.resolver();
    return;
  }
  const p = charla.pendiente; if (!p) return;
  charla.pendiente = null;
  if (p.ctx?.tipo === 'extra') return responderCon(p.ctx.quien, p.ctx.referencia);
  if (p.ctx?.tipo === 'cuestiona') return responderCuestiona();
  if (p.ctx?.tipo === 'autoridad') return responderAutoridad(p.ctx.v);
  if (modo === 'sala') return responderSala(p);
  return responderPregunta(p);
}
// Turnos del guion: el texto propuesto aparece en el cuadro y espera a que se pulse el botón
// Turno del médico en el guion. La receta (escrita por el jugador) va directamente al cuadro, sin poder cambiarse;
// cualquier otra frase del juego sólo se ofrece como sugerencia y el cuadro queda vacío para escribir o dictar.
function turnoMedico(texto, { soloLectura = false, etiqueta = null, leer = null } = {}) {
  return new Promise(res => {
    charla.pendiente = null; charla.espera = { tipo: 'medico', texto, leer, etiqueta, resolver: res };
    mostrarCharla(true);
    if (soloLectura) { proponer(null); ponerTextoMedico(texto, { soloLectura }); }
    else { cajaCharla().value = ''; cajaCharla().readOnly = false; charla.sugerencia = null; ajustarAltura(); proponer(texto); }
  });
}
function turnoPaciente(quien, referencia, opciones = {}) {
  return new Promise(res => { charla.espera = { tipo: 'paciente', quien, referencia, ...opciones, resolver: res }; mostrarCharla(true); actualizarCharla(); if (Mando.ultimaEntrada === 'mando') Mando.enfocar($('#ch-paciente')); });
}
// lo que el médico ya ha comunicado al paciente (para que la IA lo tenga en cuenta)
function tratamientoDicho() {
  if (!pac || !pac.plan || !pac.noticiaDada) return '';
  const d = ENF[pac.plan.diag];
  const acc = { casa: 'se puede ir a casa', hospitalizar: 'le van a ingresar en planta', cirugia: 'le van a operar' }[pac.plan.accion] || '';
  return `Diagnóstico que le ha dicho el médico: ${d ? d.n : '—'}; ${acc}.${pac.recetaTexto ? ` Receta entregada: ${pac.recetaTexto}` : ''}`;
}
// El paciente (o quien corresponda) contesta: con IA si está configurada, si no con la respuesta del juego
async function responderCon(quien, referencia, { fija = false, tratamiento = null } = {}) {
  // en el móvil, si la IA aún se está cargando, se espera a que termine (no se cambia a las predefinidas sin avisar)
  if (iaMovil.carga) { charla.pensando = true; actualizarCharla(); await iaMovil.carga; charla.pensando = false; }
  const cfg = G.ajustes.ia;
  let texto = referencia, origen = 'predefinida';
  const bebe = quien === 'paciente' && pac && pac.edad < 1.5;
  const objeto = typeof quien === 'object';
  const rolIA = quien === 'acomp' || (objeto && quien.rol === 'acomp') ? 'acomp' : objeto ? null : 'paciente';
  if (!fija && !bebe && pac && rolIA && cfg.modo !== 'predefinida') {
    charla.pensando = true; actualizarCharla();
    const hist = pac.charla || [];
    let iu = hist.length - 1; while (iu >= 0 && hist[iu].quien !== 'medico') iu--;
    const r = await generarRespuesta(cfg, { pac, quien: rolIA, nombreDoctor: nombreDoctor(), historial: iu >= 0 ? hist.slice(0, iu) : hist, pregunta: iu >= 0 ? hist[iu].texto : '', referencia, tratamiento: tratamiento || tratamientoDicho() });
    charla.pensando = false;
    texto = r.texto; origen = r.origen;
    if (r.error) aviso(`IA no disponible (${r.error}). Se usa la respuesta predefinida.`, 'info');
  }
  if (pac) (pac.charla ||= []).push({ quien: objeto ? 'acomp' : quien, texto, origen });
  await decir(quien, texto, { origen });
}

// ───────────────────────── Pantalla de inicio ─────────────────────────
function pantallaInicio() {
  modo = 'inicio';
  document.body.dataset.modo = 'inicio';
  mundo.mostrar('consulta'); mundo.vistaEscritorio(0); mundo.manos.visible = false;
  mundo.irA([1.4, 1.7, 1.9], [0.2, 1.0, -0.6], 0);
  const guardada = cargar();
  $('#inicio').innerHTML = `
    <div class="logo"><svg viewBox="0 0 120 40" class="pulso"><polyline points="0,22 30,22 38,22 44,8 50,34 56,14 61,22 120,22" /></svg>
      <h1>EL MEJOR<br><span>MÉDICO</span></h1><p class="lema">Simulador de hospital · San Marcos</p></div>
    <div class="botones">
      ${guardada ? `<button class="btn grande" id="b-continuar">Continuar · Día ${guardada.dia} · ${esc(guardada.doctor?.nombre || '')}</button>` : ''}
      <button class="btn grande ${guardada ? 'sec' : ''}" id="b-nueva">Nueva partida</button>
      <button class="btn sec" id="b-como">Cómo se juega</button>
      <button class="btn sec" id="b-ajustes">Ajustes</button>
    </div>
    <p class="nota">Tú decides qué dice el médico y cuándo contesta el paciente. Las voces usan el sintetizador en español de España de tu dispositivo. Pulsa los subtítulos para saltar una frase.</p>`;
  $('#inicio').classList.add('on');
  $('#b-continuar') && ($('#b-continuar').onclick = () => { Sonido.iniciar(); G = guardada; G.ajustes = completarAjustes(G.ajustes); aplicarMando(); mundo.actualizarDoctor(G.doctor); $('#inicio').classList.remove('on'); empezarDia(true); });
  $('#b-nueva').onclick = () => {
    Sonido.iniciar();
    if (guardada && !confirm('¿Empezar una partida nueva? Se perderá la partida guardada.')) return;
    G = estadoNuevo(doctorPorDefecto());
    $('#inicio').classList.remove('on');
    creadorMedico(true);
  };
  $('#b-como').onclick = comoSeJuega;
  $('#b-ajustes').onclick = ajustes;
}
function comoSeJuega() {
  abrirModal(`<h2>Cómo se juega</h2>
  <ol class="ayuda">
    <li><b>Consulta.</b> Tú controlas la conversación: escribe (o dicta con el micrófono) lo que quieres decir y pulsa <b>HABLAR MÉDICO</b>; cuando quieras que conteste, pulsa <b>RESPONDER PACIENTE</b>. Nadie habla si no pulsas su botón. También puedes elegir preguntas del panel: aparecen en el cuadro y puedes cambiarlas. Algunos pacientes esconden cosas: gánate su confianza o pide al acompañante que salga.</li>
    <li><b>Explora.</b> Toma las constantes, ausculta pulmones y corazón con el estetoscopio (mueve el dedo o el ratón por la espalda), palpa la barriga o mira la garganta.</li>
    <li><b>Pide pruebas.</b> Análisis, radiografías, electrocardiograma, ecografía y TAC (estos dos hay que comprarlos). En las imágenes, rodea con el dedo la zona sospechosa.</li>
    <li><b>Decide.</b> Elige el diagnóstico, qué hacer (casa, ingreso o quirófano) y escribe la receta con tus palabras: medicamento, dosis, frecuencia, duración y recomendaciones. Puedes recetar <i>cualquier</i> medicamento, comida o bebida, del cocido leonés al orujo. Revísala y pulsa <b>CONFIRMAR RECETA</b>; después, el médico la leerá cuando pulses HABLAR MÉDICO y se la entregará en mano.</li>
    <li><b>Comunica la noticia</b> con tacto. Los pacientes tienen sentimientos.</li>
    <li><b>Opera.</b> Elige la anestesia, lávate y ponte guantes, y usa el bisturí, las pinzas, el separador, el aspirador y la sutura. Atento a las complicaciones del monitor.</li>
    <li><b>Ronda de guardia.</b> Cada mañana visita a tus ingresados, ajusta tratamientos y da altas.</li>
    <li><b>Gestiona.</b> Con el dinero, compra equipos, amplía la planta y contrata especialistas. Con mucha reputación, el hospital llevará tu nombre.</li>
  </ol>`);
}
// Personas de prueba para comprobar las voces por edades
const PRUEBA_VOCES = [
  { n: 'Niño de 5 años', edad: 5, sexo: 'h', t: 'Me duele mucho la barriga, doctor. ¿Me vas a pinchar?' },
  { n: 'Niña de 8 años', edad: 8, sexo: 'm', t: 'Hola. Me pica mucho la garganta y no puedo tragar.' },
  { n: 'Adolescente de 15 años', edad: 15, sexo: 'h', t: 'Pues... llevo dos días con fiebre y me duele la cabeza.' },
  { n: 'Hombre de 40 años', edad: 40, sexo: 'h', t: 'Buenos días, doctor. Desde el lunes tengo un dolor en el pecho que me preocupa.' },
  { n: 'Mujer de 45 años', edad: 45, sexo: 'm', t: 'Buenos días. Vengo porque no duermo bien y estoy muy cansada.' },
  { n: 'Abuelo de 85 años', edad: 85, sexo: 'h', t: 'Ay, hijo. Es que ya no ando como antes, y la rodilla me mata.' },
  { n: 'Abuela de 85 años', edad: 85, sexo: 'm', t: 'Buenos días, hijo. Ay, qué joven es usted. Me mareo mucho últimamente.' },
];
function perfilesPrueba() {
  return PRUEBA_VOCES.map((p, i) => { const v = perfilVoz({ edad: p.edad, sexo: p.sexo, semilla: 1000 + i * 17 }); return { ...p, ...v, nombreGrupo: grupoVoz(p.edad).n, voz: Voz.vozPara(v.genero, v.semilla) }; });
}
function aplicarMando() {
  const c = (G?.ajustes || completarAjustes({})).mando;
  Mando.sensibilidad = c.sensibilidad; Mando.zonaMuerta = c.zonaMuerta;
}
function ajustes() {
  const a = G?.ajustes || completarAjustes({});
  const ia = a.ia;
  const m = abrirModal(`<h2>Ajustes</h2>
    <div class="ficha-sec">VOZ Y CONVERSACIÓN</div>
    <label class="fila"><input type="checkbox" id="aj-voz" ${a.voz ? 'checked' : ''}> Voces habladas en español de España</label>
    <label class="fila">Velocidad de voz <input type="range" id="aj-vel" min="0.7" max="1.4" step="0.05" value="${a.velVoz || 1}"></label>
    <p class="nota">Voces de España encontradas: ${Voz.nombres.length ? esc(Voz.nombres.slice(0, 8).join(' · ')) : 'ninguna; se mostrarán sólo subtítulos. En Android instala «Servicios de voz de Google» con el idioma Español (España).'}</p>
    <div class="botones"><button class="btn" id="aj-probar">Probar la voz del médico</button><button class="btn sec" id="aj-edades">Probar voces por edades</button></div>
    <div id="aj-voces"></div>
    <div class="ficha-sec">RESPUESTAS DE LOS PACIENTES</div>
    <label class="fila">Modo <select id="aj-ia">${esApp() ? '<option value="movil">IA en el propio móvil (Gemma 4 E2B, sin Internet)</option>' : ''}<option value="predefinida">Predefinidas del juego (sin IA, sin Internet)</option><option value="ollama">IA local con Ollama (gratis, sin Internet)</option><option value="openai">IA local compatible con OpenAI (LM Studio, llama.cpp…)</option></select></label>
    <div id="aj-ia-cfg"><label class="campo">Dirección del servidor<input id="aj-url" value="${esc(ia.url)}" autocomplete="off"></label><label class="campo">Modelo<input id="aj-mod" value="${esc(ia.modelo)}" autocomplete="off"></label>
      <div class="botones"><button class="btn sec" id="aj-iap">Probar la conexión</button></div><p class="nota" id="aj-iar"></p></div>
    ${esApp() ? `<div id="aj-movil"><p class="nota" id="aj-mov-est">Comprobando la IA del móvil…</p><div class="botones"><button class="btn sec" id="aj-mov-inst">Descargar o importar el modelo</button><button class="btn sec" id="aj-mov-carg">Cargar / reintentar</button><button class="btn sec" id="aj-mov-cpu">Usar el procesador en vez de la GPU</button></div></div>`
      : '<p class="nota">Para jugar en el móvil sin el portátil, instala la aplicación de Android (APK): la IA va dentro del móvil. Para pruebas, también puedes abrir en el portátil <b>JUGAR-EN-EL-MOVIL.cmd</b> y, en el móvil, la dirección que te muestra.</p>'}
    <p class="nota">En los subtítulos verás <i class="origen ia">IA</i> si la respuesta la ha generado la inteligencia artificial y <i class="origen pre">predefinida</i> si es una frase escrita en el juego (por ejemplo, cuando no hay IA o no contesta).</p>
    <div class="ficha-sec">MANDO Y CONTROLES</div>
    <p class="nota">${Mando.conectado ? `Mando conectado: ${esc(Mando.nombre)}` : 'No hay ningún mando conectado. Empareja el mando de Xbox por Bluetooth y pulsa cualquier botón.'}</p>
    <label class="fila">Sensibilidad del cursor <input type="range" id="aj-sens" min="0.4" max="2.5" step="0.1" value="${a.mando.sensibilidad}"></label>
    <label class="fila">Zona muerta de los joysticks <input type="range" id="aj-dz" min="0.05" max="0.4" step="0.01" value="${a.mando.zonaMuerta}"></label>
    <div class="botones"><button class="btn sec" id="aj-controles">Ver los controles</button></div>
    <div class="ficha-sec">GRÁFICOS</div>
    <label class="fila">Calidad gráfica <select id="aj-cal"><option value="alta">Alta (portátil)</option><option value="media">Media (móvil)</option><option value="baja">Baja (móviles antiguos)</option></select></label>
    <div class="botones"><button class="btn sec" id="aj-pc">Pantalla completa</button>${G ? '<button class="btn peligro" id="aj-borrar">Borrar partida</button>' : ''}</div>`);
  $('#aj-cal', m).value = a.calidad;
  $('#aj-ia', m).value = ia.modo;
  const verIA = () => { $('#aj-ia-cfg', m).classList.toggle('oculto', ['predefinida', 'movil'].includes($('#aj-ia', m).value)); $('#aj-movil', m)?.classList.toggle('oculto', $('#aj-ia', m).value !== 'movil'); };
  verIA();
  if (esApp()) {
    const P = window.Capacitor.Plugins.IALocal;
    const verMovil = async () => {
      const e = await P.estado().catch(err => ({ error: err.message }));
      $('#aj-mov-est', m).textContent = e.error ? `Error: ${e.error}` : !e.instalado ? `Modelo no instalado (${gb(e.total)}). Espacio libre: ${gb(e.libre)}.` : e.cargado ? `Gemma 4 E2B cargado ${e.aceleracion === 'gpu' ? 'en la GPU' : 'en el procesador'}. Funciona sin Internet.` : iaMovil.carga ? 'Cargando Gemma 4 E2B…' : 'Gemma 4 E2B instalado (sin cargar).';
    };
    verMovil();
    $('#aj-mov-inst', m).onclick = async () => { const e = await P.estado(); if (e.instalado) return aviso('El modelo ya está instalado.', 'info'); instalarIAMovil(e); };
    $('#aj-mov-carg', m).onclick = async () => { ia.manual = false; await detectarIAMovil(); verMovil(); $('#aj-ia', m).value = ia.modo; verIA(); };
    $('#aj-mov-cpu', m).onclick = async () => { ia.aceleracion = 'cpu'; guardar(); aviso('Se usará el procesador la próxima vez que se abra el juego.', 'info'); };
  }
  const aplicar = () => {
    a.voz = $('#aj-voz', m).checked; a.velVoz = +$('#aj-vel', m).value; a.calidad = $('#aj-cal', m).value;
    const nuevoModo = $('#aj-ia', m).value;
    if (nuevoModo !== ia.modo && nuevoModo === 'openai' && /11434/.test($('#aj-url', m).value)) $('#aj-url', m).value = 'http://localhost:1234';
    if (nuevoModo !== ia.modo && nuevoModo === 'ollama' && /1234/.test($('#aj-url', m).value)) $('#aj-url', m).value = 'http://localhost:11434';
    if (nuevoModo !== ia.modo) ia.manual = nuevoModo !== 'movil';
    if (nuevoModo === 'movil' && ia.modo !== 'movil') setTimeout(() => detectarIAMovil(), 0);
    ia.modo = nuevoModo; ia.url = $('#aj-url', m).value.trim(); ia.modelo = $('#aj-mod', m).value.trim();
    a.mando.sensibilidad = +$('#aj-sens', m).value; a.mando.zonaMuerta = +$('#aj-dz', m).value;
    verIA();
    if (G) { G.ajustes = a; guardar(); } aplicarMando(); mundo.ponerCalidad(a.calidad);
  };
  $$('input,select', m).forEach(el => el.onchange = aplicar);
  $('#aj-probar', m).onclick = () => { aplicar(); Voz.activa = a.voz; const v = perfilVoz({ rol: 'doctor', sexo: G?.doctor.sexo || 'h', vozElegida: G?.doctor.voz || 'h' }); Voz.hablar('Buenos días. Soy el mejor médico de León. ¿Qué le trae por aquí?', { ...v, vel: v.vel * a.velVoz }); };
  $('#aj-edades', m).onclick = async () => {
    aplicar(); Voz.activa = a.voz;
    const lista = perfilesPrueba();
    $('#aj-voces', m).innerHTML = `<table class="tabla"><tr><th>Persona</th><th>Grupo</th><th>Voz del dispositivo</th><th>Tono</th><th>Ritmo</th></tr>${lista.map((p, i) => `<tr data-v="${i}"><td>${p.n}</td><td>${esc(p.nombreGrupo)}</td><td>${esc(p.voz || 'sin voz')}</td><td>${p.tono}</td><td>${p.vel}</td></tr>`).join('')}</table>
      <p class="nota">Tu dispositivo no tiene voces infantiles ni de personas mayores: cada edad usa la voz más parecida con su propio tono y ritmo.</p>`;
    for (const [i, p] of lista.entries()) {
      $$('#aj-voces tr', m).forEach(tr => tr.classList.toggle('ok', tr.dataset.v === String(i)));
      await Voz.hablar(p.t, { genero: p.genero, tono: p.tono, vel: p.vel * a.velVoz, semilla: p.semilla, quien: 'prueba' + i, emocion: p.edad < 7 ? 'asustado' : p.edad > 80 ? 'preocupado' : 'neutra' });
      if (!document.contains(m)) break;
    }
  };
  $('#aj-iap', m).onclick = async () => {
    aplicar(); $('#aj-iar', m).textContent = 'Probando…';
    const r = await probarIA(ia);
    $('#aj-iar', m).textContent = r.ok ? `Funciona. El modelo ha contestado: «${r.texto}»` : `No funciona: ${r.error}. Comprueba que el servidor está en marcha y que permite conexiones desde el juego.`;
  };
  $('#aj-controles', m).onclick = mostrarControles;
  $('#aj-pc', m).onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => aviso('Este navegador no permite la pantalla completa', 'mal')); };
  if ($('#aj-borrar', m)) $('#aj-borrar', m).onclick = () => { if (confirm('¿Seguro que quieres borrar la partida?')) { localStorage.removeItem(CLAVE); location.reload(); } };
}
function mostrarControles() {
  abrirModal(`<h2>Controles</h2>
    <div class="ficha-sec">CONVERSACIÓN</div>
    <table class="tabla controles"><tr><th>Acción</th><th>Táctil / ratón</th><th>Teclado</th><th>Mando Xbox</th></tr>
      <tr><td>Escribir lo que dice el médico</td><td>Cuadro de texto · ✎ ESCRIBIR</td><td>Escribir</td><td>A sobre el cuadro (teclado en pantalla)</td></tr>
      <tr><td>Dictar por micrófono</td><td>🎤 MICRÓFONO</td><td>—</td><td>LT</td></tr>
      <tr><td>Hablar el médico</td><td>HABLAR MÉDICO</td><td>Intro</td><td>X</td></tr>
      <tr><td>Responder el paciente</td><td>RESPONDER PACIENTE</td><td>—</td><td>Y</td></tr>
      <tr><td>Elegir pregunta, pestaña u opción</td><td>Tocar</td><td>Tab</td><td>Cruceta o joystick izquierdo + A</td></tr>
      <tr><td>Cancelar o volver</td><td>✕</td><td>Esc</td><td>B</td></tr></table>
    <div class="ficha-sec">EXPLORACIÓN, IMÁGENES Y QUIRÓFANO</div>
    <table class="tabla controles"><tr><th>Acción</th><th>Táctil / ratón</th><th>Mando Xbox</th></tr>
      <tr><td>Mover el estetoscopio, el bisturí o el lápiz</td><td>Arrastrar</td><td>Joystick izquierdo (o derecho, más lento) mueve el cursor</td></tr>
      <tr><td>Apoyar o cortar</td><td>Pulsar</td><td>RT (o A)</td></tr>
      <tr><td>Movimiento de precisión</td><td>—</td><td>Mantener LT</td></tr>
      <tr><td>Cambiar de instrumento</td><td>Tocar el instrumento</td><td>LB / RB</td></tr></table>
    <div class="ficha-sec">GENERAL</div>
    <table class="tabla controles"><tr><td>Menú, pausa y ajustes</td><td>☰</td><td>Botón MENÚ</td></tr><tr><td>Ver estos controles</td><td>Ajustes › Ver los controles</td><td>Botón VISTA</td></tr></table>`, { clase: 'ancho2' });
}

// ───────────────────────── Creador del médico ─────────────────────────
function creadorMedico(nuevo = false, base = null) {
  modo = 'creador'; document.body.dataset.modo = 'creador';
  mostrarCharla(false);
  const d = { ...(base || G.doctor) };
  mundo.mostrar('creador'); mundo.giroCreador = 0.25;
  const refrescar = () => { mundo.ponerDoctorCreador(d); };
  refrescar(); mundo.vistaCreador('cuerpo', 0);
  const sw = (lista, campo) => lista.map(c => `<button class="muestra ${d[campo] === c ? 'on' : ''}" data-c="${campo}" data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('');
  const opts = (lista, campo) => lista.map((n, i) => `<button class="op ${d[campo] === i ? 'on' : ''}" data-c="${campo}" data-n="${i}">${n}</button>`).join('');
  const p = $('#creador');
  p.innerHTML = `
    <h2>${nuevo ? 'Crea a tu médico' : 'Editar médico'}</h2>
    <label class="campo">Nombre y apellidos<input id="cr-nombre" maxlength="40" value="${esc(d.nombre)}"></label>
    <div class="grupo"><span>Sexo</span><button class="op ${d.sexo === 'h' ? 'on' : ''}" data-c="sexo" data-s="h">Hombre (Dr.)</button><button class="op ${d.sexo === 'm' ? 'on' : ''}" data-c="sexo" data-s="m">Mujer (Dra.)</button></div>
    <div class="grupo"><span>Voz</span><button class="op ${d.voz === 'h' ? 'on' : ''}" data-c="voz" data-s="h">Masculina</button><button class="op ${d.voz === 'm' ? 'on' : ''}" data-c="voz" data-s="m">Femenina</button><button class="op" id="cr-oir">▶ Oír</button></div>
    <div class="grupo"><span>Piel</span>${sw(PIELES, 'piel')}</div>
    <div class="grupo"><span>Ojos</span>${sw(COLORES_OJOS, 'ojos')}</div>
    <label class="campo">Forma de la cara<input type="range" min="0.9" max="1.1" step="0.01" value="${d.cara}" data-r="cara"></label>
    <label class="campo">Nariz<input type="range" min="0.75" max="1.3" step="0.01" value="${d.nariz}" data-r="nariz"></label>
    ${d.sexo === 'm' ? `<div class="grupo"><span>Pecho</span>${Object.entries(TALLAS_PECHO).map(([k, n]) => `<button class="op ${(d.pecho || 'normal') === k ? 'on' : ''}" data-c="pecho" data-pe="${k}">${n}</button>`).join('')}</div>` : ''}
    <div class="grupo"><span>Peinado</span>${opts(PELOS_NOMBRES, 'estilo')}</div>
    <div class="grupo"><span>Color de pelo</span>${sw(COLORES_PELO, 'pelo')}</div>
    <div class="grupo"><span>Vello facial</span>${opts(BARBAS_NOMBRES, 'barba')}</div>
    <div class="grupo"><span>Gafas</span>${opts(GAFAS_NOMBRES, 'gafas')}</div>
    <label class="campo">Complexión<input type="range" min="0.85" max="1.3" step="0.01" value="${d.complexion}" data-r="complexion"></label>
    <label class="campo">Altura<input type="range" min="0.9" max="1.1" step="0.01" value="${d.altura}" data-r="altura"></label>
    <label class="campo">Edad<input type="range" min="26" max="70" step="1" value="${d.edad}" data-r="edad"></label>
    <div class="grupo"><span>Ropa y bata</span>${ROPA_MEDICO.map(r => `<button class="op ${d.ropa === r ? 'on' : ''}" data-c="ropa" data-ropa="${r}">${ROPAS[r].n}</button>`).join('')}</div>
    <div class="botones pegados">
      <button class="btn sec" id="cr-cara">Ver cara</button><button class="btn sec" id="cr-azar">Aleatorio</button>
      <button class="btn grande" id="cr-ok">${nuevo ? 'Empezar a trabajar' : 'Guardar cambios'}</button>
    </div>`;
  p.classList.add('on');
  let cara = false;
  p.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return; Sonido.clic();
    const c = b.dataset.c;
    if (c && b.dataset.v) d[c] = b.dataset.v;
    else if (c && b.dataset.n !== undefined) d[c] = +b.dataset.n;
    else if (c === 'sexo') { d.sexo = b.dataset.s; d.voz = b.dataset.s; if (d.sexo === 'm') { d.barba = 0; if (d.estilo < 4) d.estilo = 5; d.pecho = d.pecho || 'normal'; } return creadorMedico(nuevo, d); }
    else if (c === 'voz') d.voz = b.dataset.s;
    else if (c === 'ropa') d.ropa = b.dataset.ropa;
    else if (c === 'pecho') d.pecho = b.dataset.pe;
    if (c) { $$(`button[data-c="${c}"]`, p).forEach(x => x.classList.toggle('on', x === b || (c === 'sexo' && x.dataset.s === d.sexo))); if (c === 'sexo') $$('button[data-c="voz"]', p).forEach(x => x.classList.toggle('on', x.dataset.s === d.voz)); refrescar(); }
  };
  $$('input[type=range]', p).forEach(r => r.oninput = () => { d[r.dataset.r] = +r.value; refrescar(); });
  $('#cr-nombre', p).oninput = (e) => { d.nombre = e.target.value; };
  $('#cr-cara', p).onclick = () => { cara = !cara; mundo.giroCreador = cara ? 0 : 0.25; if (cara) mundo.peana.rotation.y = 0; mundo.vistaCreador(cara ? 'cara' : 'cuerpo'); $('#cr-cara', p).textContent = cara ? 'Ver cuerpo' : 'Ver cara'; };
  $('#cr-oir', p).onclick = () => { Voz.hablar(`Buenos días. Soy ${d.sexo === 'm' ? 'la doctora' : 'el doctor'} ${d.nombre || ''}. Pase y siéntese, por favor.`, { genero: d.voz }); };
  $('#cr-azar', p).onclick = () => {
    d.sexo = prob(0.5) ? 'h' : 'm'; d.voz = d.sexo; d.piel = azar(PIELES); d.ojos = azar(COLORES_OJOS); d.pelo = azar(COLORES_PELO);
    d.estilo = d.sexo === 'h' ? azar([0, 1, 2, 3]) : azar([3, 4, 5, 6, 7]); d.barba = d.sexo === 'h' ? entreInt(0, 5) : 0; d.gafas = prob(0.4) ? entreInt(1, 3) : 0;
    d.cara = +entre(0.93, 1.07).toFixed(2); d.nariz = +entre(0.85, 1.2).toFixed(2); d.complexion = +entre(0.9, 1.2).toFixed(2); d.altura = +entre(0.94, 1.06).toFixed(2); d.ropa = azar(ROPA_MEDICO); d.pecho = d.sexo === 'm' ? tallaPecho(40) : null;
    d.nombre = $('#cr-nombre', p).value; if (!d.nombre.trim() || nuevo) { d.nombre = `${azar(d.sexo === 'h' ? NOMBRES_H : NOMBRES_M)} ${azar(APELLIDOS)}`; }
    creadorMedico(nuevo, d);
  };
  $('#cr-ok', p).onclick = () => {
    d.nombre = ($('#cr-nombre', p).value || '').trim() || 'Médico';
    G.doctor = d; guardar();
    mundo.actualizarDoctor(d);
    p.classList.remove('on'); p.onclick = null;
    aviso(`${nombreDoctor()} listo para trabajar`, 'bien');
    if (nuevo) introduccion(); else { volverDeGestion(); }
  };
}

function introduccion() {
  modo = 'consulta'; document.body.dataset.modo = 'juego';
  mundo.mostrar('consulta'); mundo.vistaEscritorio(0);
  hud(); guardar();
  const m = abrirModal(`<h2>Bienvenid${G.doctor.sexo === 'm' ? 'a' : 'o'} al ${esc(G.hospital)}</h2>
    <p>${esc(nombreDoctor())}, hoy empieza tu primera guardia. Tu rutina: por la mañana, ronda por la planta; después, la consulta.</p>
    <p>Examina bien a los pacientes, porque algunos mienten, otros exageran y otros... simplemente fingen. Mejores resultados significan más dinero para ampliar el hospital.</p>
    <p>Y recuerda: <b>tú eres el médico</b>.</p>
    <div class="botones"><button class="btn grande" id="int-ok">Abrir la consulta</button></div>`, { cerrable: false });
  $('#int-ok', m).onclick = () => { m.cerrar(); empezarDia(false); };
}

// ───────────────────────── Ciclo del día ─────────────────────────
// Si hay una IA local (Ollama) en el ordenador, los pacientes responden con ella sin tener que configurar nada.
// Si el jugador eligió el modo a mano en Ajustes, se respeta su elección.
// En el móvil, el juego se abre desde el portátil (JUGAR-EN-EL-MOVIL.cmd) y la IA llega por el puente /ollama de ese servidor.
const puenteIA = () => /^https?:$/.test(location.protocol) ? `${location.origin}/ollama` : null;
async function detectarIA() {
  const ia = G.ajustes.ia;
  if (esApp()) return detectarIAMovil();
  if (ia.manual) return;
  const candidatas = [...new Set([ia.url, puenteIA(), IA_POR_DEFECTO.url].filter(Boolean))];
  for (const url of candidatas) {
    const modelos = await detectarOllama(url);
    if (!modelos.length) continue;
    const nueva = ia.modo !== 'ollama' || ia.url !== url;
    ia.modo = 'ollama'; ia.url = url; ia.modelo = elegirModelo(modelos, ia.modelo); guardar(); actualizarCharla();
    precalentar(ia);
    if (nueva) aviso(`IA ${url.endsWith('/ollama') && !/localhost|127\.0\.0\.1/.test(url) ? 'del portátil' : 'local'} detectada (${ia.modelo}): los pacientes responderán con inteligencia artificial.`, 'bien');
    return;
  }
  // la IA que se encontró otro día ya no está (portátil apagado, otra wifi…): mejor no esperar en cada respuesta
  if (ia.modo === 'ollama') { ia.modo = 'predefinida'; guardar(); actualizarCharla(); aviso('No se encuentra la IA: los pacientes usarán las respuestas predefinidas.', 'mal'); }
}
// ───────────────────────── IA dentro del móvil (aplicación de Android) ─────────────────────────
// Gemma 4 E2B con LiteRT-LM (app-android/…/IALocalPlugin.kt). No necesita Internet ni el portátil:
// sólo hay que descargar el modelo una vez (o importarlo desde un archivo).
const esApp = () => !!window.Capacitor?.isNativePlatform?.() && !!window.Capacitor.Plugins?.IALocal;
const iaMovil = { carga: null, ofrecida: false, aceleracion: '' };
const gb = (b) => (b / 1e9).toFixed(2).replace('.', ',') + ' GB';
async function detectarIAMovil({ ofrecer = true } = {}) {
  const ia = G.ajustes.ia, P = window.Capacitor.Plugins.IALocal;
  if (ia.manual && ia.modo !== 'movil') return;
  let e; try { e = await P.estado(); } catch (err) { aviso(`IA del móvil no disponible: ${err.message}`, 'mal'); return; }
  if (!e.instalado) {
    if (ia.modo === 'movil') { ia.modo = 'predefinida'; guardar(); actualizarCharla(); }
    if (ofrecer && !iaMovil.ofrecida) { iaMovil.ofrecida = true; instalarIAMovil(e); }
    return;
  }
  if (e.cargado) { ia.modo = 'movil'; ia.modelo = e.modelo; actualizarCharla(); return; }
  aviso('Cargando la IA del móvil (Gemma 4 E2B)…', 'info');
  iaMovil.carga = P.cargar({ aceleracion: ia.aceleracion || 'gpu' }).then(r => {
    ia.modo = 'movil'; ia.modelo = e.modelo; iaMovil.aceleracion = r.aceleracion; guardar();
    aviso(`IA del móvil lista (${e.modelo}, ${r.aceleracion === 'gpu' ? 'en la GPU' : 'en el procesador'}, ${(r.ms / 1000).toFixed(1).replace('.', ',')} s). Funciona sin Internet.`, 'bien');
  }).catch(err => {
    ia.modo = 'predefinida'; guardar();
    const mm = abrirModal(`<h2>La IA del móvil no ha arrancado</h2><p>${esc(err.message || String(err))}</p><p>Mientras tanto, los pacientes contestarán con las <b>respuestas predefinidas</b> del juego (lo verás en los subtítulos). Puedes reintentarlo en Ajustes.</p><div class="botones"><button class="btn" id="ia-ok">Entendido</button></div>`);
    $('#ia-ok', mm).onclick = () => mm.cerrar();
  }).finally(() => { iaMovil.carga = null; actualizarCharla(); });
  actualizarCharla();
  return iaMovil.carga;
}
// Pantalla para conseguir el modelo: descargarlo una vez o importarlo desde un archivo
function instalarIAMovil(e) {
  const P = window.Capacitor.Plugins.IALocal;
  const m = abrirModal(`<h2>IA de los pacientes en el móvil</h2>
    <p>Para que los pacientes contesten con inteligencia artificial <b>sin Internet y sin el portátil</b>, el juego necesita el modelo <b>Gemma 4 E2B</b> (${gb(e.total)}, gratuito, licencia Apache 2.0). Se guarda en el móvil y se conserva al actualizar el juego.</p>
    <p class="nota">Espacio libre en el móvil: ${gb(e.libre)}.${e.parcial ? ` Ya hay ${gb(e.parcial)} descargados: la descarga seguirá donde se quedó.` : ''} Conviene usar wifi.</p>
    <div id="ia-prog" class="oculto"><progress id="ia-barra" max="1" value="0" style="width:100%"></progress><p class="nota" id="ia-txt"></p></div>
    <div class="botones"><button class="btn grande" id="ia-desc">Descargar (${gb(e.total - (e.parcial || 0))})</button><button class="btn sec" id="ia-imp">Importar archivo…</button><button class="btn sec" id="ia-no">Ahora no</button></div>
    <p class="nota">«Importar archivo» sirve si ya tienes <i>gemma-4-E2B-it-gpu.litertlm</i> en el móvil (por ejemplo, copiado por USB a Descargas). Mientras no haya modelo, las respuestas serán las predefinidas del juego y se indicará en los subtítulos.</p>`, { cerrable: false });
  let escucha = null;
  const progreso = (d) => { $('#ia-prog', m).classList.remove('oculto'); $('#ia-barra', m).value = d.bytes / d.total; $('#ia-txt', m).textContent = `${gb(d.bytes)} de ${gb(d.total)}`; };
  const bloquear = (b) => $$('#ia-desc,#ia-imp', m).forEach(x => x.disabled = b);
  const terminar = async (accion) => {
    bloquear(true);
    escucha = await P.addListener('progreso', progreso);
    try { await accion(); m.cerrar(); aviso('Modelo de IA instalado en el móvil.', 'bien'); detectarIAMovil({ ofrecer: false }); }
    catch (err) { $('#ia-txt', m).textContent = err.message || String(err); $('#ia-prog', m).classList.remove('oculto'); bloquear(false); }
    finally { escucha?.remove(); }
  };
  $('#ia-desc', m).onclick = () => { $('#ia-no', m).textContent = 'Cancelar'; terminar(() => P.descargar({})); };
  $('#ia-imp', m).onclick = () => terminar(() => P.importar());
  $('#ia-no', m).onclick = () => { P.cancelarDescarga().catch(() => {}); m.cerrar(); actualizarCharla(); };
}
function empezarDia(continuar) {
  document.body.dataset.modo = 'juego';
  detectarIA();
  hud();
  if (!continuar || G.fase === 'nuevo') { G.hora = 8 * 60; G.hoy = { ingresos: 0, gastos: 0, eventos: [], repIni: G.rep }; G.pendientes = Math.min(5, 3 + Math.floor(G.rep / 35) + (G.inst.vip ? 1 : 0)); G.fase = G.ingresados.length ? 'ronda' : 'consulta'; }
  guardar();
  if (G.fase === 'ronda' && G.ingresados.length) empezarRonda();
  else { G.fase = 'consulta'; siguientePaciente(); }
}

// ───────────────────────── CONSULTA ─────────────────────────
let preguntasHechas = 0;
async function siguientePaciente() {
  modo = 'consulta'; cerrarModales();
  if (G.pendientes <= 0) return finDia();
  // depuración: ?caso=<enfermedad>, ?edad=<años> y ?sexo=h|m fuerzan el paciente
  const q = new URLSearchParams(location.search), caso = q.get('caso'), edadQ = q.get('edad') ? +q.get('edad') : null, sexoQ = q.get('sexo');
  for (let i = 0; i < 60; i++) {
    pac = generarPaciente({ dia: G.dia, rep: G.rep, equipos: G.equipos, forzar: caso && ENF[caso] ? caso : null, edadForzada: edadQ });
    if (!sexoQ || pac.sexo === sexoQ) break;
  }
  pac.hallazgos = []; pac.receta = []; pac.notas = ''; pac.charla = [];
  preguntasHechas = 0;
  await fundido(() => {
    mundo.mostrar('consulta');
    [hPac, hAcomp, hPacSin].forEach(h => mundo.quitar(h)); hPacSin = null;
    hPac = mundo.registrar(crearHumano(pac.apariencia, pac.apariencia.ropa || 'paciente'));
    mundo.ponerPacienteConsulta(hPac, pac.edad < 1.5 ? 'portabebes' : 'silla');
    hPac.dolor = ['apendicitis', 'colico_renal', 'infarto', 'fractura_muneca'].includes(pac.enfId);
    hPac.agitado = ['ansiedad', 'infarto', 'neumonia'].includes(pac.enfId);
    acompDentro = !!pac.acompanante;
    if (acompDentro) {
      const mujer = esMujerAcomp(pac);
      // la edad del acompañante depende del parentesco
      const rel = pac.acompanante;
      const edadA = /abuel/.test(rel) ? entreInt(60, 80) : /madre|padre/.test(rel) ? (pac.edad < 18 ? entreInt(26, 48) : entreInt(Math.min(90, pac.edad + 20), Math.min(95, pac.edad + 32))) : /nieto|nieta/.test(rel) ? entreInt(18, 32) : /hija|hijo/.test(rel) ? Math.max(20, Math.min(70, pac.edad - entreInt(24, 34))) : entreInt(25, 60);
      pac.acompEdad = edadA;
      const ap = generarPaciente({ forzar: 'gripe', edadForzada: edadA }).apariencia;
      ap.sexo = mujer ? 'm' : 'h'; ap.pecho = mujer ? tallaPecho(edadA) : null; ap.estilo = mujer ? (edadA > 65 ? azar([4, 6, 6]) : azar([3, 4, 5, 6, 7])) : (edadA > 60 && prob(0.5) ? 0 : azar([1, 2, 3])); ap.barba = mujer ? 0 : ap.barba;
      hAcomp = mundo.registrar(crearHumano(ap, 'calle'));
      mundo.ponerPacienteConsulta(hAcomp, 'acomp');
    }
    mundo.vistaEscritorio(0);
  });
  Sonido.puerta();
  panelConsulta('hablar');
  // nadie habla solo: el saludo del médico queda propuesto en el cuadro, listo para revisar y decir
  reiniciarCharla(); mostrarCharla(true);
  const yo = `${G.doctor.sexo === 'm' ? 'la doctora' : 'el doctor'} ${G.doctor.nombre.split(' ').slice(-1)[0]}`;
  proponer(respondeAcomp(pac) ? `Buenos días. Pasen y siéntense, por favor. Soy ${yo}. ¿Qué le pasa a ${pac.nombre}?` : `Buenos días. Pase y siéntese, por favor. Soy ${yo}. ¿Qué le trae por aquí?`, { id: 'motivo' });
}

function panelConsulta(pestana = 'hablar') {
  const p = $('#panel');
  const e = ENF[pac.enfId];
  p.dataset.pestana = pestana;
  const tabs = [['hablar', 'Hablar'], ['explorar', 'Explorar'], ['pruebas', 'Pruebas'], ['ficha', 'Ficha'], ['decidir', 'Decidir']];
  let cuerpo = '';
  if (pestana === 'hablar') {
    const pre = preguntasDisponibles();
    cuerpo = '<p class="nota pista">Elige una pregunta: aparecerá en el cuadro de abajo. Puedes cambiarla o escribir la tuya, y después pulsa HABLAR MÉDICO.</p>' + pre.map(q => `<button class="pregunta ${pac.preguntas[q.id] ? 'hecha' : ''}" data-q="${q.id}">${esc(q.t)}</button>`).join('');
  } else if (pestana === 'explorar') {
    cuerpo = [['constantes', 'Tomar constantes', 'Temperatura, tensión, pulso y saturación'], ['pulmones', 'Auscultar los pulmones', 'Con el estetoscopio, por la espalda'], ['corazon', 'Auscultar el corazón', 'Con el estetoscopio, por delante'], ['abdomen', 'Palpar el abdomen', 'Busca dónde le duele'], ['garganta', 'Mirar la garganta', 'Con el depresor y la linterna'], ['zona', 'Explorar la zona afectada', 'Inspección y palpación']]
      .map(([id, t, s]) => `<button class="pregunta ${pac.preguntas['ex_' + id] ? 'hecha' : ''}" data-ex="${id}"><b>${t}</b><small>${s}</small></button>`).join('');
  } else if (pestana === 'pruebas') {
    cuerpo = Object.entries(PRUEBAS).map(([id, pr]) => {
      const bloq = pr.requiere && !G.equipos[pr.requiere];
      const precio = id === 'sangre' && G.equipos.labRapido ? pr.precio / 2 : pr.precio;
      return `<button class="pregunta ${pac.pruebas[id] ? 'hecha' : ''} ${bloq ? 'bloq' : ''}" data-pr="${id}"><b>${pr.n}</b><small>${bloq ? 'Necesitas comprar el equipo en Gestión' : `${euros(precio)} · ${pr.min} min`}${pac.pruebas[id] ? ' · ver resultado' : ''}</small></button>`;
    }).join('');
  }
  p.innerHTML = `<div class="pestanas">${tabs.map(([id, n]) => `<button class="${id === pestana ? 'on' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>
    <div class="cuerpo">${cuerpo}</div>
    <div class="pie"><button class="btn sec mini" id="p-gestion">Gestión</button><button class="btn sec mini" id="p-ajustes">⚙</button><span class="quedan">Pacientes en espera: ${G.pendientes - 1}</span></div>`;
  p.classList.add('on');
  $$('[data-tab]', p).forEach(b => b.onclick = () => {
    Sonido.clic();
    if (b.dataset.tab === 'ficha') return verFicha();
    if (b.dataset.tab === 'decidir') return decidir();
    panelConsulta(b.dataset.tab);
  });
  $$('[data-q]', p).forEach(b => b.onclick = () => preguntar(b.dataset.q));
  $$('[data-ex]', p).forEach(b => b.onclick = () => explorar(b.dataset.ex));
  $$('[data-pr]', p).forEach(b => b.onclick = () => pedirPrueba(b.dataset.pr));
  $('#p-gestion', p).onclick = () => gestion();
  $('#p-ajustes', p).onclick = ajustes;
}

function preguntasDisponibles() {
  const e = ENF[pac.enfId], d = dialogo(pac);
  if (respondeAcomp(pac)) {
    const n = pac.nombre, a = pac.sexo === 'm' ? 'a' : 'o';
    const l = [
      { id: 'motivo', t: `Buenos días. ¿Qué le pasa a ${n}?` },
      { id: 'inicio', t: '¿Desde cuándo le pasa?' },
      { id: 'dolor', t: '¿Se queja de algún dolor? ¿Dónde?' },
      { id: 'fiebre', t: '¿Ha tenido fiebre?' },
      { id: 'habitos', t: pac.edad < 13 ? '¿Qué tal come? ¿Cómo está en casa?' : '¿Qué hábitos tiene? ¿Fuma, bebe?' },
      { id: 'antecedentes', t: pac.edad < 13 ? '¿Tiene alguna enfermedad? ¿Lleva las vacunas al día?' : '¿Qué enfermedades tiene? ¿Qué medicación toma?' },
      { id: 'alergia', t: '¿Es alérgic' + a + ' a algún medicamento o alimento?' },
    ];
    if (d.extra) l.push({ id: 'extra', t: '¿Han notado algo más?' });
    l.push({ id: 'calmar', t: pac.edad < 2 ? `(Al bebé) ¿Quién es ${a === 'a' ? 'la bonita' : 'el bonito'} de la consulta? Tranquil${a}...` : pac.edad < 13 ? `Tranquil${a}, ${a === 'a' ? 'campeona' : 'campeón'}, que no te voy a hacer daño.` : 'Tranquilos, está en buenas manos.' });
    if (acompDentro) l.push({ id: 'acomp', t: '¿Le importaría esperar fuera un momento?' });
    if (pac.edad >= 3) l.push({ id: 'secreto', t: pac.edad < 13 ? `${n}, ¿hay algo que no nos hayas contado? No pasa nada.` : '¿Hay algo más que deba saber? Todo es confidencial.' });
    l.push({ id: 'presionar', t: 'Creo que no me están contando toda la verdad.' });
    return l;
  }
  const l = [
    { id: 'motivo', t: 'Buenos días. ¿Qué le trae por aquí?' },
    { id: 'inicio', t: '¿Desde cuándo le pasa?' },
    { id: 'dolor', t: '¿Dónde le duele exactamente? ¿Cómo es el dolor?' },
    { id: 'fiebre', t: '¿Ha tenido fiebre o escalofríos?' },
    { id: 'habitos', t: '¿Fuma? ¿Bebe alcohol? ¿Qué suele comer?' },
    { id: 'antecedentes', t: '¿Tiene alguna enfermedad o toma medicación?' },
    { id: 'alergia', t: '¿Es alérgico a algún medicamento o alimento?' },
  ];
  if (d.extra) l.push({ id: 'extra', t: '¿Ha notado algo más, aunque le parezca una tontería?' });
  l.push({ id: 'calmar', t: 'Tranquilo. Está en buenas manos, puede confiar en mí.' });
  if (acompDentro) l.push({ id: 'acomp', t: '¿Le importaría a su acompañante esperar fuera un momento?' });
  l.push({ id: 'secreto', t: '¿Hay algo más que deba saber? Todo es confidencial.' });
  l.push({ id: 'presionar', t: 'Creo que no me está contando toda la verdad.' });
  return l.map(q => ({ ...q, t: q.id === 'calmar' && pac.sexo === 'm' ? q.t.replace('Tranquilo', 'Tranquila') : q.t }));
}
function anotar(texto) { if (!pac.hallazgos.includes(texto)) pac.hallazgos.push(texto); }

// Elegir una pregunta del panel sólo la escribe en el cuadro: el médico la dice al pulsar HABLAR MÉDICO
function preguntar(id) {
  const q = preguntasDisponibles().find(x => x.id === id);
  if (!q) return;
  Sonido.clic();
  ponerTextoMedico(q.t, { id });
}
const MECANICA = ['motivo', 'inicio', 'dolor', 'fiebre', 'habitos', 'antecedentes', 'alergia', 'extra', 'calmar', 'acomp', 'secreto', 'presionar'];
// Respuesta a lo último que ha dicho el médico en la consulta
async function responderPregunta(p) {
  const e = ENF[pac.enfId], d = dialogo(pac);
  // «¿Qué le pasa y desde cuándo?»: se contesta a las dos cosas
  const todas = p.id ? [p.id] : intenciones(p.texto);
  const id = !p.id && todas.includes('motivo') ? 'motivo' : (p.id || clasificar(p.texto));
  const anadidos = id === 'motivo' ? todas.filter(x => ['inicio', 'fiebre'].includes(x) && d[x]) : [];
  // quién contesta: los padres (o los hijos de un mayor confuso) o el propio paciente; si el médico habla de tú al niño, contesta el niño
  let quien = respondeAcomp(pac) && acompDentro && !['calmar', 'secreto'].includes(id) ? 'acomp' : 'paciente';
  // al niño se le pregunta de tú qué le pasa o dónde le duele; los antecedentes, alergias o fechas los saben sus padres
  const ninoContesta = quien === 'acomp' && pac.edad >= 3 && hablaDeTu(p.texto) && ['motivo', 'dolor', 'fiebre', 'general'].includes(id);
  if (ninoContesta) quien = 'paciente';
  if (!MECANICA.includes(id)) {
    const ref = respuestaGeneral(pac, id, quien);
    return responderCon(quien, quien === 'acomp' ? generoNino(ref, pac) : ref);
  }
  const repetida = pac.preguntas[id];
  const primera = (pac.charla || []).filter(h => h.quien === 'medico').length <= 1;
  pac.preguntas[id] = true; preguntasHechas++;
  pasarTiempo(2);
  if ($('#panel').dataset.pestana === 'hablar' && modo === 'consulta') panelConsulta('hablar');
  let r = '', fija = false;
  const tieneSecreto = e.secreto && (pac.enfId !== 'infarto' || pac.tomoViagra);
  switch (id) {
    case 'motivo': r = fmt(azar(d.motivo), pac); anotar(`Síntomas: ${e.sintomas.slice(0, 2).join(', ').toLowerCase()}`); break;
    case 'inicio': r = fmt(azar(d.inicio), pac); anotar(`Inicio: ${r.replace(/\.$/, '')}`); break;
    case 'dolor': r = fmt(azar(d.dolor), pac); anotar(`Dolor: ${r.replace(/\.$/, '')}`); break;
    case 'fiebre': r = fmt(azar(d.fiebre), pac); break;
    case 'habitos': r = fmt(fraseHabitos(pac), pac); anotar(`Hábitos: ${r}`); break;
    case 'antecedentes': r = fraseAntecedentes(pac); pac.antecedentesVistos = true; break;
    case 'alergia': r = fmt(fraseAlergia(pac), pac); anotar(`Alergias: ${pac.alergia || 'ninguna conocida'}`); break;
    case 'extra': r = fmt(azar(d.extra), pac); anotar(r); break;
    case 'calmar': pac.confianza++;
      if (pac.edad < 1.5) r = azar(['(sonríe) Agú, agú.', '(deja de llorar y le mira con los ojos muy abiertos)']);
      else if (pac.edad < 13) r = azar(['Vale...', '¿Me vas a pinchar?', '(asiente con la cabeza)', 'Mi mamá dice que eres muy bueno.']);
      else if (e.respondeAcomp) r = azar(['¿Y usted quién es? ¿Ha visto a mi Manolo?', 'Hay que ir a recoger a los niños del colegio...']);
      else r = fmt(azar(['Gracias, doctor. Es que estoy muy preocupad{o}.', 'Vale... me quedo más tranquil{o}.', 'Se agradece, doctor.']), pac);
      break;
    case 'acomp':
      if (!acompDentro) { r = respuestaGeneral(pac, 'general', 'paciente'); break; }
      if (pac.edad < 10 || e.respondeAcomp) {
        await responderCon('acomp', pac.edad < 10 ? `¿Dejarle solo? ¡Pero si tiene ${textoEdad(pac.edad)}! Yo de aquí no me muevo.` : 'Prefiero quedarme, doctor. Así no se aclara, está muy desorientada.'.replace('desorientada', pac.sexo === 'm' ? 'desorientada' : 'desorientado'));
        panelConsulta('hablar');
        return;
      }
      await responderCon('acomp', azar(['Claro, claro. Espero fuera.', 'Bueno... vale. Estaré en la sala de espera.', '¿Yo? Bueno, como quiera.']));
      await fundido(() => { mundo.quitar(hAcomp); hAcomp = null; acompDentro = false; }, 250);
      Sonido.puerta(); pac.confianza++;
      panelConsulta('hablar');
      return;
    case 'secreto':
      if (tieneSecreto && !pac.secretoRevelado) {
        const v = e.secreto.v - (G.personal.psicologo ? 1 : 0);
        if (acompDentro && v >= 2) { r = '(mira de reojo a su acompañante) No... no, doctor. Nada más.'; aviso('Parece que no quiere hablar delante de su acompañante', 'info'); }
        else if (pac.confianza >= v) { r = e.secreto.t; fija = true; pac.secretoRevelado = true; anotar(`Confesión: ${e.secreto.hallazgo}`); Sonido.exito(); }
        else { r = azar(['Eh... no, nada más, doctor.', 'No, no. Eso es todo.']); aviso('Se guarda algo. Quizá necesite más confianza.', 'info'); }
      } else r = pac.edad < 13 ? azar(['No...', '(niega con la cabeza)', 'Que me duele.']) : e.respondeAcomp ? '¿Usted es el del gas?' : repetida ? 'Ya se lo he contado todo, doctor.' : azar(['No, doctor. Le he contado todo.', 'Nada más, que yo sepa.']);
      break;
    case 'presionar':
      if (e.simulador && pac.confianza >= 1 && !pac.secretoRevelado) { r = e.secreto.t; fija = true; pac.secretoRevelado = true; anotar(`Confesión: ${e.secreto.hallazgo}`); }
      else if (tieneSecreto && !pac.secretoRevelado && pac.confianza >= e.secreto.v + 1) { r = e.secreto.t; fija = true; pac.secretoRevelado = true; anotar(`Confesión: ${e.secreto.hallazgo}`); }
      else if (respondeAcomp(pac) && acompDentro) { quien = 'acomp'; pac.molesto = (pac.molesto || 0) + 1; r = generoNino(azar(['¿Cómo que no le cuento la verdad? ¡Que es mi hijo!', 'Oiga, que venimos preocupados, no a que nos interroguen.']), pac); }
      else { pac.confianza = Math.max(0, pac.confianza - 1); pac.molesto = (pac.molesto || 0) + 1; r = azar(['¿Me está llamando mentiros{o}? Lo que me faltaba.', 'Oiga, que yo vengo a que me curen, no a que me interroguen.']); r = fmt(r, pac); }
      break;
  }
  for (const a of anadidos) { const t = fmt(azar(d[a]), pac); if (a === 'inicio') anotar(`Inicio: ${t.replace(/\.$/, '')}`); pac.preguntas[a] = true; r += ` ${t}`; }
  // el niño contesta con sus propias palabras; lo que explicarían sus padres queda para cuando se pulse RESPONDER otra vez
  let extraPadre = null;
  if (ninoContesta) {
    extraPadre = acompDentro ? generoNino(r, pac) : null;
    r = d.nino && ['motivo', 'dolor'].includes(id) ? azar(d.nino) : id === 'fiebre' ? azar(['Estoy calentito...', 'No sé... mi mamá me puso el termómetro.', 'Tengo frío y calor.']) : azar(['Me encuentro malito...', 'No sé... me duele.', '(mira a su familia) Ellos lo saben.']);
  }
  if (quien === 'paciente' && pac.edad < 1.5 && !['calmar'].includes(id)) r = azar(['(llora) ¡Buaaa!', '(balbucea) Ta-ta-ta...', '(se mete el puño en la boca)']);
  if (quien === 'acomp') r = generoNino(r, pac);
  // saludo en la primera respuesta, si el médico ha saludado
  if (primera && id === 'motivo' && /\b(buen|hola)/.test(normaliza(p.texto)) && !(quien === 'paciente' && pac.edad < 1.5)) {
    const saludo = quien === 'acomp' ? 'Buenos días, doctor.' : pac.edad < 13 ? 'Hola...' : pac.edad > 75 ? 'Buenos días. Ay, qué joven es usted.' : 'Buenos días, doctor.';
    r = `${saludo} ${r}`;
  }
  await responderCon(quien, r, { fija });
  // Algo que alguien quiere añadir: sólo se dice si el jugador pulsa RESPONDER PACIENTE otra vez
  if (extraPadre) charla.pendiente = { ctx: { tipo: 'extra', quien: 'acomp', referencia: extraPadre } };
  else if (pac.cuestiona && preguntasHechas >= 3 && !pac.cuestionado) { pac.cuestionado = true; charla.pendiente = { ctx: { tipo: 'cuestiona' } }; }
  else if (quien === 'acomp' && pac.edad >= 3 && pac.edad < 10 && d.nino && ['motivo', 'dolor'].includes(id) && prob(0.6)) charla.pendiente = { ctx: { tipo: 'extra', quien: 'paciente', referencia: azar(d.nino) } };
  else if (id === 'motivo' && acompDentro && !respondeAcomp(pac) && prob(0.5)) charla.pendiente = { ctx: { tipo: 'extra', quien: 'acomp', referencia: azar(['Y no come nada, doctor. Nada.', 'Y por las noches no deja dormir a nadie.', 'Yo ya le dije que viniera hace una semana.']) } };
  actualizarCharla();
}
// El paciente cuestiona la autoridad del médico; las posibles respuestas se proponen en el cuadro
async function responderCuestiona() {
  await responderCon('paciente', pac.cuestiona);
  const m = abrirModal(`<h3>¿Qué le respondes?</h3><p class="nota">La respuesta aparecerá en el cuadro. Puedes cambiarla antes de pulsar HABLAR MÉDICO.</p>${RESPUESTAS_AUTORIDAD.map(([t], i) => `<button class="pregunta" data-i="${i}">${esc(t)}</button>`).join('')}`, { clase: 'pequeno' });
  $$('[data-i]', m).forEach(b => b.onclick = () => {
    m.cerrar(); const [t, v] = RESPUESTAS_AUTORIDAD[+b.dataset.i];
    ponerTextoMedico(t, { ctx: { tipo: 'autoridad', v } });
  });
}
async function responderAutoridad(v) {
  pac.satisfaccion = (pac.satisfaccion || 0) + v;
  await responderCon('paciente', v > 0 ? 'Vale, vale. Usted sabrá, que para eso estudió.' : v === 0 ? 'Hmm... bueno.' : '¡Qué humos! Pues vaya.');
}

// ───── Exploración ─────
async function explorar(id) {
  if (hablandoN) return;
  Sonido.clic();
  const e = ENF[pac.enfId], ex = e.expl, v = pac.vit;
  pac.preguntas['ex_' + id] = true;
  pasarTiempo(4);
  if (id === 'constantes') {
    narrar('Vamos a tomarle la tensión, la temperatura y el pulso.');
    const fuera = (x, a, b) => x < a || x > b ? 'mal' : '';
    abrirModal(`<h2>Constantes vitales</h2><div class="constantes">
      <div class="${fuera(v.temp, 35.8, 37.4)}"><small>Temperatura</small><b>${v.temp.toFixed(1)} °C</b></div>
      <div class="${v.tas > 140 || v.tas < 95 ? 'mal' : ''}"><small>Tensión</small><b>${v.tas}/${v.tad}</b><small>mmHg</small></div>
      <div class="${fuera(v.fc, 55, 100)}"><small>Pulso</small><b>${v.fc}</b><small>lpm</small></div>
      <div class="${v.sat < 94 ? 'mal' : ''}"><small>Saturación O₂</small><b>${v.sat} %</b></div>
      <div class="${fuera(v.fr, 11, 20)}"><small>Respiraciones</small><b>${v.fr}</b><small>/min</small></div></div>`, { clase: 'pequeno' });
    anotar(`Constantes: ${v.temp.toFixed(1)} °C, TA ${v.tas}/${v.tad}, FC ${v.fc}, SatO₂ ${v.sat}%, FR ${v.fr}`);
    return;
  }
  if (id === 'pulmones' || id === 'corazon') return auscultar(id);
  if (id === 'abdomen') return palpar();
  if (id === 'garganta') {
    narrar('Abra la boca y diga «aaaa».');
    const m = abrirModal(`<h2>Garganta</h2><canvas width="420" height="320" class="imagen"></canvas><p>${{ normal: 'Faringe y amígdalas normales.', roja: 'Faringe enrojecida, sin placas.', placas: 'Amígdalas hinchadas con placas de pus.' }[ex.garganta]}</p>`, { clase: 'pequeno' });
    dibujarGarganta($('canvas', m).getContext('2d'), 420, 320, ex.garganta);
    anotar(`Garganta: ${{ normal: 'normal', roja: 'enrojecida', placas: 'placas de pus en amígdalas' }[ex.garganta]}`);
    await reaccion('Aaaaaaa...');
    return;
  }
  if (id === 'zona') {
    narrar('A ver, déjeme ver la zona... ¿Le duele aquí?');
    abrirModal(`<h2>Exploración</h2><p class="manuscrito">${esc(ex.zona)}</p>`, { clase: 'pequeno' });
    anotar(`Exploración: ${ex.zona}`);
    await reaccion(e.simulador ? azar(['¡Ay! Sí... bueno, no. Un poco. Creo.', 'Ahí... o un poco más arriba. Me duele todo.']) : azar(['¡Ay! Sí, ahí, ahí.', 'Uf, con cuidado, doctor.', 'Ahí me molesta, sí.']));
  }
}

// ───── Estetoscopio ─────
let esteto = null;
async function auscultar(tipo) {
  const e = ENF[pac.enfId];
  const peque = pac.edad < 3 || pac.enfId === 'fractura_cadera';
  await narrar(pac.enfId === 'fractura_cadera' ? 'No se mueva, que la ayudamos a tumbarse en la camilla. Despacito.' : peque ? 'Vamos a tumbar al bebé en la camilla y a quitarle la ropita de arriba. Así, con cuidado.' : pac.edad < 13 ? (tipo === 'pulmones' ? 'Quítate la camiseta y ponte de espaldas, que te voy a escuchar. Está un poco frío, ¿eh?' : 'Ponte aquí de pie, que te escucho el corazón. ¿Me dejas?') : tipo === 'pulmones' ? 'Póngase de pie y quítese la bata de arriba, por favor. Voy a escucharle la espalda.' : 'Póngase de pie, por favor. Voy a escucharle el corazón.');
  modo = 'esteto'; document.body.dataset.modo = 'esteto';
  await fundido(() => {
    hPac.raiz.visible = false;
    if (!hPacSin) { hPacSin = mundo.registrar(crearHumano(pac.apariencia, ropaSin(pac.apariencia))); hPacSin.agitado = hPac.agitado; }
    hPacSin.raiz.visible = true;
    mundo.ponerPacienteConsulta(hPacSin, peque ? (tipo === 'pulmones' ? 'camilla_abajo' : 'camilla_arriba') : tipo === 'pulmones' ? 'espalda' : 'frente');
    if (hAcomp) hAcomp.mirar = new THREE.Vector3(2.9, 1.4, -0.6);
    mundo.vistaExplorar(tipo === 'pulmones' ? 'espalda' : 'pecho', 0, hPacSin);
  });
  const anclas = tipo === 'pulmones' ? hPacSin.partes.puntos.espalda : hPacSin.partes.puntos.pecho;
  // marcadores
  mundo.marcadores.clear();
  const marcas = anclas.map(a => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.019, 32), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false }));
    m.renderOrder = 10; mundo.marcadores.add(m); return m;
  });
  const sonidoDe = (i) => {
    if (tipo === 'corazon') return { normal: 'corazon_normal', taquicardia: 'corazon_normal', arritmia: 'corazon_arritmia', soplo: 'corazon_soplo' }[e.expl.corazon] || 'corazon_normal';
    const pl = e.expl.pulmon; const derecha = i % 2 === 0; // puntos pares: lado derecho del paciente
    if (pl === 'normal') return 'normal';
    if (pl === 'sibilancias') return 'sibilancias';
    const [t, lado] = pl.split('_');
    const base = i >= 2; // las bases suenan peor
    if (lado === 'ambos' || (lado === 'der' && derecha) || (lado === 'izq' && !derecha)) return (t === 'crepitantes' && !base && i < 2) ? 'normal' : t;
    return 'normal';
  };
  esteto = { tipo, anclas, marcas, oidos: new Set(), cerca: -1, t: 0, parar: null, sonidos: anclas.map((_, i) => sonidoDe(i)) };
  $('#esteto-hud').innerHTML = `<div class="tarjeta"><b>${tipo === 'pulmones' ? 'AUSCULTA LOS PULMONES DEL PACIENTE CON EL ESTETOSCOPIO' : 'AUSCULTA EL CORAZÓN CON EL ESTETOSCOPIO'}</b>
    <div class="cont"><span id="es-n">0/${anclas.length}</span><small>Mueve el estetoscopio sobre los círculos y espera a oír.</small></div>
    <button class="btn" id="es-fin">Dejar de escuchar</button></div>`;
  $('#es-fin').onclick = terminarAuscultacion;
  mundo.esteto.visible = true;
  const r = canvas.getBoundingClientRect();
  moverEsteto(r.left + r.width / 2, r.top + r.height / 2);
}
function moverEsteto(x, y) {
  if (!esteto) return;
  const hit = mundo.rayo(x, y, [hPacSin.partes.torso]);
  if (!hit) return;
  const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
  mundo.esteto.position.copy(hit.point).addScaledVector(n, 0.004);
  mundo.esteto.lookAt(hit.point.clone().add(n));
  esteto.pos = hit.point.clone();
}
mundoActualizar(() => {
  if (!esteto) return;
  const dt = 1 / 60; const w = new THREE.Vector3();
  let cerca = -1;
  esteto.anclas.forEach((a, i) => {
    a.getWorldPosition(w);
    const m = esteto.marcas[i]; m.position.copy(w); m.lookAt(mundo.camara.position);
    m.material.color.set(esteto.oidos.has(i) ? '#4dff88' : '#ffffff');
    m.scale.setScalar(1 + Math.sin(performance.now() / 200 + i) * 0.12);
    if (esteto.pos && esteto.pos.distanceTo(w) < 0.035) cerca = i;
  });
  if (cerca !== esteto.cerca) { esteto.cerca = cerca; esteto.t = 0; if (esteto.parar) { esteto.parar(); esteto.parar = null; } }
  if (cerca >= 0) {
    esteto.t += dt;
    if (esteto.t > 0.6 && !esteto.parar) esteto.parar = Sonido.escuchar(esteto.sonidos[cerca], pac.vit.fc);
    if (esteto.t > 2.2 && !esteto.oidos.has(cerca)) { esteto.oidos.add(cerca); $('#es-n') && ($('#es-n').textContent = `${esteto.oidos.size}/${esteto.anclas.length}`); Sonido.clic(); }
  }
});
function mundoActualizar(fn) { if (mundo) mundo.alActualizar.push(fn); else pendientesMundo.push(fn); }
async function terminarAuscultacion() {
  if (!esteto) return;
  if (esteto.parar) esteto.parar();
  const e = ENF[pac.enfId];
  const oidos = esteto.oidos.size, tipo = esteto.tipo;
  esteto = null; mundo.marcadores.clear(); mundo.esteto.visible = false;
  $('#esteto-hud').innerHTML = '';
  if (oidos >= 2) {
    if (tipo === 'pulmones') { const t = { normal: 'murmullo vesicular normal', sibilancias: 'sibilancias (pitos) en ambos pulmones', crepitantes_der: 'crepitantes en la base derecha', crepitantes_izq: 'crepitantes en la base izquierda', crepitantes_ambos: 'crepitantes en las dos bases', disminuido_izq: 'murmullo disminuido en el pulmón izquierdo', disminuido_der: 'murmullo disminuido en el pulmón derecho' }[e.expl.pulmon]; anotar(`Auscultación pulmonar: ${t}`); aviso(`Oyes: ${t}`, 'info'); }
    else { const t = { normal: 'tonos rítmicos, sin soplos', taquicardia: 'tonos rítmicos y rápidos (taquicardia)', arritmia: 'ritmo irregular', soplo: 'soplo suave' }[e.expl.corazon]; anotar(`Auscultación cardíaca: ${t}`); aviso(`Oyes: ${t}`, 'info'); }
  } else aviso('No has escuchado lo suficiente para sacar conclusiones', 'mal');
  await fundido(() => { hPacSin.raiz.visible = false; hPac.raiz.visible = true; if (hAcomp) hAcomp.mirar = new THREE.Vector3(0, 1.26, 1.62); mundo.vistaEscritorio(0); });
  modo = 'consulta'; document.body.dataset.modo = 'juego';
  narrar(pac.edad < 3 ? 'Ya está. Ya pueden vestirle.' : pac.edad < 13 ? '¡Muy bien! Eres muy valiente. Ya te puedes vestir.' : 'Muy bien, ya puede sentarse.');
  if (pac.edad < 1.5 && prob(0.6)) reaccion('(llora) ¡Buaaa!');
}

// ───── Palpación ─────
function palpar() {
  const e = ENF[pac.enfId]; const zona = e.expl.palpacion.zona;
  narrar('Túmbese en la camilla. Voy a apretarle un poco la barriga; dígame si le duele.');
  const regiones = [['hcd', 'Hipocondrio der.'], ['epigastrio', 'Epigastrio'], ['hci', 'Hipocondrio izq.'], ['flanco_der', 'Flanco der.'], ['umbilical', 'Ombligo'], ['flanco_izq', 'Flanco izq.'], ['fid', 'Fosa ilíaca der.'], ['hipogastrio', 'Hipogastrio'], ['fii', 'Fosa ilíaca izq.'], ['ingle_der', 'Ingle der.'], ['ingle_izq', 'Ingle izq.']];
  const m = abrirModal(`<h2>Palpación abdominal</h2><p class="nota">Toca las zonas para palpar. La derecha del paciente está a tu izquierda.</p>
    <div class="abdomen">${regiones.map(([id, n]) => `<button data-z="${id}" class="${id.startsWith('ingle') ? 'ingle' : ''}">${n}</button>`).join('')}</div>`, { clase: 'pequeno', alCerrar: () => { if (tocadas.size >= 3) anotar(`Palpación: ${e.expl.palpacion.texto}`); } });
  const tocadas = new Set();
  $$('[data-z]', m).forEach(b => b.onclick = () => {
    if (hablandoN > 1) return;
    const z = b.dataset.z; tocadas.add(z);
    const duele = zona === z || (zona === 'fosa_lumbar' && z === 'flanco_der') || (zona === 'ingle' && z === 'ingle_der') || (zona === 'difuso') || (zona === 'cambiante' && Math.random() < 0.5);
    const fuerte = zona === z || (zona === 'fosa_lumbar' && z === 'flanco_der') || (zona === 'ingle' && z === 'ingle_der');
    b.classList.add(fuerte ? 'dolor' : duele ? 'molestia' : 'nada');
    if (pac.edad < 2) { if (fuerte || (duele && prob(0.5))) { hPac.dolor = true; reaccion('(llora) ¡Buaaa! ¡Buaaaa!'); } else if (prob(0.3)) reaccion('(se ríe) Je, je.'); return; }
    if (fuerte) { Sonido.ay(); hPac.dolor = true; reaccion(pac.edad < 13 ? azar(['¡Ay! ¡Ahí no, ahí no!', '¡Que me duele!', '(empieza a llorar) ¡Mamá!']) : azar(['¡AY! ¡Ahí, ahí! ¡No apriete!', '¡Uuuh! Ahí me duele muchísimo.', '¡Ay, por Dios, doctor!'])); }
    else if (duele) reaccion(zona === 'cambiante' ? azar(['¡Ay!... bueno, no, ahí no. ¿O sí?', 'Ahí también... creo.']) : azar(['Ahí me molesta un poco.', 'Hmm, un poco.']));
    else if (prob(0.4)) reaccion(azar(['Ahí no.', 'No, ahí nada.', 'Eso me hace cosquillas.']));
    if (tocadas.size === 3) anotar(`Palpación: ${e.expl.palpacion.texto}`);
  });
}

// ───── Pruebas ─────
function pedirPrueba(id) {
  const pr = PRUEBAS[id];
  if (pr.requiere && !G.equipos[pr.requiere]) { aviso('Primero tienes que comprar el equipo en Gestión', 'mal'); return; }
  if (pac.pruebas[id] && id !== 'rx') return verPrueba(id);
  if (id === 'rx') {
    const m = abrirModal(`<h2>Radiografía</h2><p>¿Qué zona quieres radiografiar? (${euros(pr.precio)})</p>${Object.entries(ZONAS_RX).map(([z, n]) => `<button class="pregunta ${pac.pruebas.rx?.[z] ? 'hecha' : ''}" data-z="${z}">${n}${pac.pruebas.rx?.[z] ? ' · ver' : ''}</button>`).join('')}`, { clase: 'pequeno' });
    $$('[data-z]', m).forEach(b => b.onclick = () => { m.cerrar(); const z = b.dataset.z; if (!pac.pruebas.rx?.[z]) { pac.pruebas.rx = { ...(pac.pruebas.rx || {}), [z]: { circulos: 0 } }; dinero(-pr.precio, `Radiografía de ${ZONAS_RX[z].toLowerCase()}`); pasarTiempo(pr.min); } verPrueba('rx', z); panelConsulta('pruebas'); });
    return;
  }
  const precio = id === 'sangre' && G.equipos.labRapido ? pr.precio / 2 : pr.precio;
  pac.pruebas[id] = { circulos: 0 };
  dinero(-precio, pr.n);
  pasarTiempo(pr.min);
  if (id === 'tac' || id === 'eco') narrar(`Vamos a hacerle ${id === 'tac' ? 'un TAC' : 'una ecografía'}. No se preocupe, no duele.`);
  if (id === 'sangre') reaccion(azar(['¿Pincho? Uy, que me mareo con la sangre...', 'Vale, pero con cuidado, que tengo las venas finas.']));
  panelConsulta('pruebas');
  verPrueba(id);
}
function verPrueba(id, zonaRx) {
  const e = ENF[pac.enfId];
  if (id === 'sangre') {
    const filas = SANGRE.map(p => { const v = pac.sangre[p.k]; const alto = v > p.r[1], bajo = v < p.r[0] && p.r[0] > 0; return `<tr class="${alto || bajo ? 'mal' : ''}"><td>${p.n}</td><td><b>${v.toLocaleString('es-ES')}</b> ${alto ? '↑' : bajo ? '↓' : ''}</td><td>${p.u}</td><td>${p.r[0].toLocaleString('es-ES')} – ${p.r[1].toLocaleString('es-ES')}</td></tr>`; }).join('');
    abrirModal(`<h2>Análisis de sangre</h2><table class="tabla"><tr><th>Parámetro</th><th>Valor</th><th>Unidad</th><th>Referencia</th></tr>${filas}</table>`);
    const malos = SANGRE.filter(p => pac.sangre[p.k] > p.r[1] || (pac.sangre[p.k] < p.r[0] && p.r[0] > 0)).map(p => `${p.n} ${pac.sangre[p.k] > p.r[1] ? 'alta' : 'baja'}`);
    anotar(`Análisis de sangre: ${malos.length ? malos.join(', ') : 'normal'}`);
    return;
  }
  if (id === 'orina') {
    abrirModal(`<h2>Análisis de orina</h2><table class="tabla"><tr><th>Parámetro</th><th>Resultado</th></tr>${ORINA.map(p => `<tr class="${pac.orina[p.k] !== 'Negativo' ? 'mal' : ''}"><td>${p.n}</td><td><b>${pac.orina[p.k]}</b></td></tr>`).join('')}</table>`);
    const malos = ORINA.filter(p => pac.orina[p.k] !== 'Negativo').map(p => `${p.n.toLowerCase()} ${pac.orina[p.k]}`);
    anotar(`Orina: ${malos.length ? malos.join(', ') : 'normal'}`);
    return;
  }
  if (id === 'ecg') {
    const pr = e.pruebas.ecg;
    const m = abrirModal(`<h2>Electrocardiograma</h2><canvas width="900" height="380" class="imagen ecg"></canvas>
      <div id="ecg-int">${G.personal.cardiologo ? `<p class="informe"><b>Informe del cardiólogo:</b> ${esc(pr.texto)}</p>` : `<p>¿Cómo interpretas el trazado?</p><div class="botones"><button class="btn sec" data-i="normal">Normal</button><button class="btn sec" data-i="taqui">Taquicardia</button><button class="btn sec" data-i="st">Infarto (ST elevado)</button></div>`}</div>`);
    dibujarEcg($('canvas', m).getContext('2d'), 900, 380, pr.tipo, pac.vit.fc);
    if (G.personal.cardiologo) anotar(`ECG: ${pr.texto}`);
    $$('[data-i]', m).forEach(b => b.onclick = () => {
      const ok = b.dataset.i === pr.tipo;
      $('#ecg-int', m).innerHTML = `<p class="informe ${ok ? 'ok' : 'mal'}">${ok ? '¡Bien leído! ' : 'No es correcto. '}<b>Informe:</b> ${esc(pr.texto)}</p>`;
      anotar(`ECG: ${pr.texto}`); if (ok) { Sonido.exito(); reputacion(0.5); } else Sonido.fallo();
    });
    return;
  }
  // imágenes: rx, eco, tac → rodear la zona sospechosa
  let datos, titulo2;
  if (id === 'rx') { const pr = e.pruebas.rx; const coincide = pr.zona === zonaRx; datos = { zona: zonaRx, hallazgo: coincide ? pr.hallazgo : 'normal', lado: pr.lado, texto: coincide ? pr.texto : 'Sin hallazgos significativos.', est: pac.pruebas.rx[zonaRx] }; titulo2 = `Radiografía de ${ZONAS_RX[zonaRx].toLowerCase()}`; }
  if (id === 'eco') { const pr = e.pruebas.eco; datos = { hallazgo: pr.hallazgo, texto: pr.texto, est: pac.pruebas.eco }; titulo2 = 'Ecografía'; }
  if (id === 'tac') { const pr = e.pruebas.tac; datos = { zona: pr.zona, hallazgo: pr.hallazgo, lado: pr.lado, texto: pr.texto, est: pac.pruebas.tac }; titulo2 = `TAC de ${ZONAS_RX[pr.zona]?.toLowerCase() || 'tórax'}`; }
  const m = abrirModal(`<div class="rx-cab"><span>›</span> RODEA LA ZONA SOSPECHOSA</div><h2>${titulo2}</h2>
    <div class="rx-marco"><canvas width="512" height="512" class="imagen rx"></canvas><canvas width="512" height="512" class="rx-dibujo"></canvas></div>
    <div id="rx-inf"></div><div class="botones"><button class="btn sec" id="rx-nada">No veo nada anormal</button></div>`, { clase: 'rx-modal' });
  const ctx = $('canvas.rx', m).getContext('2d');
  const seed = pac.id * 13 + (zonaRx || id).length;
  const roi = id === 'rx' ? dibujarRx(ctx, 512, 512, { ...datos, seed }) : id === 'tac' ? dibujarTac(ctx, 512, 512, { ...datos, seed }) : dibujarEco(ctx, 512, 512, { ...datos, seed });
  const inf = $('#rx-inf', m);
  const informe = (ok) => { inf.innerHTML = `<p class="informe ${ok ? 'ok' : ''}"><b>Informe${G.personal.radiologo ? ' del radiólogo' : ''}:</b> ${esc(datos.texto)}</p>`; anotar(`${titulo2}: ${datos.texto}`); };
  if (G.personal.radiologo || datos.est.visto) informe(true);
  const dib = $('canvas.rx-dibujo', m), dc = dib.getContext('2d');
  let trazo = null;
  const pos = (ev) => { const r = dib.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width * 512, y: (ev.clientY - r.top) / r.height * 512 }; };
  dib.onpointerdown = (ev) => { try { dib.setPointerCapture(ev.pointerId); } catch (e) {} trazo = [pos(ev)]; dc.clearRect(0, 0, 512, 512); };
  dib.onpointermove = (ev) => { if (!trazo) return; const p = pos(ev); trazo.push(p); dc.strokeStyle = '#e8302c'; dc.lineWidth = 7; dc.lineCap = 'round'; dc.beginPath(); const a = trazo[trazo.length - 2]; dc.moveTo(a.x, a.y); dc.lineTo(p.x, p.y); dc.stroke(); };
  dib.onpointerup = () => {
    if (!trazo || trazo.length < 6) { trazo = null; return; }
    const c = trazo.reduce((s, p) => ({ x: s.x + p.x / trazo.length, y: s.y + p.y / trazo.length }), { x: 0, y: 0 });
    const rad = trazo.reduce((s, p) => s + Math.hypot(p.x - c.x, p.y - c.y), 0) / trazo.length;
    trazo = null;
    const acierto = roi && Math.hypot(c.x / 512 - roi.x, c.y / 512 - roi.y) < roi.r * 1.4 && rad / 512 < 0.32;
    datos.est.circulos++;
    if (acierto) { Sonido.exito(); datos.est.visto = true; informe(true); if (!datos.est.premio) { datos.est.premio = true; reputacion(0.5); aviso('¡Buen ojo! Lesión localizada', 'bien'); } }
    else { Sonido.fallo(); inf.innerHTML = `<p class="informe">${roi ? 'Ahí no se ve nada concluyente. Fíjate bien en las zonas más blancas o raras.' : 'No se aprecia nada anormal en esa zona.'}</p>`; if (datos.est.circulos >= 3) informe(false); }
  };
  $('#rx-nada', m).onclick = () => { datos.est.circulos++; if (!roi) { Sonido.exito(); informe(true); } else { Sonido.fallo(); aviso('Hay algo que se te escapa...', 'mal'); if (datos.est.circulos >= 3) informe(false); } };
}

// ───── Ficha del paciente ─────
function verFicha(p = pac, soloLectura = false) {
  const marcados = p.antecedentesVistos ? p.antecedentes : [];
  const fecha = new Date(2026, 9, 24 + G.dia - 1).toLocaleDateString('es-ES');
  const m = abrirModal(`<div class="ficha">
    <div class="ficha-hosp">${esc(G.hospital)}<span>${fecha}</span></div>
    <div class="ficha-tit">FICHA DEL PACIENTE</div>
    <div class="ficha-datos">
      <div class="ficha-campos">
        <label>NOMBRE <input id="fi-nombre" value="${esc(p.nombre)}" maxlength="30"></label>
        <label>APELLIDOS <input id="fi-apellidos" value="${esc(p.apellidos)}" maxlength="40"></label>
        <label>EDAD <span class="manuscrito">${textoEdad(p.edad)}${p.acompanante ? ` · viene con ${esc(p.acompanante.replace(/^su /, 'su '))}` : ''}</span></label>
        <label>DIRECCIÓN <span class="manuscrito">${esc(p.direccion)}</span></label>
        <label>SEGURO <span class="manuscrito">${esc(p.seguro)}</span></label>
      </div><div class="ficha-foto">SIN FOTO</div></div>
    <div class="ficha-sec">ENTREVISTA INICIAL</div><p class="peq">Enfermedades que tiene o ha tenido:</p>
    <div class="ficha-checks">${ANTECEDENTES.map(a => `<span class="${marcados.includes(a) ? 'si' : ''}"><i></i>${a}</span>`).join('')}</div>
    <div class="ficha-sec">MOTIVO DE CONSULTA</div>
    <div class="ficha-motivo manuscrito">${esc(p.motivoEscrito)}</div>
    <div class="ficha-sec">HALLAZGOS</div>
    <ul class="ficha-hall manuscrito">${p.hallazgos.length ? p.hallazgos.map(h => `<li>${esc(h)}</li>`).join('') : '<li class="vacio">Todavía nada. Habla con el paciente, explóralo y pide pruebas.</li>'}</ul>
    <div class="ficha-sec">NOTAS DEL MÉDICO</div>
    <textarea id="fi-notas" placeholder="Escribe aquí tus sospechas...">${esc(p.notas || '')}</textarea>
    <div class="ficha-firma"><small>TU FIRMA</small><span class="manuscrito">${esc(nombreDoctor())}</span></div>
  </div>`, { clase: 'papel' });
  $('#fi-nombre', m).oninput = (e) => { p.nombre = e.target.value || p.nombre; guardar(); };
  $('#fi-apellidos', m).oninput = (e) => { p.apellidos = e.target.value || p.apellidos; guardar(); };
  $('#fi-notas', m).oninput = (e) => { p.notas = e.target.value; };
}

// ───── Receta ─────
// El jugador escribe la receta: producto, dosis, frecuencia, duración y recomendaciones.
// Nadie habla mientras se escribe. Con «CONFIRMAR RECETA» se revisa y se da por buena.
function editorReceta(cont, plan, { confirmar = true, alCambiar = () => {} } = {}) {
  const lista = plan.receta;
  if (confirmar && plan.recetaConfirmada) {
    cont.innerHTML = `<div class="receta-hoja"><div class="ficha-sec">RECETA CONFIRMADA</div>${lineasReceta(plan).map(l => `<p class="manuscrito">${esc(l)}</p>`).join('')}
      <button class="btn sec mini" id="re-mod">Modificar la receta</button></div>`;
    $('#re-mod', cont).onclick = () => { plan.recetaConfirmada = false; editorReceta(cont, plan, { confirmar, alCambiar }); };
    return;
  }
  cont.innerHTML = `<div class="receta">
    <div class="receta-buscar"><input id="re-q" placeholder="Medicamento, comida o bebida: amoxicilina, cocido leonés, orujo..." autocomplete="off"><div class="receta-sug" id="re-sug"></div></div>
    <div class="receta-cats">${Object.entries(CAT_NOMBRE).map(([c, n]) => `<button class="op" data-cat="${c}">${n}s</button>`).join('')}</div>
    <div class="receta-lista" id="re-lista"></div>
    <datalist id="dl-pautas">${PAUTAS.map(p => `<option value="${p}">`).join('')}</datalist><datalist id="dl-dur">${DURACIONES.map(p => `<option value="${p}">`).join('')}</datalist>
    <label class="re-ind">Recomendaciones y otras instrucciones<textarea id="re-ind" placeholder="Por ejemplo: beber mucha agua, reposo en casa y volver si sube la fiebre.">${esc(plan.indicaciones || '')}</textarea></label>
    <div class="botones re-acc"><button class="btn sec" id="re-mic" title="Dicta en el campo que hayas elegido">🎤 Dictar</button>${confirmar ? '<button class="btn grande" id="re-conf">CONFIRMAR RECETA</button>' : ''}</div></div>`;
  const q = $('#re-q', cont), sug = $('#re-sug', cont), lis = $('#re-lista', cont);
  let campoActivo = null;
  cont.addEventListener('focusin', (e) => { if (e.target.matches('input, textarea')) campoActivo = e.target; });
  const pintar = () => {
    lis.innerHTML = lista.length ? lista.map((r, i) => `<div class="receta-item cat-${r.cat}"><div class="ri-cab"><b>${esc(r.n)}</b><small>${CAT_NOMBRE[r.cat]}${r.libre ? ' · escrito a mano' : ''}</small><button class="quitar" data-q="${i}" aria-label="Quitar">✕</button></div>
      <div class="ri-campos"><input data-i="${i}" data-k="dosis" value="${esc(r.dosis || '')}" placeholder="Dosis (p. ej. 1 comprimido de 500 mg)" autocomplete="off">
      <input data-i="${i}" data-k="pauta" value="${esc(r.pauta || '')}" list="dl-pautas" placeholder="Frecuencia (p. ej. cada 8 horas)" autocomplete="off">
      <input data-i="${i}" data-k="dur" value="${esc(r.dur || '')}" list="dl-dur" placeholder="Duración (p. ej. 7 días)" autocomplete="off"></div></div>`).join('') : '<p class="vacio manuscrito">Receta vacía. Puedes recetar medicamentos, comidas, bebidas o sólo dar recomendaciones.</p>';
    $$('input[data-k]', lis).forEach(s => s.oninput = () => { lista[+s.dataset.i][s.dataset.k] = s.value; alCambiar(); });
    $$('[data-q]', lis).forEach(b => b.onclick = () => { lista.splice(+b.dataset.q, 1); pintar(); alCambiar(); });
  };
  $('#re-ind', cont).oninput = (e) => { plan.indicaciones = e.target.value; alCambiar(); };
  $('#re-mic', cont).onclick = () => alternarMicro(campoActivo || $('#re-ind', cont));
  if ($('#re-conf', cont)) $('#re-conf', cont).onclick = () => {
    if (!lista.length && !(plan.indicaciones || '').trim()) return aviso('La receta está vacía: añade algo o escribe recomendaciones.', 'mal');
    const sinPauta = lista.filter(r => !(r.pauta || '').trim());
    const m = abrirModal(`<h2>Revisa la receta</h2><div class="receta-hoja">${lineasReceta(plan).map(l => `<p class="manuscrito">${esc(l)}</p>`).join('')}</div>
      ${sinPauta.length ? `<p class="nota">Aviso: no has escrito la frecuencia de ${sinPauta.map(r => esc(r.n)).join(', ')}.</p>` : ''}
      <p class="nota">El médico leerá exactamente este texto cuando pulses HABLAR MÉDICO.</p>
      <div class="botones"><button class="btn sec" id="rv-corr">Corregir</button><button class="btn grande" id="rv-ok">Confirmar receta</button></div>`, { clase: 'papel pequeno' });
    $('#rv-corr', m).onclick = () => m.cerrar();
    $('#rv-ok', m).onclick = () => { m.cerrar(); plan.recetaConfirmada = true; Sonido.hoja(); guardar(); editorReceta(cont, plan, { confirmar, alCambiar }); alCambiar(); };
  };
  const anadir = (it) => {
    const item = { ...it, tags: [...it.tags], dosis: '', pauta: '', dur: '' };
    lista.push(item); q.value = ''; sug.innerHTML = ''; sug.classList.remove('on'); pintar(); alCambiar(); Sonido.hoja();
    const campo = $(`input[data-i="${lista.length - 1}"][data-k="dosis"]`, lis); if (campo && Mando.ultimaEntrada !== 'mando') campo.focus();
  };
  const sugerir = (items, texto) => {
    sug.innerHTML = items.map((it, i) => `<button data-s="${i}"><b>${esc(it.n)}</b><small>${CAT_NOMBRE[it.cat]}</small></button>`).join('') + (texto ? `<button data-libre="1" class="libre">Recetar «${esc(texto)}» tal cual</button>` : '');
    sug.classList.toggle('on', !!(items.length || texto));
    $$('[data-s]', sug).forEach(b => b.onclick = () => anadir(items[+b.dataset.s]));
    const l = $('[data-libre]', sug); if (l) l.onclick = () => anadir(itemLibre(texto));
  };
  q.oninput = () => { const t = q.value.trim(); sugerir(t ? buscarReceta(t, 10) : [], t.length > 1 && !RECETARIO.some(r => normaliza(r.n) === normaliza(t)) ? t : ''); };
  q.onkeydown = (e) => { if (e.key === 'Enter' && q.value.trim()) { const r = buscarReceta(q.value, 1); anadir(r.length && normaliza(r[0].n).startsWith(normaliza(q.value)) ? r[0] : itemLibre(q.value)); } };
  $$('[data-cat]', cont).forEach(b => b.onclick = () => { const c = b.dataset.cat; q.value = ''; sugerir(RECETARIO.filter(r => r.cat === c), ''); sug.classList.add('lista'); });
  pintar();
}

// Texto de la receta tal y como la ha escrito el jugador (es lo que lee el médico y lo que lleva el papel)
function lineasReceta(plan) {
  const l = [plan.receta.length ? 'Le receto lo siguiente.' : 'Le indico lo siguiente.'];
  for (const r of plan.receta) {
    const dur = (r.dur || '').trim();
    const partes = [r.n, r.dosis, r.pauta, dur && (/^(durante|hasta|por|para|toda|siempre|de por vida)/i.test(dur) ? dur : `durante ${dur}`)].map(x => String(x || '').trim()).filter(Boolean);
    l.push(partes.join(', ').replace(/[.,;]+$/, '') + '.');
  }
  const ind = (plan.indicaciones || '').trim();
  if (ind) l.push(`Recomendaciones: ${ind}${/[.!?]$/.test(ind) ? '' : '.'}`);
  return l;
}
const tieneReceta = (plan) => plan.receta.length > 0 || !!(plan.indicaciones || '').trim();
// Las recomendaciones escritas también cuentan para la valoración médica (agua, reposo, dieta...)
function itemsDeIndicaciones(texto) {
  return String(texto || '').split(/[.;\n]+|,\s+(?=\S)/).map(s => s.trim()).filter(s => s.length > 2)
    .map(s => itemLibre(s)).filter(it => !it.tags.includes('desconocido')).map(it => ({ ...it, deIndicaciones: true, pauta: '', dur: '' }));
}
const evaluar = (p, plan) => evaluarTratamiento(p, { ...plan, receta: [...plan.receta, ...itemsDeIndicaciones(plan.indicaciones)] });

// ───── Decidir y comunicar ─────
function decidir() {
  const e = ENF[pac.enfId];
  const plan = pac.plan || (pac.plan = { diag: '', accion: '', prio: '', cir: '', receta: pac.receta });
  const opcionesDiag = ENFERMEDADES.slice().sort((a, b) => a.n.localeCompare(b.n, 'es'));
  const m = abrirModal(`<div class="decidir">
    <div class="col">
      <div class="ficha-sec">HALLAZGOS <small>resultados</small></div>
      <ul class="hall">${pac.hallazgos.length ? pac.hallazgos.map(h => `<li>${esc(h)}</li>`).join('') : '<li class="vacio">Sin hallazgos todavía.</li>'}</ul>
      <div class="ficha-sec">DIAGNÓSTICO</div>
      <input id="de-filtro" placeholder="Buscar diagnóstico..." autocomplete="off">
      <div class="lista-diag" id="de-diag">${opcionesDiag.map(d => `<button data-d="${d.id}" class="${plan.diag === d.id ? 'on' : ''}">${esc(d.n)}</button>`).join('')}</div>
    </div>
    <div class="col">
      <div class="ficha-sec">¿QUÉ HACER CON EL PACIENTE?</div>
      <div class="chk" id="de-acc">${[['casa', 'Mandar a casa'], ['hospitalizar', 'Hospitalizar'], ['cirugia', 'Cirugía']].map(([a, n]) => `<button data-a="${a}" class="${plan.accion === a ? 'on' : ''}"><i></i>${n}</button>`).join('')}</div>
      <select id="de-cir" class="${plan.accion === 'cirugia' ? '' : 'oculto'}"><option value="">— Elige la operación —</option>${Object.entries(CIRUGIAS).map(([id, c]) => `<option value="${id}" ${plan.cir === id ? 'selected' : ''}>${c.n}</option>`).join('')}</select>
      <div class="ficha-sec">PRIORIDAD</div>
      <div class="chk" id="de-prio">${[['baja', 'Baja'], ['media', 'Media'], ['alta', 'Alta']].map(([a, n]) => `<button data-p="${a}" class="${plan.prio === a ? 'on' : ''}"><i></i>${n}</button>`).join('')}</div>
      <div class="ficha-sec">RECETA</div>
      <div id="de-receta"></div>
      <button class="btn rojo grande" id="de-ok">COMUNICAR EL DIAGNÓSTICO</button>
    </div></div>`, { clase: 'papel ancho' });
  editorReceta($('#de-receta', m), plan);
  $('#de-filtro', m).oninput = (ev) => { const t = normaliza(ev.target.value); $$('[data-d]', m).forEach(b => b.style.display = normaliza(b.textContent).includes(t) ? '' : 'none'); };
  $$('[data-d]', m).forEach(b => b.onclick = () => { plan.diag = b.dataset.d; $$('[data-d]', m).forEach(x => x.classList.toggle('on', x === b)); Sonido.clic(); });
  $$('[data-a]', m).forEach(b => b.onclick = () => { plan.accion = b.dataset.a; $$('[data-a]', m).forEach(x => x.classList.toggle('on', x === b)); $('#de-cir', m).classList.toggle('oculto', plan.accion !== 'cirugia'); Sonido.clic(); });
  $$('[data-p]', m).forEach(b => b.onclick = () => { plan.prio = b.dataset.p; $$('[data-p]', m).forEach(x => x.classList.toggle('on', x === b)); Sonido.clic(); });
  $('#de-cir', m).onchange = (ev) => { plan.cir = ev.target.value; };
  $('#de-ok', m).onclick = () => {
    if (!plan.diag) return aviso('Elige un diagnóstico', 'mal');
    if (!plan.accion) return aviso('Decide qué hacer con el paciente', 'mal');
    if (plan.accion === 'cirugia' && !plan.cir) return aviso('Elige qué operación vas a hacer', 'mal');
    if (plan.accion === 'hospitalizar' && G.ingresados.length >= G.inst.camas) return aviso(`No quedan camas libres (${G.inst.camas}). Amplía la planta en Gestión o da altas.`, 'mal');
    if (tieneReceta(plan) && !plan.recetaConfirmada) return aviso('Revisa la receta y pulsa CONFIRMAR RECETA antes de comunicar el diagnóstico.', 'mal');
    if (!plan.prio) plan.prio = 'media';
    m.cerrar(); comunicar();
  };
}
function comunicar() {
  const m = abrirModal(`<h2>Comunicar la noticia</h2><p>¿Cómo se lo vas a decir?</p>
    ${[['empatia', 'Con tacto y empatía', 'Sentarse, mirar a los ojos y explicarlo con calma.'], ['directo', 'Claro y directo', 'Sin rodeos, pero con educación.'], ['frio', 'Frío y técnico', 'Como quien lee un informe.'], ['quitar', 'Quitarle importancia', 'Que no se agobie... aunque no sea verdad.']].map(([id, n, s]) => `<button class="pregunta" data-t="${id}"><b>${n}</b><small>${s}</small></button>`).join('')}`, { clase: 'pequeno' });
  $$('[data-t]', m).forEach(b => b.onclick = () => { m.cerrar(); darNoticia(b.dataset.t); });
}
async function darNoticia(tono) {
  const e = ENF[pac.enfId], plan = pac.plan;
  const dElegido = ENF[plan.diag];
  const sr = pac.sexo === 'm' ? 'señora' : 'señor';
  const ap = pac.apellidos.split(' ')[0];
  // el tratamiento no se menciona aquí: el médico lo explica después, leyendo la receta confirmada
  const accionTxt = plan.accion === 'casa' ? `Puede irse a casa.${tieneReceta(plan) ? ' Ahora le explico la receta.' : ''}` : plan.accion === 'hospitalizar' ? 'Vamos a ingresarle en planta para tenerle vigilado.' : `Hay que operar: le vamos a hacer una ${CIRUGIAS[plan.cir].n.toLowerCase()}.`;
  const diagTxt = dElegido.simulador ? 'usted está perfectamente sano' : `lo que tiene es ${dElegido.n.toLowerCase().replace(/ \(.*\)/, '')}`;
  const textos = {
    empatia: `${sr[0].toUpperCase() + sr.slice(1)} ${ap}, sé que está preocupad${pac.sexo === 'm' ? 'a' : 'o'}. Le explico con calma: ${diagTxt}. ${accionTxt} Vamos a estar a su lado en todo momento.`,
    directo: `${sr[0].toUpperCase() + sr.slice(1)} ${ap}, ${diagTxt}. ${accionTxt}`,
    frio: `Diagnóstico: ${dElegido.n.toLowerCase()}. ${accionTxt} Siguiente.`,
    quitar: `Nada, nada, una tontería. ${accionTxt} No se preocupe por nada.`,
  };
  // si el paciente es un niño (o un mayor confuso) se habla con la familia
  const aFamilia = respondeAcomp(pac) && acompDentro;
  if (aFamilia) {
    const n = pac.nombre, diagF = dElegido.simulador ? `${n} está perfectamente` : `${n} tiene ${dElegido.n.toLowerCase().replace(/ \(.*\)/, '')}`;
    const accF = accionTxt.replace('Puede irse a casa.', 'Se puede ir a casa.').replace('Ahora le explico', 'Ahora les explico');
    textos.empatia = `Sé que están preocupados, y es normal. Les explico con calma: ${diagF}. ${accF} Vamos a cuidarle muy bien.`;
    textos.directo = `${diagF}. ${accF}`;
    textos.quitar = `Nada, una tontería. ${accF} No se preocupen.`;
  }
  await turnoMedico(textos[tono], { etiqueta: 'Comunica la noticia: revisa o cambia el texto y pulsa HABLAR MÉDICO.' });
  pac.noticiaDada = true;
  const grav = dElegido.noticia;
  const reac = {
    grave: { empatia: '(se le humedecen los ojos) Gracias por decírmelo así, doctor. Haré lo que haga falta.', directo: 'Dios mío... ¿Y me voy a curar? Bueno... confío en usted.', frio: '¿Así me lo suelta? ¿Como quien da el parte del tiempo? Qué poca humanidad.', quitar: '¿Una tontería? Ah, bueno, menos mal...' },
    moderada: { empatia: 'Vale, doctor. Me quedo más tranquil{o} sabiendo que usted se ocupa.', directo: 'Bueno... vale. Si hay que hacerlo, se hace.', frio: 'Hmm. Vale. Qué simpático.', quitar: 'Ah, pues mejor. ¿Seguro que no es nada?' },
    leve: { empatia: 'Muchas gracias, doctor. Es usted un cielo.', directo: 'Perfecto, gracias, doctor.', frio: 'Vale.', quitar: '¡Menos mal! Ya pensaba que me moría.' },
  }[grav][tono];
  pac.satisfaccion = (pac.satisfaccion || 0) + ({ empatia: { grave: 2, moderada: 1, leve: 1 }, directo: { grave: 0, moderada: 1, leve: 1 }, frio: { grave: -3, moderada: -1, leve: 0 }, quitar: { grave: -4, moderada: -1, leve: 0 } }[tono][grav]);
  if (aFamilia) {
    const reacF = { grave: { empatia: '(llorando) Gracias, doctor... Haremos lo que haga falta.', directo: 'Dios mío... ¿Se va a poner bien? Díganos que sí.', frio: '¿Así nos lo dice? ¡Que estamos hablando de mi familia!', quitar: 'Ah, bueno... si es una tontería...' }, moderada: { empatia: 'Gracias por explicárnoslo tan bien, doctor.', directo: 'Vale... lo que usted diga, doctor.', frio: 'Qué manera de decir las cosas...', quitar: '¿Seguro que no es nada?' }, leve: { empatia: '¡Uf, qué alivio! Muchas gracias, doctor.', directo: 'Perfecto, gracias.', frio: 'Vale.', quitar: '¡Menos mal!' } }[grav][tono];
    await turnoPaciente('acomp', reacF);
    if (pac.edad >= 3 && pac.edad < 13) charla.pendiente = { ctx: { tipo: 'extra', quien: 'paciente', referencia: plan.accion === 'casa' ? azar(['¿Me puedo ir ya al parque?', '¿Me das una pegatina?', 'Vale...']) : azar(['¿Me van a pinchar?', '(se agarra a su madre) No quiero quedarme...', 'Vale... pero que venga mi mamá.']) } };
  } else await turnoPaciente('paciente', fmt(reac, pac));
  if (acompDentro && !aFamilia && grav === 'grave') charla.pendiente = { ctx: { tipo: 'extra', quien: 'acomp', referencia: azar(['¡Ay, Dios mío! ¿Y ahora qué hacemos?', '(llorando) Tranquilo, que yo estoy aquí contigo.']).replace('Tranquilo', pac.sexo === 'm' ? 'Tranquila' : 'Tranquilo') } };
  actualizarCharla();
  G.stats.atendidos++;
  if (tieneReceta(plan)) await explicarYEntregarReceta(plan);
  if (plan.accion === 'casa') return despedirPaciente();
  if (plan.accion === 'hospitalizar') return ingresar(pac, plan, false);
  return prepararCirugia(pac, plan, 'consulta');
}
// La receta confirmada: el médico la lee al pulsar HABLAR MÉDICO, la entrega en mano y el paciente contesta al pulsar RESPONDER
async function explicarYEntregarReceta(plan) {
  const lineas = lineasReceta(plan);
  const texto = lineas.join(' ');
  await turnoMedico(texto, { soloLectura: true, leer: leerNatural(texto), etiqueta: 'Receta confirmada: pulsa HABLAR MÉDICO para que el médico la explique.' });
  pac.recetaTexto = texto;
  const aFamilia = (respondeAcomp(pac) || pac.edad < 1.5) && acompDentro && hAcomp;
  const receptor = aFamilia ? hAcomp : hPac;
  charla.entregando = true; actualizarCharla();
  const tex = texReceta(lineas, { hospital: G.hospital, medico: nombreDoctor(), paciente: `${pac.nombre} ${pac.apellidos}` });
  const entregada = await mundo.entregarPapel(receptor, tex);
  pac.recetaEntregada = { lineas, enMano: entregada, a: aFamilia ? 'acomp' : 'paciente' };
  charla.entregando = false; actualizarCharla();
  // referencia para la respuesta: la reacción más llamativa a lo recetado, o un agradecimiento
  const genericas = ['Vale, doctor.', 'De acuerdo, lo tomaré.', 'Muy bien, gracias.', 'Apuntado.', 'Bueno...', 'Si usted lo dice...', 'Vale.'];
  const llamativa = aFamilia ? null : plan.receta.map(r => reaccionReceta(pac, r)).find(t => !genericas.includes(t));
  const ref = aFamilia ? azar(['De acuerdo, doctor. Se lo daremos tal y como nos ha dicho.', 'Muchas gracias, doctor. ¿Tenemos que volver a consulta?'])
    : llamativa || (pac.edad < 13 ? azar(['Vale... ¿sabe mal?', 'Gracias, doctor.']) : azar(['Muchas gracias, doctor. Seguiré sus indicaciones.', 'De acuerdo, doctor. ¿Tengo que volver a consulta?', 'Muy bien. Lo haré tal cual me ha dicho.']));
  await turnoPaciente(aFamilia ? 'acomp' : 'paciente', ref, { tratamiento: `${tratamientoDicho()}` });
}
function resultadoCasa(p, plan) {
  const ev = evaluar(p, plan);
  let q = ev.q + (p.satisfaccion || 0) * 2 + entre(-6, 6);
  let res;
  if (prob(ev.riesgo)) res = ENF[p.enfId].grav >= 4 || ev.peligro === 3 ? 'muerte' : 'urgencias';
  else res = q >= 78 ? 'curado' : q >= 58 ? 'mejora' : q >= 40 ? 'igual' : 'empeora';
  return { res, q, ev };
}
const FRASES_RESULTADO = {
  curado: ['se recuperó del todo en pocos días.', 'está como nuevo y le ha recomendado a toda su familia.', 'dejó una reseña de cinco estrellas: «Un médico como los de antes».'],
  mejora: ['va mejorando poco a poco.', 'se encuentra mejor, aunque le costará unos días más.'],
  igual: ['sigue más o menos igual. Ha ido a pedir una segunda opinión.', 'no nota mejoría y se queja en el bar del pueblo.'],
  empeora: ['ha empeorado y su familia ha puesto una reclamación.', 'volvió peor y ha escrito una mala reseña.'],
  urgencias: ['acabó en Urgencias esa misma noche. Se ha abierto una investigación.'],
  muerte: ['falleció días después. La familia ha denunciado al hospital.'],
};
function aplicarResultado(p, res, honorarios) {
  const nombre = `${p.nombre} ${p.apellidos}`;
  const repD = { curado: 3, mejora: 1.5, igual: -1, empeora: -3, urgencias: -6, muerte: -12, alta: 2 }[res] + Math.max(-2, Math.min(2, (p.satisfaccion || 0) * 0.5));
  const factor = { curado: 1, mejora: 0.8, igual: 0.4, empeora: 0, urgencias: 0, muerte: 0 }[res] ?? 1;
  const cobro = Math.round(honorarios * factor * (G.inst.vip ? 1.3 : 1));
  if (cobro) dinero(cobro);
  if (res === 'muerte') { dinero(-800, 'Indemnización'); G.stats.fallecidos++; }
  if (res === 'curado') G.stats.curados++;
  reputacion(repD);
  G.historial.push({ nombre, enf: ENF[p.enfId].n, res, dia: G.dia });
  const txt = `${nombre} (${ENF[p.enfId].n.toLowerCase()}) ${azar(FRASES_RESULTADO[res] || FRASES_RESULTADO.mejora)}`;
  G.hoy.eventos.push({ txt, res, cobro, rep: repD });
  return txt;
}
async function despedirPaciente() {
  const { res, q, ev } = resultadoCasa(pac, pac.plan);
  const hon = 60 + ENF[pac.enfId].grav * 40;
  aplicarResultado(pac, res, hon);
  const a = pac.sexo === 'm' ? 'a' : 'o';
  await turnoMedico(pac.edad < 13 ? `¡Muy bien, ${a === 'a' ? 'campeona' : 'campeón'}! Ya podéis iros a casa. ¡Que te mejores!` : 'Muy bien. Cuídese mucho y, si no mejora, vuelva por aquí. Hasta luego.', { etiqueta: 'Despide al paciente: revisa el texto y pulsa HABLAR MÉDICO.' });
  if (pac.edad < 1.5) await turnoPaciente('acomp', 'Muchas gracias, doctor. ¡Di adiós con la manita!');
  else if (pac.edad < 13) await turnoPaciente('paciente', azar(['¡Adiós, doctor!', '¡Adiós! ¿Me das una piruleta?', '(dice adiós con la mano) Adiós...']));
  else await turnoPaciente('paciente', azar(['Muchas gracias, doctor. Hasta luego.', 'Gracias. A ver si me pongo bueno pronto.', 'Adiós, doctor.']).replace('bueno', a === 'a' ? 'buena' : 'bueno'));
  mostrarValoracion(ev, res);
}
function mostrarValoracion(ev, res, extra = '') {
  const m = abrirModal(`<h2>Valoración del caso</h2>
    <div class="nota-caso ${ev.q >= 70 ? 'bien' : ev.q >= 45 ? 'medio' : 'mal'}"><b>${ev.q}</b><small>/100</small></div>
    <ul class="valoracion">${ev.notas.map(([t, x]) => `<li class="${t}">${esc(x)}</li>`).join('')}</ul>${extra}
    <p class="nota">El resultado final lo verás en el informe del día.</p>
    <div class="botones"><button class="btn grande" id="va-ok">Siguiente paciente</button></div>`, { cerrable: false });
  $('#va-ok', m).onclick = () => { m.cerrar(); G.pendientes--; guardar(); siguientePaciente(); };
}
async function ingresar(p, plan, operado, puntuacionCir = null) {
  const ev = evaluar(p, plan);
  const grav = ENF[p.enfId].grav;
  const ing = { pac: p, plan, q: ev.q, salud: operado ? Math.max(15, Math.min(90, (puntuacionCir ?? 60) * 0.7 + 15)) : Math.max(20, 70 - grav * 9), dias: 0, operado, infeccion: plan.infeccion || false, diaIngreso: G.dia };
  G.ingresados.push(ing);
  guardar();
  if (!operado) {
    if (p === pac && modo === 'consulta') {
      await turnoMedico('La enfermera le acompañará a su habitación. Mañana paso a verle en la ronda.', { etiqueta: 'Explícale el ingreso y pulsa HABLAR MÉDICO.' });
      await turnoPaciente(respondeAcomp(p) && acompDentro ? 'acomp' : 'paciente', respondeAcomp(p) && acompDentro ? 'De acuerdo, doctor. Nos quedamos con él.'.replace('él', p.sexo === 'm' ? 'ella' : 'él') : azar(['Bueno... si hay que quedarse, me quedo.', '¿Y la comida del hospital es buena? Porque yo soy de buen comer.']));
    }
    mostrarValoracion(ev, 'ingreso', `<p>${esc(p.nombre)} ingresa en planta. Lo verás mañana en la ronda.</p>`);
  }
}

// ───────────────────────── QUIRÓFANO ─────────────────────────
let cir = null;
async function prepararCirugia(p, plan, origen) {
  const e = ENF[p.enfId];
  // la familia, en pánico
  if (e.grav >= 3 && prob(0.6)) {
    const fam = p.acompanante || azar(['su mujer', 'su hijo', 'su hermana']);
    const quien = { nombre: `Familiar (${fam})`, genero: /mujer|hija|madre|hermana/.test(fam) ? 'm' : 'h', edad: p.acompEdad || 45, semilla: p.id * 31 + 7, rol: 'acomp', humano: p === pac ? hAcomp : null };
    aviso('Un familiar quiere hablar contigo: pulsa RESPONDER PACIENTE para escucharle.', 'info');
    await turnoPaciente(quien, azar(['¡Doctor! ¿Se va a morir? ¡Dígame la verdad! ¡Quiero entrar con él al quirófano!', '¡No puede operarle! ¡Lo he leído en internet y es muy peligroso! ¡Exijo hablar con el director!']).replace('con él', p.sexo === 'm' ? 'con ella' : 'con él').replace('operarle', p.sexo === 'm' ? 'operarla' : 'operarle'));
    await new Promise(res => {
      const m = abrirModal(`<h3>La familia está en pánico</h3>${[['calmar', 'Calmarle y explicarle el procedimiento'], ['seguridad', 'Pedir a seguridad que le acompañe a la sala de espera'], ['gritar', '¡Silencio! ¡Aquí mando yo!'], ['entrar', 'Dejarle entrar al quirófano']].map(([id, t]) => `<button class="pregunta" data-f="${id}">${t}</button>`).join('')}`, { clase: 'pequeno', cerrable: false });
      $$('[data-f]', m).forEach(b => b.onclick = async () => {
        m.cerrar(); const f = b.dataset.f;
        if (f === 'calmar') { await turnoMedico('Entiendo que tenga miedo. Es una operación que hacemos a menudo, el equipo es muy bueno y le informaré en cuanto terminemos.'); await turnoPaciente(quien, 'Vale... vale. Gracias, doctor. Cuídemelo, por favor.'); reputacion(1); }
        if (f === 'seguridad') { await turnoMedico('Seguridad, por favor, acompañen al familiar a la sala de espera.'); await turnoPaciente(quien, '¡Esto es una vergüenza!'); }
        if (f === 'gritar') { await turnoMedico('¡Silencio! ¡Aquí mando yo!'); await turnoPaciente(quien, '¡Pues vaya modales! ¡Le voy a poner una reclamación!'); reputacion(-2); }
        if (f === 'entrar') { await turnoMedico('Está bien, puede entrar, pero quédese en una esquina y no toque nada.'); await turnoPaciente(quien, '¡Gracias, doctor! Me pongo aquí en una esquina...'); plan.familiarDentro = true; reputacion(-1); }
        res();
      });
    });
  }
  modo = 'preqx'; document.body.dataset.modo = 'preqx';
  mostrarCharla(false);
  const def = CIRUGIAS[plan.cir];
  const personal = [[{ ...generarPaciente().apariencia, sexo: 'm', estilo: 6, barba: 0 }, 'enfermera', -1.15, -0.5, 1.3]];
  if (G.personal.anestesista) personal.push([{ ...generarPaciente().apariencia, sexo: 'h', estilo: 1 }, 'cirujano', 1.25, -0.95, -0.9]);
  if (G.personal.cirujano) personal.push([{ ...generarPaciente().apariencia, sexo: prob(0.5) ? 'h' : 'm', estilo: 1 }, 'cirujano', 1.25, 1.15, -2.2]);
  if (plan.familiarDentro) personal.push([{ ...generarPaciente().apariencia }, 'calle', 2.4, 2.4, -2.4, 'brazos_cruzados']);
  await fundido(() => { mundo.mostrar('quirofano'); mundo.prepararQuirofano(p.apariencia, personal); mundo.vistaQuirofanoGeneral(0); mundo.vitales = { fc: p.vit.fc, tas: p.vit.tas, tad: p.vit.tad, sat: p.vit.sat }; mundo.ritmo = 'normal'; });
  $('#panel').classList.remove('on');
  const pasos = [['manos', 'Lavarse las manos (3 minutos)'], ['gorro', 'Gorro y mascarilla'], ['bata', 'Bata estéril'], ['guantes', 'Guantes estériles']];
  const hecho = [];
  let contaminado = false, anest = '';
  const m = abrirModal(`<h2>Preparación · ${def.n}</h2>
    <p class="nota">Paciente: ${esc(p.nombre)} ${esc(p.apellidos)} · ${esc(def.objetivo)}</p>
    <div class="ficha-sec">ANESTESIA</div>
    ${G.personal.anestesista ? `<p class="informe">El anestesista recomienda: <b>${ANESTESIAS[def.anestesia[0]]}</b></p>` : ''}
    <div class="chk anest">${Object.entries(ANESTESIAS).map(([id, n]) => `<button data-an="${id}"><i></i>${n}</button>`).join('')}</div>
    <div class="ficha-sec">ASEPSIA (en orden)</div>
    <div class="chk asep">${pasos.map(([id, n]) => `<button data-as="${id}"><i></i>${n}</button>`).join('')}</div>
    <div class="botones"><button class="btn rojo grande" id="qx-ok">EMPEZAR LA OPERACIÓN</button></div>`, { cerrable: false, clase: 'ancho2' });
  $$('[data-an]', m).forEach(b => b.onclick = () => { anest = b.dataset.an; $$('[data-an]', m).forEach(x => x.classList.toggle('on', x === b)); Sonido.clic(); });
  $$('[data-as]', m).forEach(b => b.onclick = () => {
    const id = b.dataset.as; if (hecho.includes(id)) return;
    const orden = pasos.map(x => x[0]);
    if (orden.indexOf(id) !== hecho.length) { contaminado = true; aviso('¡Orden incorrecto! Te has contaminado', 'mal'); Sonido.fallo(); }
    hecho.push(id); b.classList.add('on'); id === 'manos' ? Sonido.aspirar() : Sonido.hoja();
  });
  $('#qx-ok', m).onclick = () => {
    if (!anest) return aviso('Elige el tipo de anestesia', 'mal');
    m.cerrar();
    const asepsiaOk = hecho.length === 4 && !contaminado;
    if (!asepsiaOk) aviso('Asepsia incompleta: riesgo de infección', 'mal');
    plan.infeccion = !asepsiaOk && prob(0.7);
    const anestesiaMal = !def.anestesia.includes(anest) && !(anest === 'general');
    const anestesiaExcesiva = anest === 'general' && !def.anestesia.includes('general');
    let riesgo = 0.3 + e.grav * 0.25 - (G.equipos.monitorAvanzado ? 0.5 : 0) - (G.personal.anestesista ? 0.4 : 0) - (G.personal.cirujano ? 0.3 : 0) + (plan.familiarDentro ? 0.4 : 0);
    if (plan.cir !== e.trat.cir && !(p.enfId === 'fractura_muneca' && plan.cir === 'osteosintesis')) riesgo += 0.3;
    operar(p, plan, origen, { anestesia: anest, anestesiaMal, anestesiaExcesiva, riesgo: Math.max(0, riesgo), temblor: Math.max(0.3, 1 - (G.equipos.instrumental ? 0.5 : 0) - (G.personal.cirujano ? 0.2 : 0)), asepsiaOk });
  };
}
async function operar(p, plan, origen, op) {
  const def = CIRUGIAS[plan.cir];
  modo = 'cirugia'; document.body.dataset.modo = 'cirugia';
  if (mundo.pacQ) mundo.pacQ.dormido = op.anestesia === 'general' || op.anestesia === 'sedacion';
  mundo.sinDesplazar = true; mundo.redimensionar();
  mundo.colocarCampo(def.zona);
  cir = new Cirugia(mundo, def, { ...op, piel: p.apariencia.piel });
  const h = $('#cir-hud');
  const iconos = { betadine: '🧴', bisturi: '🔪', separador: '🪝', pinzas: '✂', tijeras: '✂️', aspirador: '💨', gasas: '🩹', portaagujas: '🪡', malla: '#' };
  h.innerHTML = `
    <div class="cir-estado"><b>ESTADO DEL PACIENTE</b><div class="barra"><i id="cx-barra"></i></div><div class="etq"><span>CRÍTICO</span><span>GRAVE</span><span>ESTABLE</span></div>
      <div class="vit"><span>FC <b id="cx-fc">--</b></span><span>TA <b id="cx-ta">--</b></span><span>SpO₂ <b id="cx-sat">--</b></span></div><canvas id="cx-ecg" width="300" height="60"></canvas></div>
    <div class="cir-herr">${Object.entries(HERRAMIENTAS).map(([id, n]) => `<button data-h="${id}"><span>${iconos[id]}</span><small>${n}</small></button>`).join('')}</div>
    <div class="cir-emer">${Object.entries(EMERGENCIAS).map(([id, n]) => `<button data-em="${id}">${n}</button>`).join('')}</div>
    <div class="cir-obj"><b id="cx-paso">—</b><div class="cont"><span id="cx-n">0/${def.pasos.length}</span><small id="cx-ayuda">Elige el instrumento adecuado</small></div><div id="cx-sug" class="sug"></div></div>
    <div class="cir-alarma" id="cx-alarma"></div>`;
  $$('[data-h]', h).forEach(b => b.onclick = () => { cir.ponerHerramienta(b.dataset.h); $$('[data-h]', h).forEach(x => x.classList.toggle('on', x === b)); Sonido.clic(); });
  $$('[data-em]', h).forEach(b => b.onclick = () => cir.emergencia(b.dataset.em));
  cir.on('paso', (texto, i, n, herr) => { $('#cx-paso').textContent = texto.toUpperCase(); $('#cx-n').textContent = `${i}/${n}`; $('#cx-sug').textContent = (G.personal.enfermera || G.dia <= 2) ? `Enfermera: «Le paso ${herr.map(x => HERRAMIENTAS[x].toLowerCase()).join(' o ')}»` : ''; })
    .on('aviso', (t) => aviso(t, 'info'))
    .on('comp', (c) => { const a = $('#cx-alarma'); if (c) { a.innerHTML = `<b>⚠ ${c.n}</b>${G.personal.anestesista || G.personal.enfermera || G.dia <= 2 ? `<small>${c.ayuda}</small>` : ''}`; a.classList.add('on'); } else a.classList.remove('on'); })
    .on('fin', (r) => finCirugia(p, plan, origen, r, op));
  cir.empezarPaso();
  const ecg = $('#cx-ecg').getContext('2d'); let fase = 0, x = 0, prev = 30;
  cir._upd = (dt) => {
    if (!cir || cir.terminado) return;
    cir.actualizar(dt);
    const v = cir.vitales();
    mundo.vitales = v; mundo.ritmo = v.ritmo;
    const est = v.estado;
    $('#cx-barra').style.width = `${est}%`; $('#cx-barra').style.background = est > 66 ? '#3ad07a' : est > 33 ? '#f2b33d' : '#e8473f';
    $('#cx-fc').textContent = v.fc | 0; $('#cx-ta').textContent = `${v.tas | 0}/${v.tad | 0}`; $('#cx-sat').textContent = v.sat | 0;
    for (let k = 0; k < 3; k++) { x = (x + 1) % 300; fase += Math.max(0.3, v.fc) / 60 / 60; ecg.fillStyle = '#071012'; ecg.fillRect(x, 0, 6, 60); const y = 34 - ecgVal(fase % 1, v.ritmo, fase) * 22; ecg.strokeStyle = '#3dff6e'; ecg.lineWidth = 2; ecg.beginPath(); ecg.moveTo(x - 1, prev); ecg.lineTo(x, y); ecg.stroke(); prev = y; }
  };
  mundo.alActualizar.push(cir._upd);
}
function posCampo(ev) { return mundo.uvCampo(ev.clientX, ev.clientY); }
canvas.addEventListener('pointerdown', (ev) => {
  if (modo === 'cirugia' && cir) { try { canvas.setPointerCapture(ev.pointerId); } catch (e) {} const p = posCampo(ev); if (p) cir.abajo(p); }
  if (modo === 'esteto') moverEsteto(ev.clientX, ev.clientY);
});
canvas.addEventListener('pointermove', (ev) => {
  if (modo === 'cirugia' && cir) { const p = posCampo(ev); if (p) cir.mover(p); }
  if (modo === 'esteto') moverEsteto(ev.clientX, ev.clientY);
});
addEventListener('pointerup', () => { if (cir) cir.arriba(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && modo === 'esteto') terminarAuscultacion(); });

async function finCirugia(p, plan, origen, r, op) {
  mundo.alActualizar = mundo.alActualizar.filter(f => f !== cir._upd);
  mundo.sinDesplazar = false; mundo.redimensionar();
  const def = CIRUGIAS[plan.cir], e = ENF[p.enfId];
  G.stats.operaciones++;
  const correcta = plan.cir === e.trat.cir || (p.enfId === 'fractura_muneca' && plan.cir === 'osteosintesis');
  setTimeout(async () => {
    $('#cir-hud').innerHTML = '';
    cir = null;
    if (r.muerte) {
      Sonido.alarma();
      aplicarResultado(p, 'muerte', 0);
      const m = abrirModal(`<h2>El paciente ha fallecido</h2><p>${esc(p.nombre)} ${esc(p.apellidos)} no ha superado la operación. Tendrás que dar la noticia a la familia.</p><div class="botones"><button class="btn grande" id="mu-ok">Hablar con la familia</button></div>`, { cerrable: false });
      $('#mu-ok', m).onclick = async () => { m.cerrar(); await turnoMedico('Lo siento muchísimo. Hemos hecho todo lo posible, pero no ha podido superar la operación.', { etiqueta: 'Da la mala noticia con tacto: revisa el texto y pulsa HABLAR MÉDICO.' }); await turnoPaciente({ nombre: 'Familiar', genero: 'm', edad: p.acompEdad || 50, semilla: p.id * 31 + 7, rol: 'acomp' }, '(llorando) No... no puede ser...'); mostrarCharla(false); salirQuirofano(origen); };
      return;
    }
    Sonido.exito();
    const pago = Math.round(def.pago * (0.5 + r.puntuacion / 200) * (G.equipos.quirofano2 ? 1.2 : 1) * (correcta ? 1 : 0.3));
    dinero(pago, def.n);
    reputacion(correcta ? (r.puntuacion - 50) / 12 : -4);
    const extra = correcta ? '' : `<p class="mal">Esta operación no era la que necesitaba el paciente (${e.trat.cir ? CIRUGIAS[e.trat.cir].n : 'no necesitaba cirugía'}).</p>`;
    const m = abrirModal(`<h2>Operación terminada</h2>
      <div class="nota-caso ${r.puntuacion >= 70 ? 'bien' : r.puntuacion >= 45 ? 'medio' : 'mal'}"><b>${r.puntuacion}</b><small>/100</small></div>
      <ul class="valoracion"><li class="${r.precision > 0.7 ? 'bien' : 'medio'}">Precisión del corte: ${Math.round(r.precision * 100)} %</li>
      <li>Tiempo: ${Math.floor(r.tiempo / 60)} min ${Math.round(r.tiempo % 60)} s</li>
      <li class="${r.complicaciones === r.resueltas ? 'bien' : 'mal'}">Complicaciones: ${r.complicaciones} (resueltas ${r.resueltas})</li>
      <li class="${op.anestesiaMal ? 'mal' : 'bien'}">Anestesia: ${ANESTESIAS[op.anestesia]}${op.anestesiaMal ? ' — no era la adecuada' : ''}</li>
      <li class="${op.asepsiaOk ? 'bien' : 'mal'}">Asepsia ${op.asepsiaOk ? 'correcta' : 'incompleta: riesgo de infección'}</li></ul>${extra}
      <p>${esc(p.nombre)} pasa a planta para recuperarse.</p>
      <div class="botones"><button class="btn grande" id="op-ok">Hablar con la familia</button></div>`, { cerrable: false });
    $('#op-ok', m).onclick = async () => {
      m.cerrar();
      await turnoMedico('La operación ha ido bien. Ahora tiene que descansar; podrán verle en la planta.', { etiqueta: 'Habla con la familia: revisa el texto y pulsa HABLAR MÉDICO.' });
      await turnoPaciente({ nombre: 'Familiar', genero: 'm', edad: p.acompEdad || 50, semilla: p.id * 31 + 7, rol: 'acomp' }, '¡Gracias, doctor! ¡Muchísimas gracias!');
      mostrarCharla(false);
      const ya = G.ingresados.find(i => i.pac.id === p.id);
      if (ya) { ya.operado = true; ya.salud = Math.max(ya.salud, r.puntuacion * 0.7 + 15); ya.infeccion = plan.infeccion; ya.plan = plan; }
      else ingresarOperado(p, plan, r.puntuacion);
      salirQuirofano(origen);
    };
  }, 900);
}
function ingresarOperado(p, plan, punt) {
  if (G.ingresados.length >= G.inst.camas) G.inst.camasExtra = (G.inst.camasExtra || 0) + 1; // se habilita una camilla en el pasillo
  ingresar(p, plan, true, punt);
}
async function salirQuirofano(origen) {
  modo = origen; document.body.dataset.modo = 'juego';
  guardar();
  if (origen === 'ronda') { await fundido(() => mundo.mostrar('sala')); return mostrarIngresado(); }
  G.pendientes--; guardar();
  siguientePaciente();
}

// ───────────────────────── RONDA DE GUARDIA ─────────────────────────
let iRonda = 0, hCama = null;
function empezarRonda() {
  modo = 'sala'; iRonda = 0;
  // pacientes que han fallecido durante la noche
  const muertos = G.ingresados.filter(i => i.salud <= 0);
  G.ingresados = G.ingresados.filter(i => i.salud > 0);
  const intro = muertos.length ? `<p class="mal">Durante la noche ha fallecido: ${muertos.map(i => esc(i.pac.nombre + ' ' + i.pac.apellidos)).join(', ')}.</p>` : '';
  muertos.forEach(i => aplicarResultado(i.pac, 'muerte', 0));
  if (!G.ingresados.length) { G.fase = 'consulta'; if (intro) abrirModal(`<h2>Ronda de guardia</h2>${intro}`); return siguientePaciente(); }
  const m = abrirModal(`<h2>Ronda de guardia · Día ${G.dia}</h2>${intro}<p>Tienes ${G.ingresados.length} paciente${G.ingresados.length > 1 ? 's' : ''} en planta. Comprueba cómo están, ajusta el tratamiento y da las altas.</p><div class="botones"><button class="btn grande" id="ro-ok">Empezar la ronda</button></div>`, { cerrable: false });
  $('#ro-ok', m).onclick = () => { m.cerrar(); mostrarIngresado(); };
}
async function mostrarIngresado() {
  const ing = G.ingresados[iRonda];
  if (!ing) return terminarRonda();
  pac = ing.pac;
  await fundido(() => {
    mundo.mostrar('sala');
    mundo.quitar(hCama);
    hCama = mundo.registrar(crearHumano(pac.apariencia, pac.apariencia.ropa || 'paciente'));
    hCama.dormido = ing.salud < 25;
    hCama.agitado = ing.salud < 40;
    mundo.ponerPacienteCama(hCama);
    const s = ing.salud; mundo.vitalesSala = { fc: 68 + (100 - s) * 0.45, tas: 125 - (100 - s) * 0.4, tad: 78 - (100 - s) * 0.2, sat: 99 - (100 - s) * 0.09 };
  });
  modo = 'sala';
  panelSala();
  // el saludo queda propuesto en el cuadro; el paciente contesta cuando se pulse RESPONDER PACIENTE
  reiniciarCharla(); mostrarCharla(true);
  pac.charla ||= [];
  proponer(pac.edad < 10 ? `Buenos días. ¿Qué tal ha pasado la noche ${pac.nombre}?` : `Buenos días, ${pac.sexo === 'm' ? 'señora' : 'señor'} ${pac.apellidos.split(' ')[0]}. ¿Cómo ha pasado la noche?`, { ctx: { tipo: 'sala', id: 'noche' } });
}
// quién contesta en la planta: los niños pequeños, a través de su familiar
const hablanteSala = (p) => p.edad < 10 ? { nombre: parentesco(p), genero: esMujerAcomp(p) ? 'm' : 'h', edad: edadAcomp(p), semilla: p.id * 31 + 7, rol: 'acomp' } : 'paciente';
async function responderSala(p) {
  const ing = G.ingresados[iRonda]; if (!ing) return;
  const s = ing.salud, id = p.ctx?.id || clasificar(p.texto);
  const quien = hablanteSala(pac);
  let r;
  if (pac.edad < 10 && ['noche', 'hablar', 'motivo', 'dolor'].includes(id)) r = generoNino(s < 25 ? 'Muy mal, doctor. Esta noche ha estado fatal, no ha parado de quejarse.' : s < 50 ? 'Regular. Ha dormido a ratos.' : s < 75 ? 'Algo mejor. Ya ha comido un poco.' : '¡Mucho mejor! Ya quiere jugar y ha pedido la tablet.', pac);
  else if (id === 'noche') r = s < 25 ? 'Muy mal, doctor... cada vez peor... no puedo ni respirar...' : s < 50 ? azar(['Regular, doctor. Me sigue doliendo.', 'Más o menos. Esta noche no he pegado ojo.']) : s < 75 ? azar(['Algo mejor, la verdad.', 'Voy tirando, doctor.']) : azar(['¡Mucho mejor! ¿Cuándo me voy a casa?', 'Estupendamente. Ya estoy harto de la comida de aquí.']);
  else if (['hablar', 'motivo', 'dolor'].includes(id)) {
    r = s < 30 ? 'Fatal, doctor. Peor que ayer. ¿Seguro que me están dando lo correcto?' : s < 60 ? azar(['Me sigue doliendo, pero menos.', 'Bueno, ahí vamos.']) : '¡Bien, bien! Ya casi no me duele nada.';
    if (ing.infeccion && ing.operado) r += ' Y la herida me pica y está muy roja...';
  } else if (id === 'comida' || id === 'habitos') r = azar(['¿Esto es comida? Un caldo sin sal y un yogur. ¿No me podría recetar un cocido leonés, doctor?', 'Horrible. Si me receta unos callos, le hago un monumento.', 'Mire, si me deja tomar un orujito para la digestión, me curo antes.']);
  else r = respuestaGeneral(pac, id, quien === 'paciente' ? 'paciente' : 'acomp');
  await responderCon(quien, r, { tratamiento: `Está ingresado en planta (día ${ing.dias + 1}). ${ing.operado ? 'Le han operado.' : ''} Se encuentra ${s >= 75 ? 'bastante bien' : s >= 45 ? 'regular' : 'mal'}.` });
  if (['hablar', 'motivo', 'dolor'].includes(id) && pac.edad >= 10 && prob(0.3)) charla.pendiente = { ctx: { tipo: 'extra', quien: 'paciente', referencia: azar(['Oiga, ¿y no será que se han equivocado con lo mío?', 'Mi cuñado dice que en el hospital de Ponferrada me habrían curado ya.', 'La enfermera de noche dice que usted es nuevo...']) } };
  actualizarCharla();
}
function panelSala() {
  const ing = G.ingresados[iRonda], e = ENF[ing.pac.enfId];
  const p = $('#panel');
  const pendienteCir = e.trat.accion === 'cirugia' && !ing.operado;
  p.innerHTML = `<div class="pestanas"><button class="on">Planta · ${iRonda + 1}/${G.ingresados.length}</button></div>
    <div class="cuerpo">
      <div class="info-cama"><b>${esc(ing.pac.nombre)} ${esc(ing.pac.apellidos)}</b><small>${esc(ENF[ing.plan.diag]?.n || '—')} · día ${ing.dias + 1} de ingreso${ing.operado ? ' · operado' : ''}</small>
        <div class="barra"><i style="width:${ing.salud}%;background:${ing.salud > 66 ? '#3ad07a' : ing.salud > 33 ? '#f2b33d' : '#e8473f'}"></i></div></div>
      <button class="pregunta" data-s="hablar"><b>¿Cómo se encuentra hoy?</b></button>
      <button class="pregunta" data-s="constantes"><b>Mirar el monitor y la gráfica</b></button>
      <button class="pregunta" data-s="comida"><b>¿Qué tal la comida?</b></button>
      <button class="pregunta" data-s="receta"><b>Revisar el tratamiento</b><small>${ing.plan.receta.length} elementos en la receta</small></button>
      <button class="pregunta" data-s="ficha"><b>Ver la ficha</b><small>Puedes cambiarle el nombre</small></button>
      ${pendienteCir || ing.plan.accion === 'cirugia' && !ing.operado ? '<button class="pregunta" data-s="operar"><b>Llevar a quirófano</b></button>' : ''}
      <button class="pregunta" data-s="alta"><b>Dar el alta</b></button>
      <button class="pregunta" data-s="sig"><b>Siguiente paciente ›</b></button>
    </div><div class="pie"><button class="btn sec mini" id="p-gestion">Gestión</button><button class="btn sec mini" id="p-ajustes">⚙</button></div>`;
  p.classList.add('on');
  $('#p-gestion', p).onclick = () => gestion(); $('#p-ajustes', p).onclick = ajustes;
  $$('[data-s]', p).forEach(b => b.onclick = () => accionSala(b.dataset.s));
}
async function accionSala(a) {
  if (hablandoN && a !== 'sig') return;
  const ing = G.ingresados[iRonda];
  Sonido.clic();
  if (charla.espera && a !== 'sig') return aviso('Termina primero la conversación (HABLAR MÉDICO / RESPONDER PACIENTE).', 'info');
  if (a === 'hablar') ponerTextoMedico('¿Cómo se encuentra hoy? ¿Le duele algo?', { ctx: { tipo: 'sala', id: 'hablar' } });
  if (a === 'comida') ponerTextoMedico('¿Qué tal la comida del hospital?', { ctx: { tipo: 'sala', id: 'comida' } });
  if (a === 'constantes') {
    const v = mundo.vitalesSala;
    abrirModal(`<h2>Gráfica de planta</h2><div class="constantes"><div><small>Salud</small><b>${Math.round(ing.salud)}%</b></div><div><small>Pulso</small><b>${v.fc | 0}</b></div><div><small>Tensión</small><b>${v.tas | 0}/${v.tad | 0}</b></div><div><small>Saturación</small><b>${v.sat | 0}%</b></div></div>
      <p>${ing.salud >= 75 ? 'Evoluciona muy bien. Puede irse de alta.' : ing.salud >= 45 ? 'Evolución lenta pero estable.' : 'Está empeorando. Revisa el diagnóstico y el tratamiento.'}${ing.infeccion ? ' La herida tiene signos de infección: añade un antibiótico.' : ''}</p>`, { clase: 'pequeno' });
  }
  if (a === 'ficha') verFicha(ing.pac);
  if (a === 'receta') {
    const m = abrirModal(`<h2>Tratamiento de ${esc(ing.pac.nombre)}</h2><div id="sa-re"></div><div class="botones"><button class="btn grande" id="sa-ok">Guardar</button></div>`, { clase: 'papel' });
    editorReceta($('#sa-re', m), ing.plan, { confirmar: false, alCambiar: () => {} });
    $('#sa-ok', m).onclick = () => {
      const ev = evaluar(ing.pac, ing.plan);
      ing.q = ev.q;
      if (ing.infeccion && ing.plan.receta.some(r => r.tags.includes('antibiotico'))) { ing.infeccion = false; aviso('La infección de la herida empieza a remitir', 'bien'); }
      guardar(); m.cerrar(); aviso('Tratamiento actualizado', 'bien');
    };
  }
  if (a === 'operar') {
    const m = abrirModal(`<h2>¿Qué operación?</h2>${Object.entries(CIRUGIAS).map(([id, c]) => `<button class="pregunta" data-c="${id}">${c.n}</button>`).join('')}`, { clase: 'pequeno' });
    $$('[data-c]', m).forEach(b => b.onclick = () => { m.cerrar(); ing.plan.cir = b.dataset.c; ing.plan.accion = 'cirugia'; prepararCirugia(ing.pac, ing.plan, 'ronda'); });
  }
  if (a === 'alta') {
    await turnoMedico('Le voy a dar el alta. Puede irse a casa.', { etiqueta: 'Da el alta: revisa el texto y pulsa HABLAR MÉDICO.' });
    const e = ENF[ing.pac.enfId];
    let res;
    if (ing.salud >= 75) res = 'curado'; else if (ing.salud >= 50) res = 'mejora'; else res = e.grav >= 4 ? (prob(0.4) ? 'muerte' : 'urgencias') : 'empeora';
    if (e.trat.accion === 'cirugia' && !ing.operado && e.grav >= 3) res = prob(0.5) ? 'urgencias' : 'muerte';
    await turnoPaciente(hablanteSala(ing.pac), ing.salud >= 75 ? '¡Por fin! Muchas gracias por todo, doctor.' : '¿Ya? Pero si todavía me encuentro mal...');
    const hon = 60 + e.grav * 40 + ing.dias * 40;
    aplicarResultado(ing.pac, res, hon);
    aviso(res === 'curado' ? 'Alta: paciente curado' : 'Alta precipitada...', res === 'curado' ? 'bien' : 'mal');
    G.ingresados.splice(iRonda, 1); guardar();
    if (!G.ingresados[iRonda]) return terminarRonda();
    return mostrarIngresado();
  }
  if (a === 'sig') { Voz.callar(); iRonda++; if (iRonda >= G.ingresados.length) return terminarRonda(); mostrarIngresado(); }
}
async function terminarRonda() {
  mundo.quitar(hCama); hCama = null;
  G.fase = 'consulta'; guardar();
  aviso('Ronda terminada. ¡A la consulta!', 'info');
  siguientePaciente();
}

// ───────────────────────── Fin del día ─────────────────────────
const SUELDOS = { enfermera: 120, anestesista: 260, radiologo: 220, cardiologo: 240, psicologo: 150, cirujano: 320 };
function finDia() {
  modo = 'fin';
  $('#panel').classList.remove('on');
  reiniciarCharla(); mostrarCharla(false);
  // evolución de los ingresados durante la noche
  const evol = [];
  for (const i of G.ingresados) {
    const e = ENF[i.pac.enfId];
    let d = (i.q - 52) / 3 + entre(-5, 5) + (G.personal.enfermera ? 3 : 0) + (i.operado ? 6 : 0) - (i.infeccion ? 10 : 0);
    if (e.trat.accion === 'cirugia' && !i.operado) d = -10 - e.grav * 2;
    if (e.simulador) d = 10;
    i.salud = Math.max(0, Math.min(100, i.salud + d)); i.dias++;
    evol.push(`${i.pac.nombre} ${i.pac.apellidos}: ${d >= 0 ? 'mejora' : 'empeora'} (${Math.round(i.salud)}%)`);
  }
  // cuentas
  const estancias = G.ingresados.length * (150 + (G.inst.vip ? 50 : 0));
  if (estancias) dinero(estancias);
  const extras = (G.inst.cafeteria ? 150 : 0) + (G.inst.parking ? 100 : 0);
  if (extras) dinero(extras);
  const sueldos = Object.keys(G.personal).filter(k => G.personal[k]).reduce((s, k) => s + SUELDOS[k], 0);
  const mant = Object.values(G.equipos).filter(Boolean).length * 30 + G.inst.camas * 20;
  dinero(-(sueldos + mant));
  const balance = G.hoy.ingresos - G.hoy.gastos;
  const repD = G.rep - G.hoy.repIni;
  const ofrecerNombre = !G.renombrado && G.rep >= 85 && G.stats.curados >= 20;
  const m = abrirModal(`<h2>Informe del día ${G.dia}</h2>
    <ul class="informe-dia">${G.hoy.eventos.map(ev => `<li class="${ev.res}">${esc(ev.txt)}${ev.cobro ? ` <b>+${euros(ev.cobro)}</b>` : ''}</li>`).join('') || '<li>Hoy no has atendido a nadie.</li>'}</ul>
    ${evol.length ? `<div class="ficha-sec">PLANTA</div><ul class="informe-dia">${evol.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <table class="tabla cuentas"><tr><td>Ingresos</td><td>${euros(G.hoy.ingresos)}</td></tr><tr><td>Sueldos del personal</td><td>-${euros(sueldos)}</td></tr><tr><td>Mantenimiento</td><td>-${euros(mant)}</td></tr><tr class="${balance >= 0 ? 'ok' : 'mal'}"><td><b>Balance del día</b></td><td><b>${euros(balance)}</b></td></tr><tr><td>Reputación</td><td>${repD >= 0 ? '+' : ''}${repD.toFixed(1)}</td></tr></table>
    ${ofrecerNombre ? `<div class="honor">🏅 El consejo de administración quiere cambiar el nombre del hospital en tu honor.</div>` : ''}
    <div class="botones"><button class="btn sec" id="fd-gest">Gestión del hospital</button>${ofrecerNombre ? '<button class="btn" id="fd-nombre">Aceptar el honor</button>' : ''}<button class="btn grande" id="fd-sig">Empezar el día ${G.dia + 1}</button></div>`, { cerrable: false, clase: 'ancho2' });
  G.dia++; G.fase = 'nuevo'; guardar();
  $('#fd-gest', m).onclick = () => gestion();
  if ($('#fd-nombre', m)) $('#fd-nombre', m).onclick = () => renombrarHospital(true);
  $('#fd-sig', m).onclick = () => { m.cerrar(); if (G.dinero < -3000) aviso('¡Cuidado! El hospital está en números rojos', 'mal'); empezarDia(false); };
}
function renombrarHospital(honor) {
  const ap = G.doctor.nombre.split(' ').slice(-1)[0];
  const sug = `Hospital ${titulo()} ${G.doctor.nombre}`;
  const m = abrirModal(`<h2>${honor ? '¡Un honor merecido!' : 'Nombre del hospital'}</h2><label class="campo">Nuevo nombre<input id="rn-n" value="${esc(honor ? sug : G.hospital)}" maxlength="50"></label><div class="botones"><button class="btn grande" id="rn-ok">Guardar</button></div>`, { clase: 'pequeno' });
  $('#rn-ok', m).onclick = () => { G.hospital = $('#rn-n', m).value.trim() || G.hospital; if (honor) { G.renombrado = true; reputacion(5); Sonido.exito(); aviso(`Ahora trabajas en el ${G.hospital}`, 'bien'); } hud(); guardar(); m.cerrar(); };
}

// ───────────────────────── Gestión ─────────────────────────
const EQUIPOS = {
  ecografo: ['Ecógrafo', 2500, 'Desbloquea las ecografías.'],
  tac: ['Escáner TAC', 9000, 'Desbloquea el TAC: ve lo que la radiografía no ve.'],
  labRapido: ['Laboratorio automático', 1200, 'Los análisis de sangre cuestan la mitad.'],
  monitorAvanzado: ['Monitores avanzados', 3000, 'Menos complicaciones en el quirófano.'],
  instrumental: ['Instrumental de precisión', 2000, 'Te tiembla menos el pulso al operar.'],
  quirofano2: ['Segundo quirófano', 6000, 'Casos más complejos y +20 % por operación.'],
};
const PERSONAL = {
  enfermera: ['Enfermera jefa', 'Te pasa el instrumental, avisa de complicaciones y los ingresados mejoran antes.'],
  anestesista: ['Anestesista', 'Recomienda la anestesia y reduce las complicaciones.'],
  radiologo: ['Radiólogo', 'Informa las radiografías, ecografías y TAC.'],
  cardiologo: ['Cardiólogo', 'Interpreta los electrocardiogramas.'],
  psicologo: ['Psicólogo', 'Los pacientes confiesan sus secretos con más facilidad.'],
  cirujano: ['Cirujano ayudante', 'Menos temblor y menos riesgo en las operaciones.'],
};
function gestion(pest = 'equipos') {
  const precioCama = 1200 + (G.inst.camas - 3) * 600;
  const cuerpo = {
    equipos: Object.entries(EQUIPOS).map(([id, [n, p, d]]) => `<div class="tienda ${G.equipos[id] ? 'tiene' : ''}"><div><b>${n}</b><small>${d}</small></div>${G.equipos[id] ? '<span class="ok">Instalado</span>' : `<button class="btn" data-eq="${id}">${euros(p)}</button>`}</div>`).join(''),
    instalaciones: `
      <div class="tienda"><div><b>Camas en planta: ${G.inst.camas}</b><small>Ocupadas: ${G.ingresados.length}. Cada cama cuesta 20 €/día.</small></div><button class="btn" data-in="cama">+1 cama · ${euros(precioCama)}</button></div>
      <div class="tienda ${G.inst.vip ? 'tiene' : ''}"><div><b>Habitaciones VIP</b><small>+30 % en honorarios y un paciente más al día.</small></div>${G.inst.vip ? '<span class="ok">Construido</span>' : `<button class="btn" data-in="vip">${euros(5000)}</button>`}</div>
      <div class="tienda ${G.inst.cafeteria ? 'tiene' : ''}"><div><b>Cafetería</b><small>+150 € al día. Con cocido los jueves.</small></div>${G.inst.cafeteria ? '<span class="ok">Construido</span>' : `<button class="btn" data-in="cafeteria">${euros(4000)}</button>`}</div>
      <div class="tienda ${G.inst.parking ? 'tiene' : ''}"><div><b>Aparcamiento</b><small>+100 € al día.</small></div>${G.inst.parking ? '<span class="ok">Construido</span>' : `<button class="btn" data-in="parking">${euros(3000)}</button>`}</div>`,
    personal: Object.entries(PERSONAL).map(([id, [n, d]]) => `<div class="tienda ${G.personal[id] ? 'tiene' : ''}"><div><b>${n}</b><small>${d} Sueldo: ${euros(SUELDOS[id])}/día.</small></div><button class="btn ${G.personal[id] ? 'sec' : ''}" data-pe="${id}">${G.personal[id] ? 'Despedir' : 'Contratar'}</button></div>`).join(''),
    hospital: `<div class="stats"><div><b>${G.stats.atendidos}</b><small>Pacientes</small></div><div><b>${G.stats.curados}</b><small>Curados</small></div><div><b>${G.stats.operaciones}</b><small>Operaciones</small></div><div><b>${G.stats.fallecidos}</b><small>Fallecidos</small></div></div>
      <p>Para que el hospital lleve tu nombre necesitas 85 de reputación y 20 pacientes curados.</p>
      <div class="botones"><button class="btn" id="ge-medico">Editar médico (nombre y aspecto)</button>${G.renombrado ? '<button class="btn sec" id="ge-nombre">Cambiar nombre del hospital</button>' : ''}</div>
      <div class="ficha-sec">ÚLTIMOS PACIENTES</div><ul class="informe-dia">${G.historial.slice(-12).reverse().map(h => `<li class="${h.res}">Día ${h.dia}: ${esc(h.nombre)} — ${esc(h.enf)} (${h.res})</li>`).join('') || '<li>Ninguno todavía.</li>'}</ul>`,
  }[pest];
  cerrarGestion();
  const m = abrirModal(`<h2>Gestión · ${esc(G.hospital)}</h2><div class="saldo">${euros(G.dinero)} · Reputación ${Math.round(G.rep)}</div>
    <div class="pestanas">${[['equipos', 'Equipos'], ['instalaciones', 'Instalaciones'], ['personal', 'Personal'], ['hospital', 'Hospital']].map(([id, n]) => `<button class="${id === pest ? 'on' : ''}" data-g="${id}">${n}</button>`).join('')}</div>
    <div class="gestion">${cuerpo}</div>`, { clase: 'ancho2 gestion-modal' });
  $$('[data-g]', m).forEach(b => b.onclick = () => gestion(b.dataset.g));
  const pagar = (n) => { if (G.dinero < n) { aviso('No tienes dinero suficiente', 'mal'); Sonido.fallo(); return false; } dinero(-n, 'Inversión'); return true; };
  $$('[data-eq]', m).forEach(b => b.onclick = () => { const id = b.dataset.eq; if (pagar(EQUIPOS[id][1])) { G.equipos[id] = true; guardar(); gestion(pest); if (modo === 'consulta') panelConsulta($('#panel').dataset.pestana || 'hablar'); } });
  $$('[data-in]', m).forEach(b => b.onclick = () => { const id = b.dataset.in; const precio = id === 'cama' ? precioCama : { vip: 5000, cafeteria: 4000, parking: 3000 }[id]; if (pagar(precio)) { if (id === 'cama') G.inst.camas++; else G.inst[id] = true; guardar(); gestion(pest); } });
  $$('[data-pe]', m).forEach(b => b.onclick = () => { const id = b.dataset.pe; G.personal[id] = !G.personal[id]; Sonido.clic(); aviso(G.personal[id] ? `${PERSONAL[id][0]} contratado` : `${PERSONAL[id][0]} despedido`, 'info'); guardar(); gestion(pest); });
  if ($('#ge-medico', m)) $('#ge-medico', m).onclick = () => { cerrarModales(); $('#panel').classList.remove('on'); vueltaGestion = modo; creadorMedico(false); };
  if ($('#ge-nombre', m)) $('#ge-nombre', m).onclick = () => renombrarHospital(false);
}
function cerrarGestion() { $$('.gestion-modal').forEach(m => m.cerrar()); }
let vueltaGestion = 'consulta';
function volverDeGestion() {
  modo = vueltaGestion; document.body.dataset.modo = 'juego';
  hud();
  if (vueltaGestion === 'sala') { mundo.mostrar('sala'); panelSala(); }
  else if (vueltaGestion === 'fin') { mundo.mostrar('consulta'); mundo.vistaEscritorio(0); empezarDia(false); }
  else { mundo.mostrar('consulta'); mundo.vistaEscritorio(0); if (pac && hPac) panelConsulta('hablar'); else siguientePaciente(); }
}

// ───────────────────────── Arranque ─────────────────────────
$('#hud-menu').onclick = () => {
  const m = abrirModal(`<h2>Menú</h2><div class="botones col"><button class="btn" id="mn-gest">Gestión del hospital</button><button class="btn" id="mn-med">Editar médico</button><button class="btn sec" id="mn-como">Cómo se juega</button><button class="btn sec" id="mn-aj">Ajustes</button><button class="btn sec" id="mn-ini">Pantalla de inicio</button></div>`, { clase: 'pequeno' });
  $('#mn-gest', m).onclick = () => { m.cerrar(); gestion(); };
  $('#mn-med', m).onclick = () => { m.cerrar(); if (modo === 'cirugia' || modo === 'preqx' || modo === 'esteto') return aviso('Termina primero lo que estás haciendo', 'mal'); vueltaGestion = modo; $('#panel').classList.remove('on'); creadorMedico(false); };
  $('#mn-como', m).onclick = () => { m.cerrar(); comoSeJuega(); };
  $('#mn-aj', m).onclick = () => { m.cerrar(); ajustes(); };
  $('#mn-ini', m).onclick = () => { guardar(); location.reload(); };
};
$('#hud-voz').onclick = () => { if (!G) return; G.ajustes.voz = !G.ajustes.voz; Voz.activa = G.ajustes.voz; if (!G.ajustes.voz) Voz.callar(); $('#hud-voz').classList.toggle('off', !G.ajustes.voz); guardar(); };

try {
  // personajes modelados en Blender; si no cargan, se usan los hechos por código
  try { await cargarModelos(); } catch (e) { console.warn('Sin modelos de Blender:', e); }
  crearMundo();
  pantallaInicio();
  $('#cargando').remove();
} catch (err) {
  console.error(err);
  $('#cargando').innerHTML = `<p>No se ha podido iniciar el 3D en este dispositivo.</p><small>${esc(err.message)}</small>`;
}
// ───────────────────────── Mando ─────────────────────────
Mando.alConectar = (on, nombre) => aviso(on ? `Mando conectado${nombre ? `: ${nombre.replace(/\(.*\)/, '').trim()}` : ''}. Pulsa VISTA para ver los controles.` : 'Mando desconectado', 'info');
Mando.alAccion = (b) => {
  const hayModal = !!$('#modales .modal-fondo');
  if (b === 'MENU') { if (hayModal) { const c = $('#modales .modal-fondo:last-child .cerrar'); if (c) c.click(); } else if (G && document.body.dataset.modo !== 'inicio') $('#hud-menu').click(); else ajustes(); return true; }
  if (b === 'VISTA') { mostrarControles(); return true; }
  if (charla.activa && !hayModal) {
    if (b === 'X') { hablarMedico(); return true; }
    if (b === 'Y') { responderPaciente(); return true; }
    if (b === 'LT') { alternarMicro(cajaCharla()); return true; }
    if (b === 'ATRAS' && Dictado.escuchando) { Dictado.parar(); return true; }
  }
  if (modo === 'cirugia' && cir && (b === 'LB' || b === 'RB')) {
    const botones = $$('#cir-hud [data-h]'); const i = botones.findIndex(x => x.classList.contains('on'));
    const sig = botones[(i + (b === 'RB' ? 1 : -1) + botones.length) % botones.length]; if (sig) sig.click();
    return true;
  }
  if (modo === 'esteto' && b === 'B') { terminarAuscultacion(); return true; }
  return false;
};
// con mando, las actividades con puntero (estetoscopio, imágenes, quirófano) usan un cursor virtual
mundoActualizar(() => { Mando.modoCursor = Mando.conectado && (modo === 'cirugia' || modo === 'esteto' || !!$('.rx-dibujo')); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && modo !== 'esteto') { const c = $('#modales .modal-fondo:last-child .cerrar'); if (c) c.click(); } });
Mando.iniciar();

window.__juego = { get G() { return G; }, get mundo() { return mundo; }, get pac() { return pac; }, get cir() { return cir; }, get charla() { return charla; }, perfilesPrueba, lineasReceta, Voz, Mando, Dictado };
