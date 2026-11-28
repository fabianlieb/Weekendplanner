/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// `npm run demo` prints example suggestions from test data instead of running the test suite.
const isDemo = process.env.npm_lifecycle_event === 'demo';

export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; set in CI via BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['apple-touch-icon.png', 'favicon-32.png'],
      manifest: {
        name: 'Wochenend-Planer',
        short_name: 'Wochenende',
        description: '3 Wochenendvorschläge + Plan B für Ski, Skitour, Schneeschuh und Fotografie in der Schweiz.',
        lang: 'de-CH',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell offline; weather and plans live in IndexedDB (no runtime caching of API calls).
        // routes.json = route catalogue (about 1.4 MB, so it works offline too)
        globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        // Generated calendar files are not app pages.
        navigateFallbackDenylist: [/\/calendar\/[^/]+\.ics$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // The app writes .ics files into this cache (src/ui/files.ts); the service worker serves
            // them from a real same-origin URL so iOS opens «Zum Kalender hinzufügen».
            urlPattern: /\/calendar\/[^/]+\.ics$/,
            handler: 'CacheOnly',
            options: { cacheName: 'wp-ics' },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: isDemo ? ['src/**/*.demo.ts'] : ['src/**/*.test.ts'],
  },
});
