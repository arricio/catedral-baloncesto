# EL MEJOR MÉDICO (Unreal): importa los modelos de voz Piper (Fuentes/Piper/voces/*.onnx) como recursos NNE en
# /Game/Voces (EMMPiper los carga con el nombre que da voces.json: guiones cambiados por guiones bajos).
import os
import unreal

eal = unreal.EditorAssetLibrary
herr = unreal.AssetToolsHelpers.get_asset_tools()
PROYECTO = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
carpeta = os.path.join(PROYECTO, 'Fuentes', 'Piper', 'voces')
for f in sorted(os.listdir(carpeta)):
    if not f.endswith('.onnx'):
        continue
    nombre = f[:-5].replace('-', '_')
    t = unreal.AssetImportTask()
    t.filename = os.path.join(carpeta, f)
    t.destination_path = '/Game/Voces'
    t.destination_name = nombre
    t.automated = True
    t.save = True
    t.replace_existing = True
    herr.import_asset_tasks([t])
    a = eal.load_asset(f'/Game/Voces/{nombre}')
    unreal.log_warning(f'[EMM] voz {nombre}: {a.get_class().get_name() if a else "NO IMPORTADA"}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
