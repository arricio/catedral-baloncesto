# EL MEJOR MÉDICO (Unreal): cómo están hechos los MetaHumans montados (componentes, animación, curvas de la cara).
import os
import unreal

eal = unreal.EditorAssetLibrary
lineas = []
for nombre in ('MH_Medico', 'MH_Paciente'):
    ruta = f'/Game/MetaHumans/Personajes/Unpacked/{nombre}/BP_{nombre}'
    clase = eal.load_blueprint_class(ruta)
    cdo = unreal.get_default_object(clase)
    lineas.append(f'## {nombre}: {clase.get_name()}  padre={clase.get_super_class().get_name() if hasattr(clase, "get_super_class") else "?"}')
    subs = unreal.get_engine_subsystem(unreal.SubobjectDataSubsystem)
    datos = subs.k2_gather_subobject_data_for_blueprint(eal.load_asset(ruta))
    for h in datos:
        d = unreal.SubobjectDataBlueprintFunctionLibrary.get_data(h)
        obj = unreal.SubobjectDataBlueprintFunctionLibrary.get_object(d)
        if obj is None:
            continue
        linea = f'  {obj.get_name()} ({obj.get_class().get_name()})'
        if isinstance(obj, unreal.SkeletalMeshComponent):
            malla = obj.get_editor_property('skeletal_mesh_asset') if hasattr(obj, 'skeletal_mesh_asset') else obj.get_skeletal_mesh_asset()
            linea += f' malla={malla.get_path_name() if malla else None}'
            linea += f' anim_class={obj.get_editor_property("anim_class")} modo={obj.get_editor_property("animation_mode")}'
            if malla:
                pp = malla.get_editor_property('post_process_anim_blueprint')
                linea += f' postproceso={pp}'
                esq = malla.get_editor_property('skeleton')
                if esq and 'Face' in obj.get_name():
                    curvas = [str(n) for n in esq.get_curve_meta_data_names()] if hasattr(esq, 'get_curve_meta_data_names') else []
                    lineas.append(f'    curvas de la cara ({len(curvas)}): ' + ', '.join(c for c in curvas if any(k in c for k in ('jaw', 'Jaw', 'mouth', 'Mouth', 'Blink', 'blink', 'lip')))[:3000])
        lineas.append(linea)
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'MetaHuman_Montado.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] montaje en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
