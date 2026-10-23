/**
 * Conectar la cuenta gratuita de Hugging Face en 2 toques, pensado para verse bien
 * y ser fácil de usar: 1) conseguir la clave en su web, 2) «Pegar y conectar»
 * (lee el portapapeles; si el móvil no lo permite, aparece una casilla para pegarla).
 */
import { useState } from 'react'
import { avisar } from '../lib/avisos'
import { usarTokenManual } from '../lib/hfAuth'
import { Boton } from './ui'

export function ConectarHF({ alConectar }: { alConectar?: () => void }) {
  const [manual, setManual] = useState(false)
  const [clave, setClave] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const conectar = async (valor: string) => {
    setOcupado(true)
    try {
      const usuario = await usarTokenManual(valor)
      avisar(`✅ Cuenta conectada: ${usuario}`, 'exito', 6000)
      alConectar?.()
    } catch (e) {
      avisar((e as Error).message, 'error', 7000)
      setManual(true)
    } finally {
      setOcupado(false)
    }
  }

  const pegarYConectar = async () => {
    try {
      const texto = (await navigator.clipboard.readText()).trim()
      if (!texto.startsWith('hf_')) {
        avisar('No encuentro la clave copiada. Repite el paso 1 y pulsa «Copy».', 'error', 7000)
        setManual(true)
        return
      }
      await conectar(texto)
    } catch {
      // El móvil no deja leer el portapapeles: se pega a mano en la casilla.
      setManual(true)
    }
  }

  return (
    <div className="rounded-3xl border-2 border-[#ffd21e]/60 bg-[#ffd21e]/10 p-4 text-left">
      <p className="mb-1 text-lg font-bold">🤗 Conecta tu cuenta de Hugging Face</p>
      <p className="mb-4 text-texto-2">Es gratis y da el tiempo de GPU para crear tus modelos. Solo se hace una vez.</p>

      <p className="mb-2 text-lg font-semibold">Paso 1</p>
      <p className="mb-2 text-texto-2">
        Pulsa el botón amarillo. En la web que se abre pulsa <b className="text-texto">«Create token»</b> y después <b className="text-texto">«Copy»</b>. Luego vuelve aquí.
      </p>
      <a
        href="https://huggingface.co/settings/tokens/new?tokenType=read&tokenName=impresora-3d"
        target="_blank"
        rel="noreferrer"
        className="mb-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#ffd21e] px-4 text-lg font-bold text-[#1a1300]"
      >
        1. Conseguir mi clave
      </a>

      <p className="mb-2 text-lg font-semibold">Paso 2</p>
      <Boton variante="principal" grande className="w-full" disabled={ocupado} onClick={pegarYConectar}>
        {ocupado ? 'Conectando…' : '2. Pegar y conectar'}
      </Boton>

      {manual && (
        <div className="mt-4">
          <p className="mb-2 text-texto-2">Mantén el dedo en la casilla, elige «Pegar» y pulsa «Conectar»:</p>
          <div className="flex gap-2">
            <input
              value={clave}
              onChange={(e) => setClave(e.target.value.trim())}
              placeholder="hf_…"
              autoComplete="off"
              aria-label="Clave de Hugging Face"
              className="cristal min-h-14 w-full rounded-2xl px-4 text-lg"
            />
            <Boton variante="principal" disabled={!clave.startsWith('hf_') || ocupado} onClick={() => conectar(clave)}>
              Conectar
            </Boton>
          </div>
        </div>
      )}
      <p className="mt-3 text-sm text-texto-2">La clave solo se guarda en este móvil.</p>
    </div>
  )
}
