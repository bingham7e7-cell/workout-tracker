# Workout Tracker — Original Specification

> This is the original product specification, saved verbatim below. It is the source of truth
> for scope. Reviewers check each stage against this document, read together with the
> "Updates since the original spec" section right below.

## Updates since the original spec (2026-09-23)

The owner has confirmed two changes to how the app is used, made **after** Stage 1 shipped.
They don't change the database schema or require any redesign — the schema was already built
multi-user-ready per the original spec's last line ("structure the database so multiple users
could be supported later without requiring a major redesign").

1. **The app is now multi-user for real.** Other people besides the owner will sign up and use
   it. Every table already has `user_id` + a Row Level Security policy restricting rows to
   `user_id = auth.uid()` (see `docs/ARCHITECTURE.md` §5), so one user can never see another's
   data. Because of this:
   - `docs/SETUP.md` step 9 ("turn off new sign-ups") no longer applies and has been removed —
     new sign-ups must stay **on**.
   - There are no admin screens or ability for the owner to see other users' data — nobody
     gets special access, including the owner. That was true from Stage 1 and remains true.
2. **Sign-in is the 6-digit emailed code** (Supabase OTP), sent through **Resend SMTP** on the
   owner's own domain rather than Supabase's shared, rate-limited sender. This was already
   built in Stage 1 (`src/app/login/page.tsx`, `docs/SETUP.md` §3.5–4) as the fix for the
   "magic links don't work in an installed iPhone Home Screen app" risk identified in
   `docs/ARCHITECTURE.md` §7. The original spec's "email magic link" line below is superseded
   by this; the magic link still works as a fallback in Safari.

## Feature additions after Stage 6 (2026-09-24)

With the original six stages complete and shipped, the owner requested six further features,
built in this order (see `docs/ARCHITECTURE.md` for the schema/architecture detail behind each):

1. **Body diagram replaced with MuscleMap.** The original hand-drawn geometric SVG diagram is
   replaced by the open-source `@musclemap/react` library (MIT, pinned to an exact version),
   isolated behind a single `src/components/MuscleDiagram.tsx` so the rest of the app never
   imports the library directly. Muscle groups were remapped to MuscleMap's most detailed
   21-group set (adding rhomboids, hip flexors, and abductors, which the app didn't track
   before). Attribution is in Settings > Credits.
2. **Rolling plans.** A plan is an ordered, repeating list of workout templates (e.g. Push,
   Pull, Legs) with no calendar days or rest days. Users create/edit/reorder/delete plans and
   choose one active plan. Finishing the workout a plan currently suggests advances it
   (matched by template, looping back to the start after the last one); finishing a different
   workout leaves the plan where it is. Skipping (with confirmation) moves the plan forward
   without deleting anything from it. Starting any workout at any time still works exactly as
   before. Plans are private per user via RLS, like every other table.
3. **New home screen layout,** top to bottom: the muscle diagram, a 7-day strip (today
   rightmost, an empty circle or a red filled circle with a checkmark for a day a workout was
   completed), then either a "Next up" card for the active plan (Start + Skip) or a plain
   "Start workout" button if there's no active plan. Quick-start (templates, a blank workout)
   and Recent stay below, unchanged.
   - **Time zones.** Every timestamp is still stored in UTC. A new per-user setting
     (Settings > Time zone: Automatic — the original device-local behavior — or UTC) controls
     how dates/times are *displayed* everywhere in the app: the day strip, history, workout
     details, and progress charts.
4. **Transparent muscle math.** Each exercise's detail screen shows a small diagram (primary
   muscles in the strong color, secondary in a lighter one) and a plain-language credit
   breakdown ("Primary (100% credit per set): Chest, Front delts. Secondary (50% credit per
   set): Triceps."), plus a new "How the muscle map works" screen (linked from every diagram's
   legend) explaining the full formula — sets, RPE effort, primary/secondary credit, and how
   workload fades over time. The explanation text and the real calculation are built from the
   same shared constants in `src/lib/domain/workload.ts`, so they can't disagree.
5. **Starter plans.** Three original, generic routines — Full Body (3 rotating workouts),
   Upper/Lower (Upper A, Lower A, Upper B, Lower B), and Push/Pull/Legs (3 workouts) — built
   from this app's own exercise library, not copied from any named/branded program. They're
   read-only and shared by every user; copying one (from the plan creation screen's "Start
   from a template") creates the user's own private plan and workout templates, editable
   exactly like anything built by hand.
6. **AI plan import (no AI runs inside the app).** "Build a plan with AI" on the plan creation
   screen copies a ready-made prompt to the clipboard — the user's own exercise list (including
   custom exercises), the valid muscle groups, and the exact JSON reply format — for the user
   to paste into an AI assistant of their choice. The pasted reply is extracted from any
   surrounding prose, validated, and each exercise matched to the user's library by exact,
   case-insensitive name. An unreadable or invalid reply shows plain-language problems and a
   "Copy fix request" button (a message to paste back to the AI). A valid reply shows a full
   preview labelling each exercise Matched or New; a New exercise can be renamed, have its
   muscles edited, or be swapped for an existing exercise, and saving is blocked until every
   New exercise has at least one primary muscle, only valid muscle names, and no name that
   duplicates an existing exercise. Saving creates the new exercises (tagged "Added by
   import"), the workout templates, and the plan together in one transaction.
   - *Simplification:* the AI's suggested rep range and RPE are shown in the preview for
     context, but `template_exercises` (like every hand-built template) only stores a single
     target rep count, so the range collapses to its rounded midpoint at save time; RPE isn't
     persisted on the template at all, since no template in the app carries one.

Nothing else about scope, staging, or priorities changes.

Build a mobile-first personal strength-training progressive web app using Next.js, TypeScript, Tailwind CSS, Supabase, and PostgreSQL.

This is a personal-use app optimized primarily for iPhone. Prioritize reliability, fast workout entry, simple architecture, and maintainable code over unnecessary complexity.

## ABOUT ME
I am not a professional developer. Explain decisions in plain language, and give me clear step-by-step instructions for anything I need to do myself (creating the Supabase project, setting environment variables, running migrations, deploying, installing the app on my iPhone).

## CORE WORKOUT FUNCTIONALITY
- Create, edit, duplicate, and delete reusable workout templates.
- Start a workout from a template or as a blank workout.
- Add exercises during a workout.
- Record sets with weight, repetitions, and optional RPE.
- Each set can be marked as a warm-up. Warm-up sets are excluded from workload, personal records, and volume calculations.
- Units: [lbs or kg]. Store weights consistently.
- While logging, display the values from the last time I performed that exercise.
- Edit or delete sets before finishing the workout.
- Finish a workout and save it permanently to PostgreSQL.
- Allow completed workouts to be viewed and edited later.
- Require confirmation before deleting a completed workout.
- Workout data must remain historically accurate even if templates or exercises are later modified.

## EXERCISE AND MUSCLE TRACKING
- Maintain an exercise library. Seed it with about 50 common strength exercises and their muscle mappings.
- Map each exercise to one or more primary and secondary muscle groups.
- Include a front-and-back SVG muscular-body diagram. The SVG must be original, not copied from an existing source.
- After each completed workout, calculate recent muscle workload using:
  - completed working sets (not warm-ups),
  - RPE when available,
  - primary versus secondary muscle involvement,
  - and time since the workout.
- Use a transparent, deterministic formula rather than an AI-generated score.
- Color muscles according to how recently and heavily they were trained.
- Include a legend explaining the colors and the workload calculation.
- Clearly describe the visualization as an estimate of recent training exposure, not medical recovery or readiness.

## TRAINING ANALYTICS
- Workout history.
- Exercise-specific history.
- Personal records.
- Estimated one-repetition maximums using a documented formula.
- Progress charts for weight, repetitions, volume, and estimated 1RM where appropriate.

## MOBILE UX
- Optimize the active workout screen for fast one-handed iPhone use.
- Minimize taps required to enter a set.
- Use large touch targets.
- Make weight and repetition entry easy with the iPhone numeric keyboard.
- Preserve an active workout if the browser refreshes or temporarily loses connectivity.
- Make the app installable as a PWA from Safari using Add to Home Screen.

## DATA AND RELIABILITY
- Use PostgreSQL through Supabase as the persistent source of truth.
- Use Supabase Auth (email magic link) and Row Level Security so every row belongs to a user, even though I am the only user for now.
- Include database migrations.
- Use proper foreign keys and constraints.
- Validate all important input.
- Prevent accidental duplicate workout submissions.
- Handle database failures gracefully.
- Never expose database secrets or service-role keys to the browser.
- Provide CSV and JSON export of all training data.
- Deploy on Vercel.

## TESTING
Add automated tests for:
- creating and saving workouts,
- saving workout sets,
- editing workouts,
- muscle workload calculations,
- estimated 1RM calculations,
- and prevention of duplicate saves.

## OUT OF SCOPE FOR NOW
Rest timers, social features, Apple Health integration, AI coaching.

## DEVELOPMENT PROCESS
Do not attempt to implement the entire application at once.

First, before writing any code:
1. Inspect the repository and existing files.
2. Save this entire spec as docs/SPEC.md.
3. Create a CLAUDE.md summarizing the key rules and constraints so future sessions follow them.
4. Propose the application architecture.
5. Design the PostgreSQL schema and explain the major tables and relationships.
6. Identify assumptions, risks, or areas that could create unnecessary complexity.
7. Then STOP and wait for my approval.

Then implement the application in these stages:
- Stage 1: The complete core workflow: create template → start workout → choose exercise → record sets → finish workout → save to PostgreSQL → view completed workout in history.
- Stage 2: Workout history and editing, template duplication, previous-values display.
- Stage 3: Offline preservation of the active workout and PWA installation.
- Stage 4: Analytics: personal records, estimated 1RM, exercise history, progress charts.
- Stage 5: Muscle workload calculation and body diagram.
- Stage 6: CSV/JSON export, error-handling review, and final polish.

Do not begin advanced analytics, charts, muscle visualization, or offline features until the Stage 1 workflow works reliably.

After Stage 1, walk me step by step through setting up Supabase, merging your work into the main branch, and deploying to Vercel so I can test on my iPhone. Then STOP and wait for me.

After each stage:
- verify that the app builds,
- run relevant tests,
- have an independent reviewer (a subagent that did not write the code) check the stage against docs/SPEC.md and fix any issues it finds,
- identify database changes and tell me if I need to apply any in Supabase,
- briefly explain what was implemented,
- and make a clean Git commit with a descriptive message.

Avoid overengineering. This is initially a single-user personal application, but structure the database so multiple users could be supported later without requiring a major redesign.

Before making any major architectural change after Stage 1, explain why it is necessary rather than silently restructuring the project.
