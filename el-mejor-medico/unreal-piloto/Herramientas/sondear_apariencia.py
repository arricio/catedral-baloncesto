# EL MEJOR MÉDICO (Unreal): qué se puede cambiar de un MetaHuman montado dentro del juego (creador de personajes):
# parámetros de los materiales de piel, ojos, pelo, cejas y barba, y los grooms disponibles con su malla de anclaje.
import os
import unreal

eal = unreal.EditorAssetLibrary
mel = unreal.MaterialEditingLibrary
lineas = []


def parametros(mat, sangria='      '):
    for tipo, f in (('escalar', mel.get_scalar_parameter_names), ('vector', mel.get_vector_parameter_names), ('textura', mel.get_texture_parameter_names)):
        try:
            nombres = [str(n) for n in f(mat)]
        except Exception as e:
            nombres = [f'error {e}']
        lineas.append(f'{sangria}{tipo} ({len(nombres)}): ' + ', '.join(nombres[:120]))


for nombre in ('MH_Medico', 'MH_P_Etta'):
    base = f'/Game/MetaHumans/Personajes/Unpacked/{nombre}'
    clase = eal.load_blueprint_class(f'{base}/BP_{nombre}')
    a = unreal.EditorLevelLibrary.spawn_actor_from_class(clase, unreal.Vector(0, 0, -5000))
    lineas.append(f'## {nombre}')
    for c in a.get_components_by_class(unreal.MeshComponent):
        lineas.append(f'  {c.get_class().get_name()} {c.get_name()}')
        for i in range(c.get_num_materials()):
            m = c.get_material(i)
            if not m:
                continue
            lineas.append(f'    [{i}] {m.get_path_name()}')
            if i < 6:
                parametros(m)
    for g in a.get_components_by_class(unreal.GroomComponent):
        lineas.append(f'  groom {g.get_name()}: asset={p if (p := g.get_editor_property("groom_asset")) is None else p.get_path_name()} binding={g.get_editor_property("binding_asset")}')
    a.destroy_actor()

# niños (mallas de MPFB): parámetros de los materiales importados
for r in ('/Game/Ninos/Nino_Escolar_H/Nino_Escolar_H',):
    malla = eal.load_asset(r)
    lineas.append(f'## {r}')
    for sm in malla.get_editor_property('materials'):
        mi = sm.get_editor_property('material_interface')
        lineas.append(f'  ranura {sm.get_editor_property("material_slot_name")}: {mi.get_path_name() if mi else None} padre={mi.get_editor_property("parent").get_path_name() if mi and hasattr(mi, "parent") and mi.get_editor_property("parent") else "-"}')
        if mi:
            parametros(mi)

# grooms y anclajes que hay en el proyecto
for r in eal.list_assets('/Game/MetaHumans', recursive=True):
    if any(k in r for k in ('Binding', '/Hair/', 'Groom')) and len(lineas) < 2500:
        lineas.append('  asset ' + r)

ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_saved_dir()), 'Apariencia.txt')
with open(ruta, 'w', encoding='utf-8') as f:
    f.write('\n'.join(str(x) for x in lineas))
unreal.log_warning(f'[EMM] apariencia en {ruta}')
if os.environ.get('EMM_CERRAR') == '1':
    unreal.SystemLibrary.quit_editor()
