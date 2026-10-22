import { useImpresion } from '../motor/trabajo'
import { ir, useRuta } from '../lib/ruta'
import { Icono, type NombreIcono } from './Icono'

const BOTONES: { ruta: 'imprimir' | 'biblioteca' | 'ajustes'; texto: string; icono: NombreIcono }[] = [
  { ruta: 'imprimir', texto: 'Imprimir', icono: 'impresora' },
  { ruta: 'biblioteca', texto: 'Biblioteca', icono: 'biblioteca' },
  { ruta: 'ajustes', texto: 'Ajustes', icono: 'ajustes' },
]

/**
 * Navegación principal. En el móvil: barra inferior con botones grandes para el pulgar.
 * En pantallas grandes: barra lateral izquierda.
 */
export function BarraNavegacion() {
  const ruta = useRuta()
  const actual = ruta.nombre === 'modelo' ? 'biblioteca' : ruta.nombre
  const imprimiendo = useImpresion((s) => s.trabajo && ['imagen', 'modelo'].includes(s.trabajo.estado))
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-borde bg-fondo/85 pb-segura backdrop-blur-xl lg:inset-y-0 lg:left-0 lg:right-auto lg:w-60 lg:border-r lg:border-t-0 lg:pb-0 lg:pt-6"
    >
      <a href="#/imprimir" className="mb-8 hidden items-center gap-2 px-6 font-titulo text-xl font-bold lg:flex">
        <span className="texto-neon">IMPRESORA</span> 3D
      </a>
      <ul className="mx-auto flex max-w-lg justify-around lg:flex-col lg:gap-1 lg:px-3">
        {BOTONES.map((b) => {
          const activo = actual === b.ruta
          return (
            <li key={b.ruta} className="flex-1 lg:flex-none">
              <button
                type="button"
                onClick={() => ir(`/${b.ruta}`)}
                aria-current={activo ? 'page' : undefined}
                className={`relative flex min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-semibold transition [@media(max-height:500px)]:min-h-12 [@media(max-height:500px)]:flex-row [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:text-sm lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-[15px] ${
                  activo ? 'text-cian' : 'text-texto-2 hover:text-texto'
                }`}
              >
                <span className={`relative grid place-items-center rounded-2xl px-5 py-1 transition [@media(max-height:500px)]:px-2 lg:px-0 ${activo ? 'bg-cian/15 lg:bg-transparent' : ''}`}>
                  <Icono nombre={b.icono} className="size-7 [@media(max-height:500px)]:size-6 lg:size-6" />
                  {b.ruta === 'imprimir' && imprimiendo && (
                    <span className="absolute right-3 top-0.5 size-2.5 animate-pulse rounded-full bg-magenta lg:-right-1" aria-label="Imprimiendo" />
                  )}
                </span>
                {b.texto}
                {activo && <span className="absolute inset-x-8 -top-px h-0.5 rounded-full bg-gradient-to-r from-cian to-magenta lg:hidden" />}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
