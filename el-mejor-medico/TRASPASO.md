# EL MEJOR MÉDICO: informe de continuidad

Informe para continuar el desarrollo en una sesión **local** de Claude Code (portátil Lenovo Legion con Windows, con Blender 5.2.2 LTS y Unreal Engine 5.8 conectados por MCP) sin empezar de cero.

Fecha del traspaso: 25 de octubre de 2026 (actualizado el 30 de octubre de 2026).

---

## ▶ ROPA, NIÑOS Y CREADOR DE PERSONAJES (30/10/2026, tarde) — PROBADO EN WINDOWS; EN EL XIAOMI INSTALADO, FALTA VERLO

- **Ropa rota en Android (todos los personajes)**: no era el asset. En móvil el cuerpo y la cara de los MetaHumans no tienen LOD0 (`min_lod` de Mobile = 1, comprobado con `Herramientas/sondear_lod.py`), pero el `LODSyncComponent` elegía la ropa para el cuerpo de LOD0 (mapa de la ropa 1,2,3) y el cuerpo la atravesaba por hombros y pecho. Arreglo en `PrepararMetaHuman` (sólo `PLATFORM_ANDROID || PLATFORM_IOS`): `LODSync->MinLOD = 1`. Windows no cambia (allí nunca pasó).
- **Niños y bebés**: los 28 casos infantiles (6 de <1 año, 6 de 1–2, 16 de 3–12) existían pero se descartaban (`bHablaAcomp || bBebe` y sin personaje de su edad). Ahora:
  - 6 modelos nuevos con **MPFB 2 en Blender** (recursos de MakeHuman, **CC0**; leídos de `C:\Users\arric\LA VIDA EN ORDAS 3D\descargas\mpfb\datos`, sin modificar): bebé niño y bebé niña (~67 cm), niño y niña de 4 años (~1,03 m), niño y niña de 9 años (~1,30 m). `Herramientas/crear_ninos_mpfb.py` (se ejecuta dentro de Blender) los crea **ya sentados** (pose de reposo; el bebé con el asiento a 0 para ir en el regazo), con forma «Boca» para hablar, y exporta `Fuentes/Ninos/*.fbx` + `ninos.blend`. `Herramientas/importar_ninos.py` los importa en `/Game/Ninos` con materiales propios (`M_NinoBase`, `M_NinoRecorte` para pelo/cejas/pestañas; parámetros `Tinte` y `TinteFuerza`) y texturas a 1024 px. `DefaultGame.ini` cocina `/Game/Ninos` siempre.
  - Lecciones: con la escala ×100 del FBX de Blender cualquier AnimInstance de Unreal desplazaba la malla (por eso van sentados desde Blender y sin animación); un material nuevo necesita `used_with_skeletal_mesh`/`used_with_morph_targets` y textura por defecto en el parámetro, y `update_material_instance` tras cambiar un parámetro desde Python (si no, rejilla gris). `ciclo.ps1 -Probar` borra `EMM_TAREA` (si no, el juego de prueba ejecutaba la tarea de editor y se cerraba).
  - En la consulta: el niño se sienta en la silla del paciente y el acompañante (MetaHuman de su sexo y edad: madre/padre ~edad+30, abuelos 70) en la silla de al lado, que se recoloca donde la cámara la ve (`escena.json › acompanante`); con un bebé, el acompañante en la silla del paciente y el bebé en su regazo (`escena.json › bebe`). Contesta el acompañante (instrucciones `sistemaAcomp`, su voz y su boca) en bebés y niños pequeños; los escolares contestan ellos (voz infantil, boca con la forma «Boca»). También vale para adultos cuyo caso dice que contesta el acompañante.
  - Prueba (`ciclo.ps1 -Probar -SoloNinos`, nueva): 6 niños y bebés con su acompañante; prueba completa: 23 personas, 152 casos, seguridad 0 fallos, 50 fps en el portátil.
- **Creador de personajes (nuevo; no existía)**: CONFIGURACIÓN › **CREADOR DE PERSONAJES** (`EMMCreadorUI`, `EMMAspecto`). Para el médico y cada persona: nombre y apellidos, sexo, edad, cara (los 17 MetaHumans + Lorenzo + 6 niños, filtrados por sexo y edad), color de piel, color de pelo, **peinado, barba y bigote de cualquier MetaHuman** (12 peinados, 7 barbas, 6 bigotes: todas las caras tienen la misma malla, así que el anclaje de uno vale en otro; probado), ojos. Se guarda en el historial (`plantilla[].aspecto`, `medico`) y se ve al momento. El médico puede ser médica («Dra.», voz de mujer, firma de las recetas). Cambiar sexo/edad de un paciente le asigna un caso de su sexo y edad para la próxima visita. La forma de la cara no se esculpe en el juego (MetaHuman Creator sólo existe en el editor). Prueba: `ciclo.ps1 -Probar -Creador`.
- **Xiaomi**: APK y OBB nuevos instalados con `install -r` (IA Gemma y `historial.json` intactos; copia en `Copias\Xiaomi_datos_2026-10-30_tarde`). Las pruebas automáticas no pudieron correr porque la pantalla del móvil estaba bloqueada: **falta ver en el móvil la ropa, los niños y el creador**.

## ▶ ANDROID (30/10/2026, tarde) — ACTUALIZADO EN EL XIAOMI Y FPS MEDIDOS

- Actualización instalada con `adb install -r` (sin desinstalar) + OBB nuevos. Comprobado después: IA Gemma intacta (2 588 147 712 bytes) e `historial.json` intacto.
- **Prueba automática real en el Xiaomi 17 Ultra** (`-EMMPrueba -EMMTodos`, 5,5 min, calidad EQUILIBRADA; resultado en `ElMejorMedicoUE\Saved\Prueba_Xiaomi.txt`): 17 personas, 17 caras distintas, 17 fichas guardadas; los 17 pacientes respondieron con la **IA Gemma 4 E2B del móvil** (`[ia]`); 6 voces Piper bien (0,5–1,4 s por frase de 6–11 s); SEGURIDAD 120 casos, 0 fallos; revisión del P01 correcta; dictado arranca sin error.
- **Rendimiento**: media 55 fps, **mediana 60 fps** (el tope de la pantalla), 5 % peor 46 fps; pero **1 % peor 12 fps y 2,4 % de fotogramas por debajo de 30** → NO son 30 fps totalmente estables. Fotograma más lento al cambiar de paciente: 27 ms. Reparto medio: juego 3,1 ms, render 5,4 ms, GPU 13,3 ms; texturas 417 MB.
- Sin confirmar: los tirones parecen coincidir con la IA (Gemma va en la GPU del móvil, la misma que dibuja) o con Piper. Siguiente paso: registrar cuándo caen los fotogramas (IA / voz / cambio de paciente) y, si es la IA, probar Gemma en CPU o limitar su prioridad.
- Capturas del móvil: ya no hay joysticks virtuales; el pelo del médico se ve mucho menos granulado con TAA.

## ▶ ANDROID (30/10/2026, mediodía) — DICTADO SIN REPETICIONES

- **Fallo del usuario**: al dictar, palabras o frases salían 2 o más veces (y el médico las repetía). Causas en `EMMNativo.kt`: tras `onResults` podía llegar también `onError` y volvía a añadir el texto parcial; al relanzar el reconocedor tras un silencio, avisos atrasados de la escucha anterior se sumaban a la nueva; y el reconocedor puede reenviar lo ya dicho. Arreglo: cada escucha lleva número (`dicSesion`) y se cierra una sola vez; `unir()` quita el solapamiento (sin mayúsculas ni signos). Pruebas unitarias `Nativo/emm-nativo/src/test/.../DictadoTest.kt` (`gradlew :emm-nativo:testReleaseUnitTest`): 7/7 bien. Falta probarlo hablando en el móvil.
- **APK nuevo** en `Binaries\Android` (dictado + sin joysticks + TAA), verificado por dentro. Unreal no rehace el APK si sólo cambia el AAR: borrar los `.apk` antes de `ciclo.ps1 -Android -SinCocinar`.
- **Datos del móvil a salvo**: la IA está en la memoria interna de la app (`files/modelos/gemma-4-E2B-it.litertlm`, 2 588 147 712 bytes) y la partida en `/sdcard/Android/data/es.elmejormedico.ue/files/.../Saved` (historial.json). Ambas se conservan con `adb install -r` (actualizar, NUNCA desinstalar ni el `.bat` de Unreal, que desinstala). Firma del APK nuevo = instalado (SHA-256 del certificado 9be652a1…27d3). Copia en el portátil: `Copias\Xiaomi_datos_2026-10-30` (IA con SHA-256 comprobado y `Saved`). Para restaurar la IA: `adb push` a `/data/local/tmp` y `run-as es.elmejormedico.ue cp` a `files/modelos/`.
- Actualizar los OBB (cambió la configuración) sólo reemplaza esos dos archivos; no toca la partida ni la IA.

## ▶ ANDROID (30/10/2026) — FUNCIONA EN EL XIAOMI 17 ULTRA

- **Probado en el Xiaomi 17 Ultra real** (Android 17, SM8850 / Adreno 840, 16 GB, adb `1ecc5f83`): instala, arranca con el perfil `Android_Adreno8xx_Vulkan`, renderizado diferido móvil correcto, 17 personajes, 120 casos, 6 voces Piper cargadas, médico y paciente (Etta) MetaHuman con ropa, portátil e interfaz táctil a buen tamaño. Memoria del juego ≈ 2,4 GB.
- Xiaomi: para instalar por USB hay que activar «Instalar vía USB» en Opciones de desarrollador y pulsar «Instalar» en el móvil en cada instalación. No deja inyectar toques ni teclas por adb (INJECT_EVENTS).
- Visto en la captura y corregido (reempaquetado, falta instalar y comprobar): sobraban los joysticks virtuales de Unreal (`DefaultInput.ini › DefaultTouchInterface=None`) y el pelo del médico se veía granulado (`r.Mobile.AntiAliasing=2`, TAA, en vez de MSAA).
- Prueba automática en el móvil: `UECommandLine.txt` con ` -EMMPrueba -EMMTodos` en `/sdcard/Android/data/es.elmejormedico.ue/files/UnrealGame/ElMejorMedicoUE/`; resultado en `.../ElMejorMedicoUE/Saved/Prueba.txt`. El primer intento se pausó porque el usuario pasó a otra app: el juego tiene que estar delante y la pantalla encendida. Borrar `UECommandLine.txt` al terminar.

## ▶ ANDROID (30/10/2026, mañana) — PRIMER APK

- **APK compilado y cocinado** (componente Android de Unreal 5.8.3 ya instalado por el usuario). Requisitos comprobados y exactos a lo que pide UE 5.8 (`Android_SDK.json`): plataforma android-36, build-tools 36.0.0, CMake 3.22.1, NDK r27c (27.2.12479018), JDK Temurin 21.
- Resultado en `ElMejorMedicoUE\Binaries\Android`: `ElMejorMedicoUE-arm64.apk` (324 MB, **el del Xiaomi**), `ElMejorMedicoUE-x64.apk` (emulador), `main.1.es.elmejormedico.ue.obb` (2 013 MB: MetaHumans) y `patch.1.es.elmejormedico.ue.obb` (73 MB). Copia: `Copias\Android_primer_APK_2026-10-30`.
- **Instalar en el móvil** (sin Play Store, por USB con depuración USB; Play Protect sin tocar). El `.bat` de Unreal no arranca desde la sesión de Claude; a mano: `adb install -r ElMejorMedicoUE-arm64.apk`, `adb shell mkdir -p /sdcard/Android/obb/es.elmejormedico.ue` y `adb push` de los dos `.obb` a esa carpeta. Paquete `es.elmejormedico.ue` (convive con la app Three.js).
- Arreglos para compilar: el plugin «MetaHuman» (Animator, sólo editor/PC) se limita a Win64/Linux/Mac en el `.uproject`; `EMMPiper.cpp` con `#if/#else` (clang daba «código inalcanzable»); en el UPL la ruta del AAR va con `insertValue`; OBB de más de 2 GB → `bAllowPatchOBBFile` + `bAllowOverflowOBBFiles`, datos fuera del APK.
- `ciclo.ps1 -Android [-SinCocinar]`: usa `-nocompileeditor` (otro editor abierto con Live Coding bloquea compilar el editor) y `-NoUBA -MaxParallelActions=2` (UBA se quedaba sin memoria). `-SinCocinar` sólo recompila y reempaqueta (3 min).
- **Nuevo para el móvil** (compilado, sin probar en un móvil real):
  - **Dictado** con `SpeechRecognizer` del propio móvil en es-ES (`EMMNativo.dictadoEmpezar/Estado/Parar`, consultado cada 200 ms desde `EMMDictado.cpp`); se relanza tras cada silencio hasta pulsar PARAR; la primera vez pide el permiso de micrófono (`RECORD_AUDIO` en el UPL). Vale para la conversación y para las recetas.
  - **Interfaz táctil**: todo son botones UMG (funcionan con el dedo) y el cuadro de texto abre el teclado del móvil; en Android la interfaz se amplía ×1,35 (`ApplicationScale`) para leerla en 6,9".
  - **Rendimiento**: `Config/DefaultDeviceProfiles.ini` sube la resolución a ~1920 px de ancho (`r.MobileContentScaleFactor=1.5`) en Adreno 8xx (Snapdragon 8 Elite Gen 5 del Xiaomi 17 Ultra); el botón CALIDAD GRÁFICA sigue bajando la resolución interna. Renderizador móvil diferido (por defecto en 5.8; mejor calidad).
- **Prueba en el emulador (`emm36`)**: instala, arranca, carga el nivel, la consulta y a la paciente Lani con su ropa, y se cierra al crear un sombreador del renderizado diferido («Failed to create graphics pipeline», 4 destinos: color + GBuffer). Es una limitación del traductor gráfico del emulador (OpenGL de la RTX → Vulkan); con SwiftShader no hay Vulkan («No Vulkan driver found»). No se ha bajado la calidad para el emulador. **Siguiente paso: probarlo en el Xiaomi** y leer `adb logcat -s UE` (si fallara igual, probar `r.Mobile.ShadingPath=0` = forward).
- La memoria del portátil iba justa: quedaron abiertas 2 copias ocultas del juego de Windows de las pruebas del 29/10 (≈3 GB; Claude no tiene permiso para cerrarlas: cerrarlas desde el Administrador de tareas).
- **Voces Piper en Android (hecho, sin probar en el móvil)**: NNERuntimeORT no existe en Android, así que `EMMPiper.cpp` (bajo `PLATFORM_ANDROID`) pasa el `.onnx` y los ids de fonemas por JNI a `EMMNativo.piper()` (Kotlin, ONNX Runtime de Microsoft 1.20.0, MIT, 3 hilos). Los modelos van tal cual en `ElMejorMedicoUE\VocesOnnx\*.onnx` (294 MB, fuera de Content para que el editor no los importe; fuera de git), añadidos al APK sólo en Android con `RuntimeDependencies` en `ElMejorMedicoUE.Build.cs`. AAR recompilado (`Nativo`, `gradlew :emm-nativo:assembleRelease`) y copiado a `Source/ElMejorMedicoUE/Android/emm-nativo.aar`. Windows comprobado después: 6 voces y 17 personajes bien.
- Disco: ~18 GB libres; se borró `Saved\StagedBuilds\Windows` (regenerable, duplicado del ejecutable que está en `Empaquetado` y en `Copias`).
- `ciclo.ps1 -Probar` avisa ahora si Smart App Control bloquea la DLL recién compilada del editor (4551) en vez de esperar 45 minutos; solución: cambio real de código y recompilar.

## ▶ ÚLTIMO PUNTO (29/10/2026, noche, 3.ª parte: RENDIMIENTO)

- **Objetivo de 30 fps estables CONSEGUIDO y verificado con el ejecutable empaquetado** (`ciclo.ps1 -ProbarPaquete -Todos`, RTX 3050 portátil, 1600×900, calidad EQUILIBRADA): 17 pacientes, **52 fps de media, mediana 52, 1 % peor 40 fps, 0,0 % de fotogramas por debajo de 30**; al cambiar de paciente el fotograma más lento fue de 26 ms. Prueba general del ejecutable (`-ProbarPaquete`): recetas, ficha, dictado, subtítulos y mando correctos a 47–49 fps. Antes: 27 fps.
- **Causa encontrada** (medida nueva en `Prueba.txt`: «Reparto del fotograma» juego/render/GPU y memoria de texturas; `Herramientas/medir_gpu.ps1` mide desde Windows la memoria de vídeo y el uso de GPU): el cuello de botella era el **hilo de render del procesador** (28 ms), no la GPU (42 % de uso). Seis luces rectangulares móviles con sombra (cada una dibuja a los dos MetaHumans en 6 direcciones) más la IA y Piper usando todos los núcleos.
- **Cambios** (todos en código o configuración; no se ha tocado ningún MetaHuman ni el nivel):
  - `AEMMConsultaModo::AjustarLuces`: en EQUILIBRADA tienen sombra la ventana (luz principal) y el panel del techo más cercano; los otros 3 paneles y la pantalla del portátil usan sombras de contacto. RÁPIDA: sólo la ventana. ALTA: todas.
  - Al cambiar de paciente se libera el MetaHuman anterior (`ForceGarbageCollection`) y entra con un fundido de 0,7 s desde negro.
  - Ollama con `num_thread 6`; Piper (NNE ONNX Runtime) con 3 hilos (`DefaultEngine.ini › NNERuntimeORTSettings`).
  - EQUILIBRADA: resolución interna 85 % con TSR (se subió desde 77 % porque sobraba margen).
- Memoria de vídeo del juego: ~2,4 GB de 4 GB en EQUILIBRADA; ALTA usa ~3 GB y va a 22 fps (render 44 ms): no recomendable en este portátil.
- **Smart App Control**: sigue activado. Bloqueó tres paquetes seguidos y después permitió el siguiente (su decisión depende de la reputación en la nube de Microsoft; un certificado propio no sirve y los reconocidos son de pago; Windows 11 Home no tiene Windows Sandbox ni Hyper-V). Vía segura: si bloquea, `ciclo.ps1` lo detecta; se verifica con `-Probar -Todos -Calidad 1` en el editor (UnrealEditor.exe firmado por Epic) y se vuelve a empaquetar más tarde con un cambio real de código. Opcional y gratuito: enviar el ejecutable a Microsoft Security Intelligence como desarrollador.
- **Copias**: versión anterior verificada `Copias\Windows_17pacientes_2026-10-29` (27 fps) y nueva `Copias\Windows_17pacientes_50fps_2026-10-29`; fuentes antes de optimizar en `Copias\Fuentes_antes_optimizacion_2026-10-29`.

## ▶ ÚLTIMO PUNTO (29/10/2026, noche, 2.ª parte)

- **Seguridad de urgencias (hecho y probado en el editor, `-Probar -Todos`)**:
  - `casos.json` lleva lo que necesita cada caso (`destino`: casa / hospitalizar / cirugia, `prioridad`, `cirugia`), sacado de `trat.accion` del juego web. El exportador usa azar con semilla fija (20261029): exportar otra vez da los mismos pacientes. Copia del anterior: `ElMejorMedicoUE\Copias\casos_v3_2026-10-29.json`.
  - AGENDA · FICHA: botones «Alta a domicilio / Derivar a URGENCIAS / Ingreso hospitalario / Derivar a CIRUGÍA». Al guardar, la ficha anota el destino y su valoración (`EMMEvolucion::ValorarDestino`: correcta, innecesaria o **AVISO DE SEGURIDAD** si se manda a casa a quien necesitaba hospital, que además vuelve en 3 días y empeora).
  - **Alerta de triaje** (`EMMEvolucion::SignosAlarma`: saturación < 92, sistólica < 90 o ≥ 180, pulso ≥ 120 o < 45, fiebre ≥ 39,5 (≥ 38,5 si 75+), respiración ≥ 26): tarjeta roja en el portátil, línea roja en la agenda y aviso al entrar el paciente.
  - Prueba: 120 casos con personaje, 37 necesitan hospital o cirugía, 12 con alerta de triaje, **0 fallos** (mandados a casa empeoran y dan aviso; derivados vuelven de alta; los leves no dan aviso por ir a casa).
- **Voces**: el fonetizador lee abreviaturas («Dr.», «Sra.», «Ud.»), unidades tras un número (mg, ml, h, mmHg, lpm, °C), siglas deletreadas (ECG, PCR…), horas («8:30»), ordinales («2.º»), fracciones («1/2» = medio), «cada 8 h», «y/o», y enlaces entre palabras («un beso» [m], «con gripe» [ŋ], «con dolor» [d]). Las 6 voces sintetizan en 0,17–0,30 s.
- **Calidad gráfica** en CONFIGURACIÓN (RÁPIDA / EQUILIBRADA por defecto / ALTA), guardada en GameUserSettings; `ciclo.ps1 -Calidad N` la fuerza en las pruebas. Equilibrada: resolución interna 77 % con TSR y Lumen, sombras, reflejos y posproceso en nivel 2. Medido en el editor con los 17 pacientes: ALTA 24 fps de media (y el motor avisa de **memoria de vídeo agotada**, 66 MB por encima de los 4 GB de la RTX 3050), EQUILIBRADA 26 fps sin ese aviso y con imagen prácticamente igual; el 5 % peor sigue en 22 fps (cambios de personaje). Para llegar a 30 fps: reducir la memoria de vídeo de los MetaHumans (LOD y texturas de 8K a 2K, pelo en tarjetas a distancia) y precargar el siguiente personaje.
- Ejecutable: superado (ver 3.ª parte: el paquete optimizado se verificó).

## ▶ ÚLTIMO PUNTO (29/10/2026, noche)

- Presupuesto 0 €: nunca proponer compras.
- **17 pacientes distintos funcionando** (prueba `ciclo.ps1 -Probar -Todos` en el editor): cada uno con su cara MetaHuman, voz Piper, carácter, caso, ficha guardada y regreso recordando la visita. Plantilla de personas en `historial.json`; ampliable sin recompilar (MetaHuman nuevo con `crear_metahumans.py` y `EMM_SOLO`, de uno en uno por memoria, + línea en `personajes.json`).
- **Voces Piper dentro del juego** (NNE, sin programas externos): `EMMPiper`, `EMMFonetica`, `Content/Datos/voces.json`, modelos en `/Game/Voces` (`importar_voces.py`). 3 voces de hombre y 3 de mujer (las MLS son de mujer, ~200 Hz). Créditos CC BY en CONFIGURACIÓN. Android: falta (NNERuntimeORT no existe para Android; usar ONNX Runtime de Microsoft en la biblioteca Kotlin).
- **Ejecutable de Windows verificado con los 17 pacientes** (`ciclo.ps1 -Empaquetar` y `-ProbarPaquete -Todos`, 29/10/2026): empaquetado correcto, 17 caras distintas, 17 fichas guardadas y regreso de Visitación (P08) a revisión el 8/1/2027 recordando su visita. Rendimiento: 27 fps de media y 25 fps en el 5 % peor (RTX 3050 portátil); objetivo: volver a 30 fps o más. Esta es la **última versión funcional**: commit de GitHub posterior a `34ed96a`; ejecutable en `C:\Users\arric\ElMejorMedicoUE\Empaquetado\Windows\ElMejorMedicoUE.exe`.
- **Niños (gratis)**: MPFB2 (MakeHuman para Blender, código GPL, recursos CC0) YA está instalado en Blender con pieles jóvenes, peinados y ropa. En la escena `EMM_Ninos` se estaba creando un niño de 7 y una niña de 4 años con esqueleto «game engine» (mismos nombres de huesos que nuestra animación). Faltaba: en `deserialize_from_dict`, «eyes» debe ser `high-poly/high-poly.mhclo` (malla), no el color; luego exportar a FBX, importar en Unreal, adaptar `EMMCuerpoAnim` (boca con formas, no curvas MetaHuman) y sentar al acompañante.
- Pendientes anteriores: ropa gratuita de Epic en Fab (el usuario debe añadirla a su biblioteca), Celeste sin melena, Android («derivar a urgencias» ya hecho: ver arriba).
## ▶ PUNTO EXACTO PARA CONTINUAR (29/10/2026)

**Estado guardado**
- GitHub, rama `claude/medical-simulator-game-ruh821` (ver el último commit). Juego **Three.js** intacto: `pruebas/cir.js` y `pruebas/jugar.js` pasan (27/10; el 29/10 sólo se añadió `export` a `PISTAS` en `js/datos.js`).
- **Piloto Unreal 5.8** en `C:\Users\arric\ElMejorMedicoUE` (fuera de git; **no borrar**: los 9 MetaHumans y el nivel sólo están ahí). Código, datos y herramientas copiados en `unreal-piloto/` con `Herramientas\copiar-a-repositorio.ps1`.
- Piper (programa y 5 voces es-ES, 316 MB) descargado con permiso en `ElMejorMedicoUE\Fuentes\Piper` (fuera de git). **No se ejecuta**: `piper.exe`, `espeak-ng.dll` y `piper_phonemize.dll` no están firmados (el sistema de permisos lo impidió y Smart App Control lo bloquearía). El usuario eligió **integrar Piper dentro del juego** desde su código.

**Hecho y probado el 29/10 (prueba automática `-EMMPrueba`; ejecutable: ver «Ejecutable» abajo)**
- **Portátil encendido y funcional** (`EMMPantallaUI`): historia clínica electrónica ficticia con datos reales de la partida en 6 pestañas (paciente con constantes, alergias y antecedentes; consulta actual con lo que escribe el médico en directo y el registro de la conversación; historial; pruebas y resultados; recetas y tratamientos; agenda). Se dibuja en la pantalla 3D (marcador calculado desde la geometría de la tapa en `crear_consulta.py`, material propio retroiluminado `M_PantallaPortatil` y luz de pantalla) y se abre ampliada con el botón PORTÁTIL (ratón, dedo, mando). Portátil girado 25° hacia la cámara: se ve encendido desde el plano general sin tapar caras.
- **Pruebas médicas**: en AGENDA · FICHA › «Pruebas solicitadas» (texto libre). Tira de orina y ECG dan resultado en el momento; analítica, radiografía, ecografía y TAC, en la siguiente visita. Los valores vienen del juego web (coherentes con la enfermedad).
- **Médico con el portátil**: mira la pantalla y teclea con las dos manos (palmas abajo) cuando el jugador escribe, receta o consulta el portátil; al hablar vuelve a mirar al paciente. Ángulos en `Content/Datos/postura.json › teclado`.
- **158 casos** (`casos.json` v3, exportador `herramientas/exportar-casos-unreal.mjs`): las 41 enfermedades del juego web, todas las edades (10 bebés, 18 niños, 8 adolescentes, 76 adultos, 46 mayores), con personalidad, acompañante, constantes, analítica, orina, informes de pruebas y tratamiento.
- **8 pacientes MetaHuman** (presets elegidos con fotos de galería: `Herramientas/galeria_presets.py`): Mateo (h 14–25), Victor (h 26–40), Bruce (h 41–64), Walter (h 65+), Celeste (m 14–22), Vivian (m 23–40), Lani (m 41–64), Grace (m 65+). `Content/Datos/personajes.json` elige el de su sexo y edad y el juego lo sienta en la silla (`PonerPersonaje`). Construcción: `crear_metahumans.py` con `EMM_SOLO=<nombre>` **de uno en uno** (con varios seguidos el editor se queda sin memoria).
- **Voz por persona** (`EMMVoz::PerfilPara` con semilla): tono continuo con la edad y variación propia de tono, ritmo y voz (Laura/Helena).
- **Personalidad**: nerviosos se mueven más y hablan más deprisa; tranquilos y graves, menos. **Revisión anticipada**: si empeora antes de su cita, pide cita (se marca en el historial).
- **IA**: detecta respuestas casi repetidas y pide otra; corrige «soy el único» y tuteos.
- **Mando Xbox**: X micrófono, RB enviar, Y responder, LB portátil, RT recetar, Vista agenda, Menú configuración, B/Escape cerrar; Ctrl+Intro envía. Probado simulando las pulsaciones.
- Rendimiento en juego (RTX 3050 portátil): 30 fps de media, 24 en el 5 % peor.

**Esperando al usuario**
1. **Ropa gratuita de Epic** (el usuario la añade a su biblioteca de Fab; después se importa con el plugin de Fab del editor): Techwear Outfit `fab.com/listings/9e04c752-1979-4723-b78f-6d24afc532bc`, Hoodie `fae6467c-1d14-412c-b9b0-a579f0eb1b22`, Jeans `07dc895c-7402-411c-a74a-e1c47b33ac68`, T Shirt Variants `1b1009ae-4327-4c9d-9567-9314d88e7a86`, Sweater `d401d47a-204f-4fde-aaec-c230042e7f60`, Slim Jeans Variants `c5ed3971-03fd-4cec-804c-646422881fb3`, Crop Top Variants `39bcebb4-cbc7-4c5e-9cd6-d6dd6b5ed9ff`. No hay bata ni pijama sanitario gratis: el médico sigue con el pijama teñido.
2. **Niños (de pago, sin comprar nada sin su confirmación)**: propuesta de MetaHumans editables (mismo esqueleto: funcionan con toda la animación): Hometown Family (2 niños pequeños, adolescente y 2 adultos, ~16 € licencia personal), Toddler Twins (~12 €), Metahuman Child de Vano (~4 €), adolescentes Tina y Caleb (~3 € cada uno); bebé realista no MetaHuman (Realistic Baby, ~4,50 €, necesitaría animación propia o ir en un capazo). Los casos de bebés y niños pequeños los explica el acompañante: falta sentar al acompañante en la segunda silla.

**Siguiente trabajo (en orden)**
1. **Piper dentro del juego**: fonetizador propio de español (reglas; sin espeak-ng, que es GPL) que produzca los fonemas IPA de las voces es-ES + inferencia del modelo ONNX con NNE de Unreal (Windows) y ONNX Runtime de Microsoft (Android, firmado). Créditos de las voces CC BY (sharvard, mls).
2. Importar la ropa de Fab y vestir a cada paciente según edad y carácter.
3. Acompañante sentado (bebés, niños pequeños, mayores confusos) y opción «derivar a urgencias / ingreso» (un infarto no debe mandarse a casa).
4. Android: APK del piloto, dictado con `SpeechRecognizer`, interfaz táctil, prueba en emulador y Xiaomi.

**Errores y pendientes conocidos**
- Smart App Control bloquea a veces binarios nuevos (error 4551, en el «cook» o en el ejecutable). Solución: cambio real de código, recompilar y empaquetar; `ciclo.ps1` lo detecta.
- Celeste sale sin melena (su peinado largo no se ve tras construirla en calidad media).
- El complemento MCP de Blender está desactualizado (`uvx mcp-for-blender install-addon`; pedir permiso).
- El dictado de Windows coge ruido del ambiente si nadie habla (el texto se revisa antes de enviarlo).

**Cómo comprobar que todo sigue bien** (con el editor cerrado)
```
powershell -File C:\Users\arric\ElMejorMedicoUE\Herramientas\ciclo.ps1 -ProbarPaquete
```
Prueba corta del montaje y del desfile de personajes: `ciclo.ps1 -Probar -Montaje`.

---

## Histórico: punto de continuación del 27/10/2026 (ya superado)

**Estado guardado y verificado**
- GitHub, rama `claude/medical-simulator-game-ruh821`: la copia local y la remota coinciden (sin cambios pendientes). Últimos commits: `565eb2c` (ejecutable verificado, rendimiento, Smart App Control) y `bc61d4f` (recetas, ficha, calendario, seguimiento, portátil y mesa).
- Juego **Three.js** (el juego principal): intacto y funcionando. Sus pruebas `pruebas/cir.js` y `pruebas/jugar.js` pasan (27/10). El APK 1.0.1 sigue igual.
- **Piloto Unreal 5.8**: proyecto completo en `C:\Users\arric\ElMejorMedicoUE` (fuera de git porque los MetaHumans, los mapas y los binarios pesan mucho). El código, la configuración, los datos y las herramientas están copiados en `unreal-piloto/` (con `Herramientas\copiar-a-repositorio.ps1`, sin diferencias el 27/10). **No borrar esa carpeta**: los MetaHumans `MH_Medico`/`MH_Paciente` y el nivel `/Game/Mapas/Consulta` sólo están ahí. El nivel se puede rehacer con `crear_consulta.py` y los MetaHumans con `crear_metahumans.py` (necesitan sesión de Epic).
- Ejecutable de Windows verificado: `C:\Users\arric\ElMejorMedicoUE\Empaquetado\Windows\ElMejorMedicoUE.exe` (prueba automática completa correcta; 30 fps de media en la RTX 3050).

**Qué funciona ya en el piloto Unreal (probado en el ejecutable)**
Consulta con médico y paciente MetaHuman sentados, animación (respiración, mirada, microsacadas, asentimientos, boca con visemas, parpadeo, expresión de fondo, manos relajadas), ropa teñida (pijama sanitario del médico), voces es-ES por edad y sexo, IA local (Ollama en el procesador) con corrección de género y de tuteo, el jugador es el médico (escribir o dictar; nadie habla solo), subtítulos ON/OFF (OFF por defecto), portátil delante del médico mirándole, mesa ordenada sin objetos flotando, recetas (una por medicamento, guardar, modificar, anular, entregar, avisos de riesgo), ficha clínica persistente, calendario, revisiones, avance del tiempo y regreso del paciente con evolución y memoria.

**Por dónde seguir (en este orden, salvo que el usuario diga otra cosa)**
1. Preguntar al usuario si sigue con **Android** (Xiaomi 17 Ultra, controles táctiles) o antes con la **ropa clínica de Fab** (pedir permiso antes de descargar o aceptar nada).
2. Android del piloto: la biblioteca `Nativo/emm-nativo` (LiteRT-LM, TextToSpeech) ya compila; falta empaquetar el APK de Unreal, el dictado en Android (`EMMDictado` sólo funciona en Windows; en Android usar `SpeechRecognizer` por JNI), interfaz táctil (los paneles son UMG y ya se pueden tocar; revisar tamaños) y probar en el emulador `emm36` y en el Xiaomi (sin desactivar Play Protect).

**Errores y pendientes conocidos**
- Smart App Control (activado; el usuario NO quiere desactivarlo) bloquea a veces binarios nuevos (error 4551). Solución: recompilar con un cambio real de código y volver a empaquetar. `ciclo.ps1` lo detecta y avisa.
- Sólo hay un MetaHuman paciente (mujer adulta): todos los pacientes del piloto son mujeres adultas. Faltan MetaHumans de hombre, niño y mayor.
- Ropa: sólo existe la prenda básica (camiseta y pantalón corto), teñida. Falta bata o pijama de verdad (Fab, con permiso).
- La pantalla del portátil está apagada (se podría mostrar la historia clínica).
- La IA pequeña a veces repite casi la misma frase en dos respuestas seguidas de la revisión.
- El dictado de Windows coge ruido del ambiente si nadie habla (normal; el texto se revisa antes de enviarlo).

**Cómo comprobar que todo sigue bien al volver** (con el editor de Unreal cerrado)
```
powershell -File C:\Users\arric\ElMejorMedicoUE\Herramientas\ciclo.ps1 -ProbarPaquete
```
Debe acabar con la línea «Voces: …» después de la revisión de la paciente. Fotos en `Empaquetado\Windows\ElMejorMedicoUE\Saved\Capturas`.

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
- **Corrección prioritaria del usuario (25/10/2026)**: «el médico sólo habla cuando yo se lo ordeno y el paciente sólo responde cuando pulso su botón». Por eso: el cuadro empieza siempre vacío y las frases del juego sólo se ofrecen como «Sugerencia (opcional)» (`proponer()`), que hay que pulsar para copiarla y se puede cambiar; la única excepción es la receta, que ha escrito el propio jugador. Al explorar, el médico nunca habla (sólo subtítulos, 
arrar()`) y el paciente reacciona con la cara y en los subtítulos sin voz (`reaccion()`). Se eliminó la opción «frasesAuto». El botón se llama «ENVIAR · HABLAR MÉDICO». Las frases de prueba de voces sólo existen en Ajustes › «Probar voces por edades». Las pruebas automáticas desactivan la voz para que no se oigan en el portátil.
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
  - **Compilar el APK** (primer APK compilado el 26/10/2026, versión 1.0, 53,8 MB, arm64-v8a y x86_64): SDK con `platform-tools`, `platforms;android-36` y `build-tools` 35.0.0 y 36.0.0; `android/local.properties` con `sdk.dir` (no se versiona). Desde `app-android`: 
pm run web`, 
px cap sync android` y, con `JAVA_HOME` apuntando al JDK 21, `android\gradlew.bat assembleRelease` lanzado con la carpeta `android` como directorio de trabajo (desde PowerShell, `Start-Process -WorkingDirectory`; `cmd /c "cd /d … && gradlew"` falla por las comillas). Sale en `android/app/build/outputs/apk/release/app-release.apk`; se copia a `app-android/builds/` (no se versiona). Para actualizar, subir `versionCode` en `app/build.gradle` y firmar siempre con la misma clave. Con `Start-Process -Wait` hay que añadir `--no-daemon` (si no, el demonio de Gradle deja la orden colgada aunque termine). Versión actual: **1.0.1** (`versionCode` 2), firmas v2 y v3, copias de seguridad sin el modelo (`res/xml/copia_seguridad.xml` y `extraccion_datos.xml`), librerías nativas alineadas a 16 KB.
  - **Play Protect** (26/10/2026): en el Xiaomi bloqueó la 1.0 con «Aplicación bloqueada para proteger tu dispositivo · Play Protect no conoce ninguna otra aplicación de este desarrollador». La guía oficial (developers.google.com/android/play-protect/warning-dev-guidance) dice que ese bloqueo salta con READ_SMS, RECEIVE_SMS, BIND_NOTIFICATION_LISTENER_SERVICE o BIND_ACCESSIBILITY_SERVICE, y el APK no pide ninguno: lo que falta es reputación del desarrollador (clave nueva, instalación fuera de Play). Sin desactivar Play Protect: «Más detalles › Instalar de todas formas» si aparece; instalar por USB con adb (depuración USB; en Xiaomi además «Instalar vía USB»); o apelar en support.google.com/googleplay/android-developer/contact/protectappeals (cuenta de Google, gratis). La verificación obligatoria de desarrolladores empezó el 30/09/2026 en Brasil, Indonesia, Singapur y Tailandia; a España llegará en 2027 (cuenta gratuita de «distribución limitada», hasta 20 dispositivos).
  - **Prueba en Android real (emulador)**: `pruebas/android_emulador.js` maneja con Playwright la copia de pruebas `es.elmejormedico.juego.prueba` (`assembleDebug`, depurable, se instala aparte) en el emulador Android 16 con Google Play (`emm36`, WHPX). El modelo se copia con `adb push` a `/data/local/tmp/m.litertlm` y la prueba lo pone en la app con `run-as`. Ejecuta el Kotlin, LiteRT-LM y Gemma de verdad (en el procesador; la «GPU» del emulador es software y muy lenta). 26/10/2026: 10 de 10, también en modo avión; respuestas en 5–16 s en el procesador del emulador. Encontró dos fallos que la simulación no veía: `addListener` de Capacitor no devuelve promesa (la boca no se movía) y `esEco` rechazaba «No he tenido fiebre» por compartir palabras con la pregunta.
  - Prueba automática: `pruebas/app_simulada.js` (la parte JavaScript de la app con los módulos nativos simulados; Gemma responde desde fuera de la página y la página no tiene red de IA). **No ejecuta el Kotlin ni la GPU del móvil**: la prueba definitiva la hace el usuario en el Xiaomi, con el portátil apagado y en modo avión.
- **IA en el móvil por wifi (26/10/2026, sólo para pruebas)**: `JUGAR-EN-EL-MOVIL.cmd` abre Ollama si está cerrado y arranca `herramientas/servidor-movil.js` (Node, sin dependencias, puerto 8080). Ese servidor sirve el juego a la red local y hace de puente hacia Ollama en `/ollama/…`. Así Ollama sigue escuchando sólo en el portátil, sin `OLLAMA_HOST` ni `OLLAMA_ORIGINS`, y el puente sólo deja pasar `/api/tags`, `/api/chat`, `/api/version` y `/v1/chat/completions`. No sirve `pruebas/` ni `herramientas/`. `detectarIA` prueba, por este orden, la URL guardada, `origen/ollama` y `localhost:11434`. Si un día no encuentra la IA que había detectado sola, vuelve a las predefinidas para no esperar en cada respuesta. `precalentar()` carga el modelo al detectarlo (`keep_alive` 30 min), porque en frío la primera respuesta tardaba unos 30 s. Prueba automática: `pruebas/movil_ia.js` (navegador de móvil simulado, IP de red del portátil, `localhost:11434` bloqueado). **Falta probarlo en el Xiaomi real**: la primera vez, Windows pregunta si deja a Node usar la red (hay que aceptar en redes privadas) y la red del portátil debe ser «privada». Por `http://IP` el micrófono y la instalación como app no funcionan en Chrome de Android (no es un origen seguro): se arregla en `chrome://flags/#unsafely-treat-insecure-origin-as-secure` añadiendo `http://IP-del-portátil:8080`. Otras opciones no elegidas: WebLLM dentro del móvil, o un servicio de pago (sólo con autorización).
- **PRUEBA PILOTO EN UNREAL ENGINE 5.8 (autorizada el 26/10/2026)**: una consulta, médico y paciente MetaHuman, IA y voces, para PC y Android; la versión Three.js sigue siendo el juego. Proyecto en `C:\Users\arric\ElMejorMedicoUE` (ruta corta por Android, fuera de git); copia del código en `unreal-piloto/` (ver su `LEEME.md`, se actualiza con `Herramientas\copiar-a-repositorio.ps1`).
  - Herramientas instaladas con permiso: VS 2022 Build Tools (MSVC 14.44, SDK 22621, .NET 4.8 SDK), NDK r27c y CMake 3.22.1. La instalación del .NET SDK se atascó con la ventana de administrador oculta; se relanzó con `Start-Process -Verb RunAs` y el usuario la aceptó (si vuelve a pasar: `Herramientas\instalar-net48-sdk.cmd` con doble clic).
  - Hecho y probado en Windows (versión empaquetada, `-EMMPrueba`): consulta con muebles CC0 de Poly Haven (unidos en Blender), luz, cámara calculada entre médico y paciente, interfaz, turnos, IA real (Ollama en el procesador: libera los 4 GB de la RTX 3050 para los gráficos y responde en menos de 1 s) y voces de Windows (Pablo, Laura, Helena).
  - Lecciones: Python del editor sólo funciona bien desde `Content/Python/init_unreal.py` con `EMM_TAREA` (el editor tiene que haber terminado de arrancar); `unreal.Rotator` en Python es (roll, pitch, yaw); los parámetros de textura del material base necesitan texturas por defecto del tipo correcto (si no, no compila y sale el material de cuadros); en el juego sin personaje hay que volver a poner la cámara tras crearse el espectador; las fotos fiables son las del juego empaquetado.
  - **MetaHumans (27/10/2026)**:
    - El aviso «Imagen incorrecta» de `UnrealEditor-Fab.dll` fue un fallo puntual. Ocurrió una sola vez, el 26/10 a las 23:22, durante un arranque automático. La DLL y sus dependencias estaban bien y no se tocó la instalación.
    - El usuario inició sesión en Epic: inicio por código de dispositivo, aprobado en Edge en la página «Continuar en este dispositivo».
    - También instaló «MetaHuman Creator Core Data», que trae `Content/Optional` con 29 presets, pelo, barbas, la ropa básica y animaciones de plantilla.
    - `Herramientas/crear_metahumans.py` duplica los presets (médico «Lorenzo», paciente «Vivian»). Usa siempre llamadas bloqueantes: esperar con ciclos de refresco hace que Unreal se cierre con el error «UpdateLevelStreaming… already inside».
      - `EMM_FASE=preparar`: pide el rig `JOINTS_AND_BLEND_SHAPES` y las texturas `MetaHumanCharacterTextureRequestParams` con `blocking`.
      - `EMM_FASE=construir`: hace `try_add_object_to_edit` y luego `build_meta_human` OPTIMIZED MEDIUM. Antes borra `Unpacked/<nombre>`, porque si no Unreal pregunta si sobrescribir y, sin nadie delante, cancela.
      - Los Blueprints quedan en `/Game/MetaHumans/Personajes/Unpacked/MH_*/BP_MH_*`, y `crear_consulta.py` los coloca en lugar de los marcadores.
    - **Animación** (`EMMCuerpoAnim`, C++):
      - La clase de animación se le pone al componente «Body» al empezar.
      - Hace la postura sentada (`Content/Datos/postura.json`: pelvis y giros locales; muslos y gemelos en el eje Z ±88°, brazos en el eje Y 35°), la respiración y la mirada.
      - También envía las curvas `CTRL_expressions_*` (mandíbula, boca, parpadeo). La cara (ABP_Face) copia pose y curvas del cuerpo y RigLogic las aplica: comprobado con `-EMMBocaAbierta`.
      - El MetaHuman mira hacia +Y de su malla: su giro es la dirección hacia el otro menos 90°.
    - **Cámara**: plano de dos desde el lado de la ventana (médico de perfil a la izquierda, paciente de tres cuartos), calculada en `EMMConsultaModo` con los números de `Content/Datos/escena.json` (se ajusta sin recompilar).
    - **Memoria de vídeo**: sombras virtuales desactivadas (`r.Shadow.Virtual.Enable=0`). Con eso ya no aparece el aviso de memoria de vídeo agotada.
  - **Petición de 9 puntos (27/10/2026), hecho y probado con `-EMMPrueba` en el editor**:
    - «YO SOY EL MÉDICO»: sin preguntas sugeridas. Caja libre + MICRÓFONO (dictado SAPI en español de España, sin Internet: `EMMDictado`; el texto va a la caja para revisarlo) + ENVIAR · HABLAR MÉDICO + RESPONDER PACIENTE. Nadie habla solo.
    - CONFIGURACIÓN › SUBTÍTULOS ON/OFF: desactivados por defecto, guardados en `GameUserSettings.ini` (sección `ElMejorMedico`), se cambian al momento. El subtítulo va palabra a palabra con la voz (marcas `SPEI_WORD_BOUNDARY` de SAPI; en Android, proporcional al tiempo) y está encima del panel, sin tapar caras. La prueba lo activa en la 2.ª pregunta y deja la elección como estaba.
    - Boca: visemas de SAPI con apertura de mandíbula por visema, redondeo (o, u), estiramiento (e, i), labios juntos (p, b, m) y labio inferior mordido (f, v). Además: microsacadas de los ojos, asentimientos al hablar, cejas preocupadas en el paciente y sonrisa leve en el médico.
    - Postura: `postura.json` admite `"espacio": "cuerpo"` (eje del cuerpo: X lado, Y delante, Z arriba). Antebrazos hacia delante a la altura de la mesa y dedos relajados (eje local Z 22° en cada falange).
    - Ropa: sólo existe la prenda básica (camiseta y pantalón corto). Se tiñe en C++: pijama sanitario verde azulado para el médico; el paciente, colores según la edad (niño, joven, adulto, mayor) con variación fija por caso. **Para bata o pijama de verdad hace falta ropa de Fab: pedir permiso antes de descargar o aceptar nada.**
    - Voces por edad y sexo (`EMMVoz::PerfilPara`): niños con voz de mujer más aguda, adolescentes, adultos y mayores (más graves y lentos). El médico usa otra voz o tono si coincide con el paciente.
    - IA: `CorregirGenero` arregla los adjetivos sobre sí mismo detrás de un verbo en primera persona («estoy preocupado» → «preocupada»); la instrucción de género ya no lleva ejemplos (el modelo los copiaba).
    - Montaje: sillas más cerca de la mesa, portátil al 60 % en la esquina del médico y las libretas sobre la mesa (antes flotaban fuera del borde).
    - **Smart App Control** (activado, no se toca): a veces bloquea la DLL recién compilada (error 4551, política {0283ac0f-…}). Volver a intentarlo no basta; sí funciona recompilar con un cambio real de código (la decisión es por binario).
  - **Correcciones obligatorias (27/10/2026, tarde), hecho y probado con `-EMMPrueba` en el ejecutable empaquetado**:
    - **Portátil**: `crear_consulta.py` calcula hacia dónde mira la pantalla a partir de la geometría (la parte alta está en el lado de la bisagra; se redondea a 90°) y lo gira para que el teclado quede hacia el médico, recto y a 14 cm del borde de la mesa. Lo escala a 34 cm de ancho (el modelo original mide 66 cm: por eso se veía enorme). Se comprueba con tres cámaras de revisión: `portatil_medico` (lo que ve el médico), `portatil_paciente` (desde el otro lado sólo se ve la parte trasera) y `mesa_arriba`.
    - **Papeles**: fuera `office_notepads` (sus piezas flotaban). Ahora hay folios, notas adhesivas, un taco y un bolígrafo hechos con formas básicas, apoyados al milímetro sobre el tablero (78,8 cm), sin colisión y en el lado del médico, lejos de los brazos del paciente.
    - **Recetas (botón RECETAR, `EMMRecetaUI`)**: una receta por medicamento o tratamiento, con el diseño de la receta verde tradicional que envió el usuario, pero con un organismo ficticio (Hospital San Marcos), número propio, código de barras dibujado, firma ficticia y «SIMULACIÓN - SIN VALIDEZ MÉDICA». Se escribe o se dicta (MICRÓFONO · DICTAR escribe en el último campo tocado). Se puede guardar, modificar, anular y entregar. Las entregadas y las anuladas no se modifican.
    - **Riesgos** (`EMMEvolucion::Riesgos`): alergias (penicilina, AINE), alcohol (no es tratamiento; «litro» = consumo de alto riesgo), tabaco, dosis excesivas de paracetamol o ibuprofeno, y lo que su enfermedad debe evitar. Lo recetado se reconoce con el recetario y las pistas del juego web (`casos.json` versión 2, exportado de `datos.js`, donde ahora se exporta `PISTAS`). Se avisa al guardar y al entregar.
    - **Ficha clínica y calendario (AGENDA · FICHA, `EMMAgendaUI`, `EMMHistorial`)**: se guarda en `Saved/Historial/historial.json`. La prueba usa `historial_prueba.json` y empieza de cero. Incluye consultas, conversación, diagnóstico, pruebas, recetas con su estado y evolución. El calendario del juego empieza el lunes 4 de enero de 2027. Revisión en 3 días, 1 o 2 semanas, 1 o 3 meses, al acabar el tratamiento o sin revisión. Botones «Avanzar el tiempo hasta la próxima cita» y «Paciente nuevo (día siguiente)».
    - **Seguimiento** (`EMMEvolucion::Calcular`): las reglas deciden el resultado (recuperado, mejor, igual, peor o complicación) según la enfermedad, la edad, los antecedentes, lo recetado, el cumplimiento (fijo por paciente y visita) y los riesgos. Por ejemplo, la neumonía sin antibiótico se complica y el alcohol empeora. La IA lo cuenta: recibe la memoria de las consultas anteriores y las recetas entregadas.
    - **Ejecutable final verificado** (27/10/2026): flujo completo correcto y 30 fps de media (25 fps en el 5 % peor) en la RTX 3050 del portátil, con MetaHumans, IA en el procesador y voces. No hay medida anterior con la que comparar; lo nuevo es interfaz y datos (casi sin coste por fotograma). Smart App Control bloqueó tres binarios nuevos (DLL del editor en el «cook» o el ejecutable): ciclo.ps1 ya lo detecta y avisa.
    - **Prueba**: crea 4 recetas (una se modifica, tres se entregan, una se anula), lee el archivo guardado, programa la revisión «al acabar el tratamiento» (14 días), avanza el tiempo y la paciente vuelve, recuerda y cuenta los efectos del vino. También mide los fotogramas por segundo.
    - IA: además del género, `CorregirGenero` arregla «soy el único» → «la única» y los tuteos al médico más frecuentes («me recetaste» → «me recetó»).
  - Falta:
    - Ropa clínica de verdad (Fab, con permiso del usuario).
    - La pantalla del portátil está apagada (se podría mostrar la historia clínica).
    - Sólo hay un MetaHuman paciente (mujer): todos los pacientes del piloto son mujeres adultas. Para niños, hombres y mayores hacen falta más MetaHumans.
    - El APK de Android (la biblioteca `Nativo/emm-nativo` ya compila), con controles táctiles y dictado del móvil, y probarlo en el emulador y en el Xiaomi.
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

Requisitos: Node.js y Playwright (
pm i -g playwright` o en una carpeta aparte, con 
px playwright install chromium`).

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
