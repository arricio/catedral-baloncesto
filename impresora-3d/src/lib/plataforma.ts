/** Detección del dispositivo y de las capacidades del navegador. */

const ua = navigator.userAgent

export const esIOS =
  /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const esAndroid = /Android/i.test(ua)
export const esMovil = esIOS || esAndroid || matchMedia('(pointer: coarse)').matches

/** ¿Se está ejecutando como app instalada (pantalla de inicio)? */
export function esAppInstalada(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    // Safari en iOS
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export const soportaCompartirArchivos = (): boolean =>
  typeof navigator.canShare === 'function' &&
  navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] })

export const soportaNotificaciones = (): boolean => 'Notification' in window && 'serviceWorker' in navigator
