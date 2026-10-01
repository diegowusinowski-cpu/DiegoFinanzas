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
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'DWF — Dieto Wusinowski Finanzas',
        short_name: 'DWF',
        description: 'Ingresos, gastos y saldo en un solo lugar.',
        lang: 'es-AR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f1ec',
        theme_color: '#f5f1ec',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webp}'],
        // La cotización siempre se pide en vivo: nunca desde el precache.
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  build: {
    // Las poses de Luca se publican como archivos aparte (se cargan solo cuando hacen falta), no embebidas en el JS.
    assetsInlineLimit: (file) => (file.endsWith('.webp') ? false : undefined),
  },
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
