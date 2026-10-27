# EL MEJOR MÉDICO (Unreal 5.8): monta la consulta del Hospital San Marcos.
# Importa los muebles y materiales CC0 de Poly Haven (Fuentes/PolyHaven), crea los materiales PBR,
# construye la habitación con luz y cámara y guarda /Game/Mapas/Consulta.
# Uso (con el editor cerrado):
#   set EMM_CERRAR=1 && UnrealEditor.exe ElMejorMedicoUE.uproject -ExecutePythonScript=Herramientas/crear_consulta.py
import os
import unreal

PROYECTO = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
FUENTES = os.path.join(PROYECTO, 'Fuentes', 'PolyHaven')
herr = unreal.AssetToolsHelpers.get_asset_tools()
mel = unreal.MaterialEditingLibrary
eal = unreal.EditorAssetLibrary
actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)


def log(t):
    unreal.log_warning('[EMM] ' + t)


def importar(archivo, destino):
    t = unreal.AssetImportTask()
    t.filename = archivo
    t.destination_path = destino
    t.automated = True
    t.save = True
    t.replace_existing = True
    herr.import_asset_tasks([t])
    return [eal.load_asset(p) for p in t.imported_object_paths]


# ───────────────────────── Materiales de superficies (suelo, paredes, techo) ─────────────────────────
def material_base():
    # coordenadas según la posición en el mundo (metros × Escala): la textura mantiene su tamaño real
    # en paredes grandes o pequeñas, sin estirarse. Funciona igual en PC y en el móvil.
    ruta = '/Game/Materiales/M_Superficie3'
    if eal.does_asset_exist(ruta):
        return eal.load_asset(ruta)
    # texturas por defecto del tipo correcto: si no, el material no compila y Unreal pone el de cuadros
    defecto = {'Color': textura('terrazzo_tiles', 'Diffuse'), 'Normal': textura('terrazzo_tiles', 'nor_gl', normal=True), 'Rugosidad': textura('terrazzo_tiles', 'Rough', lineal=True)}
    m = herr.create_asset('M_Superficie3', '/Game/Materiales', unreal.Material, unreal.MaterialFactoryNew())
    uso = mel.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -500, -400)
    uso.set_editor_property('parameter_name', 'UsoColorTextura')
    uso.set_editor_property('default_value', 1.0)
    pos = mel.create_material_expression(m, unreal.MaterialExpressionWorldPosition, -1200, 0)
    nor = mel.create_material_expression(m, unreal.MaterialExpressionVertexNormalWS, -1200, 120)
    escala = mel.create_material_expression(m, unreal.MaterialExpressionScalarParameter, -1200, 240)
    escala.set_editor_property('parameter_name', 'Escala')
    escala.set_editor_property('default_value', 1.0)
    mult = mel.create_material_expression(m, unreal.MaterialExpressionCustom, -800, 50)
    mult.set_editor_property('code', 'float3 n = abs(N); float3 p = P * S / 100.0;\nreturn n.z > 0.5 ? p.xy : (n.x > 0.5 ? p.yz : p.xz);')
    mult.set_editor_property('output_type', unreal.CustomMaterialOutputType.CMOT_FLOAT2)
    entradas = []
    for nombre in ('P', 'N', 'S'):
        e = unreal.CustomInput()
        e.set_editor_property('input_name', nombre)
        entradas.append(e)
    mult.set_editor_property('inputs', entradas)
    mel.connect_material_expressions(pos, '', mult, 'P')
    mel.connect_material_expressions(nor, '', mult, 'N')
    mel.connect_material_expressions(escala, '', mult, 'S')
    tinte = mel.create_material_expression(m, unreal.MaterialExpressionVectorParameter, -500, -250)
    tinte.set_editor_property('parameter_name', 'Tinte')
    tinte.set_editor_property('default_value', unreal.LinearColor(1, 1, 1, 1))
    for i, (nombre, tipo, prop) in enumerate([('Color', unreal.MaterialSamplerType.SAMPLERTYPE_COLOR, None),
                                              ('Normal', unreal.MaterialSamplerType.SAMPLERTYPE_NORMAL, unreal.MaterialProperty.MP_NORMAL),
                                              ('Rugosidad', unreal.MaterialSamplerType.SAMPLERTYPE_LINEAR_GRAYSCALE, unreal.MaterialProperty.MP_ROUGHNESS)]):
        s = mel.create_material_expression(m, unreal.MaterialExpressionTextureSampleParameter2D, -450, i * 250)
        s.set_editor_property('parameter_name', nombre)
        s.set_editor_property('sampler_type', tipo)
        s.set_editor_property('texture', defecto[nombre])
        mel.connect_material_expressions(mult, '', s, 'UVs')
        if prop is None:
            por = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -200, -100)
            mel.connect_material_expressions(s, 'RGB', por, 'A')
            mel.connect_material_expressions(tinte, '', por, 'B')
            # pintura lisa (paredes): el color sale del tinte; la textura sólo da relieve y brillo
            mezcla = mel.create_material_expression(m, unreal.MaterialExpressionLinearInterpolate, -50, -150)
            mel.connect_material_expressions(tinte, '', mezcla, 'A')
            mel.connect_material_expressions(por, '', mezcla, 'B')
            mel.connect_material_expressions(uso, '', mezcla, 'Alpha')
            mel.connect_material_property(mezcla, '', unreal.MaterialProperty.MP_BASE_COLOR)
        else:
            mel.connect_material_property(s, 'R' if nombre == 'Rugosidad' else 'RGB', prop)
    mel.recompile_material(m)
    eal.save_loaded_asset(m)
    return m


def textura(id_, mapa, normal=False, lineal=False):
    for ext in ('jpg', 'png'):
        f = os.path.join(FUENTES, id_, f'{id_}_{mapa}.{ext}')
        if os.path.exists(f):
            tex = importar(f, f'/Game/PolyHaven/{id_}')[0]
            if normal:
                tex.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_NORMALMAP)
                tex.set_editor_property('srgb', False)
            elif lineal:
                # en escala de grises: si no coincide con el tipo del material, Unreal pone su textura de cuadros
                tex.set_editor_property('compression_settings', unreal.TextureCompressionSettings.TC_GRAYSCALE)
                tex.set_editor_property('srgb', False)
            eal.save_loaded_asset(tex)
            return tex
    return None


def instancia(nombre, id_, escala, tinte=(1, 1, 1), uso_color=1.0):
    base = material_base()
    ruta = f'/Game/Materiales/{nombre}'
    mi = eal.load_asset(ruta) if eal.does_asset_exist(ruta) else herr.create_asset(nombre, '/Game/Materiales', unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
    mi.set_editor_property('parent', base)
    c, n, r = textura(id_, 'Diffuse'), textura(id_, 'nor_gl', normal=True), textura(id_, 'Rough', lineal=True)
    if c: mel.set_material_instance_texture_parameter_value(mi, 'Color', c)
    if n: mel.set_material_instance_texture_parameter_value(mi, 'Normal', n)
    if r: mel.set_material_instance_texture_parameter_value(mi, 'Rugosidad', r)
    mel.set_material_instance_scalar_parameter_value(mi, 'Escala', escala)
    mel.set_material_instance_scalar_parameter_value(mi, 'UsoColorTextura', uso_color)
    mel.set_material_instance_vector_parameter_value(mi, 'Tinte', unreal.LinearColor(tinte[0], tinte[1], tinte[2], 1))
    eal.save_loaded_asset(mi)
    return mi


def material_exterior():
    # lo que se ve por la ventana: luz de día difusa (sin luz propia: la da «Luz ventana»)
    ruta = '/Game/Materiales/M_Exterior'
    if eal.does_asset_exist(ruta):
        return eal.load_asset(ruta)
    m = herr.create_asset('M_Exterior', '/Game/Materiales', unreal.Material, unreal.MaterialFactoryNew())
    m.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_UNLIT)
    m.set_editor_property('two_sided', True)
    c = mel.create_material_expression(m, unreal.MaterialExpressionConstant3Vector, -400, 0)
    c.set_editor_property('constant', unreal.LinearColor(0.85, 0.92, 1.0, 1))
    k = mel.create_material_expression(m, unreal.MaterialExpressionConstant, -400, 150)
    k.set_editor_property('r', 3.0)
    x = mel.create_material_expression(m, unreal.MaterialExpressionMultiply, -200, 50)
    mel.connect_material_expressions(c, '', x, 'A')
    mel.connect_material_expressions(k, '', x, 'B')
    mel.connect_material_property(x, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    mel.recompile_material(m)
    eal.save_loaded_asset(m)
    return m


# ───────────────────────── Muebles ─────────────────────────
def mueble(id_):
    # versión preparada en Blender (unir_muebles_blender.py): una sola pieza con el origen en la base
    archivo = os.path.join(os.path.dirname(FUENTES), 'Muebles', f'{id_}.glb')
    if not os.path.exists(archivo):
        log(f'falta {archivo}')
        return None
    objetos = importar(archivo, f'/Game/Muebles/{id_}')
    mallas = [o for o in objetos if isinstance(o, unreal.StaticMesh)]
    if not mallas:
        # Interchange puede guardar las mallas en una subcarpeta
        for ruta in eal.list_assets(f'/Game/Muebles/{id_}', recursive=True):
            a = eal.load_asset(ruta)
            if isinstance(a, unreal.StaticMesh):
                mallas.append(a)
    if not mallas:
        log(f'sin malla: {id_}')
    # texturas de los muebles a 1K como máximo: la RTX 3050 del portátil tiene 4 GB y el móvil, menos aún para el juego
    for ruta in eal.list_assets(f'/Game/Muebles/{id_}', recursive=True):
        a = eal.load_asset(ruta)
        if isinstance(a, unreal.Texture2D) and a.get_editor_property('max_texture_size') != 1024:
            a.set_editor_property('max_texture_size', 1024)
            eal.save_loaded_asset(a)
    return mallas


def colocar(mallas, x, y, z_suelo=0.0, giro=0.0, escala=1.0, etiqueta=None):
    """Pone todas las mallas del mueble con su base sobre el suelo, centradas en (x, y)."""
    if not mallas:
        return []
    puestos = []
    for m in mallas:
        a = actores.spawn_actor_from_object(m, unreal.Vector(x, y, z_suelo), unreal.Rotator(0, 0, giro))
        a.set_actor_scale3d(unreal.Vector(escala, escala, escala))
        puestos.append(a)
    # base en el suelo: corrige con la caja de todas las piezas
    origen, extension = puestos[0].get_actor_bounds(False)
    minz = min(p.get_actor_bounds(False)[0].z - p.get_actor_bounds(False)[1].z for p in puestos)
    for p in puestos:
        l = p.get_actor_location()
        p.set_actor_location(unreal.Vector(l.x, l.y, l.z + (z_suelo - minz)), False, False)
        if etiqueta:
            p.set_actor_label(etiqueta)
        p.set_folder_path('Consulta/Muebles')
    return puestos


def caja(nombre, centro, tam, material):
    """Pared, suelo o techo: el cubo básico mide 100 cm."""
    cubo = eal.load_asset('/Engine/BasicShapes/Cube')
    a = actores.spawn_actor_from_object(cubo, unreal.Vector(*centro))
    a.set_actor_scale3d(unreal.Vector(tam[0] / 100, tam[1] / 100, tam[2] / 100))
    a.static_mesh_component.set_material(0, material)
    a.set_actor_label(nombre)
    a.set_folder_path('Consulta/Habitacion')
    return a


def luz(clase, nombre, pos, rot=(0, 0, 0)):
    # ojo: unreal.Rotator en Python es (roll, pitch, yaw)
    a = actores.spawn_actor_from_class(clase, unreal.Vector(*pos), unreal.Rotator(*rot))
    a.set_actor_label(nombre)
    a.set_folder_path('Consulta/Luces')
    return a


# ───────────────────────── Montaje ─────────────────────────
log('Creando el nivel /Game/Mapas/Consulta')
if eal.does_asset_exist('/Game/Mapas/Consulta'):
    log(f'cargar: {niveles.load_level("/Game/Mapas/Consulta")}')
    # se rehace desde cero: fuera todo lo anterior
    for _a in actores.get_all_level_actors():
        if not isinstance(_a, unreal.WorldSettings):
            actores.destroy_actor(_a)
else:
    log(f'nuevo: {niveles.new_level("/Game/Mapas/Consulta")}')

M_SUELO = instancia('MI_Suelo_Terrazo', 'terrazzo_tiles', 0.6)
M_PARED = instancia('MI_Pared_Pintura', 'plastered_wall_04', 0.5, (0.78, 0.76, 0.70), uso_color=0.0)
M_ZOCALO = instancia('MI_Zocalo', 'plastered_wall_04', 0.5, (0.22, 0.38, 0.46), uso_color=0.0)
M_TECHO = instancia('MI_Techo', 'ceiling_interior', 0.8)

# habitación de 5 m × 4,4 m y 2,8 m de alto; el médico mira hacia +X
L, A, H, G = 500.0, 440.0, 280.0, 12.0
caja('Suelo', (0, 0, -G / 2), (L + 2 * G, A + 2 * G, G), M_SUELO)
caja('Techo', (0, 0, H + G / 2), (L + 2 * G, A + 2 * G, G), M_TECHO)
caja('Pared fondo', (L / 2 + G / 2, 0, H / 2), (G, A + 2 * G, H), M_PARED)
caja('Pared puerta', (-L / 2 - G / 2, 0, H / 2), (G, A + 2 * G, H), M_PARED)
caja('Pared izquierda', (0, -A / 2 - G / 2, H / 2), (L, G, H), M_PARED)
# pared derecha con ventana (hueco de 180 × 130 cm a 95 cm del suelo)
caja('Pared derecha baja', (0, A / 2 + G / 2, 95 / 2), (L, G, 95), M_PARED)
caja('Pared derecha alta', (0, A / 2 + G / 2, (225 + H) / 2), (L, G, H - 225), M_PARED)
caja('Pared derecha A', (-(L + 180) / 4 - 0, A / 2 + G / 2, 160), (L / 2 - 90, G, 130), M_PARED)
caja('Pared derecha B', ((L + 180) / 4, A / 2 + G / 2, 160), (L / 2 - 90, G, 130), M_PARED)
# zócalo de protección, típico de los hospitales
for nombre, c, t in [('Zocalo fondo', (L / 2 - 1, 0, 45), (2, A, 90)), ('Zocalo izquierda', (0, -A / 2 + 1, 45), (L, 2, 90)),
                     ('Zocalo puerta', (-L / 2 + 1, 0, 45), (2, A, 90))]:
    caja(nombre, c, t, M_ZOCALO)

# muebles: mesa entre médico y paciente
mesa = colocar(mueble('metal_office_desk'), 40, 0, giro=90, etiqueta='Mesa')
colocar(mueble('dining_chair_02'), -50, 0, giro=-90, etiqueta='Silla medico')
colocar(mueble('SchoolChair_01'), 128, -15, giro=90, etiqueta='Silla paciente')
colocar(mueble('SchoolChair_01'), 165, 95, giro=110, etiqueta='Silla acompanante')
colocar(mueble('drawer_cabinet'), -200, -185, giro=0, etiqueta='Cajonera')

colocar(mueble('potted_plant_01'), 225, 185, etiqueta='Planta')
colocar(mueble('potted_plant_02'), -220, 180, etiqueta='Planta 2')

# objetos sobre la mesa (a la altura de su tablero)
alto_mesa = 75.0
if mesa:
    o, e = mesa[0].get_actor_bounds(False)
    alto_mesa = o.z + e.z
# portátil pequeño en la esquina del médico, girado hacia él (no tapa al paciente)
colocar(mueble('classic_laptop'), 12, -68, z_suelo=alto_mesa, giro=235, escala=0.6, etiqueta='Portatil')
colocar(mueble('clipboard'), 35, -40, z_suelo=alto_mesa, giro=80, etiqueta='Carpeta')
colocar(mueble('office_notepads'), 30, 18, z_suelo=alto_mesa, giro=10, escala=0.8, etiqueta='Libretas')

reloj = colocar(mueble('wall_clock'), L / 2 - 5, 0, z_suelo=200, giro=-90, etiqueta='Reloj')
colocar(mueble('modern_ceiling_lamp_01'), 40, 0, z_suelo=H - 60, etiqueta='Lampara techo')

# ───────────────────────── Luz ─────────────────────────
# paneles del techo (luz fría de hospital) y luz de día por la ventana
for i, (x, y) in enumerate([(-120, -90), (-120, 90), (150, -90), (150, 90)]):
    p = luz(unreal.RectLight, f'Panel techo {i + 1}', (x, y, H - 3), (0, -90, 0))
    c = p.rect_light_component
    c.set_editor_property('intensity_units', unreal.LightUnits.CANDELAS)
    c.set_intensity(90.0)
    c.set_editor_property('source_width', 60.0)
    c.set_editor_property('source_height', 60.0)
    c.set_editor_property('use_temperature', True)
    c.set_editor_property('temperature', 4300.0)
    c.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
ventana = luz(unreal.RectLight, 'Luz ventana', (0, A / 2 - 5, 160), (0, 0, -90))
cv = ventana.rect_light_component
cv.set_editor_property('intensity_units', unreal.LightUnits.CANDELAS)
cv.set_intensity(350.0)
cv.set_editor_property('source_width', 180.0)
cv.set_editor_property('source_height', 130.0)
cv.set_editor_property('use_temperature', True)
cv.set_editor_property('temperature', 6200.0)
cv.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
cielo = luz(unreal.SkyLight, 'Luz ambiente', (0, 0, 200))
cielo.light_component.set_intensity(0.6)
cielo.light_component.set_editor_property('mobility', unreal.ComponentMobility.MOVABLE)
cielo.light_component.set_editor_property('real_time_capture', False)
# exterior luminoso tras la ventana
fuera = eal.load_asset('/Engine/BasicShapes/Plane')
pf = actores.spawn_actor_from_object(fuera, unreal.Vector(0, A / 2 + 80, 160), unreal.Rotator(90, 0, 0))
pf.set_actor_scale3d(unreal.Vector(4, 3, 1))
pf.set_actor_label('Exterior ventana')
pf.static_mesh_component.set_material(0, material_exterior())
pf.set_folder_path('Consulta/Habitacion')

pp = actores.spawn_actor_from_class(unreal.PostProcessVolume, unreal.Vector(0, 0, 100))
pp.set_editor_property('unbound', True)
ajustes = pp.get_editor_property('settings')
ajustes.set_editor_property('override_auto_exposure_min_brightness', True)
ajustes.set_editor_property('auto_exposure_min_brightness', 8.0)
ajustes.set_editor_property('override_auto_exposure_max_brightness', True)
ajustes.set_editor_property('auto_exposure_max_brightness', 8.0)
ajustes.set_editor_property('override_auto_exposure_bias', True)
ajustes.set_editor_property('auto_exposure_bias', -2.5)
ajustes.set_editor_property('override_bloom_intensity', True)
ajustes.set_editor_property('bloom_intensity', 0.25)
ajustes.set_editor_property('override_vignette_intensity', True)
ajustes.set_editor_property('vignette_intensity', 0.25)
pp.set_editor_property('settings', ajustes)
pp.set_actor_label('Postproceso')

# ───────────────────────── Personajes (de momento, marcadores) y cámara ─────────────────────────
cil = eal.load_asset('/Engine/BasicShapes/Cylinder')
med = actores.spawn_actor_from_object(cil, unreal.Vector(-40, 0, 90))
med.set_actor_scale3d(unreal.Vector(0.45, 0.45, 1.75))
med.tags = [unreal.Name('Medico')]
med.set_actor_label('Medico (marcador)')
pac = actores.spawn_actor_from_object(cil, unreal.Vector(123, -20, 85))
pac.set_actor_scale3d(unreal.Vector(0.45, 0.45, 1.65))
pac.tags = [unreal.Name('Paciente'), unreal.Name('Mujer')]
pac.set_actor_label('Paciente (marcador)')
for a in (med, pac):
    a.set_folder_path('Consulta/Personajes')

# MetaHumans ya construidos (crear_metahumans.py): sustituyen a los marcadores
for _nombre, _marcador, _etq in (('MH_Medico', med, ['Medico']), ('MH_Paciente', pac, ['Paciente', 'Mujer'])):
    _ruta = f'/Game/MetaHumans/Personajes/Unpacked/{_nombre}/BP_{_nombre}'
    if eal.does_asset_exist(_ruta):
        _p = _marcador.get_actor_location()
        _a = actores.spawn_actor_from_class(eal.load_blueprint_class(_ruta), unreal.Vector(_p.x, _p.y, 0))
        _a.tags = [unreal.Name(e) for e in _etq]
        _a.set_actor_label(_nombre)
        _a.set_folder_path('Consulta/Personajes')
        actores.destroy_actor(_marcador)
        log(f'{_nombre} colocado')

# de lado, a la altura de los ojos: se ven el médico y el paciente, uno frente al otro
# desde la ventana: el médico a la izquierda, el paciente a la derecha y la luz de día a la espalda de la cámara
cam = actores.spawn_actor_from_class(unreal.CineCameraActor, unreal.Vector(35, 200, 135), unreal.Rotator(0, -6, -90))
cam.tags = [unreal.Name('CamaraConsulta')]
cam.set_actor_label('Camara consulta')
cc = cam.get_cine_camera_component()
cc.set_editor_property('current_focal_length', 28.0)
fs = cc.get_editor_property('focus_settings')
fs.set_editor_property('focus_method', unreal.CameraFocusMethod.DISABLE)
cc.set_editor_property('focus_settings', fs)

# cámara de vista general (sólo para revisar el montaje en la prueba automática)
plano = actores.spawn_actor_from_class(unreal.CineCameraActor, unreal.Vector(-235, 205, 265), unreal.Rotator(0, -32, -38))
plano.tags = [unreal.Name('Revision'), unreal.Name('plano')]
# vista cenital ortográfica: la distribución real de la habitación, a escala
# justo bajo el techo: la cámara ortográfica no ve lo que tiene detrás
cenit = actores.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(0, 0, 276), unreal.Rotator(0, -90, 0))
cenit.tags = [unreal.Name('Revision'), unreal.Name('cenital')]
cenit.set_actor_label('Camara cenital')
cc2 = cenit.camera_component
cc2.set_editor_property('projection_mode', unreal.CameraProjectionMode.ORTHOGRAPHIC)
cc2.set_editor_property('ortho_width', 700.0)
cc2.set_editor_property('constrain_aspect_ratio', False)

plano.set_actor_label('Camara plano')
plano.get_cine_camera_component().set_editor_property('current_focal_length', 14.0)

ok = niveles.save_current_level()
log(f'Consulta guardada en /Game/Mapas/Consulta: {ok}, {len(actores.get_all_level_actors())} actores')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
