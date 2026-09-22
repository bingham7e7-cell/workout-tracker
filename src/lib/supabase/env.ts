/**
 * Public Supabase settings. Both values are safe to expose to the browser:
 * the publishable (anon) key only allows what Row Level Security permits.
 * NEVER put the service-role key in this app.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. See docs/SETUP.md.",
    );
  }
  return { url, key };
}
