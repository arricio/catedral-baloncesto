import { useLiveQuery } from 'dexie-react-hooks'
import { useId } from 'react'
import { db } from '../lib/db'

export function SelectorCarpeta({ valor, onCambio, etiqueta = 'Guardar en la carpeta' }: { valor: string; onCambio: (id: string) => void; etiqueta?: string }) {
  const carpetas = useLiveQuery(() => db.carpetas.orderBy('creado').toArray(), []) ?? []
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-texto-2">
        {etiqueta}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="cristal min-h-12 w-full appearance-none rounded-2xl px-4 text-[16px] text-texto"
      >
        {carpetas.map((c) => (
          <option key={c.id} value={c.id} className="bg-fondo-2">
            📁 {c.nombre}
          </option>
        ))}
      </select>
    </div>
  )
}
