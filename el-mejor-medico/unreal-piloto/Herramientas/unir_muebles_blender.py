# EL MEJOR MÉDICO (Unreal): prepara los muebles de Poly Haven en Blender antes de importarlos a Unreal.
# Une todas las piezas de cada mueble en un solo objeto (conservando su posición, materiales y texturas),
# pone el origen en el centro de la base y lo exporta a Fuentes/Muebles/<id>.glb.
# Uso: blender.exe -b -P Herramientas/unir_muebles_blender.py
import os
import bpy
from mathutils import Vector

RAIZ = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'Fuentes')
ORIGEN, DESTINO = os.path.join(RAIZ, 'PolyHaven'), os.path.join(RAIZ, 'Muebles')
os.makedirs(DESTINO, exist_ok=True)

for id_ in sorted(os.listdir(ORIGEN)):
    gltf = os.path.join(ORIGEN, id_, f'{id_}.gltf')
    if not os.path.exists(gltf):
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=gltf)
    mallas = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not mallas:
        continue
    # quita la jerarquía conservando la posición de cada pieza
    for o in mallas:
        m = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = m
    bpy.ops.object.select_all(action='DESELECT')
    for o in mallas:
        o.select_set(True)
    bpy.context.view_layer.objects.active = mallas[0]
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # origen en el centro de la base: se apoya en el suelo al colocarlo
    esquinas = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    base = Vector(((min(c.x for c in esquinas) + max(c.x for c in esquinas)) / 2, (min(c.y for c in esquinas) + max(c.y for c in esquinas)) / 2, min(c.z for c in esquinas)))
    bpy.context.scene.cursor.location = base
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    obj.location = (0, 0, 0)
    obj.name = id_
    for o in list(bpy.context.scene.objects):
        if o != obj:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(DESTINO, f'{id_}.glb'), export_format='GLB', use_selection=False)
    print(f'[EMM] {id_}: {len(mallas)} piezas unidas')
