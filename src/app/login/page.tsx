"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { describeError } from "@/lib/client/errors";

/**
 * Email sign-in. Supabase emails a magic link AND a 6-digit code.
 * The code matters on iPhone: a Home Screen app can't receive the link
 * (it opens in Safari instead), so you type the code here.
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const linkFailed = useSearchParams().get("error") === "link";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setBusy(false);
    if (error) setError(describeError(error));
    else setStep("code");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowser().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) {
      setError(/expired|invalid/i.test(error.message) ? "That code is wrong or has expired." : describeError(error));
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 pt-safe pb-safe">
      <h1 className="mb-2 text-3xl font-bold">Workout Tracker</h1>
      {step === "email" ? (
        <form onSubmit={sendEmail} className="space-y-4">
          <p className="text-zinc-400">Sign in with your email. We&apos;ll send you a code.</p>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-14 w-full rounded-xl bg-zinc-900 px-4 outline-none ring-1 ring-zinc-800 focus:ring-emerald-500"
          />
          <button
            disabled={busy}
            className="h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-zinc-950 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <p className="text-zinc-400">
            Check <span className="text-zinc-100">{email}</span>. Enter the code from the email, or tap the
            link in it if you&apos;re in Safari.
          </p>
          <input
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="h-14 w-full rounded-xl bg-zinc-900 px-4 text-center text-2xl tracking-[0.4em] outline-none ring-1 ring-zinc-800 focus:ring-emerald-500"
          />
          <button
            disabled={busy || code.length < 6}
            className="h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-zinc-950 disabled:opacity-50"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="h-12 w-full text-zinc-400"
          >
            Use a different email
          </button>
        </form>
      )}
      {error && <p className="mt-4 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      {linkFailed && !error && step === "email" && (
        <p className="mt-4 rounded-lg bg-amber-950 p-3 text-amber-200">
          That sign-in link didn&apos;t work here (it may have expired or been opened in a different app). Request a
          new email and type the 6-digit code instead.
        </p>
      )}
    </main>
  );
}
