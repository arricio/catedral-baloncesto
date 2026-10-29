# EL MEJOR MÉDICO (Unreal): propiedades de los presets de MetaHuman (para elegir pacientes de distintas edades y sexos)
import os
import unreal

eal = unreal.EditorAssetLibrary
mh = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
lineas = []
primero = True
for ruta in sorted(eal.list_assets('/MetaHumanCharacter/Optional/Presets', recursive=False)):
    a = eal.load_asset(ruta)
    if not isinstance(a, unreal.MetaHumanCharacter):
        continue
    nombre = ruta.split('/')[-1].split('.')[0]
    if primero:
        primero = False
        lineas.append('PROPIEDADES: ' + ', '.join(p for p in dir(a) if not p.startswith('_'))[:4000])
    datos = []
    for prop in ('body_type', 'fixed_body_type', 'skin_settings', 'head_model_settings', 'eyes_settings', 'makeup_settings', 'face_evaluation_settings', 'body_measurements'):
        try:
            v = a.get_editor_property(prop)
            datos.append(f'{prop}={str(v)[:300]}')
        except Exception:
            pass
    try:
        mh.try_add_object_to_edit(a)
        for f in ('get_body_type', 'get_face_state', 'get_measurements'):
            if hasattr(mh, f):
                try:
                    datos.append(f'{f}={str(getattr(mh, f)(a))[:300]}')
                except Exception as e:
                    datos.append(f'{f}: {e}')
        mh.remove_object_to_edit(a)
    except Exception as e:
        datos.append(f'editar: {e}')
    lineas.append(f'## {nombre}: ' + ' | '.join(datos))
lineas.append('SUBSISTEMA: ' + ', '.join(p for p in dir(mh) if not p.startswith('_')))
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'Presets2.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] presets en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
