/** Selector de tipo de letra con una muestra de cada uno. */
import { useEffect, useState } from 'react'
import { cargarTodas, FUENTES } from '../lib/fuentes'

export function SelectorFuente({ valor, onCambio, muestra }: { valor: string; onCambio: (id: string) => void; muestra?: string }) {
  const [, setListas] = useState(0)
  useEffect(() => {
    cargarTodas().then(() => setListas((n) => n + 1))
  }, [])
  const texto = (muestra?.trim() || 'Hola').slice(0, 14)
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-texto-2">Tipo de letra</legend>
      <div className="grid grid-cols-3 gap-2">
        {FUENTES.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={valor === f.id}
            onClick={() => onCambio(f.id)}
            className={`flex min-h-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl px-1 py-2 ${valor === f.id ? 'borde-neon' : 'cristal'}`}
          >
            <span className="max-w-full truncate text-lg leading-tight" style={{ fontFamily: `"${f.familia}", sans-serif`, fontWeight: f.peso, fontSize: f.id === 'pixel' ? '0.7rem' : undefined }}>
              {texto}
            </span>
            <span className="text-xs text-texto-2">{f.nombre}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
