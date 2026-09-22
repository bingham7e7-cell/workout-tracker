-- =============================================================================
-- Migration 1: initial schema
--   Tables, constraints, Row Level Security, and the save/edit functions.
--
-- Conventions
--   * Every user-owned table has user_id -> auth.users, and an RLS policy
--     "user_id = auth.uid()". Child tables use composite foreign keys
--     (parent_id, user_id) so a row can never point at another user's data.
--   * Weights are stored in kilograms (weight_kg numeric(8,3)).
--   * Only FINISHED workouts are stored. The in-progress workout lives on the
--     device until "Finish".
-- =============================================================================

create schema if not exists app_private;

-- -----------------------------------------------------------------------------
-- Shared reference data: muscle groups (read-only for users)
-- -----------------------------------------------------------------------------
create table public.muscle_groups (
  id          text primary key check (id ~ '^[a-z_]{1,40}$'),
  name        text not null,
  sort_order  integer not null default 0
);

insert into public.muscle_groups (id, name, sort_order) values
  ('chest',       'Chest',              1),
  ('front_delts', 'Front delts',        2),
  ('side_delts',  'Side delts',         3),
  ('rear_delts',  'Rear delts',         4),
  ('biceps',      'Biceps',             5),
  ('triceps',     'Triceps',            6),
  ('forearms',    'Forearms',           7),
  ('traps',       'Traps',              8),
  ('upper_back',  'Upper back',         9),
  ('lats',        'Lats',              10),
  ('lower_back',  'Lower back',        11),
  ('abs',         'Abs',               12),
  ('obliques',    'Obliques',          13),
  ('glutes',      'Glutes',            14),
  ('quads',       'Quads',             15),
  ('hamstrings',  'Hamstrings',        16),
  ('adductors',   'Adductors',         17),
  ('calves',      'Calves',            18);

-- -----------------------------------------------------------------------------
-- Profiles: one row per user
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  weight_unit  text not null default 'lb' check (weight_unit in ('lb', 'kg')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Exercise library (each user has their own copy)
-- -----------------------------------------------------------------------------
create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 100),
  equipment    text check (equipment is null or char_length(equipment) <= 50),
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id)
);
create unique index exercises_user_name_key on public.exercises (user_id, lower(btrim(name)));

create table public.exercise_muscles (
  exercise_id      uuid not null,
  user_id          uuid not null default auth.uid(),
  muscle_group_id  text not null references public.muscle_groups (id),
  role             text not null check (role in ('primary', 'secondary')),
  primary key (exercise_id, muscle_group_id),
  foreign key (exercise_id, user_id) references public.exercises (id, user_id) on delete cascade
);
create index exercise_muscles_user_idx on public.exercise_muscles (user_id);

-- -----------------------------------------------------------------------------
-- Templates
-- -----------------------------------------------------------------------------
create table public.templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  notes       text check (notes is null or char_length(notes) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index templates_user_idx on public.templates (user_id);

create table public.template_exercises (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null,
  user_id      uuid not null default auth.uid(),
  exercise_id  uuid not null,
  position     integer not null check (position >= 0),
  target_sets  integer check (target_sets is null or target_sets between 1 and 20),
  target_reps  integer check (target_reps is null or target_reps between 1 and 100),
  unique (template_id, position),
  foreign key (template_id, user_id) references public.templates (id, user_id) on delete cascade,
  -- An exercise used in a template can't be deleted (archive it instead).
  -- Checked at commit (deferred), so deleting a whole user account still cascades cleanly.
  foreign key (exercise_id, user_id) references public.exercises (id, user_id)
    on delete no action deferrable initially deferred
);
create index template_exercises_user_idx on public.template_exercises (user_id);
create index template_exercises_exercise_idx on public.template_exercises (exercise_id);

-- -----------------------------------------------------------------------------
-- Completed workouts
-- -----------------------------------------------------------------------------
create table public.workouts (
  -- Generated on the phone when the workout starts; doubles as the
  -- idempotency key that makes duplicate saves impossible.
  id           uuid primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Null once the template is deleted; the name below is a snapshot.
  template_id  uuid,
  name         text not null check (char_length(btrim(name)) between 1 and 100),
  started_at   timestamptz not null,
  finished_at  timestamptz not null,
  notes        text check (notes is null or char_length(notes) <= 2000),
  -- Where the workout came from: 'app' or e.g. 'import:strong' in the future.
  source       text not null default 'app' check (source ~ '^[a-z0-9_.:-]{1,50}$'),
  -- ID in the source system, so a future import can be re-run without duplicates.
  external_id  text check (external_id is null or char_length(external_id) <= 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id),
  check (finished_at >= started_at),
  foreign key (template_id, user_id) references public.templates (id, user_id)
    on delete set null (template_id)
);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);
create unique index workouts_import_key on public.workouts (user_id, source, external_id)
  where external_id is not null;

create table public.workout_exercises (
  id             uuid primary key default gen_random_uuid(),
  workout_id     uuid not null,
  user_id        uuid not null default auth.uid(),
  exercise_id    uuid not null,
  -- Snapshot of the exercise's name on the day, so renames don't rewrite history.
  exercise_name  text not null check (char_length(btrim(exercise_name)) between 1 and 100),
  position       integer not null check (position >= 0),
  notes          text check (notes is null or char_length(notes) <= 1000),
  unique (id, user_id),
  unique (workout_id, position),
  foreign key (workout_id, user_id) references public.workouts (id, user_id) on delete cascade,
  -- Exercises with history can't be deleted (archive them instead).
  -- Checked at commit (deferred), so deleting a whole user account still cascades cleanly.
  foreign key (exercise_id, user_id) references public.exercises (id, user_id)
    on delete no action deferrable initially deferred
);
create index workout_exercises_user_idx on public.workout_exercises (user_id);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

create table public.workout_sets (
  id                   uuid primary key default gen_random_uuid(),
  workout_exercise_id  uuid not null,
  user_id              uuid not null default auth.uid(),
  position             integer not null check (position >= 0),
  weight_kg            numeric(8, 3) not null check (weight_kg between 0 and 1000),
  reps                 integer not null check (reps between 0 and 999),
  rpe                  numeric(3, 1) check (rpe is null or (rpe between 1 and 10 and rpe * 2 = trunc(rpe * 2))),
  is_warmup            boolean not null default false,
  unique (workout_exercise_id, position),
  foreign key (workout_exercise_id, user_id)
    references public.workout_exercises (id, user_id) on delete cascade
);
create index workout_sets_user_idx on public.workout_sets (user_id);

-- -----------------------------------------------------------------------------
-- updated_at maintenance
-- -----------------------------------------------------------------------------
create function app_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch  before update on public.profiles  for each row execute function app_private.touch_updated_at();
create trigger exercises_touch before update on public.exercises for each row execute function app_private.touch_updated_at();
create trigger templates_touch before update on public.templates for each row execute function app_private.touch_updated_at();
create trigger workouts_touch  before update on public.workouts  for each row execute function app_private.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.muscle_groups      enable row level security;
alter table public.profiles           enable row level security;
alter table public.exercises          enable row level security;
alter table public.exercise_muscles   enable row level security;
alter table public.templates          enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workouts           enable row level security;
alter table public.workout_exercises  enable row level security;
alter table public.workout_sets       enable row level security;

create policy "muscle groups are readable" on public.muscle_groups
  for select to authenticated using (true);

create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own rows" on public.exercises
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.exercise_muscles
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.templates
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.template_exercises
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.workouts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.workout_exercises
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.workout_sets
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select on public.muscle_groups to authenticated;
grant select, insert, update, delete on
  public.profiles, public.exercises, public.exercise_muscles, public.templates,
  public.template_exercises, public.workouts, public.workout_exercises, public.workout_sets
  to authenticated;
-- Signed-out visitors get nothing.
revoke all on
  public.muscle_groups, public.profiles, public.exercises, public.exercise_muscles,
  public.templates, public.template_exercises, public.workouts, public.workout_exercises,
  public.workout_sets
  from anon;

-- -----------------------------------------------------------------------------
-- Workout save / edit
--
-- Payload shape (weights already converted to kg by the app):
-- {
--   "id": "<uuid>", "name": "Push Day", "template_id": "<uuid>|null",
--   "started_at": "<iso>", "finished_at": "<iso>", "notes": "..."|null,
--   "exercises": [
--     { "exercise_id": "<uuid>", "notes": null,
--       "sets": [ { "weight_kg": 100, "reps": 5, "rpe": 8|null, "is_warmup": false } ] }
--   ]
-- }
-- These run as the calling user (security invoker), so RLS still applies.
-- -----------------------------------------------------------------------------

-- Inserts the exercises and sets of a workout. p_old_names maps exercise_id ->
-- the name previously recorded in this workout, so editing keeps the snapshot.
create function app_private.insert_workout_contents(
  p_workout_id uuid, p_user_id uuid, p_exercises jsonb, p_old_names jsonb
) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_ex      record;
  v_we_id   uuid;
  v_name    text;
  v_ex_id   uuid;
begin
  if p_exercises is null or jsonb_typeof(p_exercises) <> 'array' or jsonb_array_length(p_exercises) = 0 then
    raise exception 'A workout needs at least one exercise' using errcode = '22023';
  end if;
  if jsonb_array_length(p_exercises) > 50 then
    raise exception 'Too many exercises (max 50)' using errcode = '22023';
  end if;

  for v_ex in select value, ordinality from jsonb_array_elements(p_exercises) with ordinality loop
    v_ex_id := (v_ex.value ->> 'exercise_id')::uuid;

    if jsonb_typeof(v_ex.value -> 'sets') is distinct from 'array'
       or jsonb_array_length(v_ex.value -> 'sets') = 0 then
      raise exception 'Each exercise needs at least one set' using errcode = '22023';
    end if;
    if jsonb_array_length(v_ex.value -> 'sets') > 50 then
      raise exception 'Too many sets for one exercise (max 50)' using errcode = '22023';
    end if;

    v_name := p_old_names ->> v_ex_id::text;
    if v_name is null then
      select e.name into v_name from public.exercises e where e.id = v_ex_id;
      if v_name is null then
        raise exception 'Exercise % not found', v_ex_id using errcode = '23503';
      end if;
    end if;

    insert into public.workout_exercises (workout_id, user_id, exercise_id, exercise_name, position, notes)
    values (p_workout_id, p_user_id, v_ex_id, v_name, v_ex.ordinality - 1,
            nullif(btrim(v_ex.value ->> 'notes'), ''))
    returning id into v_we_id;

    insert into public.workout_sets (workout_exercise_id, user_id, position, weight_kg, reps, rpe, is_warmup)
    select v_we_id, p_user_id, s.ordinality - 1,
           (s.value ->> 'weight_kg')::numeric,
           (s.value ->> 'reps')::integer,
           (s.value ->> 'rpe')::numeric,
           coalesce((s.value ->> 'is_warmup')::boolean, false)
    from jsonb_array_elements(v_ex.value -> 'sets') with ordinality as s;
  end loop;
end;
$$;

-- Saves a finished workout in one transaction. Idempotent: calling it again
-- with the same workout id does nothing and reports {"duplicate": true}.
create function public.save_workout(p_workout jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid  uuid := auth.uid();
  v_id   uuid;
  v_rows integer;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  v_id := (p_workout ->> 'id')::uuid;
  if v_id is null then
    raise exception 'Workout id is required' using errcode = '22023';
  end if;

  insert into public.workouts (id, user_id, template_id, name, started_at, finished_at, notes)
  values (
    v_id, v_uid,
    -- If the template was deleted mid-workout, just drop the link.
    (select t.id from public.templates t where t.id = (p_workout ->> 'template_id')::uuid),
    btrim(p_workout ->> 'name'),
    (p_workout ->> 'started_at')::timestamptz,
    (p_workout ->> 'finished_at')::timestamptz,
    nullif(btrim(p_workout ->> 'notes'), '')
  )
  on conflict (id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    -- RLS means this only sees the caller's own workouts.
    if not exists (select 1 from public.workouts w where w.id = v_id) then
      raise exception 'Workout id already in use' using errcode = '23505';
    end if;
    -- Already saved (double tap / retry). Nothing to do.
    return jsonb_build_object('id', v_id, 'duplicate', true);
  end if;

  perform app_private.insert_workout_contents(v_id, v_uid, p_workout -> 'exercises', '{}'::jsonb);
  return jsonb_build_object('id', v_id, 'duplicate', false);
end;
$$;

-- Replaces the contents of an existing workout in one transaction.
-- Exercise names already recorded in the workout keep their original snapshot.
create function public.update_workout(p_workout jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid       uuid := auth.uid();
  v_id        uuid;
  v_old_names jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  v_id := (p_workout ->> 'id')::uuid;

  perform 1 from public.workouts w where w.id = v_id for update;
  if not found then
    raise exception 'Workout not found' using errcode = 'P0002';
  end if;

  update public.workouts set
    name        = btrim(p_workout ->> 'name'),
    started_at  = (p_workout ->> 'started_at')::timestamptz,
    finished_at = (p_workout ->> 'finished_at')::timestamptz,
    notes       = nullif(btrim(p_workout ->> 'notes'), '')
  where id = v_id;

  select coalesce(jsonb_object_agg(we.exercise_id::text, we.exercise_name), '{}'::jsonb)
    into v_old_names
    from public.workout_exercises we where we.workout_id = v_id;

  delete from public.workout_exercises where workout_id = v_id;
  perform app_private.insert_workout_contents(v_id, v_uid, p_workout -> 'exercises', v_old_names);
  return jsonb_build_object('id', v_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Template save (create or update, replacing its exercise list)
-- {
--   "id": "<uuid>" (generated by the app for new templates), "name": "Push A", "notes": null,
--   "exercises": [ { "exercise_id": "<uuid>", "target_sets": 3|null, "target_reps": 8|null } ]
-- }
-- -----------------------------------------------------------------------------
create function public.save_template(p_template jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid := (p_template ->> 'id')::uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if jsonb_typeof(p_template -> 'exercises') is distinct from 'array' then
    raise exception 'exercises must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_template -> 'exercises') > 50 then
    raise exception 'Too many exercises (max 50)' using errcode = '22023';
  end if;

  -- The app generates the id up front, so a retried "create" becomes an update
  -- instead of a second copy of the template.
  if v_id is null then
    v_id := gen_random_uuid();
  end if;
  update public.templates
     set name = btrim(p_template ->> 'name'),
         notes = nullif(btrim(p_template ->> 'notes'), '')
   where id = v_id;
  if found then
    delete from public.template_exercises where template_id = v_id;
  else
    insert into public.templates (id, user_id, name, notes)
    values (v_id, v_uid, btrim(p_template ->> 'name'), nullif(btrim(p_template ->> 'notes'), ''));
  end if;

  insert into public.template_exercises (template_id, user_id, exercise_id, position, target_sets, target_reps)
  select v_id, v_uid, (e.value ->> 'exercise_id')::uuid, e.ordinality - 1,
         (e.value ->> 'target_sets')::integer, (e.value ->> 'target_reps')::integer
  from jsonb_array_elements(p_template -> 'exercises') with ordinality as e;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Create a custom exercise together with its muscle mapping (one transaction)
-- { "name": "Zercher Squat", "equipment": "Barbell"|null,
--   "primary": ["quads"], "secondary": ["glutes","abs"] }
-- -----------------------------------------------------------------------------
create function public.create_exercise(p_exercise jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if jsonb_typeof(p_exercise -> 'primary') is distinct from 'array'
     or jsonb_array_length(p_exercise -> 'primary') = 0 then
    raise exception 'Pick at least one primary muscle' using errcode = '22023';
  end if;

  insert into public.exercises (user_id, name, equipment)
  values (v_uid, btrim(p_exercise ->> 'name'), nullif(btrim(p_exercise ->> 'equipment'), ''))
  returning id into v_id;

  insert into public.exercise_muscles (exercise_id, user_id, muscle_group_id, role)
  select v_id, v_uid, m.value, 'primary'
    from jsonb_array_elements_text(p_exercise -> 'primary') m
  union
  select v_id, v_uid, m.value, 'secondary'
    from jsonb_array_elements_text(coalesce(p_exercise -> 'secondary', '[]'::jsonb)) m
   where m.value not in (select jsonb_array_elements_text(p_exercise -> 'primary'));

  return v_id;
end;
$$;

grant usage on schema app_private to authenticated;
revoke all on function app_private.insert_workout_contents(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function app_private.insert_workout_contents(uuid, uuid, jsonb, jsonb) to authenticated;
revoke all on function public.save_workout(jsonb)   from public, anon;
revoke all on function public.update_workout(jsonb) from public, anon;
revoke all on function public.save_template(jsonb)  from public, anon;
revoke all on function public.create_exercise(jsonb) from public, anon;
grant execute on function public.save_workout(jsonb)   to authenticated;
grant execute on function public.update_workout(jsonb) to authenticated;
grant execute on function public.save_template(jsonb)  to authenticated;
grant execute on function public.create_exercise(jsonb) to authenticated;
