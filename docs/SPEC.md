# Workout Tracker — Original Specification

> This is the original product specification, saved verbatim. It is the source of truth
> for scope. Reviewers check each stage against this document.

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
