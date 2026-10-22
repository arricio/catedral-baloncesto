/** Barra de progreso animada con los estados de la impresión. */
import type { Etapa, Progreso } from '../motor/tipos'

const TEXTOS: Record<Etapa, string> = {
  conectando: 'Encendiendo la impresora…',
  cola: 'Esperando turno en la cola',
  imagen: 'Dibujando tu idea',
  analizando: 'Analizando imagen',
  forma: 'Construyendo forma',
  texturas: 'Pintando texturas',
  listo: '¡Listo!',
}

const PASOS: { etapa: Etapa; texto: string }[] = [
  { etapa: 'analizando', texto: 'Analizar' },
  { etapa: 'forma', texto: 'Forma' },
  { etapa: 'texturas', texto: 'Texturas' },
  { etapa: 'listo', texto: '¡Listo!' },
]
const ORDEN: Etapa[] = ['conectando', 'cola', 'imagen', 'analizando', 'forma', 'texturas', 'listo']

function tiempo(seg?: number) {
  if (seg == null || !isFinite(seg) || seg <= 0) return ''
  if (seg < 60) return `≈ ${Math.ceil(seg)} s`
  return `≈ ${Math.ceil(seg / 60)} min`
}

export function BarraProgreso({ progreso, soloImagen = false }: { progreso: Progreso; soloImagen?: boolean }) {
  const pct = Math.round(Math.max(2, Math.min(100, progreso.porcentaje)))
  const idx = ORDEN.indexOf(progreso.etapa)
  return (
    <div className="w-full">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div aria-live="polite">
          <p className="font-titulo text-lg font-semibold">{TEXTOS[progreso.etapa]}</p>
          <p className="text-sm text-texto-2">
            {progreso.etapa === 'cola' && progreso.posicionCola ? `Hay ${progreso.posicionCola} ${progreso.posicionCola === 1 ? 'persona' : 'personas'} delante · ` : ''}
            {tiempo(progreso.eta)}
            {progreso.servicio ? ` ${progreso.eta ? '· ' : ''}${progreso.servicio}` : ''}
          </p>
        </div>
        <span className="font-titulo text-2xl font-bold tabular-nums texto-neon">{pct}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-panel-fuerte" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={TEXTOS[progreso.etapa]}>
        <div className="barra-brillo h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      {!soloImagen && (
        <ol className="mt-3 grid grid-cols-4 gap-1 text-center text-xs">
          {PASOS.map((p) => {
            const hecho = idx > ORDEN.indexOf(p.etapa) || progreso.etapa === 'listo'
            const actual = progreso.etapa === p.etapa
            return (
              <li key={p.etapa} className={`flex flex-col items-center gap-1 ${hecho || actual ? 'text-texto' : 'text-texto-2/70'}`}>
                <span className={`size-2.5 rounded-full ${hecho ? 'bg-ok' : actual ? 'animate-pulse bg-magenta' : 'bg-panel-fuerte'}`} />
                {p.texto}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
