// EL MEJOR MÉDICO — lógica del juego e interfaz.
import * as THREE from 'three';
import {
  azar, entre, entreInt, prob, normaliza, ENFERMEDADES, ENF, RECETARIO, CAT_NOMBRE, itemLibre, buscarReceta, PAUTAS, DURACIONES,
  RESPUESTAS_AUTORIDAD, fmt, generarPaciente, fraseHabitos, fraseAntecedentes, fraseAlergia, evaluarTratamiento, reaccionReceta,
  SANGRE, ORINA, PRUEBAS, ZONAS_RX, CIRUGIAS, ANESTESIAS, ANTECEDENTES, NOMBRES_H, NOMBRES_M, APELLIDOS,
} from './datos.js';
import { Voz, Sonido } from './audio.js';
import { Mundo, crearHumano, ROPAS, PELOS_NOMBRES, BARBAS_NOMBRES, GAFAS_NOMBRES } from './escena.js';
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
    ajustes: { voz: true, sonido: true, calidad: 'alta', velVoz: 1 },
  };
}
let G = null;
function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(G)); } catch (e) {} }
function cargar() { try { const s = localStorage.getItem(CLAVE); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
const titulo = () => G.doctor.sexo === 'm' ? 'Dra.' : 'Dr.';
const nombreDoctor = () => `${titulo()} ${G.doctor.nombre}`;

// ───────────────────────── Mundo 3D ─────────────────────────
const canvas = $('#lienzo3d');
let mundo = null;
function crearMundo() {
  mundo = new Mundo(canvas);
  mundo.ponerCalidad(G?.ajustes.calidad || (matchMedia('(max-width: 700px)').matches ? 'media' : 'alta'));
  mundo.construirConsulta(G ? G.doctor : doctorPorDefecto());
  mundo.construirSala();
  mundo.construirQuirofano();
  mundo.construirCreador();
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
function infoHablante(quien) {
  if (quien === 'doctor') return { nombre: nombreDoctor(), genero: G.doctor.voz, tono: 1, vel: 1, clase: 'doctor', semilla: 0 };
  if (quien === 'paciente' && pac) return { nombre: `${pac.nombre} ${pac.apellidos}`, genero: pac.sexo, tono: pac.voz.tono, vel: pac.voz.vel, clase: 'paciente', humano: modo === 'sala' ? hCama : (hPacSin && hPacSin.raiz.parent ? hPacSin : hPac), semilla: pac.id };
  if (quien === 'acomp' && pac) return { nombre: `Acompañante (${pac.acompanante})`, genero: /mujer|hija|madre|hermana/.test(pac.acompanante) ? 'm' : 'h', tono: 1.05, vel: 1.08, clase: 'acomp', humano: hAcomp, semilla: pac.id + 7 };
  if (typeof quien === 'object') return { clase: 'otro', tono: 1, vel: 1.05, semilla: 3, ...quien };
  return { nombre: '', genero: 'h', tono: 1, vel: 1, clase: 'otro', semilla: 1 };
}
function decir(quien, texto) {
  hablandoN++; $('#panel').classList.add('ocupado');
  cola = cola.then(async () => {
    const info = infoHablante(quien);
    let t = texto;
    if (quien !== 'doctor' && G.doctor.sexo === 'm') t = t.replace(/\b([Dd])octor\b/g, '$1octora');
    const sub = $('#subtitulo');
    sub.innerHTML = `<b class="${info.clase}">${esc(info.nombre)}</b><span>${esc(t)}</span>`;
    sub.classList.add('on');
    if (info.humano) info.humano.hablando = true;
    if (quien === 'doctor') mundo.doctorHablando = true;
    Voz.activa = G.ajustes.voz;
    await Voz.hablar(t.replace(/\(.*?\)/g, ''), { genero: info.genero, tono: info.tono, vel: info.vel * (G.ajustes.velVoz || 1), quien: info.clase + Math.random(), semilla: info.semilla });
    if (info.humano) info.humano.hablando = false;
    mundo.doctorHablando = false;
    hablandoN--;
    if (!hablandoN) { $('#panel').classList.remove('ocupado'); setTimeout(() => { if (!hablandoN) sub.classList.remove('on'); }, 2500); }
  });
  return cola;
}
$('#subtitulo').addEventListener('click', () => Voz.callar());

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
    <p class="nota">Las voces usan el sintetizador en español de tu dispositivo. Pulsa los subtítulos para saltar una frase.</p>`;
  $('#inicio').classList.add('on');
  $('#b-continuar') && ($('#b-continuar').onclick = () => { Sonido.iniciar(); G = guardada; G.ajustes = { voz: true, sonido: true, calidad: 'alta', velVoz: 1, ...G.ajustes }; mundo.actualizarDoctor(G.doctor); $('#inicio').classList.remove('on'); empezarDia(true); });
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
    <li><b>Consulta.</b> Habla con cada paciente: pregúntale qué le pasa, desde cuándo, sus hábitos... Algunos esconden cosas: gánate su confianza o pide al acompañante que salga.</li>
    <li><b>Explora.</b> Toma las constantes, ausculta pulmones y corazón con el estetoscopio (mueve el dedo o el ratón por la espalda), palpa la barriga o mira la garganta.</li>
    <li><b>Pide pruebas.</b> Análisis, radiografías, electrocardiograma, ecografía y TAC (estos dos hay que comprarlos). En las imágenes, rodea con el dedo la zona sospechosa.</li>
    <li><b>Decide.</b> Elige el diagnóstico, qué hacer (casa, ingreso o quirófano) y escribe la receta: puedes recetar <i>cualquier</i> medicamento, comida o bebida, del cocido leonés al orujo. Cada cosa tiene sus consecuencias.</li>
    <li><b>Comunica la noticia</b> con tacto. Los pacientes tienen sentimientos.</li>
    <li><b>Opera.</b> Elige la anestesia, lávate y ponte guantes, y usa el bisturí, las pinzas, el separador, el aspirador y la sutura. Atento a las complicaciones del monitor.</li>
    <li><b>Ronda de guardia.</b> Cada mañana visita a tus ingresados, ajusta tratamientos y da altas.</li>
    <li><b>Gestiona.</b> Con el dinero, compra equipos, amplía la planta y contrata especialistas. Con mucha reputación, el hospital llevará tu nombre.</li>
  </ol>`);
}
function ajustes() {
  const a = G?.ajustes || { voz: true, sonido: true, calidad: 'alta', velVoz: 1 };
  const m = abrirModal(`<h2>Ajustes</h2>
    <label class="fila"><input type="checkbox" id="aj-voz" ${a.voz ? 'checked' : ''}> Voces habladas en español</label>
    <label class="fila">Velocidad de voz <input type="range" id="aj-vel" min="0.7" max="1.4" step="0.05" value="${a.velVoz || 1}"></label>
    <label class="fila">Calidad gráfica <select id="aj-cal"><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja (móviles antiguos)</option></select></label>
    <p class="nota">Voces encontradas: ${Voz.nombres.length ? esc(Voz.nombres.slice(0, 6).join(' · ')) : 'ninguna en español; se mostrarán sólo subtítulos. En Android instala «Síntesis de voz de Google» con el idioma Español.'}</p>
    <div class="botones"><button class="btn" id="aj-probar">Probar voz</button>${G ? '<button class="btn peligro" id="aj-borrar">Borrar partida</button>' : ''}</div>`);
  $('#aj-cal', m).value = a.calidad;
  const aplicar = () => { a.voz = $('#aj-voz', m).checked; a.velVoz = +$('#aj-vel', m).value; a.calidad = $('#aj-cal', m).value; if (G) { G.ajustes = a; guardar(); } mundo.ponerCalidad(a.calidad); };
  $$('input,select', m).forEach(el => el.onchange = aplicar);
  $('#aj-probar', m).onclick = () => { aplicar(); Voz.activa = a.voz; Voz.hablar('Buenos días. Soy el mejor médico de León. ¿Qué le trae por aquí?', { genero: G?.doctor.voz || 'h', vel: a.velVoz }); };
  if ($('#aj-borrar', m)) $('#aj-borrar', m).onclick = () => { if (confirm('¿Seguro que quieres borrar la partida?')) { localStorage.removeItem(CLAVE); location.reload(); } };
}

// ───────────────────────── Creador del médico ─────────────────────────
function creadorMedico(nuevo = false, base = null) {
  modo = 'creador'; document.body.dataset.modo = 'creador';
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
    else if (c === 'sexo') { d.sexo = b.dataset.s; d.voz = b.dataset.s; if (d.sexo === 'm') { d.barba = 0; if (d.estilo < 4) d.estilo = 5; } }
    else if (c === 'voz') d.voz = b.dataset.s;
    else if (c === 'ropa') d.ropa = b.dataset.ropa;
    if (c) { $$(`button[data-c="${c}"]`, p).forEach(x => x.classList.toggle('on', x === b || (c === 'sexo' && x.dataset.s === d.sexo))); if (c === 'sexo') $$('button[data-c="voz"]', p).forEach(x => x.classList.toggle('on', x.dataset.s === d.voz)); refrescar(); }
  };
  $$('input[type=range]', p).forEach(r => r.oninput = () => { d[r.dataset.r] = +r.value; refrescar(); });
  $('#cr-nombre', p).oninput = (e) => { d.nombre = e.target.value; };
  $('#cr-cara', p).onclick = () => { cara = !cara; mundo.giroCreador = cara ? 0 : 0.25; if (cara) mundo.peana.rotation.y = 0; mundo.vistaCreador(cara ? 'cara' : 'cuerpo'); $('#cr-cara', p).textContent = cara ? 'Ver cuerpo' : 'Ver cara'; };
  $('#cr-oir', p).onclick = () => { Voz.hablar(`Buenos días. Soy ${d.sexo === 'm' ? 'la doctora' : 'el doctor'} ${d.nombre || ''}. Pase y siéntese, por favor.`, { genero: d.voz }); };
  $('#cr-azar', p).onclick = () => {
    d.sexo = prob(0.5) ? 'h' : 'm'; d.voz = d.sexo; d.piel = azar(PIELES); d.ojos = azar(COLORES_OJOS); d.pelo = azar(COLORES_PELO);
    d.estilo = d.sexo === 'h' ? azar([0, 1, 2, 3]) : azar([3, 4, 5, 6, 7]); d.barba = d.sexo === 'h' ? entreInt(0, 5) : 0; d.gafas = prob(0.4) ? entreInt(1, 3) : 0;
    d.cara = +entre(0.93, 1.07).toFixed(2); d.nariz = +entre(0.85, 1.2).toFixed(2); d.complexion = +entre(0.9, 1.2).toFixed(2); d.altura = +entre(0.94, 1.06).toFixed(2); d.ropa = azar(ROPA_MEDICO);
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
function empezarDia(continuar) {
  document.body.dataset.modo = 'juego';
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
  const caso = new URLSearchParams(location.search).get('caso');
  pac = generarPaciente({ dia: G.dia, rep: G.rep, equipos: G.equipos, forzar: caso && ENF[caso] ? caso : null });
  pac.hallazgos = []; pac.receta = []; pac.notas = '';
  preguntasHechas = 0;
  await fundido(() => {
    mundo.mostrar('consulta');
    [hPac, hAcomp, hPacSin].forEach(h => mundo.quitar(h)); hPacSin = null;
    hPac = mundo.registrar(crearHumano(pac.apariencia, 'paciente'));
    mundo.ponerPacienteConsulta(hPac, 'silla');
    hPac.dolor = ['apendicitis', 'colico_renal', 'infarto', 'fractura_muneca'].includes(pac.enfId);
    hPac.agitado = ['ansiedad', 'infarto', 'neumonia'].includes(pac.enfId);
    acompDentro = !!pac.acompanante;
    if (acompDentro) {
      const mujer = /mujer|hija|madre|hermana/.test(pac.acompanante);
      const ap = generarPaciente({ dia: 1 }).apariencia; ap.sexo = mujer ? 'm' : 'h'; ap.estilo = mujer ? azar([3, 4, 5, 6, 7]) : azar([0, 1, 2, 3]); ap.barba = mujer ? 0 : ap.barba;
      hAcomp = mundo.registrar(crearHumano(ap, 'calle'));
      mundo.ponerPacienteConsulta(hAcomp, 'acomp');
    }
    mundo.vistaEscritorio(0);
  });
  Sonido.puerta();
  panelConsulta('hablar');
  await decir('doctor', `Buenos días. Pase, pase. Siéntese, por favor. Soy ${G.doctor.sexo === 'm' ? 'la doctora' : 'el doctor'} ${G.doctor.nombre.split(' ').slice(-1)[0]}.`);
  await decir('paciente', azar(['Buenos días, doctor.', 'Hola, doctor. Gracias por atenderme.', 'Buenas... a ver si me arregla esto, doctor.']));
  if (acompDentro) decir('acomp', azar(['Buenos días. Vengo con él, que si no, no viene.', 'Hola, doctor. Yo le acompaño.', 'Buenos días. Es que solo no se aclara.']).replace('él', pac.sexo === 'm' ? 'ella' : 'él'));
}

function panelConsulta(pestana = 'hablar') {
  const p = $('#panel');
  const e = ENF[pac.enfId];
  p.dataset.pestana = pestana;
  const tabs = [['hablar', 'Hablar'], ['explorar', 'Explorar'], ['pruebas', 'Pruebas'], ['ficha', 'Ficha'], ['decidir', 'Decidir']];
  let cuerpo = '';
  if (pestana === 'hablar') {
    const pre = preguntasDisponibles();
    cuerpo = pre.map(q => `<button class="pregunta ${pac.preguntas[q.id] ? 'hecha' : ''}" data-q="${q.id}">${esc(q.t)}</button>`).join('');
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
  const e = ENF[pac.enfId];
  const l = [
    { id: 'motivo', t: 'Buenos días. ¿Qué le trae por aquí?' },
    { id: 'inicio', t: '¿Desde cuándo le pasa?' },
    { id: 'dolor', t: '¿Dónde le duele exactamente? ¿Cómo es el dolor?' },
    { id: 'fiebre', t: '¿Ha tenido fiebre o escalofríos?' },
    { id: 'habitos', t: '¿Fuma? ¿Bebe alcohol? ¿Qué suele comer?' },
    { id: 'antecedentes', t: '¿Tiene alguna enfermedad o toma medicación?' },
    { id: 'alergia', t: '¿Es alérgico a algún medicamento o alimento?' },
  ];
  if (e.d.extra) l.push({ id: 'extra', t: '¿Ha notado algo más, aunque le parezca una tontería?' });
  l.push({ id: 'calmar', t: 'Tranquilo. Está en buenas manos, puede confiar en mí.' });
  if (acompDentro) l.push({ id: 'acomp', t: '¿Le importaría a su acompañante esperar fuera un momento?' });
  l.push({ id: 'secreto', t: '¿Hay algo más que deba saber? Todo es confidencial.' });
  l.push({ id: 'presionar', t: 'Creo que no me está contando toda la verdad.' });
  return l.map(q => ({ ...q, t: q.id === 'calmar' && pac.sexo === 'm' ? q.t.replace('Tranquilo', 'Tranquila') : q.t }));
}
function anotar(texto) { if (!pac.hallazgos.includes(texto)) pac.hallazgos.push(texto); }

async function preguntar(id) {
  if (hablandoN) return;
  Sonido.clic();
  const e = ENF[pac.enfId];
  const q = preguntasDisponibles().find(x => x.id === id);
  const repetida = pac.preguntas[id];
  pac.preguntas[id] = true; preguntasHechas++;
  pasarTiempo(2);
  panelConsulta('hablar');
  decir('doctor', q.t);
  let r = '';
  const tieneSecreto = e.secreto && (pac.enfId !== 'infarto' || pac.tomoViagra);
  switch (id) {
    case 'motivo': r = fmt(azar(e.d.motivo), pac); anotar(`Síntomas: ${e.sintomas.slice(0, 2).join(', ').toLowerCase()}`); break;
    case 'inicio': r = fmt(azar(e.d.inicio), pac); anotar(`Inicio: ${r.replace(/\.$/, '')}`); break;
    case 'dolor': r = fmt(azar(e.d.dolor), pac); anotar(`Dolor: ${r.replace(/\.$/, '')}`); break;
    case 'fiebre': r = fmt(azar(e.d.fiebre), pac); break;
    case 'habitos': r = fmt(fraseHabitos(pac), pac); anotar(`Hábitos: ${r}`); break;
    case 'antecedentes': r = fraseAntecedentes(pac); pac.antecedentesVistos = true; break;
    case 'alergia': r = fmt(fraseAlergia(pac), pac); anotar(`Alergias: ${pac.alergia || 'ninguna conocida'}`); break;
    case 'extra': r = fmt(azar(e.d.extra), pac); anotar(r); break;
    case 'calmar': pac.confianza++; r = azar(['Gracias, doctor. Es que estoy muy preocupad{o}.', 'Vale... me quedo más tranquil{o}.', 'Se agradece, doctor.']); r = fmt(r, pac); break;
    case 'acomp':
      await cola;
      await decir('acomp', azar(['Claro, claro. Espero fuera.', 'Bueno... vale. Estaré en la sala de espera.', '¿Yo? Bueno, como quiera.']));
      await fundido(() => { mundo.quitar(hAcomp); hAcomp = null; acompDentro = false; }, 250);
      Sonido.puerta(); pac.confianza++;
      panelConsulta('hablar');
      return;
    case 'secreto':
      if (tieneSecreto && !pac.secretoRevelado) {
        const v = e.secreto.v - (G.personal.psicologo ? 1 : 0);
        if (acompDentro && v >= 2) { r = '(mira de reojo a su acompañante) No... no, doctor. Nada más.'; aviso('Parece que no quiere hablar delante de su acompañante', 'info'); }
        else if (pac.confianza >= v) { r = e.secreto.t; pac.secretoRevelado = true; anotar(`Confesión: ${e.secreto.hallazgo}`); Sonido.exito(); }
        else { r = azar(['Eh... no, nada más, doctor.', 'No, no. Eso es todo.']); aviso('Se guarda algo. Quizá necesite más confianza.', 'info'); }
      } else r = repetida ? 'Ya se lo he contado todo, doctor.' : azar(['No, doctor. Le he contado todo.', 'Nada más, que yo sepa.']);
      break;
    case 'presionar':
      if (e.simulador && pac.confianza >= 1 && !pac.secretoRevelado) { r = e.secreto.t; pac.secretoRevelado = true; anotar(`Confesión: ${e.secreto.hallazgo}`); }
      else if (tieneSecreto && !pac.secretoRevelado && pac.confianza >= e.secreto.v + 1) { r = e.secreto.t; pac.secretoRevelado = true; anotar(`Confesión: ${e.secreto.hallazgo}`); }
      else { pac.confianza = Math.max(0, pac.confianza - 1); pac.molesto = (pac.molesto || 0) + 1; r = azar(['¿Me está llamando mentiros{o}? Lo que me faltaba.', 'Oiga, que yo vengo a que me curen, no a que me interroguen.']); r = fmt(r, pac); }
      break;
  }
  await decir('paciente', r);
  // a veces el paciente cuestiona la autoridad del médico
  if (pac.cuestiona && preguntasHechas >= 3 && !pac.cuestionado) {
    pac.cuestionado = true;
    await decir('paciente', pac.cuestiona);
    const m = abrirModal(`<h3>¿Qué le respondes?</h3>${RESPUESTAS_AUTORIDAD.map(([t], i) => `<button class="pregunta" data-i="${i}">${esc(t)}</button>`).join('')}`, { clase: 'pequeno', cerrable: false });
    $$('[data-i]', m).forEach(b => b.onclick = async () => {
      m.cerrar(); const [t, v] = RESPUESTAS_AUTORIDAD[+b.dataset.i];
      pac.satisfaccion = (pac.satisfaccion || 0) + v;
      await decir('doctor', t);
      decir('paciente', v > 0 ? 'Vale, vale. Usted sabrá, que para eso estudió.' : v === 0 ? 'Hmm... bueno.' : '¡Qué humos! Pues vaya.');
    });
  }
  if (id === 'motivo' && acompDentro && prob(0.5)) decir('acomp', azar(['Y no come nada, doctor. Nada.', 'Y por las noches no deja dormir a nadie.', 'Yo ya le dije que viniera hace una semana.']));
}

// ───── Exploración ─────
async function explorar(id) {
  if (hablandoN) return;
  Sonido.clic();
  const e = ENF[pac.enfId], ex = e.expl, v = pac.vit;
  pac.preguntas['ex_' + id] = true;
  pasarTiempo(4);
  if (id === 'constantes') {
    decir('doctor', 'Vamos a tomarle la tensión, la temperatura y el pulso.');
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
    decir('doctor', 'Abra la boca y diga «aaaa».');
    const m = abrirModal(`<h2>Garganta</h2><canvas width="420" height="320" class="imagen"></canvas><p>${{ normal: 'Faringe y amígdalas normales.', roja: 'Faringe enrojecida, sin placas.', placas: 'Amígdalas hinchadas con placas de pus.' }[ex.garganta]}</p>`, { clase: 'pequeno' });
    dibujarGarganta($('canvas', m).getContext('2d'), 420, 320, ex.garganta);
    anotar(`Garganta: ${{ normal: 'normal', roja: 'enrojecida', placas: 'placas de pus en amígdalas' }[ex.garganta]}`);
    await decir('paciente', 'Aaaaaaa...');
    return;
  }
  if (id === 'zona') {
    decir('doctor', 'A ver, déjeme ver la zona... ¿Le duele aquí?');
    abrirModal(`<h2>Exploración</h2><p class="manuscrito">${esc(ex.zona)}</p>`, { clase: 'pequeno' });
    anotar(`Exploración: ${ex.zona}`);
    await decir('paciente', e.simulador ? azar(['¡Ay! Sí... bueno, no. Un poco. Creo.', 'Ahí... o un poco más arriba. Me duele todo.']) : azar(['¡Ay! Sí, ahí, ahí.', 'Uf, con cuidado, doctor.', 'Ahí me molesta, sí.']));
  }
}

// ───── Estetoscopio ─────
let esteto = null;
async function auscultar(tipo) {
  const e = ENF[pac.enfId];
  await decir('doctor', tipo === 'pulmones' ? 'Póngase de pie y quítese la bata de arriba, por favor. Voy a escucharle la espalda.' : 'Póngase de pie, por favor. Voy a escucharle el corazón.');
  modo = 'esteto'; document.body.dataset.modo = 'esteto';
  await fundido(() => {
    hPac.raiz.visible = false;
    if (!hPacSin) { hPacSin = mundo.registrar(crearHumano(pac.apariencia, 'paciente_sin')); hPacSin.agitado = hPac.agitado; }
    hPacSin.raiz.visible = true;
    mundo.ponerPacienteConsulta(hPacSin, tipo === 'pulmones' ? 'espalda' : 'frente');
    if (hAcomp) hAcomp.mirar = new THREE.Vector3(2.9, 1.4, -0.6);
    mundo.vistaExplorar(tipo === 'pulmones' ? 'espalda' : 'pecho', 0);
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
    if ((lado === 'der' && derecha) || (lado === 'izq' && !derecha)) return (t === 'crepitantes' && !base && i < 2) ? 'normal' : t;
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
function mundoActualizar(fn) { setTimeout(() => mundo && mundo.alActualizar.push(fn), 0); }
async function terminarAuscultacion() {
  if (!esteto) return;
  if (esteto.parar) esteto.parar();
  const e = ENF[pac.enfId];
  const oidos = esteto.oidos.size, tipo = esteto.tipo;
  esteto = null; mundo.marcadores.clear(); mundo.esteto.visible = false;
  $('#esteto-hud').innerHTML = '';
  if (oidos >= 2) {
    if (tipo === 'pulmones') { const t = { normal: 'murmullo vesicular normal', sibilancias: 'sibilancias (pitos) en ambos pulmones', crepitantes_der: 'crepitantes en la base derecha', crepitantes_izq: 'crepitantes en la base izquierda', disminuido_izq: 'murmullo disminuido en el pulmón izquierdo', disminuido_der: 'murmullo disminuido en el pulmón derecho' }[e.expl.pulmon]; anotar(`Auscultación pulmonar: ${t}`); aviso(`Oyes: ${t}`, 'info'); }
    else { const t = { normal: 'tonos rítmicos, sin soplos', taquicardia: 'tonos rítmicos y rápidos (taquicardia)', arritmia: 'ritmo irregular', soplo: 'soplo suave' }[e.expl.corazon]; anotar(`Auscultación cardíaca: ${t}`); aviso(`Oyes: ${t}`, 'info'); }
  } else aviso('No has escuchado lo suficiente para sacar conclusiones', 'mal');
  await fundido(() => { hPacSin.raiz.visible = false; hPac.raiz.visible = true; if (hAcomp) hAcomp.mirar = new THREE.Vector3(0, 1.26, 1.62); mundo.vistaEscritorio(0); });
  modo = 'consulta'; document.body.dataset.modo = 'juego';
  decir('doctor', 'Muy bien, ya puede sentarse.');
}

// ───── Palpación ─────
function palpar() {
  const e = ENF[pac.enfId]; const zona = e.expl.palpacion.zona;
  decir('doctor', 'Túmbese en la camilla. Voy a apretarle un poco la barriga; dígame si le duele.');
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
    if (fuerte) { Sonido.ay(); hPac.dolor = true; decir('paciente', azar(['¡AY! ¡Ahí, ahí! ¡No apriete!', '¡Uuuh! Ahí me duele muchísimo.', '¡Ay, por Dios, doctor!'])); }
    else if (duele) decir('paciente', zona === 'cambiante' ? azar(['¡Ay!... bueno, no, ahí no. ¿O sí?', 'Ahí también... creo.']) : azar(['Ahí me molesta un poco.', 'Hmm, un poco.']));
    else if (prob(0.4)) decir('paciente', azar(['Ahí no.', 'No, ahí nada.', 'Eso me hace cosquillas.']));
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
  if (id === 'tac' || id === 'eco') decir('doctor', `Vamos a hacerle ${id === 'tac' ? 'un TAC' : 'una ecografía'}. No se preocupe, no duele.`);
  if (id === 'sangre') decir('paciente', azar(['¿Pincho? Uy, que me mareo con la sangre...', 'Vale, pero con cuidado, que tengo las venas finas.']));
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
  dib.onpointerdown = (ev) => { dib.setPointerCapture(ev.pointerId); trazo = [pos(ev)]; dc.clearRect(0, 0, 512, 512); };
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
        <label>EDAD <span class="manuscrito">${p.edad}</span></label>
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
function editorReceta(cont, lista, { reaccion = true, alCambiar = () => {} } = {}) {
  cont.innerHTML = `<div class="receta">
    <div class="receta-buscar"><input id="re-q" placeholder="Escribe cualquier cosa: paracetamol, cocido leonés, orujo, merluza..." autocomplete="off"><div class="receta-sug" id="re-sug"></div></div>
    <div class="receta-cats">${Object.entries(CAT_NOMBRE).map(([c, n]) => `<button class="op" data-cat="${c}">${n}s</button>`).join('')}</div>
    <div class="receta-lista" id="re-lista"></div></div>`;
  const q = $('#re-q', cont), sug = $('#re-sug', cont), lis = $('#re-lista', cont);
  const pintar = () => {
    lis.innerHTML = lista.length ? lista.map((r, i) => `<div class="receta-item cat-${r.cat}"><div><b>${esc(r.n)}</b><small>${CAT_NOMBRE[r.cat]}${r.libre ? ' · escrito a mano' : ''}</small></div>
      <select data-i="${i}" data-k="pauta">${PAUTAS.map(p => `<option ${p === r.pauta ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <select data-i="${i}" data-k="dur">${DURACIONES.map(p => `<option ${p === r.dur ? 'selected' : ''}>${p}</option>`).join('')}</select>
      <button class="quitar" data-q="${i}" aria-label="Quitar">✕</button></div>`).join('') : '<p class="vacio manuscrito">Receta vacía. Puedes recetar medicamentos, comidas, bebidas o indicaciones.</p>';
    $$('select', lis).forEach(s => s.onchange = () => { lista[+s.dataset.i][s.dataset.k] = s.value; alCambiar(); });
    $$('[data-q]', lis).forEach(b => b.onclick = () => { lista.splice(+b.dataset.q, 1); pintar(); alCambiar(); });
  };
  const anadir = (it) => {
    const item = { ...it, tags: [...it.tags], pauta: it.cat === 'med' ? '1 cada 8 horas' : it.cat === 'otro' ? '1 al día' : 'En cada comida', dur: it.cat === 'med' ? '5 días' : '7 días' };
    lista.push(item); q.value = ''; sug.innerHTML = ''; sug.classList.remove('on'); pintar(); alCambiar(); Sonido.hoja();
    if (reaccion && pac && hablandoN < 2) decir('paciente', reaccionReceta(pac, item));
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
  editorReceta($('#de-receta', m), plan.receta);
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
  const accionTxt = plan.accion === 'casa' ? `Puede irse a casa.${plan.receta.length ? ` Le receto ${plan.receta.slice(0, 3).map(r => r.n.toLowerCase()).join(', ')}${plan.receta.length > 3 ? ' y alguna cosa más' : ''}.` : ''}` : plan.accion === 'hospitalizar' ? 'Vamos a ingresarle en planta para tenerle vigilado.' : `Hay que operar: le vamos a hacer una ${CIRUGIAS[plan.cir].n.toLowerCase()}.`;
  const diagTxt = dElegido.simulador ? 'usted está perfectamente sano' : `lo que tiene es ${dElegido.n.toLowerCase().replace(/ \(.*\)/, '')}`;
  const textos = {
    empatia: `${sr[0].toUpperCase() + sr.slice(1)} ${ap}, sé que está preocupad${pac.sexo === 'm' ? 'a' : 'o'}. Le explico con calma: ${diagTxt}. ${accionTxt} Vamos a estar a su lado en todo momento.`,
    directo: `${sr[0].toUpperCase() + sr.slice(1)} ${ap}, ${diagTxt}. ${accionTxt}`,
    frio: `Diagnóstico: ${dElegido.n.toLowerCase()}. ${accionTxt} Siguiente.`,
    quitar: `Nada, nada, una tontería. ${accionTxt} No se preocupe por nada.`,
  };
  await decir('doctor', textos[tono]);
  const grav = dElegido.noticia;
  const reac = {
    grave: { empatia: '(se le humedecen los ojos) Gracias por decírmelo así, doctor. Haré lo que haga falta.', directo: 'Dios mío... ¿Y me voy a curar? Bueno... confío en usted.', frio: '¿Así me lo suelta? ¿Como quien da el parte del tiempo? Qué poca humanidad.', quitar: '¿Una tontería? Ah, bueno, menos mal...' },
    moderada: { empatia: 'Vale, doctor. Me quedo más tranquil{o} sabiendo que usted se ocupa.', directo: 'Bueno... vale. Si hay que hacerlo, se hace.', frio: 'Hmm. Vale. Qué simpático.', quitar: 'Ah, pues mejor. ¿Seguro que no es nada?' },
    leve: { empatia: 'Muchas gracias, doctor. Es usted un cielo.', directo: 'Perfecto, gracias, doctor.', frio: 'Vale.', quitar: '¡Menos mal! Ya pensaba que me moría.' },
  }[grav][tono];
  pac.satisfaccion = (pac.satisfaccion || 0) + ({ empatia: { grave: 2, moderada: 1, leve: 1 }, directo: { grave: 0, moderada: 1, leve: 1 }, frio: { grave: -3, moderada: -1, leve: 0 }, quitar: { grave: -4, moderada: -1, leve: 0 } }[tono][grav]);
  await decir('paciente', fmt(reac, pac));
  if (acompDentro && grav === 'grave') await decir('acomp', azar(['¡Ay, Dios mío! ¿Y ahora qué hacemos?', '(llorando) Tranquilo, que yo estoy aquí contigo.']).replace('Tranquilo', pac.sexo === 'm' ? 'Tranquila' : 'Tranquilo'));
  G.stats.atendidos++;
  if (plan.accion === 'casa') return despedirPaciente();
  if (plan.accion === 'hospitalizar') return ingresar(pac, plan, false);
  return prepararCirugia(pac, plan, 'consulta');
}
function resultadoCasa(p, plan) {
  const ev = evaluarTratamiento(p, plan);
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
  await decir('paciente', azar(['Muchas gracias, doctor. Hasta luego.', 'Gracias. A ver si me pongo bueno pronto.', 'Adiós, doctor.']).replace('bueno', pac.sexo === 'm' ? 'buena' : 'bueno'));
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
function ingresar(p, plan, operado, puntuacionCir = null) {
  const ev = evaluarTratamiento(p, plan);
  const grav = ENF[p.enfId].grav;
  const ing = { pac: p, plan, q: ev.q, salud: operado ? Math.max(15, Math.min(90, (puntuacionCir ?? 60) * 0.7 + 15)) : Math.max(20, 70 - grav * 9), dias: 0, operado, infeccion: plan.infeccion || false, diaIngreso: G.dia };
  G.ingresados.push(ing);
  guardar();
  if (!operado) {
    decir('paciente', azar(['Bueno... si hay que quedarse, me quedo.', '¿Y la comida del hospital es buena? Porque yo soy de buen comer.']));
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
    const quien = { nombre: `Familiar (${fam})`, genero: /mujer|hija|madre|hermana/.test(fam) ? 'm' : 'h' };
    await decir(quien, azar(['¡Doctor! ¿Se va a morir? ¡Dígame la verdad! ¡Quiero entrar con él al quirófano!', '¡No puede operarle! ¡Lo he leído en internet y es muy peligroso! ¡Exijo hablar con el director!']).replace('con él', p.sexo === 'm' ? 'con ella' : 'con él').replace('operarle', p.sexo === 'm' ? 'operarla' : 'operarle'));
    await new Promise(res => {
      const m = abrirModal(`<h3>La familia está en pánico</h3>${[['calmar', 'Calmarle y explicarle el procedimiento'], ['seguridad', 'Pedir a seguridad que le acompañe a la sala de espera'], ['gritar', '¡Silencio! ¡Aquí mando yo!'], ['entrar', 'Dejarle entrar al quirófano']].map(([id, t]) => `<button class="pregunta" data-f="${id}">${t}</button>`).join('')}`, { clase: 'pequeno', cerrable: false });
      $$('[data-f]', m).forEach(b => b.onclick = async () => {
        m.cerrar(); const f = b.dataset.f;
        if (f === 'calmar') { await decir('doctor', 'Entiendo que tenga miedo. Es una operación que hacemos a menudo, el equipo es muy bueno y le informaré en cuanto terminemos.'); await decir(quien, 'Vale... vale. Gracias, doctor. Cuídemelo, por favor.'); reputacion(1); }
        if (f === 'seguridad') { await decir('doctor', 'Seguridad, por favor, acompañen al familiar a la sala de espera.'); await decir(quien, '¡Esto es una vergüenza!'); }
        if (f === 'gritar') { await decir('doctor', '¡Silencio! ¡Aquí mando yo!'); await decir(quien, '¡Pues vaya modales! ¡Le voy a poner una reclamación!'); reputacion(-2); }
        if (f === 'entrar') { await decir(quien, '¡Gracias, doctor! Me pongo aquí en una esquina...'); plan.familiarDentro = true; reputacion(-1); }
        res();
      });
    });
  }
  modo = 'preqx'; document.body.dataset.modo = 'preqx';
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
  if (modo === 'cirugia' && cir) { canvas.setPointerCapture(ev.pointerId); const p = posCampo(ev); if (p) cir.abajo(p); }
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
      $('#mu-ok', m).onclick = async () => { m.cerrar(); await decir('doctor', 'Lo siento muchísimo. Hemos hecho todo lo posible, pero no ha podido superar la operación.'); await decir({ nombre: 'Familiar', genero: 'm', tono: 1.1 }, '(llorando) No... no puede ser...'); salirQuirofano(origen); };
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
      await decir('doctor', 'La operación ha ido bien. Ahora tiene que descansar; podrán verle en la planta.');
      await decir({ nombre: 'Familiar', genero: 'm', tono: 1.08 }, '¡Gracias, doctor! ¡Muchísimas gracias!');
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
  if (origen === 'ronda') { await fundido(() => mundo.mostrar('sala')); return siguienteIngresado(); }
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
    hCama = mundo.registrar(crearHumano(pac.apariencia, 'paciente'));
    hCama.dormido = ing.salud < 25;
    hCama.agitado = ing.salud < 40;
    mundo.ponerPacienteCama(hCama);
    const s = ing.salud; mundo.vitalesSala = { fc: 68 + (100 - s) * 0.45, tas: 125 - (100 - s) * 0.4, tad: 78 - (100 - s) * 0.2, sat: 99 - (100 - s) * 0.09 };
  });
  panelSala();
  decir('doctor', `Buenos días, ${pac.sexo === 'm' ? 'señora' : 'señor'} ${pac.apellidos.split(' ')[0]}. ¿Cómo ha pasado la noche?`);
  const s = ing.salud;
  await decir('paciente', s < 25 ? 'Muy mal, doctor... cada vez peor... no puedo ni respirar...' : s < 50 ? azar(['Regular, doctor. Me sigue doliendo.', 'Más o menos. Esta noche no he pegado ojo.']) : s < 75 ? azar(['Algo mejor, la verdad.', 'Voy tirando, doctor.']) : azar(['¡Mucho mejor! ¿Cuándo me voy a casa?', 'Estupendamente. Ya estoy harto de la comida de aquí.']));
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
  if (a === 'hablar') {
    await decir('doctor', '¿Cómo se encuentra hoy? ¿Le duele algo?');
    const s = ing.salud;
    let r = s < 30 ? 'Fatal, doctor. Peor que ayer. ¿Seguro que me están dando lo correcto?' : s < 60 ? azar(['Me sigue doliendo, pero menos.', 'Bueno, ahí vamos.']) : '¡Bien, bien! Ya casi no me duele nada.';
    if (ing.infeccion && ing.operado) r += ' Y la herida me pica y está muy roja...';
    await decir('paciente', r);
    if (prob(0.3)) await decir('paciente', azar(['Oiga, ¿y no será que se han equivocado con lo mío?', 'Mi cuñado dice que en el hospital de Ponferrada me habrían curado ya.', 'La enfermera de noche dice que usted es nuevo...']));
  }
  if (a === 'comida') { await decir('doctor', '¿Qué tal la comida del hospital?'); await decir('paciente', azar(['¿Esto es comida? Un caldo sin sal y un yogur. ¿No me podría recetar un cocido leonés, doctor?', 'Horrible. Si me receta unos callos, le hago un monumento.', 'Mire, si me deja tomar un orujito para la digestión, me curo antes.'])); }
  if (a === 'constantes') {
    const v = mundo.vitalesSala;
    abrirModal(`<h2>Gráfica de planta</h2><div class="constantes"><div><small>Salud</small><b>${Math.round(ing.salud)}%</b></div><div><small>Pulso</small><b>${v.fc | 0}</b></div><div><small>Tensión</small><b>${v.tas | 0}/${v.tad | 0}</b></div><div><small>Saturación</small><b>${v.sat | 0}%</b></div></div>
      <p>${ing.salud >= 75 ? 'Evoluciona muy bien. Puede irse de alta.' : ing.salud >= 45 ? 'Evolución lenta pero estable.' : 'Está empeorando. Revisa el diagnóstico y el tratamiento.'}${ing.infeccion ? ' La herida tiene signos de infección: añade un antibiótico.' : ''}</p>`, { clase: 'pequeno' });
  }
  if (a === 'ficha') verFicha(ing.pac);
  if (a === 'receta') {
    const m = abrirModal(`<h2>Tratamiento de ${esc(ing.pac.nombre)}</h2><div id="sa-re"></div><div class="botones"><button class="btn grande" id="sa-ok">Guardar</button></div>`, { clase: 'papel' });
    editorReceta($('#sa-re', m), ing.plan.receta, { alCambiar: () => {} });
    $('#sa-ok', m).onclick = () => {
      const ev = evaluarTratamiento(ing.pac, ing.plan);
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
    await decir('doctor', 'Le voy a dar el alta. Puede irse a casa.');
    const e = ENF[ing.pac.enfId];
    let res;
    if (ing.salud >= 75) res = 'curado'; else if (ing.salud >= 50) res = 'mejora'; else res = e.grav >= 4 ? (prob(0.4) ? 'muerte' : 'urgencias') : 'empeora';
    if (e.trat.accion === 'cirugia' && !ing.operado && e.grav >= 3) res = prob(0.5) ? 'urgencias' : 'muerte';
    await decir('paciente', ing.salud >= 75 ? '¡Por fin! Muchas gracias por todo, doctor.' : '¿Ya? Pero si todavía me encuentro mal...');
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
  crearMundo();
  pantallaInicio();
  $('#cargando').remove();
} catch (err) {
  console.error(err);
  $('#cargando').innerHTML = `<p>No se ha podido iniciar el 3D en este dispositivo.</p><small>${esc(err.message)}</small>`;
}
window.__juego = { get G() { return G; }, get mundo() { return mundo; }, get pac() { return pac; }, get cir() { return cir; } };
