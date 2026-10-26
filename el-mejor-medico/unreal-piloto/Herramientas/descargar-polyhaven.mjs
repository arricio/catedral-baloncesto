// Descarga muebles y materiales gratuitos (licencia CC0, sin cuenta) de Poly Haven para la consulta.
// Uso: node Herramientas\descargar-polyhaven.mjs   (guarda en Fuentes/PolyHaven/<id>/ con su LICENCIA.txt)
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'Fuentes', 'PolyHaven');
const MODELOS = ['metal_office_desk', 'modern_arm_chair_01', 'GreenChair_01', 'dining_chair_02', 'SchoolChair_01', 'drawer_cabinet', 'Shelf_01', 'potted_plant_01', 'potted_plant_02',
  'classic_laptop', 'clipboard', 'office_notepads', 'wall_clock', 'modern_ceiling_lamp_01', 'book_encyclopedia_set_01', 'decorative_book_set_01'];
const TEXTURAS = ['terrazzo_tiles', 'floor_tiles_06', 'plastered_wall_04', 'ceiling_interior', 'painted_concrete'];
const RES = '2k';

async function bajar(url, destino) {
  if (existsSync(destino)) return;
  mkdirSync(dirname(destino), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
}

for (const [tipo, lista] of [['modelo', MODELOS], ['textura', TEXTURAS]]) {
  for (const id of lista) {
    const info = await (await fetch(`https://api.polyhaven.com/info/${id}`)).json();
    const archivos = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
    const dir = join(raiz, id);
    if (tipo === 'modelo') {
      const g = archivos.gltf?.[RES]?.gltf || archivos.gltf?.['1k']?.gltf;
      if (!g) { console.log(`(sin glTF) ${id}`); continue; }
      await bajar(g.url, join(dir, `${id}.gltf`));
      for (const [ruta, inc] of Object.entries(g.include || {})) await bajar(inc.url, join(dir, ruta));
    } else {
      for (const mapa of ['Diffuse', 'nor_gl', 'Rough', 'arm', 'AO']) {
        const f = archivos[mapa]?.[RES]?.jpg || archivos[mapa]?.[RES]?.png;
        if (f) await bajar(f.url, join(dir, `${id}_${mapa}.${f.url.split('.').pop()}`));
      }
    }
    writeFileSync(join(dir, 'LICENCIA.txt'), `${info.name} — Poly Haven (https://polyhaven.com/a/${id})\nAutores: ${Object.keys(info.authors || {}).join(', ')}\nLicencia: CC0 1.0 (dominio público), https://polyhaven.com/license\n`);
    console.log(`${tipo} ${id} ✓`);
  }
}
