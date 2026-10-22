import { useAvisos } from '../lib/avisos'
import { Icono } from './Icono'

/** Avisos flotantes (encima de la barra inferior). */
export function Avisos() {
  const lista = useAvisos((s) => s.lista)
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {lista.map((a) => (
        <div
          key={a.id}
          role={a.tipo === 'error' ? 'alert' : 'status'}
          className={`aparecer pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl border px-4 py-3 text-[15px] shadow-xl backdrop-blur-xl ${
            a.tipo === 'error' ? 'border-error/50 bg-fondo-2/95 text-texto' : a.tipo === 'exito' ? 'border-ok/50 bg-fondo-2/95' : 'border-cian/40 bg-fondo-2/95'
          }`}
        >
          <Icono nombre={a.tipo === 'error' ? 'alerta' : a.tipo === 'exito' ? 'check' : 'varita'} className={`mt-0.5 size-5 shrink-0 ${a.tipo === 'error' ? 'text-error' : a.tipo === 'exito' ? 'text-ok' : 'text-cian'}`} />
          <span>{a.texto}</span>
        </div>
      ))}
    </div>
  )
}
