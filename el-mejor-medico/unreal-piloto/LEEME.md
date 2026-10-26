# EL MEJOR MÉDICO — prueba piloto en Unreal Engine 5.8

Copia del código fuente del piloto autorizado el 26/10/2026 (una consulta con médico y paciente, IA y voces, para PC y Android).
El proyecto de trabajo está en `C:\Users\arric\ElMejorMedicoUE` (ruta corta, necesaria para Android). Aquí sólo se guarda el texto;
el contenido binario (`Content/`, muebles importados y MetaHumans) no se sube a GitHub. La versión Three.js sigue siendo el juego principal.

- `Source/ElMejorMedicoUE/`: C++ del juego.
  - `EMMConsultaModo`: la consulta, los turnos y la prueba automática `-EMMPrueba`.
  - `EMMIA`: la IA. En el PC usa Ollama en el procesador, para dejar la GPU a los gráficos. En Android usa Gemma 4 E2B con LiteRT-LM.
  - `EMMVoz`: las voces de Windows (SAPI) y de Android.
  - `EMMHabla`: el audio en la boca, la apertura, los visemas y el parpadeo.
  - `EMMConsultaUI`: la interfaz.
- `Nativo/emm-nativo/`: biblioteca Kotlin de Android (IA y voces), que se compila a `Source/ElMejorMedicoUE/Android/emm-nativo.aar`.
- `Herramientas/`:
  - `ciclo.ps1`: compilar, ejecutar tareas, empaquetar y probar.
  - `crear_consulta.py`: monta la habitación.
  - `unir_muebles_blender.py`: prepara los muebles de Poly Haven (CC0).
  - `descargar-polyhaven.mjs`: descarga los muebles y las texturas de Poly Haven.
- `Content/Datos/casos.json`: pacientes exportados del juego web con `herramientas/exportar-casos-unreal.mjs`.
