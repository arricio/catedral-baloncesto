/**
 * Pruebas automáticas de IMPRESORA 3D (Playwright + Chromium).
 * Se ejecutan contra la versión compilada (npm run build) en modo demostración (?demo=1),
 * que imita a la IA para no gastar cupo. Ejecutar: npm test
 */
import { defineConfig, devices } from '@playwright/test'

const launchOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
const iPhoneEnChromium = (d: (typeof devices)[string]) => ({ ...d, defaultBrowserType: 'chromium' as const })

export default defineConfig({
  testDir: './pruebas',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // En serie: sin GPU real, el WebGL por software es lento y las pruebas en paralelo se estorban.
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: 'http://localhost:4173/impresora-3d/',
    launchOptions,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    env: { BASE_PATH: '/impresora-3d/' },
    url: 'http://localhost:4173/impresora-3d/',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'android-360', use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 } } },
    { name: 'android-pixel7', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-390', use: iPhoneEnChromium(devices['iPhone 14']) },
    { name: 'iphone-430', use: iPhoneEnChromium(devices['iPhone 14 Pro Max']) },
    { name: 'android-horizontal', use: { ...devices['Pixel 7 landscape'] } },
    { name: 'tablet', use: iPhoneEnChromium(devices['iPad (gen 7)']) },
    { name: 'ordenador', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
})
