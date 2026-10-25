# Peinados de EL MEJOR MÉDICO (modelos/pelo.glb). Ejecutar en Blender 5.x y exportar a glTF binario.
# Cada Pelo_N está centrado en el centro de la cabeza; el juego lo pega al hueso «cabeza».
import bpy, bmesh, math
from mathutils import Vector, noise
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
scn = bpy.context.scene
V = Vector
mat = bpy.data.materials.get('Pelo') or bpy.data.materials.new('Pelo')
mat.use_nodes = True
b = mat.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value = (0.12, 0.08, 0.05, 1); b.inputs['Roughness'].default_value = 0.55

def craneo(x, y, z):
    # misma forma que la cabeza del personaje, centro en el origen (delante = -y)
    x *= 0.86; z *= 1.12
    if y > 0: y *= 1.06; z += 0.006 * (y / 0.1)
    if z < 0:
        k = min(1.0, -z / 0.11); x *= 1 - k * 0.24
    return V((x, y, z))

def curva(claves):
    # altura mínima del pelo según el ángulo alrededor de la cabeza: 0 = nuca, 90 = oreja, 180 = frente
    def lim(d):
        a = math.degrees(math.atan2(abs(d.x), d.y))
        for (a0, l0), (a1, l1) in zip(claves, claves[1:]):
            if a <= a1:
                t = (a - a0) / (a1 - a0); t = t * t * (3 - 2 * t)
                return l0 + (l1 - l0) * t
        return claves[-1][1]
    return lim

def hacer(nombre, grosor, lim, tope=2.0, extra=None, vetas=1.0):
    bm = bmesh.new()
    res = bmesh.ops.create_uvsphere(bm, u_segments=112, v_segments=84, radius=0.1)
    bm.verts.index_update()
    dirs = {v.index: v.co.normalized() for v in res['verts']}
    dentro = {i: lim(d) <= d.z <= tope for i, d in dirs.items()}
    quedan = [f for f in bm.faces if any(dentro[v.index] for v in f.verts)]
    borde = set()
    for f in quedan:
        for v in f.verts:
            if not dentro[v.index]:
                borde.add(v.index)
    for v in res['verts']:
        d = dirs[v.index]
        if v.index in borde:
            # el vértice de fuera se lleva a la línea del pelo por su meridiano: borde suave, sin escalones
            z = min(max(d.z, lim(d)), tope); z = max(-0.999, min(0.999, z))
            r = math.hypot(d.x, d.y) or 1e-6; s = math.sqrt(1 - z * z) / r
            d = V((d.x * s, d.y * s, z))
        p = craneo(*(d * 0.1))
        ang = math.atan2(d.x, -d.y)
        veta = (math.sin(ang * 64 + noise.noise(V((d.x * 6, d.y * 6, d.z * 2))) * 4) * 0.0009 + noise.noise(d * 30) * 0.0005) * vetas
        n = (p - V((0, 0, 0.01))).normalized()
        g = grosor(d) + veta
        if v.index in borde: g *= 0.3
        v.co = p + n * g
        if extra: v.co = extra(v.co, d)
    quitar = [f for f in bm.faces if not any(dentro[v.index] for v in f.verts)]
    bmesh.ops.delete(bm, geom=quitar, context='FACES')
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.0003)
    # suavizar el contorno a lo largo del propio borde (quita los escalones de la rejilla)
    bnd = [v for v in bm.verts if v.is_boundary]
    for _ in range(6):
        nuevos = {}
        for v in bnd:
            vec = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(vec) == 2: nuevos[v] = v.co * 0.5 + (vec[0].co + vec[1].co) * 0.25
        for v, c in nuevos.items(): v.co = c
    me = bpy.data.meshes.new(nombre); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(nombre, me); scn.collection.objects.link(ob)
    sol = ob.modifiers.new('grosor', 'SOLIDIFY'); sol.thickness = 0.004; sol.offset = -1
    me.materials.append(mat)
    for p in me.polygons: p.use_smooth = True
    return ob

CORTO = [(0, -0.6), (45, -0.5), (68, 0.05), (78, 0.3), (98, 0.3), (106, 0.08), (120, 0.14), (138, 0.34), (158, 0.43), (180, 0.48)]
RECOGIDO = [(0, -0.55), (45, -0.45), (68, 0.05), (78, 0.28), (98, 0.28), (108, 0.12), (122, 0.16), (138, 0.34), (158, 0.42), (180, 0.47)]
LARGO = [(0, -0.95), (100, -0.95), (114, -0.1), (126, 0.22), (150, 0.4), (180, 0.47)]

objs = []
# 0 calvo: corona de pelo a los lados y detrás
objs.append(hacer('Pelo_0', lambda d: 0.0045, curva([(0, -0.55), (60, -0.3), (78, 0.1), (100, 0.1), (112, 0.3), (124, 1.0)]), tope=0.36, vetas=0.6))
# 1 corto
objs.append(hacer('Pelo_1', lambda d: 0.008 + max(0, d.z) * 0.013, curva(CORTO)))
# 2 rapado
objs.append(hacer('Pelo_2', lambda d: 0.0045, curva(CORTO), vetas=0.3))
# 3 con flequillo: el pelo de delante cae sobre la frente
def flequillo(p, d):
    if d.y < -0.3 and d.z > 0.3:
        cae = (1 - (d.z - 0.3) / 0.7) * max(0, -d.y - 0.3) * 0.045
        return V((p.x + d.x * 0.006, p.y - cae * 0.35, p.z - cae * 0.5))
    return p
objs.append(hacer('Pelo_3', lambda d: 0.01 + max(0, d.z) * 0.013, curva(CORTO[:-2] + [(158, 0.48), (180, 0.52)]), extra=flequillo))
# 4 media melena y 5 melena larga: el pelo cae desde los lados y la nuca
def melena(largo, vuelo):
    def f(p, d):
        if d.z < 0.35 and d.y > -0.6:
            t = (0.35 - d.z) / 1.35
            fuera = V((d.x, max(d.y, 0) * 0.8, 0))
            fuera = fuera.normalized() if fuera.length > 1e-3 else V((0, 1, 0))
            return V((p.x + fuera.x * vuelo * t, p.y + fuera.y * vuelo * t, p.z - largo * t))
        return p
    return f
objs.append(hacer('Pelo_4', lambda d: 0.014 + max(0, d.z) * 0.01, curva(LARGO), extra=melena(0.07, 0.022)))
objs.append(hacer('Pelo_5', lambda d: 0.014 + max(0, d.z) * 0.01, curva(LARGO), extra=melena(0.25, 0.035)))
# 6 moño
objs.append(hacer('Pelo_6', lambda d: 0.007 + max(0, d.z) * 0.008, curva(RECOGIDO)))
bm = bmesh.new(); res = bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=28, radius=0.038)
for v in res['verts']:
    d = v.co.normalized(); a = math.atan2(d.y, d.x)
    v.co = v.co * (1 + 0.07 * math.sin(a * 5 + d.z * 7)); v.co.z *= 0.78; v.co += V((0, 0.093, 0.078))
me = bpy.data.meshes.new('Pelo_6_mono'); bm.to_mesh(me); bm.free(); me.materials.append(mat)
for p in me.polygons: p.use_smooth = True
ob = bpy.data.objects.new('Pelo_6_mono', me); scn.collection.objects.link(ob); ob.parent = objs[-1]
# 7 coleta: tubo con volumen y mechones, sujeto con una goma
objs.append(hacer('Pelo_7', lambda d: 0.007 + max(0, d.z) * 0.008, curva(RECOGIDO)))
bm = bmesh.new()
eje = [(0.0, 0.098, 0.035, 0.024), (0.0, 0.118, 0.022, 0.02), (0.0, 0.132, 0.0, 0.026), (0.0, 0.142, -0.04, 0.031), (0.0, 0.145, -0.09, 0.03), (0.0, 0.14, -0.14, 0.025), (0.0, 0.13, -0.19, 0.017), (0.0, 0.118, -0.235, 0.004)]
seg = 28; anillos = []
for i, (x, y, z, r) in enumerate(eje):
    anillo = []
    for k in range(seg):
        a = k / seg * 2 * math.pi
        rr = r * (1 + 0.1 * math.sin(a * 9 + i * 0.7))
        anillo.append(bm.verts.new(V((x + math.cos(a) * rr, y + math.sin(a) * rr * 0.8, z))))
    anillos.append(anillo)
for a_, b_ in zip(anillos, anillos[1:]):
    for k in range(seg): bm.faces.new((a_[k], a_[(k + 1) % seg], b_[(k + 1) % seg], b_[k]))
me = bpy.data.meshes.new('Pelo_7_coleta'); bm.to_mesh(me); bm.free(); me.materials.append(mat)
for p in me.polygons: p.use_smooth = True
ob = bpy.data.objects.new('Pelo_7_coleta', me); scn.collection.objects.link(ob); ob.parent = objs[-1]
ob.modifiers.new('suave', 'SUBSURF').levels = 1
for i, o in enumerate(objs): o.location.x = (i - 3.5) * 0.3
# cabezas de referencia para revisar (no se usan en el juego)
bm = bmesh.new(); res = bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=32, radius=0.1)
for v in res['verts']: v.co = craneo(*v.co)
me = bpy.data.meshes.new('Ref_cabeza'); bm.to_mesh(me); bm.free()
piel = bpy.data.materials.new('RefPiel'); piel.use_nodes = True; piel.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.85, 0.62, 0.48, 1)
me.materials.append(piel)
for p in me.polygons: p.use_smooth = True
for i in range(8):
    o = bpy.data.objects.new(f'Ref_cabeza_{i}', me); scn.collection.objects.link(o); o.location.x = (i - 3.5) * 0.3
cam = bpy.data.objects.new('Camara', bpy.data.cameras.new('Camara')); scn.collection.objects.link(cam)
cam.location = (0, -2.45, 0.0); cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = 50; scn.camera = cam
for nom, loc, en in (('Clave', (1.5, -2, 1.5), 300), ('Relleno', (-2, -1.5, 0.5), 150), ('Contra', (0, 2, 1.5), 200)):
    l = bpy.data.objects.new(nom, bpy.data.lights.new(nom, 'POINT')); l.data.energy = en; l.location = loc; scn.collection.objects.link(l)
result = {o.name: len(o.data.polygons) for o in scn.objects if o.type == 'MESH' and o.name.startswith('Pelo')}
