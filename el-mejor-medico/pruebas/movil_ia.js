// El móvil usando la IA del portátil por la wifi (herramientas/servidor-movil.js).
// Arranca el servidor en el puerto 8090, abre el juego por la IP de red del portátil con un navegador
// de móvil simulado y BLOQUEA localhost:11434 (en el móvil, «localhost» es el propio móvil): así la IA
// sólo puede llegar por el puente /ollama del servidor, como en el Xiaomi.
// Requisitos: Ollama en marcha en este portátil con un modelo.
// No sustituye a la prueba en el móvil real (la wifi, el cortafuegos de Windows y Chrome de Android).
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const turnos = require('./turnos.js');
const S = process.argv[2] || '.';
const resultados = [];
const comprobar = (nombre, ok, detalle = '') => { resultados.push({ nombre, ok: !!ok }); console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ` · ${detalle}` : ''}`); };

const ip = Object.values(os.networkInterfaces()).flat().find(d => d && d.family === 'IPv4' && !d.internal && !d.address.startsWith('169.254.'))?.address;
const BASE = `http://${ip}:8090`;

(async () => {
  if (!ip) { console.log('FALLO no hay red local'); process.exitCode = 1; return; }
  const srv = spawn(process.execPath, [path.join(__dirname, '..', 'herramientas', 'servidor-movil.js'), '8090'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let salida = ''; srv.stdout.on('data', d => salida += d); srv.stderr.on('data', d => salida += d);
  await new Promise(r => { const t = setInterval(() => { if (salida.includes('Ctrl+C')) { clearInterval(t); r(); } }, 100); setTimeout(r, 8000); });
  console.log(salida.trim().split('\n').map(l => '   | ' + l).join('\n'));
  comprobar('el servidor muestra la dirección para el móvil', salida.includes(`http://${ip}:8090/`), `${BASE}/`);
  comprobar('el servidor ve la IA del portátil', /IA del portátil: lista/.test(salida));

  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'es-ES' });
    // en el móvil no hay Ollama en «localhost»
    let bloqueadas = 0;
    await ctx.route(/^http:\/\/(localhost|127\.0\.0\.1):11434\//, r => { bloqueadas++; r.abort('connectionrefused'); });
    const pg = await ctx.newPage();
    pg.on('pageerror', e => console.log('ERR', e.message));

    const r403 = await pg.request.post(`${BASE}/ollama/api/pull`, { data: { name: 'x' } });
    comprobar('el móvil no puede descargar ni borrar modelos por el puente', r403.status() === 403, `estado ${r403.status()}`);
    const r404 = await pg.request.get(`${BASE}/pruebas/turnos.js`);
    comprobar('el servidor no enseña las pruebas ni las herramientas', r404.status() === 404);

    await pg.goto(`${BASE}/index.html?edad=40&sexo=m`);
    await pg.waitForSelector('#inicio.on', { timeout: 30000 });
    await pg.evaluate(() => window.__juego.mundo.ponerCalidad('baja'));
    await pg.click('#b-nueva'); await pg.click('#cr-ok');
    await pg.evaluate(() => { window.__juego.G.ajustes.voz = false; });
    await pg.click('#int-ok');
    await pg.waitForSelector('#ch-sug:not([hidden])', { timeout: 30000 });
    await pg.waitForFunction(() => window.__juego.G.ajustes.ia.modo === 'ollama', null, { timeout: 15000 }).catch(() => {});
    const ia = await pg.evaluate(() => ({ ...window.__juego.G.ajustes.ia }));
    comprobar('el juego del móvil encuentra solo la IA del portátil', ia.modo === 'ollama' && ia.url === `${BASE}/ollama`, `${ia.url} · ${ia.modelo}`);
    comprobar('el intento por localhost del móvil se ha bloqueado de verdad', bloqueadas > 0, `${bloqueadas} intentos`);
    const avisos = await pg.evaluate(() => [...document.querySelectorAll('.aviso, #avisos *')].map(e => e.textContent).join(' | '));
    comprobar('avisa de que usa la IA del portátil', /IA del portátil detectada/.test(avisos), avisos.slice(0, 120));

    const T = turnos(pg, { ia: true });
    const tiempos = [];
    for (const q of ['Buenos días. Siéntese, por favor. ¿Qué le ocurre?', '¿Desde cuándo le pasa?', '¿Ha tenido fiebre?']) {
      await T.hablar(q); const t0 = Date.now(); await T.responder(); tiempos.push(((Date.now() - t0) / 1000).toFixed(1) + ' s');
    }
    const charla = await pg.evaluate(() => window.__juego.pac.charla.map(h => ({ ...h })));
    for (const h of charla) console.log(`   ${h.quien === 'medico' ? 'MÉDICO  ' : 'PACIENTE'} ${h.origen ? `[${h.origen}] ` : ''}${h.texto}`);
    console.log(`   Tiempo de cada respuesta: ${tiempos.join(', ')}`);
    const resp = charla.filter(h => h.quien !== 'medico');
    comprobar('todas las respuestas del móvil son de IA', resp.length >= 3 && resp.every(h => h.origen === 'ia'), `${resp.filter(h => h.origen === 'ia').length}/${resp.length}`);
    await pg.screenshot({ path: `${S}/movil_ia.png` });

    // portátil apagado o fuera de la wifi: al día siguiente el juego vuelve a las predefinidas en vez de esperar
    await ctx.route(/\/ollama\//, r => r.abort('connectionrefused'));
    const sinIA = await pg.evaluate(async () => {
      const ia = await import('./js/ia.js');
      const G = window.__juego.G;
      const r = await ia.generarRespuesta({ ...G.ajustes.ia, espera: 5 }, { pac: window.__juego.pac, quien: 'paciente', historial: [], pregunta: '¿Qué tal?', referencia: 'Regular, doctor.' });
      return r;
    });
    comprobar('sin portátil, el paciente contesta con la frase predefinida', sinIA.origen === 'predefinida' && sinIA.texto === 'Regular, doctor.', sinIA.error || '');
    await ctx.close();
  } finally {
    await b.close();
    srv.kill();
  }
  const fallos = resultados.filter(r => !r.ok);
  console.log(`\nResultado: ${resultados.length - fallos.length} de ${resultados.length} comprobaciones correctas.`);
  if (fallos.length) { console.log('Fallos:', fallos.map(f => f.nombre).join(' | ')); process.exitCode = 1; }
})();
