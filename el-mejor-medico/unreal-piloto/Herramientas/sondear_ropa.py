# EL MEJOR MÉDICO (Unreal): qué materiales y parámetros tiene la ropa de los MetaHumans (para teñirla desde C++).
import os
import unreal

eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
lineas = []
for nombre in ('MH_Medico', 'MH_Paciente'):
    malla = eal.load_asset(f'/Game/MetaHumans/Personajes/Unpacked/{nombre}/Clothing/{nombre}_Outfits')
    lineas.append(f'## {nombre}: {malla}')
    if not malla:
        continue
    for i, m in enumerate(malla.get_editor_property('materials')):
        mat = m.get_editor_property('material_interface')
        lineas.append(f'  [{i}] ranura={m.get_editor_property("material_slot_name")} material={mat.get_path_name() if mat else None}')
        if not mat:
            continue
        for tipo, f in (('escalar', mel.get_scalar_parameter_names), ('vector', mel.get_vector_parameter_names), ('textura', mel.get_texture_parameter_names)):
            try:
                nombres = [str(n) for n in f(mat)]
            except Exception as e:
                nombres = [f'error {e}']
            lineas.append(f'      {tipo}: ' + ', '.join(nombres))
        if isinstance(mat, unreal.MaterialInstance):
            for p in mat.get_editor_property('vector_parameter_values'):
                lineas.append(f'      valor {p.get_editor_property("parameter_info").get_editor_property("name")} = {p.get_editor_property("parameter_value")}')
            for p in mat.get_editor_property('texture_parameter_values'):
                lineas.append(f'      tex {p.get_editor_property("parameter_info").get_editor_property("name")} = {p.get_editor_property("parameter_value")}')
# carpeta de ropa del plugin: otras prendas disponibles sin descargar nada
for raiz in ('/MetaHumanCharacter/Optional/Clothing', '/MetaHumanCharacter/Clothing', '/MetaHumanCharacter/Optional'):
    try:
        rutas = [r for r in eal.list_assets(raiz, recursive=True) if 'Outfit' in r or 'Cloth' in r or 'Garment' in r]
    except Exception as e:
        rutas = [f'error {e}']
    lineas.append(f'## {raiz}: {len(rutas)}')
    lineas += ['  ' + r for r in rutas[:80]]
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'Ropa.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] ropa en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
