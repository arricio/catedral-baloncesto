/**
 * Ficha de un modelo: visor 3D, comparativa con la imagen original,
 * «Enviar a un amigo» (WhatsApp), «Guardar en el móvil» y eliminar.
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
import { CONFIG } from '../lib/config'
import { enlaceWhatsApp } from '../lib/compartirApp'
import { avisar } from '../lib/avisos'
import { borrarModelo, db, moverModelo, nombreUnico, nuevoId, renombrarModelo, tipoDeModelo, type Modelo } from '../lib/db'
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

// ── Crear foto o vídeo del modelo (compartido por las dos hojas) ──

type Medio = { blob: Blob; nombre: string }

function useCrearMedio(modelo: Modelo) {
  const escena = useEscenaVisor((s) => s.escena)
  const [progreso, setProgreso] = useState<number | null>(null)
  const crear = async (tipo: 'foto' | 'video', proporcion: Proporcion, fondo: FondoCaptura): Promise<Medio | null> => {
    if (!escena) {
      avisar('Espera un momento a que cargue el modelo.', 'info')
      return null
    }
    setProgreso(0)
    try {
      const pequeño = ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 3
      const blob =
        tipo === 'foto'
          ? await capturarPNG(escena, proporcion, fondo, pequeño ? 1080 : 2048)
          : await grabarVideo(escena, { proporcion, fondo, ladoCorto: 720, alProgresar: setProgreso })
      const ext = tipo === 'foto' ? 'png' : blob.type.includes('mp4') ? 'mp4' : 'webm'
      return { blob, nombre: nombreArchivo(`${modelo.nombre}-${tipo === 'foto' ? 'foto' : 'video'}`, ext) }
    } catch (e) {
      console.error(e)
      avisar('No se pudo crear el archivo en este móvil. Prueba con la foto.', 'error')
      return null
    } finally {
      setProgreso(null)
    }
  }
  return { crear, progreso }
}

function BarraMedio({ progreso, texto }: { progreso: number | null; texto: string }) {
  if (progreso === null) return null
  return (
    <div className="space-y-1" role="status">
      <p className="text-sm text-texto-2">{texto}</p>
      <div className="h-2.5 overflow-hidden rounded-full bg-panel-fuerte" role="progressbar" aria-valuenow={Math.round(progreso * 100)} aria-label={texto}>
        <div className="barra-brillo h-full" style={{ width: `${Math.max(8, progreso * 100)}%` }} />
      </div>
    </div>
  )
}

function Vista({ medio }: { medio: Medio }) {
  const url = useUrl(medio.blob)
  return medio.blob.type.startsWith('video') ? (
    <video src={url} controls autoPlay loop muted playsInline className="mx-auto max-h-64 rounded-2xl" />
  ) : (
    <img src={url} alt="Vista previa" className="mx-auto max-h-64 rounded-2xl" />
  )
}

/** Fila grande y fácil de pulsar. */
function Opcion({ emoji, titulo, detalle, onClick, ocupado, activo }: { emoji: string; titulo: string; detalle: string; onClick: () => void; ocupado?: boolean; activo?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={ocupado}
      aria-pressed={activo}
      className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left disabled:opacity-60 ${activo ? 'borde-neon' : 'cristal hover:bg-panel-fuerte'}`}
    >
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <span className="flex-1">
        <span className="block text-[17px] font-semibold">{titulo}</span>
        <span className="block text-sm text-texto-2">{detalle}</span>
      </span>
      {ocupado && <span className="size-5 animate-spin rounded-full border-2 border-cian border-t-transparent" />}
    </button>
  )
}

const TEXTO_ENVIO = (nombre: string) => `Mira mi modelo 3D «${nombre}» 🖨️✨ Hecho con IMPRESORA 3D: ${CONFIG.urlApp}`

// ── 📲 Enviar a un amigo ────────────────────────────────────

function HojaEnviar({ modelo, abierta, onCerrar }: { modelo: Modelo; abierta: boolean; onCerrar: () => void }) {
  const [tipo, setTipo] = useState<'video' | 'foto' | '3d'>('video')
  const [medio, setMedio] = useState<Medio | null>(null)
  const [archivo3DGuardado, setArchivo3DGuardado] = useState(false)
  const { crear, progreso } = useCrearMedio(modelo)

  const elegir = (t: typeof tipo) => {
    setTipo(t)
    setMedio(null)
    setArchivo3DGuardado(false)
  }
  const preparar = async () => setMedio(await crear(tipo === 'foto' ? 'foto' : 'video', tipo === 'foto' ? '1:1' : '9:16', 'degradado'))

  const enviar = async (blob: Blob, nombre: string) => {
    const r = await compartirArchivo(blob, nombre, TEXTO_ENVIO(modelo.nombre))
    if (r === 'descargado') avisar('Tu móvil no deja enviarlo directo: se ha guardado en Descargas. En WhatsApp pulsa 📎 y elígelo.', 'info', 9000)
  }

  const enviar3D = async () => {
    const nombre = nombreArchivo(modelo.nombre, 'glb')
    const blob = new Blob([modelo.glb], { type: 'model/gltf-binary' })
    const r = await compartirArchivo(blob, nombre, TEXTO_ENVIO(modelo.nombre))
    if (r === 'descargado') setArchivo3DGuardado(true)
  }

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="📲 Enviar a un amigo">
      <div className="space-y-3">
        <p className="text-texto-2">¿Qué le quieres enviar?</p>
        <Opcion emoji="🎬" titulo="Vídeo girando" detalle="Recomendado: se ve directamente en WhatsApp" activo={tipo === 'video'} onClick={() => elegir('video')} />
        <Opcion emoji="🖼️" titulo="Foto del modelo" detalle="Una imagen bonita del modelo" activo={tipo === 'foto'} onClick={() => elegir('foto')} />
        <Opcion emoji="🧊" titulo="Archivo 3D" detalle="Para girarlo en su móvil o usarlo en un juego" activo={tipo === '3d'} onClick={() => elegir('3d')} />

        {tipo !== '3d' && !medio && (
          <>
            <Boton variante="principal" grande className="w-full" disabled={progreso !== null} onClick={preparar}>
              {tipo === 'video' ? 'Preparar el vídeo' : 'Preparar la foto'}
            </Boton>
            <BarraMedio progreso={progreso} texto={tipo === 'video' ? 'Grabando el vídeo… (unos segundos)' : 'Haciendo la foto…'} />
          </>
        )}
        {tipo !== '3d' && medio && (
          <div className="aparecer space-y-3">
            <Vista medio={medio} />
            <button type="button" onClick={() => enviar(medio.blob, medio.nombre)} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-lg font-bold text-[#06260f]">
              <Icono nombre="whatsapp" className="size-6" /> Enviar por WhatsApp
            </button>
            <p className="text-center text-sm text-texto-2">Se abrirá una lista: elige <b className="text-texto">WhatsApp</b> y después a tu amigo.</p>
          </div>
        )}
        {tipo === '3d' && (
          <div className="aparecer space-y-3">
            <button type="button" onClick={enviar3D} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-lg font-bold text-[#06260f]">
              <Icono nombre="whatsapp" className="size-6" /> Enviar archivo 3D
            </button>
            {archivo3DGuardado && (
              <ol className="list-decimal space-y-1 rounded-2xl bg-panel p-4 pl-8 text-[15px]" role="status">
                <li>
                  Se ha guardado <b>{nombreArchivo(modelo.nombre, 'glb')}</b> en <b>Descargas</b>.
                </li>
                <li>Abre WhatsApp y el chat de tu amigo.</li>
                <li>
                  Pulsa el clip <b>📎</b> → <b>Documento</b> y elige ese archivo.
                </li>
                <li>
                  Tu amigo lo abre en IMPRESORA 3D: <b>Biblioteca → «Abrir archivo 3D»</b>.
                </li>
              </ol>
            )}
          </div>
        )}
        <a href={enlaceWhatsApp()} target="_blank" rel="noreferrer" className="block min-h-11 py-2 text-center text-sm text-texto-2 underline">
          Enviarle también el enlace de la app
        </a>
      </div>
    </Hoja>
  )
}

// ── 📥 Guardar en el móvil ──────────────────────────────────

function HojaGuardar({ modelo, abierta, onCerrar }: { modelo: Modelo; abierta: boolean; onCerrar: () => void }) {
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [altura, setAltura] = useState(80)
  const [colores, setColores] = useState(6)
  const [proporcion, setProporcion] = useState<Proporcion>('9:16')
  const [fondo, setFondo] = useState<FondoCaptura>('degradado')
  const { crear, progreso } = useCrearMedio(modelo)
  const enGaleria = esIOS ? 'Elige «Guardar imagen/vídeo» para que vaya a Fotos.' : 'Guardado ✅ Lo verás en Galería y Google Fotos (carpeta «Download»).'
  const enDescargas = esIOS ? 'Elige «Guardar en Archivos».' : 'Guardado ✅ en la carpeta «Descargas» del móvil.'

  const guardarMedio = async (tipo: 'foto' | 'video') => {
    setOcupado(tipo)
    const m = await crear(tipo, tipo === 'foto' ? (proporcion === '9:16' ? '1:1' : proporcion) : proporcion, fondo)
    setOcupado(null)
    if (!m) return
    await guardarArchivo(m.blob, m.nombre)
    avisar(enGaleria, 'exito', 7000)
  }
  const guardarOriginal = async () => {
    const ext = modelo.imagen.type.includes('png') ? 'png' : 'jpg'
    await guardarArchivo(modelo.imagen, nombreArchivo(`${modelo.nombre}-original`, ext))
    avisar(enGaleria, 'exito', 7000)
  }
  const guardar3D = async (f: Formato) => {
    setOcupado(f)
    try {
      const def = FORMATOS.find((x) => x.id === f)!
      const blob = await exportarModelo(modelo.glb, f, modelo.nombre, { alturaMM: altura, colores3MF: colores })
      await guardarArchivo(blob, nombreArchivo(`${modelo.nombre}${f === 'gltf' ? '-gltf' : f === 'obj' ? '-obj' : ''}`, def.ext))
      avisar(enDescargas, 'exito', 7000)
    } catch (e) {
      console.error(e)
      avisar('No se pudo convertir el modelo. Prueba con el formato GLB.', 'error')
    } finally {
      setOcupado(null)
    }
  }
  const fila3D = (f: Formato, emoji: string, titulo: string, detalle: string) => (
    <Opcion key={f} emoji={emoji} titulo={titulo} detalle={detalle} ocupado={ocupado === f} onClick={() => guardar3D(f)} />
  )

  return (
    <Hoja abierta={abierta} onCerrar={onCerrar} titulo="📥 Guardar en el móvil">
      <div className="space-y-5">
        <section className="space-y-2">
          <h3 className="font-titulo text-lg font-bold">Para Galería y Google Fotos</h3>
          <Opcion emoji="🖼️" titulo="Foto del modelo" detalle="Imagen PNG en alta calidad" ocupado={ocupado === 'foto'} onClick={() => guardarMedio('foto')} />
          <Opcion emoji="🎬" titulo="Vídeo del modelo girando" detalle="Vídeo MP4 de 6 segundos" ocupado={ocupado === 'video'} onClick={() => guardarMedio('video')} />
          <BarraMedio progreso={progreso} texto="Creando… (unos segundos)" />
          <Opcion emoji="📷" titulo={modelo.origen === 'texto' ? 'Imagen que dibujó la IA' : 'Foto original'} detalle="La imagen de la que salió el modelo" onClick={guardarOriginal} />
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 text-texto-2">Opciones de foto y vídeo (formato y fondo)</summary>
            <div className="space-y-3 pt-1">
              <Segmentado
                etiqueta="Formato"
                valor={proporcion}
                onCambio={setProporcion}
                opciones={[
                  { id: '9:16', texto: 'Vertical' },
                  { id: '1:1', texto: 'Cuadrado' },
                  { id: '16:9', texto: 'Horizontal' },
                ]}
              />
              <div className="flex flex-wrap gap-2">
                {(['degradado', 'oscuro', 'claro', 'transparente'] as const).map((f) => (
                  <button key={f} type="button" aria-pressed={fondo === f} onClick={() => setFondo(f)} className={`min-h-11 rounded-xl px-3 ${fondo === f ? 'borde-neon' : 'cristal text-texto-2'}`}>
                    {f === 'transparente' ? 'Sin fondo (solo foto)' : f[0].toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </details>
        </section>

        <section className="space-y-2">
          <h3 className="font-titulo text-lg font-bold">Para crear juegos y animaciones</h3>
          <p className="text-sm text-texto-2">Se guardan en «Descargas». No salen en la Galería porque no son fotos.</p>
          {fila3D('glb', '🎮', 'Modelo 3D (GLB)', 'Unity, Godot, Roblox, Blender y webs. El más útil.')}
          {fila3D('obj', '🧩', 'Modelo 3D (OBJ con texturas)', 'Blender, Maya y programas antiguos (ZIP)')}
          {fila3D('gltf', '📦', 'Modelo 3D (glTF)', 'Formato abierto editable (ZIP)')}
        </section>

        <section className="space-y-2">
          <h3 className="font-titulo text-lg font-bold">Para impresora 3D</h3>
          {fila3D('stl', '🖨️', 'STL', 'Para imprimir en un solo color')}
          {fila3D('3mf', '🌈', '3MF a color', 'Para impresoras multicolor (Bambu, Prusa)')}
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 text-texto-2">Ajustes de impresión</summary>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <label className="text-texto-2">
                Altura (mm)
                <input type="number" min={10} max={300} value={altura} onChange={(e) => setAltura(Math.max(10, Math.min(300, Number(e.target.value) || 80)))} className="cristal mt-1 min-h-11 w-full rounded-xl px-3 text-[16px] text-texto" />
              </label>
              <label className="text-texto-2">
                Colores (3MF)
                <input type="number" min={1} max={16} value={colores} onChange={(e) => setColores(Math.max(1, Math.min(16, Number(e.target.value) || 6)))} className="cristal mt-1 min-h-11 w-full rounded-xl px-3 text-[16px] text-texto" />
              </label>
            </div>
          </details>
        </section>
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
  const [hoja, setHoja] = useState<'guardar' | 'enviar' | 'renombrar' | 'mover' | 'borrar' | null>(null)
  const [nombre, setNombre] = useState('')
  const [mejorando, setMejorando] = useState(false)
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
      <Visor3D glb={modelo.glb} fondo={fondoVisor} giroAuto={giroAuto} registrar className="h-[min(52dvh,560px)] w-full touch-none lg:h-[640px]" />
    </Suspense>
  )

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-3 flex items-center gap-2">
        <Boton variante="fantasma" icono="atras" aria-label="Volver" onClick={() => (history.length > 1 ? history.back() : ir('/biblioteca'))} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-titulo text-2xl font-bold">{modelo.nombre}</h1>
          <p className="truncate text-sm text-texto-2">
            {modelo.origen === 'texto' ? `✍️ «${modelo.prompt}»` : tipoDeModelo(modelo)} · {new Date(modelo.creado).toLocaleDateString('es-ES')}
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

      {modelo.origen !== 'archivo' && !modelo.servicio?.includes('relieve') && (
        <Boton
          grande
          className="mt-3 w-full !bg-[#ffd21e] !font-bold !text-[#1a1300]"
          disabled={mejorando}
          onClick={async () => {
            setMejorando(true)
            avisar('Poniendo tu foto por delante… (unos segundos)', 'info')
            try {
              const { proyectarFotoDelante } = await import('../motor/proyectar')
              const glb = await proyectarFotoDelante(modelo.glb, modelo.imagen)
              const { renderizarMiniatura } = await import('../lib/escena')
              const { crearMiniatura } = await import('../lib/imagen')
              const miniatura = await crearMiniatura(await renderizarMiniatura(glb))
              const ahora = Date.now()
              const id = nuevoId()
              await db.modelos.add({ ...modelo, id, nombre: await nombreUnico(`${modelo.nombre} con mi foto`), glb, miniatura, creado: ahora, actualizado: ahora, bytes: glb.size + modelo.imagen.size + miniatura.size, sincronizado: undefined })
              avisar('¡Hecho! Se ha guardado como un modelo nuevo ✨', 'exito')
              ir(`/modelo/${id}`)
            } catch (e) {
              console.error(e)
              avisar('No se pudo poner la foto en este modelo.', 'error')
            } finally {
              setMejorando(false)
            }
          }}
        >
          {mejorando ? 'Poniendo tu foto…' : '✨ Poner mi foto por delante'}
        </Boton>
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
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Boton variante="principal" grande icono="whatsapp" onClick={() => setHoja('enviar')}>
          Enviar a un amigo
        </Boton>
        <Boton grande icono="descargar" onClick={() => setHoja('guardar')}>
          Guardar en el móvil
        </Boton>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Boton icono="editar" onClick={() => (setNombre(modelo.nombre), setHoja('renombrar'))}>
          Nombre
        </Boton>
        <Boton icono="mover" onClick={() => setHoja('mover')}>
          Mover
        </Boton>
        <Boton variante="peligro" icono="borrar" onClick={() => setHoja('borrar')}>
          Eliminar
        </Boton>
      </div>
      <p className="mt-4 text-center text-sm text-texto-2">
        ✅ Guardado en tu Biblioteca · {modelo.servicio ?? ''} · {formatoBytes(modelo.bytes)}
      </p>

      <HojaEnviar modelo={modelo} abierta={hoja === 'enviar'} onCerrar={() => setHoja(null)} />
      <HojaGuardar modelo={modelo} abierta={hoja === 'guardar'} onCerrar={() => setHoja(null)} />
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
      <Hoja abierta={hoja === 'borrar'} onCerrar={() => setHoja(null)} titulo="¿Eliminar este modelo?">
        <p className="mb-4 text-texto-2">Se borrará de este dispositivo{useAjustes.getState().syncActiva ? ' y de la sincronización' : ''}. No se puede deshacer.</p>
        <Boton
          variante="peligro"
          className="w-full"
          icono="borrar"
          onClick={async () => {
            apuntarBorrado(modelo.id)
            await borrarModelo(modelo.id)
            avisar('Modelo eliminado.', 'exito')
            ir('/biblioteca')
          }}
        >
          Sí, eliminar
        </Boton>
      </Hoja>
    </div>
  )
}
