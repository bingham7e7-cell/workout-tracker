# Architecture

Status: **APPROVED** (2026-09-22). Stage 1 built.

Owner decisions:
- Both lb and kg are supported; **lb is the default** (changeable in Settings).
- **Dark theme** only.
- No data import now, but the schema is import-ready (`workouts.source` + `external_id`).
- **Stage 2 addition:** a rotating "program" (ordered list of templates, home screen shows
  "Next up: Day 4"). One small extra table.
- **Stage 3 addition:** keep an offline copy of templates, exercise library, and previous
  values on the phone so a workout from *any* template can be started with no signal;
  finishing offline keeps the workout on the phone with a "not saved yet" state and saves it
  when back online.

## 1. The big picture (plain language)

```
iPhone (Safari / Home Screen app)
  │
  │  Next.js pages (hosted on Vercel)
  │    • Normal screens (history, templates, analytics) are rendered on the server,
  │      which reads from the database as *you* (your login), so Row Level Security applies.
  │    • The ACTIVE WORKOUT screen runs entirely on the phone. Every tap is saved
  │      to the phone's local storage immediately. Nothing is sent to the database
  │      until you tap "Finish".
  │
  ▼
Supabase
  • Auth: email sign-in (magic link + 6-digit code, see Risk #1)
  • PostgreSQL: the permanent source of truth
  • Row Level Security: every row has a user_id; you can only ever see your own rows
```

**Why the active workout lives on the phone until you finish:**
- Gym Wi-Fi/cell signal is unreliable. Logging a set never waits on the network.
- Refreshing, closing the tab, or losing signal doesn't lose anything (Stage 3 hardens this).
- The database only ever contains *finished*, complete workouts — no half-saved junk.
- Saving becomes one single all-or-nothing database call, which makes duplicate
  prevention simple (see §4).

## 2. Technology choices

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Required by spec; one codebase for UI and server code. |
| Styling | Tailwind CSS | Required; fast to build large, touch-friendly UI. |
| DB / Auth | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | Required. Uses only the **public anon/publishable key** — the service-role key is never needed by this app at all. |
| Input validation | `zod` | One set of rules shared by the browser and the server. The database also enforces its own constraints as a last line of defence. |
| Reads / writes | Pages read on the server (as the signed-in user). Writes go from the browser straight to Supabase: Postgres functions (RPC) for multi-row saves, plain deletes otherwise. | One simple pattern. RLS protects every call. Saving a workout touches 3 tables, so a Postgres function does it in one transaction. Browser-side saves also work with the offline retry in Stage 3. |
| Charts (Stage 4) | Recharts | Common, simple, React-friendly. |
| Body diagram | `@musclemap/react` (pinned, MIT) | Flat-vector front/back muscle diagram with a legend and tap-to-select, isolated behind `src/components/MuscleDiagram.tsx` so the rest of the app never imports it directly. Attribution in Settings > Credits. |
| PWA (Stage 3) | Hand-written `manifest.webmanifest` + small service worker | PWA plugins for Next.js break often across versions; a ~50-line worker is easier to maintain. |
| Unit tests | Vitest | Fast, TypeScript-native. |
| DB tests | Vitest + **PGlite** (real Postgres compiled to WebAssembly, runs in-process) | Lets us run the real migrations and test the save/edit/duplicate logic and RLS without Docker or a live Supabase project. |
| Hosting | Vercel | Required. |

Deliberately **not** used: global state libraries (Redux etc.), an ORM (Prisma/Drizzle),
GraphQL, a separate API server, background jobs. None are needed at this scale.

## 3. Folder layout

```
src/
  app/
    login/                   email sign-in
    auth/confirm/            magic-link landing route
    (app)/                   everything behind login
      page.tsx               home: start workout, recent workouts
      templates/             list / create / edit / duplicate / delete
      workout/               ACTIVE workout (client-side)
      history/               completed workouts; [id] view + edit
      exercises/             library + per-exercise history (Stage 4)
      analytics/             PRs, charts (Stage 4), muscle map (Stage 5)
      settings/              units, export (Stage 6)
  components/                UI pieces (SetRow, NumberInput, BodyDiagram, ...)
  lib/
    supabase/                browser + server client helpers, auth middleware
    domain/                  PURE functions, no database: units, 1RM, volume,
                             workload, workout draft reducer, zod schemas
    data/                    database queries & server actions
supabase/
  migrations/                numbered .sql files (schema, RLS, functions, seed)
tests/                       unit tests + PGlite database tests
docs/                        SPEC.md, ARCHITECTURE.md, SETUP.md
```

The math (1RM, volume, workload) lives in `lib/domain` as plain functions so it is easy
to test and easy to read.

## 4. How saving works (reliability & duplicate prevention)

1. When you start a workout, the phone generates a random ID (UUID) for it.
2. Sets are stored in local storage as you log them.
3. "Finish" sends the whole workout to a Postgres function `save_workout(payload)`:
   - validates input (also validated by zod before sending),
   - inserts the workout, its exercises and its sets **in one transaction**
     (all saved or nothing saved),
   - uses the phone-generated ID as the primary key. If the same workout arrives twice
     (double tap, retry after a timeout, flaky network), the second call sees the ID
     already exists and simply returns it — **no duplicate is ever created**.
4. The Finish button is disabled while saving. If saving fails, the draft stays on the
   phone and you get a clear "Couldn't save — Retry" message. The draft is only cleared
   after the database confirms success.
5. Editing a completed workout uses `update_workout(payload)`, which replaces that
   workout's exercises and sets in one transaction.

## 5. Database schema

All user-owned tables have a `user_id` column referencing `auth.users`, and an RLS policy
"`user_id = auth.uid()`" for select/insert/update/delete. Adding more users later requires
no redesign. Child tables use a **composite foreign key** `(parent_id, user_id)` so a row can
never point at another user's data, even by a bug.

```
auth.users (managed by Supabase)
   │ 1
   ├──── 1 profiles            (preferred unit)
   ├──── * exercises ──────* exercise_muscles *──── 1 muscle_groups (shared reference list)
   ├──── * templates ──────* template_exercises ──→ exercises
   └──── * workouts  ──────* workout_exercises  ──→ exercises
                                   └──────* workout_sets
```

### Tables

**`muscle_groups`** — shared, read-only reference list. 21 rows, matching the
`@musclemap/react` body-diagram library's most detailed muscle set: `chest`,
`shoulders_front/side/rear`, `trapezius`, `rhomboids`, `back_upper`, `lats`, `back_lower`,
`biceps`, `triceps`, `forearms`, `core`, `obliques`, `hip_flexors`, `glutes`, `quads`,
`hamstrings`, `adductors`, `abductors`, `calves`. `id` is a text slug that is also
MuscleMap's own group name lowercased (e.g. `shoulders_front` ↔ `SHOULDERS_FRONT`), so
`src/components/MuscleDiagram.tsx` converts between them with no lookup table. Readable
by any signed-in user.

**`profiles`** — one row per user: `id` (= auth user id), `weight_unit` (`'kg'|'lb'`),
`time_zone_mode` (`'auto'|'utc'` — how dates/times are *displayed*; every timestamp is
still stored in UTC), `active_plan_id`/`active_plan_position` (see `plans` below),
`created_at`. Created automatically on first sign-in by a database trigger.

**`exercises`** — the library: `id`, `user_id`, `name`, `equipment` (optional),
`archived_at` (null = active), timestamps. Unique on `(user_id, lower(name))`.
The ~50 default exercises are **copied into your library** on first sign-in, so you can
rename them, fix their muscles, or add your own — everything is uniformly "yours".
Exercises used in history are **archived, never hard-deleted** (the database refuses
the delete via a deferred `NO ACTION` foreign key, which still lets a whole account be deleted).

**`exercise_muscles`** — `exercise_id`, `muscle_group_id`, `role` (`'primary'|'secondary'`).
Primary key `(exercise_id, muscle_group_id)`. At least one primary per exercise is enforced
in the app.

**`templates`** — `id`, `user_id`, `name`, `notes`, timestamps.

**`template_exercises`** — `id`, `template_id` (cascade delete), `exercise_id`, `position`,
`target_sets` (optional), `target_reps` (optional). Duplicating a template = copying these rows.

**`plans`** — `id`, `user_id`, `name`, timestamps. An ordered, repeating list of workout
templates (e.g. Push, Pull, Legs) — no calendar days, no rest days.

**`plan_workouts`** — `id`, `plan_id` (cascade delete), `template_id` (cascade delete — a plan
points at *live* templates, not a snapshot), `position`. `profiles.active_plan_id` (nullable)
+ `active_plan_position` track which plan is active and where in its rotation the user is.
Finishing the workout at that position (matched by `template_id`, inside `save_workout`)
advances the position, looping back to 0 after the last one; finishing any other workout, or
`skip_active_plan()`, moves the position without changing the plan's contents. A trigger on
`profiles` rejects pointing `active_plan_id` at another user's plan and resets the position to
0 whenever the active plan changes.

**`starter_plans` / `starter_plan_workouts` / `starter_plan_exercises`** — built-in, read-only,
shared by every user (RLS: select-only, no `user_id`). Three original, generic routines (Full
Body, Upper/Lower, Push/Pull/Legs) built from this app's own exercise library. `copy_starter_plan(id)`
copies one into the caller's own `plans`/`templates`/`template_exercises` in one transaction,
matching `starter_plan_exercises.exercise_name` to the caller's own exercise by name (an
exercise the user doesn't have, e.g. deleted, is silently skipped rather than failing the copy).

**`workouts`** — completed workouts only. `id` (client-generated UUID), `user_id`,
`template_id` (nullable, `ON DELETE SET NULL`), `name` (snapshot, e.g. "Push Day"),
`started_at`, `finished_at`, `notes`, timestamps. Check: `finished_at >= started_at`.

**`workout_exercises`** — `id`, `workout_id` (cascade delete), `exercise_id`
(deletion blocked while referenced), **`exercise_name` (snapshot)**, `position`, `notes`.

**`workout_sets`** — `id`, `workout_exercise_id` (cascade delete), `position`,
`weight_kg numeric(8,3)`, `reps int`, `rpe numeric(3,1) null`, `is_warmup bool`.
Checks: `weight_kg between 0 and 1000`, `reps between 0 and 999` (the app requires ≥ 1;
0 is allowed in the DB for future imports of failed attempts), `rpe between 1 and 10` in 0.5
steps. Only sets that were ticked ✓ are saved.

### How historical accuracy is guaranteed
- Workouts **copy** exercises from a template when started; later template edits or
  deletes don't touch past workouts (`template_id` just becomes null, the name snapshot stays).
- Each logged exercise stores the exercise **name as it was that day**.
- Exercises that have history can only be archived, never deleted.
- Muscle mappings are *not* snapshotted: if you correct an exercise's muscles, the
  (derived, estimated) workload map uses the corrected mapping. The recorded
  weights/reps/sets never change.

### Weight units
All weights are stored in **kilograms** (`weight_kg`, 3 decimals) regardless of display
unit, so data is always consistent. Your preferred unit (`profiles.weight_unit`) controls
what you type and see; conversion happens at the edges. 3 decimals means 225 lb round-trips
back to exactly 225 lb on screen.

### Postgres functions
- `save_workout(payload jsonb)` — idempotent insert (see §4).
- `update_workout(payload jsonb)` — transactional replace of a workout's contents
  (DB function built and tested in Stage 1; the editing screen arrives in Stage 2).
- `save_template(payload jsonb)` — create/update a template and its exercise list.
- `create_exercise(payload jsonb)` — custom exercise + its muscle mapping in one step.
- `app_private.provision_user()` via an `auth.users` trigger — creates the profile and copies
  the default exercise library (stored in `app_private.default_exercises`).

`app_private` is a schema Supabase does not expose over its API.

### Import-readiness
`workouts.source` (`'app'`, or e.g. `'import:strong'`) and `workouts.external_id` with a unique
index on `(user_id, source, external_id)`, so a future importer can re-run without creating
duplicates.

All user-callable functions run as `SECURITY INVOKER` (as you), so RLS still applies inside
them. Only the new-user setup trigger runs with elevated rights, and users can't call it.

## 6. Formulas (documented up front so they're transparent)

**Estimated 1RM — Epley:** `e1RM = weight × (1 + reps / 30)`; for 1 rep, `e1RM = weight`.
Only computed for working sets with 1–12 reps (accuracy drops sharply above ~12).

**Volume:** `Σ weight × reps` over working (non-warm-up) sets.

**Muscle workload (Stage 5, built):** for each working set in the last 21 days, for each muscle it hits:

```
contribution = effort × role × recency
  effort  = RPE known ? clamp(RPE / 10, 0.5, 1.0) : 0.8
  role    = 1.0 if primary muscle, 0.5 if secondary
  recency = 0.5 ^ (hours since workout finished / 48)   (halves every 48 h)
muscle workload = sum of contributions  ("effective recent sets")
```

Colors by bucket, e.g. 0 = untrained, <2 light, 2–5 moderate, 5–9 high, ≥9 very high.
The screen states this is an estimate of recent training exposure, **not** medical
recovery or readiness.

The 21-day query window (not 7) is intentional: with a 48-hour half-life, a set is
still worth ~9–13% of its starting contribution at day 6–7, so a hard 7-day cutoff
would visibly and abruptly drop weight that should still be fading out smoothly. 21
days is where a contribution is under 0.1% of its start — effectively zero — so
nothing the formula would otherwise count is missed.

## 6.5. Offline support (Stage 3, built)

- **Service worker** (`public/sw.js`, ~50 lines): network-first, cache-fallback for every
  same-origin GET request. No build-time precache list (Next's static filenames are
  content-hashed per deploy) — pages and assets are cached as they're actually visited.
  Supabase calls are a different origin, so the worker never touches saving/loading real
  data; it only lets the last-visited screens (and the JS/CSS needed to run them) open
  with no signal. `manifest.webmanifest` + the icons in `public/icons/` make the app
  installable from Safari.
- **Exercise library & "last time" values**: cached in `localStorage`
  (`src/components/ExercisePicker.tsx`, `src/lib/client/previousSetsCache.ts`) on every
  successful fetch, read back instantly on the next load, and refreshed in the background
  when online. Templates need no separate cache — they arrive embedded in the home page's
  own HTML, which the service worker already caches.
- **Finishing offline**: tapping Finish immediately marks the draft `finishedAt` in local
  storage, before the network call — so closing the app mid-failure still shows "finished,
  not saved yet" rather than reverting to "in progress". The workout screen retries the
  same idempotent `save_workout`/`update_workout` RPCs automatically on load, on the
  browser's `online` event, and every 20s in between (iOS doesn't always fire `online`
  reliably), until it succeeds.
- **Sign-out clears all three on-device caches** (`SettingsForm.tsx`'s `signOut()`): the
  exercise-library cache, the previous-values cache, and the service worker's whole
  Cache Storage. This is what actually protects a shared phone — as long as the
  previous person signs out first, the next account starts from nothing cached and
  refetches everything online before anything offline-dependent is shown.
- **Known limitation**: this only helps if the previous person actually signs out.
  The service worker's page cache is keyed by URL only, not by account, so if someone
  closes the app without signing out and a different account signs in on the same
  phone and browser, the very first offline screen before the next successful online
  load could briefly show the previous account's last-cached page. Not a concern for
  one person per phone (the expected case); flagged here rather than solved further,
  per CLAUDE.md's "avoid overengineering."

## 7. Assumptions, risks, and complexity traps

### Assumptions (tell me if any are wrong)
1. **Unit:** the spec left "[lbs or kg]" unfilled. Plan: store kg, display your choice,
   default **lb** (changeable in Settings). → *Please confirm your unit.*
2. **Bodyweight exercises** (pull-ups, dips): you enter *added* weight (0 for bodyweight).
   Volume for those will show as 0 unless added load is used. Tracking bodyweight is out of scope.
3. Only **finished** workouts go to the database; an in-progress workout exists only on
   the device where you started it.
4. Only weight/reps/RPE/warm-up per set. No supersets, tempo, distance/time, or cardio.
5. Multi-user in practice now (you plus anyone else who signs up); still no admin screens —
   Row Level Security is the only thing that scopes data per user, by design.

### Risks
1. **Magic links + iPhone Home Screen apps don't mix well.** An installed PWA has storage
   separate from Safari. Tapping the link in the email opens *Safari*, so you'd be signed
   in there but not in the Home Screen app. **Mitigation:** the login screen also accepts
   the **6-digit code** from the same email (a Supabase feature; needs a one-line email
   template change I'll walk you through). You type the code inside the app. Sessions last
   a long time, so this is rare.
2. **iOS may clear website storage** for sites not used in a while. Installed Home Screen
   apps are treated better, and drafts are only needed for the duration of a workout, so
   the practical risk is small. The database remains the source of truth.
3. **Supabase free tier pauses projects after ~1 week of inactivity.** If you take a
   break, you may need to click "Restore" in the Supabase dashboard. Your data is kept.
4. **Supabase's built-in email sender is rate-limited** (a few emails per hour). Fine for
   one user; if it becomes annoying, a custom SMTP can be added later.
5. **Next.js changes quickly;** we'll pin versions in `package-lock.json`.

### Complexity I'm intentionally avoiding
- No full offline-first sync engine. Only the *active* workout is preserved offline;
  history and analytics require a connection. This covers the spec with ~5% of the effort.
- No per-set network saves during a workout (one save at the end).
- Analytics are computed in TypeScript from your sets, not with complex SQL views or
  pre-computed tables. A single user's data (even years) is small enough.
- No custom muscle-mapping snapshots per workout (see §5).
- No service-role key anywhere; no admin backend.
