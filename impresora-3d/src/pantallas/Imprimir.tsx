/**
 * Pantalla «Imprimir»: foto → 3D o texto → imagen → 3D, con la impresora animada,
 * la barra de progreso, la aprobación de la imagen intermedia y los errores amables.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { BarraProgreso } from '../componentes/BarraProgreso'
import { ChipMotor } from '../componentes/ChipMotor'
import { Icono } from '../componentes/Icono'
import { SelectorCarpeta } from '../componentes/SelectorCarpeta'
import { SelectorImagen } from '../componentes/SelectorImagen'
import { Boton, Interruptor, Segmentado, Tarjeta } from '../componentes/ui'
import { useAjustes } from '../lib/ajustes'
import { avisar } from '../lib/avisos'
import { db, ID_CARPETA_DEFECTO, type Estilo } from '../lib/db'
import { iniciarSesionHF, oauthDisponible } from '../lib/hfAuth'
import { urlDeBlob } from '../lib/imagen'
import { pedirPermisoNotificaciones } from '../lib/notificaciones'
import { useEstadoRed } from '../lib/red'
import { ir } from '../lib/ruta'
import { ESTILOS } from '../motor/prompts'
import { aceptarImagen, cancelar, descartar, imprimirFoto, imprimirTexto, regenerarImagen, reintentar, useImpresion } from '../motor/trabajo'

// three.js solo se descarga cuando empieza una impresión (arranque más rápido).
const ImpresoraAnimadaPerezosa = lazy(() => import('../componentes/ImpresoraAnimada').then((m) => ({ default: m.ImpresoraAnimada })))
function ImpresoraAnimada(props: Parameters<typeof ImpresoraAnimadaPerezosa>[0]) {
  return (
    <Suspense fallback={<div className={`animate-pulse rounded-3xl bg-panel ${props.className ?? ''}`} />}>
      <ImpresoraAnimadaPerezosa {...props} />
    </Suspense>
  )
}

function useUrlBlob(b?: Blob | null) {
  const url = useMemo(() => (b ? urlDeBlob(b) : ''), [b])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  return url
}

function AvisoRed() {
  const red = useEstadoRed()
  const { ahorroDatos, set } = useAjustes()
  if (!red.enLinea)
    return (
      <div role="status" className="mb-4 flex items-center gap-3 rounded-2xl border border-error/40 bg-error/10 p-3 text-sm">
        <Icono nombre="wifi" className="size-5 shrink-0 text-error" />
        Sin conexión. Puedes ver tu biblioteca, pero para imprimir hace falta internet.
      </div>
    )
  if ((red.datosMoviles || red.lenta) && !ahorroDatos)
    return (
      <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-cian/40 bg-cian/10 p-3 text-sm">
        <Icono nombre="wifi" className="size-5 shrink-0 text-cian" />
        <span className="flex-1">{red.datosMoviles ? 'Estás usando datos móviles, no wifi.' : 'Tu conexión es lenta.'} ¿Activamos el ahorro de datos?</span>
        <Boton variante="secundario" onClick={() => set({ ahorroDatos: true })}>
          Activar
        </Boton>
      </div>
    )
  return null
}

// ── Formulario: foto ────────────────────────────────────────

function FormularioFoto({ carpetaId, setCarpetaId }: { carpetaId: string; setCarpetaId: (v: string) => void }) {
  const [foto, setFoto] = useState<File | null>(null)
  const [nombre, setNombre] = useState('')
  const { quitarFondo, set } = useAjustes()
  const url = useUrlBlob(foto)
  const red = useEstadoRed()

  if (!foto)
    return (
      <SelectorImagen
        alElegir={(f) => {
          setFoto(f)
          setNombre(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 40) || 'Mi foto')
        }}
      />
    )
  return (
    <div className="aparecer space-y-4">
      <div className="relative overflow-hidden rounded-3xl border border-borde bg-panel">
        <img src={url} alt="Foto elegida" className="mx-auto max-h-[42dvh] w-full object-contain" />
        <Boton variante="secundario" icono="cerrar" className="absolute right-2 top-2 !rounded-full" aria-label="Quitar foto" onClick={() => setFoto(null)} />
      </div>
      <div>
        <label htmlFor="nombre-foto" className="mb-1.5 block text-sm font-medium text-texto-2">
          Nombre del modelo
        </label>
        <input id="nombre-foto" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} className="cristal min-h-12 w-full rounded-2xl px-4 text-[16px]" />
      </div>
      <SelectorCarpeta valor={carpetaId} onCambio={setCarpetaId} />
      <Interruptor
        activo={quitarFondo === 'navegador'}
        onCambio={(v) => set({ quitarFondo: v ? 'navegador' : 'servidor' })}
        etiqueta="Quitar el fondo en mi dispositivo"
        descripcion="Más privado. La primera vez descarga ~45 MB. Si no, lo hace el servidor."
      />
      <p className="flex items-start gap-2 text-sm text-texto-2">
        <Icono nombre="varita" className="mt-0.5 size-4 shrink-0 text-cian" />
        Los colores del modelo salen de tu foto: cuanto más nítida y mejor iluminada, más fieles.
      </p>
      <Boton
        variante="principal"
        grande
        icono="impresora"
        className="w-full"
        disabled={!red.enLinea}
        onClick={() => {
          pedirPermisoNotificaciones()
          imprimirFoto(foto, { nombre: nombre.trim() || 'Mi foto', carpetaId, fondoEnNavegador: quitarFondo === 'navegador' }).catch((e) => avisar(String(e.message ?? e), 'error'))
        }}
      >
        Imprimir en 3D
      </Boton>
    </div>
  )
}

// ── Formulario: texto ───────────────────────────────────────

function FormularioTexto({ carpetaId, setCarpetaId }: { carpetaId: string; setCarpetaId: (v: string) => void }) {
  const [texto, setTexto] = useState(() => new URLSearchParams(location.hash.split('?')[1] ?? '').get('text') ?? '')
  const [estilo, setEstilo] = useState<Estilo>('realista')
  const [colores, setColores] = useState('')
  const red = useEstadoRed()
  const valido = texto.trim().length >= 3
  return (
    <form
      className="aparecer space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valido) return
        pedirPermisoNotificaciones()
        imprimirTexto({ texto, estilo, colores, carpetaId })
      }}
    >
      <div>
        <label htmlFor="texto" className="mb-1.5 block text-sm font-medium text-texto-2">
          Describe lo que quieres imprimir
        </label>
        <textarea
          id="texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder="Ej.: un tractor rojo con ruedas negras"
          className="cristal w-full resize-none rounded-2xl p-4 text-[16px] leading-relaxed placeholder:text-texto-2/70"
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-texto-2">Estilo</legend>
        <div className="flex flex-wrap gap-2">
          {ESTILOS.map((e) => (
            <button
              key={e.id}
              type="button"
              aria-pressed={estilo === e.id}
              onClick={() => setEstilo(e.id)}
              className={`flex min-h-12 items-center gap-2 rounded-2xl px-4 text-sm font-medium transition ${
                estilo === e.id ? 'borde-neon text-texto' : 'cristal text-texto-2'
              }`}
            >
              <span className="text-lg" aria-hidden>
                {e.emoji}
              </span>
              {e.nombre}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="colores" className="mb-1.5 block text-sm font-medium text-texto-2">
          Colores deseados <span className="font-normal">(opcional)</span>
        </label>
        <input
          id="colores"
          value={colores}
          onChange={(e) => setColores(e.target.value)}
          maxLength={100}
          placeholder="Ej.: rojo brillante y negro"
          className="cristal min-h-12 w-full rounded-2xl px-4 text-[16px] placeholder:text-texto-2/70"
        />
      </div>
      <SelectorCarpeta valor={carpetaId} onCambio={setCarpetaId} />
      <Boton type="submit" variante="principal" grande icono="varita" className="w-full" disabled={!valido || !red.enLinea}>
        Crear imagen
      </Boton>
      <p className="text-center text-sm text-texto-2">Primero verás una imagen. Si te gusta, la convertimos en 3D.</p>
    </form>
  )
}

// ── Estados del trabajo ─────────────────────────────────────

function Imprimiendo() {
  const { trabajo, progreso } = useImpresion()
  const p = progreso ?? { etapa: 'conectando' as const, porcentaje: 1 }
  const esImagen = trabajo?.estado === 'imagen'
  return (
    <div className="aparecer space-y-4">
      <ImpresoraAnimada progreso={p.porcentaje / 100} className="aspect-square w-full sm:aspect-[4/3]" />
      <Tarjeta>
        <BarraProgreso progreso={p} soloImagen={esImagen} />
        <p className="mt-4 text-sm text-texto-2">
          {esImagen
            ? 'Estamos dibujando tu idea. Tarda unos segundos.'
            : 'Suele tardar entre 1 y 3 minutos. Puedes bloquear el móvil: te avisaremos cuando esté listo.'}
        </p>
        <Boton variante="fantasma" icono="cerrar" className="mt-2 w-full" onClick={cancelar}>
          Cancelar
        </Boton>
      </Tarjeta>
    </div>
  )
}

function AprobarImagen() {
  const trabajo = useImpresion((s) => s.trabajo)!
  const url = useUrlBlob(trabajo.imagen)
  return (
    <div className="aparecer space-y-4">
      <Tarjeta>
        <p className="mb-1 text-sm text-texto-2">Tu idea</p>
        <p className="mb-3 font-medium">
          «{trabajo.prompt}»{trabajo.colores ? ` · colores: ${trabajo.colores}` : ''}
        </p>
        <img src={url} alt={`Imagen generada: ${trabajo.prompt}`} className="mx-auto w-full max-w-md rounded-2xl bg-white object-contain" />
      </Tarjeta>
      <p className="text-center font-titulo text-lg font-semibold">¿Te gusta? La convertimos en un modelo 3D.</p>
      <div className="grid grid-cols-2 gap-3">
        <Boton icono="girar" grande onClick={regenerarImagen}>
          Otra imagen
        </Boton>
        <Boton variante="principal" icono="impresora" grande onClick={aceptarImagen}>
          Crear 3D
        </Boton>
      </div>
      <Boton variante="fantasma" className="w-full" onClick={cancelar}>
        Cancelar
      </Boton>
    </div>
  )
}

function ErrorImpresion() {
  const error = useImpresion((s) => s.error)!
  const hfUsuario = useAjustes((s) => s.hfUsuario)
  return (
    <Tarjeta className="aparecer text-center">
      <div className="mx-auto mb-3 grid size-16 place-items-center rounded-full bg-error/15 text-3xl" aria-hidden>
        {error.tipo === 'cupo' ? '⏳' : error.tipo === 'red' ? '📶' : '🙈'}
      </div>
      <h2 className="mb-2 font-titulo text-xl font-bold">{error.tipo === 'cupo' ? 'Cupo gratuito agotado' : '¡Vaya! Algo no ha ido bien'}</h2>
      <p className="mb-5 text-texto-2" role="alert">
        {error.message}
      </p>
      {error.detalle && (
        <details className="mb-4 text-left text-xs text-texto-2">
          <summary className="min-h-11 cursor-pointer py-2 text-center">Detalles técnicos</summary>
          <p className="break-words rounded-xl bg-panel p-3">{error.detalle}</p>
        </details>
      )}
      <div className="flex flex-col gap-3">
        <Boton variante="principal" grande icono="girar" onClick={reintentar}>
          Reintentar
        </Boton>
        {error.tipo === 'cupo' && !hfUsuario && oauthDisponible() && (
          <Boton icono="usuario" onClick={iniciarSesionHF}>
            Iniciar sesión en Hugging Face
          </Boton>
        )}
        {(error.tipo === 'cupo' || error.tipo === 'clave') && (
          <Boton icono="servidor" onClick={() => ir('/ajustes')}>
            Configurar mi servidor
          </Boton>
        )}
        <Boton variante="fantasma" onClick={descartar}>
          Empezar de nuevo
        </Boton>
      </div>
    </Tarjeta>
  )
}

function Terminado() {
  const trabajo = useImpresion((s) => s.trabajo)!
  const modelo = useLiveQuery(() => (trabajo.modeloId ? db.modelos.get(trabajo.modeloId) : undefined), [trabajo.modeloId])
  const [revelado, setRevelado] = useState(false)
  // Por si el móvil va muy lento: el resultado se muestra como mucho a los 5 s.
  useEffect(() => {
    const t = setTimeout(() => setRevelado(true), 5000)
    return () => clearTimeout(t)
  }, [])
  if (!modelo) return null
  return (
    <div className="aparecer space-y-4">
      <ImpresoraAnimada progreso={1} glbFinal={modelo.glb} alTerminar={() => setRevelado(true)} className="aspect-square w-full sm:aspect-[4/3]" />
      <div className={`space-y-3 text-center transition-opacity duration-500 ${revelado ? 'opacity-100' : 'opacity-0'}`}>
        <p className="font-titulo text-2xl font-bold">
          <span className="texto-neon">¡Listo!</span> 🎉
        </p>
        <p className="text-texto-2">«{modelo.nombre}» se ha guardado en tu biblioteca.</p>
        <div className="grid grid-cols-2 gap-3">
          <Boton icono="mas" grande onClick={descartar}>
            Otro
          </Boton>
          <Boton
            variante="principal"
            icono="foto"
            grande
            onClick={() => {
              descartar()
              ir(`/modelo/${modelo.id}`)
            }}
          >
            Ver modelo
          </Boton>
        </div>
      </div>
    </div>
  )
}

// ── Pantalla ────────────────────────────────────────────────

export function Imprimir() {
  const { trabajo, error } = useImpresion()
  const [modo, setModo] = useState<'foto' | 'texto'>(() => (location.hash.includes('text=') ? 'texto' : 'foto'))
  const [carpetaId, setCarpetaId] = useState(ID_CARPETA_DEFECTO)

  let contenido
  if (error) contenido = <ErrorImpresion />
  else if (trabajo?.estado === 'aprobar') contenido = <AprobarImagen />
  else if (trabajo?.estado === 'listo') contenido = <Terminado />
  else if (trabajo) contenido = <Imprimiendo />
  else
    contenido = (
      <div className="space-y-4">
        <Segmentado
          etiqueta="Qué quieres convertir en 3D"
          valor={modo}
          onCambio={setModo}
          opciones={[
            { id: 'foto', texto: 'Desde foto', icono: 'camara' },
            { id: 'texto', texto: 'Desde texto', icono: 'texto' },
          ]}
        />
        {modo === 'foto' ? <FormularioFoto carpetaId={carpetaId} setCarpetaId={setCarpetaId} /> : <FormularioTexto carpetaId={carpetaId} setCarpetaId={setCarpetaId} />}
      </div>
    )

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-4 flex flex-col gap-3">
        <h1 className="font-titulo text-[32px] font-bold leading-none tracking-tight sm:text-5xl">
          <span className="texto-neon">IMPRESORA</span> 3D
        </h1>
        <p className="text-texto-2">De foto o texto a modelo 3D a todo color. Gratis.</p>
        <div>
          <ChipMotor />
        </div>
      </header>
      <AvisoRed />
      {contenido}
    </div>
  )
}
