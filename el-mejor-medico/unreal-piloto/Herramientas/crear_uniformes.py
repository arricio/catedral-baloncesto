# EL MEJOR MÉDICO (Unreal): uniforme sanitario de los médicos (pantalón largo y zapatos) para cada MetaHuman,
# hecho de una copia de su propio cuerpo (UEMMHerramientas::CrearUniforme, C++). Sin recursos de fuera.
# Resultado: /Game/Uniformes/SKM_<MetaHuman>_Uniforme y el material M_Uniforme (enmascarado por el color de los
# vértices; parámetros «Tinte», el pantalón, y «Calzado»). EMM_SOLO="MH_Medico,..." para hacer sólo algunos.
import os
import unreal

eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
at = unreal.AssetToolsHelpers.get_asset_tools()
DESTINO = '/Game/Uniformes'
BASE = '/Game/MetaHumans/Personajes/Unpacked'


def expr(m, clase, x, y, **props):
    e = mel.create_material_expression(m, clase, x, y)
    for k, v in props.items():
        e.set_editor_property(k, v)
    return e


def material_uniforme():
    ruta = f'{DESTINO}/M_Uniforme'
    if eal.does_asset_exist(ruta):
        return eal.load_asset(ruta)
    m = at.create_asset('M_Uniforme', DESTINO, unreal.Material, unreal.MaterialFactoryNew())
    m.set_editor_property('blend_mode', unreal.BlendMode.BLEND_MASKED)
    m.set_editor_property('used_with_skeletal_mesh', True)
    vc = expr(m, unreal.MaterialExpressionVertexColor, -900, 0)
    tela = expr(m, unreal.MaterialExpressionVectorParameter, -900, -300, parameter_name='Tinte', default_value=unreal.LinearColor(0.05, 0.25, 0.35, 1))
    zap = expr(m, unreal.MaterialExpressionVectorParameter, -900, -500, parameter_name='Calzado', default_value=unreal.LinearColor(0.85, 0.85, 0.85, 1))
    # alfa: 1 en el pantalón (R = 1), 0 en el zapato (R = 0,5)
    resta = expr(m, unreal.MaterialExpressionSubtract, -650, 0, const_b=0.5)
    mel.connect_material_expressions(vc, 'R', resta, 'A')
    por = expr(m, unreal.MaterialExpressionMultiply, -500, 0, const_b=4.0)
    mel.connect_material_expressions(resta, '', por, 'A')
    sat = expr(m, unreal.MaterialExpressionSaturate, -350, 0)
    mel.connect_material_expressions(por, '', sat, '')
    color = expr(m, unreal.MaterialExpressionLinearInterpolate, -200, -300)
    mel.connect_material_expressions(zap, '', color, 'A')
    mel.connect_material_expressions(tela, '', color, 'B')
    mel.connect_material_expressions(sat, '', color, 'Alpha')
    mel.connect_material_property(color, '', unreal.MaterialProperty.MP_BASE_COLOR)
    rug = expr(m, unreal.MaterialExpressionLinearInterpolate, -200, 150, const_a=0.45, const_b=0.85)
    mel.connect_material_expressions(sat, '', rug, 'Alpha')
    mel.connect_material_property(rug, '', unreal.MaterialProperty.MP_ROUGHNESS)
    # sólo se ve lo marcado: R × 3 (pantalón 3, zapato 1,5, resto 0) contra el corte de 1/3
    vis = expr(m, unreal.MaterialExpressionMultiply, -350, 300, const_b=3.0)
    mel.connect_material_expressions(vc, 'R', vis, 'A')
    mel.connect_material_property(vis, '', unreal.MaterialProperty.MP_OPACITY_MASK)
    mel.recompile_material(m)
    eal.save_loaded_asset(m, False)
    return m


material = material_uniforme()
todos = [x for x in os.environ.get('EMM_SOLO', '').split(',') if x] or sorted(
    {p.rstrip('/').split('/')[-1] for p in eal.list_assets(BASE, recursive=False, include_folder=True)} - {''})
lineas = []
for n in todos:
    if not n.startswith('MH_'):
        continue
    cuerpo = f'{BASE}/{n}/Body/SKM_{n}_BodyMesh'
    if not eal.does_asset_exist(cuerpo):
        lineas.append(f'{n}: sin cuerpo')
        continue
    copia = f'{DESTINO}/SKM_{n}_Uniforme'
    if eal.does_asset_exist(copia):
        eal.delete_asset(copia)
    malla = eal.duplicate_asset(cuerpo, copia)
    r = unreal.EMMHerramientas.crear_uniforme(malla, material, 1.2, 0.7)
    eal.save_loaded_asset(malla, False)
    lineas.append(f'{n}: {r}')
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'Uniformes.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
