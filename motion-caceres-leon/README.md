# Cáceres vs Cultural Leonesa — Motion Graphics (2ª FEB · Jornada 6)

Vídeo de 48,5 s, 1920×1080 (16:9), 30 fps: `caceres-leon-jornada6.mp4` (página de reproducción: `index.html`).

## Escenas
| Tiempo | Escena |
|---|---|
| 0–5 s | Intro: Jornada 6 · Sábado 7 de noviembre · 19:00 horas · Pabellón Multiusos de Cáceres |
| 5–9 s | Presentación del Cáceres |
| 9–13 s | Presentación de la Cultural Leonesa |
| 13–17 s | Cara a cara «VS» |
| 17–21 s | Clasificación: 4-1 frente a 4-1 |
| 21–38 s | El partido: las camisetas juegan y encestan en las dos canastas (marcador sin números) |
| 38–48,5 s | RESULTADO → escudos con el corazón → «DOS AFICIONES HERMANADAS» + locución |

Locución: «El resultado final del partido es… ¡que Cáceres y León molan mogollón!» (voz con acento de España generada con OpenAI `gpt-4o-mini-tts`, `src/assets/locucion.wav`).

## Cómo se ha hecho
- `src/motion.html`: animación en canvas, determinista (`renderFrame(t)`).
- `src/match-data.js`: guion del partido (posiciones, saltos, tiros); lo comparten la animación y el audio.
- `src/render.js`: Playwright captura cada fotograma y ffmpeg codifica en H.264 + AAC.
- `src/music.py`: banda sonora y efectos (silbato, botes, red, público, bocina) sintetizados y sincronizados.

Regenerar:
```bash
python3 src/music.py banda.wav src/assets/locucion.wav 39.6 48.5
node src/render.js caceres-leon-jornada6.mp4 banda.wav 30
```
