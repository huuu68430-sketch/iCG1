import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  // Helper: get env variable from .env file or system environment
  const getEnv = (key: string) => env[key] || process.env[key] || '';

  // ⚠️ ملاحظة أمنية: لا تُحقن أي أسرار هنا — كل ما يوضع في define يصير
  // نصاً ظاهراً داخل ملف JavaScript que يصل للمتصفح.
  // لذلك كلمة سر الأدمن ورمز OBS لا تُمرَّر للواجهة إطلاقاً.
  const GEMINI_API_KEY = getEnv('GEMINI_API_KEY');
  const SUPABASE_URL = getEnv('EXPO_PUBLIC_SUPABASE_URL');
  const SUPABASE_KEY = getEnv('EXPO_PUBLIC_SUPABASE_KEY');
  const PEXELS_API_KEY = getEnv('PEXELS_API_KEY');
  const LOGO_DEV_TOKEN = getEnv('LOGO_DEV_TOKEN');
  const ADMIN_FALLBACK_PASSWORD = '';

  return {
    // Dynamic Base Path: Vercel usually serves from root (/), GitHub Pages from project folder (./)
    base: process.env.VERCEL ? '/' : './',
    server: {
      port: 3002,
      host: 'localhost',
      proxy: {
        '/kick-api': {
          target: 'https://api.kick.com',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/kick-api/, ''),
          secure: true,
        }
      }
    },
    plugins: [react()],
    envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
    define: {
      'process.env.API_KEY': JSON.stringify(GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(GEMINI_API_KEY),
      'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify(SUPABASE_URL),
      'process.env.EXPO_PUBLIC_SUPABASE_KEY': JSON.stringify(SUPABASE_KEY),
      'process.env.PEXELS_API_KEY': JSON.stringify(PEXELS_API_KEY),
      'process.env.LOGO_DEV_TOKEN': JSON.stringify(LOGO_DEV_TOKEN),
      // 🔒 القيم الحساسة purposefully فارغة — لا تُطبع في حزمة المتصفح
      'process.env.ADMIN_FALLBACK_PASSWORD': JSON.stringify(ADMIN_FALLBACK_PASSWORD),
      'process.env.OBS_STUDIO_TOKEN': JSON.stringify(''),
      'process': { env: {} }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});