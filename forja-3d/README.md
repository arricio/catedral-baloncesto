# FORJA 3D

Aplicación web al estilo de Tripo AI: **crea, anima, edita y exporta modelos 3D** desde el navegador.

URL (GitHub Pages): `https://arricio.github.io/catedral-baloncesto/forja-3d/`

## Crear (con IA, en Hugging Face Spaces gratuitos)

| Modo | Qué hace | Motores |
|---|---|---|
| **Imagen → 3D** | Una foto se convierte en modelo con textura | TRELLIS.2, TRELLIS, Hunyuan3D-2, Stable Fast 3D (modo automático con respaldo) |
| **Modelo ya articulado** | Foto → modelo con esqueleto y pesos, listo para animar | AniGen (Tripo) |
| **Texto → 3D** | Texto → imagen (1 o 4 propuestas para elegir) → 3D | FLUX.1 + los anteriores |
| **Multivista → 3D** | Frente, espalda, izquierda y derecha del mismo objeto | Hunyuan3D-2mv + textura MV-Adapter |
| **Boceto → 3D** | Dibujas con el dedo o el ratón y describes el objeto | TripoSG Scribble (Tripo) + color MV-Adapter |
| **Relieve local** | Sin IA ni internet: silueta → figura cerrada | Local |

## Editar

- **Animar**: esqueleto automático para humanoides, cuadrúpedos u objetos, con **articulaciones
  arrastrables** (y simetría) antes de aplicar. Pesos de piel calculados en el navegador.
  Opción de **esqueleto con IA** (SkinTokens, de Tripo). Animaciones incluidas:
  - Humanoide: reposo, caminar, correr, saltar, saludar, bailar, golpear, girar.
  - Cuadrúpedo: reposo, caminar, trotar, saltar, mover la cola, girar.
  - Objeto: rebotar, balancearse, bailar, girar, flotar, gelatina.
  Funcionan también sobre esqueletos que vienen de la IA o de archivos (se deduce el papel de cada hueso).
  Se exportan en **GLB animado** o en **vídeo** (MP4/WebM).
- **Estilo**: vóxel, ladrillos de construcción (con tetones y paleta clásica), low poly, dibujo animado
  (con contorno), arcilla, oro, plata, bronce, porcelana, cristal y holograma.
- **Textura**: retexturizado con IA por texto o por imagen (MV-Adapter, de Tripo), **pincel** para pintar
  directamente sobre el modelo y ajustes de material (tono, rugosidad, metalizado).
- **Partes**: segmentación en piezas sueltas, zonas del cuerpo (humanoide o animal) o bloques;
  ver, ocultar, aislar y descargar cada parte en STL o GLB.
- **Optimizar**: reducción de polígonos con objetivo, facetado low poly, reorientación y
  **análisis para impresión 3D** (malla cerrada, volumen, superficie y gramos de PLA estimados).
- **Deshacer / rehacer** (Ctrl+Z / Ctrl+Y) en todas las operaciones.

## Exportar

GLB (con texturas y animaciones), STL, 3MF, OBJ, PLY con color, USDZ (realidad aumentada en iPhone),
captura PNG, vídeo 360° y compartir. Biblioteca local (IndexedDB) con miniaturas y animaciones.
También abre archivos GLB, GLTF, STL y OBJ.

## Estructura

```
index.html, styles.css
js/app.js          Interfaz y flujo de trabajo (historial, pestañas, biblioteca)
js/motores.js      Conexión con los Spaces (cliente de Gradio), cadena de respaldo, IA de textura y rig
js/visor.js        Visor three.js: modos de vista, animación, esqueleto, articulaciones, vídeo
js/rig.js          Esqueleto automático, pesos de piel y lectura de esqueletos ajenos
js/animaciones.js  Animaciones procedurales por roles de hueso
js/estilos.js      Vóxel, ladrillos, low poly, reducción y materiales
js/partes.js       Segmentación
js/pincel.js       Pintura sobre textura o colores de vértice
js/geometria.js    Utilidades geométricas y análisis de impresión
js/exportar.js     GLB, STL, 3MF, OBJ, PLY, USDZ
js/relieve.js      Motor local sin IA
vendor/            three.js r180 y @gradio/client 2.7.1 (copiados para no depender de CDN)
```

Sin compilación: módulos ES servidos tal cual (`python3 -m http.server` y abrir `/forja-3d/`).

## Limitaciones conocidas

- Los motores de IA son Spaces públicos de Hugging Face: pueden estar dormidos, saturados o cambiar su API.
  Con el cupo gratuito agotado la app lo indica; con un token propio (Ajustes) se espera menos.
- El esqueleto automático local espera el modelo de pie y mirando al frente; para poses raras conviene
  ajustar las articulaciones a mano o usar el esqueleto con IA.
- La reducción de polígonos convierte la textura en colores por vértice (no es una retopología a quads).
- No exporta FBX (no hay un exportador fiable en el navegador); GLB es el formato equivalente recomendado.
