/** Enlace de invitación al servidor local: #/conectar?url=...&clave=... */
import { Boton, Tarjeta } from '../componentes/ui'
import { useAjustes } from '../lib/ajustes'
import { avisar } from '../lib/avisos'
import { ir } from '../lib/ruta'
import { comprobarLocal } from '../motor'

export function Conectar({ url, clave }: { url: string; clave: string }) {
  const set = useAjustes((s) => s.set)
  const valido = /^https:\/\//.test(url)
  return (
    <div className="mx-auto max-w-md">
      <Tarjeta className="text-center">
        <p className="mb-2 text-5xl" aria-hidden>
          🖥️
        </p>
        <h1 className="mb-2 font-titulo text-2xl font-bold">Conectar con un servidor</h1>
        {valido ? (
          <>
            <p className="mb-5 break-all text-texto-2">Te han invitado a usar la impresora de su PC: {url}</p>
            <Boton
              variante="principal"
              grande
              className="w-full"
              onClick={async () => {
                set({ localUrl: url.replace(/\/+$/, ''), localClave: clave, motor: 'auto' })
                const ok = await comprobarLocal()
                avisar(ok ? '¡Conectado! Ya puedes imprimir sin límites.' : 'Guardado, pero ahora mismo el servidor no responde.', ok ? 'exito' : 'info')
                ir('/imprimir')
              }}
            >
              Conectar
            </Boton>
          </>
        ) : (
          <p className="text-error">El enlace de invitación no es válido.</p>
        )}
        <Boton variante="fantasma" className="mt-2 w-full" onClick={() => ir('/imprimir')}>
          Cancelar
        </Boton>
      </Tarjeta>
    </div>
  )
}
