# EL MEJOR MÉDICO (Unreal): importa los niños y bebés hechos con MPFB (Fuentes/Ninos/*.fbx, CC0) como mallas
# esqueléticas en /Game/Ninos/<nombre>, con su forma «Boca» (morph target) y sus texturas.
import os
import unreal

eal = unreal.EditorAssetLibrary
FUENTE = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()), 'Fuentes', 'Ninos')
NINOS = ['Nino_Bebe', 'Nino_Bebe_M', 'Nino_Pequeno_H', 'Nino_Pequena_M', 'Nino_Escolar_H', 'Nino_Escolar_M']
lineas = []

for n in NINOS:
    destino = f'/Game/Ninos/{n}'
    if eal.does_directory_exist(destino):
        eal.delete_directory(destino)
    t = unreal.AssetImportTask()
    t.filename = os.path.join(FUENTE, n + '.fbx')
    t.destination_path = destino
    t.automated = True
    t.replace_existing = True
    t.save = True
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
    rutas = eal.list_assets(destino, recursive=True)
    lineas.append(f'## {n}: {len(rutas)} assets')
    for r in rutas:
        a = eal.load_asset(r)
        tipo = a.get_class().get_name() if a else '?'
        extra = ''
        if isinstance(a, unreal.SkeletalMesh):
            try:
                extra = f' morphs={[m.get_name() for m in a.get_editor_property("morph_targets")]}'
            except Exception as e:
                extra = f' morphs: {e}'
            b = a.get_bounds()
            extra += f' alto={b.box_extent.z * 2:.1f} cm'
        lineas.append(f'  {tipo} {r}{extra}')

# Materiales propios (el FBX llega con materiales opacos y el pelo se ve como un casco gris):
#  - M_NinoBase: piel, ojos, ropa y zapatos (color + relieve)
#  - M_NinoRecorte: pelo, cejas y pestañas, recortados por el alfa de la textura (dos caras)
# Los dos llevan «Tinte» y «TinteFuerza» (creador de personajes): color = mezcla(textura × tinte, gris de la
# textura × tinte × 2, fuerza). Con fuerza 0 el tinte multiplica (piel, ojos); con fuerza alta recolorea (pelo).
mel = unreal.MaterialEditingLibrary
at = unreal.AssetToolsHelpers.get_asset_tools()


def material(nombre, recortado):
    ruta = f'/Game/Ninos/{nombre}'
    if eal.does_asset_exist(ruta):
        eal.delete_asset(ruta)
    m = at.create_asset(nombre, '/Game/Ninos', unreal.Material, unreal.MaterialFactoryNew())
    if recortado:
        m.set_editor_property('blend_mode', unreal.BlendMode.BLEND_MASKED)
        m.set_editor_property('two_sided', True)
        m.set_editor_property('opacity_mask_clip_value', 0.4)
    # sin estos usos, en el juego Unreal lo cambia por su material de rejilla (mallas con esqueleto y con «Boca»)
    m.set_editor_property('used_with_skeletal_mesh', True)
    m.set_editor_property('used_with_morph_targets', True)
    tex = mel.create_material_expression(m, unreal.MaterialExpressionTextureSampleParameter2D, -900, 0)
    tex.set_editor_property('parameter_name', 'Color')
    # sin textura por defecto el parámetro no compila y Unreal pinta la rejilla gris
    tex.set_editor_property('texture', eal.load_asset('/Engine/EngineResources/DefaultTexture'))
    tinte = mel.create_material_expression(m, unreal.MaterialExpressionVectorParameter, -900, 300)
    tinte.set_editor_property('parameter_name', 'Tinte')
    tinte.set_editor_property('default_value', unreal.LinearColor(1, 1, 1, 1))
    fuerza = mel.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -900, 450)
    fuerza.set_editor_property('parameter_name', 'TinteFuerza')
    fuerza.set_editor_property('default_value', 0.0)
    mult = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -600, 0)
    mel.connect_material_expressions(tex, 'RGB', mult, 'A'); mel.connect_material_expressions(tinte, '', mult, 'B')
    gris = mel.create_material_expression(m, unreal.MaterialExpressionDesaturation, -600, 150)
    mel.connect_material_expressions(tex, 'RGB', gris, '')
    gris2 = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -450, 150)
    mel.connect_material_expressions(gris, '', gris2, 'A'); mel.connect_material_expressions(tinte, '', gris2, 'B')
    doble = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -300, 150)
    doble.set_editor_property('const_b', 2.0)
    mel.connect_material_expressions(gris2, '', doble, 'A')
    mezcla = mel.create_material_expression(m, unreal.MaterialExpressionLinearInterpolate, -150, 0)
    mel.connect_material_expressions(mult, '', mezcla, 'A'); mel.connect_material_expressions(doble, '', mezcla, 'B')
    mel.connect_material_expressions(fuerza, '', mezcla, 'Alpha')
    mel.connect_material_property(mezcla, '', unreal.MaterialProperty.MP_BASE_COLOR)
    if recortado:
        mel.connect_material_property(tex, 'A', unreal.MaterialProperty.MP_OPACITY_MASK)
    else:
        nor = mel.create_material_expression(m, unreal.MaterialExpressionTextureSampleParameter2D, -900, 600)
        nor.set_editor_property('parameter_name', 'Relieve')
        nor.set_editor_property('sampler_type', unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL)
        nor.set_editor_property('texture', eal.load_asset('/Engine/EngineMaterials/FlatNormal'))
        mel.connect_material_property(nor, 'RGB', unreal.MaterialProperty.MP_NORMAL)
    rug = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -400, 650)
    rug.set_editor_property('r', 0.7 if recortado else 0.6)
    mel.connect_material_property(rug, '', unreal.MaterialProperty.MP_ROUGHNESS)
    mel.recompile_material(m)
    eal.save_loaded_asset(m)
    return m


recorte = material('M_NinoRecorte', True)
base = material('M_NinoBase', False)
CLAVES_RECORTE = ('eyebrow', 'eyelash', 'short', 'bob', 'ponytail', 'long', 'braid', 'afro')
for n in NINOS:
    malla = eal.load_asset(f'/Game/Ninos/{n}/{n}')
    mats = list(malla.get_editor_property('materials'))
    texturas = [r for r in eal.list_assets(f'/Game/Ninos/{n}', recursive=False) if isinstance(eal.load_asset(r), unreal.Texture2D)]
    # MakeHuman trae texturas de 4096 px: en la consulta un niño ocupa poco; 1024 px ahorran memoria en el móvil
    for r in texturas:
        t = eal.load_asset(r)
        t.set_editor_property('max_texture_size', 1024)
        eal.save_loaded_asset(t)
    cambiadas = 0
    for i, sm in enumerate(mats):
        ranura = str(sm.get_editor_property('material_slot_name')).lower()
        recortada = any(k in ranura for k in CLAVES_RECORTE)
        if recortada:
            clave = next(k for k in CLAVES_RECORTE if k in ranura)
        elif 'low-poly' in ranura:
            clave = '_eye'
        elif i == 0:
            clave = 'skinned'   # la piel: young_..skinned.._diffuse
        else:
            clave = ranura.split('_')[-3] if ranura.count('_') >= 3 else ranura   # la prenda (male_casualsuit01, shoes01…)
            clave = next((p for p in ranura.split('_') if any(k in p for k in ('casualsuit', 'sportsuit', 'elegantsuit', 'worksuit', 'shoes'))), clave)
        color = next((eal.load_asset(r) for r in texturas if clave in r.split('/')[-1].lower() and 'normal' not in r.lower()), None)
        relieve = next((eal.load_asset(r) for r in texturas if clave in r.split('/')[-1].lower() and 'normal' in r.lower()), None)
        if not color:
            lineas.append(f'  {n}: sin textura para la ranura {ranura} (clave {clave})')
            continue
        mi = at.create_asset(f'MI_{n}_{i}_{clave.strip("_")}', f'/Game/Ninos/{n}', unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
        mel.set_material_instance_parent(mi, recorte if recortada else base)
        mel.set_material_instance_texture_parameter_value(mi, 'Color', color)
        if relieve and not recortada:
            mel.set_material_instance_texture_parameter_value(mi, 'Relieve', relieve)
        mel.update_material_instance(mi)   # sin esto la instancia sigue con la textura por defecto
        eal.save_loaded_asset(mi)
        sm.set_editor_property('material_interface', mi)
        mats[i] = sm
        cambiadas += 1
    malla.set_editor_property('materials', mats)
    eal.save_loaded_asset(malla)
    lineas.append(f'{n}: {cambiadas} de {len(mats)} materiales propios (piel, ojos, ropa, pelo, cejas, pestañas)')
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'Ninos.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] niños importados: {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
