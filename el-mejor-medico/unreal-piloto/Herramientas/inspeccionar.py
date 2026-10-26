# EL MEJOR MÉDICO (Unreal): lista lo que hay en el nivel de la consulta y los parámetros de sus materiales.
import os
import unreal

niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
niveles.load_level('/Game/Mapas/Consulta')
lineas = []
for a in actores.get_all_level_actors():
    l = a.get_actor_location()
    o, e = a.get_actor_bounds(False)
    extra = ''
    if isinstance(a, unreal.StaticMeshActor):
        m = a.static_mesh_component.get_material(0)
        extra = f' mat={m.get_path_name() if m else None}'
    lineas.append(f'{a.get_actor_label():30s} {a.get_class().get_name():22s} pos=({l.x:.0f},{l.y:.0f},{l.z:.0f}) caja=({e.x:.0f},{e.y:.0f},{e.z:.0f}) tags={[str(t) for t in a.tags]}{extra}')
lineas.append('')
for nombre in ('MI_Pared_Pintura', 'MI_Suelo_Terrazo', 'MI_Techo'):
    mi = eal.load_asset(f'/Game/Materiales/{nombre}')
    if not mi:
        lineas.append(f'{nombre}: NO EXISTE')
        continue
    lineas.append(f'{nombre}: padre={mi.get_editor_property("parent").get_path_name()}')
    for p in ('Color', 'Normal', 'Rugosidad'):
        t = mel.get_material_instance_texture_parameter_value(mi, p)
        lineas.append(f'   {p} = {t.get_path_name() if t else None}')
    for p in ('Escala', 'UsoColorTextura'):
        lineas.append(f'   {p} = {mel.get_material_instance_scalar_parameter_value(mi, p)}')
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'Nivel.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] {len(lineas)} líneas en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
