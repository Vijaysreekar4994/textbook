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
        'app-icon.png',
      ],

      manifest: {
        name: 'Textbook',
        short_name: 'Textbook',
        description: 'Your personal all-in-one notes and productivity app',

        theme_color: '#ffffff',
        background_color: '#ffffff',

        display: 'standalone',

        start_url: '/',

        icons: [
          {
            src: '/app-icon.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/app-icon.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/app-icon.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})