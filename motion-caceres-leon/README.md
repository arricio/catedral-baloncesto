# Cáceres vs Cultural Leonesa — Motion Graphics (2ª FEB · Jornada 6)

Vídeo de 51 s, 1920×1080 (16:9), 30 fps: `caceres-leon-jornada6.mp4` (página de reproducción: `index.html`).

## Escenas
| Tiempo | Escena |
|---|---|
| 0–5 s | Intro: Jornada 6 · Sábado 7 de noviembre · 19:00 horas · Pabellón Multiusos de Cáceres |
| 5–9 s | Presentación del Cáceres |
| 9–13 s | Presentación de la Cultural Leonesa |
| 13–17 s | Cara a cara «VS» |
| 17–21 s | Clasificación: 4-1 frente a 4-1 |
| 21–40,5 s | El partido: las camisetas juegan y encestan en las dos canastas (marcador sin números); al acabar se giran una hacia la otra, se abrazan y vuelven de frente a la cámara |
| 40,5–51 s | RESULTADO → escudos con el corazón → «DOS AFICIONES HERMANADAS» + locución |

Locución: «El resultado final del partido es… ¡que Cáceres y León molan mogollón!» (voz con acento de España generada con OpenAI `gpt-4o-mini-tts`, `src/assets/locucion.wav`).

## Cómo se ha hecho
- `src/motion.html`: animación en canvas, determinista (`renderFrame(t)`).
- `src/match-data.js`: guion del partido (posiciones, saltos, tiros); lo comparten la animación y el audio.
- `src/render.js`: Playwright captura cada fotograma y ffmpeg codifica en H.264 + AAC.
- `src/music.py`: banda sonora y efectos (silbato, botes, red, público, bocina) sintetizados y sincronizados.

Regenerar:
```bash
python3 src/music.py banda.wav src/assets/locucion.wav 42.1 51.0
node src/render.js caceres-leon-jornada6.mp4 banda.wav 30
```

## Versiones enmarcadas para redes sociales
`src/marco.html` + `src/marco.js` colocan el vídeo dentro de un marco con encabezado (fecha y dedicatoria a la Peña KamiCáceres y a la afición del Cáceres Patrimonio de la Humanidad) y pie («El vídeo y todo el montaje ha sido generado con IA»), en dos formatos: 4:5 (1080×1350) y 16:9 (1920×1080).

```bash
node src/marco.js caceres-leon-jornada6.mp4 carpeta_salida
```
