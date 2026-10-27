# EL MEJOR MÉDICO (Unreal): huesos del cuerpo MetaHuman y controles faciales (CTRL_expressions_*) de la cara.
import os
import unreal

eal = unreal.EditorAssetLibrary
lineas = []
cuerpo = eal.load_asset('/Game/MetaHumans/Personajes/Unpacked/MH_Medico/Body/SKM_MH_Medico_BodyMesh')
cara = eal.load_asset('/Game/MetaHumans/Personajes/Unpacked/MH_Medico/Face/SKM_MH_Medico_FaceMesh')
for nombre, malla in (('CUERPO', cuerpo), ('CARA', cara)):
    esq = malla.get_editor_property('skeleton')
    lineas.append(f'## {nombre}: malla={malla.get_path_name()} esqueleto={esq.get_path_name()}')
    huesos = unreal.SkeletalMeshEditorSubsystem if False else None
    try:
        n = malla.get_editor_property('ref_skeleton') if False else None
    except Exception:
        n = None
    # nombres de huesos con la biblioteca de mallas
    try:
        lista = [str(b) for b in unreal.SkeletalMeshEditorSubsystem.get_bone_names(malla)] if hasattr(unreal.SkeletalMeshEditorSubsystem, 'get_bone_names') else []
    except Exception:
        lista = []
    if not lista:
        try:
            lista = [str(malla.get_bone_name(i)) for i in range(malla.get_num_bones())] if hasattr(malla, 'get_num_bones') else []
        except Exception:
            lista = []
    lineas.append(f'  huesos ({len(lista)}): ' + ', '.join(lista[:120]))
    curvas = [str(c) for c in esq.get_curve_meta_data_names()] if hasattr(esq, 'get_curve_meta_data_names') else []
    lineas.append(f'  curvas CTRL ({len([c for c in curvas if c.startswith("CTRL")])}): ' + ', '.join(c for c in curvas if c.startswith('CTRL_expressions_') and any(k in c for k in ('jaw', 'mouth', 'eyeBlink', 'brow')))[:4000])
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'Esqueleto.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] esqueleto en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
