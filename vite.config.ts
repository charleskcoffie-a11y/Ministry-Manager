import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: "autoUpdate",
          includeAssets: ["apple-touch-icon.png"],
          manifest: {
            name: "Ministry Manager",
            short_name: "MinistryMgr",
            description: "Pastoral ministry tools in one place.",
            start_url: ".",
            scope: ".",
            display: "standalone",
            theme_color: "#1e1b4b",
            background_color: "#0f172a",
            icons: [
              { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
              { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
              {
                src: "/pwa-512x512.png",
                sizes: "512x512",
                type: "image/png",
                purpose: "any maskable"
              }
            ]
          }
        }),
      ],
        base: '/Ministry-Manager/', // Set to your repo name for GitHub Pages
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
