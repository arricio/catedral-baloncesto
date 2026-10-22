/**
 * Inicio de sesión con Hugging Face (OAuth con PKCE, sin servidor propio).
 * Con sesión iniciada, los Spaces descuentan el tiempo de GPU del cupo gratuito
 * de TU cuenta (más generoso que el anónimo, que se comparte por IP).
 * También se puede pegar un token personal de lectura (hf_...).
 */
import { CONFIG } from './config'
import { ajustes } from './ajustes'

const CLAVE_CADUCIDAD = 'impresora3d-hf-caduca'

export const oauthDisponible = () => !!CONFIG.hfClientId

export async function iniciarSesionHF() {
  const { oauthLoginUrl } = await import('@huggingface/hub')
  sessionStorage.setItem('oauth-origen', 'hf')
  const url = await oauthLoginUrl({
    clientId: CONFIG.hfClientId,
    scopes: 'openid profile inference-api',
    redirectUrl: `${location.origin}${location.pathname}`,
    state: location.hash || '#/ajustes',
  })
  location.href = url
}

/** Se llama al arrancar: si volvemos de Hugging Face con ?code=..., guarda el token. */
export async function procesarVueltaOAuth(): Promise<boolean> {
  if (!new URLSearchParams(location.search).has('code') || sessionStorage.getItem('oauth-origen') !== 'hf') return comprobarCaducidad()
  sessionStorage.removeItem('oauth-origen')
  try {
    const { oauthHandleRedirectIfPresent } = await import('@huggingface/hub')
    const r = await oauthHandleRedirectIfPresent()
    if (r) {
      ajustes().set({ hfToken: r.accessToken, hfUsuario: r.userInfo.preferred_username, hfAvatar: r.userInfo.picture })
      localStorage.setItem(CLAVE_CADUCIDAD, String(new Date(r.accessTokenExpiresAt).getTime()))
      // Limpia la URL y vuelve a la pantalla de origen.
      history.replaceState(null, '', `${location.pathname}${r.state || '#/ajustes'}`)
      return true
    }
  } catch (e) {
    console.warn('OAuth Hugging Face', e)
    history.replaceState(null, '', `${location.pathname}#/ajustes`)
  }
  return false
}

function comprobarCaducidad(): boolean {
  const caduca = Number(localStorage.getItem(CLAVE_CADUCIDAD) || 0)
  if (caduca && caduca < Date.now()) {
    cerrarSesionHF()
  }
  return false
}

/** Valida un token pegado a mano y devuelve el nombre de usuario. */
export async function usarTokenManual(token: string): Promise<string> {
  const t = token.trim()
  if (!t.startsWith('hf_')) throw new Error('El token debe empezar por «hf_».')
  const r = await fetch('https://huggingface.co/api/whoami-v2', { headers: { Authorization: `Bearer ${t}` } })
  if (!r.ok) throw new Error('Hugging Face no reconoce ese token.')
  const j = (await r.json()) as { name: string; avatarUrl?: string }
  ajustes().set({ hfToken: t, hfUsuario: j.name, hfAvatar: j.avatarUrl ?? '' })
  localStorage.removeItem(CLAVE_CADUCIDAD)
  return j.name
}

export function cerrarSesionHF() {
  ajustes().set({ hfToken: '', hfUsuario: '', hfAvatar: '' })
  localStorage.removeItem(CLAVE_CADUCIDAD)
}
