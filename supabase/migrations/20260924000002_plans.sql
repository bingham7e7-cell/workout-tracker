-- =============================================================================
-- Migration: rolling plans
--
-- A plan is an ordered, repeating list of workout templates (e.g. Push, Pull,
-- Legs) with no calendar days or rest days. A user has zero or one active
-- plan; `active_plan_position` is a RANK (0-indexed, wrapped with modulo)
-- among the plan's *current* rows ordered by position — not compared
-- against the position column directly, since positions can develop gaps
-- (deleting a mid-plan template cascades its row away) or the plan can
-- shrink. The home screen shows the workout at that rank. Finishing that
-- exact workout (matched by template id) advances the rank, looping back to
-- 0 after the last one. Finishing a different workout, or skipping, moves
-- the rank without touching the plan's contents. Plans reference *live*
-- templates (not a snapshot) — editing a template changes what the plan
-- shows next, same as starting it directly.
-- =============================================================================

create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id)
);
create index plans_user_idx on public.plans (user_id);
create trigger plans_touch before update on public.plans for each row execute function app_private.touch_updated_at();

create table public.plan_workouts (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null,
  user_id      uuid not null default auth.uid(),
  template_id  uuid not null,
  position     integer not null check (position >= 0),
  unique (plan_id, position),
  foreign key (plan_id, user_id) references public.plans (id, user_id) on delete cascade,
  -- Plans point at live templates, not a snapshot: deleting a template that's
  -- part of a plan just removes it from the rotation.
  foreign key (template_id, user_id) references public.templates (id, user_id) on delete cascade
);
create index plan_workouts_user_idx on public.plan_workouts (user_id);
create index plan_workouts_template_idx on public.plan_workouts (template_id);

alter table public.profiles
  add column active_plan_id uuid references public.plans (id) on delete set null,
  add column active_plan_position integer not null default 0 check (active_plan_position >= 0);

-- Keeps active_plan_id honest (can't point at another user's plan, even via
-- a direct table update) and always resets position to 0 when the active
-- plan changes, so switching plans starts at the beginning.
create function app_private.validate_active_plan() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.active_plan_id is distinct from old.active_plan_id then
    if new.active_plan_id is not null and not exists (
      select 1 from public.plans where id = new.active_plan_id and user_id = new.id
    ) then
      raise exception 'Not your plan' using errcode = '42501';
    end if;
    new.active_plan_position := 0;
  end if;
  return new;
end;
$$;
create trigger profiles_validate_active_plan
  before update of active_plan_id on public.profiles
  for each row execute function app_private.validate_active_plan();

alter table public.plans          enable row level security;
alter table public.plan_workouts  enable row level security;

create policy "own rows" on public.plans
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own rows" on public.plan_workouts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.plans, public.plan_workouts to authenticated;
revoke all on public.plans, public.plan_workouts from anon;

-- -----------------------------------------------------------------------------
-- Plan save (create or update, replacing its ordered workout list)
-- { "id": "<uuid>"|null, "name": "My split", "template_ids": ["<uuid>", ...] }
-- -----------------------------------------------------------------------------
create function public.save_plan(p_plan jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid := (p_plan ->> 'id')::uuid;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if jsonb_typeof(p_plan -> 'template_ids') is distinct from 'array'
     or jsonb_array_length(p_plan -> 'template_ids') = 0 then
    raise exception 'A plan needs at least one workout' using errcode = '22023';
  end if;
  if jsonb_array_length(p_plan -> 'template_ids') > 50 then
    raise exception 'Too many workouts in a plan (max 50)' using errcode = '22023';
  end if;

  if v_id is null then
    v_id := gen_random_uuid();
  end if;
  update public.plans set name = btrim(p_plan ->> 'name') where id = v_id;
  if found then
    delete from public.plan_workouts where plan_id = v_id;
  else
    insert into public.plans (id, user_id, name) values (v_id, v_uid, btrim(p_plan ->> 'name'));
  end if;

  insert into public.plan_workouts (plan_id, user_id, template_id, position)
  select v_id, v_uid, (t.value)::uuid, t.ordinality - 1
  from jsonb_array_elements_text(p_plan -> 'template_ids') with ordinality as t;

  return v_id;
end;
$$;

-- Moves the active plan's position to the next workout without finishing
-- one. A no-op if there's no active plan (or it has no workouts).
create function public.skip_active_plan() returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  select count(*) into v_count
    from public.plan_workouts pw
    join public.profiles p on p.active_plan_id = pw.plan_id
   where p.id = v_uid;
  if v_count = 0 then
    return;
  end if;
  update public.profiles set active_plan_position = (active_plan_position + 1) % v_count where id = v_uid;
end;
$$;

-- Extends save_workout (defined in the initial schema) to advance the active
-- plan when the finished workout is the one the plan currently suggests
-- (matched by template id). Finishing any other workout leaves the plan
-- untouched. Runs only when a workout is newly saved, not on a duplicate
-- retry (which would otherwise double-advance).
create or replace function public.save_workout(p_workout jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid              uuid := auth.uid();
  v_id               uuid;
  v_rows             integer;
  v_plan_count       integer;
  v_plan_rank        integer;
  v_plan_template_id uuid;
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
    (select t.id from public.templates t where t.id = (p_workout ->> 'template_id')::uuid),
    btrim(p_workout ->> 'name'),
    (p_workout ->> 'started_at')::timestamptz,
    (p_workout ->> 'finished_at')::timestamptz,
    nullif(btrim(p_workout ->> 'notes'), '')
  )
  on conflict (id) do nothing;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    if not exists (select 1 from public.workouts w where w.id = v_id) then
      raise exception 'Workout id already in use' using errcode = '23505';
    end if;
    return jsonb_build_object('id', v_id, 'duplicate', true);
  end if;

  perform app_private.insert_workout_contents(v_id, v_uid, p_workout -> 'exercises', '{}'::jsonb);

  -- Advance the active plan, if any, when the finished workout is the one it
  -- currently suggests. `plan_workouts.position` values can develop gaps
  -- (deleting a template mid-plan cascades its row away) or the plan can
  -- simply shrink, so `active_plan_position` is a RANK among the plan's
  -- *current* rows (0-indexed by position, wrapped with modulo) — never
  -- compared against the raw position column directly. This mirrors exactly
  -- how the home screen picks "next up" (src/lib/data/queries.ts).
  select count(*) into v_plan_count
    from public.plan_workouts pw
    join public.profiles p on p.active_plan_id = pw.plan_id
   where p.id = v_uid;

  if v_plan_count > 0 then
    select p.active_plan_position % v_plan_count into v_plan_rank
      from public.profiles p where p.id = v_uid;

    select pw.template_id into v_plan_template_id
      from public.plan_workouts pw
      join public.profiles p on p.active_plan_id = pw.plan_id
     where p.id = v_uid
     order by pw.position
     offset v_plan_rank limit 1;

    if v_plan_template_id = (p_workout ->> 'template_id')::uuid then
      update public.profiles set active_plan_position = (v_plan_rank + 1) % v_plan_count where id = v_uid;
    end if;
  end if;

  return jsonb_build_object('id', v_id, 'duplicate', false);
end;
$$;

revoke all on function public.save_plan(jsonb)      from public, anon;
revoke all on function public.skip_active_plan()     from public, anon;
grant execute on function public.save_plan(jsonb)     to authenticated;
grant execute on function public.skip_active_plan()   to authenticated;
