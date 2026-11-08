// Controlador principal de FORJA 3D.
import * as THREE from 'three';
import { Visor } from './visor.js';
import { MOTORES, imagenA3D, textoAImagen } from './motores.js';
import { descargarBlob, nombreArchivo, exportarGLB, exportarSTL, exportarOBJ } from './exportar.js';
import { guardarModelo, listarModelos, obtenerModelo, borrarModelo } from './biblioteca.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const estado = {
  modo: 'imagen',
  calidad: 'rapida',
  imagen: null,          // Blob de la imagen de entrada
  glb: null,             // Blob GLB original del modelo actual (si lo hay)
  info: null,            // { nombre, motor, origen, prompt }
  guardadoId: null,
  abortar: null,
  urls: [],
};

// ---------------------------------------------------------------------------
// Utilidades de interfaz
// ---------------------------------------------------------------------------
let temporizadorTostada;
function tostada(texto) {
  const t = $('#tostada');
  t.textContent = texto;
  t.classList.add('visible');
  clearTimeout(temporizadorTostada);
  temporizadorTostada = setTimeout(() => t.classList.remove('visible'), 3200);
}

function aviso(texto, tipo = 'error') {
  const a = $('#aviso');
  if (!texto) { a.hidden = true; return; }
  a.className = `aviso ${tipo === 'info' ? 'info' : ''}`;
  a.innerHTML = '';
  const lineas = String(texto).split('\n');
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

function actualizarBotonGenerar() {
  const listo = estado.modo === 'imagen' ? !!estado.imagen : $('#entrada-texto').value.trim().length >= 3;
  $('#btn-generar').disabled = !listo || !!estado.abortar;
}

// ---------------------------------------------------------------------------
// Visor
// ---------------------------------------------------------------------------
let visor;
try {
  visor = new Visor($('#lienzo'));
} catch (e) {
  console.error(e);
  $('#vacio p').textContent = 'Tu navegador no permite WebGL, así que no se puede mostrar el visor 3D.';
}

function mostrarInfo() {
  const s = visor?.estadisticas();
  const caja = $('#info-modelo');
  if (!s) { caja.hidden = true; return; }
  const fmt = new Intl.NumberFormat('es-ES');
  const alto = Number($('#altura-mm').value) || 80;
  const k = alto / s.proporcion.y;
  $('#info-triangulos').textContent = `${fmt.format(s.triangulos)} triángulos`;
  $('#info-vertices').textContent = `${fmt.format(s.vertices)} vértices`;
  $('#info-medidas').textContent = `${Math.round(s.proporcion.x * k)} × ${Math.round(s.proporcion.z * k)} × ${Math.round(alto)} mm`;
  $('#info-motor').textContent = estado.info?.motor ?? '';
  $('#info-motor').hidden = !estado.info?.motor;
  caja.hidden = false;
}

function hayModelo(si) {
  $('#vacio').hidden = si;
  $$('.btn-formato').forEach((b) => { b.disabled = !si; });
  $('#btn-guardar').disabled = !si || !!estado.guardadoId;
  $('#btn-guardar').textContent = estado.guardadoId ? '✓ Guardado en la biblioteca' : '💾 Guardar en la biblioteca';
}

async function cargarEnVisor(glb, info, guardadoId = null) {
  await visor.cargarGLB(glb);
  estado.glb = glb;
  estado.info = info;
  estado.guardadoId = guardadoId;
  if (info?.nombre) $('#nombre-modelo').value = info.nombre;
  hayModelo(true);
  mostrarInfo();
}

// ---------------------------------------------------------------------------
// Entrada: modos, imagen y texto
// ---------------------------------------------------------------------------
$$('[data-modo]').forEach((b) => b.addEventListener('click', () => {
  estado.modo = b.dataset.modo;
  $$('[data-modo]').forEach((x) => x.classList.toggle('activo', x === b));
  $('#modo-imagen').hidden = estado.modo !== 'imagen';
  $('#modo-texto').hidden = estado.modo !== 'texto';
  aviso('');
  actualizarBotonGenerar();
}));

$$('[data-calidad]').forEach((b) => b.addEventListener('click', () => {
  estado.calidad = b.dataset.calidad;
  $$('[data-calidad]').forEach((x) => x.classList.toggle('activo', x === b));
}));

/** Reduce imágenes muy grandes y las pasa a PNG (conserva la transparencia). */
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
  try {
    estado.imagen = await normalizarImagen(archivo);
  } catch {
    tostada('No se ha podido leer la imagen');
    return;
  }
  estado.nombreImagen = (archivo.name || 'imagen').replace(/\.[^.]+$/, '');
  const url = URL.createObjectURL(estado.imagen);
  estado.urls.push(url);
  $('#vista-previa').src = url;
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

$('#entrada-texto').addEventListener('input', actualizarBotonGenerar);
const SUGERENCIAS = [
  'un robot pequeño y simpático',
  'un cofre del tesoro de madera',
  'una taza con forma de búho',
  'una zapatilla deportiva roja',
  'un castillo medieval en miniatura',
  'un balón de baloncesto con alas',
];
for (const s of SUGERENCIAS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = s;
  b.addEventListener('click', () => { $('#entrada-texto').value = s; actualizarBotonGenerar(); });
  $('#sugerencias').append(b);
}

// Motores
for (const m of MOTORES) {
  const o = document.createElement('option');
  o.value = m.id; o.textContent = m.nombre;
  $('#motor').append(o);
}
$('#motor').value = leerLocal('forja3d.motor', 'auto');
if (!$('#motor').value) $('#motor').value = 'auto';
const actualizarAyudaMotor = () => {
  $('#ayuda-motor').textContent = MOTORES.find((m) => m.id === $('#motor').value)?.ayuda ?? '';
};
$('#motor').addEventListener('change', () => { escribirLocal('forja3d.motor', $('#motor').value); actualizarAyudaMotor(); });
actualizarAyudaMotor();

// ---------------------------------------------------------------------------
// Generación
// ---------------------------------------------------------------------------
function bloquear(si) {
  $('#btn-cancelar').hidden = !si;
  $$('.panel-crear input, .panel-crear select, .panel-crear textarea, .segmentado button').forEach((x) => { x.disabled = si; });
  actualizarBotonGenerar();
  $('#btn-generar').querySelector('span').textContent = si ? 'Generando…' : 'Generar modelo 3D';
}

async function generar() {
  if (estado.abortar) return;
  aviso('');
  const control = new AbortController();
  estado.abortar = control;
  bloquear(true);
  progreso({ etapa: 'Preparando…', porcentaje: 0, detalle: '' });
  const ctx = { signal: control.signal, token: leerLocal('forja3d.token') || undefined, progreso };
  const motor = $('#motor').value;
  const semillaTxt = $('#semilla').value.trim();
  const opciones = { calidad: estado.calidad, semilla: semillaTxt ? Math.abs(parseInt(semillaTxt, 10)) : undefined };
  const inicio = performance.now();
  try {
    let imagen = estado.imagen;
    let info;
    if (estado.modo === 'texto') {
      const texto = $('#entrada-texto').value.trim();
      imagen = await textoAImagen(ctx, texto, $('#estilo').value, opciones.semilla);
      const url = URL.createObjectURL(imagen);
      estado.urls.push(url);
      $('#vista-previa-texto').src = url;
      $('#vista-previa-texto').hidden = false;
      info = { nombre: nombreArchivo(texto), origen: 'texto', prompt: texto };
    } else {
      info = { nombre: nombreArchivo(estado.nombreImagen), origen: 'imagen' };
    }
    const { glb, motor: usado } = await imagenA3D(ctx, imagen, motor, opciones);
    info.motor = usado;
    progreso({ etapa: 'Cargando el modelo', porcentaje: 99 });
    await cargarEnVisor(glb, info);
    const segundos = Math.round((performance.now() - inicio) / 1000);
    progreso({ etapa: '¡Modelo listo!', porcentaje: 100, detalle: `${usado} · ${segundos} s` });
    await guardarActual(true);
  } catch (e) {
    if (e.tipo === 'cancelado') {
      progreso({ etapa: 'Cancelado', detalle: '' });
    } else {
      console.error(e);
      $('#progreso').hidden = true;
      const sugerencia = motor !== 'local'
        ? '\nConsejo: elige el motor «Relieve local», que funciona al instante y sin internet, o añade tu token de Hugging Face en Ajustes.'
        : '';
      aviso(`No se ha podido crear el modelo.\n${e.message}${sugerencia}`);
    }
  } finally {
    estado.abortar = null;
    bloquear(false);
  }
}

$('#btn-generar').addEventListener('click', generar);
$('#btn-cancelar').addEventListener('click', () => estado.abortar?.abort());
$('#entrada-texto').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !$('#btn-generar').disabled) generar();
});

// ---------------------------------------------------------------------------
// Herramientas del visor
// ---------------------------------------------------------------------------
$$('[data-vista3d]').forEach((b) => b.addEventListener('click', () => {
  $$('[data-vista3d]').forEach((x) => x.classList.toggle('activo', x === b));
  visor?.aplicarModo(b.dataset.vista3d);
}));
$('#btn-rotar').addEventListener('click', (e) => {
  const on = e.currentTarget.classList.toggle('activo');
  if (visor) visor.autoRotar = on;
});
$('#btn-suelo').addEventListener('click', (e) => {
  const on = e.currentTarget.classList.toggle('activo');
  if (visor) visor.verSuelo = on;
});
$('#btn-centrar').addEventListener('click', () => visor?.encuadrar());
$('#btn-captura').addEventListener('click', async () => {
  if (!visor?.modelo) { tostada('Primero genera o abre un modelo'); return; }
  descargarBlob(await visor.captura(), `${nombreArchivo($('#nombre-modelo').value)}.png`);
});
$('#altura-mm').addEventListener('input', mostrarInfo);

// ---------------------------------------------------------------------------
// Exportar, guardar y abrir
// ---------------------------------------------------------------------------
$$('.btn-formato').forEach((b) => b.addEventListener('click', async () => {
  if (!visor?.modelo) return;
  const nombre = nombreArchivo($('#nombre-modelo').value);
  const alto = Math.max(1, Number($('#altura-mm').value) || 80);
  try {
    if (b.dataset.formato === 'glb') {
      descargarBlob(estado.glb ?? await exportarGLB(visor.objetoExportable()), `${nombre}.glb`);
    } else if (b.dataset.formato === 'stl') {
      descargarBlob(exportarSTL(visor.objetoExportable(), alto), `${nombre}.stl`);
    } else {
      descargarBlob(exportarOBJ(visor.objetoExportable(), alto), `${nombre}.obj`);
    }
    tostada(`Descargando ${nombre}.${b.dataset.formato}`);
  } catch (e) {
    console.error(e);
    tostada('No se ha podido exportar el modelo');
  }
}));

async function miniatura() {
  const blob = await visor.captura(256);
  return blob;
}

async function guardarActual(automatico = false) {
  if (!visor?.modelo || estado.guardadoId) return;
  try {
    const glb = estado.glb ?? await exportarGLB(visor.objetoExportable());
    const r = await guardarModelo({
      nombre: $('#nombre-modelo').value.trim() || estado.info?.nombre || 'modelo',
      motor: estado.info?.motor ?? '',
      origen: estado.info?.origen ?? 'archivo',
      prompt: estado.info?.prompt ?? '',
      glb,
      miniatura: await miniatura(),
    });
    estado.glb = glb;
    estado.guardadoId = r.id;
    hayModelo(true);
    actualizarCuenta();
    tostada(automatico ? 'Modelo guardado automáticamente en tu biblioteca' : 'Guardado en la biblioteca');
  } catch (e) {
    console.error(e);
    if (!automatico) tostada('No se ha podido guardar (¿navegación privada?)');
  }
}
$('#btn-guardar').addEventListener('click', () => guardarActual(false));

$('#btn-abrir').addEventListener('click', () => $('#entrada-modelo').click());
$('#entrada-modelo').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !visor) return;
  const nombre = f.name.replace(/\.[^.]+$/, '');
  try {
    if (/\.stl$/i.test(f.name)) {
      const geo = new STLLoader().parse(await f.arrayBuffer());
      geo.computeVertexNormals();
      const malla = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb7b0d8, roughness: 0.6 }));
      malla.rotation.x = -Math.PI / 2; // Z arriba → Y arriba
      visor.mostrar(malla);
      estado.glb = null;
      estado.info = { nombre, origen: 'archivo', motor: 'Archivo STL' };
      estado.guardadoId = null;
      $('#nombre-modelo').value = nombre;
      hayModelo(true);
      mostrarInfo();
    } else {
      await cargarEnVisor(f, { nombre, origen: 'archivo', motor: 'Archivo GLB' });
    }
    mostrarVista('estudio');
  } catch (err) {
    console.error(err);
    tostada('No se ha podido abrir ese archivo');
  }
});

// Modelo de ejemplo generado por código (no necesita internet).
function crearSeta() {
  const grupo = new THREE.Group();
  const pie = new THREE.Mesh(
    new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.22, 0.05], [0.17, 0.3], [0.15, 0.55], [0, 0.55]].map(([x, y]) => new THREE.Vector2(x, y)), 48),
    new THREE.MeshStandardMaterial({ color: 0xf3ead8, roughness: 0.8 }),
  );
  const sombrero = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xd8333f, roughness: 0.45 }),
  );
  sombrero.scale.set(1, 0.7, 1);
  sombrero.position.y = 0.5;
  grupo.add(pie, sombrero);
  const lunar = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
  for (let i = 0; i < 14; i++) {
    const phi = Math.acos(1 - (i + 0.5) / 14 * 0.85);
    const theta = i * 2.4;
    const p = new THREE.Vector3().setFromSphericalCoords(0.5, phi, theta);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8), lunar);
    d.scale.set(1, 0.35, 1);
    d.position.set(p.x, p.y * 0.7 + 0.5, p.z);
    d.lookAt(new THREE.Vector3(p.x * 2, p.y * 1.4 + 0.5, p.z * 2));
    d.rotateX(Math.PI / 2);
    grupo.add(d);
  }
  return grupo;
}
$('#btn-demo').addEventListener('click', async () => {
  if (!visor) return;
  const glb = await exportarGLB(crearSeta());
  await cargarEnVisor(glb, { nombre: 'seta-de-ejemplo', origen: 'ejemplo', motor: 'Ejemplo' });
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
    meta.textContent = `${fecha.format(m.fecha)}${m.motor ? ` · ${m.motor}` : ''}`;
    const acciones = document.createElement('div');
    acciones.className = 'acciones';
    const abrir = Object.assign(document.createElement('button'), { textContent: 'Abrir' });
    const bajar = Object.assign(document.createElement('button'), { textContent: 'GLB' });
    const borrar = Object.assign(document.createElement('button'), { textContent: 'Borrar', className: 'borrar' });
    const cargar = async () => {
      const r = await obtenerModelo(m.id);
      mostrarVista('estudio');
      await cargarEnVisor(r.glb, { nombre: r.nombre, origen: r.origen, motor: r.motor, prompt: r.prompt }, r.id);
    };
    abrir.addEventListener('click', cargar);
    img.addEventListener('click', cargar);
    bajar.addEventListener('click', async () => descargarBlob((await obtenerModelo(m.id)).glb, `${nombreArchivo(m.nombre)}.glb`));
    borrar.addEventListener('click', async () => {
      if (!confirm(`¿Borrar «${m.nombre}» de la biblioteca?`)) return;
      await borrarModelo(m.id);
      if (estado.guardadoId === m.id) { estado.guardadoId = null; hayModelo(!!visor?.modelo); }
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

hayModelo(false);
actualizarCuenta();
actualizarBotonGenerar();
window.forja3d = { estado, visor }; // útil para depurar
