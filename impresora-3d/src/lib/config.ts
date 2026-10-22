/**
 * Configuración global leída de las variables de entorno (ver .env.example).
 * Ningún secreto vive aquí: solo identificadores públicos.
 */
export const CONFIG = {
  /** URL pública de la app (para compartir por WhatsApp). */
  urlApp: (import.meta.env.VITE_SITE_URL || `${location.origin}${import.meta.env.BASE_URL}`).replace(/\/?$/, '/'),
  /** ID público de la app OAuth de Hugging Face. Vacío = solo token pegado a mano. */
  hfClientId: import.meta.env.VITE_HF_CLIENT_ID || '',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  /** Tamaño máximo por defecto de las imágenes subidas (MB). */
  maxImagenMB: Number(import.meta.env.VITE_MAX_IMAGE_MB || 10),
  /** Límite gratuito de almacenamiento de Supabase (1 GB). */
  limiteSupabaseBytes: 1024 * 1024 * 1024,
} as const

export const TIPOS_IMAGEN_PERMITIDOS = ['image/png', 'image/jpeg'] as const
export const EXTENSIONES_PERMITIDAS = ['.png', '.jpg', '.jpeg'] as const
