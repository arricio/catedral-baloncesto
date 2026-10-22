/**
 * Ficha de un modelo: visor 3D, comparativa con la imagen original,
 * descargas en todos los formatos y medios para redes sociales.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Icono } from '../componentes/Icono'
import { SelectorCarpeta } from '../componentes/SelectorCarpeta'
import { Boton, Hoja, Segmentado, formatoBytes } from '../componentes/ui'
import { compartirArchivo, guardarArchivo, nombreArchivo } from '../exportar/descargar'
import { FORMATOS, exportarModelo, type Formato } from '../exportar/formatos'
import { capturarPNG, grabarVideo, useEscenaVisor, type FondoCaptura, type Proporcion } from '../exportar/medios'
import { useAjustes, type FondoVisor } from '../lib/ajustes'
import { avisar } from '../lib/avisos'
import { borrarModelo, db, moverModelo, renombrarModelo, type Modelo } from '../lib/db'
import { esIOS } from '../lib/plataforma'
import { ir } from '../lib/ruta'
import { apuntarBorrado } from '../sync/supabase'

const Visor3D = lazy(() => import('../componentes/Visor3D').then((m) => ({ default: m.Visor3D })))

function useUrl(b?: Blob) {
  const url = useMemo(() => (b ? URL.createObjectURL(b) : ''), [b])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  return url
}

const FONDOS: { id: FondoVisor; texto: string }[] = [
  { id: 'degradado', texto: 'Degradado' },
  { id: 'oscuro', texto: 'Oscuro' },
  { id: 'claro', texto: 'Claro' },
  { id: 'transparente', texto: 'Transp.' },
]

// ── Descargar en formatos 3D ────────────────────────────────

function HojaDescargar({ modelo, abierta, onCerrar }: { modelo: Modelo; abierta: boolean; onCerrar: () => void }) {
  const [altura, setAltura] = useState(80)
  const [colores, setColores] = useState(6)
  const [ocupado, setOcupado] = useState<Formato | null>(null)
  const descargar = async (f: Formato) => {
    setOcupado(f)
    try {
      const def = FORMATOS.find((x) => x.id === f)!
      const blob = await exportarModelo(modelo.glb, f, modelo.nombre, { alturaMM: altura, colores3MF: colores })
      await guardarArchivo(blob, nombreArchivo(`${modelo.nombre}${f === 'gltf' ? '-gltf' : f === 'obj' ? '-obj' : ''}`, def.ext))
      avisar(esIOS ? 'Elige «Guardar en Archivos» para conservarlo.' : 'Descargado en la carpeta «Descargas».', 'exito')
    } catch (e) {
      console.error(e)
      avisar('No se pudo convertir el modelo. Prueba con GLB.', 'error')
    } finally {
      setOcupado(null)
    }
  }
  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Descargar modelo 3D">
      <ul className="space-y-2">
        {FORMATOS.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              disabled={!!ocupado}
              onClick={() => descargar(f.id)}
              className="cristal flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-2 text-left hover:bg-panel-fuerte disabled:opacity-60"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cian/25 to-magenta/25 font-titulo text-xs font-bold">{f.nombre.split(' ')[0]}</span>
              <span className="flex-1">
                <span className="block font-semibold">{f.nombre}</span>
                <span className="block text-sm text-texto-2">{f.uso}</span>
              </span>
              {ocupado === f.id ? <span className="size-5 animate-spin rounded-full border-2 border-cian border-t-transparent" /> : <Icono nombre="descargar" className="size-5 text-texto-2" />}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-borde p-3">
        <label className="text-sm text-texto-2">
          Altura impresa (STL/3MF)
          <span className="mt-1 flex items-center gap-2">
            <input type="number" min={10} max={300} value={altura} onChange={(e) => setAltura(Math.max(10, Math.min(300, Number(e.target.value) || 80)))} className="cristal min-h-11 w-full rounded-xl px-3 text-[16px] text-texto" />
            mm
          </span>
        </label>
        <label className="text-sm text-texto-2">
          Colores en 3MF
          <input type="number" min={1} max={16} value={colores} onChange={(e) => setColores(Math.max(1, Math.min(16, Number(e.target.value) || 6)))} className="cristal mt-1 min-h-11 w-full rounded-xl px-3 text-[16px] text-texto" />
        </label>
      </div>
      <p className="mt-3 text-xs text-texto-2">Consejo: en el laminador asigna un filamento a cada color del 3MF.</p>
    </Hoja>
  )
}

// ── Redes sociales ──────────────────────────────────────────

function HojaRedes({ modelo, abierta, onCerrar }: { modelo: Modelo; abierta: boolean; onCerrar: () => void }) {
  const escena = useEscenaVisor((s) => s.escena)
  const [proporcion, setProporcion] = useState<Proporcion>('9:16')
  const [fondo, setFondo] = useState<FondoCaptura>('degradado')
  const [color, setColor] = useState('#22e3ff')
  const [trabajo, setTrabajo] = useState<{ tipo: 'png' | 'video'; p: number } | null>(null)
  const [resultado, setResultado] = useState<{ blob: Blob; nombre: string } | null>(null)
  const url = useUrl(resultado?.blob)
  const fondoFinal: FondoCaptura = fondo === '#' ? (color as `#${string}`) : fondo

  const hacer = async (tipo: 'png' | 'video') => {
    if (!escena) return avisar('Espera a que cargue el modelo.', 'info')
    setResultado(null)
    setTrabajo({ tipo, p: 0 })
    try {
      const pequeño = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 3
      const blob =
        tipo === 'png'
          ? await capturarPNG(escena, proporcion, fondoFinal, pequeño ? 1080 : 2048)
          : await grabarVideo(escena, { proporcion, fondo: fondoFinal, ladoCorto: pequeño ? 720 : 1080, alProgresar: (p) => setTrabajo({ tipo, p }) })
      const ext = tipo === 'png' ? 'png' : blob.type.includes('mp4') ? 'mp4' : 'webm'
      setResultado({ blob, nombre: nombreArchivo(`${modelo.nombre}-${proporcion.replace(':', 'x')}`, ext) })
    } catch (e) {
      console.error(e)
      avisar('No se pudo crear el archivo en este dispositivo.', 'error')
    } finally {
      setTrabajo(null)
    }
  }

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="Para redes sociales">
      <div className="space-y-4">
        <Segmentado
          etiqueta="Formato"
          valor={proporcion}
          onCambio={setProporcion}
          opciones={[
            { id: '9:16', texto: '9:16 TikTok' },
            { id: '1:1', texto: '1:1 Insta' },
            { id: '16:9', texto: '16:9 YouTube' },
          ]}
        />
        <fieldset>
          <legend className="mb-2 text-sm text-texto-2">Fondo</legend>
          <div className="flex flex-wrap gap-2">
            {(['degradado', 'oscuro', 'claro', 'transparente', '#'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={fondo === f}
                onClick={() => setFondo(f as FondoCaptura)}
                className={`min-h-11 rounded-xl px-3 text-sm ${fondo === f ? 'borde-neon' : 'cristal text-texto-2'}`}
              >
                {f === '#' ? 'Color' : f === 'transparente' ? 'Transparente (PNG)' : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
            {fondo === '#' && <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Color de fondo" className="h-11 w-14 rounded-xl" />}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <Boton icono="foto" grande disabled={!!trabajo} onClick={() => hacer('png')}>
            Imagen
          </Boton>
          <Boton variante="principal" icono="video" grande disabled={!!trabajo} onClick={() => hacer('video')}>
            Vídeo
          </Boton>
        </div>
        {trabajo && (
          <div className="h-2 overflow-hidden rounded-full bg-panel-fuerte" role="progressbar" aria-valuenow={Math.round(trabajo.p * 100)} aria-label="Creando">
            <div className="barra-brillo h-full" style={{ width: `${Math.max(8, trabajo.p * 100)}%` }} />
          </div>
        )}
        {resultado && (
          <div className="aparecer space-y-3">
            {resultado.blob.type.startsWith('video') ? (
              <video src={url} controls autoPlay loop muted playsInline className="mx-auto max-h-72 rounded-2xl" />
            ) : (
              <img src={url} alt="Vista previa" className="mx-auto max-h-72 rounded-2xl" />
            )}
            <p className="text-center text-xs text-texto-2">{formatoBytes(resultado.blob.size)}</p>
            <div className="grid grid-cols-2 gap-3">
              <Boton icono="descargar" onClick={() => guardarArchivo(resultado.blob, resultado.nombre)}>
                Guardar
              </Boton>
              <Boton
                variante="principal"
                icono="compartir"
                onClick={() => compartirArchivo(resultado.blob, resultado.nombre, `Mira mi modelo 3D «${modelo.nombre}» hecho con IMPRESORA 3D`)}
              >
                Compartir
              </Boton>
            </div>
            <p className="text-center text-xs text-texto-2">Compartir abre WhatsApp, Instagram, TikTok… según las apps que tengas.</p>
          </div>
        )}
      </div>
    </Hoja>
  )
}

// ── Pantalla ────────────────────────────────────────────────

export function DetalleModelo({ id }: { id: string }) {
  const modelo = useLiveQuery(() => db.modelos.get(id), [id])
  const { fondoVisor, giroAuto, set } = useAjustes()
  const [comparar, setComparar] = useState<'no' | 'lado' | 'deslizador'>('no')
  const [corte, setCorte] = useState(50)
  const [hoja, setHoja] = useState<'descargar' | 'redes' | 'renombrar' | 'mover' | 'borrar' | null>(null)
  const [nombre, setNombre] = useState('')
  const urlOriginal = useUrl(modelo?.imagen)

  if (modelo === undefined) return <div className="mx-auto mt-20 size-10 animate-spin rounded-full border-4 border-cian border-t-transparent" aria-label="Cargando" />
  if (!modelo)
    return (
      <div className="cristal mx-auto max-w-md rounded-3xl p-8 text-center">
        <p className="mb-4">Este modelo ya no existe.</p>
        <Boton onClick={() => ir('/biblioteca')}>Volver a la biblioteca</Boton>
      </div>
    )

  const visor = (
    <Suspense fallback={<div className="aspect-square w-full animate-pulse rounded-3xl bg-panel" />}>
      <Visor3D glb={modelo.glb} fondo={fondoVisor} giroAuto={giroAuto} registrar className="h-[min(62dvh,560px)] w-full touch-none lg:h-[640px]" />
    </Suspense>
  )

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-3 flex items-center gap-2">
        <Boton variante="fantasma" icono="atras" aria-label="Volver" onClick={() => (history.length > 1 ? history.back() : ir('/biblioteca'))} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-titulo text-2xl font-bold">{modelo.nombre}</h1>
          <p className="truncate text-sm text-texto-2">
            {modelo.origen === 'foto' ? '📷 Desde foto' : `✍️ «${modelo.prompt}»`} · {new Date(modelo.creado).toLocaleDateString('es-ES')}
          </p>
        </div>
      </header>

      {/* Visor + comparativa */}
      {comparar === 'lado' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-center overflow-hidden rounded-3xl bg-white">
            <img src={urlOriginal} alt="Imagen original" className="max-h-[40dvh] object-contain sm:max-h-[640px]" />
          </div>
          {visor}
        </div>
      ) : (
        <div className="relative">
          {visor}
          {comparar === 'deslizador' && (
            <>
              <img
                src={urlOriginal}
                alt="Imagen original"
                className="pointer-events-none absolute inset-0 h-full w-full rounded-3xl bg-white object-contain"
                style={{ clipPath: `inset(0 ${100 - corte}% 0 0)` }}
              />
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-cian shadow-[0_0_12px_var(--c-cian)]" style={{ left: `${corte}%` }} />
              <input
                type="range"
                min={0}
                max={100}
                value={corte}
                onChange={(e) => setCorte(Number(e.target.value))}
                aria-label="Deslizador de comparación entre la imagen original y el modelo 3D"
                className="absolute inset-x-4 bottom-4 h-11 accent-cian"
              />
            </>
          )}
        </div>
      )}

      {/* Controles del visor */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-2xl p-1 cristal" role="radiogroup" aria-label="Fondo del visor">
          {FONDOS.map((f) => (
            <button key={f.id} role="radio" aria-checked={fondoVisor === f.id} onClick={() => set({ fondoVisor: f.id })} className={`min-h-10 rounded-xl px-3 text-sm ${fondoVisor === f.id ? 'bg-cian/20 text-texto ring-1 ring-cian/50' : 'text-texto-2'}`}>
              {f.texto}
            </button>
          ))}
        </div>
        <Boton variante={giroAuto ? 'principal' : 'secundario'} icono="girar" aria-pressed={giroAuto} onClick={() => set({ giroAuto: !giroAuto })}>
          Girar
        </Boton>
        <Boton
          variante={comparar !== 'no' ? 'principal' : 'secundario'}
          icono="comparar"
          aria-pressed={comparar !== 'no'}
          onClick={() => setComparar(comparar === 'no' ? 'deslizador' : comparar === 'deslizador' ? 'lado' : 'no')}
        >
          {comparar === 'no' ? 'Comparar' : comparar === 'deslizador' ? 'Deslizador' : 'Lado a lado'}
        </Boton>
      </div>
      <p className="mt-2 text-xs text-texto-2">Un dedo: girar · Dos dedos: zoom y mover · «Comparar» alterna deslizador y lado a lado.</p>

      {/* Acciones */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Boton variante="principal" grande icono="descargar" onClick={() => setHoja('descargar')}>
          Descargar
        </Boton>
        <Boton grande icono="compartir" onClick={() => setHoja('redes')}>
          Redes
        </Boton>
        <Boton icono="editar" onClick={() => (setNombre(modelo.nombre), setHoja('renombrar'))}>
          Renombrar
        </Boton>
        <Boton icono="mover" onClick={() => setHoja('mover')}>
          Mover
        </Boton>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-texto-2">
        <span>
          {modelo.servicio ?? ''} · {formatoBytes(modelo.bytes)}
        </span>
        <Boton variante="peligro" icono="borrar" onClick={() => setHoja('borrar')}>
          Borrar
        </Boton>
      </div>

      <HojaDescargar modelo={modelo} abierta={hoja === 'descargar'} onCerrar={() => setHoja(null)} />
      <HojaRedes modelo={modelo} abierta={hoja === 'redes'} onCerrar={() => setHoja(null)} />
      <Hoja abierta={hoja === 'renombrar'} onCerrar={() => setHoja(null)} titulo="Renombrar modelo">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            await renombrarModelo(modelo.id, nombre)
            setHoja(null)
          }}
        >
          <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} aria-label="Nombre" className="cristal min-h-12 w-full rounded-2xl px-4 text-[16px]" />
          <Boton type="submit" variante="principal" className="w-full">
            Guardar
          </Boton>
        </form>
      </Hoja>
      <Hoja abierta={hoja === 'mover'} onCerrar={() => setHoja(null)} titulo="Mover a otra carpeta">
        <SelectorCarpeta
          etiqueta="Carpeta"
          valor={modelo.carpetaId}
          onCambio={async (c) => {
            await moverModelo(modelo.id, c)
            avisar('Modelo movido.', 'exito')
            setHoja(null)
          }}
        />
      </Hoja>
      <Hoja abierta={hoja === 'borrar'} onCerrar={() => setHoja(null)} titulo="¿Borrar este modelo?">
        <p className="mb-4 text-texto-2">Se borrará de este dispositivo{useAjustes.getState().syncActiva ? ' y de la sincronización' : ''}. No se puede deshacer.</p>
        <Boton
          variante="peligro"
          className="w-full"
          icono="borrar"
          onClick={async () => {
            apuntarBorrado(modelo.id)
            await borrarModelo(modelo.id)
            avisar('Modelo borrado.', 'exito')
            ir('/biblioteca')
          }}
        >
          Sí, borrar
        </Boton>
      </Hoja>
    </div>
  )
}
