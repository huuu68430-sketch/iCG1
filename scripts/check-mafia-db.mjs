// تشخيص سريع: هل جداول المافيا موجودة في Supabase؟ (لا يطبع أي مفتاح)
import fs from 'node:fs';

const env = {};
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const url = env.EXPO_PUBLIC_SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const key =
  env.EXPO_PUBLIC_SUPABASE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  '';

if (!url || !key) {
  console.log('❌ لم أجد إعدادات Supabase في .env');
  process.exit(1);
}

const tables = ['mafia_rooms', 'mafia_roles', 'mafia_actions', 'mafia_messages', 'mafia_events', 'mafia_matches'];
let missing = 0;

for (const t of tables) {
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${t}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  let detail = '';
  if (!res.ok) {
    try {
      const body = await res.json();
      detail = body?.message || body?.hint || '';
    } catch {}
  }
  if (res.ok) console.log(`✅ ${t}`);
  else { missing++; console.log(`❌ ${t} — HTTP ${res.status} ${detail}`); }
}

console.log(missing === 0
  ? '\n✅ كل الجداول جاهزة — الغرف ستعمل بين الأجهزة.'
  : `\n⚠️ ينقص ${missing} جدول/جداول. شغّل supabase/mafia_setup.sql في Supabase ثم أعد المحاولة.`);
