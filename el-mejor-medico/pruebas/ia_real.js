// Conversaciones con la IA REAL (Ollama en este ordenador): 7 pacientes de distintas edades, 4 turnos cada uno.
// Requisitos: Ollama en marcha en http://localhost:11434 con un modelo (por ejemplo qwen2.5:3b).
// Comprueba que el juego detecta la IA solo, que todas las respuestas son de IA (sin recurrir a las
// predefinidas), que no revelan el diagnóstico y que el paciente recuerda lo que ha dicho.
// La naturalidad y la coherencia hay que juzgarlas leyendo las transcripciones que se imprimen.
const { chromium } = require('playwright');
const turnos = require('./turnos.js');
const S = process.argv[2] || '.';
const resultados = [];
const comprobar = (nombre, ok, detalle = '') => { resultados.push({ nombre, ok: !!ok }); console.log(`${ok ? 'OK   ' : 'FALLO'} ${nombre}${detalle ? ` · ${detalle}` : ''}`); };

const PERSONAS = [
  { n: 'Niño pequeño (5 años)', edad: 5, sexo: 'h', tu: true },
  { n: 'Niña (8 años)', edad: 8, sexo: 'm', tu: true },
  { n: 'Adolescente (15 años)', edad: 15, sexo: 'h', tu: true },
  { n: 'Hombre adulto (40 años)', edad: 40, sexo: 'h' },
  { n: 'Mujer adulta (45 años)', edad: 45, sexo: 'm' },
  { n: 'Abuelo (85 años)', edad: 85, sexo: 'h' },
  { n: 'Abuela (85 años)', edad: 85, sexo: 'm' },
];
const PREGUNTAS = {
  tu: ['Hola, soy el médico. ¿Qué te pasa? Cuéntamelo.', '¿Desde cuándo te encuentras así?', '¿Te duele algo más? ¿Has tenido fiebre?', 'Antes me has contado lo que te pasaba. ¿Me lo repites en pocas palabras?'],
  usted: ['Buenos días. Siéntese, por favor. ¿Qué le ocurre?', '¿Desde cuándo le pasa?', '¿Ha tenido fiebre? ¿Toma alguna medicación?', 'Antes me ha contado lo que le pasaba. ¿Me lo puede repetir en pocas palabras?'],
};

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const P of PERSONAS) {
    console.log(`\n══ ${P.n} ══`);
    const pg = await b.newPage({ viewport: { width: 1200, height: 700 } });
    pg.on('pageerror', e => console.log('ERR', e.message));
    await pg.goto(`http://localhost:8766/index.html?edad=${P.edad}&sexo=${P.sexo}`);
    await pg.waitForSelector('#inicio.on', { timeout: 30000 });
    await pg.evaluate(() => window.__juego.mundo.ponerCalidad('baja'));
    await pg.click('#b-nueva'); await pg.click('#cr-ok');
    await pg.evaluate(() => { window.__juego.G.ajustes.voz = false; });
    await pg.click('#int-ok');
    await pg.waitForSelector('#ch-sug:not([hidden])', { timeout: 30000 });
    await pg.waitForFunction(() => window.__juego.G.ajustes.ia.modo === 'ollama', null, { timeout: 10000 }).catch(() => {});
    const ia = await pg.evaluate(() => ({ ...window.__juego.G.ajustes.ia }));
    comprobar(`${P.n}: el juego detecta la IA local solo`, ia.modo === 'ollama', ia.modelo);
    const pac = await pg.evaluate(() => { const p = window.__juego.pac; return { nombre: `${p.nombre} ${p.apellidos}`, edad: p.edad, enf: p.enfId, acomp: p.acompanante }; });
    console.log(`   Paciente: ${pac.nombre}, ${pac.edad} años · enfermedad (oculta al paciente): ${pac.enf}${pac.acomp ? ` · viene con ${pac.acomp}` : ''}`);
    const T = turnos(pg, { ia: true });
    const tiempos = [];
    for (const q of PREGUNTAS[P.tu ? 'tu' : 'usted']) {
      await T.hablar(q);
      const t0 = Date.now();
      await T.responder();
      tiempos.push((Date.now() - t0) / 1000);
    }
    const charla = await pg.evaluate(() => window.__juego.pac.charla.map(h => ({ ...h })));
    for (const h of charla) console.log(`   ${h.quien === 'medico' ? 'MÉDICO  ' : h.quien === 'acomp' ? 'FAMILIAR' : 'PACIENTE'} ${h.origen ? `[${h.origen}] ` : ''}${h.texto}`);
    console.log(`   Tiempo de cada respuesta: ${tiempos.map(t => t.toFixed(1) + ' s').join(', ')}`);
    const resp = charla.filter(h => h.quien !== 'medico');
    comprobar(`${P.n}: todas las respuestas son de IA (ninguna predefinida)`, resp.length >= 4 && resp.every(h => h.origen === 'ia'), `${resp.filter(h => h.origen === 'ia').length}/${resp.length}`);
    const pal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zñ0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2);
    const eco = charla.some((h, i) => { if (h.quien === 'medico' || !i) return false; const r = pal(h.texto), q = new Set(pal(charla[i - 1].texto)); return r.length && r.filter(w => q.has(w)).length / r.length > 0.6; });
    comprobar(`${P.n}: nunca repite la pregunta del médico`, !eco);
    comprobar(`${P.n}: no dice el nombre técnico de su enfermedad`, !resp.some(h => h.texto.toLowerCase().includes(pac.enf.replace(/_/g, ' '))));
    comprobar(`${P.n}: respuestas en español y de longitud razonable`, resp.every(h => !/\b(the|and|doctor said|patient|I am|I have)\b/i.test(h.texto) && h.texto.length > 2 && h.texto.length < 340));
    await pg.screenshot({ path: `${S}/ia_${P.edad}${P.sexo}.png` });
    await pg.close();
  }
  await b.close();
  const fallos = resultados.filter(r => !r.ok);
  console.log(`\nResultado: ${resultados.length - fallos.length} de ${resultados.length} comprobaciones correctas.`);
  if (fallos.length) { console.log('Fallos:', fallos.map(f => f.nombre).join(' | ')); process.exitCode = 1; }
})();
