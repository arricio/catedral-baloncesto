# EL MEJOR MÉDICO (Unreal): por qué la ropa sale con «agujeros» en Android y no en Windows.
# Lista los componentes de los MetaHumans montados (deformadores, LOD, mallas) para ver qué ajusta la ropa al cuerpo.
import os
import unreal

eal = unreal.EditorAssetLibrary
lineas = []


def p(obj, prop):
    try:
        return obj.get_editor_property(prop)
    except Exception as e:
        return f'¿{e.__class__.__name__}?'


for nombre in ('MH_Medico', 'MH_P_Etta'):
    rutas = [r for r in eal.list_assets(f'/Game/MetaHumans/Personajes/Unpacked/{nombre}', recursive=True)]
    bp = next((r for r in rutas if r.split('/')[-1].startswith('BP_')), None)
    lineas.append(f'## {nombre}: {bp}')
    lineas += ['  asset ' + r for r in rutas if any(k in r for k in ('Outfit', 'Cloth', 'Body', 'Deformer', 'Hidden', 'Mask'))][:40]
    if not bp:
        continue
    clase = eal.load_blueprint_class(bp.split('.')[0])
    cdo = unreal.get_default_object(clase)
    mundo = unreal.EditorLevelLibrary.get_editor_world()
    a = unreal.EditorLevelLibrary.spawn_actor_from_class(clase, unreal.Vector(0, 0, -5000))
    for c in a.get_components_by_class(unreal.SkeletalMeshComponent):
        m = c.get_skeletal_mesh_asset() if hasattr(c, 'get_skeletal_mesh_asset') else p(c, 'skeletal_mesh_asset')
        lineas.append(f'  componente {c.get_name()}: malla={m.get_path_name() if m else None}')
        for prop in ('mesh_deformer', 'mesh_deformer_settings', 'leader_pose_component', 'forced_lod_model', 'disable_morph_target', 'b_disable_cloth_simulation', 'cloth_blend_weight'):
            lineas.append(f'      {prop} = {p(c, prop)}')
        if m:
            try:
                lineas.append(f'      LOD: {m.get_editor_property("lod_info").__len__()} · morphs: {len(m.get_editor_property("morph_targets"))}')
            except Exception as e:
                lineas.append(f'      LOD/morphs: {e}')
            try:
                lineas.append(f'      deformador por defecto de la malla = {m.get_editor_property("default_mesh_deformer")}')
            except Exception as e:
                lineas.append(f'      deformador de la malla: {e}')
    for c in a.get_components_by_class(unreal.ActorComponent):
        lineas.append(f'  (comp) {c.get_name()} · {c.get_class().get_name()}')
    a.destroy_actor()

ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'RopaMovil.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(str(x) for x in lineas))
unreal.log_warning(f'[EMM] ropa (móvil) en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
