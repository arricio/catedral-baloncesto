# EL MEJOR MÉDICO (Unreal): foto de la consulta desde la cámara del juego, a Saved/Capturas/<nombre>.png.
# Usa una cámara de captura que pinta en una textura (no necesita la ventana del editor delante).
# Uso: set EMM_TAREA=capturar.py && set EMM_CERRAR=1 && UnrealEditor.exe ElMejorMedicoUE.uproject
import os
import time
import unreal

niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
niveles.load_level(os.environ.get('EMM_NIVEL', '/Game/Mapas/Consulta'))
nombre = os.environ.get('EMM_CAPTURA', 'consulta')
carpeta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'Capturas')
os.makedirs(carpeta, exist_ok=True)

mundo = unreal.EditorLevelLibrary.get_editor_world()
camaras = [a for a in actores.get_all_level_actors() if unreal.Name('CamaraConsulta') in a.tags]
cam = camaras[0] if camaras else None
rt = unreal.RenderingLibrary.create_render_target2d(mundo, 1920, 1080, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
cap = actores.spawn_actor_from_class(unreal.SceneCapture2D, cam.get_actor_location() if cam else unreal.Vector(-175, -150, 150),
                                     cam.get_actor_rotation() if cam else unreal.Rotator(0, -8, 32))
cc = cap.capture_component2d
cc.set_editor_property('texture_target', rt)
cc.set_editor_property('capture_source', unreal.SceneCaptureSource.SCS_FINAL_TONE_CURVE_HDR)
if cam:
    cine = cam.get_cine_camera_component()
    cc.set_editor_property('fov_angle', cine.get_editor_property('field_of_view'))
estado = {'t0': None}


def tic(dt):
    estado['t0'] = estado['t0'] or time.time()
    pasado = time.time() - estado['t0']
    # varias capturas seguidas para que la iluminación (Lumen) y las texturas se asienten
    cc.capture_scene()
    if pasado > 25:
        unreal.RenderingLibrary.export_render_target(mundo, rt, carpeta, f'{nombre}.png')
        actores.destroy_actor(cap)
        unreal.unregister_slate_post_tick_callback(asa)
        unreal.log_warning(f'[EMM] captura guardada en {carpeta}/{nombre}.png')
        if os.environ.get('EMM_CERRAR') == '1':
            unreal.SystemLibrary.quit_editor()


asa = unreal.register_slate_post_tick_callback(tic)
