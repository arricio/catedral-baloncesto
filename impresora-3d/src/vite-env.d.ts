/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string
  readonly VITE_HF_CLIENT_ID?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_MAX_IMAGE_MB?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
