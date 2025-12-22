import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProd = mode === 'production';

    return {
      // Use an absolute base only for production (GitHub Pages) so local dev/preview works at the server root
      base: isProd ? '/Ministry-Manager/' : '/',
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
            background_color: "#0f172a"
            // icons removed temporarily to prevent 404 errors
          }
        }),
      ],
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
