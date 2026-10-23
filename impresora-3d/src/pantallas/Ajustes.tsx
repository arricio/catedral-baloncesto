/** Ajustes: motor 3D, cuenta de Hugging Face, servidor local, datos, apariencia, sincronización y copias. */
import { useRef, useState } from 'react'
import { Icono } from '../componentes/Icono'
import { ConectarHF } from '../componentes/ConectarHF'
import { InstruccionesInstalar } from '../componentes/Instalar'
import { Boton, Interruptor, Segmentado, Tarjeta, formatoBytes } from '../componentes/ui'
import { guardarArchivo } from '../exportar/descargar'
import { exportarBiblioteca, importarBiblioteca } from '../exportar/zip'
import { useAjustes, type Calidad, type ModoMotor } from '../lib/ajustes'
import { avisar } from '../lib/avisos'
import { CONFIG } from '../lib/config'
import { compartirApp, enlaceWhatsApp } from '../lib/compartirApp'
import { cerrarSesionHF, iniciarSesionHF, oauthDisponible } from '../lib/hfAuth'
import { pedirPermisoNotificaciones } from '../lib/notificaciones'
import { soportaNotificaciones } from '../lib/plataforma'
import { comprobarLocal, useEstadoMotor } from '../motor'
import { comprobarClave } from '../motor/local'
import { cerrarSesionSync, iniciarConEmail, iniciarConGoogle, sincronizar, syncDisponible, useSync } from '../sync/supabase'

function Seccion({ titulo, icono, children }: { titulo: string; icono: Parameters<typeof Icono>[0]['nombre']; children: React.ReactNode }) {
  return (
    <Tarjeta>
      <h2 className="mb-3 flex items-center gap-2 font-titulo text-lg font-bold">
        <Icono nombre={icono} className="size-5 text-cian" /> {titulo}
      </h2>
      {children}
    </Tarjeta>
  )
}

const entrada = 'cristal min-h-12 w-full rounded-2xl px-4 text-[16px] placeholder:text-texto-2/70'

function SeccionHF() {
  const { hfUsuario, hfAvatar, detalleNube, set } = useAjustes()
  return (
    <Seccion titulo="Cuenta de Hugging Face" icono="usuario">
      {hfUsuario ? (
        <div className="mb-3 flex items-center gap-3">
          {hfAvatar && <img src={hfAvatar} alt="" className="size-11 rounded-full" />}
          <div className="flex-1">
            <p className="font-medium">{hfUsuario}</p>
            <p className="text-sm text-texto-2">Usas el cupo gratuito de tu cuenta.</p>
          </div>
          <Boton variante="fantasma" onClick={cerrarSesionHF}>
            Salir
          </Boton>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-texto-2">Inicia sesión con tu cuenta gratuita para usar tu propio cupo diario de GPU (más que sin sesión).</p>
          {oauthDisponible() && (
            <Boton variante="principal" className="w-full" onClick={iniciarSesionHF}>
              🤗 Iniciar sesión con Hugging Face
            </Boton>
          )}
          <ConectarHF />
        </div>
      )}
      <div className="mt-3">
        <p className="mb-2 text-sm text-texto-2">Calidad en la nube</p>
        <Segmentado
          etiqueta="Calidad en la nube"
          valor={detalleNube}
          onCambio={(v) => set({ detalleNube: v })}
          opciones={[
            { id: 'rapido', texto: 'Rápida (gasta menos)' },
            { id: 'detallado', texto: 'Detallada' },
          ]}
        />
      </div>
    </Seccion>
  )
}

function SeccionServidor() {
  const { localUrl, localClave, set } = useAjustes()
  const { servidor, comprobando } = useEstadoMotor()
  const [url, setUrl] = useState(localUrl)
  const [clave, setClave] = useState(localClave)
  const [ver, setVer] = useState(false)
  const probar = async () => {
    const limpia = url.trim().replace(/\/+$/, '')
    if (limpia && !/^https?:\/\//.test(limpia)) return avisar('La dirección debe empezar por https://', 'error')
    set({ localUrl: limpia, localClave: clave })
    const s = await comprobarLocal()
    if (!s) return avisar('No responde. ¿Está encendido el PC y el túnel?', 'error')
    const ok = await comprobarClave(limpia, clave).catch(() => false)
    avisar(ok ? '¡Conectado a tu servidor! 🎉' : 'El servidor responde, pero la contraseña no es correcta.', ok ? 'exito' : 'error')
  }
  return (
    <Seccion titulo="Mi servidor (Modo B)" icono="servidor">
      <p className="mb-3 text-sm text-texto-2">Tu PC con tarjeta NVIDIA, sin límites. Pide la dirección y la contraseña a quien lo tenga instalado.</p>
      <div className="space-y-3">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.trycloudflare.com" inputMode="url" autoComplete="off" aria-label="Dirección del servidor" className={entrada} />
        <div className="flex gap-2">
          <input value={clave} onChange={(e) => setClave(e.target.value)} type={ver ? 'text' : 'password'} placeholder="Contraseña" autoComplete="off" aria-label="Contraseña del servidor" className={entrada} />
          <Boton variante="fantasma" onClick={() => setVer(!ver)} aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'}>
            {ver ? '🙈' : '👁️'}
          </Boton>
        </div>
        <Boton className="w-full" icono="wifi" onClick={probar} disabled={comprobando || !url}>
          {comprobando ? 'Comprobando…' : 'Guardar y comprobar'}
        </Boton>
        {localUrl && (
          <p className={`flex items-center gap-2 text-sm ${servidor ? 'text-ok' : 'text-error'}`}>
            <span className={`size-2.5 rounded-full ${servidor ? 'bg-ok' : 'bg-error'}`} />
            {servidor
              ? `Encendido · ${servidor.gpu ?? 'GPU'}${servidor.vram_gb ? ` (${servidor.vram_gb} GB)` : ''} · ${servidor.modelos?.imagen3d ?? ''}`
              : 'Apagado o sin conexión (se usará la nube)'}
          </p>
        )}
      </div>
    </Seccion>
  )
}

function SeccionSync() {
  const { usuario, sincronizando, ultima, bytesNube, error } = useSync()
  const { syncActiva, set } = useAjustes()
  const [email, setEmail] = useState('')
  if (!syncDisponible()) return null
  const pct = Math.min(100, (bytesNube / CONFIG.limiteSupabaseBytes) * 100)
  return (
    <Seccion titulo="Sincronizar móvil y ordenador" icono="nube">
      {usuario ? (
        <div className="space-y-3">
          <p className="text-sm">
            Conectado como <b>{usuario.email}</b>
          </p>
          <Interruptor activo={syncActiva} onCambio={(v) => set({ syncActiva: v })} etiqueta="Sincronizar automáticamente" descripcion="Al abrir la app y al terminar cada modelo." />
          <div>
            <div className="mb-1 flex justify-between text-sm text-texto-2">
              <span>Espacio usado en Supabase</span>
              <span>
                {formatoBytes(bytesNube)} de 1 GB
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-panel-fuerte">
              <div className={`h-full ${pct > 85 ? 'bg-error' : 'bg-gradient-to-r from-cian to-magenta'}`} style={{ width: `${Math.max(1, pct)}%` }} />
            </div>
            {pct > 85 && <p className="mt-1 text-sm text-error">Casi lleno: borra modelos antiguos o haz una copia ZIP.</p>}
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <Boton
              variante="principal"
              icono="girar"
              disabled={sincronizando}
              onClick={() =>
                sincronizar()
                  .then((r) => avisar(`Sincronizado: ${r.subidos} subidos, ${r.bajados} descargados.`, 'exito'))
                  .catch((e) => avisar(e.message, 'error'))
              }
            >
              {sincronizando ? 'Sincronizando…' : 'Sincronizar'}
            </Boton>
            <Boton variante="fantasma" onClick={cerrarSesionSync}>
              Cerrar sesión
            </Boton>
          </div>
          {ultima > 0 && <p className="text-xs text-texto-2">Última vez: {new Date(ultima).toLocaleString('es-ES')}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-texto-2">Opcional. Tus modelos se guardan en este dispositivo; con una cuenta gratuita puedes verlos también en otro.</p>
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              try {
                await iniciarConEmail(email)
                avisar('Te hemos enviado un enlace por email. Ábrelo en este dispositivo.', 'exito', 8000)
              } catch (err) {
                avisar((err as Error).message, 'error')
              }
            }}
          >
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email" aria-label="Email" className={entrada} />
            <Boton type="submit">Entrar</Boton>
          </form>
          <Boton className="w-full" onClick={() => iniciarConGoogle().catch((e) => avisar(e.message, 'error'))}>
            Continuar con Google
          </Boton>
        </div>
      )}
    </Seccion>
  )
}

function SeccionCopia() {
  const archivo = useRef<HTMLInputElement>(null)
  const [p, setP] = useState<number | null>(null)
  return (
    <Seccion titulo="Copia de seguridad" icono="zip">
      <p className="mb-3 text-sm text-texto-2">Guarda toda tu biblioteca en un ZIP o recupérala en otro dispositivo.</p>
      <div className="grid grid-cols-2 gap-2">
        <Boton
          icono="descargar"
          disabled={p != null}
          onClick={async () => {
            setP(0)
            try {
              const zip = await exportarBiblioteca(setP)
              await guardarArchivo(zip, `impresora3d-copia-${new Date().toISOString().slice(0, 10)}.zip`)
            } finally {
              setP(null)
            }
          }}
        >
          {p != null ? `${Math.round(p * 100)} %` : 'Exportar'}
        </Boton>
        <Boton icono="instalar" onClick={() => archivo.current?.click()}>
          Importar
        </Boton>
      </div>
      <input
        ref={archivo}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          try {
            const r = await importarBiblioteca(f)
            avisar(`Importados ${r.modelos} modelos y ${r.carpetas} carpetas.`, 'exito')
          } catch (err) {
            avisar((err as Error).message, 'error')
          }
        }}
      />
    </Seccion>
  )
}

export function Ajustes() {
  const a = useAjustes()
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <header>
        <h1 className="font-titulo text-[28px] font-bold sm:text-4xl">Ajustes</h1>
      </header>

      <Seccion titulo="Motor 3D" icono="impresora">
        <Segmentado<ModoMotor>
          etiqueta="Motor 3D"
          valor={a.motor}
          onCambio={(v) => a.set({ motor: v })}
          opciones={[
            { id: 'auto', texto: 'Automático' },
            { id: 'nube', texto: 'Nube', icono: 'nube' },
            { id: 'local', texto: 'Mi servidor', icono: 'servidor' },
          ]}
        />
        <p className="mt-2 text-sm text-texto-2">
          {a.motor === 'auto'
            ? 'Usa tu servidor si está encendido; si no, la nube gratuita.'
            : a.motor === 'nube'
              ? 'Spaces gratuitos de Hugging Face (TRELLIS.2, TRELLIS, Stable Fast 3D y FLUX). Con cola y cupo diario.'
              : 'Tu PC, sin límites. Si está apagado, se usa la nube.'}
        </p>
      </Seccion>

      <SeccionHF />
      <SeccionServidor />

      <Seccion titulo="Datos y archivos" icono="wifi">
        <Interruptor activo={a.ahorroDatos} onCambio={(v) => a.set({ ahorroDatos: v })} etiqueta="Ahorro de datos" descripcion="Comprime más las fotos antes de enviarlas (768 px)." />
        <label className="flex min-h-12 items-center justify-between gap-4 py-2">
          <span>
            <span className="block font-medium">Tamaño máximo de imagen</span>
            <span className="block text-sm text-texto-2">PNG o JPG</span>
          </span>
          <span className="flex items-center gap-2">
            <input type="number" min={1} max={50} value={a.maxMB} onChange={(e) => a.set({ maxMB: Math.max(1, Math.min(50, Number(e.target.value) || 10)) })} className="cristal min-h-11 w-20 rounded-xl px-3 text-[16px]" aria-label="Tamaño máximo en MB" />
            MB
          </span>
        </label>
        {soportaNotificaciones() && (
          <Interruptor
            activo={a.notificaciones && Notification.permission === 'granted'}
            onCambio={async (v) => {
              if (!v) return a.set({ notificaciones: false })
              const ok = await pedirPermisoNotificaciones()
              a.set({ notificaciones: ok })
              if (!ok) avisar('Activa las notificaciones para esta web en los ajustes del navegador.', 'info')
            }}
            etiqueta="Avisarme cuando esté listo"
            descripcion="Notificación en el móvil al terminar un modelo."
          />
        )}
      </Seccion>

      <Seccion titulo="Apariencia" icono={a.tema === 'oscuro' ? 'luna' : 'sol'}>
        <div className="space-y-3">
          <Interruptor activo={a.sonido} onCambio={(v) => a.set({ sonido: v })} etiqueta="Sonido de la impresora" descripcion="Motores mientras se crea el modelo y un «ding» al terminar." />
          <Interruptor activo={a.letraGrande} onCambio={(v) => a.set({ letraGrande: v })} etiqueta="Letra grande" descripcion="Todo se ve más grande y fácil de leer." />
          <Segmentado
            etiqueta="Tema"
            valor={a.tema}
            onCambio={(v) => a.set({ tema: v })}
            opciones={[
              { id: 'oscuro', texto: 'Oscuro', icono: 'luna' },
              { id: 'claro', texto: 'Claro', icono: 'sol' },
            ]}
          />
          <div>
            <p className="mb-2 text-sm text-texto-2">Calidad gráfica del visor</p>
            <Segmentado<Calidad>
              etiqueta="Calidad gráfica"
              valor={a.calidad}
              onCambio={(v) => a.set({ calidad: v })}
              opciones={[
                { id: 'auto', texto: 'Auto' },
                { id: 'baja', texto: 'Batería' },
                { id: 'media', texto: 'Media' },
                { id: 'alta', texto: 'Alta' },
              ]}
            />
          </div>
        </div>
      </Seccion>

      <SeccionSync />
      <SeccionCopia />

      <Seccion titulo="Compartir e instalar" icono="compartir">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Boton variante="principal" icono="compartir" onClick={compartirApp}>
              Compartir app
            </Boton>
            <a href={enlaceWhatsApp()} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-4 font-semibold text-[#06260f]">
              <Icono nombre="whatsapp" className="size-5" /> WhatsApp
            </a>
          </div>
          <InstruccionesInstalar />
          <a href="#/bienvenida" className="block min-h-11 py-2 text-center text-sm text-texto-2 underline">
            Ver la pantalla de bienvenida
          </a>
        </div>
      </Seccion>

      <p className="pb-4 text-center text-xs text-texto-2">
        IMPRESORA 3D · Modelos de IA abiertos: TRELLIS (MIT), Stable Fast 3D (licencia comunitaria), FLUX.1-schnell (Apache 2.0), RMBG-1.4 (no comercial).
      </p>
    </div>
  )
}
