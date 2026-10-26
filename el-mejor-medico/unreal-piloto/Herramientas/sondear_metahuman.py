# EL MEJOR MÉDICO (Unreal): qué ofrece la API de Python de MetaHuman en esta versión (para automatizar los personajes).
import os
import unreal

lineas = []
for nombre in sorted(dir(unreal)):
    if 'MetaHuman' in nombre:
        obj = getattr(unreal, nombre)
        metodos = [m for m in dir(obj) if not m.startswith('_')][:60] if isinstance(obj, type) else []
        lineas.append(f'{nombre}: {", ".join(metodos)}')
# presets y recursos incluidos con el plugin
for raiz in ('/MetaHumanCharacter', '/MetaHuman', '/MetaHumanSDK'):
    try:
        recursos = unreal.EditorAssetLibrary.list_assets(raiz, recursive=True)
        lineas.append(f'{raiz}: {len(recursos)} recursos')
        lineas += [f'   {r}' for r in recursos if any(k in r for k in ('Preset', 'preset', 'Character', 'Body', 'Wardrobe', 'Outfit', 'Clothing'))][:120]
    except Exception as e:
        lineas.append(f'{raiz}: {e}')
ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'MetaHuman_API.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lineas))
unreal.log_warning(f'[EMM] API de MetaHuman en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
