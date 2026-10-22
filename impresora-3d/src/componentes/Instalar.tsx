/** Instrucciones de instalación según el dispositivo. */
import { useInstalar, instalarApp } from '../lib/instalar'
import { esAndroid, esIOS } from '../lib/plataforma'
import { Icono } from './Icono'
import { Boton } from './ui'

function Paso({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cian to-magenta font-bold text-sobre-acento">{n}</span>
      <span className="pt-1">{children}</span>
    </li>
  )
}

export function InstruccionesInstalar() {
  const { evento, instalada } = useInstalar()
  if (instalada)
    return (
      <p className="flex items-center gap-2 text-ok">
        <Icono nombre="check" className="size-5" /> La app ya está instalada en este dispositivo.
      </p>
    )
  if (evento)
    return (
      <Boton variante="principal" grande icono="instalar" className="w-full" onClick={instalarApp}>
        Instalar app
      </Boton>
    )
  if (esIOS)
    return (
      <ol className="space-y-3">
        <Paso n={1}>
          Abre esta página en <b>Safari</b>.
        </Paso>
        <Paso n={2}>
          Pulsa el botón <b>Compartir</b> <span aria-hidden>(el cuadrado con la flecha ⬆️)</span>.
        </Paso>
        <Paso n={3}>
          Elige <b>«Añadir a pantalla de inicio»</b> y después <b>«Añadir»</b>.
        </Paso>
      </ol>
    )
  if (esAndroid)
    return (
      <ol className="space-y-3">
        <Paso n={1}>
          Abre esta página en <b>Chrome</b>.
        </Paso>
        <Paso n={2}>
          Pulsa el menú <b>⋮</b> (arriba a la derecha).
        </Paso>
        <Paso n={3}>
          Elige <b>«Instalar aplicación»</b> o <b>«Añadir a pantalla de inicio»</b>.
        </Paso>
      </ol>
    )
  return (
    <p className="text-texto-2">
      En el ordenador, busca el icono <b>Instalar</b> <span aria-hidden>⊕</span> en la barra de direcciones de Chrome o Edge.
    </p>
  )
}
