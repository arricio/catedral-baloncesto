/**
 * Tipos de letra para los textos (todas gratuitas, licencia OFL, incluidas en la app).
 *  - En «Retrato en relieve» se dibujan tal cual en la peana: el resultado es exacto.
 *  - En «Desde texto» se describen a la IA, que intenta imitarlas.
 */
import bebas from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url'
import bangers from '@fontsource/bangers/files/bangers-latin-400-normal.woff2?url'
import blackOps from '@fontsource/black-ops-one/files/black-ops-one-latin-400-normal.woff2?url'
import playfair from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url'
import pacifico from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff2?url'
import lobster from '@fontsource/lobster/files/lobster-latin-400-normal.woff2?url'
import gotica from '@fontsource/unifrakturmaguntia/files/unifrakturmaguntia-latin-400-normal.woff2?url'
import pixel from '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?url'

export interface Fuente {
  id: string
  nombre: string
  /** Nombre de la familia CSS. */
  familia: string
  peso: number
  archivo?: string
  /** Descripción para la IA (en inglés, que es lo que mejor entiende). */
  prompt: string
}

export const FUENTES: Fuente[] = [
  { id: 'clasica', nombre: 'Clásica', familia: 'Inter Variable', peso: 800, prompt: 'clean bold modern sans-serif font' },
  { id: 'cartel', nombre: 'Cartel', familia: 'Bebas Neue', peso: 400, archivo: bebas, prompt: 'tall condensed bold poster sans-serif font like Bebas Neue' },
  { id: 'comic', nombre: 'Cómic', familia: 'Bangers', peso: 400, archivo: bangers, prompt: 'comic book style bold hand-lettered font like Bangers' },
  { id: 'militar', nombre: 'Militar', familia: 'Black Ops One', peso: 400, archivo: blackOps, prompt: 'military stencil font like Black Ops One' },
  { id: 'elegante', nombre: 'Elegante', familia: 'Playfair Display', peso: 700, archivo: playfair, prompt: 'elegant classic high-contrast serif font like Playfair Display' },
  { id: 'cursiva', nombre: 'Cursiva', familia: 'Pacifico', peso: 400, archivo: pacifico, prompt: 'rounded cursive brush script handwriting font like Pacifico' },
  { id: 'retro', nombre: 'Retro', familia: 'Lobster', peso: 400, archivo: lobster, prompt: 'retro 1950s script logo font like Lobster' },
  { id: 'gotica', nombre: 'Gótica', familia: 'UnifrakturMaguntia', peso: 400, archivo: gotica, prompt: 'gothic blackletter medieval font' },
  { id: 'pixel', nombre: 'Videojuego', familia: 'Press Start 2P', peso: 400, archivo: pixel, prompt: '8-bit pixel arcade video game font like Press Start 2P' },
]

export const fuentePorId = (id?: string) => FUENTES.find((f) => f.id === id) ?? FUENTES[0]

const cargadas = new Map<string, Promise<void>>()

/** Carga la fuente (una vez) para poder verla y dibujarla en un lienzo. */
export function cargarFuente(f: Fuente): Promise<void> {
  if (!f.archivo) return document.fonts.load(`${f.peso} 40px "${f.familia}"`).then(() => undefined)
  let p = cargadas.get(f.id)
  if (!p) {
    const cara = new FontFace(f.familia, `url(${f.archivo})`, { weight: String(f.peso), display: 'swap' })
    p = cara.load().then((c) => void document.fonts.add(c))
    p.catch(() => cargadas.delete(f.id))
    cargadas.set(f.id, p)
  }
  return p
}

export const cargarTodas = () => Promise.allSettled(FUENTES.map(cargarFuente))
