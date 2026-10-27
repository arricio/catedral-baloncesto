# EL MEJOR MÉDICO (Unreal): qué hay en los presets de MetaHuman (tipo de recurso, piel, si traen rig, ropa y pelo).
import os
import unreal

eal = unreal.EditorAssetLibrary
mh = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
lineas = []
raiz = None
for r in ('/MetaHumanCharacter/Optional/Presets', '/MetaHumanCharacter/Presets'):
    if eal.does_directory_exist(r):
        raiz = r
lineas.append(f'carpeta de presets: {raiz}')
for ruta in eal.list_assets(raiz or '/MetaHumanCharacter', recursive=False):
    a = eal.load_asset(ruta)
    linea = f'{ruta}  clase={a.get_class().get_name()}'
    if isinstance(a, unreal.MetaHumanCharacter):
        try:
            piel = a.get_editor_property('skin_settings').get_editor_property('skin')
            linea += f'  piel=(u={piel.get_editor_property("u"):.2f}, v={piel.get_editor_property("v"):.2f})'
        except Exception as e:
            linea += f'  piel=? {e}'
        try:
            linea += f'  cuerpo_fijo={a.get_editor_property("fixed_body_type")}'
            mh.try_add_object_to_edit(a)
            linea += f'  construible={mh.can_build_meta_human(a, False)}'
            mh.remove_object_to_edit(a)
        except Exception as e:
            linea += f'  ({e})'
    lineas.append(linea)
# ropa y pelo disponibles (artículos del vestuario)
for r in eal.list_assets('/MetaHumanCharacter', recursive=True):
    if '/WI_' in r and ('Clothing' in r or 'Hair' in r or 'Outfit' in r):
        lineas.append(f'VESTUARIO {r}')
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'Presets.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] presets en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
