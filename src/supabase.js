import { createClient } from "@supabase/supabase-js";

// Both values come from .env (see .env.example). The publishable key is safe in
// browser code: the database's row level security decides what each user can see.
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const configured = Boolean(url && key);
export const MACHINE_ID = import.meta.env.VITE_MACHINE_ID || "machine-01";

export const supabase = configured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
