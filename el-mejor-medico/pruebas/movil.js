const { chromium } = require('playwright');
const turnos = require('./turnos.js');
const S = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const run = async (w, h, pref, cal, flujo) => {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 500 });
    pg.on('pageerror', e => console.log('ERR', e.message));
    const click = async (sel) => { await pg.waitForSelector(sel, { timeout: 30000 }); await pg.evaluate((s) => document.querySelector(s).click(), sel); await pg.waitForTimeout(150); };
    const shot = async (n) => { await pg.waitForTimeout(2500); await pg.screenshot({ path: `${S}/${pref}_${n}.png` }); console.log(pref, n); };
    await pg.goto('http://localhost:8766/index.html' + (flujo === 'qx' ? '?caso=colecistitis' : ''));
    await pg.waitForSelector('#inicio.on');
    await pg.evaluate((c) => window.__juego.mundo.ponerCalidad(c), cal);
    if (flujo === 'og') { await click('#b-nueva'); await click('#cr-ok'); await click('#int-ok'); await pg.waitForTimeout(6000); await pg.evaluate(() => { document.querySelector('#panel').style.display='none'; document.querySelector('#hud').style.display='none'; document.querySelector('#subtitulo').style.display='none'; }); await shot('og'); }
    else {
      await shot('inicio'); await click('#b-nueva'); await shot('creador'); await click('#cr-ok'); await click('#int-ok'); await shot('consulta');
      await click('[data-tab="decidir"]'); await shot('decidir'); await click('.modal .cerrar');
      if (flujo === 'qx') { await pg.waitForFunction(() => !document.querySelector('#panel').classList.contains('ocupado'), null, { timeout: 60000 }); await click('[data-tab="decidir"]'); await click('[data-d="colecistitis"]'); await click('[data-a="cirugia"]'); await pg.selectOption('#de-cir', 'colecistectomia'); await click('#de-ok'); await click('[data-t="empatia"]');
        const T = turnos(pg);
        for (let i = 0; i < 60; i++) { if (await pg.$('[data-an]')) break; if (await pg.$('[data-f="calmar"]')) { await click('[data-f="calmar"]'); continue; } const e = await T.espera(); if (e === 'medico') await T.hablar(); else if (e === 'paciente') await T.responder(); else await pg.waitForTimeout(500); }
        await click('[data-an="local"]'); await click('#qx-ok'); await pg.waitForTimeout(8000);
        await pg.evaluate(() => { const c = window.__juego.cir; c.temblor = 0; c.ponerHerramienta('bisturi'); c.pasos.shift(); c.iPaso = 0; c.empezarPaso(); c.abajo(c.A); for (let i = 1; i <= 30; i++) c.mover({ x: c.A.x + (c.B.x - c.A.x) * i / 30, y: c.A.y + (c.B.y - c.A.y) * i / 30 }); c.arriba(); c.ponerHerramienta('separador'); c.asas.forEach(a => { c.abajo(a); c.arriba(); }); c.lanzar('hemorragia'); });
        await shot('quirofano');
      }
    }
    await pg.close();
  };

  await run(390, 844, 'm', 'baja', 'qx');
  await b.close();
})();
