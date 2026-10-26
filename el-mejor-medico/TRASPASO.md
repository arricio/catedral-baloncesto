# EL MEJOR MÉDICO: informe de continuidad

Informe para continuar el desarrollo en una sesión **local** de Claude Code (portátil Lenovo Legion con Windows, con Blender 5.2.2 LTS y Unreal Engine 5.8 conectados por MCP) sin empezar de cero.

Fecha del traspaso: 25 de octubre de 2026.
Último commit subido: `753e93d EL MEJOR MÉDICO: peinados modelados en Blender`. Este informe y la carpeta `pruebas/` van en el commit siguiente.

---

## 1. Dónde está todo

| Dato | Valor |
|---|---|
| Repositorio de GitHub | `https://github.com/arricio/catedral-baloncesto` |
| Rama de trabajo correcta | **`claude/medical-simulator-game-ruh821`** |
| Carpeta del juego dentro del repositorio | `el-mejor-medico/` |
| Rama `main` | **No** contiene el juego todavía; no hay pull request creado |
| Cambios sin subir | Ninguno: todo está subido a la rama |
| Otros proyectos del mismo repositorio (NO tocar) | `laser-marmol/`, `impresora-3d/`, `catedral_baloncesto_juego_*.html` |
| «MI GRANJA» | No está en este repositorio y no tiene relación con este juego. No mezclar. |

Para jugar en local: servir la carpeta `el-mejor-medico/` con cualquier servidor estático y abrir `index.html`. Los módulos ES no funcionan abriendo el archivo con doble clic.

Cuando se fusione en `main`, si el repositorio publica con GitHub Pages desde `main`, la dirección será `https://arricio.github.io/catedral-baloncesto/el-mejor-medico/`. Hay que comprobarlo en Settings → Pages.

---

## 2. Todas las instrucciones del usuario (no se puede incumplir ninguna)

1. Hacer un juego como el del vídeo y las capturas de referencia (estilo simulador de médico de Steam), **con la mayor calidad gráfica posible**.
2. El juego se llama **«EL MEJOR MÉDICO»**. No debe aparecer **nada** de «DOCTOR SIMULATOR» en ningún sitio: título, textos, código ni imágenes.
3. **Voces y audios en español de España.** Responder siempre al usuario en español de España.
4. Se puede **recetar cualquier cosa**:
   - cualquier medicamento;
   - cualquier comida: cocido leonés, callos, cualquier pescado o marisco, embutidos…;
   - cualquier bebida: agua, vino, cerveza, orujo, coñac, ron, refrescos…
5. El médico **habla** con los pacientes y los pacientes **cuentan lo que les pasa**.
6. La descripción del juego que dio el usuario incluye:
   - Hospital San Marcos;
   - exploración, pruebas (sangre, radiografía, TAC…) y diagnóstico;
   - simuladores y secretos vergonzosos;
   - cirugía con elección de anestesia y complicaciones;
   - dar malas noticias con tacto y familiares nerviosos;
   - reputación y dinero;
   - ampliar el hospital y contratar especialistas;
   - renombrar el hospital en honor al médico.
7. El **nombre del médico** lo elige el jugador y se puede cambiar.
8. **Creador del médico:**
   - cara, pelo, cuerpo y vello facial;
   - gafas;
   - varios modelos de ropa y de batas.
9. Los **nombres de los pacientes** se pueden poner y cambiar.
10. Usar **Blender y Unreal Engine** mediante sus conectores.
11. Muchos **pacientes distintos**, como en la vida real:
    - abuelos y abuelas;
    - niños y niñas de varias edades;
    - bebés;
    - jóvenes y adultos.
12. Mujeres con **pechos pequeños, normales, grandes y muy grandes**. El usuario corrigió: «se distingue el tamaño, pero eso no parecen pechos». Por eso se rehízo la forma, que debe parecer real.
13. «Conecta el Blender en la nube, pero **haz el juego aquí en el móvil**»: el juego tiene que funcionar en el móvil.
14. «Sigue mejorando el juego del móvil con Blender»: esa era la tarea en curso en el momento del traspaso.
15. Para este traspaso:
    - no eliminar, sobrescribir ni modificar archivos existentes sin necesidad;
    - **no cambiar de motor gráfico ni migrar** sin comprobar antes la compatibilidad;
    - conservar todas las funcionalidades.

Reglas de trabajo que se han seguido:
- Los commits van a la rama `claude/medical-simulator-game-ruh821`.
- No se crea un pull request salvo que el usuario lo pida.

16. **Actualización del 25 de octubre de 2026** (petición «ACTUALIZACIÓN COMPLETA»):
    - el jugador controla toda la conversación: escribe o dicta lo que dice el médico; **HABLAR MÉDICO** y **RESPONDER PACIENTE** son botones independientes; nadie habla sin pulsar su botón;
    - respuestas de los pacientes con IA generativa, coherentes con su edad, personalidad, enfermedad e historial, sin conocer el diagnóstico; distinguir IA de respuestas predefinidas;
    - recetas escritas por el jugador (medicamento, dosis, frecuencia, duración, recomendaciones), con **CONFIRMAR RECETA**, lectura fiel por el médico al pulsar HABLAR MÉDICO, entrega física en mano y respuesta del paciente al pulsar RESPONDER PACIENTE;
    - voces diferenciadas por edad y sexo, en español de España, estables por personaje;
    - mando Xbox (Gamepad API), teclado y ratón, táctil;
    - versiones instalables para Android (APK) y Windows (EXE o MSIX), sin suscripciones ni servicios de pago sin autorización;
    - no afirmar que algo funciona sin probarlo; distinguir pruebas automáticas de pruebas en los dispositivos reales (Xiaomi 17 Ultra y Lenovo Legion).

---

## 2 bis. Estado tras la actualización del 25 de octubre de 2026

Hecho y probado con pruebas automáticas (`pruebas/charla.js`, 104 comprobaciones):
- **Conversación por turnos** (`js/juego.js`, sección «Conversación por turnos»): barra `#charla` con cuadro de texto, ✎ ESCRIBIR, 🎤 MICRÓFONO, HABLAR MÉDICO (azul) y RESPONDER PACIENTE (ámbar), con indicador de turno. Las preguntas del panel sólo rellenan el cuadro. Todos los diálogos del guion (llegada, noticia, receta, despedida, ingreso, familia en pánico, quirófano, ronda) usan `turnoMedico()` / `turnoPaciente()`, que esperan al botón. Lo que un acompañante o el niño quieren añadir queda pendiente y sólo se oye si se vuelve a pulsar RESPONDER.
- **Corrección prioritaria del usuario (25/10/2026)**: «el médico sólo habla cuando yo se lo ordeno y el paciente sólo responde cuando pulso su botón». Por eso: el cuadro empieza siempre vacío y las frases del juego sólo se ofrecen como «Sugerencia (opcional)» (`proponer()`), que hay que pulsar para copiarla y se puede cambiar; la única excepción es la receta, que ha escrito el propio jugador. Al explorar, el médico nunca habla (sólo subtítulos, `narrar()`) y el paciente reacciona con la cara y en los subtítulos sin voz (`reaccion()`). Se eliminó la opción «frasesAuto». El botón se llama «ENVIAR · HABLAR MÉDICO». Las frases de prueba de voces sólo existen en Ajustes › «Probar voces por edades». Las pruebas automáticas desactivan la voz para que no se oigan en el portátil.
- **IA real instalada (25/10/2026, con autorización del usuario)**: Ollama 0.40 en el portátil (`%LOCALAPPDATA%\Programs\Ollama`) con el modelo Qwen2.5 3B (Q4_K_M, 2 GB, gratuito). El almacén de Ollama (Cloudflare R2) no responde desde esta conexión, así que se descargó de Hugging Face con `ollama pull hf.co/Qwen/Qwen2.5-3B-Instruct-GGUF:Q4_K_M` y se copió como `qwen2.5:3b`. Funciona al 100 % en la RTX 3050; cada respuesta tarda unos 3–12 s. `pruebas/ia_real.js` mantiene conversaciones de 4 turnos con 7 edades usando la IA real. Mejoras del prompt tras leer las transcripciones: no repetir la pregunta del médico (`esEco`, con un reintento), contar los datos con sus propias palabras, niños en primera persona y sin vocabulario de adulto, género correcto del paciente en boca del familiar.
- **IA automática**: al empezar el día, si hay un Ollama en `localhost:11434`, se activa solo con el mejor modelo instalado (`detectarIA`, `detectarOllama`, `elegirModelo`); si el jugador elige el modo a mano en Ajustes, se respeta. La barra indica siempre si las respuestas son de IA o predefinidas.
- **IA** (`js/ia.js`): modos `predefinida` (por defecto, sin Internet), `ollama` y `openai` (servidor local compatible). Prompt con los datos del paciente, personalidad estable, estilo por edad, historial de la consulta y respuesta de referencia del juego. Si la IA falla o tarda, se usa la predefinida y se avisa. Subtítulos con etiqueta «IA» o «predefinida». La conversación se guarda en `pac.charla` (también para los ingresados).
- **Mecánica conservada**: la frase libre se clasifica (`clasificar`, `intenciones`) para seguir anotando hallazgos, confianza y secretos. Los secretos revelados se dicen con el texto del juego (`fija`).
- **Recetas** (`editorReceta`, `lineasReceta`, `explicarYEntregarReceta`): campos libres, recomendaciones que también puntúan (`itemsDeIndicaciones`), revisión y confirmación obligatoria antes de comunicar, lectura con abreviaturas desarrolladas (`leerNatural`) y subtítulo exacto, entrega física (`Mundo.entregarPapel` en `escena.js`, papel con el texto exacto `texReceta`).
- **Voces** (`js/audio.js`): 8 grupos de edad (`GRUPOS_VOZ`, `perfilVoz`), sólo voces es-ES, variación estable por personaje, emociones (`EMOCIONES`). Prueba en Ajustes › «Probar voces por edades».
- **Boca y caras**: la boca sigue las palabras que marca el sintetizador (`Voz.alPalabra`); expresiones (alegría, dolor, tristeza, miedo, preocupación) en cejas, párpados, labios y cabeza (`EXPRESIONES` en `escena.js`).
- **Mando** (`js/mando.js`): detección automática, navegación con cruceta, A/B, X = HABLAR MÉDICO, Y = RESPONDER PACIENTE, LT = micrófono, cursor virtual con RT en estetoscopio, imágenes y quirófano, LB/RB instrumentos, MENÚ, VISTA (controles), teclado virtual, sensibilidad y zona muerta en Ajustes.
- **Dictado** (`js/dictado.js`): reconocimiento de voz del navegador en es-ES; preparado para el complemento de Capacitor en Android.
- Corregido un fallo antiguo: al operar desde la ronda se llamaba a `siguienteIngresado()`, que no existía.
- Depuración nueva: `?edad=<años>` y `?sexo=h|m`.

Pendiente o limitado:
- **Voces infantiles y de ancianos reales**: el sistema de voz del dispositivo no las tiene; ahora se simulan con la voz más parecida, tono y ritmo. Alternativas a valorar con el usuario: Piper (gratuito, local, sin voces infantiles en es-ES) o servicios de pago.
- **APLICACIÓN ANDROID INDEPENDIENTE (26/10/2026, requisito obligatorio del usuario)**: «jugar en el Xiaomi 17 Ultra sin depender del portátil», con IA generativa real dentro del móvil y sin Internet después de la primera descarga. La conexión por wifi con el portátil (abajo) queda sólo para pruebas.
  - Proyecto en `app-android/` (Capacitor 8.5.3). `herramientas/preparar-web.js` copia el juego a `www/`, que no se versiona, y añade el puente de Capacitor. El juego **no se duplica**: es el mismo Three.js de la carpeta de arriba.
  - **IA**: `IALocalPlugin.kt` usa **LiteRT-LM 0.18.1** (Google AI Edge, Apache 2.0) con **Gemma 4 E2B** (`gemma-4-E2B-it.litertlm`, 2 588 147 712 bytes, SHA-256 `181938105e0e…b97139a63c`, Apache 2.0, sin cuenta), en la GPU con paso al procesador si falla. **OJO**: `gemma-4-E2B-it-gpu.litertlm` y `-web.litertlm` (2 008 432 640 bytes) son para navegadores; LiteRT-LM de Android no los abre («tf_lite_prefill_decode not found in the model»). La versión 1.0 del APK usaba ese archivo por error; la 1.0.1 lo borra al arrancar. El modelo se descarga una vez de Hugging Face (descarga reanudable y comprobación de la huella SHA-256) o se importa desde un archivo (también se comprueba la huella). Se guarda en `filesDir/modelos` y se conserva al actualizar. En el juego es el modo `movil` (`ia.js` › `llamar`; `juego.js` › `detectarIAMovil`, `instalarIAMovil`). Si aún está cargando, RESPONDER espera; si no hay modelo, se ofrece instalarlo y se avisa de que las respuestas son predefinidas.
  - Alternativas evaluadas: llama.cpp con Qwen2.5 3B (NDK, sólo procesador, más frágil), Qwen en LiteRT-LM (sólo 1,5B o menos) y WebLLM/MediaPipe web (WebGPU en el WebView sin garantía). Gemma 4 E2B se probó en el portátil con Ollama (`MODELO=hf.co/unsloth/gemma-4-E2B-it-GGUF:Q4_K_M node pruebas\ia_real.js`): buen español de España y trato de usted; a veces se contradice, por eso el prompt le recuerda lo que ya ha dicho.
  - **Voz**: `VozNativaPlugin.kt` usa el TTS de Android, sólo con voces es-ES instaladas (sin red), tono y ritmo por edad, y marca cada palabra para mover la boca. En `audio.js` imita la interfaz de `speechSynthesis`.
  - **Micrófono**: `DictadoNativoPlugin.kt` usa el reconocedor del propio dispositivo (`createOnDeviceSpeechRecognizer`, sin Internet) si existe; si no, el normal con `EXTRA_PREFER_OFFLINE`. Puede pedir la descarga del español. El texto va al cuadro y el médico no habla hasta pulsar el botón.
  - **Firma**: la clave está en `%USERPROFILE%\.el-mejor-medico-firma\` (`elmejormedico.jks` y `firma.properties`), **fuera del repositorio**. Si se pierde, el siguiente APK no se podrá instalar encima y se perderán las partidas: hay que hacer copia de seguridad.
  - **Herramientas en el portátil** (instaladas con autorización): JDK 21 Temurin portátil en `%LOCALAPPDATA%\Programs\jdk21`, herramientas del SDK de Android en `%LOCALAPPDATA%\Android\Sdk`. Las licencias del SDK las acepta el usuario con `app-android\herramientas\aceptar-licencias-sdk.cmd`.
  - **Compilar el APK** (primer APK compilado el 26/10/2026, versión 1.0, 53,8 MB, arm64-v8a y x86_64): SDK con `platform-tools`, `platforms;android-36` y `build-tools` 35.0.0 y 36.0.0; `android/local.properties` con `sdk.dir` (no se versiona). Desde `app-android`: `npm run web`, `npx cap sync android` y, con `JAVA_HOME` apuntando al JDK 21, `android\gradlew.bat assembleRelease` lanzado con la carpeta `android` como directorio de trabajo (desde PowerShell, `Start-Process -WorkingDirectory`; `cmd /c "cd /d … && gradlew"` falla por las comillas). Sale en `android/app/build/outputs/apk/release/app-release.apk`; se copia a `app-android/builds/` (no se versiona). Para actualizar, subir `versionCode` en `app/build.gradle` y firmar siempre con la misma clave. Con `Start-Process -Wait` hay que añadir `--no-daemon` (si no, el demonio de Gradle deja la orden colgada aunque termine). Versión actual: **1.0.1** (`versionCode` 2), firmas v2 y v3, copias de seguridad sin el modelo (`res/xml/copia_seguridad.xml` y `extraccion_datos.xml`), librerías nativas alineadas a 16 KB.
  - **Play Protect** (26/10/2026): en el Xiaomi bloqueó la 1.0 con «Aplicación bloqueada para proteger tu dispositivo · Play Protect no conoce ninguna otra aplicación de este desarrollador». La guía oficial (developers.google.com/android/play-protect/warning-dev-guidance) dice que ese bloqueo salta con READ_SMS, RECEIVE_SMS, BIND_NOTIFICATION_LISTENER_SERVICE o BIND_ACCESSIBILITY_SERVICE, y el APK no pide ninguno: lo que falta es reputación del desarrollador (clave nueva, instalación fuera de Play). Sin desactivar Play Protect: «Más detalles › Instalar de todas formas» si aparece; instalar por USB con adb (depuración USB; en Xiaomi además «Instalar vía USB»); o apelar en support.google.com/googleplay/android-developer/contact/protectappeals (cuenta de Google, gratis). La verificación obligatoria de desarrolladores empezó el 30/09/2026 en Brasil, Indonesia, Singapur y Tailandia; a España llegará en 2027 (cuenta gratuita de «distribución limitada», hasta 20 dispositivos).
  - **Prueba en Android real (emulador)**: `pruebas/android_emulador.js` maneja con Playwright la copia de pruebas `es.elmejormedico.juego.prueba` (`assembleDebug`, depurable, se instala aparte) en el emulador Android 16 con Google Play (`emm36`, WHPX). El modelo se copia con `adb push` a `/data/local/tmp/m.litertlm` y la prueba lo pone en la app con `run-as`. Ejecuta el Kotlin, LiteRT-LM y Gemma de verdad (en el procesador; la «GPU» del emulador es software y muy lenta). 26/10/2026: 10 de 10, también en modo avión; respuestas en 5–16 s en el procesador del emulador. Encontró dos fallos que la simulación no veía: `addListener` de Capacitor no devuelve promesa (la boca no se movía) y `esEco` rechazaba «No he tenido fiebre» por compartir palabras con la pregunta.
  - Prueba automática: `pruebas/app_simulada.js` (la parte JavaScript de la app con los módulos nativos simulados; Gemma responde desde fuera de la página y la página no tiene red de IA). **No ejecuta el Kotlin ni la GPU del móvil**: la prueba definitiva la hace el usuario en el Xiaomi, con el portátil apagado y en modo avión.
- **IA en el móvil por wifi (26/10/2026, sólo para pruebas)**: `JUGAR-EN-EL-MOVIL.cmd` abre Ollama si está cerrado y arranca `herramientas/servidor-movil.js` (Node, sin dependencias, puerto 8080). Ese servidor sirve el juego a la red local y hace de puente hacia Ollama en `/ollama/…`. Así Ollama sigue escuchando sólo en el portátil, sin `OLLAMA_HOST` ni `OLLAMA_ORIGINS`, y el puente sólo deja pasar `/api/tags`, `/api/chat`, `/api/version` y `/v1/chat/completions`. No sirve `pruebas/` ni `herramientas/`. `detectarIA` prueba, por este orden, la URL guardada, `origen/ollama` y `localhost:11434`. Si un día no encuentra la IA que había detectado sola, vuelve a las predefinidas para no esperar en cada respuesta. `precalentar()` carga el modelo al detectarlo (`keep_alive` 30 min), porque en frío la primera respuesta tardaba unos 30 s. Prueba automática: `pruebas/movil_ia.js` (navegador de móvil simulado, IP de red del portátil, `localhost:11434` bloqueado). **Falta probarlo en el Xiaomi real**: la primera vez, Windows pregunta si deja a Node usar la red (hay que aceptar en redes privadas) y la red del portátil debe ser «privada». Por `http://IP` el micrófono y la instalación como app no funcionan en Chrome de Android (no es un origen seguro): se arregla en `chrome://flags/#unsafely-treat-insecure-origin-as-secure` añadiendo `http://IP-del-portátil:8080`. Otras opciones no elegidas: WebLLM dentro del móvil, o un servicio de pago (sólo con autorización).
- **PRUEBA PILOTO EN UNREAL ENGINE 5.8 (autorizada el 26/10/2026)**: una consulta, médico y paciente MetaHuman, IA y voces, para PC y Android; la versión Three.js sigue siendo el juego. Proyecto en `C:\Users\arric\ElMejorMedicoUE` (ruta corta por Android, fuera de git); copia del código en `unreal-piloto/` (ver su `LEEME.md`, se actualiza con `Herramientas\copiar-a-repositorio.ps1`).
  - Herramientas instaladas con permiso: VS 2022 Build Tools (MSVC 14.44, SDK 22621, .NET 4.8 SDK), NDK r27c y CMake 3.22.1. La instalación del .NET SDK se atascó con la ventana de administrador oculta; se relanzó con `Start-Process -Verb RunAs` y el usuario la aceptó (si vuelve a pasar: `Herramientas\instalar-net48-sdk.cmd` con doble clic).
  - Hecho y probado en Windows (versión empaquetada, `-EMMPrueba`): consulta con muebles CC0 de Poly Haven (unidos en Blender), luz, cámara calculada entre médico y paciente, interfaz, turnos, IA real (Ollama en el procesador: libera los 4 GB de la RTX 3050 para los gráficos y responde en menos de 1 s) y voces de Windows (Pablo, Laura, Helena).
  - Lecciones: Python del editor sólo funciona bien desde `Content/Python/init_unreal.py` con `EMM_TAREA` (el editor tiene que haber terminado de arrancar); `unreal.Rotator` en Python es (roll, pitch, yaw); los parámetros de textura del material base necesitan texturas por defecto del tipo correcto (si no, no compila y sale el material de cuadros); en el juego sin personaje hay que volver a poner la cámara tras crearse el espectador; las fotos fiables son las del juego empaquetado.
  - Falta: MetaHumans (el autorrigging usa el servicio gratuito de Epic: el usuario tiene que iniciar sesión con su cuenta en el editor), conectar la boca y el parpadeo de `EMMHabla` a la cara del MetaHuman, animación sentada, mover el portátil de la mesa, el APK de Android (biblioteca `Nativo/emm-nativo` ya compila) y probarlo en el emulador.
- **Instaladores**: el APK ya se compila (arriba; falta la prueba en el Xiaomi). Falta Electron o Tauri (EXE/MSIX). Pedir autorización antes de instalar. Ojo: el dictado del navegador no funciona dentro de Electron ni de WebView2; habría que usar el dictado de Windows (Windows + H) o un reconocedor local.
- Caminar, sentarse y levantarse; caras, barbas, gafas, ropa y mobiliario en Blender (sección 5).
- El médico se ve en primera persona: sólo se animan sus manos, no su cara.

---

## 3. Tecnología actual (importante antes de tocar nada)

- **Juego web en 3D** con **Three.js r160**, que está incluido en `vendor/` y no se descarga de ningún CDN. JavaScript con módulos ES y sin compilación: ni npm ni bundler en el juego.
- **Aplicación instalable (PWA)** con `manifest.webmanifest`, iconos y `sw.js`. El service worker guarda en caché el juego y los modelos para usarlo sin conexión. La versión de caché actual es `emm-v7`; **súbela (emm-v7…) cada vez que cambies archivos**, o los móviles seguirán con la versión antigua.
- **Voces:** API Web Speech del navegador (`speechSynthesis`), que elige una voz `es-ES` según el sexo y la edad del personaje. No hay audios grabados.
- **Sonidos** sintetizados con WebAudio: corazón, respiración, crepitantes, sibilancias, monitor, alarmas, llanto de bebé, etc.
- **Personajes:**
  - `modelos/personajes.glb`, hecho en Blender: un cuerpo de hombre (H) y otro de mujer (M), cada uno de una pieza y con 19 huesos. Se clonan con `SkeletonUtils.clone`.
  - La ropa se pinta en el sombreador según la posición de reposo de cada vértice.
  - La edad cambia la escala de los huesos.
  - El pecho se deforma por personaje con un perfil de alturas.
- **Peinados:** `modelos/pelo.glb`, hecho en Blender, con 8 peinados pegados al hueso de la cabeza.
- **Rasgos de la cara** (ojos, cejas, nariz, boca, orejas, barba, gafas): todavía procedimentales en `js/escena.js`, función `rasgosCara`.
- **Imágenes médicas procedimentales:** radiografías, TAC, ecografía, electrocardiograma y garganta, en `js/imagenes.js`.
- **Guardado** en `localStorage`, con la clave `el-mejor-medico-v1`.
- **Depuración:**
  - `?caso=<id>` en la dirección fuerza una enfermedad, por ejemplo `index.html?caso=apendicitis`;
  - `window.__juego` da acceso a `G`, `mundo`, `pac` y `cir`.

### Compatibilidad con Unreal Engine (comprobarlo ANTES de migrar)
- El juego **no** es un proyecto de Unreal. Pasarlo a Unreal significaría **reescribirlo entero** en C++ o Blueprints: unas 5.500 líneas de lógica, datos, diálogos, cirugía e interfaz.
- Para el móvil, Unreal exige compilar para Android, con el SDK y el NDK; iPhone necesita un Mac. Además, la descarga pesa cientos de MB. Hoy el juego se abre en el navegador del móvil y pesa unos 5 MB.
- **Recomendación:** mantener el juego web como producto principal y usar Unreal **solo si el usuario lo confirma**, como proyecto aparte. Ese proyecto debe ir fuera de este repositorio, por ejemplo en `C:\Proyectos\ElMejorMedico_Unreal\`, porque GitHub Pages no admite archivos de más de 100 MB.
  - Primero, un prototipo que importe los mismos GLB (`personajes.glb`, `pelo.glb`) para comparar la calidad.
  - Nunca hay que sustituir el juego web sin la aprobación expresa del usuario.
- **Blender local** sí encaja directamente. Los scripts `modelos/*_blender.py` se ejecutan en Blender y se exporta a GLB en `modelos/`.

---

## 4. Archivos del juego

| Archivo | Qué es |
|---|---|
| `index.html` | Interfaz completa con su CSS, el importmap de Three.js y el registro del service worker. Usa las fuentes Barlow, Barlow Condensed y Caveat. |
| `js/juego.js` (1.306 líneas) | Lógica y pantallas. Ver el detalle debajo de la tabla. |
| `js/datos.js` (1.459 líneas) | Datos y reglas médicas. Ver el detalle debajo de la tabla. |
| `js/escena.js` (1.466 líneas) | Mundo 3D. Ver el detalle debajo de la tabla. |
| `js/cirugia.js` | Minijuego de cirugía. Ver el detalle debajo de la tabla. |
| `js/imagenes.js` | Radiografías, TAC, ecografía, ECG y garganta procedimentales. |
| `js/audio.js` | `Voz.hablar()` y `Voz.callar()` en español; `Sonido.*`, sintetizados con WebAudio. |
| `modelos/personajes.glb` y `modelos/personajes_blender.py` | Cuerpos H y M con esqueleto, más el script de Blender que los genera: tubos, remallado de vóxeles, suavizado, diezmado, armadura y pesos automáticos. |
| `modelos/pelo.glb` y `modelos/pelo_blender.py` | 8 peinados: 0 calvo con corona (solo mayores de 50), 1 corto, 2 rapado, 3 flequillo, 4 media melena, 5 melena larga, 6 moño y 7 coleta. Cada peinado `Pelo_N` está centrado en el centro de la cabeza; las cabezas `Ref_cabeza_*`, la cámara y las luces solo sirven para revisar en Blender. |
| `vendor/` | Three.js r160, RoomEnvironment, RoundedBoxGeometry, GLTFLoader, SkeletonUtils y BufferGeometryUtils. |
| `sw.js`, `manifest.webmanifest`, `pwa-*.png`, `apple-touch-icon.png`, `favicon.svg`, `og-image.jpg` | Aplicación instalable e iconos. |
| `pruebas/jugar.js`, `pruebas/cir.js`, `pruebas/movil.js` | Pruebas automáticas con Playwright. Ver la sección 7. |

**`js/juego.js`** contiene:
- la partida y el guardado;
- la pantalla de inicio y el creador del médico;
- la consulta: preguntas, exploración, auscultación, palpación, pruebas, ficha con nombre editable, receta, decisión y malas noticias;
- la cirugía;
- la planta de ingresados y la ronda;
- el fin del día;
- la gestión: equipos, camas, personal y sueldos;
- el cambio de nombre del hospital.

**`js/datos.js`** contiene:
- las 41 enfermedades;
- el recetario de 346 productos;
- la búsqueda de recetas con texto libre (`itemLibre`);
- el generador de pacientes por grupos de edad;
- los diálogos;
- la evaluación del tratamiento, con reglas de edad, alergias e interacciones;
- la reacción de los pacientes a la receta.

**`js/escena.js`** contiene:
- la clase `Mundo`;
- la consulta, la planta, el quirófano y el escenario del creador;
- la carga de los GLB (`cargarModelos`);
- los personajes: `crearHumanoGLB` y, si falta el GLB, `crearHumanoProc`;
- la ropa (`ROPAS`), las poses, las animaciones (respiración, parpadeo, boca, llanto, mirada), la forma del pecho y los peinados;
- las cámaras, incluido el ajuste para el móvil en vertical.

**`js/cirugia.js`** contiene:
- los pasos: desinfectar, incisión, separar, pinzar, extirpar, aspirar, reducir, malla y suturar;
- el temblor;
- las complicaciones (hemorragia, FV, desaturación, bradicardia, despertar, alergia), las constantes y la puntuación.

Hay **escenarios** (consulta, planta y quirófano), pero están construidos en código dentro de `escena.js`; no son modelos importados.

---

## 5. Estado del trabajo

### Terminado y probado
- Nombre «EL MEJOR MÉDICO», sin ninguna referencia a «Doctor Simulator».
- Voces en español (TTS del navegador) y subtítulos.
- Creador del médico:
  - sexo, voz, piel, ojos, cara, nariz, pecho en mujeres;
  - 8 peinados, color de pelo, 6 tipos de vello facial y 4 de gafas;
  - complexión, altura y edad;
  - 9 modelos de ropa y bata: bata clásica, bata con corbata azul, bata corta, bata moderna y pijamas azul, verde, granate, negro y rosa;
  - aleatorio;
  - nombre editable en todo momento.
- Nombres de los pacientes editables desde la ficha.
- 41 enfermedades, entre ellas:
  - de bebés y niños: bronquiolitis, cólico del lactante, varicela, laringitis, cuerpo extraño, piojos;
  - de jóvenes: mononucleosis, acné;
  - de mayores: fractura de cadera, insuficiencia cardiaca, infección de orina con confusión;
  - además, simuladores y secretos vergonzosos.
- Pacientes de todas las edades:
  - bebés en portabebés;
  - niños, que responden a través de sus padres;
  - jóvenes, adultos y mayores encorvados;
  - acompañantes según la edad.
- Variedad de cuerpos: complexión, altura y 4 tallas de pecho con forma rehecha.
- Recetario libre: cualquier medicamento, comida o bebida. Lo que no está en la lista se interpreta por texto. Hay reglas médicas reales: alcohol en menores, aspirina en menores de 16 años, miel en menores de 1 año, benzodiacepinas en mayores, alergias, Viagra con nitratos, etc.
- Pruebas: sangre (incluida BNP), orina, radiografía por zonas (incluida la cadera), ecografía, TAC, ECG y faringe.
- Cirugía con anestesia y complicaciones, y planta de ingresados con ronda.
- Malas noticias, también a los padres; reputación y dinero.
- Gestión: equipos (ecógrafo, TAC, laboratorio, monitores, instrumental, segundo quirófano), camas y personal (enfermera jefa, anestesista, radiólogo, cardiólogo, psicólogo, cirujano ayudante).
- Cambiar el nombre del hospital.
- Funciona en el móvil, en vertical y en horizontal, e instalable como aplicación.
- Personajes con cuerpo de Blender y **peinados de Blender**, terminados en el último commit.

### A medias
- **Realismo gráfico:**
  - los cuerpos y el pelo ya vienen de Blender;
  - la **cara** (ojos, nariz, boca, orejas), la **barba** y las **gafas** siguen siendo piezas simples hechas en código;
  - la ropa está pintada sobre el cuerpo, sin volumen de tela, salvo el faldón de la bata.
- **Blender:** hasta ahora se usó un Blender **en la nube** (Higgsfield «3D Jutsu», a través de Composio), que no tiene GPU y no puede renderizar. Los proyectos de esa nube son «El Mejor Medico - personajes» y «El Mejor Medico - peinados». Con el Blender local esto ya no hace falta: los scripts `.py` del repositorio son la fuente.
- **Voces:** dependen de las voces españolas que tenga instaladas el dispositivo. No hay voces grabadas.

### Pendiente
1. **Unreal Engine:** no se ha usado nunca, porque el conector solo existe en el portátil. Primero hay que decidir con el usuario si se usa para un prototipo aparte (ver la sección 3).
2. **Caras en Blender:** modelar ojos, párpados, nariz, boca y orejas integrados en la malla, o una malla de cabeza con morph targets para hablar y parpadear. Hay que conservar los nombres de los huesos y el sistema de animación de `animarGLB`.
3. **Barbas y gafas en Blender**, con la misma técnica que `pelo.glb`: una pieza `Barba_N` o `Gafas_N` pegada al hueso de la cabeza.
4. **Mobiliario en Blender:** cama de hospital, lámpara de quirófano, mesa de quirófano, carro de instrumental, camilla, monitor. Hoy está hecho con cajas y cilindros en `escena.js`.
5. **Ropa con volumen:** batas y pijamas como mallas con pesos, que sustituyan a la ropa pintada solo cuando estén probadas.
6. Animaciones de andar o entrar, que hoy no existen.
7. Cuando el usuario lo pida, crear un pull request de la rama a `main` y publicar.

---

## 6. Cómo encajan los modelos (para no romper nada)

- Los huesos de `personajes.glb` llegan a Three.js **sin puntos**: `brazo.L` se convierte en `brazoL`. Los repetidos entre H y M llegan con sufijo, como `pelvis_1`; el código lo normaliza con `.replace(/_\d+$/, '')`.
- En Blender cada cuerpo estaba desplazado en X (±0,45). El sombreador lo compensa con `uOffX`, calculado a partir de la caja de la malla.
- La mujer está a escala 0,95.
- El centro de la cabeza, en el espacio del personaje, es `(0, 1.705·esc, 0.008·esc)` en glTF, lo que en Blender equivale a `(0, -0.008, 1.705)`. El delante del personaje es +Z en glTF y −Y en Blender.
- Peinados:
  - `crearHumanoGLB` crea un grupo sin escala en el hueso `cabeza`, en ese centro, y le añade un clon de `Pelo_{estilo}` con escala `esc`;
  - si el personaje lleva gorro de quirófano o falta `pelo.glb`, se usa el pelo procedimental de antes (`ponerPelo`).
- Si se cambian los GLB, hay que mantener:
  - los nombres de los objetos: `H_Esqueleto`, `H_Cuerpo`, `H_Faldon`, `M_…` y `Pelo_0` a `Pelo_7`;
  - los nombres de los huesos;
  - la escala en metros.

---

## 7. Pruebas antes de cada commit

Requisitos: Node.js y Playwright (`npm i -g playwright` o en una carpeta aparte, con `npx playwright install chromium`).

```bat
cd el-mejor-medico
node herramientas\servidor-movil.js 8766
:: en otra terminal (las capturas se guardan en la carpeta indicada):
node pruebas\jugar.js C:\Temp\capturas            & rem consulta completa con paciente al azar
set CASO=bronquiolitis& node pruebas\jugar.js C:\Temp\capturas
node pruebas\cir.js C:\Temp\capturas              & rem cirugía, planta y alta
node pruebas\movil.js C:\Temp\capturas            & rem pantallas en formato móvil
node pruebas\charla.js C:\Temp\capturas           & rem conversación por turnos, 7 edades, IA simulada, micro, mando, receta y móvil
node pruebas\ia_real.js C:\Temp\capturas          & rem conversaciones con la IA real de Ollama (necesita Ollama en marcha)
node pruebas\movil_ia.js C:\Temp\capturas         & rem móvil simulado usando la IA del portátil por la red (arranca su propio servidor en el 8090)
```

Todas las pruebas usan `pruebas/turnos.js` para pulsar HABLAR MÉDICO y RESPONDER PACIENTE. En el ordenador del usuario no hay Python: la carpeta se sirve con `herramientas/servidor-movil.js`.

Casos útiles para `CASO` o `?caso=`: `bronquiolitis`, `fractura_cadera`, `varicela`, `itu_confusion`, `apendicitis`, `colecistitis`.

Todas las pruebas pasaban sin errores en el último commit. Hay que mirar las capturas: que los personajes se vean bien, que el pelo no tape los ojos y que el panel no tape al paciente en el móvil.

---

## 8. Reglas para seguir trabajando

- Trabajar siempre en la rama `claude/medical-simulator-game-ruh821` y en la carpeta `el-mejor-medico/`.
- No tocar `laser-marmol/`, `impresora-3d/` ni los juegos de baloncesto.
- No mezclar con «MI GRANJA».
- No cambiar de motor ni migrar sin comprobar antes la compatibilidad y sin la aprobación del usuario.
- Los modelos nuevos de Blender se guardan como GLB en `modelos/`, junto con su script `.py` para poder rehacerlos. Hay que añadirlos a la lista de `sw.js` y subir la versión de la caché.
- Los textos del juego y las respuestas al usuario van en español de España.
- No poner nunca «Doctor Simulator».
