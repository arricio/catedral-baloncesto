# EL MEJOR MÉDICO (Unreal): niveles de detalle (LOD) del cuerpo, la cara y la ropa de los MetaHumans y cuáles se
# quitan en móvil (min_lod por plataforma). Si el cuerpo y la ropa usan LOD que no casan, el cuerpo atraviesa la ropa.
import os
import unreal

eal = unreal.EditorAssetLibrary
sme = unreal.get_editor_subsystem(unreal.SkeletalMeshEditorSubsystem)
lineas = []


def p(obj, prop):
    try:
        return obj.get_editor_property(prop)
    except Exception as e:
        return f'¿{e}?'


for nombre in ('MH_Medico', 'MH_P_Etta'):
    base = f'/Game/MetaHumans/Personajes/Unpacked/{nombre}'
    for parte, ruta in (('cuerpo', f'{base}/Body/SKM_{nombre}_BodyMesh'), ('cara', f'{base}/Face/SKM_{nombre}_FaceMesh'), ('ropa', f'{base}/Clothing/{nombre}_Outfits')):
        m = eal.load_asset(ruta)
        if not m:
            lineas.append(f'{nombre} {parte}: no existe {ruta}')
            continue
        mn = p(m, 'min_lod')
        lineas.append(f'{nombre} {parte}: LOD={sme.get_lod_count(m)} min_lod={p(mn, "default")} por plataforma={p(mn, "per_platform")} '
                      f'quality={p(m, "min_quality_level_lod")} stripping={p(m, "disable_below_min_lod_stripping")} lod_settings={p(m, "lod_settings")}')
        try:
            for i in range(sme.get_lod_count(m)):
                info = m.get_lod_info(i) if hasattr(m, 'get_lod_info') else None
                lineas.append(f'    LOD{i}: {p(info, "screen_size") if info else ""} reduction={p(info, "b_has_been_simplified") if info else ""}')
        except Exception as e:
            lineas.append(f'    {e}')
    clase = eal.load_blueprint_class(f'{base}/BP_{nombre}')
    a = unreal.EditorLevelLibrary.spawn_actor_from_class(clase, unreal.Vector(0, 0, -5000))
    for c in a.get_components_by_class(unreal.LODSyncComponent):
        for prop in ('num_lo_ds', 'forced_lod', 'min_lod', 'component_to_sync_and_map', 'custom_lod_mapping'):
            lineas.append(f'  LODSync {prop} = {p(c, prop)}')
    for c in a.get_components_by_class(unreal.ActorComponent):
        if 'MetaHuman' in c.get_class().get_name():
            for prop in ('body_type', 'enable_body_correctives', 'lod_threshold', 'body_component_name', 'face_component_name'):
                lineas.append(f'  MetaHuman {prop} = {p(c, prop)}')
    a.destroy_actor()

ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'LOD.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(str(x) for x in lineas))
unreal.log_warning(f'[EMM] LOD en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
