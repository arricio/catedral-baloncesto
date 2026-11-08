// Motores de generación: imagen → 3D y texto → imagen, ejecutados en Hugging Face Spaces
// mediante el cliente oficial de Gradio. Todos devuelven un Blob GLB.
import { Client, handle_file } from '@gradio/client';
import { generarRelieveLocal } from './relieve.js';

const SEMILLA_MAX = 2147483647;
const semillaAleatoria = () => Math.floor(Math.random() * SEMILLA_MAX);

/** Error con un tipo para poder mostrar mensajes útiles y decidir si se prueba otro motor. */
export class ErrorMotor extends Error {
  constructor(mensaje, tipo = 'fallo') {
    super(mensaje);
    this.tipo = tipo; // 'cupo' | 'caido' | 'fallo' | 'cancelado'
  }
}

/** Traduce los errores típicos de Gradio / ZeroGPU a algo comprensible. */
export function clasificarError(err) {
  if (err instanceof ErrorMotor) return err;
  if (err?.name === 'AbortError') return new ErrorMotor('Generación cancelada', 'cancelado');
  const texto = String(err?.message ?? err ?? '');
  if (/quota|cuota|exceeded|GPU (task )?aborted|ZeroGPU|daily|rate limit|too many/i.test(texto)) {
    return new ErrorMotor('Se ha agotado el cupo gratuito de GPU de este motor. Añade tu token de Hugging Face en Ajustes, prueba otro motor o espera un rato.', 'cupo');
  }
  if (/sleep|paused|building|not found|404|503|502|could not resolve|failed to fetch|NetworkError|Could not get|Space metadata|connect/i.test(texto)) {
    return new ErrorMotor('El servidor de este motor no está disponible ahora mismo (puede estar dormido o arrancando).', 'caido');
  }
  return new ErrorMotor(texto || 'Error desconocido del motor', 'fallo');
}

const clientes = new Map();
async function conectar(espacio, token) {
  const clave = `${espacio}|${token ?? ''}`;
  if (!clientes.has(clave)) {
    const promesa = Client.connect(espacio, {
      events: ['data', 'status'],
      ...(token ? { token } : {}),
    }).catch((e) => { clientes.delete(clave); throw e; });
    clientes.set(clave, promesa);
  }
  return clientes.get(clave);
}

/**
 * Ejecuta un endpoint escuchando los eventos de estado para informar del progreso.
 * `rango` = [inicio, fin] en porcentaje global.
 */
const infoApi = new WeakMap();
/**
 * Adapta un objeto de parámetros con nombre a lo que el endpoint espera de verdad:
 * descarta los que no existen y rellena con su valor por defecto los que falten.
 */
async function adaptarDatos(cliente, endpoint, datos) {
  if (Array.isArray(datos)) return datos;
  if (!infoApi.has(cliente)) infoApi.set(cliente, cliente.view_api().catch(() => null));
  const info = (await infoApi.get(cliente))?.named_endpoints?.[endpoint];
  if (!info) return datos;
  const norm = (t) => String(t ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const valores = new Map(Object.entries(datos).map(([k, v]) => [norm(k), v]));
  return info.parameters.map((p) => {
    for (const clave of [p.parameter_name, p.label]) {
      if (clave && valores.has(norm(clave))) return valores.get(norm(clave));
    }
    return p.parameter_has_default ? p.parameter_default : null;
  });
}

async function ejecutar(ctx, cliente, endpoint, datos, etapa, rango) {
  if (ctx.signal?.aborted) throw new DOMException('cancelado', 'AbortError');
  const [ini, fin] = rango;
  const trabajo = cliente.submit(endpoint, await adaptarDatos(cliente, endpoint, datos));
  const cancelar = () => { try { trabajo.cancel(); } catch { /* nada */ } };
  ctx.signal?.addEventListener('abort', cancelar, { once: true });
  // Progreso simulado suave mientras el servidor no informe de nada concreto.
  let simulado = 0;
  const reloj = setInterval(() => {
    simulado = Math.min(0.9, simulado + (0.9 - simulado) * 0.04);
    ctx.progreso({ etapa, porcentaje: ini + (fin - ini) * simulado });
  }, 700);
  try {
    for await (const msg of trabajo) {
      if (ctx.signal?.aborted) throw new DOMException('cancelado', 'AbortError');
      if (msg.type === 'status') {
        if (msg.stage === 'error') throw new Error(msg.message || `Error en ${endpoint}`);
        if (msg.stage === 'pending' && msg.queue && (msg.position ?? 0) > 0) {
          ctx.progreso({ etapa: 'En cola', porcentaje: ini, detalle: `Posición ${msg.position + 1} en la cola${msg.eta ? ` · ~${Math.round(msg.eta)} s` : ''}` });
        } else if (msg.progress_data?.length) {
          const p = msg.progress_data.find((d) => d.progress != null || (d.index != null && d.length));
          if (p) {
            simulado = Math.max(simulado, Math.min(1, p.progress ?? (p.index + 1) / (p.length || 1)));
            ctx.progreso({ etapa, porcentaje: ini + (fin - ini) * simulado, detalle: p.desc ?? '' });
          }
        }
      } else if (msg.type === 'data') {
        ctx.progreso({ etapa, porcentaje: fin });
        return msg.data;
      }
    }
    throw new Error(`El motor no devolvió resultado en ${endpoint}`);
  } finally {
    clearInterval(reloj);
    ctx.signal?.removeEventListener('abort', cancelar);
  }
}

/** Busca recursivamente en la respuesta un archivo con alguna de las extensiones dadas. */
function buscarArchivo(dato, extensiones) {
  const pila = [dato];
  while (pila.length) {
    const x = pila.pop();
    if (!x || typeof x !== 'object') continue;
    const ruta = String(x.url ?? x.path ?? x.orig_name ?? '').toLowerCase().split('?')[0];
    if ((x.url || x.path) && extensiones.some((e) => ruta.endsWith(e))) return x;
    pila.push(...Object.values(x));
  }
  return null;
}

async function descargar(archivo, ctx, token) {
  if (!archivo?.url) throw new Error('El motor no devolvió ningún archivo');
  void token;
  const r = await fetch(archivo.url, { signal: ctx.signal });
  if (!r.ok) throw new Error(`Descarga fallida (${r.status})`);
  return r.blob();
}

// ---------------------------------------------------------------------------
// Motores imagen → 3D
// ---------------------------------------------------------------------------

export const MOTORES = [
  {
    id: 'auto',
    nombre: 'Automático (recomendado)',
    ayuda: 'Prueba TRELLIS.2, TRELLIS, Hunyuan3D-2 y Stable Fast 3D, por ese orden, hasta que uno responda.',
  },
  {
    id: 'trellis2',
    espacio: 'microsoft/TRELLIS.2',
    nombre: 'TRELLIS.2 · Microsoft',
    ayuda: 'La mejor calidad: geometría detallada y materiales PBR. Tarda 1-3 min.',
    async generar(ctx, imagen, op) {
      const c = await conectar(this.espacio, ctx.token);
      await c.predict('/start_session', []).catch(() => {});
      const [prep] = await ejecutar(ctx, c, '/preprocess_image', { input: handle_file(imagen) }, 'Quitando el fondo', [5, 15]);
      const rapida = op.calidad === 'rapida';
      await ejecutar(ctx, c, '/image_to_3d', {
        image: prep, seed: op.semilla, resolution: rapida ? '512' : '1024',
        ss_guidance_strength: 7.5, ss_guidance_rescale: 0.7, ss_sampling_steps: 12, ss_rescale_t: 5,
        shape_slat_guidance_strength: 7.5, shape_slat_guidance_rescale: 0.5, shape_slat_sampling_steps: 12, shape_slat_rescale_t: 3,
        tex_slat_guidance_strength: 1, tex_slat_guidance_rescale: 0, tex_slat_sampling_steps: 12, tex_slat_rescale_t: 3,
      }, 'Creando la forma', [15, 70]);
      const res = await ejecutar(ctx, c, '/extract_glb', {
        decimation_target: rapida ? 100000 : 250000, texture_size: rapida ? 1024 : 2048,
      }, 'Pintando texturas', [70, 96]);
      return descargar(buscarArchivo(res, ['.glb']), ctx, ctx.token);
    },
  },
  {
    id: 'trellis',
    espacio: 'trellis-community/TRELLIS',
    nombre: 'TRELLIS · comunidad',
    ayuda: 'Muy buena calidad y bastante fiable. Tarda 1-2 min.',
    async generar(ctx, imagen, op) {
      const c = await conectar(this.espacio, ctx.token);
      await c.predict('/start_session', []).catch(() => {});
      const [prep] = await ejecutar(ctx, c, '/preprocess_image', { image: handle_file(imagen) }, 'Quitando el fondo', [5, 15]);
      const rapida = op.calidad === 'rapida';
      const res = await ejecutar(ctx, c, '/generate_and_extract_glb', {
        image: prep, multiimages: [], seed: op.semilla,
        ss_guidance_strength: 7.5, ss_sampling_steps: rapida ? 12 : 25,
        slat_guidance_strength: 3, slat_sampling_steps: rapida ? 12 : 25,
        multiimage_algo: 'stochastic', mesh_simplify: rapida ? 0.96 : 0.9, texture_size: rapida ? 1024 : 2048,
      }, 'Creando la forma y las texturas', [15, 96]);
      return descargar(buscarArchivo(res, ['.glb']), ctx, ctx.token);
    },
  },
  {
    id: 'hunyuan',
    espacio: 'tencent/Hunyuan3D-2',
    nombre: 'Hunyuan3D-2 · Tencent',
    ayuda: 'Formas muy limpias con textura. Bueno para objetos y personajes. Tarda 1-2 min.',
    async generar(ctx, imagen, op) {
      const c = await conectar(this.espacio, ctx.token);
      const res = await ejecutar(ctx, c, '/generation_all', {
        image: handle_file(imagen), steps: op.calidad === 'rapida' ? 30 : 50, guidance_scale: 5.5,
        seed: op.semilla, octree_resolution: op.calidad === 'rapida' ? 256 : 380, check_box_rembg: true,
      }, 'Creando la forma y las texturas', [5, 96]);
      // [modelo blanco, modelo texturizado, html, estadísticas, semilla]
      const tex = Array.isArray(res) && res[1] && buscarArchivo(res[1], ['.glb']);
      return descargar(tex || buscarArchivo(res, ['.glb']), ctx);
    },
  },
  {
    id: 'anigen',
    espacio: 'VAST-AI/AniGen',
    nombre: 'AniGen · Tripo (con esqueleto)',
    ayuda: 'Del equipo de Tripo: crea el modelo YA articulado (esqueleto y pesos), listo para animar. Tarda 2-4 min.',
    async generar(ctx, imagen, op) {
      const c = await conectar(this.espacio, ctx.token);
      await c.predict('/start_session', []).catch(() => {});
      await ejecutar(ctx, c, '/prepare_input_for_generation', { image: handle_file(imagen) }, 'Preparando la imagen', [3, 10]);
      await ejecutar(ctx, c, '/generate_preview', {
        seed: op.semilla, ss_guidance_strength: 7.5, ss_sampling_steps: op.calidad === 'rapida' ? 15 : 25,
        slat_guidance_strength: 3, slat_sampling_steps: op.calidad === 'rapida' ? 15 : 25,
      }, 'Creando forma y esqueleto', [10, 65]);
      const res = await ejecutar(ctx, c, '/extract_glb', {
        texture_size: op.calidad === 'rapida' ? 1024 : 2048, simplify_ratio: 0.95, fill_holes: true,
      }, 'Pintando texturas y pesos', [65, 96]);
      const final = Array.isArray(res) && res[0] ? buscarArchivo(res[0], ['.glb']) : null;
      return descargar(final || buscarArchivo(res, ['.glb']), ctx);
    },
  },
  {
    id: 'sf3d',
    espacio: 'stabilityai/stable-fast-3d',
    nombre: 'Stable Fast 3D · Stability AI',
    ayuda: 'El más rápido (unos segundos). Menos detalle en la parte trasera.',
    async generar(ctx, imagen, op) {
      const c = await conectar(this.espacio, ctx.token);
      const archivo = handle_file(imagen);
      const comunes = { input_image: archivo, foreground_ratio: 0.85, remesh_option: 'None', vertex_count: -1, texture_size: op.calidad === 'rapida' ? 1024 : 2048 };
      // 1.º quita el fondo (deja la imagen recortada en la sesión), 2.º genera.
      await ejecutar(ctx, c, '/run_button', { run_btn: 'Remove Background', ...comunes }, 'Quitando el fondo', [5, 30]);
      const res = await ejecutar(ctx, c, '/run_button', { run_btn: 'Run', ...comunes }, 'Creando el modelo', [30, 96]);
      return descargar(buscarArchivo(res, ['.glb']), ctx, ctx.token);
    },
  },
  {
    id: 'local',
    nombre: 'Relieve local (sin IA, sin internet)',
    ayuda: 'Crea al instante una figura «inflada» a partir de la silueta de la imagen. Funciona sin conexión; ideal para logos, dibujos y fotos con fondo liso.',
    async generar(ctx, imagen, op) {
      ctx.progreso({ etapa: 'Analizando la imagen', porcentaje: 20 });
      const glb = await generarRelieveLocal(imagen, { detalle: op.calidad === 'alta' ? 320 : 200 });
      ctx.progreso({ etapa: 'Listo', porcentaje: 100 });
      return glb;
    },
  },
];

const ORDEN_AUTO = ['trellis2', 'trellis', 'hunyuan', 'sf3d'];

/**
 * Genera un GLB a partir de una imagen.
 * @returns {{glb: Blob, motor: string}}
 */
export async function imagenA3D(ctx, imagen, motorId, opciones) {
  const op = { ...opciones, semilla: opciones.semilla ?? semillaAleatoria() };
  const lista = motorId === 'auto' ? ORDEN_AUTO : [motorId];
  const errores = [];
  for (const id of lista) {
    const motor = MOTORES.find((m) => m.id === id);
    try {
      ctx.progreso({ etapa: `Conectando con ${motor.nombre}`, porcentaje: 2, detalle: '' });
      const glb = await motor.generar({ ...ctx, motor }, imagen, op);
      if (!glb || glb.size < 100) throw new Error('El modelo recibido está vacío');
      return { glb, motor: motor.nombre };
    } catch (e) {
      const err = clasificarError(e);
      if (err.tipo === 'cancelado') throw err;
      errores.push(`${motor.nombre}: ${err.message}`);
      console.warn(`[FORJA 3D] ${motor.nombre} falló`, e);
      if (lista.length > 1) ctx.progreso({ etapa: 'Probando otro motor…', porcentaje: 2, detalle: `${motor.nombre} no respondió` });
    }
  }
  const err = new ErrorMotor(errores.join('\n'), 'fallo');
  err.detalles = errores;
  throw err;
}

// ---------------------------------------------------------------------------
// Texto → imagen (paso previo de «Texto a 3D»)
// ---------------------------------------------------------------------------

const ESTILOS = {
  realista: 'photorealistic product photo',
  juguete: 'cute toy figurine, vinyl toy',
  caricatura: 'stylized cartoon 3D character, Pixar style',
  lowpoly: 'low poly 3D model, flat shading',
  arcilla: 'clay sculpture, handmade',
};

export function construirPrompt(descripcion, estilo) {
  return `${descripcion.trim()}, ${ESTILOS[estilo] ?? ESTILOS.realista}, single object, full body, entire object visible, centered, isolated on a plain white background, soft studio lighting, front three-quarter view, high detail`;
}

const MOTORES_IMAGEN = [
  { espacio: 'black-forest-labs/FLUX.1-schnell', endpoint: '/infer', datos: (p, s) => ({ prompt: p, seed: s, randomize_seed: false, width: 1024, height: 1024, num_inference_steps: 4 }) },
  { espacio: 'black-forest-labs/FLUX.1-dev', endpoint: '/infer', datos: (p, s) => ({ prompt: p, seed: s, randomize_seed: false, width: 1024, height: 1024, guidance_scale: 3.5, num_inference_steps: 24 }) },
];

/** Genera una imagen de referencia a partir de un texto. Devuelve un Blob. */
export async function textoAImagen(ctx, descripcion, estilo, semilla, rango = [1, 25]) {
  const prompt = construirPrompt(descripcion, estilo);
  const s = semilla ?? semillaAleatoria();
  const errores = [];
  for (const m of MOTORES_IMAGEN) {
    try {
      ctx.progreso({ etapa: 'Imaginando el objeto', porcentaje: rango[0], detalle: m.espacio.split('/')[1] });
      const c = await conectar(m.espacio, ctx.token);
      const res = await ejecutar(ctx, c, m.endpoint, m.datos(prompt, s), 'Dibujando la imagen de referencia', rango);
      const archivo = buscarArchivo(res, ['.webp', '.png', '.jpg', '.jpeg']) ?? (res?.[0]?.url ? res[0] : null);
      return await descargar(archivo, ctx, ctx.token);
    } catch (e) {
      const err = clasificarError(e);
      if (err.tipo === 'cancelado') throw err;
      errores.push(`${m.espacio}: ${err.message}`);
      console.warn('[FORJA 3D] texto→imagen falló', m.espacio, e);
    }
  }
  throw new ErrorMotor(`No se pudo generar la imagen a partir del texto.\n${errores.join('\n')}`, 'fallo');
}

// ---------------------------------------------------------------------------
// Multivista, boceto, texturizado y rigging con IA
// ---------------------------------------------------------------------------

/** Varias fotos del mismo objeto (frente obligatorio; espalda, izquierda, derecha opcionales). */
export async function multivistaA3D(ctx, vistas, opciones) {
  const semilla = opciones.semilla ?? semillaAleatoria();
  ctx.progreso({ etapa: 'Conectando con Hunyuan3D-2mv', porcentaje: 2 });
  try {
    const c = await conectar('tencent/Hunyuan3D-2mv', ctx.token);
    const datos = {
      mv_image_front: vistas.frente ? handle_file(vistas.frente) : null,
      mv_image_back: vistas.espalda ? handle_file(vistas.espalda) : null,
      mv_image_left: vistas.izquierda ? handle_file(vistas.izquierda) : null,
      mv_image_right: vistas.derecha ? handle_file(vistas.derecha) : null,
      steps: opciones.calidad === 'rapida' ? 30 : 50, guidance_scale: 5, seed: semilla,
      octree_resolution: opciones.calidad === 'rapida' ? 256 : 380, check_box_rembg: true,
    };
    let res;
    try {
      res = await ejecutar(ctx, c, '/generation_all', datos, 'Uniendo las vistas en 3D', [5, 70]);
    } catch (e) {
      if (clasificarError(e).tipo === 'cancelado') throw e;
      res = await ejecutar(ctx, c, '/shape_generation', datos, 'Uniendo las vistas en 3D', [5, 70]);
    }
    const tex = Array.isArray(res) && res[1] && buscarArchivo(res[1], ['.glb']);
    let glb = await descargar(tex || buscarArchivo(res, ['.glb']), ctx);
    if (!tex && opciones.texturizar !== false && vistas.frente) {
      // La forma sale sin color: la pintamos con la foto frontal.
      try {
        glb = await texturizar(ctx, glb, { imagen: vistas.frente, rango: [70, 98] });
      } catch (e) {
        if (clasificarError(e).tipo === 'cancelado') throw e;
        console.warn('[FORJA 3D] no se pudo texturizar la multivista', e);
      }
    }
    return { glb, motor: 'Hunyuan3D-2mv (multivista)' };
  } catch (e) {
    throw clasificarError(e);
  }
}

/** Boceto (negro sobre blanco) + descripción → forma 3D (TripoSG Scribble), y color opcional. */
export async function bocetoA3D(ctx, dibujo, descripcion, opciones) {
  const semilla = opciones.semilla ?? semillaAleatoria();
  try {
    ctx.progreso({ etapa: 'Conectando con TripoSG Scribble', porcentaje: 2 });
    const c = await conectar('VAST-AI/TripoSG-scribble', ctx.token);
    const archivo = handle_file(dibujo);
    const res = await ejecutar(ctx, c, '/generate_3d', {
      scribble_image_dict: { background: archivo, layers: [], composite: archivo },
      prompt: descripcion || '', scribble_confidence: opciones.fidelidad ?? 0.4, text_confidence: 1.0, seed: semilla,
    }, 'Convirtiendo el dibujo en volumen', [5, opciones.texturizar ? 55 : 96]);
    let glb = await descargar(buscarArchivo(res, ['.glb']), ctx);
    if (opciones.texturizar && descripcion) {
      try {
        glb = await texturizar(ctx, glb, { texto: descripcion, rango: [55, 98] });
      } catch (e) {
        if (clasificarError(e).tipo === 'cancelado') throw e;
        console.warn('[FORJA 3D] no se pudo colorear el boceto', e);
      }
    }
    return { glb, motor: 'TripoSG Scribble · Tripo' };
  } catch (e) {
    throw clasificarError(e);
  }
}

/**
 * Pinta una textura nueva sobre un modelo existente con MV-Adapter (de Tripo):
 * a partir de un texto o de una imagen de referencia.
 */
export async function texturizar(ctx, glb, { texto = '', imagen = null, rango = [3, 97], semilla } = {}) {
  const [ini, fin] = rango;
  const mitad = ini + (fin - ini) * 0.55;
  const espacio = imagen ? 'VAST-AI/MV-Adapter-Img2Texture' : 'VAST-AI/MV-Adapter-Text2Texture';
  try {
    ctx.progreso({ etapa: 'Conectando con MV-Adapter', porcentaje: ini });
    const c = await conectar(espacio, ctx.token);
    await c.predict('/start_session', []).catch(() => {});
    const malla = handle_file(new File([glb], 'modelo.glb', { type: 'model/gltf-binary' }));
    const s = semilla ?? semillaAleatoria();
    const datos = imagen
      ? { mesh_path: malla, prompt: texto || 'high quality', image: handle_file(imagen), seed: s, guidance_scale: 3, num_inference_steps: 25, reference_conditioning_scale: 1 }
      : { mesh_path: malla, prompt: texto, seed: s, guidance_scale: 7, num_inference_steps: 28 };
    const vistas = await ejecutar(ctx, c, '/run_mvadapter', datos, 'Pintando el modelo desde 6 ángulos', [ini, mitad]);
    const res = await ejecutar(ctx, c, '/run_texturing', {
      mesh_path: malla, mv_images: Array.isArray(vistas) ? vistas[0] : vistas,
      uv_unwarp: true, preprocess_mesh: false, uv_size: 2048,
    }, 'Proyectando la textura', [mitad, fin]);
    return descargar(buscarArchivo(res, ['.glb']), ctx);
  } catch (e) {
    throw clasificarError(e);
  }
}

/** Rigging con IA (SkinTokens, sucesor de UniRig, de Tripo): devuelve un GLB con esqueleto y pesos. */
export async function rigConIA(ctx, glb) {
  try {
    ctx.progreso({ etapa: 'Conectando con SkinTokens', porcentaje: 3 });
    const c = await conectar('VAST-AI/SkinTokens', ctx.token);
    const res = await ejecutar(ctx, c, '/run_gradio', {
      files: [handle_file(new File([glb], 'modelo.glb', { type: 'model/gltf-binary' }))],
      top_k: 5, top_p: 0.95, temperature: 1, repetition_penalty: 2, num_beams: 10,
      use_skeleton: false, use_transfer: true, use_postprocess: false,
    }, 'Creando el esqueleto y los pesos', [5, 96]);
    const log = Array.isArray(res) ? String(res[0] ?? '') : '';
    if (log.includes('❌')) throw new ErrorMotor(log.replace('❌', '').trim(), 'fallo');
    return descargar(buscarArchivo(res, ['.glb']), ctx);
  } catch (e) {
    throw clasificarError(e);
  }
}

/**
 * Escena con varios objetos (MIDI-3D, de Tripo): una foto + un recuadro por objeto.
 * @param {Array<[number,number,number,number]>} cajas  [x1, y1, x2, y2] en píxeles de la imagen
 */
export async function escenaA3D(ctx, imagen, cajas, opciones) {
  const semilla = opciones.semilla ?? semillaAleatoria();
  try {
    ctx.progreso({ etapa: 'Conectando con MIDI-3D', porcentaje: 2 });
    const c = await conectar('VAST-AI/MIDI-3D', ctx.token);
    const prompts = { image: handle_file(imagen), points: cajas.map(([x1, y1, x2, y2]) => [x1, y1, 2, x2, y2, 3]) };
    const seg = await ejecutar(ctx, c, '/run_segmentation', { image_prompts: prompts, polygon_refinement: false }, 'Separando los objetos de la foto', [4, 18]);
    const mapa = Array.isArray(seg) ? seg[0] : seg;
    const res = await ejecutar(ctx, c, '/run_generation', {
      rgb_image: prompts, seg_image: mapa, seed: semilla, randomize_seed: false,
      num_inference_steps: opciones.calidad === 'rapida' ? 30 : 50, guidance_scale: 7, do_image_padding: true,
    }, 'Creando la escena en 3D', [18, opciones.texturizar ? 65 : 97]);
    let glb = await descargar(buscarArchivo(res, ['.glb']), ctx);
    if (opciones.texturizar) {
      try {
        glb = await texturizar(ctx, glb, { imagen, rango: [65, 98] });
      } catch (e) {
        if (clasificarError(e).tipo === 'cancelado') throw e;
        console.warn('[FORJA 3D] no se pudo colorear la escena', e);
      }
    }
    return { glb, motor: 'MIDI-3D · Tripo (escena)' };
  } catch (e) {
    throw clasificarError(e);
  }
}
