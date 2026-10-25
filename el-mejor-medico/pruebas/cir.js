const { chromium } = require('playwright');
const S = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 1000, height: 620 } });
  pg.on('pageerror', e => console.log('ERR', e.message, e.stack?.split('\n')[1]));
  const shot = async (n) => { await pg.waitForTimeout(1500); await pg.screenshot({ path: `${S}/c_${n}.png` }); console.log('shot', n); };
  const click = async (sel) => { await pg.waitForSelector(sel, { timeout: 30000 }); await pg.evaluate((s) => document.querySelector(s).click(), sel); await pg.waitForTimeout(150); };
  const libre = () => pg.waitForFunction(() => !document.querySelector('#panel').classList.contains('ocupado'), null, { timeout: 60000 });
  await pg.goto('http://localhost:8766/index.html?caso=apendicitis');
  await pg.waitForSelector('#inicio.on');
  await pg.evaluate(() => { window.__juego.mundo.ponerCalidad('baja'); });
  await click('#b-nueva'); await click('#cr-ok'); await click('#int-ok');
  await pg.waitForSelector('#panel.on [data-q]'); await libre();
  await click('[data-tab="decidir"]');
  await click('[data-d="apendicitis"]'); await click('[data-a="cirugia"]'); await pg.selectOption('#de-cir', 'apendicectomia'); await click('[data-p="alta"]');
  await click('#de-ok'); await click('[data-t="empatia"]');
  // pánico familiar opcional
  for (let i = 0; i < 40; i++) { if (await pg.$('[data-f="calmar"]')) { await click('[data-f="calmar"]'); } if (await pg.$('[data-an]')) break; await pg.waitForTimeout(1000); }
  await click('[data-an="general"]'); for (const a of ['manos','gorro','bata','guantes']) await click(`[data-as="${a}"]`);
  await shot('01prep');
  await click('#qx-ok'); await pg.waitForTimeout(2500); await shot('02campo');
  await pg.waitForTimeout(6000); await shot('02campo');
  const jugarPaso = async () => pg.evaluate(async () => {
    const c = window.__juego.cir; if (!c || c.terminado) return 'fin';
    const espera = (ms) => new Promise(r => setTimeout(r, ms));
    const herr = { desinfectar: 'betadine', incision: 'bisturi', separar: 'separador', pinzar: 'pinzas', extirpar: 'tijeras', aspirar: 'aspirador', reducir: 'pinzas', malla: 'malla', suturar: 'portaagujas' };
    const p = c.paso; c.temblor = 0; c.ponerHerramienta(herr[p]);
    document.querySelector(`[data-h="${herr[p]}"]`)?.click();
    if (c.comp) { const fix = { hemorragia: null, fv: 'desfibrilador', desaturacion: 'oxigeno', bradicardia: 'atropina', despertar: 'anestesia', alergia: 'adrenalina' }[c.comp.tipo]; if (fix === 'desfibrilador') { c.emergencia(fix); await espera(1500); c.emergencia(fix); } else if (fix) c.emergencia(fix); else { c.ponerHerramienta('pinzas'); for (const v of c.vasos.filter(v => !v.ok)) { c.abajo(v); c.arriba(); } } }
    const traza = async (ruta) => { c.abajo(ruta[0]); for (let i = 1; i <= 40; i++) { const t = i / 40, k = t * (ruta.length - 1), a = ruta[Math.floor(k)], b = ruta[Math.min(ruta.length - 1, Math.floor(k) + 1)], f = k % 1; c.mover({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }); await espera(20); } c.arriba(); };
    if (p === 'desinfectar') { c.abajo(c.C); for (let a = 0; a < 40; a++) for (let r = 0; r < 220; r += 50) c.mover({ x: c.C.x + Math.cos(a / 40 * 6.3) * r, y: c.C.y + Math.sin(a / 40 * 6.3) * r }); c.arriba(); }
    if (p === 'incision') await traza([c.A, c.B]);
    if (p === 'separar') for (const a of c.asas) { c.abajo(a); c.arriba(); }
    if (p === 'pinzar') for (const v of c.vasos.filter(v => !v.ok)) { c.abajo(v); c.arriba(); }
    if (p === 'extirpar') await traza(c.rutaExt);
    if (p === 'aspirar') { for (let k = 0; k < 60 && c.charcos.length; k++) { const q = c.charcos[0]; c.abajo(q); await espera(60); c.arriba(); } }
    if (p === 'reducir') { c.abajo(c.obj); c.mover(c.objDest); c.arriba(); }
    if (p === 'malla') { c.abajo(c.C); c.arriba(); for (const t of c.tornillos) { c.abajo(t); c.arriba(); } }
    if (p === 'suturar') for (const q of c.puntadas.slice()) { c.abajo(q); c.arriba(); }
    return p;
  });
  for (let i = 0; i < 25; i++) { const r = await jugarPaso(); console.log('paso', r); if (r === 'incision') await shot('03incision'); if (r === 'extirpar') await shot('04extirpar'); if (r === 'fin') break; await pg.waitForTimeout(700); }
  await shot('05fin');
  await click('#op-ok'); await pg.waitForTimeout(8000);
  // terminar el día: pasar los pacientes restantes rápido
  await pg.evaluate(() => { window.__juego.G.pendientes = 1; });
  await pg.waitForSelector('#panel.on [data-q]', { timeout: 60000 }).catch(() => {});
  await shot('06siguiente');
  await libre();
  await click('[data-tab="decidir"]'); await pg.evaluate(() => document.querySelector(`[data-d="${window.__juego.pac.enfId}"]`).click()); await click('[data-a="casa"]'); await click('#de-ok'); await click('[data-t="directo"]');
  await click('#va-ok'); await pg.waitForSelector('#fd-sig', { timeout: 60000 }); await shot('07informe');
  await click('#fd-gest'); await shot('08gestion'); await click('[data-g="personal"]'); await click('[data-pe="enfermera"]'); await click('.gestion-modal .cerrar');
  await click('#fd-sig'); await pg.waitForSelector('#ro-ok', { timeout: 30000 }); await click('#ro-ok'); await pg.waitForTimeout(4000); await shot('09ronda');
  await libre(); await click('[data-s="receta"]'); await shot('10receta_planta'); await click('#sa-ok');
  await click('[data-s="alta"]'); await pg.waitForTimeout(6000); await shot('11alta');
  await b.close();
})();
