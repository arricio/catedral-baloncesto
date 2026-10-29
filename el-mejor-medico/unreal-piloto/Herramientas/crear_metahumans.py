# EL MEJOR MÉDICO (Unreal): crea el médico y la paciente a partir de presets de MetaHuman, pide su rig facial y sus
# texturas al servicio gratuito de Epic (con la sesión de Epic iniciada en el editor), los construye en calidad
# «optimizada media» (sirve para el portátil y el Xiaomi) y los coloca en la consulta en lugar de los marcadores.
# Todo con llamadas bloqueantes y en orden: esperar con ciclos de refresco choca con la vista previa de MetaHuman.
# Fases (EMM_FASE): «preparar» (rig y texturas) y «construir» (montaje y colocación), cada una en una ejecución.
# Uso: set EMM_TAREA=crear_metahumans.py && set EMM_FASE=preparar && set EMM_CERRAR=1 && UnrealEditor.exe ElMejorMedicoUE.uproject
import os
import unreal

eal = unreal.EditorAssetLibrary
mh = unreal.get_editor_subsystem(unreal.MetaHumanCharacterEditorSubsystem)
actores = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
niveles = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
CARPETA = '/Game/MetaHumans/Personajes'
PRESETS = '/MetaHumanCharacter/Optional/Presets'
# nombre: (preset, etiquetas en el nivel). Los dos primeros están en la consulta; el resto son pacientes que el
# juego pone en la silla según el caso (Content/Datos/personajes.json), cada uno de su sexo y edad.
PERSONAJES = {
    'MH_Medico': ('Lorenzo', ['Medico']),
    'MH_Paciente': ('Vivian', ['Paciente', 'Mujer']),
    'MH_P_Mateo': ('Mateo', []),        # chico joven
    'MH_P_Celeste': ('Celeste', []),    # chica joven
    'MH_P_Victor': ('Victor', []),      # hombre joven
    'MH_P_Bruce': ('Bruce', []),        # hombre de mediana edad
    'MH_P_Lani': ('Lani', []),          # mujer de mediana edad
    'MH_P_Walter': ('Walter', []),      # anciano
    'MH_P_Grace': ('Grace', []),        # anciana
}
# EMM_SOLO=MH_P_Mateo,MH_P_Grace…: sólo esos (para no rehacer los que ya están construidos)
SOLO = [x for x in os.environ.get('EMM_SOLO', '').split(',') if x]
if SOLO:
    PERSONAJES = {k: v for k, v in PERSONAJES.items() if k in SOLO}
FASE = os.environ.get('EMM_FASE', 'preparar')


def log(t):
    unreal.log_warning('[EMM] ' + t)


def personaje(nombre, preset):
    ruta = f'{CARPETA}/{nombre}'
    if eal.does_asset_exist(ruta):
        if os.environ.get('EMM_REHACER') != '1':
            return eal.load_asset(ruta)
        eal.delete_asset(ruta)
    c = eal.duplicate_asset(f'{PRESETS}/{preset}', ruta)
    eal.save_loaded_asset(c)
    log(f'{nombre}: creado a partir del preset {preset}')
    return c


def preparar(nombre, c):
    mh.try_add_object_to_edit(c)
    if not mh.can_build_meta_human(c, False):
        p = unreal.MetaHumanCharacterAutoRiggingRequestParams()
        p.set_editor_property('rig_type', unreal.MetaHumanRigType.JOINTS_AND_BLEND_SHAPES)
        p.set_editor_property('blocking', True)
        p.set_editor_property('report_progress', False)
        mh.request_auto_rigging(c, p)
        log(f'{nombre}: rig hecho')
        t = unreal.MetaHumanCharacterTextureRequestParams()
        t.set_editor_property('blocking', True)
        t.set_editor_property('report_progress', False)
        mh.request_texture_sources(c, t)
        log(f'{nombre}: texturas descargadas')
    log(f'{nombre}: se puede construir = {mh.can_build_meta_human(c, True)}')
    eal.save_loaded_asset(c)
    mh.remove_object_to_edit(c)


def construir(nombre, c):
    d = f'{CARPETA}/Unpacked/{nombre}'
    if eal.does_directory_exist(d):
        # restos de una prueba anterior: si existen, Unreal pregunta si sobrescribirlos y en modo automático cancela
        eal.delete_directory(d)
        log(f'borrado el montaje anterior {d}')
    # el montaje necesita los datos del personaje cargados (abrirlo para editar)
    mh.try_add_object_to_edit(c)
    b = unreal.MetaHumanCharacterEditorBuildParameters()
    b.set_editor_property('pipeline_type', unreal.MetaHumanDefaultPipelineType.OPTIMIZED)
    b.set_editor_property('pipeline_quality', unreal.MetaHumanQualityLevel.MEDIUM)
    if not mh.can_build_meta_human(c, True):
        raise RuntimeError('no está listo para montarse')
    mh.build_meta_human(c, b)
    mh.remove_object_to_edit(c)
    log(f'{nombre}: construido')


def clase_montada(nombre):
    for ruta in eal.list_assets('/Game', recursive=True):
        if nombre in ruta and ruta.split('/')[-1].startswith('BP_'):
            return eal.load_blueprint_class(ruta.split('.')[0])
    return None


def colocar():
    niveles.load_level('/Game/Mapas/Consulta')
    for nombre, (_, etiquetas) in PERSONAJES.items():
        if not etiquetas:
            continue   # pacientes que el juego carga por código: no van en el nivel
        clase = clase_montada(nombre)
        todos = actores.get_all_level_actors()
        previo = [a for a in todos if a.get_actor_label() == nombre]
        marcador = next((a for a in todos if unreal.Name(etiquetas[0]) in a.tags), None)
        if not clase or not marcador:
            log(f'{nombre}: no se puede colocar (clase={clase}, marcador={marcador})')
            continue
        pos = marcador.get_actor_location()
        # el médico mira hacia +X (a la paciente); la paciente, hacia -X
        giro = 0.0 if 'Medico' in etiquetas else 180.0
        a = actores.spawn_actor_from_class(clase, unreal.Vector(pos.x, pos.y, 0), unreal.Rotator(0, 0, giro))
        a.tags = [unreal.Name(e) for e in etiquetas]
        a.set_actor_label(nombre)
        a.set_folder_path('Consulta/Personajes')
        for v in previo + [marcador]:
            if v != a:
                actores.destroy_actor(v)
        log(f'{nombre}: colocado en la consulta')
    log(f'nivel guardado: {niveles.save_current_level()}')


for nombre, (preset, _) in PERSONAJES.items():
    c = personaje(nombre, preset)
    try:
        if FASE == 'preparar':
            preparar(nombre, c)
        else:
            construir(nombre, c)
    except Exception as e:
        log(f'{nombre}: ha fallado: {e}')
unreal.EditorLoadingAndSavingUtils.save_dirty_packages(True, True)
if FASE == 'construir' and any(e for _, e in PERSONAJES.values()):
    colocar()
log(f'MetaHumans: fase «{FASE}» terminada')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
