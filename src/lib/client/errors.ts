/** Turns a Supabase/network error into a plain-language message. */
export function describeError(error: unknown): string {
  const e = error as { code?: string; message?: string; name?: string } | null;
  const message = e?.message ?? String(error);
  if (e?.name === "AbortError" || e?.name === "TimeoutError" || /timed? ?out|aborted/i.test(message)) {
    return "The server took too long to respond. Check your connection and try again.";
  }
  if (/failed to fetch|network|load failed/i.test(message) || (typeof navigator !== "undefined" && !navigator.onLine)) {
    return "No internet connection. Your data is still on this phone — try again when you're back online.";
  }
  if (e?.code === "28000" || /jwt|not signed in|auth/i.test(message)) {
    return "You've been signed out. Sign in again — nothing on this phone has been lost.";
  }
  if (e?.code === "23505") return "That name is already in use.";
  return `Something went wrong (${message.replace(/\.$/, "")}).`;
}

/** Timeout signal for database calls, so a stuck request never hangs the app. */
export function timeoutSignal(ms = 20_000): AbortSignal {
  return AbortSignal.timeout(ms);
}
