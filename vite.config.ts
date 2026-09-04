import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'favicon.png',
        'apple-touch-icon.png',
        'app-icon-192.png',
        'app-icon-512.png',
      ],

      manifest: {
        name: 'Textbook',
        short_name: 'Textbook',
        description: 'Your personal all-in-one notes and productivity app',

        theme_color: '#da881e',
        background_color: '#ffffff',

        display: 'standalone',

        lang: 'en',

        start_url: '/textbook/',
        scope: '/textbook/',

        icons: [
          {
            src: '/textbook/app-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/textbook/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/textbook/app-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  base: '/textbook/',
})