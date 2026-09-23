# CLAUDE.md — rules for working on this repo

Mobile-first (iPhone) strength-training PWA, **multi-user**: the owner plus anyone else who
signs up, each seeing only their own data.
Stack: Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Auth + PostgreSQL), deployed on Vercel.

- Full spec: `docs/SPEC.md` (source of truth for scope; see its "Updates since the original
  spec" section for the multi-user / auth-provider changes made after Stage 1).
- Architecture & schema: `docs/ARCHITECTURE.md` (keep it updated when design changes).
- Owner setup steps: `docs/SETUP.md` (keep in sync when setup changes).
- Next.js 16 notes (proxy.ts instead of middleware, etc.): see @AGENTS.md.

## The owner
- Not a professional developer. Explain decisions in plain language.
- Give clear step-by-step instructions for anything they must do themselves
  (Supabase setup, env vars, migrations, deploying, iPhone install).
- Before any **major architectural change**, explain why it is necessary and get approval.
  Never silently restructure the project.
- The owner is one user among potentially many, not an admin. Never add owner-only or
  cross-user visibility — every table stays scoped by `user_id` + RLS with no exceptions.

## Auth
- Sign-in is a 6-digit emailed one-time code (Supabase OTP via `verifyOtp`), with a magic-link
  fallback for Safari. Supabase sends these emails over **Resend SMTP** on the owner's own
  domain (`docs/SETUP.md` §3.5), not Supabase's shared rate-limited sender.
- New sign-ups must stay **enabled** — this is a multi-user app now. Do not add anything that
  turns sign-ups off.

## Priorities (in order)
Reliability → fast workout entry → simple architecture → maintainable code.
Avoid overengineering: no ORMs, global state libraries, sync engines, or extra services
unless clearly justified and approved.

## Staged delivery — do not skip ahead
1. Core flow: template → start workout → choose exercise → record sets → finish → save → view in history.
2. History + editing, template duplication, previous-values display.
3. Offline preservation of active workout + PWA install.
4. Analytics: PRs, estimated 1RM, exercise history, progress charts.
5. Muscle workload calculation + original front/back SVG body diagram.
6. CSV/JSON export, error-handling review, polish.

No analytics, charts, muscle visualization, or offline work until Stage 1 works reliably.
Out of scope: rest timers, social, Apple Health, AI coaching.

## After every stage
1. `npm run build` passes.
2. Relevant tests pass (`npm test`).
3. An independent reviewer subagent (did not write the code) checks the stage against
   `docs/SPEC.md`; fix what it finds.
4. List database changes and tell the owner whether they must apply migrations in Supabase.
5. Briefly explain what was implemented.
6. Clean, descriptive Git commit.
After Stage 1: walk the owner through Supabase setup, merging to main, and Vercel deploy; then STOP.

## Data rules
- PostgreSQL (Supabase) is the source of truth. Schema changes ONLY via new files in
  `supabase/migrations/` (never edit an already-applied migration).
- Every user-owned row has `user_id` + RLS policy `user_id = auth.uid()`.
- Proper foreign keys and CHECK constraints. Validate input with zod in the app; the database
  (CHECK constraints + Postgres functions) is the server-side validator, since writes go from
  the browser to Supabase under RLS.
- Weights are stored in **kg** (`weight_kg numeric(8,3)`); convert to/from the user's
  display unit only at the UI edge.
- **Warm-up sets are excluded** from volume, PRs, 1RM, and muscle workload. Always.
- Historical accuracy: workouts snapshot exercise names and template names; exercises with
  history are archived, never deleted; editing templates never changes past workouts.
- Every create is idempotent: ids for new workouts/templates are generated on the device.
- Active workout lives on the device (local storage) until Finish. Saving is one
  transactional, idempotent RPC keyed by a client-generated workout UUID
  (duplicate submissions must be impossible). Only clear the local draft after the DB confirms.
- Deleting a completed workout requires explicit confirmation.
- Handle DB/network failures gracefully: clear message, keep user's data, offer retry.

## Offline / PWA (Stage 3, built)
- `public/sw.js`: network-first, cache-fallback, same-origin GET only — never touches
  Supabase calls. Bump `CACHE_NAME` in that file if a change means old cached pages/assets
  need to be dropped on next deploy (rare; the file's own comment explains why).
- On-device caches (exercise library, previous-set values, the service worker's page
  cache) all get cleared on sign-out (`SettingsForm.tsx`) so a shared phone doesn't show
  one account's data to the next. Add any new offline cache to that same sign-out cleanup.

## Security
- NEVER use or expose the Supabase service-role key or DB password. The app uses only
  `NEXT_PUBLIC_SUPABASE_URL` and the public anon/publishable key; RLS protects data.
- Never commit `.env*` files with real values (only `.env.example`).

## Formulas (keep deterministic and documented)
- Estimated 1RM: Epley `weight × (1 + reps/30)`, reps=1 → weight; only reps 1–12.
- Volume: Σ weight × reps over working sets.
- Muscle workload: see `docs/ARCHITECTURE.md` §6. Must be labelled an estimate of recent
  training exposure, not medical recovery/readiness.

## Mobile UX rules
- Active workout screen: one-handed use, large touch targets (≥44px, prefer 48–56px),
  minimal taps per set, `inputMode="decimal"` for weight and `inputMode="numeric"` for reps.
- Test layouts at iPhone widths (375–430px). Respect safe-area insets.
- Format dates/times on the client (`LocalTime`), never in server components (server is UTC).

## Testing
`npm test` (Vitest). `npm run build` needs `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set (any dummy values work for a build check).
Pure logic in `src/lib/domain` gets unit tests. Database functions
(save/edit workout, set saving, duplicate prevention, RLS) are tested against the real
migrations using PGlite. Required coverage: saving workouts, saving sets, editing workouts,
workload calc, 1RM calc, duplicate-save prevention.

## Git
Develop on the designated feature branch; commit per stage with descriptive messages.
