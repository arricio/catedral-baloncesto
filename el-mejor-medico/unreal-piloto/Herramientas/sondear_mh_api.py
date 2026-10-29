# EL MEJOR MÉDICO (Unreal): firma de las funciones de MetaHuman que sirven para ver y ajustar los presets
import os
import unreal

mh = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
lineas = []
for f in ('spawn_meta_human_actor', 'assemble_for_preview', 'get_body_constraints', 'set_body_constraints', 'commit_skin_settings', 'commit_head_model_settings', 'commit_face_state', 'get_face_model_coefficients'):
    lineas.append(f'## {f}\n{getattr(mh, f).__doc__}')
for t in ('MetaHumanCharacterSkinSettings', 'MetaHumanCharacterSkinProperties', 'MetaHumanCharacterHeadModelSettings', 'MetaHumanCharacterEyesSettings', 'MetaHumanCharacterBodyConstraint'):
    if hasattr(unreal, t):
        lineas.append(f'## {t}\n{getattr(unreal, t).__doc__}')
a = unreal.EditorAssetLibrary.load_asset('/MetaHumanCharacter/Optional/Presets/Walter')
mh.try_add_object_to_edit(a)
try:
    c = mh.get_body_constraints(a)
    lineas.append('## restricciones del cuerpo (Walter)\n' + '\n'.join(str(x)[:300] for x in c))
except Exception as e:
    lineas.append(f'restricciones: {e}')
mh.remove_object_to_edit(a)
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'MetaHuman_API3.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] API en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
