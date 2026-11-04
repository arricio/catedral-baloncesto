// Renderiza motion.html fotograma a fotograma y lo codifica con ffmpeg.
// Uso: node render.js salida.mp4 banda_sonora.wav [fps] [--stills t1,t2,...]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const [out, audio, fpsArg] = process.argv.slice(2);
  const stillsIdx = process.argv.indexOf('--stills');
  const fps = Number(fpsArg) || 30;
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('ERROR página:', e.message));
  await page.goto('file://' + path.resolve(__dirname, 'motion.html') + '?render');
  await page.evaluate(() => window.ready);
  const grab = async t => {
    const url = await page.evaluate(t => { window.renderFrame(t); return document.getElementById('cv').toDataURL('image/jpeg', 0.95); }, t);
    return Buffer.from(url.split(',')[1], 'base64');
  };

  if (stillsIdx > 0) {
    for (const t of process.argv[stillsIdx + 1].split(',').map(Number)) fs.writeFileSync(`${out}_${t.toFixed(2)}.jpg`, await grab(t));
    await browser.close();
    return;
  }

  const duration = await page.evaluate(() => DURATION);
  const n = Math.round(duration * fps);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-i', audio, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-vf', 'setsar=1', '-aspect', '16:9', '-metadata:s:v', 'rotate=0',
    '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const buf = await grab(i / fps);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 60 === 0) console.log(`fotograma ${i}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await browser.close();
  console.log('listo', out);
})();
