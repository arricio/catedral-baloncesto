/** Pantalla de bienvenida: qué hace la app y cómo instalarla en tu móvil. */
import { InstruccionesInstalar } from '../componentes/Instalar'
import { Boton, Tarjeta } from '../componentes/ui'
import { useAjustes } from '../lib/ajustes'
import { esIOS } from '../lib/plataforma'
import { ir } from '../lib/ruta'

const PUNTOS = [
  { e: '📷', t: 'Haz una foto', d: 'de un objeto y lo convertimos en un modelo 3D con sus colores reales.' },
  { e: '✍️', t: 'O escribe una idea', d: '«un tractor rojo con ruedas negras» y lo creamos desde cero.' },
  { e: '📦', t: 'Descarga', d: 'para videojuegos, Blender, redes sociales o tu impresora 3D (STL y 3MF a color).' },
  { e: '💸', t: '100 % gratis', d: 'con IA de código abierto. Sin suscripciones ni tarjetas.' },
]

export function Bienvenida() {
  const set = useAjustes((s) => s.set)
  const empezar = () => {
    set({ bienvenidaVista: true })
    ir('/imprimir')
  }
  return (
    <div className="mx-auto max-w-xl space-y-5 pb-6">
      <header className="pt-4 text-center">
        <div className="mx-auto mb-4 grid size-24 place-items-center rounded-[28px] bg-gradient-to-br from-cian to-magenta text-5xl shadow-[var(--sombra-neon)]" aria-hidden>
          🖨️
        </div>
        <h1 className="font-titulo text-4xl font-bold tracking-tight">
          Bienvenido a <span className="texto-neon">IMPRESORA 3D</span>
        </h1>
        <p className="mt-2 text-lg text-texto-2">Tu impresora mágica: de foto o texto a modelo 3D a todo color.</p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {PUNTOS.map((p) => (
          <li key={p.t} className="cristal flex gap-3 rounded-3xl p-4">
            <span className="text-3xl" aria-hidden>
              {p.e}
            </span>
            <span>
              <b className="block">{p.t}</b>
              <span className="text-sm text-texto-2">{p.d}</span>
            </span>
          </li>
        ))}
      </ul>
      <Tarjeta>
        <h2 className="mb-3 font-titulo text-xl font-bold">Instálala en tu {esIOS ? 'iPhone' : 'móvil'}</h2>
        <p className="mb-4 text-sm text-texto-2">Así se abre a pantalla completa, funciona sin conexión y te avisa cuando tu modelo esté listo.</p>
        <InstruccionesInstalar />
      </Tarjeta>
      <Boton variante="principal" grande icono="impresora" className="w-full" onClick={empezar}>
        Empezar a imprimir
      </Boton>
    </div>
  )
}
