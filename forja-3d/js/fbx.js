// Exportador FBX binario (versión 7.4) para mallas estáticas: geometría, normales,
// UV, colores de vértice, material y textura incrustada. Compatible con Blender,
// Unity, Unreal y la mayoría de programas 3D.
import * as THREE from 'three';

const enc = new TextEncoder();

class Escritor {
  constructor() { this.partes = []; this.longitud = 0; }
  bytes(u8) { this.partes.push(u8); this.longitud += u8.length; }
  u8(v) { this.bytes(new Uint8Array([v])); }
  u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); this.bytes(b); }
  resultado() {
    const out = new Uint8Array(this.longitud);
    let o = 0;
    for (const p of this.partes) { out.set(p, o); o += p.length; }
    return out;
  }
}

// Propiedades tipadas
const I = (v) => ({ t: 'I', v });
const L = (v) => ({ t: 'L', v });
const D = (v) => ({ t: 'D', v });
const S = (v) => ({ t: 'S', v });
const C = (v) => ({ t: 'C', v });
const R = (v) => ({ t: 'R', v });
const dArr = (v) => ({ t: 'd', v });
const iArr = (v) => ({ t: 'i', v });

function codificarPropiedad(p) {
  const w = new Escritor();
  w.bytes(enc.encode(p.t));
  const dv = (n) => { const b = new Uint8Array(n); return [b, new DataView(b.buffer)]; };
  switch (p.t) {
    case 'C': w.u8(p.v ? 1 : 0); break;
    case 'I': { const [b, d] = dv(4); d.setInt32(0, p.v, true); w.bytes(b); break; }
    case 'L': { const [b, d] = dv(8); d.setBigInt64(0, BigInt(p.v), true); w.bytes(b); break; }
    case 'D': { const [b, d] = dv(8); d.setFloat64(0, p.v, true); w.bytes(b); break; }
    case 'S': case 'R': {
      const datos = p.t === 'S' ? enc.encode(p.v) : p.v;
      w.u32(datos.length); w.bytes(datos); break;
    }
    case 'd': case 'i': {
      const tam = p.t === 'd' ? 8 : 4;
      const [b, d] = dv(p.v.length * tam);
      p.v.forEach((x, k) => (p.t === 'd' ? d.setFloat64(k * tam, x, true) : d.setInt32(k * tam, x, true)));
      w.u32(p.v.length); w.u32(0); w.u32(b.length); w.bytes(b); break;
    }
    default: throw new Error(`Tipo FBX desconocido ${p.t}`);
  }
  return w.resultado();
}

/** Nodo: [nombre, [propiedades], [hijos]] */
const N = (nombre, props = [], hijos = []) => ({ nombre, props, hijos });

function escribirNodo(w, nodo) {
  const props = nodo.props.map(codificarPropiedad);
  const lprops = props.reduce((s, p) => s + p.length, 0);
  const nombre = enc.encode(nodo.nombre);
  const inicio = w.longitud;
  const posFin = w.partes.length;
  w.u32(0); // fin (se rellena después)
  w.u32(props.length);
  w.u32(lprops);
  w.u8(nombre.length);
  w.bytes(nombre);
  props.forEach((p) => w.bytes(p));
  if (nodo.hijos.length || !nodo.props.length) {
    nodo.hijos.forEach((h) => escribirNodo(w, h));
    w.bytes(new Uint8Array(13)); // registro nulo
  }
  void inicio;
  const fin = w.longitud;
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, fin, true);
  w.partes[posFin] = b;
}

const P70 = (lista) => N('Properties70', [], lista.map((p) => N('P', p)));

let siguienteId = 1000000;
const nuevoId = () => ++siguienteId;

async function pngDeTextura(tex) {
  const img = tex?.image;
  if (!img || !img.width) return null;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  // FBX usa UV con origen abajo-izquierda: si la textura no está volteada, la volteamos.
  if (!tex.flipY) { g.translate(0, c.height); g.scale(1, -1); }
  g.drawImage(img, 0, 0);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * @param {THREE.Object3D} objeto  (mallas con su transformación del mundo)
 */
export async function exportarFBX(objeto, { nombre = 'modelo' } = {}) {
  objeto.updateMatrixWorld(true);
  const objetos = [];
  const conexiones = [];
  const mallas = [];
  objeto.traverse((o) => { if (o.isMesh && !o.userData.ayuda) mallas.push(o); });
  let k = 0;
  for (const m of mallas) {
    k++;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, col = g.attributes.color;
    const n = pos.count;
    const vertices = new Array(n * 3);
    for (let i = 0; i < n; i++) { vertices[i * 3] = pos.getX(i); vertices[i * 3 + 1] = pos.getY(i); vertices[i * 3 + 2] = pos.getZ(i); }
    const indices = new Array(n);
    for (let i = 0; i < n; i++) indices[i] = i % 3 === 2 ? -(i + 1) : i; // fin de polígono = ~i
    const normales = new Array(n * 3);
    for (let i = 0; i < n; i++) { normales[i * 3] = nor.getX(i); normales[i * 3 + 1] = nor.getY(i); normales[i * 3 + 2] = nor.getZ(i); }

    const capas = [N('LayerElement', [], [N('Type', [S('LayerElementNormal')]), N('TypedIndex', [I(0)])])];
    const hijosGeo = [
      N('GeometryVersion', [I(124)]),
      N('Vertices', [dArr(vertices)]),
      N('PolygonVertexIndex', [iArr(indices)]),
      N('LayerElementNormal', [I(0)], [
        N('Version', [I(101)]), N('Name', [S('')]),
        N('MappingInformationType', [S('ByPolygonVertex')]), N('ReferenceInformationType', [S('Direct')]),
        N('Normals', [dArr(normales)]),
      ]),
    ];
    if (uv) {
      const uvs = new Array(n * 2), uvi = new Array(n);
      for (let i = 0; i < n; i++) { uvs[i * 2] = uv.getX(i); uvs[i * 2 + 1] = 1 - uv.getY(i); uvi[i] = i; }
      hijosGeo.push(N('LayerElementUV', [I(0)], [
        N('Version', [I(101)]), N('Name', [S('UVMap')]),
        N('MappingInformationType', [S('ByPolygonVertex')]), N('ReferenceInformationType', [S('IndexToDirect')]),
        N('UV', [dArr(uvs)]), N('UVIndex', [iArr(uvi)]),
      ]));
      capas.push(N('LayerElement', [], [N('Type', [S('LayerElementUV')]), N('TypedIndex', [I(0)])]));
    }
    if (col) {
      const cs = new Array(n * 4), ci = new Array(n);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        c.setRGB(col.getX(i), col.getY(i), col.getZ(i), THREE.LinearSRGBColorSpace);
        const s = c.clone().convertLinearToSRGB();
        cs[i * 4] = s.r; cs[i * 4 + 1] = s.g; cs[i * 4 + 2] = s.b; cs[i * 4 + 3] = 1; ci[i] = i;
      }
      hijosGeo.push(N('LayerElementColor', [I(0)], [
        N('Version', [I(101)]), N('Name', [S('Col')]),
        N('MappingInformationType', [S('ByPolygonVertex')]), N('ReferenceInformationType', [S('IndexToDirect')]),
        N('Colors', [dArr(cs)]), N('ColorIndex', [iArr(ci)]),
      ]));
      capas.push(N('LayerElement', [], [N('Type', [S('LayerElementColor')]), N('TypedIndex', [I(0)])]));
    }
    hijosGeo.push(N('LayerElementMaterial', [I(0)], [
      N('Version', [I(101)]), N('Name', [S('')]),
      N('MappingInformationType', [S('AllSame')]), N('ReferenceInformationType', [S('IndexToDirect')]),
      N('Materials', [iArr([0])]),
    ]));
    capas.push(N('LayerElement', [], [N('Type', [S('LayerElementMaterial')]), N('TypedIndex', [I(0)])]));
    hijosGeo.push(N('Layer', [I(0)], [N('Version', [I(100)]), ...capas]));

    const idGeo = nuevoId(), idModelo = nuevoId(), idMat = nuevoId();
    const nm = `${nombre}_${k}`;
    objetos.push(N('Geometry', [L(idGeo), S(`${nm}\x00\x01Geometry`), S('Mesh')], hijosGeo));
    objetos.push(N('Model', [L(idModelo), S(`${nm}\x00\x01Model`), S('Mesh')], [
      N('Version', [I(232)]),
      P70([[S('DefaultAttributeIndex'), S('int'), S('Integer'), S(''), I(0)]]),
      N('Shading', [C(true)]), N('Culling', [S('CullingOff')]),
    ]));
    const mat = Array.isArray(m.material) ? m.material[0] : m.material;
    const color = mat?.color ?? new THREE.Color(1, 1, 1);
    const cs = color.clone().convertLinearToSRGB();
    objetos.push(N('Material', [L(idMat), S(`${nm}_mat\x00\x01Material`), S('')], [
      N('Version', [I(102)]), N('ShadingModel', [S('phong')]), N('MultiLayer', [I(0)]),
      P70([
        [S('DiffuseColor'), S('Color'), S(''), S('A'), D(cs.r), D(cs.g), D(cs.b)],
        [S('Shininess'), S('double'), S('Number'), S(''), D(20 * (1 - (mat?.roughness ?? 0.5)))],
        [S('Opacity'), S('double'), S('Number'), S(''), D(mat?.opacity ?? 1)],
      ]),
    ]));
    conexiones.push(['OO', idModelo, 0], ['OO', idGeo, idModelo], ['OO', idMat, idModelo]);

    const png = mat?.map ? await pngDeTextura(mat.map) : null;
    if (png) {
      const idTex = nuevoId(), idVid = nuevoId();
      const archivo = `${nm}_textura.png`;
      objetos.push(N('Video', [L(idVid), S(`${nm}_tex\x00\x01Video`), S('Clip')], [
        N('Type', [S('Clip')]),
        P70([[S('Path'), S('KString'), S('XRefUrl'), S(''), S(archivo)]]),
        N('UseMipMap', [I(0)]), N('Filename', [S(archivo)]), N('RelativeFilename', [S(archivo)]),
        N('Content', [R(png)]),
      ]));
      objetos.push(N('Texture', [L(idTex), S(`${nm}_tex\x00\x01Texture`), S('')], [
        N('Type', [S('TextureVideoClip')]), N('Version', [I(202)]),
        N('TextureName', [S(`${nm}_tex\x00\x01Texture`)]),
        N('Media', [S(`${nm}_tex\x00\x01Video`)]),
        N('FileName', [S(archivo)]), N('RelativeFilename', [S(archivo)]),
        N('ModelUVTranslation', [D(0), D(0)]), N('ModelUVScaling', [D(1), D(1)]),
        N('Texture_Alpha_Source', [S('None')]), N('Cropping', [I(0), I(0), I(0), I(0)]),
      ]));
      conexiones.push(['OP', idTex, idMat, 'DiffuseColor'], ['OO', idVid, idTex]);
    }
    g.dispose();
  }

  const cuenta = (tipo) => objetos.filter((o) => o.nombre === tipo).length;
  const fecha = new Date();
  const raiz = [
    N('FBXHeaderExtension', [], [
      N('FBXHeaderVersion', [I(1003)]), N('FBXVersion', [I(7400)]),
      N('CreationTimeStamp', [], [
        N('Version', [I(1000)]), N('Year', [I(fecha.getFullYear())]), N('Month', [I(fecha.getMonth() + 1)]),
        N('Day', [I(fecha.getDate())]), N('Hour', [I(fecha.getHours())]), N('Minute', [I(fecha.getMinutes())]),
        N('Second', [I(fecha.getSeconds())]), N('Millisecond', [I(0)]),
      ]),
      N('Creator', [S('FORJA 3D')]),
    ]),
    N('GlobalSettings', [], [
      N('Version', [I(1000)]),
      P70([
        [S('UpAxis'), S('int'), S('Integer'), S(''), I(1)], [S('UpAxisSign'), S('int'), S('Integer'), S(''), I(1)],
        [S('FrontAxis'), S('int'), S('Integer'), S(''), I(2)], [S('FrontAxisSign'), S('int'), S('Integer'), S(''), I(1)],
        [S('CoordAxis'), S('int'), S('Integer'), S(''), I(0)], [S('CoordAxisSign'), S('int'), S('Integer'), S(''), I(1)],
        [S('UnitScaleFactor'), S('double'), S('Number'), S(''), D(0.1)],
        [S('OriginalUnitScaleFactor'), S('double'), S('Number'), S(''), D(0.1)],
      ]),
    ]),
    N('Documents', [], [N('Count', [I(1)]), N('Document', [L(nuevoId()), S(''), S('Scene')], [N('RootNode', [L(0)])])]),
    N('References'),
    N('Definitions', [], [
      N('Version', [I(100)]), N('Count', [I(objetos.length + 1)]),
      N('ObjectType', [S('GlobalSettings')], [N('Count', [I(1)])]),
      ...['Model', 'Geometry', 'Material', 'Texture', 'Video'].filter((t) => cuenta(t)).map((t) => N('ObjectType', [S(t)], [N('Count', [I(cuenta(t))])])),
    ]),
    N('Objects', [], objetos),
    N('Connections', [], conexiones.map(([tipo, a, b, prop]) => N('C', prop ? [S(tipo), L(a), L(b), S(prop)] : [S(tipo), L(a), L(b)]))),
  ];

  const w = new Escritor();
  w.bytes(enc.encode('Kaydara FBX Binary  \x00'));
  w.bytes(new Uint8Array([0x1a, 0x00]));
  w.u32(7400);
  for (const nodo of raiz) escribirNodo(w, nodo);
  w.bytes(new Uint8Array(13));
  // Pie estándar.
  w.bytes(new Uint8Array([0xfa, 0xbc, 0xab, 0x09, 0xd0, 0xc8, 0xd4, 0x66, 0xb1, 0x76, 0xfb, 0x83, 0x1c, 0xf7, 0x26, 0x7e]));
  w.bytes(new Uint8Array(4));
  const relleno = (16 - (w.longitud % 16)) % 16;
  w.bytes(new Uint8Array(relleno || 16));
  w.u32(7400);
  w.bytes(new Uint8Array(120));
  w.bytes(new Uint8Array([0xf8, 0x5a, 0x8c, 0x6a, 0xde, 0xf5, 0xd9, 0x7e, 0xec, 0xe9, 0x0c, 0xe3, 0x75, 0x8f, 0x29, 0x0b]));
  return new Blob([w.resultado()], { type: 'application/octet-stream' });
}
