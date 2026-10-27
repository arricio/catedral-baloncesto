# EL MEJOR MÉDICO (Unreal): métodos completos (con su ayuda) de las clases clave de MetaHuman.
import os
import unreal

CLASES = ['MetaHumanCharacterEditorSubsystem', 'MetaHumanCharacter', 'MetaHumanCharacterInstance', 'MetaHumanCharacterEditorBuildParameters',
          'MetaHumanCharacterAutoRiggingRequestParams', 'MetaHumanCharacterRigType', 'MetaHumanCharacterPipelineQuality',
          'MetaHumanCharacterPipelineType', 'MetaHumanCharacterSkinSettings', 'MetaHumanCharacterSkinProperties',
          'MetaHumanCharacterEditorActor', 'MetaHumanCharacterPalette', 'MetaHumanCollection', 'MetaHumanWardrobeItem']
lineas = []
for c in CLASES:
    obj = getattr(unreal, c, None)
    if obj is None:
        lineas.append(f'## {c}: NO EXISTE')
        continue
    lineas.append(f'## {c}')
    base = set(dir(unreal.Object)) | set(dir(unreal.StructBase)) | set(dir(unreal.EnumBase)) if hasattr(unreal, 'EnumBase') else set(dir(unreal.Object))
    for m in sorted(dir(obj)):
        if m.startswith('_') or m in base:
            continue
        doc = (getattr(getattr(obj, m), '__doc__', '') or '').strip().split('\n')
        lineas.append(f'  {m}: {" ".join(d.strip() for d in doc[:3])[:300]}')
# recursos de MetaHuman que haya en el proyecto o en el motor (presets, ropa, pelo)
for raiz in ('/MetaHumanCharacter', '/Game'):
    for r in unreal.EditorAssetLibrary.list_assets(raiz, recursive=True):
        if any(k in r for k in ('Preset', 'Wardrobe', 'Groom', 'Outfit', 'Hair', 'Clothing', 'Collection', 'Palette')):
            lineas.append(f'RECURSO {r}')
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'MetaHuman_API2.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] API completa en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
