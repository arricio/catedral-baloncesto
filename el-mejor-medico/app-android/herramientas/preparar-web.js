// Copia el juego (la carpeta de arriba) a www/, que es lo que Capacitor mete en el APK.
// El juego no se duplica en el repositorio: www/ se genera en cada compilación y está en .gitignore.
const fs = require('fs');
const path = require('path');

const JUEGO = path.resolve(__dirname, '..', '..');
const WWW = path.resolve(__dirname, '..', 'www');
const INCLUIR = ['index.html', 'manifest.webmanifest', 'favicon.svg', 'pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png', 'apple-touch-icon.png', 'og-image.jpg', 'js', 'vendor', 'modelos'];

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });
for (const n of INCLUIR) {
  const o = path.join(JUEGO, n);
  if (!fs.existsSync(o)) { console.warn('Falta', n); continue; }
  fs.cpSync(o, path.join(WWW, n), { recursive: true });
}
// Puente de Capacitor y los módulos nativos del juego (sólo en el APK; la versión web no cambia)
fs.copyFileSync(path.resolve(__dirname, '..', 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js'), path.join(WWW, 'vendor', 'capacitor.js'));
const PUENTE = `<script src="vendor/capacitor.js"></script>
<script>if (window.Capacitor && Capacitor.isNativePlatform()) for (const n of ['IALocal', 'VozNativa', 'DictadoNativo']) Capacitor.Plugins[n] = Capacitor.Plugins[n] || Capacitor.registerPlugin(n);</script>
`;
const indice = path.join(WWW, 'index.html');
let html = fs.readFileSync(indice, 'utf8');
if (!html.includes('<head>')) throw new Error('index.html sin <head>');
html = html.replace('<head>', '<head>\n' + PUENTE);
fs.writeFileSync(indice, html);
console.log('Juego copiado a', WWW);
