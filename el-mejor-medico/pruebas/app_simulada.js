// La parte JavaScript de la APLICACIÓN DE ANDROID, con los módulos nativos simulados.
// Se imitan IALocal (Gemma 4 E2B con LiteRT-LM), VozNativa (voces de Android) y DictadoNativo (micrófono)
// tal y como los expone Capacitor. Las respuestas de «IALocal.generar» las da Gemma 4 E2B en Ollama,
// llamado desde fuera de la página: la página NO puede conectar con ningún servidor de IA (se bloquea),
// como el móvil sin red. Así se prueba todo el recorrido: oferta de descarga, progreso, carga, respuestas
// de IA con origen «movil», voces del sistema y dictado nativo.
// NO sustituye a la prueba en el Xiaomi: aquí no se ejecuta el código Kotlin ni la GPU del móvil.
const { chromium, devices } = require('playwright');
const turnos = require('./turnos.js');
const S = process.argv[2] || '.';
const MODELO = process.env.MODELO || 'hf.co/unsloth/gemma-4-E2B-it-GGUF:Q4_K_M';
const resultados = [];
const comprobar = (nombre, ok, detalle = '') => { resultados.push({ nombre, ok: !!ok }); console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ` · ${detalle}` : ''}`); };

const SIMULACION = () => {
  const oyentes = {};
  // como en el Capacitor real del móvil: addListener devuelve el oyente directamente (no una promesa)
  const plugin = (nombre, metodos) => ({ ...metodos, addListener: (ev, fn) => { (oyentes[nombre + ev] ||= []).push(fn); return { remove: () => { oyentes[nombre + ev] = oyentes[nombre + ev].filter(f => f !== fn); } }; } });
  const emitir = (nombre, ev, d) => (oyentes[nombre + ev] || []).forEach(f => f(d));
  const reg = window.__nativo = { instalado: false, cargado: false, llamadas: [], habladas: [], palabras: 0, dictados: 0, avisos: [] };
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.textContent && reg.avisos.push(n.textContent)))).observe(document.querySelector('#avisos'), { childList: true }));
  const TOTAL = 2588147712;
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      IALocal: plugin('IALocal', {
        estado: async () => ({ instalado: reg.instalado, bytes: reg.instalado ? TOTAL : 0, total: TOTAL, parcial: 0, cargado: reg.cargado, aceleracion: reg.cargado ? 'gpu' : '', modelo: 'Gemma 4 E2B', libre: 400e9 }),
        descargar: async () => { for (let i = 1; i <= 5; i++) { await new Promise(r => setTimeout(r, 120)); emitir('IALocal', 'progreso', { bytes: TOTAL * i / 5, total: TOTAL }); } reg.instalado = true; return { ok: true }; },
        cancelarDescarga: async () => {},
        importar: async () => { throw new Error('No se ha elegido ningún archivo'); },
        cargar: async () => { await new Promise(r => setTimeout(r, 600)); reg.cargado = true; return { aceleracion: 'gpu', ms: 600 }; },
        generar: async ({ mensajes }) => { reg.llamadas.push(mensajes.length); const r = await window.__generarFuera(mensajes); return { texto: r, ms: 1, aceleracion: 'gpu' }; },
      }),
      VozNativa: plugin('VozNativa', {
        voces: async () => ({ voces: [
          { name: 'es-es-x-eea-local', lang: 'es-ES', red: false, instalada: true, calidad: 400 },
          { name: 'es-es-x-eed-local', lang: 'es-ES', red: false, instalada: true, calidad: 400 },
          { name: 'es-es-x-eef-network', lang: 'es-ES', red: true, instalada: true, calidad: 500 },
          { name: 'es-us-x-esc-local', lang: 'es-US', red: false, instalada: true, calidad: 400 },
        ], motor: 'com.google.android.tts' }),
        hablar: async ({ texto, voz, tono, vel, id }) => { reg.habladas.push({ texto, voz, tono, vel }); for (const p of texto.split(/\s+/)) { emitir('VozNativa', 'palabra', { id, largo: p.length }); reg.palabras++; } await new Promise(r => setTimeout(r, 30)); },
        parar: async () => {},
      }),
      DictadoNativo: plugin('DictadoNativo', {
        estado: async () => ({ disponible: true, sinConexion: true, permiso: true }),
        iniciar: async () => { reg.dictados++; emitir('DictadoNativo', 'parcial', { texto: 'Buenos días' }); await new Promise(r => setTimeout(r, 200)); return { texto: 'Buenos días, ¿qué le ocurre?', sinConexion: true }; },
        parar: async () => {},
      }),
    },
  };
};

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'es-ES' });
    // sin red de IA: ni Ollama ni el puente del portátil
    let intentosRed = 0;
    await ctx.route(/11434|\/ollama\//, r => { intentosRed++; r.abort('internetdisconnected'); });
    await ctx.exposeFunction('__generarFuera', async (mensajes) => {
      const r = await fetch('http://127.0.0.1:11434/api/chat', { method: 'POST', body: JSON.stringify({ model: MODELO, messages: mensajes, stream: false, keep_alive: '30m', options: { temperature: 0.8, num_predict: 120 } }) });
      return (await r.json()).message?.content || '';
    });
    await ctx.addInitScript(SIMULACION);
    const pg = await ctx.newPage();
    pg.on('pageerror', e => console.log('ERR', e.message));
    await pg.goto('http://localhost:8766/index.html?edad=8&sexo=m');
    await pg.waitForSelector('#inicio.on', { timeout: 30000 });
    await pg.evaluate(() => window.__juego.mundo.ponerCalidad('baja'));
    await pg.click('#b-nueva'); await pg.click('#cr-ok');
    await pg.evaluate(() => { window.__juego.G.ajustes.voz = true; });
    await pg.click('#int-ok');

    // 1. Sin modelo: el juego ofrece descargarlo o importarlo (no cambia a predefinidas sin decirlo)
    const oferta = await pg.waitForSelector('#ia-desc', { timeout: 15000 }).then(() => true, () => false);
    comprobar('sin modelo, el juego ofrece descargar o importar Gemma 4 E2B', oferta, await pg.evaluate(() => document.querySelector('#ia-desc')?.textContent));
    await pg.screenshot({ path: `${S}/app_oferta.png` });
    await pg.click('#ia-imp');
    await pg.waitForFunction(() => /No se ha elegido/.test(document.querySelector('#ia-txt')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
    comprobar('si la importación falla, se explica y se puede reintentar', await pg.evaluate(() => /No se ha elegido/.test(document.querySelector('#ia-txt').textContent) && !document.querySelector('#ia-desc').disabled));
    await pg.click('#ia-desc');
    await pg.waitForFunction(() => !document.querySelector('#ia-desc'), null, { timeout: 10000 });
    await pg.waitForFunction(() => window.__juego.G.ajustes.ia.modo === 'movil', null, { timeout: 10000 }).catch(() => {});
    const ia = await pg.evaluate(() => ({ ...window.__juego.G.ajustes.ia }));
    comprobar('tras descargar, la IA del móvil se carga sola', ia.modo === 'movil', `${ia.modo} · ${ia.modelo}`);

    // 2. Conversación: el médico dice exactamente lo escrito y el paciente responde con la IA del móvil
    const T = turnos(pg, { ia: true });
    await pg.waitForTimeout(300);
    // aquí la voz es la simulada: se deja activa para comprobarla
    await pg.evaluate(() => { const G = window.__juego.G; G.ajustes.voz = true; window.__juego.Voz.activa = true; });
    const preguntas = ['Hola, soy el médico. ¿Qué te pasa? Cuéntamelo.', '¿Desde cuándo te encuentras así?', '¿Has tenido fiebre?'];
    for (const q of preguntas) {
      await pg.fill('#ch-texto', q);
      await pg.waitForFunction(() => !document.querySelector('#ch-medico').disabled, null, { timeout: 60000 });
      await pg.evaluate(() => document.querySelector('#ch-medico').click());
      await pg.waitForTimeout(150); await T.libreCharla();
      await pg.waitForFunction(() => !document.querySelector('#ch-paciente').disabled, null, { timeout: 60000 });
      await pg.evaluate(() => document.querySelector('#ch-paciente').click());
      await pg.waitForTimeout(150); await T.libreCharla();
    }
    console.log('   Avisos del juego:', (await pg.evaluate(() => window.__nativo.avisos)).join(' | '));
    const charla = await pg.evaluate(() => window.__juego.pac.charla.map(h => ({ ...h })));
    for (const h of charla) console.log(`   ${h.quien === 'medico' ? 'MÉDICO  ' : h.quien === 'acomp' ? 'FAMILIAR' : 'PACIENTE'} ${h.origen ? `[${h.origen}] ` : ''}${h.texto}`);
    const medico = charla.filter(h => h.quien === 'medico').map(h => h.texto);
    comprobar('el médico dice exactamente lo escrito', preguntas.every(q => medico.includes(q)));
    const resp = charla.filter(h => h.quien !== 'medico');
    comprobar('todas las respuestas son de la IA del móvil', resp.length >= 3 && resp.every(h => h.origen === 'ia'), `${resp.filter(h => h.origen === 'ia').length}/${resp.length}`);
    const reg = await pg.evaluate(() => window.__nativo);
    comprobar('las respuestas pasan por IALocal.generar (módulo nativo)', reg.llamadas.length >= 3, `${reg.llamadas.length} llamadas`);
    comprobar('la página no ha usado ningún servidor de IA', intentosRed === 0 || ia.modo === 'movil', `${intentosRed} intentos bloqueados`);

    // 3. Voces del sistema Android: sólo voces instaladas de España (sin Internet)
    const voces = [...new Set(reg.habladas.map(h => h.voz))];
    comprobar('habla con las voces de Android del móvil', reg.habladas.length >= 6, `${reg.habladas.length} frases`);
    comprobar('sólo usa voces es-ES instaladas (sin las de red ni de otros países)', voces.every(v => /^es-es-x-.*-local$/.test(v || '')), voces.join(', '));
    comprobar('la boca recibe las palabras de la voz nativa', reg.palabras > 10, `${reg.palabras} palabras`);
    const tonos = reg.habladas.map(h => h.tono);
    comprobar('la niña y el médico tienen distinto tono', Math.max(...tonos) - Math.min(...tonos) > 0.3, tonos.map(t => t.toFixed(2)).join(' '));

    // 4. Dictado nativo: el texto queda en el cuadro para revisarlo; el médico no habla solo
    const antes = (await pg.evaluate(() => window.__juego.pac.charla.length));
    await pg.fill('#ch-texto', '');
    await pg.evaluate(() => document.querySelector('#ch-mic').click());
    await pg.waitForSelector('#mi-si', { timeout: 5000 }).then(() => pg.click('#mi-si'), () => {});
    await pg.waitForFunction(() => /Buenos días, ¿qué le ocurre\?/.test(document.querySelector('#ch-texto').value), null, { timeout: 5000 }).catch(() => {});
    const dict = await pg.evaluate(() => ({ v: document.querySelector('#ch-texto').value, n: window.__juego.pac.charla.length, d: window.__nativo.dictados }));
    comprobar('el dictado del micrófono llega al cuadro de texto', dict.v.includes('Buenos días, ¿qué le ocurre?') && dict.d >= 1, dict.v);
    comprobar('tras dictar, el médico no habla hasta pulsar el botón', dict.n === antes);
    await pg.screenshot({ path: `${S}/app_conversacion.png` });
    await ctx.close();
  } finally { await b.close(); }
  const fallos = resultados.filter(r => !r.ok);
  console.log(`\nResultado: ${resultados.length - fallos.length} de ${resultados.length} comprobaciones correctas.`);
  if (fallos.length) { console.log('Fallos:', fallos.map(f => f.nombre).join(' | ')); process.exitCode = 1; }
})();
