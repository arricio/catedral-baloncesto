// Motor local sin IA: convierte la silueta de una imagen en una figura «inflada»
// (frontal con el color de la imagen y trasera suave), cerrada para poder imprimirla.
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

async function cargarImagen(blob) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(blob); } catch { /* sigue con <img> */ }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Calcula la máscara del objeto: canal alfa o, si no hay, fondo por relleno desde los bordes. */
function calcularMascara(px, w, h) {
  const n = w * h;
  const mascara = new Uint8Array(n);
  let transparentes = 0;
  for (let i = 0; i < n; i++) if (px[i * 4 + 3] < 128) transparentes++;
  if (transparentes > n * 0.02) {
    for (let i = 0; i < n; i++) mascara[i] = px[i * 4 + 3] >= 128 ? 1 : 0;
    return mascara;
  }
  // Color de fondo: mediana de los píxeles del borde.
  const borde = [];
  for (let x = 0; x < w; x++) { borde.push(x, (h - 1) * w + x); }
  for (let y = 0; y < h; y++) { borde.push(y * w, y * w + w - 1); }
  const med = [0, 1, 2].map((c) => {
    const v = borde.map((i) => px[i * 4 + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  const umbral = 42 * 42;
  const esFondo = (i) => {
    const dr = px[i * 4] - med[0], dg = px[i * 4 + 1] - med[1], db = px[i * 4 + 2] - med[2];
    return dr * dr + dg * dg + db * db < umbral;
  };
  // Relleno desde los bordes: solo es fondo lo conectado con el exterior.
  const fondo = new Uint8Array(n);
  const pila = borde.filter(esFondo);
  for (const i of pila) fondo[i] = 1;
  while (pila.length) {
    const i = pila.pop();
    const x = i % w, y = (i / w) | 0;
    const vecinos = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
    for (const j of vecinos) {
      if (j >= 0 && !fondo[j] && esFondo(j)) { fondo[j] = 1; pila.push(j); }
    }
  }
  let dentro = 0;
  for (let i = 0; i < n; i++) { mascara[i] = fondo[i] ? 0 : 1; dentro += mascara[i]; }
  // Si no se distingue objeto y fondo, se usa la imagen entera (placa en relieve).
  if (dentro < n * 0.03) mascara.fill(1);
  return mascara;
}

/** Transformada de distancia (chaflán 3-4) dentro de la máscara. */
function distancia(mascara, w, h) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = mascara[i] ? INF : 0;
  const v = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!d[i]) continue;
    d[i] = Math.min(d[i], v(x - 1, y) + 3, v(x, y - 1) + 3, v(x - 1, y - 1) + 4, v(x + 1, y - 1) + 4);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!d[i]) continue;
    d[i] = Math.min(d[i], v(x + 1, y) + 3, v(x, y + 1) + 3, v(x + 1, y + 1) + 4, v(x - 1, y + 1) + 4);
  }
  for (let i = 0; i < w * h; i++) d[i] /= 3;
  return d;
}

const aLineal = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };

/**
 * Construye la malla en memoria (útil también para pruebas).
 * @returns {THREE.Mesh}
 */
export function construirMallaRelieve(px, w, h) {
  const mascara = calcularMascara(px, w, h);
  const dist = distancia(mascara, w, h);
  let dmax = 1;
  for (let i = 0; i < w * h; i++) dmax = Math.max(dmax, dist[i]);

  const escala = 1 / Math.max(w, h);
  const grosor = Math.min(0.22, Math.max(0.08, (dmax * escala) * 0.9));

  const enMascara = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mascara[y * w + x] === 1;

  // Perfil circular (como un cojín) suavizado para eliminar las crestas de la distancia de chaflán.
  let perfiles = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!mascara[i]) continue;
    const t = Math.min(1, dist[i] / dmax);
    perfiles[i] = Math.sqrt(1 - (1 - t) * (1 - t));
  }
  const pasadas = Math.max(2, Math.round(Math.max(w, h) / 40));
  for (let k = 0; k < pasadas; k++) {
    const sig = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mascara[i]) continue;
      let suma = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) suma += perfiles[yy * w + xx];
      }
      sig[i] = suma / 9;
    }
    perfiles = sig;
  }
  let pmax = 1e-6;
  for (let i = 0; i < w * h; i++) pmax = Math.max(pmax, perfiles[i]);
  const posiciones = [];
  const colores = [];
  const frontal = new Int32Array(w * h).fill(-1);
  const trasero = new Int32Array(w * h).fill(-1);

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!mascara[i]) continue;
    let esBorde = false;
    for (let dy = -1; dy <= 1 && !esBorde; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && !enMascara(x + dx, y + dy)) { esBorde = true; break; }
    }
    const perfil = esBorde ? 0 : perfiles[i] / pmax;
    const lum = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255;
    const zf = esBorde ? 0 : grosor * perfil * (0.96 + 0.04 * lum);
    const zb = esBorde ? 0 : -grosor * 0.75 * perfil;
    const X = (x - w / 2) * escala;
    const Y = (h / 2 - y) * escala;
    const r = aLineal(px[i * 4]), g = aLineal(px[i * 4 + 1]), b = aLineal(px[i * 4 + 2]);
    frontal[i] = posiciones.length / 3;
    posiciones.push(X, Y, zf); colores.push(r, g, b);
    if (esBorde) {
      trasero[i] = frontal[i];
    } else {
      trasero[i] = posiciones.length / 3;
      posiciones.push(X, Y, zb); colores.push(r * 0.85, g * 0.85, b * 0.85);
    }
  }

  const indices = [];
  const tri = (capa, a, b, c, invertir) => {
    if (invertir) indices.push(capa[a], capa[c], capa[b]);
    else indices.push(capa[a], capa[b], capa[c]);
  };
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const a = y * w + x, b = a + 1, c = a + w, d = c + 1; // a b / c d
    const ma = mascara[a], mb = mascara[b], mc = mascara[c], md = mascara[d];
    const suma = ma + mb + mc + md;
    if (suma < 3) continue;
    const caras = [];
    if (suma === 4) caras.push([a, c, b], [b, c, d]);
    else if (!ma) caras.push([b, c, d]);
    else if (!mb) caras.push([a, c, d]);
    else if (!mc) caras.push([a, d, b]);
    else caras.push([a, c, b]);
    for (const [p, q, r] of caras) {
      tri(frontal, p, q, r, false);
      tri(trasero, p, q, r, true);
    }
  }

  // Suavizado laplaciano: quita los escalones de píxel del contorno y las ondas cercanas al borde.
  const nv = posiciones.length / 3;
  const esContorno = new Uint8Array(nv);
  for (let i = 0; i < w * h; i++) if (frontal[i] >= 0 && frontal[i] === trasero[i]) esContorno[frontal[i]] = 1;
  const vecinos = Array.from({ length: nv }, () => []);
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indices[t + k], b = indices[t + ((k + 1) % 3)];
      // El contorno solo se suaviza con el contorno; el interior, con todos sus vecinos.
      if (esContorno[a] === esContorno[b] || !esContorno[a]) vecinos[a].push(b);
      if (esContorno[a] === esContorno[b] || !esContorno[b]) vecinos[b].push(a);
    }
  }
  for (let it = 0; it < 6; it++) {
    const copia = posiciones.slice();
    for (let v = 0; v < nv; v++) {
      const vs = vecinos[v];
      if (vs.length < 2) continue;
      let sx = 0, sy = 0, sz = 0;
      for (const u of vs) { sx += copia[u * 3]; sy += copia[u * 3 + 1]; sz += copia[u * 3 + 2]; }
      posiciones[v * 3] = copia[v * 3] * 0.5 + (sx / vs.length) * 0.5;
      posiciones[v * 3 + 1] = copia[v * 3 + 1] * 0.5 + (sy / vs.length) * 0.5;
      if (!esContorno[v]) posiciones[v * 3 + 2] = copia[v * 3 + 2] * 0.5 + (sz / vs.length) * 0.5;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0 });
  const malla = new THREE.Mesh(geo, mat);
  malla.name = 'relieve';
  return malla;
}

/** Imagen (Blob) → GLB (Blob). */
export async function generarRelieveLocal(blob, { detalle = 140 } = {}) {
  const img = await cargarImagen(blob);
  const k = detalle / Math.max(img.width, img.height);
  const w = Math.max(8, Math.round(img.width * k));
  const h = Math.max(8, Math.round(img.height * k));
  const lienzo = document.createElement('canvas');
  lienzo.width = w; lienzo.height = h;
  const c2d = lienzo.getContext('2d', { willReadFrequently: true });
  c2d.drawImage(img, 0, 0, w, h);
  const { data } = c2d.getImageData(0, 0, w, h);
  const malla = construirMallaRelieve(data, w, h);
  const escena = new THREE.Scene();
  escena.add(malla);
  const binario = await new GLTFExporter().parseAsync(escena, { binary: true });
  malla.geometry.dispose();
  return new Blob([binario], { type: 'model/gltf-binary' });
}
