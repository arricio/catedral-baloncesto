# EL MEJOR MÉDICO — personajes base modelados en Blender (Blender 5.2, ejecutado en 3D Jutsu de Higgsfield).
# Crea un hombre (H) y una mujer (M) de una sola pieza (tubos + remallado por vóxeles + suavizado),
# con esqueleto de 19 huesos, pesos automáticos y un faldón para batas. La exportación GLB
# se copia a modelos/personajes.glb; la ropa se pinta en el juego (js/escena.js, materialCuerpo).
import bpy, bmesh, math
from mathutils import Vector

for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
for mt in list(bpy.data.materials): bpy.data.materials.remove(mt)
for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
for a in list(bpy.data.armatures): bpy.data.armatures.remove(a)
scn = bpy.context.scene
V = Vector

def material(nombre, color, rough=0.6):
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    return m

def tubo(bm, pts, seg=18, tapas=True):
    """pts: lista de (punto, radio lateral, radio frontal)"""
    n = len(pts); anillos = []
    for i, (p, rx, ry) in enumerate(pts):
        p = V(p)
        t = (V(pts[min(i + 1, n - 1)][0]) - V(pts[max(i - 1, 0)][0])).normalized()
        f = V((0, -1, 0))
        if abs(t.dot(f)) > 0.85: f = V((0, 0, 1))
        lado = t.cross(f).normalized(); arriba = lado.cross(t).normalized()
        anillos.append([bm.verts.new(p + lado * math.cos(a) * rx + arriba * math.sin(a) * ry) for a in [k / seg * 2 * math.pi for k in range(seg)]])
        if i == 0: t0, lado0, arr0 = t, lado, arriba
        if i == n - 1: t1, lado1, arr1 = t, lado, arriba
    for a, b in zip(anillos, anillos[1:]):
        for k in range(seg): bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    if tapas:
        for (p, rx, ry), t, lado, arr, anillo, sg in [(pts[0], t0, lado0, arr0, anillos[0], -1), (pts[-1], t1, lado1, arr1, anillos[-1], 1)]:
            p = V(p); prev = anillo
            for j in range(1, 4):
                ang = j / 4 * math.pi / 2
                c = p + t * sg * math.sin(ang) * min(rx, ry)
                r = math.cos(ang)
                ani = [bm.verts.new(c + lado * math.cos(a) * rx * r + arr * math.sin(a) * ry * r) for a in [k / seg * 2 * math.pi for k in range(seg)]]
                for k in range(seg):
                    q = (prev[k], prev[(k + 1) % seg], ani[(k + 1) % seg], ani[k])
                    bm.faces.new(q if sg > 0 else q[::-1])
                prev = ani
            punta = bm.verts.new(p + t * sg * min(rx, ry))
            for k in range(seg):
                q = (prev[k], prev[(k + 1) % seg], punta)
                bm.faces.new(q if sg > 0 else q[::-1])

def esfera(bm, c, r, esc=(1, 1, 1)):
    res = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=r)
    for v in res['verts']: v.co = V((v.co.x * esc[0], v.co.y * esc[1], v.co.z * esc[2])) + V(c)

def cabeza(bm, c, mujer):
    res = bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=36, radius=0.1)
    g = lambda d2, s: math.exp(-d2 / (2 * s * s))
    for v in res['verts']:
        x, y, z = v.co
        x *= 0.84 if mujer else 0.86; z *= 1.12
        fr = max(0.0, -y) / 0.1          # 1 en la cara, 0 detrás
        if z < 0.0:                       # mandíbula más estrecha y barbilla
            k = min(1.0, -z / 0.11)
            x *= 1 - k * (0.3 if mujer else 0.24)
            y += fr * k * -0.01
        if y > 0: y *= 1.06; z += 0.006 * (y / 0.1)   # nuca
        # nariz
        nz = g(x * x * 1.3 + ((z + 0.014) * 0.62) ** 2, 0.0095) * fr
        y -= nz * (0.03 if mujer else 0.036)
        y -= g(x * x * 2.5 + ((z + 0.032) * 1.3) ** 2, 0.011) * fr * 0.006
        # arco de las cejas y cuencas de los ojos
        y -= g(((z - 0.032) * 1.4) ** 2, 0.011) * fr * 0.011 * (abs(x) < 0.062)
        for sx in (-0.036, 0.036): y += g((x - sx) ** 2 + (z - 0.014) ** 2, 0.012) * fr * 0.012
        # pómulos
        for sx in (-0.05, 0.05): y -= g((x - sx) ** 2 + (z + 0.008) ** 2, 0.016) * fr * 0.006
        # labios
        y -= g((x * 0.75) ** 2 + ((z + 0.046) * 2.0) ** 2, 0.011) * fr * 0.01
        # barbilla
        y -= g(x * x * 0.6 + (z + 0.085) ** 2, 0.012) * fr * 0.006
        v.co = V((x, y, z)) + V(c)
    for sx in (-1, 1):  # orejas
        esfera(bm, (c[0] + sx * 0.084, c[1] + 0.006, c[2] + 0.004), 0.026, (0.32, 0.62, 1.0))

def cuerpo(mujer):
    s = 0.95 if mujer else 1.0
    bm = bmesh.new()
    def P(x, y, z): return (x * s, y * s, z * s)
    torso = [((0, 0.005, 0.86), 0.12, 0.09), ((0, 0.0, 0.93), 0.17 if mujer else 0.158, 0.108), ((0, 0.0, 1.01), 0.16 if mujer else 0.148, 0.102), ((0, 0.0, 1.09), 0.118 if mujer else 0.136, 0.092), ((0, 0.0, 1.18), 0.135 if mujer else 0.15, 0.1),
             ((0, 0.0, 1.27), 0.15 if mujer else 0.168, 0.11), ((0, 0.005, 1.35), 0.152 if mujer else 0.178, 0.108), ((0, 0.012, 1.42), 0.142 if mujer else 0.168, 0.092), ((0, 0.016, 1.47), 0.1 if mujer else 0.115, 0.075), ((0, 0.012, 1.505), 0.06, 0.06)]
    tubo(bm, [(P(*p), rx * s, ry * s) for p, rx, ry in torso], seg=28)
    tubo(bm, [(P(0, 0.012, 1.48), 0.054, 0.056), (P(0, 0.004, 1.6), 0.05, 0.052)], seg=18)
    for sx in (-1, 1):
        hom = 0.168 if mujer else 0.19
        tubo(bm, [(P(sx * 0.06, 0.015, 1.46), 0.05, 0.05), (P(sx * hom, 0.015, 1.435), 0.056, 0.055)])
        brazo = [((hom, 0.015, 1.435), 0.052, 0.054), ((hom + 0.022, 0.012, 1.31), 0.046 if mujer else 0.05, 0.048), ((hom + 0.04, 0.018, 1.17), 0.037, 0.04), ((hom + 0.052, 0.005, 1.06), 0.038 if mujer else 0.042, 0.036), ((hom + 0.068, -0.005, 0.925), 0.026, 0.021)]
        tubo(bm, [(P(sx * x, y, z), rx * s, ry * s) for (x, y, z), rx, ry in brazo])
        # mano: palma mirando al muslo
        hx = hom + 0.072
        tubo(bm, [(P(sx * hx, -0.004, 0.915), 0.016, 0.034), (P(sx * (hx + 0.004), -0.008, 0.85), 0.014, 0.04)], seg=14)
        for k, (dy, L) in enumerate([(-0.028, 0.075), (-0.009, 0.085), (0.01, 0.08), (0.027, 0.064)]):
            f = 0.0085 if not mujer else 0.0075
            tubo(bm, [(P(sx * (hx + 0.004), -0.008 + dy, 0.852), f, f), (P(sx * (hx + 0.006), -0.01 + dy * 1.1, 0.852 - L * 0.55), f * 0.95, f * 0.9), (P(sx * (hx + 0.002), -0.016 + dy * 1.15, 0.852 - L), f * 0.8, f * 0.8)], seg=10)
        tubo(bm, [(P(sx * (hx - 0.004), -0.03, 0.9), 0.012, 0.012), (P(sx * (hx - 0.002), -0.052, 0.865), 0.011, 0.011), (P(sx * (hx - 0.008), -0.066, 0.835), 0.009, 0.009)], seg=10)
        # pierna
        cad = 0.092 if mujer else 0.088
        pierna = [((cad, 0.005, 0.9), 0.092 if mujer else 0.086, 0.095), ((cad + 0.004, 0.0, 0.76), 0.078 if mujer else 0.076, 0.08), ((cad + 0.006, -0.004, 0.5), 0.05, 0.055), ((cad + 0.006, 0.012, 0.36), 0.05, 0.058), ((cad + 0.006, 0.012, 0.13), 0.03, 0.033), ((cad + 0.006, 0.01, 0.07), 0.033, 0.036)]
        tubo(bm, [(P(sx * x, y, z), rx * s, ry * s) for (x, y, z), rx, ry in pierna])
        tubo(bm, [(P(sx * (cad + 0.006), 0.045, 0.045), 0.032, 0.03), (P(sx * (cad + 0.008), -0.05, 0.035), 0.043, 0.027), (P(sx * (cad + 0.01), -0.155, 0.022), 0.038, 0.017)], seg=14)
        esfera(bm, P(sx * 0.068, 0.045, 0.9), 0.07 * s, (1.0, 0.75, 1.05))   # glúteos
        if mujer: esfera(bm, P(sx * 0.064, -0.07, 1.285), 0.058, (1.0, 0.72, 0.9))
    cabeza(bm, P(0, -0.008, 1.705), mujer)
    me = bpy.data.meshes.new('tmp'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('tmp', me); scn.collection.objects.link(ob)
    r = ob.modifiers.new('remesh', 'REMESH'); r.mode = 'VOXEL'; r.voxel_size = 0.0045
    sm = ob.modifiers.new('suave', 'SMOOTH'); sm.factor = 0.6; sm.iterations = 3
    d = ob.modifiers.new('dec', 'DECIMATE'); d.ratio = 0.085
    dg = bpy.context.evaluated_depsgraph_get()
    me2 = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
    for p in me2.polygons: p.use_smooth = True
    return me2

def esqueleto(nombre, s, mujer):
    hom = (0.168 if mujer else 0.19) * s
    cad = (0.092 if mujer else 0.088) * s
    huesos = [('pelvis', None, (0, 0, 0.9), (0, 0, 1.02)), ('columna', 'pelvis', (0, 0, 1.02), (0, 0, 1.24)), ('pecho', 'columna', (0, 0, 1.24), (0, 0.012, 1.46)),
              ('cuello', 'pecho', (0, 0.012, 1.46), (0, 0.006, 1.6)), ('cabeza', 'cuello', (0, 0.006, 1.6), (0, -0.008, 1.84))]
    for sx, L in ((1, 'L'), (-1, 'R')):
        huesos += [(f'clavicula.{L}', 'pecho', (sx * 0.04, 0.015, 1.45), (sx * hom, 0.015, 1.435)), (f'brazo.{L}', f'clavicula.{L}', (sx * hom, 0.015, 1.435), (sx * (hom + 0.04 * s), 0.018, 1.17 * s)),
                   (f'antebrazo.{L}', f'brazo.{L}', (sx * (hom + 0.04 * s), 0.018, 1.17 * s), (sx * (hom + 0.068 * s), -0.005, 0.925 * s)), (f'mano.{L}', f'antebrazo.{L}', (sx * (hom + 0.068 * s), -0.005, 0.925 * s), (sx * (hom + 0.075 * s), -0.012, 0.77 * s)),
                   (f'muslo.{L}', 'pelvis', (sx * cad, 0.005, 0.9 * s), (sx * (cad + 0.006 * s), -0.004, 0.5 * s)), (f'pierna.{L}', f'muslo.{L}', (sx * (cad + 0.006 * s), -0.004, 0.5 * s), (sx * (cad + 0.006 * s), 0.012, 0.08 * s)),
                   (f'pie.{L}', f'pierna.{L}', (sx * (cad + 0.006 * s), 0.012, 0.08 * s), (sx * (cad + 0.01 * s), -0.15 * s, 0.025 * s))]
    arm = bpy.data.armatures.new(nombre + '_esq'); ob = bpy.data.objects.new(nombre, arm); scn.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    eb = {}
    for n, padre, a, b in huesos:
        e = arm.edit_bones.new(n); a = V(a); b = V(b)
        if n in ('pelvis', 'columna', 'pecho', 'cuello', 'cabeza'): a = a * s; b = b * s
        e.head, e.tail = a, b
        if padre: e.parent = eb[padre]; e.use_connect = (e.head - eb[padre].tail).length < 1e-4
        eb[n] = e
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob

def personaje(pref, mujer, x0):
    s = 0.95 if mujer else 1.0
    me = cuerpo(mujer); me.name = pref + '_cuerpo'
    piel = material('Piel', (0.85, 0.62, 0.48), 0.55)
    me.materials.append(piel)
    cu = bpy.data.objects.new(pref + '_Cuerpo', me); scn.collection.objects.link(cu)
    arm = esqueleto(pref + '_Esqueleto', s, mujer)
    for o in bpy.context.view_layer.objects: o.select_set(False)
    cu.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    bm = bmesh.new()
    res = bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=32, radius1=0.255 * s, radius2=0.19 * s, depth=0.6 * s)
    for v in res['verts']: v.co.z += 0.73 * s; v.co.y *= 0.82
    m3 = bpy.data.meshes.new(pref + '_Faldon'); bm.to_mesh(m3); bm.free()
    m3.materials.append(material('Faldon', (0.95, 0.95, 0.94), 0.8))
    for p in m3.polygons: p.use_smooth = True
    fa = bpy.data.objects.new(pref + '_Faldon', m3); scn.collection.objects.link(fa)
    vg = fa.vertex_groups.new(name='pelvis'); vg.add(list(range(len(m3.vertices))), 1.0, 'REPLACE')
    fa.parent = arm; md = fa.modifiers.new('Armature', 'ARMATURE'); md.object = arm
    arm.location.x = x0
    return arm

h = personaje('H', False, -0.45)
m = personaje('M', True, 0.45)
# luces y cámara de revisión
cam = bpy.data.objects.new('Camara', bpy.data.cameras.new('Camara')); scn.collection.objects.link(cam)
cam.location = (0, -4.2, 1.0); cam.rotation_euler = (math.radians(90), 0, 0); cam.data.lens = 50; scn.camera = cam
for nom, loc, en in (('Clave', (2, -3, 3), 900), ('Relleno', (-3, -2, 2), 400), ('Contra', (0, 3, 3), 500)):
    l = bpy.data.objects.new(nom, bpy.data.lights.new(nom, 'POINT')); l.data.energy = en; l.location = loc; scn.collection.objects.link(l)
result = {o.name: (len(o.data.polygons) if o.type == 'MESH' else len(o.data.bones)) for o in scn.objects if o.type in ('MESH', 'ARMATURE')}
