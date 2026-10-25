import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      manifest: {
        name: 'Robot Emulator',
        short_name: 'RobotEmu',
        description: 'Icon-based visual robot programming and 2D grid simulation',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Precache all assets (JS, CSS, images, icons) so they are served Cache-First
        globPatterns: ['**/*.{js,css,ico,png,svg}'],
        navigateFallback: null,
        // Only index.html / document navigation requests use Network-First
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' ||
              request.destination === 'document' ||
              url.pathname.endsWith('/index.html'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pwa-html-cache',
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    host: true
  },
  base: '/Coding4Kids/'
});
