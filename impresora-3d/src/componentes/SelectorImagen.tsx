/**
 * Elegir imagen: «Hacer foto» (abre la cámara del móvil), «Galería» y,
 * en el ordenador, arrastrar y soltar. Solo PNG/JPG/JPEG y tamaño limitado.
 */
import { useRef, useState, type DragEvent } from 'react'
import { useAjustes } from '../lib/ajustes'
import { avisar } from '../lib/avisos'
import { ErrorImagen, validarImagen } from '../lib/imagen'
import { esMovil } from '../lib/plataforma'
import { Icono } from './Icono'
import { Boton } from './ui'

export function SelectorImagen({ alElegir }: { alElegir: (f: File) => void }) {
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)
  const maxMB = useAjustes((s) => s.maxMB)
  const [encima, setEncima] = useState(false)

  const recibir = (f?: File | null) => {
    if (!f) return
    try {
      validarImagen(f, maxMB)
      alElegir(f)
    } catch (e) {
      avisar(e instanceof ErrorImagen ? e.message : 'No se pudo abrir la imagen.', 'error', 6000)
    }
  }
  const soltar = (e: DragEvent) => {
    e.preventDefault()
    setEncima(false)
    recibir(e.dataTransfer.files?.[0])
  }

  return (
    <div
      onDragOver={(e) => (e.preventDefault(), setEncima(true))}
      onDragLeave={() => setEncima(false)}
      onDrop={soltar}
      className={`rounded-3xl border-2 border-dashed p-5 text-center transition ${encima ? 'border-cian bg-cian/10' : 'border-borde'}`}
    >
      <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-cian/20 to-magenta/20 text-cian">
        <Icono nombre="camara" className="size-8" />
      </div>
      <p className="mb-1 font-titulo text-lg font-semibold">Haz una foto o elige una imagen</p>
      <p className="mb-5 text-sm text-texto-2">
        {esMovil ? 'Un solo objeto, bien iluminado y centrado.' : 'Arrastra aquí una imagen o elige una. Un objeto, bien iluminado y centrado.'}
        <br />PNG o JPG · máximo {maxMB} MB
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Boton variante="principal" grande icono="camara" onClick={() => camara.current?.click()}>
          Hacer foto
        </Boton>
        <Boton grande icono="galeria" onClick={() => galeria.current?.click()}>
          Galería
        </Boton>
      </div>
      {/* capture="environment" abre directamente la cámara trasera del móvil */}
      <input ref={camara} type="file" accept="image/png,image/jpeg" capture="environment" hidden onChange={(e) => (recibir(e.target.files?.[0]), (e.target.value = ''))} />
      <input ref={galeria} type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" hidden onChange={(e) => (recibir(e.target.files?.[0]), (e.target.value = ''))} />
    </div>
  )
}
