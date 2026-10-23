/**
 * Construye la instrucción para el modelo texto→imagen.
 * La imagen intermedia debe mostrar UN objeto completo, centrado y sobre fondo
 * liso: así el paso imagen→3D sale mucho mejor. Los colores pedidos se repiten
 * para que el modelo los respete.
 */
import type { Estilo } from '../lib/db'

export const ESTILOS: { id: Estilo; nombre: string; emoji: string; prompt: string }[] = [
  { id: 'realista', nombre: 'Realista', emoji: '📷', prompt: 'photorealistic, physically based materials, detailed product photography' },
  { id: 'dibujos', nombre: 'Dibujos animados', emoji: '🎨', prompt: 'cartoon style 3D character render, smooth shapes, vibrant saturated colors, animated movie look' },
  { id: 'lowpoly', nombre: 'Low-poly', emoji: '🔷', prompt: 'low poly 3D model, flat shaded faceted polygons, simple geometric shapes, flat colors' },
  { id: 'juguete', nombre: 'Figura de juguete', emoji: '🧸', prompt: 'collectible vinyl toy figure, glossy plastic, cute chunky proportions, toy photography' },
  { id: 'escultura', nombre: 'Escultura', emoji: '🗿', prompt: 'sculpture, hand sculpted statue, artistic carved details, museum piece on a small base' },
]

/** Palabras entre comillas en la descripción: deben salir escritas tal cual. */
export function textosEntreComillas(texto: string): string[] {
  return [...texto.matchAll(/["«“']([^"»”']{1,40})["»”']/g)].map((m) => m[1].trim()).filter(Boolean)
}

export function construirPrompt(texto: string, estilo: Estilo, colores?: string): string {
  const e = ESTILOS.find((x) => x.id === estilo) ?? ESTILOS[0]
  const col = colores?.trim()
  const letras = textosEntreComillas(texto)
  const partes = [
    `A single ${texto.trim()}`,
    ...letras.map((l) => `with the exact text "${l}" written clearly in large bold capital letters, perfectly spelled, high contrast`),
    col ? `colors: ${col}` : '',
    e.prompt,
    'one isolated object, entire object fully visible and centered, three-quarter front view',
    'plain pure white background, soft even studio lighting, no text, no shadow on background',
    col ? `make sure the colors are exactly: ${col}` : 'faithful true-to-life colors',
  ]
  return partes.filter(Boolean).join(', ')
}

/** Nombre corto a partir del texto (para la biblioteca). */
export function nombreDesdeTexto(texto: string): string {
  const limpio = texto.trim().replace(/\s+/g, ' ')
  const corto = limpio.length > 40 ? `${limpio.slice(0, 38).trimEnd()}…` : limpio
  return corto.charAt(0).toUpperCase() + corto.slice(1)
}
