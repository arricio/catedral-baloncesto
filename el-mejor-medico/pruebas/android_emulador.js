// Prueba de la APLICACIÓN DE ANDROID DE VERDAD en el emulador (Android 16): Kotlin, LiteRT-LM y Gemma 4 E2B reales.
// Usa la copia de pruebas «es.elmejormedico.juego.prueba» (assembleDebug), que permite leer el estado del juego,
// con el modelo ya copiado en su memoria interna. Sin servidor de IA: todo lo hace la propia aplicación.
// Uso: emulador arrancado y  node pruebas\android_emulador.js [cpu|gpu]
// En el emulador la «GPU» es simulada por software (lentísima): por defecto se prueba en el procesador.
const { _android } = require('playwright');
const PAQUETE = 'es.elmejormedico.juego.prueba';
const ACEL = process.argv[2] || 'cpu';
const resultados = [];
const comprobar = (nombre, ok, detalle = '') => { resultados.push({ nombre, ok: !!ok }); console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ` · ${detalle}` : ''}`); };

(async () => {
  const [disp] = await _android.devices();
  if (!disp) throw new Error('No hay ningún Android conectado (adb devices)');
  console.log(`Dispositivo: ${disp.model()} · Android ${(await disp.shell('getprop ro.build.version.release')).toString().trim()}`);
  try {
    await disp.shell(`am force-stop ${PAQUETE}`);
    await disp.shell(`pm clear ${PAQUETE}`).catch(() => {});
    // pm clear borra el modelo: se vuelve a poner desde la copia de seguridad del emulador si existe
    await disp.shell(`run-as ${PAQUETE} mkdir -p files/modelos`);
    const hay = (await disp.shell(`ls /data/local/tmp/m.litertlm 2>/dev/null`)).toString().trim();
    if (hay) await disp.shell(`run-as ${PAQUETE} cp /data/local/tmp/m.litertlm files/modelos/gemma-4-E2B-it.litertlm`);
    await disp.shell(`monkey -p ${PAQUETE} -c android.intent.category.LAUNCHER 1`);
    const wv = await disp.webView({ pkg: PAQUETE }, { timeout: 60000 });
    const pg = await wv.page();
    const errores = [];
    pg.on('pageerror', e => { errores.push(e.message); console.log('ERR', e.message); });
    await pg.waitForSelector('#inicio.on', { timeout: 120000 });
    await pg.evaluate(() => { window.__avisos = []; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => n.textContent && window.__avisos.push(n.textContent)))).observe(document.querySelector('#avisos'), { childList: true }); });
    comprobar('la aplicación arranca y el juego se carga', true);
    const nativo = await pg.evaluate(() => ({ cap: Capacitor.isNativePlatform(), plugins: ['IALocal', 'VozNativa', 'DictadoNativo'].filter(n => Capacitor.Plugins[n]) }));
    comprobar('los tres módulos nativos están disponibles', nativo.cap && nativo.plugins.length === 3, nativo.plugins.join(', '));
    const est = await pg.evaluate(() => Capacitor.Plugins.IALocal.estado());
    comprobar('el modelo de Android está instalado y verificado por tamaño', est.instalado, `${est.total} bytes`);

    await pg.evaluate(() => window.__juego.mundo.ponerCalidad('baja'));
    await pg.click('#b-nueva'); await pg.click('#cr-ok');
    await pg.evaluate((a) => { const G = window.__juego.G; G.ajustes.voz = true; G.ajustes.ia.aceleracion = a; }, ACEL);
    const t0 = Date.now();
    await pg.click('#int-ok');
    await pg.waitForFunction(() => window.__juego.G.ajustes.ia.modo === 'movil', null, { timeout: 600000 });
    const carga = (Date.now() - t0) / 1000;
    const avisosCarga = await pg.evaluate(() => window.__avisos.join(' | '));
    comprobar('la IA del móvil se carga sola (LiteRT-LM real)', true, `${carga.toFixed(0)} s · ${avisosCarga}`);

    // conversación: el médico dice lo escrito; el paciente sólo responde al pulsar RESPONDER PACIENTE
    const libre = () => pg.waitForFunction(() => { const c = window.__juego.charla; return !c.pensando && !c.entregando && !document.querySelector('#panel').classList.contains('ocupado'); }, null, { timeout: 300000 });
    const preguntas = ['Buenos días. ¿Qué le trae por aquí?', '¿Desde cuándo le pasa?', '¿Ha tenido fiebre?'];
    const tiempos = [];
    for (const q of preguntas) {
      await pg.fill('#ch-texto', q);
      await pg.waitForFunction(() => !document.querySelector('#ch-medico').disabled, null, { timeout: 120000 });
      await pg.evaluate(() => document.querySelector('#ch-medico').click());
      await pg.waitForTimeout(200); await libre();
      const antes = await pg.evaluate(() => window.__juego.pac.charla.length);
      await pg.waitForFunction(() => !document.querySelector('#ch-paciente').disabled, null, { timeout: 120000 });
      const t = Date.now();
      await pg.evaluate(() => document.querySelector('#ch-paciente').click());
      await pg.waitForFunction((n) => window.__juego.pac.charla.length > n, antes, { timeout: 300000 });
      tiempos.push((Date.now() - t) / 1000);
      await pg.waitForTimeout(200); await libre();
    }
    const charla = await pg.evaluate(() => window.__juego.pac.charla.map(h => ({ ...h })));
    const pac = await pg.evaluate(() => ({ edad: window.__juego.pac.edad, enf: window.__juego.pac.enfId }));
    console.log(`   Paciente: ${pac.edad} años · ${pac.enf}`);
    for (const h of charla) console.log(`   ${h.quien === 'medico' ? 'MÉDICO  ' : h.quien === 'acomp' ? 'FAMILIAR' : 'PACIENTE'} ${h.origen ? `[${h.origen}] ` : ''}${h.texto}`);
    const medico = charla.filter(h => h.quien === 'medico').map(h => h.texto);
    comprobar('el médico dice exactamente lo escrito', preguntas.every(q => medico.includes(q)));
    const resp = charla.filter(h => h.quien !== 'medico');
    comprobar('todas las respuestas son de la IA del móvil', resp.length >= 3 && resp.every(h => h.origen === 'ia'), `${resp.filter(h => h.origen === 'ia').length}/${resp.length}`);
    console.log(`   Tiempo hasta la respuesta (incluye la voz del paciente): ${tiempos.map(t => t.toFixed(1).replace('.', ',') + ' s').join(' · ')}`);
    const ia = await pg.evaluate(() => ({ ...window.__juego.G.ajustes.ia }));
    comprobar('el juego indica la IA del móvil', ia.modo === 'movil', `${ia.modelo} · ${ACEL}`);

    // voces de Android
    const voces = await pg.evaluate(() => Capacitor.Plugins.VozNativa.voces());
    const es = voces.voces.filter(v => v.lang.toLowerCase().startsWith('es-es'));
    comprobar('hay voces de Android en español de España', es.length > 0, `${es.length} voces (${es.filter(v => !v.red && v.instalada).length} instaladas sin red) · motor ${voces.motor}`);
    // dictado: sólo se comprueba que el módulo responde (el emulador no tiene micrófono)
    const dic = await pg.evaluate(() => Capacitor.Plugins.DictadoNativo.estado());
    comprobar('el módulo de dictado responde', typeof dic.disponible === 'boolean', JSON.stringify(dic));
    comprobar('sin errores de JavaScript en la aplicación (voz, boca, IA)', !errores.length, errores.slice(0, 2).join(' | '));
    console.log('   Avisos del juego:', await pg.evaluate(() => window.__avisos.join(' | ')));
    await pg.screenshot({ path: `${process.env.TEMP}\\android_conversacion.png` });
  } finally { await disp.close(); }
  const fallos = resultados.filter(r => !r.ok);
  console.log(`\nResultado: ${resultados.length - fallos.length} de ${resultados.length} comprobaciones correctas.`);
  if (fallos.length) { console.log('Fallos:', fallos.map(f => f.nombre).join(' | ')); process.exitCode = 1; }
})().catch(e => { console.error(e); process.exitCode = 1; });
