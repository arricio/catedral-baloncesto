# Cáceres vs Cultural Leonesa — Motion Graphics (2ª FEB · Jornada 6)

Vídeo de 37 s, 1920×1080, 30 fps: `caceres-leon-jornada6.mp4` (página de reproducción: `index.html`).

## Escenas
| Tiempo | Escena |
|---|---|
| 0–4 s | Intro: «Liga · 2ª FEB — JORNADA 6 — Sábado 7 de noviembre» |
| 4–8 s | Presentación del Cáceres (escudo, balance 4V · 1D) |
| 8–12 s | Presentación de la Cultural Leonesa (escudo, balance 4V · 1D) |
| 12–16 s | Cara a cara «VS» en pantalla partida verde/roja |
| 16–20 s | Las equipaciones |
| 20–24 s | Clasificación: 4-1 frente a 4-1, «Duelo de iguales» |
| 24–28 s | Hermanamiento: «Dos aficiones hermanadas» |
| 28–30 s | «Este sábado» |
| 30–37 s | Locución final: «¡CÁCERES Y LEÓN, MOLAN MOGOLLÓN!» |

## Cómo se ha hecho
- `src/motion.html`: animación en canvas, determinista (`renderFrame(t)`). Abierta en el navegador hace una vista previa (clic para sonido).
- `src/render.js`: Playwright captura cada fotograma y ffmpeg codifica en H.264 + AAC.
- `src/music.py`: banda sonora original sintetizada (120 BPM, re menor) con impactos sincronizados y *ducking* bajo la voz.
- Locución: síntesis de voz local (Piper, voz española `es_ES-sharvard`), procesada con EQ, compresión y eco de pabellón (`src/assets/locucion.wav`).

Regenerar:
```bash
python3 src/music.py banda.wav src/assets/locucion.wav 30.0 37.0
node src/render.js caceres-leon-jornada6.mp4 banda.wav 30
```
