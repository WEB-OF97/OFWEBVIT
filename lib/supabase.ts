import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function supabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || undefined;
}

function anonKey(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined;
}

/**
 * Client navigateur : clé anon uniquement.
 * À n'utiliser que dans des composants client.
 */
export function createBrowserSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Lecture publique du catalogue côté serveur (RLS appliqué).
 */
export function createAnonServerSupabase(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("createAnonServerSupabase est réservé au serveur.");
  }
  const url = supabaseUrl();
  const key = anonKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Clé service_role : serveur uniquement (back-office, lecture des commandes).
 * Jamais importée par un composant client.
 */
export function createServiceSupabase(): SupabaseClient | null {
  if (typeof window !== "undefined") {
    throw new Error("La clé service_role ne doit jamais être utilisée dans le navigateur.");
  }
  const url = supabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
