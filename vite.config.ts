import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['robot-icon.svg', 'apple-touch-icon.png'],
      manifest: {
        id: '/Coding4Kids/',
        name: 'Robot Emulator',
        short_name: 'RobotEmu',
        description: 'Icon-based visual robot programming and 2D grid simulation',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: '/Coding4Kids/',
        scope: '/Coding4Kids/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        navigateFallback: 'index.html'
      }
    })
  ],
  server: {
    port: 5173,
    host: true
  },
  base: '/Coding4Kids/'
});
