import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Configuración de Vite para IMPRESORA 3D.
// - BASE_PATH: ruta donde se publica la app (en GitHub Pages: /nombre-del-repo/).
// - VITE_SITE_URL: URL pública completa, necesaria para las etiquetas Open Graph (WhatsApp).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const base = env.BASE_PATH || '/'
  const siteUrl = (env.VITE_SITE_URL || 'https://arricio.github.io/catedral-baloncesto/impresora-3d/').replace(/\/?$/, '/')

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      {
        // Sustituye %SITE_URL% en index.html (las etiquetas Open Graph necesitan URL absoluta).
        name: 'site-url',
        transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl),
      },
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'prompt',
        injectRegister: false,
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
          // El modelo de "quitar fondo" del navegador se descarga bajo demanda, no se precachea.
          globIgnores: ['**/ort-wasm*', '**/transformers*', '**/og-image.png'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        },
        manifest: {
          id: base,
          name: 'IMPRESORA 3D',
          short_name: 'Impresora 3D',
          description: 'Convierte textos y fotos en modelos 3D a todo color. Gratis.',
          lang: 'es',
          dir: 'ltr',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#05060d',
          theme_color: '#05060d',
          categories: ['graphics', 'design', 'utilities'],
          icons: [
            { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1500,
    },
    worker: { format: 'es' },
  }
})
