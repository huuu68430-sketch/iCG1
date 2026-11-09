// Server-side Supabase client (service role). NEVER import in frontend.
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

const url = env('SUPABASE_URL') || env('EXPO_PUBLIC_SUPABASE_URL');
const key = env('SUPABASE_SECRET_KEY') || env('SUPABASE_SERVICE_ROLE_KEY');

export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'public' },
});

export const isSupabaseConfigured = !!(url && key);
