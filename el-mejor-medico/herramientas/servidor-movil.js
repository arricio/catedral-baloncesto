// Servidor para jugar desde el móvil con la IA del portátil, por la wifi de casa.
// - Sirve el juego a la red local (http://IP-del-portátil:8080).
// - Hace de puente hacia el Ollama del portátil en /ollama/…, así el móvil usa la IA
//   sin abrir Ollama a la red (Ollama sigue escuchando sólo en este ordenador).
// Sólo usa Node, sin dependencias. Uso: node herramientas\servidor-movil.js [puerto]
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const RAIZ = path.resolve(__dirname, '..');
const PUERTO = +(process.argv[2] || process.env.PUERTO || 8080);
const OLLAMA = { host: '127.0.0.1', port: 11434 };
// sólo lo que necesita el juego: el móvil no puede descargar ni borrar modelos
const RUTAS_IA = ['/api/tags', '/api/chat', '/api/version', '/v1/chat/completions'];
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.txt': 'text/plain; charset=utf-8',
};

function puenteIA(req, res, ruta) {
  if (!RUTAS_IA.includes(ruta)) { res.writeHead(403); return res.end('Ruta no permitida'); }
  const ida = http.request({ ...OLLAMA, path: ruta, method: req.method, headers: { 'content-type': req.headers['content-type'] || 'application/json' } }, (r) => {
    res.writeHead(r.statusCode, { 'content-type': r.headers['content-type'] || 'application/json', 'cache-control': 'no-store' });
    r.pipe(res);
  });
  ida.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Ollama no está en marcha en el portátil'); });
  req.pipe(ida);
}

function archivo(req, res, ruta) {
  let f = path.normalize(path.join(RAIZ, decodeURIComponent(ruta)));
  if (!f.startsWith(RAIZ) || /[\\/](pruebas|herramientas|unreal-piloto|app-android)([\\/]|$)/.test(f.slice(RAIZ.length))) { res.writeHead(404); return res.end(); }
  if (ruta.endsWith('/')) f = path.join(f, 'index.html');
  fs.stat(f, (e, st) => {
    if (e || !st.isFile()) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(f).toLowerCase()] || 'application/octet-stream', 'content-length': st.size, 'cache-control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(f).pipe(res);
  });
}

const servidor = http.createServer((req, res) => {
  const ruta = new URL(req.url, 'http://x').pathname;
  if (ruta === '/ollama' || ruta.startsWith('/ollama/')) return puenteIA(req, res, ruta.slice(7) || '/');
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  archivo(req, res, ruta);
});

function direcciones() {
  const l = [];
  for (const [nombre, lista] of Object.entries(os.networkInterfaces()))
    for (const d of lista || []) if (d.family === 'IPv4' && !d.internal && !d.address.startsWith('169.254.')) l.push({ nombre, ip: d.address });
  return l;
}

function comprobarOllama() {
  return new Promise((ok) => {
    const r = http.get({ ...OLLAMA, path: '/api/tags', timeout: 2000 }, (x) => { let t = ''; x.on('data', c => t += c); x.on('end', () => { try { ok(JSON.parse(t).models.map(m => m.name)); } catch (e) { ok(null); } }); });
    r.on('error', () => ok(null)); r.on('timeout', () => { r.destroy(); ok(null); });
  });
}

servidor.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `El puerto ${PUERTO} ya está en uso. ¿Está el servidor abierto en otra ventana?` : e.message);
  process.exit(1);
});
servidor.listen(PUERTO, '0.0.0.0', async () => {
  const modelos = await comprobarOllama();
  console.log('\n  EL MEJOR MÉDICO · servidor para el móvil\n');
  if (modelos && modelos.length) console.log(`  IA del portátil: lista (${modelos.join(', ')})`);
  else if (modelos) console.log('  AVISO: Ollama funciona pero no tiene ningún modelo. Ejecuta: ollama pull qwen2.5:3b');
  else console.log('  AVISO: Ollama no está en marcha. Ábrelo desde el menú Inicio; sin él, los pacientes usarán las respuestas predefinidas.');
  console.log('\n  En el móvil (conectado a la misma wifi), abre Chrome y escribe:');
  for (const d of direcciones()) console.log(`      http://${d.ip}:${PUERTO}/      (${d.nombre})`);
  console.log(`\n  En este portátil: http://localhost:${PUERTO}/`);
  console.log('\n  Deja esta ventana abierta mientras juegas. Para cerrar el servidor: Ctrl+C\n');
});
