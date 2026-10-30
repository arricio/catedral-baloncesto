# EL MEJOR MÉDICO: niños y bebés para la consulta, hechos en Blender con MPFB 2 (MakeHuman; los modelos y los
# recursos de MakeHuman usados son CC0). Se ejecuta DENTRO de Blender (MCP de Blender):
#   exec(open(r'C:\Users\arric\ElMejorMedicoUE\Herramientas\crear_ninos_mpfb.py', encoding='utf-8').read())
# Cada niño se crea en su propia escena, con el esqueleto «game_engine» (mismos nombres de huesos que los MetaHumans,
# así la animación del juego vale también para ellos) y una forma «Boca» (boca abierta) para hablar.
# Resultado: Fuentes/Ninos/<nombre>.fbx (para importarlo en Unreal) y Fuentes/Ninos/ninos.blend.
import os
import math
import bpy
import bmesh
from mathutils import Vector, Matrix
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

DATOS = r'C:\Users\arric\LA VIDA EN ORDAS 3D\descargas\mpfb\datos'   # recursos CC0 de MakeHuman (sólo se leen)
SALIDA = r'C:\Users\arric\ElMejorMedicoUE\Fuentes\Ninos'
os.makedirs(SALIDA, exist_ok=True)


def edad_mh(anios):
    # la edad de MakeHuman: 0 → 1 año, 0,1875 → 11 años, 0,5 → 25 años
    return max(0.0, min(0.1875, (anios - 1.0) / 10.0 * 0.1875)) if anios <= 11 else 0.1875 + (anios - 11) / 14 * 0.3125


# nombre: edad, sexo (1 chico, 0 chica), piel, pelo, ropa, zapatos, ojos, altura (macro de MakeHuman: los niños
# de MakeHuman salen bajos con 0,5; así quedan en la talla media: ~1,03 m a los 4 años y ~1,33 m a los 9)
NINOS = {
    'Nino_Bebe':      (1.0, 0.5, 'young_caucasian_male', None, 'male_casualsuit02', None, 'brown', 0.5),
    'Nino_Bebe_M':    (1.0, 0.5, 'young_asian_female', 'short01', 'female_casualsuit02', None, 'brownlight', 0.5),
    'Nino_Pequeno_H': (4.0, 1.0, 'young_caucasian_male', 'short02', 'male_casualsuit04', 'shoes01', 'brown', 0.76),
    'Nino_Pequena_M': (4.0, 0.0, 'young_caucasian_female', 'bob01', 'female_casualsuit02', 'shoes02', 'blue', 0.76),
    'Nino_Escolar_H': (9.0, 1.0, 'young_african_male', 'short02', 'male_casualsuit01', 'shoes01', 'brownlight', 0.6),
    'Nino_Escolar_M': (9.0, 0.0, 'young_caucasian_female2', 'ponytail01', 'female_casualsuit01', 'shoes02', 'brownlight', 0.65),
}


def mhclo(tipo, nombre):
    return os.path.join(DATOS, tipo, nombre, nombre + '.mhclo')


def simplificar_materiales(objs):
    # materiales sencillos (color + normal) que el FBX lleva bien a Unreal
    for o in objs:
        for i, m in enumerate(o.data.materials):
            if not m or not m.use_nodes:
                continue
            imgs = [n.image for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
            color = next((im for im in imgs if any(k in im.name.lower() for k in ('diffuse', 'color', '_eye', 'albedo'))), imgs[0] if imgs else None)
            normal = next((im for im in imgs if 'normal' in im.name.lower()), None)
            nuevo = bpy.data.materials.new(f'M_{o.name}_{i}')
            nuevo.use_nodes = True
            nt = nuevo.node_tree
            bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
            bsdf.inputs['Roughness'].default_value = 0.6
            if color:
                t = nt.nodes.new('ShaderNodeTexImage'); t.image = color
                nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
                if 'hair' in o.name.lower() or 'eyebrow' in o.name.lower() or 'eyelash' in o.name.lower():
                    nt.links.new(t.outputs['Alpha'], bsdf.inputs['Alpha'])
                    nuevo.blend_method = 'CLIP' if hasattr(nuevo, 'blend_method') else None
            else:
                bsdf.inputs['Base Color'].default_value = m.diffuse_color
            if normal:
                t = nt.nodes.new('ShaderNodeTexImage'); t.image = normal; t.image.colorspace_settings.name = 'Non-Color'
                nm = nt.nodes.new('ShaderNodeNormalMap')
                nt.links.new(t.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
            o.data.materials[i] = nuevo


def forma_boca(cuerpo):
    # «Boca»: la mandíbula baja girando sobre una bisagra delante de las orejas. Los labios y las orejas se sacan de
    # los grupos de vértices de MakeHuman («lips», «ears»), así vale para cualquier edad y tamaño.
    mw = cuerpo.matrix_world; inv = mw.inverted()
    vs = cuerpo.data.vertices

    def grupo(nombre):
        g = cuerpo.vertex_groups[nombre].index
        return [mw @ v.co for v in vs if any(x.group == g and x.weight > 0.5 for x in v.groups)]
    labios, orejas = grupo('lips'), grupo('ears')
    L = sum(labios, Vector()) / len(labios)
    O = sum(orejas, Vector()) / len(orejas)
    ancho_boca = max(p.x for p in labios) - min(p.x for p in labios)
    fondo = O.y - L.y                       # de los labios a las orejas (MPFB mira hacia −Y)
    pivote = Vector((L.x, O.y - 0.25 * fondo, O.z - 0.15 * fondo))
    giro = Matrix.Rotation(math.radians(8), 4, 'X')
    # hasta dónde baja la barbilla: la cara por debajo de los labios, delante de la bisagra
    barbilla = min(p.z for p in (mw @ v.co for v in vs) if p.y < L.y + 0.45 * fondo and abs(p.x - L.x) < 0.5 * ancho_boca and p.z > L.z - 0.9 * fondo)
    if not cuerpo.data.shape_keys:
        cuerpo.shape_key_add(name='Basis')
    sk = cuerpo.shape_key_add(name='Boca', from_mix=False)
    corte = L.z - 0.04 * fondo                # entre los dos labios
    for i, v in enumerate(vs):
        p = mw @ v.co
        if p.z > corte or p.y > pivote.y or abs(p.x - L.x) > 1.3 * fondo:
            continue
        # pleno en el labio inferior y la barbilla; se apaga hacia la bisagra, hacia los lados y bajo la barbilla (cuello)
        w = min(1.0, (corte - p.z) / (0.06 * fondo) + 0.3)
        w *= min(1.0, max(0.0, (pivote.y - p.y) / (0.6 * fondo)))
        w *= min(1.0, max(0.0, 1.0 - (abs(p.x - L.x) - 0.6 * ancho_boca) / (0.9 * fondo)))
        if p.z < barbilla:
            w *= max(0.0, 1.0 - (barbilla - p.z) / (0.35 * fondo))
        if w <= 0:
            continue
        q = pivote + (giro @ (p - pivote))
        sk.data[i].co = inv @ p.lerp(q, w)
    return f'labios z={L.z:.3f}, bisagra {tuple(round(x, 3) for x in pivote)}, barbilla z={barbilla:.3f}'


def sentar(rig, piezas, asiento):
    # Postura sentada como pose de reposo: muslos hacia delante, piernas colgando y manos en el regazo. Cada hueso se
    # orienta hacia una dirección del cuerpo (MPFB mira hacia −Y). Después se aplica a las mallas, se hace pose de
    # reposo y se sube o baja todo para que el asiento (la parte baja de las nalgas) quede a la altura «asiento» (m).
    F, ABAJO = Vector((0, -1, 0)), Vector((0, 0, -1))
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')

    def orientar(nombre, destino):
        bpy.context.view_layer.update()
        pb = rig.pose.bones[nombre]
        q = (pb.tail - pb.head).normalized().rotation_difference(destino.normalized())
        m = pb.matrix.copy()
        pb.matrix = Matrix.Translation(m.translation) @ q.to_matrix().to_4x4() @ Matrix.Translation(-m.translation) @ m
    g = math.radians
    for s in ('l', 'r'):
        fuera = Vector((1 if rig.pose.bones['upperarm_' + s].head.x > 0 else -1, 0, 0))
        orientar('thigh_' + s, F * math.cos(g(6)) + ABAJO * math.sin(g(6)))
        orientar('calf_' + s, ABAJO + F * 0.25)
        orientar('foot_' + s, F + ABAJO * 0.15)
        orientar('upperarm_' + s, ABAJO * math.cos(g(14)) + F * math.sin(g(14)) + fuera * 0.18)
        orientar('lowerarm_' + s, ABAJO * math.cos(g(60)) + F * math.sin(g(60)) - fuera * 0.25)
    bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')
    # la pose pasa a las mallas (sin formas: MakeHuman ya las fijó) y se vuelve a enlazar al esqueleto en reposo
    for o in piezas:
        if o.data.shape_keys:
            o.shape_key_clear()
        for m in list(o.modifiers):
            if m.type == 'ARMATURE':
                bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = rig; rig.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    # altura del asiento: lo más bajo bajo la pelvis (nalgas y arranque de los muslos), con la ropa: MakeHuman
    # borra el cuerpo que queda tapado por el pantalón
    pelvis = rig.data.bones['pelvis'].head_local
    puntos = [o.matrix_world @ v.co for o in piezas for v in o.data.vertices]
    nalgas = min(q.z for q in puntos if abs(q.y - pelvis.y) < 0.1 and q.z < pelvis.z)
    dz = asiento - nalgas
    for o in piezas:
        o.data.transform(Matrix.Translation(Vector((0, 0, dz))))
        o.data.update()
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for b in rig.data.edit_bones:
        b.head.z += dz; b.tail.z += dz
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in piezas:
        a = o.modifiers.new('Armature', 'ARMATURE'); a.object = rig
    return dz


def crear(nombre, edad, sexo, piel, pelo, ropa, zapatos, ojos, altura):
    escena = bpy.data.scenes.get(nombre) or bpy.data.scenes.new(nombre)
    for o in list(escena.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.window.scene = escena
    macro = TargetService.get_default_macro_info_dict()
    macro.update({'gender': sexo, 'age': edad_mh(edad), 'weight': 0.5, 'muscle': 0.4, 'proportions': 0.5, 'height': altura})
    cuerpo = HumanService.create_human(macro_detail_dict=macro, feet_on_ground=True, scale=0.1)
    cuerpo.name = nombre
    HumanService.set_character_skin(os.path.join(DATOS, 'skins', piel, piel + '.mhmat'), cuerpo, skin_type='MAKESKIN')
    HumanService.add_builtin_rig(cuerpo, 'game_engine')
    rig = cuerpo.parent
    rig.name = nombre + '_rig'
    HumanService.add_mhclo_asset(os.path.join(DATOS, 'eyes', 'low-poly', 'low-poly.mhclo'), cuerpo, asset_type='Eyes', subdiv_levels=0, material_type='MAKESKIN')
    HumanService.add_mhclo_asset(mhclo('eyebrows', 'eyebrow001'), cuerpo, asset_type='Eyebrows', subdiv_levels=0, material_type='MAKESKIN')
    HumanService.add_mhclo_asset(mhclo('eyelashes', 'eyelashes01'), cuerpo, asset_type='Eyelashes', subdiv_levels=0, material_type='MAKESKIN')
    if pelo:
        HumanService.add_mhclo_asset(mhclo('hair', pelo), cuerpo, asset_type='Hair', subdiv_levels=0, material_type='MAKESKIN')
    HumanService.add_mhclo_asset(mhclo('clothes', ropa), cuerpo, asset_type='Clothes', subdiv_levels=0, material_type='MAKESKIN')
    if zapatos:
        HumanService.add_mhclo_asset(mhclo('clothes', zapatos), cuerpo, asset_type='Clothes', subdiv_levels=0, material_type='MAKESKIN')
    # las formas de MakeHuman se fijan en la malla; fuera los ayudantes ocultos y la subdivisión
    TargetService.bake_targets(cuerpo)
    bpy.context.view_layer.objects.active = cuerpo
    for m in list(cuerpo.modifiers):
        if m.type == 'MASK':
            bpy.ops.object.select_all(action='DESELECT'); cuerpo.select_set(True)
            bpy.ops.object.modifier_apply(modifier=m.name)
        elif m.type == 'SUBSURF':
            cuerpo.modifiers.remove(m)
    piezas = [o for o in escena.objects if o.type == 'MESH']
    for o in piezas:
        for m in list(o.modifiers):
            if m.type == 'SUBSURF':
                o.modifiers.remove(m)
    # sentado (pose de reposo): en Unreal no necesita animación; el bebé con el asiento en 0 (va en el regazo)
    sentar(rig, piezas, 0.0 if edad <= 2 else 0.44)
    boca = forma_boca(cuerpo)
    # ojos del color elegido (el material de MakeHuman de ese color)
    for o in piezas:
        if o.name.endswith('low-poly'):
            for m in o.data.materials:
                for n in m.node_tree.nodes if m and m.use_nodes else []:
                    if n.type == 'TEX_IMAGE':
                        n.image = bpy.data.images.load(os.path.join(DATOS, 'eyes', 'materials', ojos + '_eye.png'), check_existing=True)
    simplificar_materiales(piezas)
    # el cuerpo de MakeHuman trae 7 ranuras con la misma piel: una sola (menos llamadas de dibujo en el móvil)
    for i in range(1, len(cuerpo.data.materials)):
        cuerpo.data.materials[i] = cuerpo.data.materials[0]
    # exportar el esqueleto y todas las mallas a FBX; FBX_SCALE_ALL deja el esqueleto en centímetros y sin escala en el hueso raíz (con ×100 en la raíz, la animación de Unreal desplaza la malla)
    bpy.ops.object.select_all(action='DESELECT')
    for o in [rig] + piezas:
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    ruta = os.path.join(SALIDA, nombre + '.fbx')
    bpy.ops.export_scene.fbx(filepath=ruta, use_selection=True, object_types={'ARMATURE', 'MESH'}, add_leaf_bones=False,
                             apply_scale_options='FBX_SCALE_ALL', mesh_smooth_type='FACE', use_armature_deform_only=True,
                             bake_anim=False, path_mode='COPY', embed_textures=True, axis_forward='-Z', axis_up='Y')
    return f'{nombre}: {round(max(o.dimensions.z for o in piezas), 2)} m, {len(piezas)} mallas, {len(rig.data.bones)} huesos, boca: {boca} → {ruta}'


SOLO = globals().get('EMM_SOLO')
informe = []
for nombre, datos in NINOS.items():
    if SOLO and nombre not in SOLO:
        continue
    try:
        informe.append(crear(nombre, *datos))
    except Exception as e:
        import traceback
        informe.append(f'{nombre}: ERROR {e} {traceback.format_exc()[-600:]}')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SALIDA, 'ninos.blend'), copy=True)
print('\n'.join(informe))
