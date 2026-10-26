# EL MEJOR MÉDICO (Unreal): al abrir el editor, ejecuta una tarea de Herramientas/ sólo si se pide con la
# variable de entorno EMM_TAREA (por ejemplo, EMM_TAREA=crear_consulta.py). Sin ella, no hace nada.
# La tarea espera a que el editor haya terminado de arrancar (si no, importar y guardar no funciona).
import os
import time
import unreal

tarea = os.environ.get('EMM_TAREA')
if tarea:
    ruta = os.path.join(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir()), 'Herramientas', tarea)
    estado = {'t0': None, 'hecho': False}

    def _tic(dt):
        estado['t0'] = estado['t0'] or time.time()
        if estado['hecho'] or time.time() - estado['t0'] < 5:
            return
        estado['hecho'] = True
        unreal.unregister_slate_post_tick_callback(_asa)
        unreal.log_warning(f'[EMM] Tarea: {ruta}')
        try:
            with open(ruta, encoding='utf-8') as f:
                exec(compile(f.read(), ruta, 'exec'), {'__name__': '__main__'})
        except Exception as e:
            import traceback
            unreal.log_error('[EMM] La tarea ha fallado: ' + traceback.format_exc())
            if os.environ.get('EMM_CERRAR') == '1':
                unreal.SystemLibrary.quit_editor()

    _asa = unreal.register_slate_post_tick_callback(_tic)
