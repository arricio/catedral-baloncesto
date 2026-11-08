// Controlador principal de FORJA 3D.
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clone as clonarConHuesos } from 'three/addons/utils/SkeletonUtils.js';
import { Visor } from './visor.js';
import {
  MOTORES, imagenA3D, textoAImagen, multivistaA3D, bocetoA3D, texturizar, rigConIA, clasificarError,
} from './motores.js';
import { FORMATOS, descargarBlob, nombreArchivo, exportarGLB, exportarFormato } from './exportar.js';
import { guardarModelo, listarModelos, obtenerModelo, borrarModelo } from './biblioteca.js';
import { estimarArticulaciones, crearRig, inferirRoles, tieneEsqueleto } from './rig.js';
import { crearAnimaciones, emojiDe } from './animaciones.js';
import { ESTILOS, aplicarEstilo, reducir } from './estilos.js';
import { segmentar, partesDe } from './partes.js';
import { analizarImpresion, mallasDe } from './geometria.js';
import { Pincel } from './pincel.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = new Intl.NumberFormat('es-ES');

const estado = {
  modo: 'imagen',
  calidad: 'rapida',
  imagen: null,
  nombreImagen: 'imagen',
  vistas: {},
  opcionesTexto: [],
  elegida: -1,
  glb: null,            // GLB original sin modificar (si lo hay)
  info: null,           // { nombre, motor, origen, prompt }
  guardadoId: null,
  abortar: null,
  historial: [],
  rehacer: [],
  base: null,           // copia del modelo tal y como se creó (para «Original»)
  plan: null,           // plan de articulaciones en edición
};

// ---------------------------------------------------------------------------
// Utilidades de interfaz
// ---------------------------------------------------------------------------
let temporizadorTostada;
function tostada(texto, ms = 3200) {
  const t = $('#tostada');
  t.textContent = texto;
  t.classList.add('visible');
  clearTimeout(temporizadorTostada);
  temporizadorTostada = setTimeout(() => t.classList.remove('visible'), ms);
}

function aviso(texto, tipo = 'error') {
  const a = $('#aviso');
  if (!texto) { a.hidden = true; return; }
  a.className = `aviso ${tipo === 'info' ? 'info' : ''}`;
  a.innerHTML = '';
  const lineas = String(texto).split('\n').filter(Boolean);
  const p = document.createElement('strong');
  p.textContent = lineas[0];
  a.append(p);
  if (lineas.length > 1) {
    const ul = document.createElement('ul');
    ul.style.margin = '6px 0 0'; ul.style.paddingLeft = '18px';
    for (const l of lineas.slice(1)) { const li = document.createElement('li'); li.textContent = l; ul.append(li); }
    a.append(ul);
  }
  a.hidden = false;
}

const leerLocal = (k, def = '') => { try { return localStorage.getItem(k) ?? def; } catch { return def; } };
const escribirLocal = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* sin almacenamiento */ } };
const esperarPintado = () => new Promise((ok) => requestAnimationFrame(() => setTimeout(ok, 0)));

function progreso({ etapa, porcentaje, detalle }) {
  $('#progreso').hidden = false;
  if (etapa) $('#progreso-etapa').textContent = etapa;
  if (porcentaje != null) {
    const p = Math.max(0, Math.min(100, porcentaje));
    $('#progreso-porcentaje').textContent = `${Math.round(p)} %`;
    $('#progreso-relleno').style.width = `${p}%`;
  }
  if (detalle != null) $('#progreso-detalle').textContent = detalle;
}

function contextoIA() {
  const control = new AbortController();
  estado.abortar = control;
  return { signal: control.signal, token: leerLocal('forja3d.token') || undefined, progreso };
}

/** Ejecuta una tarea larga mostrando progreso y errores de forma uniforme. */
async function tarea(titulo, fn, { ia = false } = {}) {
  if (estado.abortar) { tostada('Espera a que termine la tarea en curso'); return; }
  aviso('');
  bloquear(true);
  progreso({ etapa: titulo, porcentaje: 0, detalle: '' });
  const ctx = ia ? contextoIA() : (estado.abortar = new AbortController(), { signal: estado.abortar.signal, progreso });
  // Las operaciones leen los materiales reales, no los de la vista (arcilla, malla…).
  visor?.restaurarMateriales();
  try {
    await esperarPintado();
    const r = await fn(ctx);
    return r;
  } catch (e) {
    const err = clasificarError(e);
    if (err.tipo === 'cancelado') {
      progreso({ etapa: 'Cancelado', detalle: '' });
    } else {
      console.error(e);
      $('#progreso').hidden = true;
      const extra = ia ? '\nConsejo: añade tu token de Hugging Face en Ajustes o inténtalo con otro motor.' : '';
      aviso(`${titulo}: no se ha podido completar.\n${err.message}${extra}`);
    }
    return undefined;
  } finally {
    estado.abortar = null;
    visor?.aplicarModo(visor.modoVista);
    bloquear(false);
  }
}

function bloquear(si) {
  $('#btn-cancelar').hidden = !si;
  $$('.panel-crear input, .panel-crear select, .panel-crear textarea, .segmentado button, .panel-herramientas .herr button, #btn-abrir').forEach((x) => { x.disabled = si; });
  actualizarBotonGenerar();
}

// ---------------------------------------------------------------------------
// Visor e historial
// ---------------------------------------------------------------------------
let visor;
try {
  visor = new Visor($('#lienzo'));
} catch (e) {
  console.error(e);
  $('#vacio p').textContent = 'Tu navegador no permite WebGL, así que no se puede mostrar el visor 3D.';
}
const pincel = visor ? new Pincel(visor) : null;

function mostrarInfo() {
  const s = visor?.estadisticas();
  const caja = $('#info-modelo');
  if (!s) { caja.hidden = true; return; }
  const alto = Number($('#altura-mm').value) || 80;
  const k = alto / (s.proporcion.y || 1);
  $('#info-triangulos').textContent = `${fmt.format(s.triangulos)} triángulos`;
  $('#info-medidas').textContent = `${Math.round(s.proporcion.x * k)} × ${Math.round(s.proporcion.z * k)} × ${Math.round(alto)} mm`;
  $('#info-huesos').hidden = !s.huesos;
  $('#info-huesos').textContent = `${s.huesos} huesos`;
  $('#info-motor').textContent = estado.info?.motor ?? '';
  $('#info-motor').hidden = !estado.info?.motor;
  caja.hidden = false;
}

function hayModelo() { return !!visor?.objeto; }

function refrescarUI() {
  const si = hayModelo();
  $('#vacio').hidden = si;
  $('.panel-herramientas').classList.toggle('vacio-modelo', !si);
  $('#sin-modelo').hidden = si;
  $('#btn-guardar').disabled = !si || !!estado.guardadoId;
  $('#btn-guardar').textContent = estado.guardadoId ? '✓ Guardado en la biblioteca' : '💾 Guardar en la biblioteca';
  $('#btn-deshacer').disabled = !estado.historial.length;
  $('#btn-rehacer').disabled = !estado.rehacer.length;
  if (visor?.modoVista === 'partes' && !partesDe(visor.objeto)) marcarVista('textura');
  pintarAnimaciones();
  pintarPartes();
  mostrarInfo();
}

/** Copia independiente (geometría y materiales propios) para el historial. */
function copiaProfunda(objeto) {
  const c = clonarConHuesos(objeto);
  c.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry = o.geometry.clone();
    o.material = Array.isArray(o.material) ? o.material.map((m) => m.clone()) : o.material.clone();
  });
  return c;
}

/** Sustituye el modelo actual guardando el anterior en el historial. */
function aplicarCambio(objeto, { clips = [], glb = null, info, encuadrar = false, historial = true } = {}) {
  pincel?.activar(false);
  $('#btn-pincel').textContent = '🖌️ Activar pincel';
  salirEdicionRig();
  if (historial && visor.objeto) {
    estado.historial.push({ objeto: visor.objeto, clips: visor.clips, glb: estado.glb, info: estado.info, guardadoId: estado.guardadoId });
    if (estado.historial.length > 12) estado.historial.shift();
    estado.rehacer = [];
  }
  estado.glb = glb;
  if (info) estado.info = info;
  estado.guardadoId = null;
  visor.establecer(objeto, { clips, encuadrar: encuadrar || !visor.modelo });
  refrescarUI();
}

function restaurar(entrada, pilaDestino) {
  pilaDestino.push({ objeto: visor.objeto, clips: visor.clips, glb: estado.glb, info: estado.info, guardadoId: estado.guardadoId });
  estado.glb = entrada.glb;
  estado.info = entrada.info;
  estado.guardadoId = entrada.guardadoId;
  salirEdicionRig();
  visor.establecer(entrada.objeto, { clips: entrada.clips, encuadrar: false });
  refrescarUI();
}
function deshacer() { if (estado.historial.length && !estado.abortar) restaurar(estado.historial.pop(), estado.rehacer); }
function rehacer() { if (estado.rehacer.length && !estado.abortar) restaurar(estado.rehacer.pop(), estado.historial); }
$('#btn-deshacer').addEventListener('click', deshacer);
$('#btn-rehacer').addEventListener('click', rehacer);
window.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? rehacer() : deshacer(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); rehacer(); }
});

/** Carga un GLB (generado, de la biblioteca o abierto) como modelo nuevo. */
async function cargarModelo(glb, info, { guardadoId = null } = {}) {
  const { objeto, clips } = await visor.leerGLB(glb);
  aplicarCambio(objeto, { clips, glb, info, encuadrar: true });
  estado.guardadoId = guardadoId;
  estado.base = { objeto: copiaProfunda(objeto), clips };
  if (info?.nombre) $('#nombre-modelo').value = info.nombre;
  // Modelos que ya traen esqueleto (AniGen, archivos riggeados): animaciones listas.
  if (tieneEsqueleto(objeto) && !clips.length) {
    inferirRoles(objeto);
    visor.clips = crearAnimaciones(objeto);
    tostada('El modelo trae esqueleto: ya puedes animarlo en «Animar»');
    abrirHerramienta('animar');
  }
  refrescarUI();
}

// ---------------------------------------------------------------------------
// Creación: modos
// ---------------------------------------------------------------------------
function actualizarBotonGenerar() {
  let listo = false, texto = 'Generar modelo 3D';
  if (estado.modo === 'imagen') listo = !!estado.imagen;
  else if (estado.modo === 'texto') {
    listo = $('#entrada-texto').value.trim().length >= 3;
    if ($('#cuatro-opciones').checked) texto = estado.opcionesTexto.length ? (estado.elegida >= 0 ? 'Crear 3D con la imagen elegida' : 'Elige una imagen') : 'Proponer 4 imágenes';
    if ($('#cuatro-opciones').checked && estado.opcionesTexto.length && estado.elegida < 0) listo = false;
  } else if (estado.modo === 'multivista') listo = !!estado.vistas.frente;
  else if (estado.modo === 'boceto') listo = bocetoTieneTrazos();
  $('#btn-generar').disabled = !listo || !!estado.abortar;
  $('#btn-generar span').textContent = estado.abortar ? 'Trabajando…' : texto;
}

$$('[data-modo]').forEach((b) => b.addEventListener('click', () => {
  estado.modo = b.dataset.modo;
  $$('[data-modo]').forEach((x) => x.classList.toggle('activo', x === b));
  for (const m of ['imagen', 'texto', 'multivista', 'boceto']) $(`#modo-${m}`).hidden = estado.modo !== m;
  $('#grupo-motor').hidden = estado.modo === 'multivista' || estado.modo === 'boceto';
  aviso('');
  actualizarBotonGenerar();
}));

$$('[data-calidad]').forEach((b) => b.addEventListener('click', () => {
  estado.calidad = b.dataset.calidad;
  $$('[data-calidad]').forEach((x) => x.classList.toggle('activo', x === b));
}));

async function normalizarImagen(archivo) {
  const bmp = await createImageBitmap(archivo);
  const max = 1536;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (k === 1 && archivo.type === 'image/png') { bmp.close?.(); return archivo; }
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return new Promise((ok) => c.toBlob(ok, 'image/png'));
}

async function ponerImagen(archivo) {
  if (!archivo || !archivo.type.startsWith('image/')) { tostada('Ese archivo no es una imagen'); return; }
  try { estado.imagen = await normalizarImagen(archivo); } catch { tostada('No se ha podido leer la imagen'); return; }
  estado.nombreImagen = (archivo.name || 'imagen').replace(/\.[^.]+$/, '');
  $('#vista-previa').src = URL.createObjectURL(estado.imagen);
  $('#vista-previa').hidden = false;
  $('#texto-subida').hidden = true;
  $('#btn-quitar-imagen').hidden = false;
  aviso('');
  actualizarBotonGenerar();
}

$('#entrada-imagen').addEventListener('change', (e) => ponerImagen(e.target.files[0]));
$('#btn-quitar-imagen').addEventListener('click', () => {
  estado.imagen = null;
  $('#vista-previa').hidden = true;
  $('#texto-subida').hidden = false;
  $('#btn-quitar-imagen').hidden = true;
  $('#entrada-imagen').value = '';
  actualizarBotonGenerar();
});
const zona = $('#zona-subida');
zona.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#entrada-imagen').click(); } });
['dragenter', 'dragover'].forEach((t) => zona.addEventListener(t, (e) => { e.preventDefault(); zona.classList.add('encima'); }));
['dragleave', 'drop'].forEach((t) => zona.addEventListener(t, (e) => { e.preventDefault(); zona.classList.remove('encima'); }));
zona.addEventListener('drop', (e) => ponerImagen(e.dataTransfer.files[0]));
window.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
  if (!f) return;
  $('[data-modo="imagen"]').click();
  ponerImagen(f);
});

// Texto
const SUGERENCIAS = ['un robot pequeño y simpático', 'un cofre del tesoro de madera', 'un caballero con armadura', 'un zorro de dibujos animados', 'una zapatilla deportiva roja', 'un balón de baloncesto con alas'];
for (const s of SUGERENCIAS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = s;
  b.addEventListener('click', () => { $('#entrada-texto').value = s; limpiarOpcionesTexto(); });
  $('#sugerencias').append(b);
}
function limpiarOpcionesTexto() {
  estado.opcionesTexto = [];
  estado.elegida = -1;
  $('#opciones-imagen').hidden = true;
  $('#opciones-imagen').innerHTML = '';
  actualizarBotonGenerar();
}
$('#entrada-texto').addEventListener('input', limpiarOpcionesTexto);
$('#estilo').addEventListener('change', limpiarOpcionesTexto);
$('#cuatro-opciones').addEventListener('change', limpiarOpcionesTexto);

function pintarOpcionesTexto() {
  const cont = $('#opciones-imagen');
  cont.innerHTML = '';
  estado.opcionesTexto.forEach((blob, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = i === estado.elegida ? 'elegida' : '';
    b.title = `Opción ${i + 1}`;
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    img.alt = `Opción ${i + 1}`;
    b.append(img);
    b.addEventListener('click', () => { estado.elegida = i; pintarOpcionesTexto(); actualizarBotonGenerar(); });
    cont.append(b);
  });
  cont.hidden = !estado.opcionesTexto.length;
}

// Multivista
$$('[data-vista-mv]').forEach((celda) => {
  const entrada = celda.querySelector('input');
  const poner = async (f) => {
    if (!f?.type.startsWith('image/')) return;
    const blob = await normalizarImagen(f);
    estado.vistas[celda.dataset.vistaMv] = blob;
    const img = celda.querySelector('img');
    img.src = URL.createObjectURL(blob);
    img.hidden = false;
    celda.classList.add('lleno');
    actualizarBotonGenerar();
  };
  entrada.addEventListener('change', () => poner(entrada.files[0]));
  celda.addEventListener('dragover', (e) => e.preventDefault());
  celda.addEventListener('drop', (e) => { e.preventDefault(); poner(e.dataTransfer.files[0]); });
});

// Boceto
const boceto = $('#boceto');
const ctxB = boceto.getContext('2d');
const trazos = [];
let trazoActual = null, herramientaBoceto = 'lapiz';
function redibujarBoceto() {
  ctxB.fillStyle = '#fff';
  ctxB.fillRect(0, 0, boceto.width, boceto.height);
  ctxB.lineCap = 'round';
  ctxB.lineJoin = 'round';
  for (const t of trazos) {
    ctxB.strokeStyle = t.goma ? '#fff' : '#000';
    ctxB.lineWidth = t.grosor;
    ctxB.beginPath();
    t.puntos.forEach(([x, y], i) => (i ? ctxB.lineTo(x, y) : ctxB.moveTo(x, y)));
    if (t.puntos.length === 1) ctxB.lineTo(t.puntos[0][0] + 0.1, t.puntos[0][1]);
    ctxB.stroke();
  }
}
function bocetoTieneTrazos() { return trazos.some((t) => !t.goma); }
const puntoBoceto = (e) => {
  const r = boceto.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * boceto.width, ((e.clientY - r.top) / r.height) * boceto.height];
};
boceto.addEventListener('pointerdown', (e) => {
  boceto.setPointerCapture(e.pointerId);
  trazoActual = { goma: herramientaBoceto === 'goma', grosor: Number($('#boceto-grosor').value) * (herramientaBoceto === 'goma' ? 3 : 1), puntos: [puntoBoceto(e)] };
  trazos.push(trazoActual);
  redibujarBoceto();
});
boceto.addEventListener('pointermove', (e) => { if (trazoActual) { trazoActual.puntos.push(puntoBoceto(e)); redibujarBoceto(); } });
const finTrazo = () => { trazoActual = null; actualizarBotonGenerar(); };
boceto.addEventListener('pointerup', finTrazo);
boceto.addEventListener('pointercancel', finTrazo);
$('#boceto-lapiz').addEventListener('click', () => { herramientaBoceto = 'lapiz'; $('#boceto-lapiz').classList.add('activo'); $('#boceto-goma').classList.remove('activo'); });
$('#boceto-goma').addEventListener('click', () => { herramientaBoceto = 'goma'; $('#boceto-goma').classList.add('activo'); $('#boceto-lapiz').classList.remove('activo'); });
$('#boceto-deshacer').addEventListener('click', () => { trazos.pop(); redibujarBoceto(); actualizarBotonGenerar(); });
$('#boceto-borrar').addEventListener('click', () => { trazos.length = 0; redibujarBoceto(); actualizarBotonGenerar(); });
$('#boceto-fidelidad').addEventListener('input', (e) => { $('#boceto-fidelidad-valor').textContent = Number(e.target.value).toLocaleString('es-ES'); });
redibujarBoceto();

// Motores
for (const m of MOTORES) {
  const o = document.createElement('option');
  o.value = m.id; o.textContent = m.nombre;
  $('#motor').append(o);
}
$('#motor').value = leerLocal('forja3d.motor', 'auto');
if (!$('#motor').value) $('#motor').value = 'auto';
const actualizarAyudaMotor = () => { $('#ayuda-motor').textContent = MOTORES.find((m) => m.id === $('#motor').value)?.ayuda ?? ''; };
$('#motor').addEventListener('change', () => { escribirLocal('forja3d.motor', $('#motor').value); actualizarAyudaMotor(); });
actualizarAyudaMotor();

// ---------------------------------------------------------------------------
// Generación
// ---------------------------------------------------------------------------
function opcionesGeneracion() {
  const s = $('#semilla').value.trim();
  return { calidad: estado.calidad, semilla: s ? Math.abs(parseInt(s, 10)) : undefined };
}

async function generar() {
  const op = opcionesGeneracion();
  const motor = $('#motor').value;
  const inicio = performance.now();
  const resultado = await tarea('Generación', async (ctx) => {
    let r, info;
    if (estado.modo === 'imagen') {
      r = await imagenA3D(ctx, estado.imagen, motor, op);
      info = { nombre: nombreArchivo(estado.nombreImagen), origen: 'imagen' };
    } else if (estado.modo === 'texto') {
      const texto = $('#entrada-texto').value.trim();
      const estilo = $('#estilo').value;
      let imagen;
      if ($('#cuatro-opciones').checked) {
        if (!estado.opcionesTexto.length) {
          const base = op.semilla ?? Math.floor(Math.random() * 1e9);
          for (let i = 0; i < 4; i++) {
            const img = await textoAImagen(ctx, texto, estilo, base + i * 7919, [i * 25, (i + 1) * 25]);
            estado.opcionesTexto.push(img);
            pintarOpcionesTexto();
          }
          progreso({ etapa: 'Elige la imagen que más te guste', porcentaje: 100, detalle: 'Luego pulsa «Crear 3D con la imagen elegida».' });
          return null;
        }
        imagen = estado.opcionesTexto[estado.elegida];
      } else {
        imagen = await textoAImagen(ctx, texto, estilo, op.semilla);
      }
      $('#vista-previa-texto').src = URL.createObjectURL(imagen);
      $('#vista-previa-texto').hidden = false;
      r = await imagenA3D(ctx, imagen, motor, op);
      info = { nombre: nombreArchivo(texto), origen: 'texto', prompt: texto };
    } else if (estado.modo === 'multivista') {
      r = await multivistaA3D(ctx, estado.vistas, op);
      info = { nombre: 'multivista', origen: 'multivista' };
    } else {
      const dibujo = await new Promise((ok) => boceto.toBlob(ok, 'image/png'));
      const texto = $('#boceto-texto').value.trim();
      r = await bocetoA3D(ctx, dibujo, texto, { ...op, texturizar: $('#boceto-color').checked, fidelidad: Number($('#boceto-fidelidad').value) });
      info = { nombre: nombreArchivo(texto || 'boceto'), origen: 'boceto', prompt: texto };
    }
    info.motor = r.motor;
    progreso({ etapa: 'Cargando el modelo', porcentaje: 99 });
    await cargarModelo(r.glb, info);
    return r;
  }, { ia: true });
  if (resultado) {
    const s = Math.round((performance.now() - inicio) / 1000);
    progreso({ etapa: '¡Modelo listo!', porcentaje: 100, detalle: `${resultado.motor} · ${s} s` });
    await guardarActual(true);
  }
  actualizarBotonGenerar();
}
$('#btn-generar').addEventListener('click', generar);
$('#btn-cancelar').addEventListener('click', () => estado.abortar?.abort());
$('#entrada-texto').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !$('#btn-generar').disabled) generar(); });

// ---------------------------------------------------------------------------
// Herramientas del visor
// ---------------------------------------------------------------------------
$$('[data-vista3d]').forEach((b) => b.addEventListener('click', () => {
  $$('[data-vista3d]').forEach((x) => x.classList.toggle('activo', x === b));
  visor?.aplicarModo(b.dataset.vista3d);
}));
function marcarVista(modo) {
  $$('[data-vista3d]').forEach((x) => x.classList.toggle('activo', x.dataset.vista3d === modo));
  visor?.aplicarModo(modo);
}
$('#btn-rotar').addEventListener('click', (e) => { const on = e.currentTarget.classList.toggle('activo'); if (visor) visor.autoRotar = on; });
$('#btn-suelo').addEventListener('click', (e) => { const on = e.currentTarget.classList.toggle('activo'); if (visor) visor.verSuelo = on; });
$('#btn-centrar').addEventListener('click', () => visor?.encuadrar());
$('#btn-captura').addEventListener('click', async () => {
  if (!hayModelo()) { tostada('Primero genera o abre un modelo'); return; }
  descargarBlob(await visor.captura(), `${nombreArchivo($('#nombre-modelo').value)}.png`);
});
$('#altura-mm').addEventListener('input', mostrarInfo);

// Pestañas de herramientas
function abrirHerramienta(id) {
  $$('[data-herr]').forEach((b) => b.classList.toggle('activo', b.dataset.herr === id));
  $$('.herr').forEach((p) => { p.hidden = p.dataset.panel !== id; });
  if (id !== 'textura' && pincel?.activo) { pincel.activar(false); $('#btn-pincel').textContent = '🖌️ Activar pincel'; }
  if (id !== 'animar') salirEdicionRig();
}
$$('[data-herr]').forEach((b) => b.addEventListener('click', () => abrirHerramienta(b.dataset.herr)));

// ---------------------------------------------------------------------------
// Animar
// ---------------------------------------------------------------------------
function pintarAnimaciones() {
  const clips = visor?.clips ?? [];
  const lista = $('#lista-animaciones');
  lista.innerHTML = '';
  $('#zona-animaciones').hidden = !clips.length;
  $('#barra-anim').hidden = !clips.length || !visor.clipActual;
  for (const clip of clips) {
    const b = document.createElement('button');
    b.innerHTML = `<span class="emoji">${emojiDe(clip.name)}</span>`;
    b.append(clip.name);
    b.classList.toggle('activo', visor.clipActual === clip);
    b.addEventListener('click', () => {
      visor.reproducir(clip);
      $('#anim-nombre').textContent = clip.name;
      $('#btn-pausa').textContent = '⏸';
      pintarAnimaciones();
    });
    lista.append(b);
  }
  $('#btn-crear-rig').textContent = tieneEsqueleto(visor?.objeto) ? '🦴 Rehacer esqueleto' : '🦴 Crear esqueleto';
}

function sugerirTipo() {
  if (!visor?.objeto) return 'humanoide';
  const s = visor.estadisticas();
  return s.proporcion.z > s.proporcion.y * 1.05 ? 'cuadrupedo' : 'humanoide';
}

$('#btn-crear-rig').addEventListener('click', () => {
  if (!hayModelo()) return;
  visor.detenerAnimacion();
  const tipo = $('#tipo-rig').value;
  estado.plan = estimarArticulaciones(visor.objeto, tipo);
  visor.mostrarMarcadores(estado.plan, { simetria: $('#simetria').checked });
  visor.autoRotar = false;
  $('#btn-rotar').classList.remove('activo');
  $('#barra-edicion').hidden = false;
  $('#barra-anim').hidden = true;
  marcarVista('arcilla');
  tostada('Revisa las articulaciones y pulsa «Aplicar y animar»');
});
$('#simetria').addEventListener('change', (e) => { if (visor) visor.simetria = e.target.checked; });

function salirEdicionRig() {
  if (!estado.plan) return;
  estado.plan = null;
  visor?.quitarMarcadores();
  $('#barra-edicion').hidden = true;
  if (visor?.modoVista === 'arcilla') marcarVista('textura');
}
$('#btn-cancelar-rig').addEventListener('click', salirEdicionRig);

$('#btn-aplicar-rig').addEventListener('click', async () => {
  const plan = estado.plan;
  if (!plan) return;
  await tarea('Creando el esqueleto', async (ctx) => {
    ctx.progreso({ etapa: 'Calculando los pesos de la piel', porcentaje: 30 });
    await esperarPintado();
    const personaje = crearRig(visor.objeto, plan);
    salirEdicionRig();
    aplicarCambio(personaje, { info: estado.info });
    ctx.progreso({ etapa: 'Creando animaciones', porcentaje: 80 });
    await esperarPintado();
    visor.clips = crearAnimaciones(visor.objeto);
    visor.mezclador = visor.mezclador ?? new THREE.AnimationMixer(visor.objeto);
    marcarVista('textura');
    visor.reproducir(visor.clips[1] ?? visor.clips[0]);
    $('#anim-nombre').textContent = visor.clipActual?.name ?? '';
    refrescarUI();
    ctx.progreso({ etapa: 'Esqueleto y animaciones listos', porcentaje: 100 });
  });
});

$('#btn-rig-ia').addEventListener('click', async () => {
  if (!hayModelo()) return;
  salirEdicionRig();
  await tarea('Esqueleto con IA', async (ctx) => {
    visor.detenerAnimacion();
    const glb = await exportarGLB(visor.objeto);
    const resultado = await rigConIA(ctx, glb);
    const { objeto } = await visor.leerGLB(resultado);
    if (!tieneEsqueleto(objeto)) throw new Error('La IA no devolvió ningún esqueleto');
    aplicarCambio(objeto, { info: { ...estado.info, motor: 'SkinTokens · Tripo' } });
    inferirRoles(visor.objeto);
    visor.clips = crearAnimaciones(visor.objeto);
    visor.mezclador = visor.mezclador ?? new THREE.AnimationMixer(visor.objeto);
    visor.reproducir(visor.clips[1] ?? visor.clips[0]);
    $('#anim-nombre').textContent = visor.clipActual?.name ?? '';
    refrescarUI();
    ctx.progreso({ etapa: 'Esqueleto de IA listo', porcentaje: 100 });
  }, { ia: true });
});

$('#ver-esqueleto').addEventListener('change', (e) => visor?.verEsqueleto(e.target.checked));
$('#btn-pausa').addEventListener('click', () => {
  if (!visor?.accion) return;
  visor.pausa = !visor.pausa;
  $('#btn-pausa').textContent = visor.pausa ? '▶' : '⏸';
});
$('#anim-velocidad').addEventListener('change', (e) => { if (visor) visor.velocidad = Number(e.target.value); });
$('#btn-quitar-rig').addEventListener('click', () => {
  if (!tieneEsqueleto(visor?.objeto)) return;
  visor.detenerAnimacion();
  const estatico = new THREE.Group();
  for (const m of mallasDe(visor.objeto)) {
    m.updateWorldMatrix(true, false);
    const g = m.geometry.clone();
    for (const n of ['skinIndex', 'skinWeight']) if (g.attributes[n]) g.deleteAttribute(n);
    g.applyMatrix4(m.matrixWorld);
    estatico.add(new THREE.Mesh(g, m.material));
  }
  aplicarCambio(estatico, { info: estado.info });
  tostada('Esqueleto quitado');
});

$('#btn-glb-animado').addEventListener('click', async () => {
  if (!hayModelo()) return;
  await tarea('Exportar GLB animado', async (ctx) => {
    const glb = await exportarGLB(visor.objeto, visor.clips);
    descargarBlob(glb, `${nombreArchivo($('#nombre-modelo').value)}-animado.glb`);
    ctx.progreso({ etapa: 'GLB animado descargado', porcentaje: 100, detalle: `${visor.clips.length} animaciones` });
  });
});

async function grabarVideo(segundos, sufijo, girar360) {
  if (!hayModelo()) return;
  await tarea('Grabando vídeo', async (ctx) => {
    const antes = { auto: visor.autoRotar, vel: visor.controles.autoRotateSpeed, suelo: visor.suelo.visible };
    if (girar360) { visor.autoRotar = true; visor.controles.autoRotateSpeed = 60 / segundos; }
    const { blob, extension } = await visor.grabar(segundos, (p) => ctx.progreso({ etapa: 'Grabando vídeo', porcentaje: p * 100 }));
    visor.autoRotar = antes.auto;
    visor.controles.autoRotateSpeed = antes.vel;
    descargarBlob(blob, `${nombreArchivo($('#nombre-modelo').value)}-${sufijo}.${extension}`);
    ctx.progreso({ etapa: 'Vídeo descargado', porcentaje: 100 });
  });
}
$('#btn-video-anim').addEventListener('click', () => {
  const d = visor?.clipActual?.duration ?? 2;
  grabarVideo(Math.min(12, Math.max(4, d * 3)), visor?.clipActual?.name ?? 'animacion', false);
});
$('#btn-video').addEventListener('click', () => grabarVideo(8, '360', true));

// ---------------------------------------------------------------------------
// Estilo
// ---------------------------------------------------------------------------
for (const e of ESTILOS) {
  const b = document.createElement('button');
  b.innerHTML = `<span class="emoji">${e.icono}</span>`;
  b.append(e.nombre);
  b.addEventListener('click', () => estilizar(e));
  $('#lista-estilos').append(b);
}
$('#detalle-estilo').addEventListener('input', (e) => { $('#detalle-estilo-valor').textContent = e.target.value; });

async function estilizar(e) {
  if (!hayModelo()) return;
  if (e.id === 'original') {
    if (!estado.base) return;
    aplicarCambio(copiaProfunda(estado.base.objeto), { clips: estado.base.clips, info: estado.info });
    return;
  }
  await tarea(`Estilo ${e.nombre}`, async (ctx) => {
    ctx.progreso({ etapa: `Aplicando estilo ${e.nombre}`, porcentaje: 40 });
    await esperarPintado();
    visor.detenerAnimacion();
    const animado = tieneEsqueleto(visor.objeto) && !e.geometria;
    const nuevo = aplicarEstilo(visor.objeto, e.id, { resolucion: Number($('#detalle-estilo').value) });
    aplicarCambio(nuevo, { clips: animado ? visor.clips : [], info: estado.info });
    marcarVista('textura');
    if (e.geometria && estado.historial.at(-1) && tieneEsqueleto(estado.historial.at(-1).objeto)) {
      tostada('El estilo crea una malla nueva: vuelve a crear el esqueleto para animarla');
    }
    ctx.progreso({ etapa: `Estilo ${e.nombre} aplicado`, porcentaje: 100 });
  });
}

// ---------------------------------------------------------------------------
// Textura
// ---------------------------------------------------------------------------
async function retexturizar(opciones) {
  if (!hayModelo()) return;
  await tarea('Nueva textura con IA', async (ctx) => {
    visor.detenerAnimacion();
    const glb = await exportarGLB(visor.objeto);
    const res = await texturizar(ctx, glb, opciones);
    const { objeto } = await visor.leerGLB(res);
    aplicarCambio(objeto, { glb: res, info: { ...estado.info, motor: 'MV-Adapter · Tripo' } });
    if (tieneEsqueleto(estado.historial.at(-1)?.objeto)) tostada('Textura lista. Vuelve a crear el esqueleto para animar el nuevo modelo.');
    ctx.progreso({ etapa: 'Textura aplicada', porcentaje: 100 });
  }, { ia: true });
}
$('#btn-textura-texto').addEventListener('click', () => {
  const texto = $('#texto-textura').value.trim();
  if (texto.length < 3) { tostada('Describe la textura que quieres'); return; }
  retexturizar({ texto });
});
$('#imagen-textura').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  retexturizar({ imagen: await normalizarImagen(f), texto: $('#texto-textura').value.trim() });
});

let pincelSesion = false;
$('#btn-pincel').addEventListener('click', () => {
  if (!hayModelo() || !pincel) return;
  const activar = !pincel.activo;
  pincel.activar(activar);
  pincelSesion = false;
  $('#btn-pincel').textContent = activar ? '✋ Dejar de pintar' : '🖌️ Activar pincel';
  if (activar) { marcarVista('textura'); tostada('Pinta arrastrando sobre el modelo'); }
});
if (pincel) {
  const original = visor.alPulsar;
  visor.alPulsar = (e, ray) => {
    if (pincel.activo && !pincelSesion) {
      // Antes del primer trazo guardamos una copia para poder deshacer.
      pincelSesion = true;
      estado.historial.push({ objeto: copiaProfunda(visor.objeto), clips: visor.clips, glb: estado.glb, info: estado.info, guardadoId: estado.guardadoId });
      estado.rehacer = [];
      estado.glb = null;
      estado.guardadoId = null;
      refrescarUI();
    }
    original(e, ray);
  };
  pincel.alCambiar = () => { visor.materialesCambiados(); };
}
$('#pincel-color').addEventListener('input', (e) => pincel?.color.set(e.target.value));
$('#pincel-tamano').addEventListener('input', (e) => { if (pincel) pincel.tamano = Number(e.target.value); });

function cambiarMateriales(fn) {
  if (!hayModelo()) return;
  visor.restaurarMateriales();
  visor.objeto.traverse((o) => {
    if (!o.isMesh || o.userData.ayuda) return;
    for (const m of [o.material].flat()) { fn(m); m.needsUpdate = true; }
  });
  estado.glb = null;
  estado.guardadoId = null;
  visor.materialesCambiados();
  refrescarUI();
}
let materialSesion = false;
const prepararCambioMaterial = () => {
  if (materialSesion) return;
  materialSesion = true;
  estado.historial.push({ objeto: visor.objeto, clips: visor.clips, glb: estado.glb, info: estado.info, guardadoId: estado.guardadoId });
  const copia = copiaProfunda(visor.objeto);
  visor.establecer(copia, { clips: visor.clips, encuadrar: false });
};
['#mat-tono', '#mat-rugosidad', '#mat-metal'].forEach((s) => $(s).addEventListener('pointerdown', () => { if (hayModelo()) prepararCambioMaterial(); }));
['#mat-tono', '#mat-rugosidad', '#mat-metal'].forEach((s) => $(s).addEventListener('change', () => { materialSesion = false; }));
$('#mat-tono').addEventListener('input', (e) => cambiarMateriales((m) => m.color?.set(e.target.value)));
$('#mat-rugosidad').addEventListener('input', (e) => cambiarMateriales((m) => { if ('roughness' in m) m.roughness = Number(e.target.value); }));
$('#mat-metal').addEventListener('input', (e) => cambiarMateriales((m) => { if ('metalness' in m) m.metalness = Number(e.target.value); }));
$('#btn-quitar-textura').addEventListener('click', () => {
  if (!hayModelo()) return;
  const copia = copiaProfunda(visor.objeto);
  copia.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of [o.material].flat()) { m.map = null; m.vertexColors = false; m.needsUpdate = true; }
  });
  aplicarCambio(copia, { clips: visor.clips, info: estado.info });
});

// ---------------------------------------------------------------------------
// Partes
// ---------------------------------------------------------------------------
$('#num-bloques').addEventListener('input', (e) => { $('#num-bloques-valor').textContent = e.target.value; });
$('#btn-segmentar').addEventListener('click', async () => {
  if (!hayModelo()) return;
  await tarea('Segmentación', async (ctx) => {
    ctx.progreso({ etapa: 'Separando en partes', porcentaje: 40 });
    await esperarPintado();
    visor.detenerAnimacion();
    const grupo = segmentar(visor.objeto, $('#modo-partes').value, { bloques: Number($('#num-bloques').value) });
    aplicarCambio(grupo, { info: estado.info });
    marcarVista('partes');
    ctx.progreso({ etapa: `${grupo.children.length} partes`, porcentaje: 100 });
  });
});

function pintarPartes() {
  const lista = $('#lista-partes');
  lista.innerHTML = '';
  const partes = partesDe(visor?.objeto);
  if (!partes) return;
  for (const p of partes) {
    const fila = document.createElement('div');
    fila.className = `parte${p.visible ? '' : ' oculta'}`;
    const punto = document.createElement('span');
    punto.className = 'punto';
    punto.style.background = p.userData.parte.color;
    const nombre = document.createElement('span');
    nombre.className = 'nombre';
    nombre.textContent = p.userData.parte.nombre;
    nombre.title = `${fmt.format(p.userData.parte.caras)} triángulos`;
    const ver = Object.assign(document.createElement('button'), { textContent: p.visible ? '👁️' : '🚫', title: 'Mostrar u ocultar' });
    ver.addEventListener('click', () => { p.visible = !p.visible; pintarPartes(); });
    const solo = Object.assign(document.createElement('button'), { textContent: 'Solo', title: 'Ver solo esta parte' });
    solo.addEventListener('click', () => { partes.forEach((q) => { q.visible = q === p; }); pintarPartes(); });
    const stl = Object.assign(document.createElement('button'), { textContent: 'STL', title: 'Descargar esta parte en STL' });
    stl.addEventListener('click', async () => descargarParte(p, 'stl'));
    const glb = Object.assign(document.createElement('button'), { textContent: 'GLB', title: 'Descargar esta parte en GLB' });
    glb.addEventListener('click', async () => descargarParte(p, 'glb'));
    fila.append(punto, nombre, ver, solo, stl, glb);
    lista.append(fila);
  }
  const todas = Object.assign(document.createElement('button'), { textContent: 'Mostrar todas', className: 'enlace' });
  todas.addEventListener('click', () => { partes.forEach((q) => { q.visible = true; }); pintarPartes(); });
  lista.append(todas);
}

async function descargarParte(parte, formato) {
  const alto = Math.max(1, Number($('#altura-mm').value) || 80);
  // Mantiene la escala relativa al modelo completo: altura proporcional.
  const total = new THREE.Box3().setFromObject(visor.objeto).getSize(new THREE.Vector3()).y;
  const suya = new THREE.Box3().setFromObject(parte).getSize(new THREE.Vector3()).y;
  const visible = parte.visible;
  parte.visible = true;
  const copia = new THREE.Group();
  parte.updateWorldMatrix(true, true);
  parte.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    copia.add(new THREE.Mesh(g, o.material));
  });
  parte.visible = visible;
  const blob = await exportarFormato(formato, copia, { alturaMm: alto * (suya / (total || 1)) });
  descargarBlob(blob, `${nombreArchivo($('#nombre-modelo').value)}-${nombreArchivo(parte.userData.parte.nombre)}.${formato}`);
}

// ---------------------------------------------------------------------------
// Optimizar
// ---------------------------------------------------------------------------
const objetivoTri = () => Math.round(500 * Math.pow(400, Number($('#objetivo-tri').value) / 100));
const actualizarObjetivo = () => { $('#objetivo-tri-valor').textContent = fmt.format(objetivoTri()); };
$('#objetivo-tri').addEventListener('input', actualizarObjetivo);
actualizarObjetivo();
$('#btn-reducir').addEventListener('click', async () => {
  if (!hayModelo()) return;
  await tarea('Reducción de polígonos', async (ctx) => {
    ctx.progreso({ etapa: 'Reduciendo polígonos', porcentaje: 40 });
    await esperarPintado();
    visor.detenerAnimacion();
    const antes = visor.estadisticas().triangulos;
    const malla = reducir(visor.objeto, objetivoTri(), { plano: $('#facetado').checked });
    aplicarCambio(malla, { info: estado.info });
    const despues = visor.estadisticas().triangulos;
    ctx.progreso({ etapa: 'Polígonos reducidos', porcentaje: 100, detalle: `${fmt.format(antes)} → ${fmt.format(despues)} triángulos` });
  });
});

$$('[data-rotar]').forEach((b) => b.addEventListener('click', () => {
  if (!hayModelo()) return;
  const [eje, grados] = b.dataset.rotar.split(',');
  const envoltorio = new THREE.Group();
  envoltorio.name = 'orientado';
  const viejo = visor.objeto;
  // Se reutiliza el mismo objeto dentro de un grupo girado (el historial guarda una copia).
  const copia = clonarConHuesos(viejo);
  envoltorio.add(copia);
  envoltorio.rotation[eje] = THREE.MathUtils.degToRad(Number(grados));
  aplicarCambio(envoltorio, { clips: visor.clips, info: estado.info });
}));

$('#btn-analizar').addEventListener('click', async () => {
  if (!hayModelo()) return;
  await tarea('Análisis', async (ctx) => {
    ctx.progreso({ etapa: 'Analizando la malla', porcentaje: 50 });
    await esperarPintado();
    const alto = Math.max(1, Number($('#altura-mm').value) || 80);
    const r = analizarImpresion(visor.objeto, alto);
    const gramos = r.volumenCm3 * 1.24;
    const caja = $('#analisis');
    caja.innerHTML = '';
    const fila = (k, v, clase = '') => {
      const a = document.createElement('span'); a.textContent = k;
      const b = document.createElement('b'); b.textContent = v; if (clase) b.className = clase;
      caja.append(a, b);
    };
    fila('Medidas', `${r.medidasMm.x.toFixed(1)} × ${r.medidasMm.z.toFixed(1)} × ${r.medidasMm.y.toFixed(1)} mm`);
    fila('Triángulos', fmt.format(r.triangulos));
    fila('Malla cerrada', r.estanca ? 'Sí ✓' : `No (${fmt.format(r.abiertas)} bordes abiertos)`, r.estanca ? 'ok' : 'mal');
    if (r.noVariedad) fila('Aristas raras', fmt.format(r.noVariedad), 'mal');
    fila('Volumen', `${r.volumenCm3.toFixed(1)} cm³`);
    fila('Superficie', `${r.areaCm2.toFixed(1)} cm²`);
    fila('PLA (macizo)', `≈ ${gramos.toFixed(0)} g`);
    fila('PLA (relleno 20 %)', `≈ ${(gramos * 0.35).toFixed(0)} g`);
    if (!r.estanca) {
      const p = document.createElement('span');
      p.style.gridColumn = '1 / -1';
      p.className = 'ayuda';
      p.textContent = 'Consejo: aplica el estilo «Vóxel» o reduce polígonos para obtener una malla cerrada, o deja que tu programa de laminado la repare.';
      caja.append(p);
    }
    caja.hidden = false;
    ctx.progreso({ etapa: 'Análisis listo', porcentaje: 100 });
  });
});

// ---------------------------------------------------------------------------
// Exportar, guardar, compartir y abrir
// ---------------------------------------------------------------------------
for (const f of FORMATOS) {
  const b = document.createElement('button');
  b.className = 'btn-formato';
  b.dataset.formato = f.id;
  b.innerHTML = `<b>${f.nombre}</b><span>${f.detalle}</span>`;
  b.addEventListener('click', () => exportar(f.id));
  $('#botones-exportar').append(b);
}

async function exportar(formato) {
  if (!hayModelo()) return;
  const nombre = nombreArchivo($('#nombre-modelo').value);
  const alto = Math.max(1, Number($('#altura-mm').value) || 80);
  await tarea(`Exportar ${formato.toUpperCase()}`, async (ctx) => {
    ctx.progreso({ etapa: `Preparando ${formato.toUpperCase()}`, porcentaje: 40 });
    await esperarPintado();
    const pausado = visor.accion;
    visor.detenerAnimacion();
    visor.restaurarMateriales();
    const blob = await exportarFormato(formato, visor.objeto, { alturaMm: alto, clips: visor.clips, glbOriginal: estado.glb });
    visor.aplicarModo(visor.modoVista);
    if (pausado) visor.reproducir(pausado.getClip());
    descargarBlob(blob, `${nombre}.${formato}`);
    ctx.progreso({ etapa: `${nombre}.${formato} descargado`, porcentaje: 100, detalle: `${(blob.size / 1048576).toFixed(1)} MB` });
  });
}

async function glbActual() {
  visor.restaurarMateriales();
  const glb = estado.glb && !visor.clips.length ? estado.glb : await exportarGLB(visor.objeto, visor.clips);
  visor.aplicarModo(visor.modoVista);
  return glb;
}

async function guardarActual(automatico = false) {
  if (!hayModelo() || estado.guardadoId) return;
  try {
    const glb = await glbActual();
    const r = await guardarModelo({
      nombre: $('#nombre-modelo').value.trim() || estado.info?.nombre || 'modelo',
      motor: estado.info?.motor ?? '',
      origen: estado.info?.origen ?? 'archivo',
      prompt: estado.info?.prompt ?? '',
      glb,
      miniatura: await visor.captura(256),
      animaciones: visor.clips.length,
    });
    estado.guardadoId = r.id;
    refrescarUI();
    actualizarCuenta();
    tostada(automatico ? 'Modelo guardado automáticamente en tu biblioteca' : 'Guardado en la biblioteca');
  } catch (e) {
    console.error(e);
    if (!automatico) tostada('No se ha podido guardar (¿navegación privada?)');
  }
}
$('#btn-guardar').addEventListener('click', () => guardarActual(false));

$('#btn-compartir').addEventListener('click', async () => {
  if (!hayModelo()) return;
  const nombre = nombreArchivo($('#nombre-modelo').value);
  const archivo = new File([await glbActual()], `${nombre}.glb`, { type: 'model/gltf-binary' });
  if (navigator.canShare?.({ files: [archivo] })) {
    try { await navigator.share({ files: [archivo], title: nombre, text: 'Modelo 3D creado con FORJA 3D' }); } catch { /* cancelado */ }
  } else {
    descargarBlob(archivo, archivo.name);
    tostada('Tu navegador no permite compartir archivos: se ha descargado');
  }
});

$('#btn-abrir').addEventListener('click', () => $('#entrada-modelo').click());
$('#entrada-modelo').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !visor) return;
  const nombre = f.name.replace(/\.[^.]+$/, '');
  try {
    let objeto;
    if (/\.stl$/i.test(f.name)) {
      const geo = new STLLoader().parse(await f.arrayBuffer());
      geo.computeVertexNormals();
      const malla = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb7b0d8, roughness: 0.6, vertexColors: !!geo.attributes.color }));
      malla.rotation.x = -Math.PI / 2;
      objeto = new THREE.Group().add(malla);
    } else if (/\.obj$/i.test(f.name)) {
      objeto = new OBJLoader().parse(await f.text());
      objeto.traverse((o) => { if (o.isMesh) o.material = new THREE.MeshStandardMaterial({ color: 0xc9c4d6, roughness: 0.7, vertexColors: !!o.geometry.attributes.color }); });
    } else {
      await cargarModelo(f, { nombre, origen: 'archivo', motor: 'Archivo' });
      mostrarVista('estudio');
      return;
    }
    aplicarCambio(objeto, { info: { nombre, origen: 'archivo', motor: 'Archivo' }, encuadrar: true });
    estado.base = { objeto: copiaProfunda(objeto), clips: [] };
    $('#nombre-modelo').value = nombre;
    mostrarVista('estudio');
  } catch (err) {
    console.error(err);
    tostada('No se ha podido abrir ese archivo');
  }
});

// ---------------------------------------------------------------------------
// Ejemplos generados por código (sin internet)
// ---------------------------------------------------------------------------
function colorear(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo.index ? geo.toNonIndexed() : geo;
}
function pieza(geo, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = geo.clone();
  for (const n of ['uv', 'uv1']) if (g.attributes[n]) g.deleteAttribute(n);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).setPosition(x, y, z));
  return colorear(g, color);
}
function crearSeta() {
  const partes = [
    pieza(new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.22, 0.05], [0.17, 0.3], [0.15, 0.55], [0, 0.55]].map(([x, y]) => new THREE.Vector2(x, y)), 40), '#f3ead8', 0, 0, 0),
    pieza(new THREE.SphereGeometry(0.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), '#d8333f', 0, 0.5, 0),
    pieza(new THREE.CircleGeometry(0.5, 48), '#f1e3c8', 0, 0.5, 0, Math.PI / 2),
  ];
  for (let i = 0; i < 12; i++) {
    const phi = Math.acos(1 - (i + 0.5) / 12 * 0.85), theta = i * 2.4;
    const p = new THREE.Vector3().setFromSphericalCoords(0.5, phi, theta);
    partes.push(pieza(new THREE.SphereGeometry(0.065, 12, 8).scale(1, 0.4, 1), '#ffffff', p.x, p.y * 0.7 + 0.5, p.z, phi * Math.cos(theta), 0, -phi * Math.sin(theta)));
  }
  return new THREE.Mesh(mergeGeometries(partes), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }));
}
function crearMuneco() {
  const piel = '#f2c19e', camiseta = '#3b82f6', pantalon = '#1f2a44', pelo = '#5b3a1e', zapato = '#222222';
  const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 16);
  const brazo = (lado) => {
    const ang = lado * 0.55; // brazos en «A»
    const sx = lado * 0.2, sy = 1.33;
    const dir = new THREE.Vector3(Math.sin(ang), -Math.cos(ang), 0);
    const p1 = new THREE.Vector3(sx, sy, 0).addScaledVector(dir, 0.17);
    const p2 = new THREE.Vector3(sx, sy, 0).addScaledVector(dir, 0.47);
    const mano = new THREE.Vector3(sx, sy, 0).addScaledVector(dir, 0.64);
    return [
      pieza(cap(0.055, 0.26), camiseta, p1.x, p1.y, p1.z, 0, 0, ang),
      pieza(cap(0.048, 0.26), piel, p2.x, p2.y, p2.z, 0, 0, ang),
      pieza(new THREE.SphereGeometry(0.058, 16, 12), piel, mano.x, mano.y, mano.z),
    ];
  };
  const pierna = (lado) => [
    pieza(cap(0.075, 0.3), pantalon, lado * 0.09, 0.66, 0),
    pieza(cap(0.065, 0.3), pantalon, lado * 0.09, 0.3, 0),
    pieza(new THREE.BoxGeometry(0.12, 0.07, 0.22), zapato, lado * 0.09, 0.035, 0.04),
  ];
  const partes = [
    pieza(cap(0.17, 0.28), camiseta, 0, 1.12, 0),
    pieza(new THREE.CylinderGeometry(0.165, 0.15, 0.16, 20), pantalon, 0, 0.87, 0),
    pieza(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), piel, 0, 1.43, 0),
    pieza(new THREE.SphereGeometry(0.15, 24, 18), piel, 0, 1.6, 0),
    pieza(new THREE.SphereGeometry(0.155, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), pelo, 0, 1.62, -0.01),
    pieza(new THREE.SphereGeometry(0.02, 8, 6), '#111111', -0.05, 1.62, 0.14),
    pieza(new THREE.SphereGeometry(0.02, 8, 6), '#111111', 0.05, 1.62, 0.14),
    ...brazo(1), ...brazo(-1), ...pierna(1), ...pierna(-1),
  ];
  return new THREE.Mesh(mergeGeometries(partes), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
}
$('#btn-demo').addEventListener('click', async () => {
  if (!visor) return;
  const glb = await exportarGLB(crearSeta());
  await cargarModelo(glb, { nombre: 'seta-de-ejemplo', origen: 'ejemplo', motor: 'Ejemplo' });
});
$('#btn-demo-personaje').addEventListener('click', async () => {
  if (!visor) return;
  const glb = await exportarGLB(crearMuneco());
  await cargarModelo(glb, { nombre: 'personaje-de-ejemplo', origen: 'ejemplo', motor: 'Ejemplo' });
  abrirHerramienta('animar');
  $('#tipo-rig').value = 'humanoide';
  $('#btn-crear-rig').click();
  $('#btn-aplicar-rig').click();
});

// ---------------------------------------------------------------------------
// Biblioteca
// ---------------------------------------------------------------------------
async function actualizarCuenta() {
  try { $('#cuenta-biblio').textContent = (await listarModelos()).length; } catch { $('#cuenta-biblio').textContent = '0'; }
}

let urlsBiblio = [];
async function pintarBiblioteca() {
  urlsBiblio.forEach((u) => URL.revokeObjectURL(u));
  urlsBiblio = [];
  const rejilla = $('#rejilla');
  rejilla.innerHTML = '';
  let modelos = [];
  try { modelos = await listarModelos(); } catch (e) { console.error(e); }
  $('#biblio-vacia').hidden = modelos.length > 0;
  $('#cuenta-biblio').textContent = modelos.length;
  const fecha = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  for (const m of modelos) {
    const t = document.createElement('article');
    t.className = 'tarjeta';
    const img = document.createElement('img');
    img.alt = m.nombre;
    if (m.miniatura) { const u = URL.createObjectURL(m.miniatura); urlsBiblio.push(u); img.src = u; }
    const cuerpo = document.createElement('div');
    cuerpo.className = 'cuerpo';
    const titulo = document.createElement('div');
    titulo.className = 'titulo';
    titulo.textContent = m.nombre;
    titulo.title = m.prompt || m.nombre;
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = `${fecha.format(m.fecha)}${m.motor ? ` · ${m.motor}` : ''}${m.animaciones ? ` · 🦴 ${m.animaciones} animaciones` : ''}`;
    const acciones = document.createElement('div');
    acciones.className = 'acciones';
    const abrir = Object.assign(document.createElement('button'), { textContent: 'Abrir' });
    const bajar = Object.assign(document.createElement('button'), { textContent: 'GLB' });
    const borrar = Object.assign(document.createElement('button'), { textContent: 'Borrar', className: 'borrar' });
    const cargar = async () => {
      const r = await obtenerModelo(m.id);
      mostrarVista('estudio');
      await cargarModelo(r.glb, { nombre: r.nombre, origen: r.origen, motor: r.motor, prompt: r.prompt }, { guardadoId: r.id });
      if (visor.clips.length) { visor.reproducir(visor.clips[0]); $('#anim-nombre').textContent = visor.clips[0].name; abrirHerramienta('animar'); refrescarUI(); }
    };
    abrir.addEventListener('click', cargar);
    img.addEventListener('click', cargar);
    bajar.addEventListener('click', async () => descargarBlob((await obtenerModelo(m.id)).glb, `${nombreArchivo(m.nombre)}.glb`));
    borrar.addEventListener('click', async () => {
      if (!confirm(`¿Borrar «${m.nombre}» de la biblioteca?`)) return;
      await borrarModelo(m.id);
      if (estado.guardadoId === m.id) { estado.guardadoId = null; refrescarUI(); }
      pintarBiblioteca();
    });
    acciones.append(abrir, bajar, borrar);
    cuerpo.append(titulo, meta, acciones);
    t.append(img, cuerpo);
    rejilla.append(t);
  }
}

function mostrarVista(v) {
  $$('[data-vista]').forEach((b) => b.classList.toggle('activo', b.dataset.vista === v));
  $('#vista-estudio').hidden = v !== 'estudio';
  $('#vista-biblioteca').hidden = v !== 'biblioteca';
  if (v === 'biblioteca') pintarBiblioteca();
  else visor?.ajustarTamano();
}
$$('[data-vista]').forEach((b) => b.addEventListener('click', () => mostrarVista(b.dataset.vista)));

// ---------------------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------------------
$('#btn-ajustes').addEventListener('click', () => {
  $('#token-hf').value = leerLocal('forja3d.token');
  $('#dialogo-ajustes').showModal();
});
$('#dialogo-ajustes').addEventListener('close', () => {
  if ($('#dialogo-ajustes').returnValue !== 'guardar') return;
  const t = $('#token-hf').value.trim();
  if (t && !/^hf_[A-Za-z0-9]{10,}$/.test(t)) { tostada('Ese token no parece válido (empieza por hf_)'); return; }
  escribirLocal('forja3d.token', t);
  tostada(t ? 'Token guardado: usarás tu propio cupo de GPU' : 'Token eliminado');
});

// Cambiar el tipo sugerido de esqueleto al cargar.
const observarTipo = () => { if (hayModelo() && !tieneEsqueleto(visor.objeto)) $('#tipo-rig').value = sugerirTipo(); };
$('[data-herr="animar"]').addEventListener('click', observarTipo);

refrescarUI();
actualizarCuenta();
actualizarBotonGenerar();
window.forja3d = { estado, visor }; // útil para depurar
