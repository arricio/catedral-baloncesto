/** Piezas básicas de la interfaz: botones, interruptores, selector segmentado, hoja inferior… */
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icono, type NombreIcono } from './Icono'

type Variante = 'principal' | 'secundario' | 'fantasma' | 'peligro'

const ESTILOS: Record<Variante, string> = {
  principal:
    'bg-gradient-to-r from-cian to-magenta text-sobre-acento font-semibold shadow-[var(--sombra-neon)] hover:brightness-110',
  secundario: 'cristal text-texto hover:bg-panel-fuerte',
  fantasma: 'text-texto-2 hover:text-texto hover:bg-panel',
  peligro: 'bg-error/15 text-error border border-error/40 hover:bg-error/25',
}

export function Boton({
  variante = 'secundario',
  icono,
  children,
  className = '',
  grande,
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; icono?: NombreIcono; grande?: boolean }) {
  return (
    <button
      type="button"
      {...resto}
      className={`inline-flex min-h-11 min-w-11 select-none whitespace-nowrap items-center justify-center gap-2 rounded-2xl px-4 transition active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${
        grande ? 'min-h-14 px-6 text-lg' : 'text-[15px]'
      } ${ESTILOS[variante]} ${className}`}
    >
      {icono && <Icono nombre={icono} className={grande ? 'size-6' : 'size-5'} />}
      {children}
    </button>
  )
}

export function Interruptor({ activo, onCambio, etiqueta, descripcion }: { activo: boolean; onCambio: (v: boolean) => void; etiqueta: string; descripcion?: string }) {
  const id = useId()
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block font-medium">{etiqueta}</span>
        {descripcion && <span className="block text-sm text-texto-2">{descripcion}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={activo}
        onClick={() => onCambio(!activo)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${activo ? 'bg-gradient-to-r from-cian to-magenta' : 'bg-panel-fuerte border border-borde'}`}
      >
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${activo ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  )
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: {
  opciones: { id: T; texto: ReactNode; icono?: NombreIcono }[]
  valor: T
  onCambio: (v: T) => void
  etiqueta: string
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="cristal flex gap-1 rounded-2xl p-1">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          onClick={() => onCambio(o.id)}
          className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-medium transition ${
            valor === o.id ? 'bg-gradient-to-r from-cian/25 to-magenta/25 text-texto shadow-inner ring-1 ring-cian/50' : 'text-texto-2 hover:text-texto'
          }`}
        >
          {o.icono && <Icono nombre={o.icono} className="size-5" />}
          {o.texto}
        </button>
      ))}
    </div>
  )
}

/** Hoja que sube desde abajo (móvil) o diálogo centrado (ordenador). */
export function Hoja({ abierta, onCerrar, titulo, children }: { abierta: boolean; onCerrar: () => void; titulo: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierta && !d.open) d.showModal()
    if (!abierta && d.open) d.close()
  }, [abierta])
  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => e.target === ref.current && onCerrar()}
      aria-label={titulo}
      className="m-0 mt-auto w-full max-w-none bg-transparent p-0 backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg"
    >
      <div className="aparecer max-h-[88dvh] overflow-y-auto rounded-t-3xl border border-borde bg-fondo-2 p-5 pb-segura text-texto sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-panel-fuerte sm:hidden" />
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-titulo text-xl font-bold">{titulo}</h2>
          <Boton variante="fantasma" icono="cerrar" onClick={onCerrar} aria-label="Cerrar" />
        </div>
        {children}
      </div>
    </dialog>
  )
}

export function Tarjeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`cristal rounded-3xl p-4 sm:p-5 ${className}`}>{children}</section>
}

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-4">
      <h1 className="font-titulo text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">{children}</h1>
      {sub && <p className="mt-1 text-texto-2">{sub}</p>}
    </header>
  )
}

export function formatoBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}
