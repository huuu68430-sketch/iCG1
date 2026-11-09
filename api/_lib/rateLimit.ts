// Rate limiter. Uses atomic PostgreSQL function check_rate_limit (see SQL below).
// In production, if DB unavailable → fail closed (return false → 429/503).
// In dev, falls back to in-memory.
import { supabaseAdmin } from './supabase';
import { isProduction } from './env';

const memory = new Map<string, { count: number; windowStart: number }>();

export async function rateLimit(key: string, limit = 10, windowSec = 60): Promise<{ allowed: boolean; unavailable?: boolean }> {
  try {
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSec,
    });
    if (error) throw error;
    return { allowed: !!data };
  } catch (e) {
    if (isProduction()) {
      // Fail closed: do not silently bypass
      return { allowed: false, unavailable: true };
    }
    // Dev fallback: in-memory
    const now = Date.now();
    const rec = memory.get(key);
    if (!rec || now - rec.windowStart > windowSec * 1000) {
      memory.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }
    rec.count += 1;
    return { allowed: rec.count <= limit };
  }
}

/*
SQL (for review only — do not execute yet):

CREATE OR REPLACE FUNCTION check_rate_limit(p_key TEXT, p_limit INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  INSERT INTO api_rate_limits (key, count, window_start)
  VALUES (p_key, 1, v_now)
  ON CONFLICT (key) DO UPDATE
  SET
    count = CASE
      WHEN api_rate_limits.window_start < v_now - (p_window_seconds || ' seconds')::interval THEN 1
      ELSE api_rate_limits.count + 1
    END,
    window_start = CASE
      WHEN api_rate_limits.window_start < v_now - (p_window_seconds || ' seconds')::interval THEN v_now
      ELSE api_rate_limits.window_start
    END
  RETURNING count, window_start INTO v_count, v_window_start;
  RETURN v_count <= p_limit;
END;
$$;
*/
