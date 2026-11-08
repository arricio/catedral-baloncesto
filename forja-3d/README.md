# FORJA 3D

Aplicación web (estilo Tripo AI) para crear modelos 3D a partir de **una imagen** o de **un texto**.

URL (GitHub Pages): `https://arricio.github.io/catedral-baloncesto/forja-3d/`

## Qué hace

- **Imagen a 3D**: sube, arrastra o pega una foto y obtén un modelo 3D con texturas.
- **Texto a 3D**: describe el objeto; primero se genera una imagen de referencia (FLUX.1) y luego se convierte a 3D.
- **Motores de IA** (Hugging Face Spaces, gratis con cupo diario de GPU):
  - `microsoft/TRELLIS.2`: la mejor calidad (geometría + materiales PBR).
  - `trellis-community/TRELLIS`: muy buena calidad.
  - `stabilityai/stable-fast-3d`: el más rápido.
  - **Automático**: prueba los tres en orden hasta que uno responda.
  - **Relieve local**: sin IA y sin internet; crea una figura «inflada» y cerrada a partir de la silueta.
- **Visor 3D**: girar, zoom, vista con textura, arcilla, malla de alambre o normales, suelo con sombra y captura PNG.
- **Descargas**: GLB (con texturas), STL (para imprimir, Z hacia arriba y escalado a la altura en mm) y OBJ.
- **Biblioteca**: cada modelo generado se guarda en el navegador (IndexedDB) con su miniatura.
- **Token de Hugging Face** opcional (Ajustes) para usar tu propio cupo de GPU y esperar menos.

## Estructura

```
index.html          Interfaz
styles.css          Estilos (oscuro, adaptado a móvil)
js/app.js           Controlador de la interfaz
js/motores.js       Conexión con los Spaces (cliente de Gradio) y cadena de respaldo
js/relieve.js       Motor local sin IA (silueta → malla cerrada)
js/visor.js         Visor three.js
js/exportar.js      Exportación GLB / STL / OBJ
js/biblioteca.js    Biblioteca en IndexedDB
vendor/             three.js r180 y @gradio/client 2.7.1 (copiados para no depender de CDN)
```

No necesita compilación: son módulos ES servidos tal cual. Para probarla en local:

```bash
python3 -m http.server 8000
# y abre http://localhost:8000/forja-3d/
```

## Limitaciones

- Los motores de IA dependen de Spaces públicos de Hugging Face: pueden estar dormidos, saturados o
  cambiar su API. Con el cupo gratuito agotado, la app lo indica y propone el token o el motor local.
- Las imágenes se suben temporalmente a esos Spaces para procesarlas.
