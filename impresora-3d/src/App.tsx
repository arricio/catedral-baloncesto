/**
 * IMPRESORA 3D · componente raíz: arranque, tema, rutas y navegación.
 */
import { lazy, Suspense, useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Avisos } from './componentes/Avisos'
import { BarraNavegacion } from './componentes/BarraNavegacion'
import { Boton } from './componentes/ui'
import { useAjustes } from './lib/ajustes'
import { avisar } from './lib/avisos'
import { pedirAlmacenamientoPersistente } from './lib/db'
import { procesarVueltaOAuth } from './lib/hfAuth'
import { useEstadoRed } from './lib/red'
import { ir, useRuta } from './lib/ruta'
import { vigilarServidorLocal } from './motor'
import { retomarPendiente, useImpresion } from './motor/trabajo'
import { Imprimir } from './pantallas/Imprimir'
import { iniciarSync, sincronizar, useSync } from './sync/supabase'

// Pantallas secundarias: se cargan bajo demanda (arranque más rápido con datos móviles).
const Biblioteca = lazy(() => import('./pantallas/Biblioteca').then((m) => ({ default: m.Biblioteca })))
const DetalleModelo = lazy(() => import('./pantallas/DetalleModelo').then((m) => ({ default: m.DetalleModelo })))
const Ajustes = lazy(() => import('./pantallas/Ajustes').then((m) => ({ default: m.Ajustes })))
const Bienvenida = lazy(() => import('./pantallas/Bienvenida').then((m) => ({ default: m.Bienvenida })))
const Conectar = lazy(() => import('./pantallas/Conectar').then((m) => ({ default: m.Conectar })))

function AvisoActualizacion() {
  const {
    needRefresh: [hayNueva],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })
  if (!hayNueva) return null
  return (
    <div className="cristal fixed inset-x-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl p-3 shadow-xl">
      <span className="flex-1 text-sm">Hay una versión nueva de la app ✨</span>
      <Boton variante="principal" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </Boton>
    </div>
  )
}

function useArranque() {
  useEffect(() => {
    ;(async () => {
      await procesarVueltaOAuth()
      await iniciarSync().catch(() => undefined)
      pedirAlmacenamientoPersistente()
      const a = useAjustes.getState()
      if (!a.bienvenidaVista && !location.hash.startsWith('#/conectar')) ir('/bienvenida')
      await retomarPendiente()
      if (a.syncActiva && useSync.getState().usuario) sincronizar().catch(() => undefined)
    })()
    const parar = vigilarServidorLocal()
    // Sincroniza al terminar cada modelo (si está activado).
    const dejar = useImpresion.subscribe((s, antes) => {
      if (s.trabajo?.estado === 'listo' && antes.trabajo?.estado !== 'listo' && useAjustes.getState().syncActiva && useSync.getState().usuario)
        sincronizar().catch((e) => avisar(e.message, 'error'))
    })
    return () => {
      parar()
      dejar()
    }
  }, [])
}

export default function App() {
  const ruta = useRuta()
  const tema = useAjustes((s) => s.tema)
  const letraGrande = useAjustes((s) => s.letraGrande)
  const red = useEstadoRed()
  useArranque()

  useEffect(() => {
    document.documentElement.dataset.tema = tema
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'claro' ? '#f4f6fb' : '#05060d')
  }, [tema])

  // Letra grande: todo el diseño usa «rem», así que crece entero.
  useEffect(() => {
    document.documentElement.style.fontSize = letraGrande ? '125%' : ''
  }, [letraGrande])

  // Al cambiar de pantalla, arriba del todo.
  useEffect(() => window.scrollTo({ top: 0 }), [ruta.nombre])

  let pantalla
  switch (ruta.nombre) {
    case 'biblioteca':
      pantalla = <Biblioteca carpetaInicial={ruta.carpeta} />
      break
    case 'modelo':
      pantalla = <DetalleModelo id={ruta.id} />
      break
    case 'ajustes':
      pantalla = <Ajustes />
      break
    case 'bienvenida':
      pantalla = <Bienvenida />
      break
    case 'conectar':
      pantalla = <Conectar url={ruta.url} clave={ruta.clave} />
      break
    default:
      pantalla = <Imprimir />
  }

  const conNavegacion = ruta.nombre !== 'bienvenida'
  return (
    <>
      {!red.enLinea && (
        <div className="pt-segura sticky top-0 z-40 bg-error/90 text-center text-sm font-medium text-white">
          <p className="py-1.5">Sin conexión · tu biblioteca sigue disponible</p>
        </div>
      )}
      <main className={`min-h-full px-4 pt-[calc(env(safe-area-inset-top)+1rem)] ${conNavegacion ? 'pb-32 [@media(max-height:500px)]:pb-20 lg:pb-10 lg:pl-64' : 'pb-10'}`}>
        <Suspense fallback={<div className="mx-auto mt-20 size-10 animate-spin rounded-full border-4 border-cian border-t-transparent" aria-label="Cargando" />}>
          <div key={ruta.nombre} className="aparecer">
            {pantalla}
          </div>
        </Suspense>
      </main>
      {conNavegacion && <BarraNavegacion />}
      <Avisos />
      <AvisoActualizacion />
    </>
  )
}
