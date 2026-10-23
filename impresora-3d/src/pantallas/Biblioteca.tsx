/**
 * Biblioteca: carpetas, búsqueda y filtros por carpeta, fecha y tipo.
 * Todo sale de IndexedDB, así que funciona sin conexión.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icono } from '../componentes/Icono'
import { Boton, Hoja, formatoBytes } from '../componentes/ui'
import { guardarArchivo } from '../exportar/descargar'
import { zipCarpeta } from '../exportar/zip'
import { avisar } from '../lib/avisos'
import { borrarCarpeta, borrarModelo, crearCarpeta, db, espacioUsado, ID_CARPETA_DEFECTO, importarArchivo3D, renombrarCarpeta, tipoDeModelo, type Modelo } from '../lib/db'
import { ir } from '../lib/ruta'
import { apuntarBorrado } from '../sync/supabase'

type FiltroFecha = 'todas' | 'hoy' | 'semana' | 'mes'
type FiltroTipo = 'todos' | 'foto' | 'texto' | 'archivo'

const LIMITES: Record<FiltroFecha, number> = { todas: 0, hoy: 1, semana: 7, mes: 31 }

function Miniatura({ m }: { m: Modelo }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(m.miniatura)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [m.miniatura])
  return url ? <img src={url} alt="" loading="lazy" className="aspect-square w-full object-cover" /> : <div className="aspect-square w-full bg-panel" />
}

const fecha = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

export function Biblioteca({ carpetaInicial }: { carpetaInicial?: string }) {
  const [carpeta, setCarpeta] = useState<string>(carpetaInicial ?? 'todas')
  const [busqueda, setBusqueda] = useState('')
  const [tipo, setTipo] = useState<FiltroTipo>('todos')
  const [fechaF, setFechaF] = useState<FiltroFecha>('todas')
  const [hoja, setHoja] = useState<'nueva' | 'renombrar' | 'borrar' | null>(null)
  const [nombreCarpeta, setNombreCarpeta] = useState('')
  const [aEliminar, setAEliminar] = useState<Modelo | null>(null)
  const archivo3D = useRef<HTMLInputElement>(null)

  const carpetas = useLiveQuery(() => db.carpetas.orderBy('creado').toArray(), []) ?? []
  const modelos = useLiveQuery(() => db.modelos.orderBy('creado').reverse().toArray(), [])
  const espacio = useLiveQuery(() => espacioUsado(), [modelos?.length])
  const actual = carpetas.find((c) => c.id === carpeta)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const desde = LIMITES[fechaF] ? Date.now() - LIMITES[fechaF] * 86_400_000 : 0
    return (modelos ?? []).filter(
      (m) =>
        (carpeta === 'todas' || m.carpetaId === carpeta) &&
        (tipo === 'todos' || m.origen === tipo) &&
        m.creado >= desde &&
        (!q || m.nombre.toLowerCase().includes(q) || m.prompt?.toLowerCase().includes(q)),
    )
  }, [modelos, carpeta, tipo, fechaF, busqueda])

  const cuenta = (id: string) => modelos?.filter((m) => m.carpetaId === id).length ?? 0

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-titulo text-[28px] font-bold leading-tight sm:text-4xl">Biblioteca</h1>
          <p className="text-texto-2">
            {modelos?.length ?? 0} {modelos?.length === 1 ? 'modelo' : 'modelos'} · {carpetas.length} {carpetas.length === 1 ? 'carpeta' : 'carpetas'}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Boton icono="instalar" onClick={() => archivo3D.current?.click()}>
            Abrir archivo 3D
          </Boton>
          <Boton icono="mas" onClick={() => (setNombreCarpeta(''), setHoja('nueva'))}>
            Carpeta
          </Boton>
        </div>
        <input
          ref={archivo3D}
          type="file"
          accept=".glb,model/gltf-binary,application/octet-stream"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            try {
              const id = await importarArchivo3D(f, carpeta !== 'todas' ? carpeta : undefined)
              avisar('Modelo 3D añadido a tu Biblioteca ✅', 'exito')
              ir(`/modelo/${id}`)
            } catch (err) {
              avisar((err as Error).message, 'error', 7000)
            }
          }}
        />
      </header>

      {/* Carpetas */}
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Carpetas">
        {[{ id: 'todas', nombre: 'Todas' }, ...carpetas].map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={carpeta === c.id}
            onClick={() => setCarpeta(c.id)}
            className={`flex min-h-11 shrink-0 items-center gap-2 rounded-2xl px-4 text-sm font-medium ${carpeta === c.id ? 'borde-neon text-texto' : 'cristal text-texto-2'}`}
          >
            {c.id === 'todas' ? '🗂️' : '📁'} {c.nombre}
            <span className="rounded-full bg-panel-fuerte px-2 text-xs">{c.id === 'todas' ? (modelos?.length ?? 0) : cuenta(c.id)}</span>
          </button>
        ))}
      </div>

      {actual && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Boton variante="fantasma" icono="editar" onClick={() => (setNombreCarpeta(actual.nombre), setHoja('renombrar'))}>
            Renombrar
          </Boton>
          <Boton
            variante="fantasma"
            icono="zip"
            disabled={!cuenta(actual.id)}
            onClick={async () => {
              avisar('Preparando el ZIP…')
              const { blob, nombre } = await zipCarpeta(actual.id)
              await guardarArchivo(blob, nombre)
            }}
          >
            Descargar ZIP
          </Boton>
          {actual.id !== ID_CARPETA_DEFECTO && (
            <Boton variante="fantasma" icono="borrar" onClick={() => setHoja('borrar')}>
              Borrar
            </Boton>
          )}
        </div>
      )}

      {/* Búsqueda y filtros */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <label className="cristal col-span-2 flex min-h-12 items-center gap-2 rounded-2xl px-4 sm:col-span-1">
          <Icono nombre="buscar" className="size-5 text-texto-2" />
          <span className="sr-only">Buscar</span>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o texto" className="w-full bg-transparent text-[16px] outline-none placeholder:text-texto-2/70" />
        </label>
        <select aria-label="Filtrar por tipo" value={tipo} onChange={(e) => setTipo(e.target.value as FiltroTipo)} className="cristal min-h-12 rounded-2xl px-3 text-[15px]">
          <option value="todos" className="bg-fondo-2">Todos los tipos</option>
          <option value="foto" className="bg-fondo-2">📷 Desde foto</option>
          <option value="texto" className="bg-fondo-2">✍️ Desde texto</option>
          <option value="archivo" className="bg-fondo-2">📦 Archivos recibidos</option>
        </select>
        <select aria-label="Filtrar por fecha" value={fechaF} onChange={(e) => setFechaF(e.target.value as FiltroFecha)} className="cristal min-h-12 rounded-2xl px-3 text-[15px]">
          <option value="todas" className="bg-fondo-2">Cualquier fecha</option>
          <option value="hoy" className="bg-fondo-2">Hoy</option>
          <option value="semana" className="bg-fondo-2">Última semana</option>
          <option value="mes" className="bg-fondo-2">Último mes</option>
        </select>
      </div>

      {/* Rejilla */}
      {modelos && filtrados.length === 0 ? (
        <div className="cristal rounded-3xl p-8 text-center">
          <p className="mb-2 text-4xl" aria-hidden>
            🖨️
          </p>
          <p className="mb-4 text-texto-2">{modelos.length ? 'No hay modelos con esos filtros.' : 'Todavía no has impreso nada. ¡Empieza ahora!'}</p>
          {!modelos.length && (
            <Boton variante="principal" icono="impresora" onClick={() => ir('/imprimir')}>
              Imprimir mi primer modelo
            </Boton>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtrados.map((m) => (
            <li key={m.id} className="relative">
              <a href={`#/modelo/${m.id}`} className="cristal group block overflow-hidden rounded-3xl transition hover:-translate-y-0.5 hover:shadow-[var(--sombra-neon)]">
                <div className="relative">
                  <Miniatura m={m} />
                  <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs text-white backdrop-blur">
                    {tipoDeModelo(m)}
                  </span>
                </div>
                <div className="p-3 pr-14">
                  <p className="truncate font-medium">{m.nombre}</p>
                  <p className="text-xs text-texto-2">{fecha(m.creado)}</p>
                </div>
              </a>
              <button
                type="button"
                onClick={() => setAEliminar(m)}
                aria-label={`Eliminar ${m.nombre}`}
                className="absolute bottom-2 right-2 grid size-11 place-items-center rounded-2xl text-texto-2 hover:bg-error/15 hover:text-error"
              >
                <Icono nombre="borrar" className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {espacio && (
        <p className="mt-6 text-center text-sm text-texto-2">
          Espacio usado en este dispositivo: {formatoBytes(espacio.usado)}
          {espacio.disponible ? ` de ${formatoBytes(espacio.disponible)} disponibles` : ''}
        </p>
      )}

      {/* Hojas de carpetas */}
      <Hoja abierta={hoja === 'nueva' || hoja === 'renombrar'} onCerrar={() => setHoja(null)} titulo={hoja === 'nueva' ? 'Nueva carpeta' : 'Renombrar carpeta'}>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!nombreCarpeta.trim()) return
            if (hoja === 'nueva') setCarpeta(await crearCarpeta(nombreCarpeta))
            else if (actual) await renombrarCarpeta(actual.id, nombreCarpeta)
            setHoja(null)
          }}
          className="space-y-4"
        >
          <input autoFocus value={nombreCarpeta} onChange={(e) => setNombreCarpeta(e.target.value)} maxLength={40} placeholder="Ej.: Juguetes, Proyecto Blender…" aria-label="Nombre de la carpeta" className="cristal min-h-12 w-full rounded-2xl px-4 text-[16px]" />
          <Boton type="submit" variante="principal" className="w-full" disabled={!nombreCarpeta.trim()}>
            Guardar
          </Boton>
        </form>
      </Hoja>
      <Hoja abierta={hoja === 'borrar'} onCerrar={() => setHoja(null)} titulo={`¿Borrar «${actual?.nombre ?? ''}»?`}>
        <p className="mb-4 text-texto-2">Elige qué hacer con sus {actual ? cuenta(actual.id) : 0} modelos.</p>
        <div className="flex flex-col gap-3">
          <Boton
            onClick={async () => {
              await borrarCarpeta(actual!.id, false)
              setCarpeta('todas')
              setHoja(null)
              avisar('Carpeta borrada. Sus modelos están en «Mis impresiones».', 'exito')
            }}
          >
            Borrar carpeta y mover modelos a «Mis impresiones»
          </Boton>
          <Boton
            variante="peligro"
            onClick={async () => {
              ;(modelos ?? []).filter((m) => m.carpetaId === actual!.id).forEach((m) => apuntarBorrado(m.id))
              await borrarCarpeta(actual!.id, true)
              setCarpeta('todas')
              setHoja(null)
              avisar('Carpeta y modelos borrados.', 'exito')
            }}
          >
            Borrar carpeta y sus modelos
          </Boton>
        </div>
      </Hoja>
      <Hoja abierta={!!aEliminar} onCerrar={() => setAEliminar(null)} titulo="¿Eliminar este modelo?">
        {aEliminar && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-20 shrink-0 overflow-hidden rounded-2xl">
                <Miniatura m={aEliminar} />
              </div>
              <p className="font-semibold">{aEliminar.nombre}</p>
            </div>
            <p className="text-texto-2">Se borrará de este móvil. No se puede deshacer.</p>
            <div className="grid grid-cols-2 gap-3">
              <Boton onClick={() => setAEliminar(null)}>Cancelar</Boton>
              <Boton
                variante="peligro"
                icono="borrar"
                onClick={async () => {
                  apuntarBorrado(aEliminar.id)
                  await borrarModelo(aEliminar.id)
                  setAEliminar(null)
                  avisar('Modelo eliminado.', 'exito')
                }}
              >
                Eliminar
              </Boton>
            </div>
          </div>
        )}
      </Hoja>
    </div>
  )
}
