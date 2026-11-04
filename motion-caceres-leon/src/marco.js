// Genera la imagen del marco y monta el vídeo dentro con ffmpeg.
// Uso: node marco.js video.mp4 salida_dir
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');

const LAYOUTS = {
  // 4:5 para publicaciones de Instagram / Facebook
  '4x5': { w: 1080, h: 1350, hx: 30, hy: 572, hw: 1020, hh: 574, headTop: 26, headBot: 548, footTop: 1170, footBot: 1330, pad: 46, gap: 22, date: 78, ded: 37, pd: 52, ft: 31 },
  // 16:9 horizontal
  '16x9': { w: 1920, h: 1080, hx: 400, hy: 330, hw: 1120, hh: 630, headTop: 22, headBot: 312, footTop: 978, footBot: 1066, pad: 70, gap: 12, date: 60, ded: 32, pd: 44, ft: 32 },
};

(async () => {
  const [video, outDir] = process.argv.slice(2);
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  for (const [name, L] of Object.entries(LAYOUTS)) {
    const page = await browser.newPage({ viewport: { width: L.w, height: L.h } });
    const qs = new URLSearchParams(Object.entries(L).map(([k, v]) => [k, String(v)])).toString();
    await page.goto('file://' + path.resolve(__dirname, 'marco.html') + '?' + qs);
    const fit = await page.evaluate(() => window.ready);
    console.log(name, 'cabe el texto:', JSON.stringify(fit));
    const png = path.join(outDir, `marco_${name}.png`);
    await page.locator('#f').screenshot({ path: png });
    await page.close();
    const out = path.join(outDir, `Caceres-Leon-Jornada6-marco-${name}.mp4`);
    if (process.env.SOLO_PNG) continue; // solo genera la imagen del marco
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-framerate', '30', '-i', png, '-i', video,
      '-filter_complex', `[1:v]scale=${L.hw}:${L.hh}:flags=lanczos,setsar=1[v];[0:v][v]overlay=${L.hx}:${L.hy}:shortest=1,format=yuv420p,setsar=1[o]`, '-aspect', `${L.w}:${L.h}`,
      '-map', '[o]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'high', '-r', '30',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out]);
    console.log('listo', out);
  }
  await browser.close();
})();
