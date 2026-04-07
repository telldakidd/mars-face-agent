import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.warn(
    "[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY — database calls will fail."
  );
}

/**
 * Supabase client initialized with the service role key.
 * Bypasses RLS — use only in trusted backend context.
 */
export const supabase = createClient(
  SUPABASE_URL ?? "https://placeholder.supabase.co",
  SUPABASE_SERVICE_KEY ?? "placeholder-key",
  {
    auth: { persistSession: false },
  }
);
