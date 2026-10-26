// Pruebas de la conversación por turnos, las voces por edades, la IA, el micrófono, el mando y la receta.
// La IA se prueba con un servidor simulado que imita la API de Ollama: comprueba la integración
// (qué datos recibe el modelo y cómo se muestra la respuesta), no la calidad de un modelo real.
// El micrófono y el mando también se simulan: en el navegador automático no hay micro ni mando reales.
const { chromium } = require('playwright');
const http = require('http');
const turnos = require('./turnos.js');
const S = process.argv[2] || '.';
const URL0 = 'http://localhost:8766/index.html';

const resultados = [];
const comprobar = (nombre, ok, detalle = '') => { resultados.push({ nombre, ok: !!ok }); console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ` · ${detalle}` : ''}`); };

// ───── servidor de IA simulado (API de Ollama) ─────
const peticiones = [];
const servidorIA = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  let cuerpo = ''; req.on('data', d => cuerpo += d);
  req.on('end', () => {
    const j = JSON.parse(cuerpo || '{}'); peticiones.push(j);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: { role: 'assistant', content: `Respuesta de IA simulada número ${peticiones.length}.` } }));
  });
}).listen(11435);

// ───── micrófono y mando simulados ─────
const FALSO_MICRO = `(() => {
  class FalsoReconocimiento {
    start() {
      setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'buenos días señora' }], { isFinal: false })] }), 200);
      setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: window.__dictado }], { isFinal: true })] }), 600);
      setTimeout(() => this.onend && this.onend(), 800);
    }
    stop() { setTimeout(() => this.onend && this.onend(), 30); }
  }
  window.SpeechRecognition = FalsoReconocimiento; window.webkitSpeechRecognition = FalsoReconocimiento;
  window.__dictado = 'Buenos días, señora. ¿Desde cuándo le duele la espalda?';
})();`;
const FALSO_MANDO = `(() => {
  const b = () => ({ pressed: false, value: 0, touched: false });
  window.__pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', buttons: Array.from({ length: 17 }, b), axes: [0, 0, 0, 0], timestamp: 0 };
  window.__pulsar = (i, on) => { window.__pad.buttons[i] = { pressed: on, value: on ? 1 : 0, touched: on }; };
  navigator.getGamepads = () => [window.__pad];
})();`;

async function abrir(b, consulta, { ancho = 1200, alto = 700, tactil = false, scripts = [] } = {}) {
  const pg = await b.newPage({ viewport: { width: ancho, height: alto }, hasTouch: tactil });
  pg.on('pageerror', e => console.log('ERR', e.message));
  for (const s of scripts) await pg.addInitScript(s);
  await pg.goto(URL0 + consulta);
  await pg.waitForSelector('#inicio.on', { timeout: 30000 });
  await pg.evaluate(() => window.__juego.mundo.ponerCalidad('baja'));
  await pg.click('#b-nueva'); await pg.click('#cr-ok');
  // las pruebas no suenan y empiezan con respuestas predefinidas (la IA se activa a mano en cada prueba)
  await pg.evaluate(() => { const G = window.__juego.G; G.ajustes.voz = false; G.ajustes.ia = { ...G.ajustes.ia, modo: 'predefinida', manual: true }; });
  await pg.click('#int-ok');
  await pg.waitForSelector('#ch-sug:not([hidden])', { timeout: 30000 });
  return pg;
}
const estado = (pg) => pg.evaluate(() => ({ charla: window.__juego.pac.charla.map(h => ({ ...h })), voz: window.__juego.Voz.ultima, sub: document.querySelector('#subtitulo span')?.textContent || '' }));
const usarIA = (pg) => pg.evaluate(() => { window.__juego.G.ajustes.ia = { modo: 'ollama', url: 'http://localhost:11435', modelo: 'prueba', espera: 10, manual: true }; });
// mientras habla alguien, mide cuánto se abre y cierra su boca. El navegador automático dibuja muy pocos
// fotogramas por segundo, así que se hace avanzar la animación del personaje a mano cada 50 ms.
const medirBoca = (pg) => pg.evaluate(async () => {
  const v = []; let hablando = 0;
  for (let i = 0; i < 40; i++) { const h = window.__juego.mundo.humanos.find(x => x.hablando); if (h) { h.actualizar(0.05); hablando++; v.push(h.partes.boca.scale.y); } await new Promise(r => setTimeout(r, 50)); }
  return { hablando, min: v.length ? Math.min(...v) : 0, max: v.length ? Math.max(...v) : 0 };
});
const bocaEnReposo = (pg) => pg.evaluate(() => window.__juego.mundo.humanos.every(h => { if (h.hablando) return false; if (!h.partes?.boca) return true; for (let i = 0; i < 3; i++) h.actualizar(0.05); return h.partes.boca.scale.y <= 0.46; }));

const PERSONAS = [
  { n: 'Niño pequeño (5 años)', edad: 5, sexo: 'h', estilo: 'niño o niña pequeño', pregunta2: '¿Dónde te duele? Enséñamelo con el dedo.' },
  { n: 'Niña (8 años)', edad: 8, sexo: 'm', estilo: 'Eres un niño o niña:', pregunta2: '¿Dónde te duele, guapa?' },
  { n: 'Adolescente (15 años)', edad: 15, sexo: 'h', estilo: 'adolescente', pregunta2: '¿Has tenido fiebre estos días?' },
  { n: 'Hombre adulto (40 años)', edad: 40, sexo: 'h', estilo: 'paciente normal', pregunta2: '¿Ha tenido fiebre o escalofríos?' },
  { n: 'Mujer adulta (45 años)', edad: 45, sexo: 'm', estilo: 'paciente normal', pregunta2: '¿Toma alguna medicación?' },
  { n: 'Abuelo (85 años)', edad: 85, sexo: 'h', estilo: 'muy mayor', pregunta2: '¿Y desde cuándo le pasa eso?' },
  { n: 'Abuela (85 años)', edad: 85, sexo: 'm', estilo: 'muy mayor', pregunta2: '¿Y desde cuándo le pasa eso?' },
];

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const voces = {};

  // ───── 1. Conversaciones con las siete edades ─────
  for (const [k, P] of PERSONAS.entries()) {
    console.log(`\n── ${P.n} ──`);
    const pg = await abrir(b, `?edad=${P.edad}&sexo=${P.sexo}`);
    const T = turnos(pg, { ia: true });
    const info = await pg.evaluate(() => ({ edad: window.__juego.pac.edad, sexo: window.__juego.pac.sexo, enf: window.__juego.pac.enfId, nombre: window.__juego.pac.nombre }));
    console.log(`   paciente: ${info.nombre}, ${info.edad} años, ${info.sexo}, ${info.enf}`);
    await pg.waitForTimeout(2500);
    let e = await estado(pg);
    comprobar(`${P.n}: nadie habla al llegar el paciente`, !e.voz && e.charla.length === 0);
    const inicio = await pg.evaluate(() => ({ caja: document.querySelector('#ch-texto').value, sug: !document.querySelector('#ch-sug').hidden, boton: document.querySelector('#ch-medico').disabled }));
    comprobar(`${P.n}: el cuadro empieza vacío (la sugerencia es opcional)`, inicio.caja === '' && inicio.sug && inicio.boton);
    const pregunta = P.edad < 13 ? 'Hola. ¿Qué te pasa? Cuéntamelo despacito.' : 'Buenos días. ¿Qué le ocurre y desde cuándo tiene esas molestias?';
    await T.hablar(pregunta);
    e = await estado(pg);
    comprobar(`${P.n}: el médico dice exactamente lo escrito`, e.charla[0]?.texto === pregunta && e.voz?.texto === pregunta && e.sub === pregunta, e.voz?.texto);
    await pg.waitForTimeout(2500);
    e = await estado(pg);
    const habil = await pg.evaluate(() => !document.querySelector('#ch-paciente').disabled);
    comprobar(`${P.n}: el paciente no contesta solo`, e.charla.length === 1 && habil);
    // respuesta predefinida y movimiento de la boca
    await pg.evaluate(() => document.querySelector('#ch-paciente').click());
    const boca = await medirBoca(pg);
    await T.libreCharla();
    e = await estado(pg);
    const r1 = e.charla[1];
    voces[P.n] = e.voz;
    comprobar(`${P.n}: responde al pulsar RESPONDER (predefinida)`, r1 && r1.origen === 'predefinida', `${r1?.quien}: «${r1?.texto}»`);
    console.log(`   voz: ${e.voz?.voz || 'sin voz en el navegador automático'} · tono ${e.voz?.tono} · ritmo ${e.voz?.vel} · emoción ${e.voz?.emocion}`);
    comprobar(`${P.n}: la boca se mueve mientras habla`, boca.hablando > 3 && boca.max - boca.min > 0.08, `abre ${boca.min.toFixed(2)}–${boca.max.toFixed(2)}`);
    comprobar(`${P.n}: la boca se para al terminar`, await bocaEnReposo(pg));
    // respuesta con IA (simulada)
    await usarIA(pg);
    await T.hablar(P.pregunta2);
    const antes = peticiones.length;
    await T.responder();
    e = await estado(pg);
    const r2 = e.charla[e.charla.length - 1];
    const pet = peticiones[peticiones.length - 1];
    const sis = pet?.messages?.[0]?.content || '';
    comprobar(`${P.n}: la IA genera la respuesta`, peticiones.length === antes + 1 && r2.origen === 'ia' && /IA simulada/.test(r2.texto), `«${r2.texto}»`);
    comprobar(`${P.n}: la IA recibe edad, estilo e historial`, sis.includes(`${info.edad} años`) && sis.includes(P.estilo) && pet.messages.some(m => m.content.includes(r1.texto)) && pet.messages[pet.messages.length - 1].content === P.pregunta2);
    comprobar(`${P.n}: la IA no conoce el diagnóstico de antemano`, /NO conoces tu diagnóstico/.test(sis) && !sis.includes(`Diagnóstico que le ha dicho`));
    const etiqueta = await pg.evaluate(() => document.querySelector('#subtitulo .origen')?.textContent);
    comprobar(`${P.n}: el subtítulo marca la respuesta como IA`, etiqueta === 'IA');
    if (P.edad < 10) comprobar(`${P.n}: al hablarle de tú contesta el niño, no el padre`, r2.quien === 'paciente');
    await pg.screenshot({ path: `${S}/ch_${k + 1}_${P.edad}${P.sexo}.png` });
    await pg.close();
  }

  // ───── 2. Voces diferenciadas por edad ─────
  console.log('\n── Perfiles de voz ──');
  {
    const pg = await b.newPage(); await pg.goto(URL0); await pg.waitForSelector('#inicio.on', { timeout: 30000 });
    const pf = await pg.evaluate(() => window.__juego.perfilesPrueba());
    for (const p of pf) console.log(`   ${p.n.padEnd(24)} ${p.nombreGrupo.padEnd(36)} voz ${p.genero === 'm' ? 'femenina' : 'masculina'} · ${p.voz || '—'} · tono ${p.tono} · ritmo ${p.vel}`);
    const t = Object.fromEntries(pf.map(p => [p.n, p.tono]));
    comprobar('Voces: niños más agudos que el adolescente', t['Niño de 5 años'] > t['Adolescente de 15 años'] && t['Niña de 8 años'] > t['Adolescente de 15 años']);
    comprobar('Voces: adolescente más agudo que el hombre de 40', t['Adolescente de 15 años'] > t['Hombre de 40 años']);
    comprobar('Voces: abuelo más grave y lento que el hombre de 40', t['Abuelo de 85 años'] < t['Hombre de 40 años'] && pf[5].vel < pf[3].vel);
    comprobar('Voces: abuela más grave y lenta que la mujer de 45', t['Abuela de 85 años'] < t['Mujer de 45 años'] && pf[6].vel < pf[4].vel);
    comprobar('Voces: sólo voces de España', pf.every(p => !p.voz || /es-ES/i.test(p.voz)), [...new Set(pf.map(p => p.voz))].join(', '));
    const estables = await pg.evaluate(() => JSON.stringify(window.__juego.perfilesPrueba()) === JSON.stringify(window.__juego.perfilesPrueba()));
    comprobar('Voces: cada personaje conserva siempre la misma voz', estables);
    await pg.close();
  }

  // ───── 3. Micrófono (simulado): se revisa y corrige antes de hablar ─────
  console.log('\n── Micrófono ──');
  {
    const pg = await abrir(b, '?edad=50&sexo=m', { scripts: [FALSO_MICRO] });
    const T = turnos(pg, { ia: true });
    await pg.fill('#ch-texto', '');
    await pg.click('#ch-mic');
    await pg.waitForSelector('#mi-si'); await pg.click('#mi-si');
    await pg.waitForFunction(() => document.querySelector('#ch-texto').value.includes('espalda'), null, { timeout: 10000 });
    await pg.waitForTimeout(1200);
    let e = await estado(pg);
    const dictado = await pg.inputValue('#ch-texto');
    comprobar('Micrófono: lo dictado aparece como texto', dictado === 'Buenos días, señora. ¿Desde cuándo le duele la espalda?', dictado);
    comprobar('Micrófono: el médico no habla hasta pulsar HABLAR MÉDICO', !e.voz && e.charla.length === 0);
    const corregido = 'Buenos días, señora. ¿Desde cuándo le duele la parte baja de la espalda?';
    await T.hablar(corregido);
    e = await estado(pg);
    comprobar('Micrófono: el médico dice el texto corregido', e.voz?.texto === corregido && e.charla[0].texto === corregido);
    await pg.close();
  }

  // ───── 4. Mando de Xbox (simulado) ─────
  console.log('\n── Mando ──');
  {
    const pg = await abrir(b, '?edad=35', { scripts: [FALSO_MANDO] });
    const T = turnos(pg, { ia: true });
    // el navegador automático va a pocos fotogramas: cada botón se mantiene pulsado un momento para que se lea
    const pulsar = async (i) => { await pg.evaluate((i) => window.__pulsar(i, true), i); await pg.waitForTimeout(150); await pg.evaluate((i) => window.__pulsar(i, false), i); await pg.waitForTimeout(150); };
    comprobar('Mando: se detecta automáticamente', await pg.evaluate(() => window.__juego.Mando.conectado));
    await pulsar(2); // X con el cuadro vacío: no pasa nada
    comprobar('Mando: X con el cuadro vacío no hace hablar al médico', (await estado(pg)).charla.length === 0);
    await pg.fill('#ch-texto', 'Buenos días. ¿Qué le pasa?'); // escrito con el teclado del portátil
    await pulsar(2); // X
    await T.libreCharla();
    let e = await estado(pg);
    comprobar('Mando: X = HABLAR MÉDICO', e.charla.length === 1 && e.charla[0].quien === 'medico');
    await pulsar(3); // Y
    await pg.waitForTimeout(300); await T.libreCharla();
    e = await estado(pg);
    comprobar('Mando: Y = RESPONDER PACIENTE', e.charla.length >= 2 && e.charla[1].quien !== 'medico');
    // cruceta + A: elegir una pregunta del panel; X: decirla
    for (let i = 0; i < 14; i++) { await pulsar(13); if (await pg.$('.foco-mando[data-q]')) break; }
    const foco = await pg.evaluate(() => document.querySelector('.foco-mando')?.textContent || '');
    await pulsar(0); // A
    const caja = await pg.inputValue('#ch-texto');
    comprobar('Mando: cruceta y A eligen opciones', !!foco && caja.length > 0, `foco: «${foco.slice(0, 40)}» → cuadro: «${caja.slice(0, 40)}»`);
    await pulsar(8); // VISTA: controles
    const controles = await pg.$('.modal h2');
    comprobar('Mando: VISTA muestra los controles', controles && /Controles/.test(await controles.textContent()));
    await pulsar(1); // B
    comprobar('Mando: B cierra la ventana', !(await pg.$('#modales .modal-fondo')));
    await pg.screenshot({ path: `${S}/ch_mando.png` });
    await pg.close();
  }

  // ───── 5. Receta: escribir, confirmar, leer, entregar en mano y responder ─────
  console.log('\n── Receta ──');
  {
    const pg = await abrir(b, '?caso=faringitis&edad=35&sexo=h');
    const T = turnos(pg, { ia: true });
    await T.hablar(); await T.responder();
    // al explorar, el paciente reacciona con la cara y en los subtítulos, pero no habla
    const vozExpl = (await estado(pg)).voz?.texto;
    await pg.evaluate(() => document.querySelector('[data-tab="explorar"]').click());
    await pg.evaluate(() => document.querySelector('[data-ex="zona"]').click());
    await pg.waitForTimeout(1500);
    const tras = await estado(pg);
    comprobar('Exploración: el paciente no habla solo al explorarle', tras.voz?.texto === vozExpl && await pg.evaluate(() => document.querySelector('#subtitulo .origen')?.textContent) === 'reacción', tras.sub);
    await pg.evaluate(() => document.querySelector('.modal .cerrar')?.click());
    await pg.evaluate(() => document.querySelector('[data-tab="decidir"]').click());
    await pg.waitForSelector('#re-q');
    const vozAntes = (await estado(pg)).voz?.texto;
    await pg.fill('#re-q', 'amoxicilina'); await pg.dispatchEvent('#re-q', 'input');
    await pg.click('#re-sug button[data-s]');
    await pg.fill('input[data-k="dosis"]', '1 comprimido de 500 mg');
    await pg.fill('input[data-k="pauta"]', 'cada 8 h');
    await pg.fill('input[data-k="dur"]', '7 días');
    await pg.fill('#re-ind', 'Beber mucha agua, reposo y volver si la fiebre no baja en tres días');
    await pg.click('[data-d="faringitis"]'); await pg.click('[data-a="casa"]'); await pg.click('[data-p="baja"]');
    let e = await estado(pg);
    comprobar('Receta: nadie habla mientras se escribe', e.voz?.texto === vozAntes);
    await pg.click('#de-ok');
    comprobar('Receta: no se puede comunicar sin confirmarla', !!(await pg.$('#de-ok')));
    await pg.click('#re-conf'); await pg.waitForSelector('#rv-ok');
    await pg.screenshot({ path: `${S}/ch_receta_revisar.png` });
    await pg.click('#rv-ok');
    await pg.waitForSelector('#re-mod');
    await pg.click('#de-ok'); await pg.click('[data-t="empatia"]');
    await pg.waitForTimeout(2500);
    e = await estado(pg);
    comprobar('Receta: el médico espera a HABLAR MÉDICO para dar la noticia', e.voz?.texto === vozAntes && (await T.espera()) === 'medico');
    comprobar('Receta: el texto de la noticia no se escribe solo en el cuadro', (await pg.inputValue('#ch-texto')) === '' && await pg.evaluate(() => !document.querySelector('#ch-sug').hidden));
    await T.hablar(); await T.responder();
    const plan = await pg.evaluate(() => window.__juego.lineasReceta(window.__juego.pac.plan).join(' '));
    const caja = await pg.evaluate(() => ({ v: document.querySelector('#ch-texto').value, ro: document.querySelector('#ch-texto').readOnly }));
    comprobar('Receta: el cuadro muestra exactamente la receta escrita', caja.v === plan && caja.ro, plan);
    await pg.waitForTimeout(2500);
    e = await estado(pg);
    comprobar('Receta: el médico no la lee hasta pulsar HABLAR MÉDICO', !e.charla.some(h => h.texto === plan));
    await pg.evaluate(() => document.querySelector('#ch-medico').click());
    await pg.waitForTimeout(400);
    e = await estado(pg);
    comprobar('Receta: el subtítulo muestra el texto exacto', e.sub === plan);
    comprobar('Receta: la voz lee abreviaturas de forma natural sin cambiar nada', /500 miligramos/.test(e.voz?.texto) && /cada 8 horas/.test(e.voz?.texto) && /Amoxicilina/i.test(e.voz?.texto), e.voz?.texto);
    // la entrega en mano, paso a paso
    await pg.waitForFunction(() => window.__juego.charla.entregando, null, { timeout: 60000 });
    const linea = await pg.evaluate(async () => {
      const m = window.__juego.mundo, out = [];
      const brazo = m.manos.userData.brazos.find(b => b.sg === 1);
      for (let i = 0; i < 200 && (i < 10 || window.__juego.charla.entregando); i++) {
        // el navegador automático dibuja muy pocos fotogramas: se avanza la animación (que va con el reloj real) a mano
        for (const f of [...m.alActualizar]) f(0.016, performance.now() / 1000);
        const p = m.escenas.consulta.getObjectByName('receta');
        const rec = m.humanos.find(h => h.alcance > 0) || null;
        out.push({ t: i, medico: +(brazo.extra || 0).toFixed(2), paciente: rec ? +rec.alcance.toFixed(2) : 0, padre: p ? (p.parent === m.escenas.consulta ? 'aire' : /^mano/.test(p.parent.name || '') ? 'mano paciente' : 'mano médico') : 'sin papel' });
        await new Promise(r => setTimeout(r, 100));
      }
      return out;
    });
    const orden = linea.map(x => x.padre).filter((x, i, a) => x !== a[i - 1]);
    console.log('   secuencia del papel:', orden.join(' → '));
    console.log('   brazo del médico:', linea.filter((_, i) => i % 5 === 0).map(x => x.medico).join(' '), '· brazo del paciente:', linea.filter((_, i) => i % 5 === 0).map(x => x.paciente).join(' '));
    const iM = linea.findIndex(x => x.medico > 0.9), iP = linea.findIndex(x => x.paciente > 0.9), iMano = linea.findIndex(x => x.padre === 'mano paciente');
    comprobar('Receta: el médico extiende el brazo, después el paciente, y el papel pasa de mano en mano', orden[0] === 'mano médico' && orden.includes('mano paciente') && iM >= 0 && iP >= iM && iMano >= iP, orden.join(' → '));
    await T.libreCharla();
    const papel = await pg.evaluate(() => { const p = window.__juego.mundo.escenas.consulta.getObjectByName('receta'); return { hueso: p?.parent?.name, lineas: p?.material?.map?.userData?.lineas?.join(' ') }; });
    comprobar('Receta: el paciente se queda el papel en su mano', /^manoR/.test(papel.hueso || ''), papel.hueso);
    comprobar('Receta: el papel lleva exactamente lo escrito', papel.lineas === plan);
    await pg.screenshot({ path: `${S}/ch_receta_entregada.png` });
    await pg.waitForTimeout(2000);
    e = await estado(pg);
    const n = e.charla.length;
    comprobar('Receta: el paciente no contesta solo tras recibirla', e.charla[n - 1].quien === 'medico' && (await T.espera()) === 'paciente');
    await T.responder();
    e = await estado(pg);
    comprobar('Receta: el paciente responde al pulsar RESPONDER', e.charla.length === n + 1, `«${e.charla[n]?.texto}»`);
    await T.avanzarHasta('#va-ok');
    comprobar('Receta: la consulta termina con la valoración', !!(await pg.$('#va-ok')));
    await pg.close();
  }

  // ───── 6. Móvil Android (pantalla táctil, vertical y horizontal) ─────
  console.log('\n── Móvil ──');
  for (const [w, h, n] of [[412, 915, 'vertical'], [915, 412, 'horizontal']]) {
    const pg = await abrir(b, '?edad=60', { ancho: w, alto: h, tactil: true });
    const T = turnos(pg, { ia: true });
    await T.hablar(); await T.responder();
    const caja = await pg.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { charla: r('#charla'), panel: r('#panel'), medico: r('#ch-medico'), paciente: r('#ch-paciente') }; });
    const solapa = caja.charla.bottom > caja.panel.top + 1 && caja.charla.right > caja.panel.left + 1 && caja.charla.left < caja.panel.right - 1 && caja.charla.top < caja.panel.bottom - 1;
    comprobar(`Móvil ${n}: la barra no tapa el panel`, !solapa);
    comprobar(`Móvil ${n}: botones grandes para el dedo`, caja.medico.height >= 44 && caja.paciente.height >= 44, `${Math.round(caja.medico.width)}×${Math.round(caja.medico.height)} px`);
    await pg.screenshot({ path: `${S}/ch_movil_${n}.png` });
    await pg.close();
  }

  await b.close(); servidorIA.close();
  const fallos = resultados.filter(r => !r.ok);
  console.log(`\nResultado: ${resultados.length - fallos.length} de ${resultados.length} comprobaciones correctas.`);
  if (fallos.length) { console.log('Fallos:', fallos.map(f => f.nombre).join(' | ')); process.exitCode = 1; }
})();
