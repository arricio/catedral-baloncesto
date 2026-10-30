# EL MEJOR MÉDICO (Unreal): pose de referencia del esqueleto de un niño de MPFB (escala y ejes tras importar el FBX)
import os
import unreal

eal = unreal.EditorAssetLibrary
lineas = []
for n in ('Nino_Escolar_H', 'Nino_Bebe'):
    m = eal.load_asset(f'/Game/Ninos/{n}/{n}')
    sk = m.get_editor_property('skeleton')
    pose = unreal.AnimPoseExtensions.get_reference_pose(sk)
    lineas.append(f'## {n}')
    for hueso in ('Root', 'pelvis', 'spine_01', 'head', 'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'upperarm_l', 'hand_l'):
        for esp, nombre in ((unreal.AnimPoseSpaces.LOCAL, 'local'), (unreal.AnimPoseSpaces.WORLD, 'componente')):
            try:
                t = unreal.AnimPoseExtensions.get_bone_pose(pose, hueso, esp)
                r = t.rotation.rotator()
                lineas.append(f'  {hueso} {nombre}: pos=({t.translation.x:.1f}, {t.translation.y:.1f}, {t.translation.z:.1f}) giro=({r.roll:.0f}, {r.pitch:.0f}, {r.yaw:.0f}) escala=({t.scale3d.x:.2f}, {t.scale3d.y:.2f}, {t.scale3d.z:.2f})')
            except Exception as e:
                lineas.append(f'  {hueso}: {e}')
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'EsqueletoNino.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] esqueleto en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
