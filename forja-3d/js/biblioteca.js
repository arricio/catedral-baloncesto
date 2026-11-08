// Biblioteca local de modelos en IndexedDB (solo en este navegador).
const BD = 'forja-3d';
const ALMACEN = 'modelos';

let conexion = null;
function abrir() {
  if (conexion) return conexion;
  conexion = new Promise((ok, mal) => {
    const pet = indexedDB.open(BD, 1);
    pet.onupgradeneeded = () => {
      const db = pet.result;
      if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN, { keyPath: 'id' });
    };
    pet.onsuccess = () => ok(pet.result);
    pet.onerror = () => { conexion = null; mal(pet.error); };
  });
  return conexion;
}

async function operar(modo, fn) {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const tx = db.transaction(ALMACEN, modo);
    const pet = fn(tx.objectStore(ALMACEN));
    tx.oncomplete = () => ok(pet?.result);
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error);
  });
}

/** @param {{nombre:string, motor:string, origen:string, prompt?:string, glb:Blob, miniatura:Blob}} m */
export async function guardarModelo(m) {
  const registro = { id: m.id ?? crypto.randomUUID(), fecha: Date.now(), ...m };
  await operar('readwrite', (s) => s.put(registro));
  return registro;
}

export async function listarModelos() {
  const todos = (await operar('readonly', (s) => s.getAll())) ?? [];
  return todos.sort((a, b) => b.fecha - a.fecha);
}

export const obtenerModelo = (id) => operar('readonly', (s) => s.get(id));
export const borrarModelo = (id) => operar('readwrite', (s) => s.delete(id));
