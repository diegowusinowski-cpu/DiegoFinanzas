import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'
import { dwfApi } from './server/dwfApi.ts'
import { SECURITY_HEADERS } from './server/securityHeaders.ts'
import { dwfRatesApi } from './server/ratesApi.ts'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dwfRatesApi(),
    dwfApi(),
    VitePWA({
      registerType: 'autoUpdate',
      // Solo estos dos se agregan al caché; los demás íconos y las pantallas de arranque se piden al instalar.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'DiegoFinanzas',
        short_name: 'DWF',
        description: 'Ingresos, gastos, préstamos y ahorros en un solo lugar.',
        lang: 'es-AR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['finance', 'productivity'],
        background_color: '#f4f0ea',
        theme_color: '#14392a',
        icons: [
          ...[48, 72, 96, 144, 192, 256, 384, 512].map((size) => ({
            src: `icons/icon-${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
            purpose: 'any',
          })),
          { src: 'icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Solo la interfaz (código, estilos, tipografías y el HTML de arranque). Nunca datos.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        // El backend y la cotización siempre se piden en vivo: el service worker no los toca (sin runtimeCaching:
        // van directo a la red) y tampoco se redirigen al HTML.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: true, allowedHosts: true },
  preview: {
    host: true,
    allowedHosts: true,
    // El build se prueba con las mismas cabeceras de seguridad que tendrá en producción.
    headers: Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value])),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    css: false,
  },
})
