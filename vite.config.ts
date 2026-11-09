import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import devApi from './plugins/devApi';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * قراءة ملف .env يدوياً: دالة loadEnv تعطي الأولوية لـ process.env على الملف،
 * فقيمة قديمة في الصدفة (SUPABASE_URL من مشروع آخر مثلاً) كانت تتسلل إلى دوال /api
 * تحت `vite dev` وتتصل بقاعدة ميتة. مصدر أسرار السيرفر هو الملف.
 */
function readDotEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const raw of fs.readFileSync(path.resolve(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  } catch { /* لا ملف .env: تُترك بيئة المضيف كما هي */ }
  return out;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const dotEnv = readDotEnv();

  // Replit Secrets must take precedence over values in an imported .env file.
  const getEnv = (key: string) => process.env[key] || env[key] || '';

  // الأسرار السيرفرية تُوضع في process.env حتى تقرأها دوال /api تحت `vite dev`
  // (في الإنتاج يوفّرها المضيف أصلاً ولا يوجد ملف .env في المستودع). لا تُحقن في الحزمة إطلاقاً.
  // ملف .env هو مصدر الحقيقة لهذا المشروع: لو كانت الصدفة تحمل SUPABASE_URL قديماً من
  // موقع آخر، كانت دوال /api تتصل بمشروع ميت فتُرفض كلمة سر الإدارة الصحيحة.
  ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SESSION_SECRET', 'CODE_HMAC_SECRET', 'ADMIN_FALLBACK_PASSWORD', 'OBS_STUDIO_TOKEN']
    .forEach(k => { const v = dotEnv[k] || env[k]; if (v) process.env[k] = v; });

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
      port: 5000,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '/kick-api': {
          target: 'https://api.kick.com',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/kick-api/, ''),
          secure: true,
        }
      }
    },
    plugins: [react(), devApi()],
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