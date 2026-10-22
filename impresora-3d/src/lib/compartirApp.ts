/** Compartir la app: Web Share API y enlace directo a WhatsApp. */
import { CONFIG } from './config'

export const TEXTO_COMPARTIR = '🖨️✨ Mira IMPRESORA 3D: convierte fotos y textos en modelos 3D a todo color, gratis y desde el móvil.'

export const enlaceWhatsApp = (texto = TEXTO_COMPARTIR, url = CONFIG.urlApp) => `https://wa.me/?text=${encodeURIComponent(`${texto}\n${url}`)}`

export async function compartirApp(): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'IMPRESORA 3D', text: TEXTO_COMPARTIR, url: CONFIG.urlApp })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  window.open(enlaceWhatsApp(), '_blank', 'noopener')
}
