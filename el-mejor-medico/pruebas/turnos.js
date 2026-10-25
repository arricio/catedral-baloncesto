// Ayudas para las pruebas: la conversación va por turnos (ENVIAR · HABLAR MÉDICO / RESPONDER PACIENTE).
// Las pruebas no suenan: se desactivan las voces (el juego sigue calculando qué voz usaría cada personaje).
module.exports = (pg) => {
  const silenciar = () => pg.evaluate(() => { const G = window.__juego.G; if (G) G.ajustes.voz = false; });
  silenciar().catch(() => {});
  const libreCharla = () => pg.waitForFunction(() => { const c = window.__juego.charla; return !c.pensando && !c.entregando && !document.querySelector('#panel').classList.contains('ocupado'); }, null, { timeout: 90000 });
  // sin texto: usa la sugerencia del juego, como haría el jugador al pulsarla
  const hablar = async (texto) => {
    await silenciar();
    if (texto != null) await pg.fill('#ch-texto', texto);
    else if (!(await pg.inputValue('#ch-texto')).trim()) { await pg.waitForSelector('#ch-sug:not([hidden]) #ch-sug-usar', { timeout: 30000 }); await pg.evaluate(() => document.querySelector('#ch-sug-usar').click()); }
    await pg.waitForFunction(() => !document.querySelector('#ch-medico').disabled, null, { timeout: 90000 });
    await pg.evaluate(() => document.querySelector('#ch-medico').click());
    await pg.waitForTimeout(150); await libreCharla();
  };
  const responder = async () => {
    await silenciar();
    await pg.waitForFunction(() => !document.querySelector('#ch-paciente').disabled, null, { timeout: 90000 });
    await pg.evaluate(() => document.querySelector('#ch-paciente').click());
    await pg.waitForTimeout(150); await libreCharla();
  };
  const espera = () => pg.evaluate(() => { const c = window.__juego.charla; return c.espera ? c.espera.tipo : null; });
  // avanza los turnos del guion hasta que aparezca un selector (o se cumpla una condición en la página)
  const avanzarHasta = async (fin, max = 40) => {
    const listo = () => typeof fin === 'string' ? pg.$(fin) : pg.evaluate(fin);
    for (let i = 0; i < max; i++) {
      if (await listo()) return;
      const e = await espera();
      if (e === 'medico') await hablar(); else if (e === 'paciente') await responder(); else await pg.waitForTimeout(500);
    }
    if (typeof fin === 'string') await pg.waitForSelector(fin, { timeout: 5000 });
    else throw new Error('No se ha llegado al final esperado');
  };
  return { silenciar, libreCharla, hablar, responder, espera, avanzarHasta };
};
