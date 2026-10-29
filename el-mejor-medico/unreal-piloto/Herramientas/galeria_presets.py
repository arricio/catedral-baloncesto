# EL MEJOR MÉDICO (Unreal): foto de los presets de MetaHuman (6 por foto) para elegir pacientes de cada edad y sexo.
# Uso: EMM_LOTE=0..4. Monta un nivel aparte (/Game/Mapas/Galeria), pone el lote de presets en fila con su vista previa,
# hace la foto (Saved/Galeria/lote_N.png) y cierra. No toca la consulta ni los personajes del juego.
import os
import unreal

eal = unreal.EditorAssetLibrary
mh = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
LOTE = int(os.environ.get('EMM_LOTE', '0'))
TAM = 6


def log(t):
    unreal.log_warning('[EMM] ' + t)


presets = sorted(r.split('.')[0] for r in eal.list_assets('/MetaHumanCharacter/Optional/Presets', recursive=False)
                 if isinstance(eal.load_asset(r), unreal.MetaHumanCharacter))
lote = presets[LOTE * TAM:(LOTE + 1) * TAM]
if eal.does_asset_exist('/Game/Mapas/Galeria'):
    niveles.load_level('/Game/Mapas/Galeria')
    for a in actores.get_all_level_actors():
        if not isinstance(a, unreal.WorldSettings):
            actores.destroy_actor(a)
else:
    niveles.new_level('/Game/Mapas/Galeria')
sol = actores.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0, 0, 300), unreal.Rotator(0, -35, 160))
sol.light_component.set_intensity(4.0)
cielo = actores.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0, 0, 300))
cielo.light_component.set_intensity(1.5)
suelo = actores.spawn_actor_from_object(eal.load_asset('/Engine/BasicShapes/Plane'), unreal.Vector(0, 0, 0))
suelo.set_actor_scale3d(unreal.Vector(20, 20, 1))
nombres = []
for i, ruta in enumerate(lote):
    c = eal.load_asset(ruta)
    mh.try_add_object_to_edit(c)
    mh.assemble_for_preview(c)
    a = mh.spawn_meta_human_actor(c, True)
    # en fila, mirando a la cámara (el MetaHuman mira hacia +Y de su malla)
    a.set_actor_location_and_rotation(unreal.Vector(0, (i - (len(lote) - 1) / 2) * 58, 0), unreal.Rotator(0, 0, 90), False, False)
    nombres.append(ruta.split('/')[-1])
cam = actores.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(-360, 0, 158), unreal.Rotator(0, -4, 0))
cam.camera_component.set_editor_property('field_of_view', 55.0)
salida = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'Galeria')
os.makedirs(salida, exist_ok=True)
with open(os.path.join(salida, f'lote_{LOTE}.txt'), 'w', encoding='utf-8') as f:
    f.write(' | '.join(nombres))
log(f'lote {LOTE}: {", ".join(nombres)}')

cuenta = {'n': 0}


def tic(dt):
    cuenta['n'] += 1
    if cuenta['n'] == 240:
        unreal.AutomationLibrary.take_high_res_screenshot(1920, 1080, os.path.join(salida, f'lote_{LOTE}.png'), cam)
    if cuenta['n'] == 420:
        unreal.unregister_slate_post_tick_callback(manejador)
        log('foto hecha')
        if os.environ.get('EMM_CERRAR') == '1':
            unreal.SystemLibrary.quit_editor()


manejador = unreal.register_slate_post_tick_callback(tic)
