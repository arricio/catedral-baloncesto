/** Indica qué motor se va a usar (nube o servidor local) y su estado. */
import { useAjustes } from '../lib/ajustes'
import { ir } from '../lib/ruta'
import { modoDemo, useEstadoMotor } from '../motor'
import { Icono } from './Icono'

export function ChipMotor() {
  const { motor, hfUsuario, localUrl } = useAjustes()
  const servidor = useEstadoMotor((s) => s.servidor)
  const usaLocal = !!servidor && motor !== 'nube'
  let texto: string
  if (modoDemo) texto = 'Modo demostración (sin IA)'
  else if (usaLocal) texto = `Mi servidor encendido${servidor?.gpu ? ` · ${servidor.gpu}` : ''}`
  else if (motor === 'local' && localUrl) texto = 'Servidor apagado → usando la nube'
  else texto = hfUsuario ? `Nube gratuita · ${hfUsuario}` : 'Nube gratuita (sin iniciar sesión)'
  return (
    <button
      type="button"
      onClick={() => ir('/ajustes')}
      className="cristal inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm text-texto-2 hover:text-texto"
      aria-label={`Motor 3D: ${texto}. Cambiar en Ajustes`}
    >
      <span className={`size-2 rounded-full ${usaLocal || modoDemo ? 'bg-ok' : motor === 'local' && localUrl ? 'bg-error' : 'bg-cian'}`} />
      <Icono nombre={usaLocal ? 'servidor' : 'nube'} className="size-4" />
      <span className="max-w-[60vw] truncate">{texto}</span>
    </button>
  )
}
