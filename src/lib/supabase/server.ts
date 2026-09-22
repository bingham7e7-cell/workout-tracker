import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseEnv } from "./env";

/** Supabase client for server components, route handlers and server actions. */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component, where cookies are read-only.
          // The proxy refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** Returns the signed-in user's id, or sends them to the login page. */
export async function requireUserId(): Promise<string> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) redirect("/login");
  return sub;
}
