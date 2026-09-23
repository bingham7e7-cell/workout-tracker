-- =============================================================================
-- Migration: starter plans
--
-- Built-in, read-only plans shared by every user. Copying one creates the
-- user's own private plan and workout templates (from their own exercise
-- library) that they can then edit or delete freely — the starter plan
-- itself never changes. These are original, generic routines built from
-- this app's own exercise library; not copied from any branded program.
-- =============================================================================

create table public.starter_plans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  integer not null default 0
);

create table public.starter_plan_workouts (
  id               uuid primary key default gen_random_uuid(),
  starter_plan_id  uuid not null references public.starter_plans (id) on delete cascade,
  name             text not null,
  position         integer not null check (position >= 0),
  unique (starter_plan_id, position)
);

create table public.starter_plan_exercises (
  id                       uuid primary key default gen_random_uuid(),
  starter_plan_workout_id  uuid not null references public.starter_plan_workouts (id) on delete cascade,
  -- Matched by name (case-insensitive) to the copying user's own exercise
  -- library at copy time — not a foreign key, since it must resolve
  -- per-user (everyone has their own copy of the default exercises).
  exercise_name            text not null,
  position                 integer not null check (position >= 0),
  target_sets              integer check (target_sets is null or target_sets between 1 and 20),
  target_reps              integer check (target_reps is null or target_reps between 1 and 100),
  unique (starter_plan_workout_id, position)
);

alter table public.starter_plans          enable row level security;
alter table public.starter_plan_workouts  enable row level security;
alter table public.starter_plan_exercises enable row level security;

create policy "starter plans are readable" on public.starter_plans
  for select to authenticated using (true);
create policy "starter plan workouts are readable" on public.starter_plan_workouts
  for select to authenticated using (true);
create policy "starter plan exercises are readable" on public.starter_plan_exercises
  for select to authenticated using (true);

grant select on public.starter_plans, public.starter_plan_workouts, public.starter_plan_exercises to authenticated;
revoke all on public.starter_plans, public.starter_plan_workouts, public.starter_plan_exercises from anon;

-- -----------------------------------------------------------------------------
-- Seed data: three original, generic starter plans.
-- -----------------------------------------------------------------------------
do $$
declare
  v_plan uuid;
  v_workout uuid;
begin
  -- Full Body (3 workouts, rotating)
  insert into public.starter_plans (name, sort_order) values ('Full Body', 1) returning id into v_plan;

  insert into public.starter_plan_workouts (starter_plan_id, name, position) values (v_plan, 'Full Body 1', 0) returning id into v_workout;
  insert into public.starter_plan_exercises (starter_plan_workout_id, exercise_name, position, target_sets, target_reps) values
    (v_workout, 'Back Squat',           0, 3, 5),
    (v_workout, 'Barbell Bench Press',  1, 3, 8),
    (v_workout, 'Barbell Row',          2, 3, 8),
    (v_workout, 'Standing Calf Raise',  3, 3, 12),
    (v_workout, 'Hanging Leg Raise',    4, 3, 12);

  insert into public.starter_plan_workouts (starter_plan_id, name, position) values (v_plan, 'Full Body 2', 1) returning id into v_workout;
  insert into public.starter_plan_exercises (starter_plan_workout_id, exercise_name, position, target_sets, target_reps) values
    (v_workout, 'Deadlift',       0, 3, 5),
    (v_workout, 'Overhead Press', 1, 3, 8),
    (v_workout, 'Lat Pulldown',   2, 3, 10),
    (v_workout, 'Leg Press',      3, 3, 10),
    (v_workout, 'Cable Crunch',   4, 3, 15);

  insert into public.starter_plan_workouts (starter_plan_id, name, position) values (v_plan, 'Full Body 3', 2) returning id into v_workout;
  insert into public.starter_plan_exercises (starter_plan_workout_id, exercise_name, position, target_sets, target_reps) values
    (v_workout, 'Front Squat',            0, 3, 8),
    (v_workout, 'Incline Dumbbell Press', 1, 3, 10),
    (v_workout, 'Seated Cable Row',       2, 3, 10),
    (v_workout, 'Romanian Deadlift',      3, 3, 8),
    (v_workout, 'Ab Wheel Rollout',       4, 3, 10);

  -- Upper/Lower (4 workouts: Upper A, Lower A, Upper B, Lower B)
  insert into public.starter_plans (name, sort_order) values ('Upper/Lower', 2) returning id into v_plan;

  insert into public.starter_plan_workouts (starter_plan_id, name, position) values (v_plan, 'Upper A', 0) returning id into v_workout;
  insert into public.starter_plan_exercises (starter_plan_workout_id, exercise_name, position, target_sets, target_reps) values
    (v_workout, 'Barbell Bench Press', 0, 4, 6),
    (v_workout, 'Barbell Row',         1, 4, 8),
    (v_workout, 'Overhead Press',      2, 3, 8),
    (v_workout, 'Lat Pulldown',        3, 3, 10),
    (v_workout, 'Barbell Curl',        4, 3, 12),
    (v_workout, 'Triceps Pushdown',    5, 3, 12);

  insert into public.starter_plan_workouts (starter_plan_id, name, position) values (v_plan, 'Lower A', 1) returning id into v_workout;
  insert into public.starter_plan_exercises (starter_plan_workout_id, exercise_name, position, target_sets, target_reps) values
    (v_workout, 'Back Squat',          0, 4, 6),
    (v_workout, 'Romanian Deadlift',   1, 3, 8),
    (v_workout, 'Leg Press',           2, 3, 10),
    (v_workout, 'Standing Calf Raise', 3, 3, 15),
    (v_workout, 'Hanging Leg Raise',   4, 3, 12);

  insert into public.starter_plan_workouts (starter_plan_id, name, position) values (v_plan, 'Upper B', 2) returning id into v_workout;
  insert into public.starter_plan_exercises (starter_plan_workout_id, exercise_name, position, target_sets, target_reps) values
    (v_workout, 'Incline Dumbbell Press',      0, 4, 8),
    (v_workout, 'Seated Cable Row',            1, 4, 8),
    (v_workout, 'Arnold Press',                2, 3, 10),
    (v_workout, 'Chin-Up',                     3, 3, 8),
    (v_workout, 'Hammer Curl',                 4, 3, 12),
    (v_workout, 'Overhead Triceps Extension',  5, 3, 12);

  insert into public.starter_plan_workouts (starter_plan_id, name, position) values (v_plan, 'Lower B', 3) returning id into v_workout;
  insert into public.starter_plan_exercises (starter_plan_workout_id, exercise_name, position, target_sets, target_reps) values
    (v_workout, 'Front Squat',       0, 4, 8),
    (v_workout, 'Hip Thrust',        1, 3, 10),
    (v_workout, 'Lying Leg Curl',    2, 3, 12),
    (v_workout, 'Seated Calf Raise', 3, 3, 15),
    (v_workout, 'Cable Crunch',      4, 3, 15);

  -- Push/Pull/Legs (3 workouts)
  insert into public.starter_plans (name, sort_order) values ('Push/Pull/Legs', 3) returning id into v_plan;

  insert into public.starter_plan_workouts (starter_plan_id, name, position) values (v_plan, 'Push', 0) returning id into v_workout;
  insert into public.starter_plan_exercises (starter_plan_workout_id, exercise_name, position, target_sets, target_reps) values
    (v_workout, 'Barbell Bench Press',    0, 4, 6),
    (v_workout, 'Overhead Press',         1, 3, 8),
    (v_workout, 'Incline Dumbbell Press', 2, 3, 10),
    (v_workout, 'Lateral Raise',          3, 3, 15),
    (v_workout, 'Triceps Pushdown',       4, 3, 12);

  insert into public.starter_plan_workouts (starter_plan_id, name, position) values (v_plan, 'Pull', 1) returning id into v_workout;
  insert into public.starter_plan_exercises (starter_plan_workout_id, exercise_name, position, target_sets, target_reps) values
    (v_workout, 'Deadlift',    0, 3, 5),
    (v_workout, 'Pull-Up',     1, 3, 8),
    (v_workout, 'Barbell Row', 2, 3, 8),
    (v_workout, 'Face Pull',   3, 3, 15),
    (v_workout, 'Barbell Curl',4, 3, 10);

  insert into public.starter_plan_workouts (starter_plan_id, name, position) values (v_plan, 'Legs', 2) returning id into v_workout;
  insert into public.starter_plan_exercises (starter_plan_workout_id, exercise_name, position, target_sets, target_reps) values
    (v_workout, 'Back Squat',          0, 4, 6),
    (v_workout, 'Romanian Deadlift',   1, 3, 8),
    (v_workout, 'Leg Press',           2, 3, 10),
    (v_workout, 'Leg Extension',       3, 3, 12),
    (v_workout, 'Standing Calf Raise', 4, 3, 15);
end $$;

-- -----------------------------------------------------------------------------
-- Copies a starter plan into the caller's own plans/templates in one
-- transaction. Exercises are matched by name to the caller's own library;
-- one the caller doesn't have (e.g. deleted) is silently skipped rather than
-- failing the whole copy.
--
-- Idempotent like every other create in this app: p_plan_id is generated on
-- the device, so a retry after a lost reply (the transaction committed, but
-- the client never heard back) returns the same plan id instead of copying
-- the starter plan a second time.
-- -----------------------------------------------------------------------------
create function public.copy_starter_plan(p_starter_plan_id uuid, p_plan_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid          uuid := auth.uid();
  v_plan_name    text;
  v_new_plan_id  uuid := p_plan_id;
  v_workout      record;
  v_template_id  uuid;
  v_position     integer := 0;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if exists (select 1 from public.plans where id = p_plan_id) then
    if not exists (select 1 from public.plans where id = p_plan_id and user_id = v_uid) then
      raise exception 'Plan id already in use' using errcode = '23505';
    end if;
    return p_plan_id; -- Already copied (retry after a lost reply) — nothing more to do.
  end if;

  select name into v_plan_name from public.starter_plans where id = p_starter_plan_id;
  if v_plan_name is null then
    raise exception 'Starter plan not found' using errcode = 'P0002';
  end if;

  insert into public.plans (id, user_id, name) values (v_new_plan_id, v_uid, v_plan_name);

  for v_workout in
    select id, name from public.starter_plan_workouts
    where starter_plan_id = p_starter_plan_id order by position
  loop
    insert into public.templates (id, user_id, name) values (gen_random_uuid(), v_uid, v_workout.name)
    returning id into v_template_id;

    insert into public.template_exercises (template_id, user_id, exercise_id, position, target_sets, target_reps)
    select v_template_id, v_uid, e.id, spe.position, spe.target_sets, spe.target_reps
    from public.starter_plan_exercises spe
    join public.exercises e on e.user_id = v_uid and lower(btrim(e.name)) = lower(btrim(spe.exercise_name))
    where spe.starter_plan_workout_id = v_workout.id;

    insert into public.plan_workouts (plan_id, user_id, template_id, position)
    values (v_new_plan_id, v_uid, v_template_id, v_position);
    v_position := v_position + 1;
  end loop;

  return v_new_plan_id;
end;
$$;

revoke all on function public.copy_starter_plan(uuid, uuid) from public, anon;
grant execute on function public.copy_starter_plan(uuid, uuid) to authenticated;
