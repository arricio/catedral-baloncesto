# EL MEJOR MÉDICO (Unreal): comprueba los materiales recortados (pelo, cejas, pestañas) de un niño
import os
import unreal

eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
lineas = []
m = eal.load_asset('/Game/Ninos/M_NinoRecorte')
lineas.append(f'maestro: {m} parámetros textura={[str(x) for x in mel.get_texture_parameter_names(m)]} blend={m.get_editor_property("blend_mode")}')
for r in eal.list_assets('/Game/Ninos/Nino_Escolar_H', recursive=False):
    a = eal.load_asset(r)
    if isinstance(a, unreal.MaterialInstanceConstant) and r.split('/')[-1].startswith('MI_'):
        vals = [(str(p.get_editor_property('parameter_info').get_editor_property('name')), p.get_editor_property('parameter_value')) for p in a.get_editor_property('texture_parameter_values')]
        lineas.append(f'{r}: padre={a.get_editor_property("parent")} texturas={vals} get={mel.get_material_instance_texture_parameter_value(a, "Color")}')
    if isinstance(a, unreal.Texture2D):
        lineas.append(f'{r}: compresión={a.get_editor_property("compression_settings")} srgb={a.get_editor_property("srgb")} alfa={a.get_editor_property("compression_no_alpha")}')
malla = eal.load_asset('/Game/Ninos/Nino_Escolar_H/Nino_Escolar_H')
for sm in malla.get_editor_property('materials'):
    lineas.append(f'ranura {sm.get_editor_property("material_slot_name")}: {sm.get_editor_property("material_interface")}')
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'MaterialNino.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(str(x) for x in lineas))
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
