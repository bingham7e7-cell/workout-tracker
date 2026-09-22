import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

let client: SupabaseClient | undefined;

/** Supabase client for use in the browser (client components). */
export function getSupabaseBrowser(): SupabaseClient {
  if (!client) {
    const { url, key } = supabaseEnv();
    client = createBrowserClient(url, key);
  }
  return client;
}
