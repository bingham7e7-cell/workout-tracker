-- =============================================================================
-- Migration: AI plan import
--
-- No AI runs inside the app. The user copies a ready-made prompt (built
-- client-side from their own exercise library) to paste into an AI of their
-- choice, pastes the reply back in, and reviews a full preview before
-- saving. This migration adds the "Added by import" tag for exercises the
-- import creates, and the transactional save function.
-- =============================================================================

alter table public.exercises
  add column added_via text check (added_via is null or added_via = 'import');

-- -----------------------------------------------------------------------------
-- Saves an AI-imported plan: its workout templates and any new exercises,
-- together in one transaction (a failure never leaves a half-imported plan).
-- The client has already: extracted/validated the AI's JSON, matched
-- exercise names to the user's library, and let the user fix any problems
-- (a new exercise needs a name + at least one primary muscle; this function
-- re-checks that as a last line of defence).
--
-- {
--   "plan_name": "...",
--   "workouts": [
--     { "name": "...", "exercises": [
--         { "kind": "matched", "exercise_id": "<uuid>", "sets": 3, "reps": 10 },
--         { "kind": "new", "name": "...", "primary": ["chest"], "secondary": [],
--           "sets": 3, "reps": 10 }
--     ] }
--   ]
-- }
-- -----------------------------------------------------------------------------
create function public.import_plan(p_plan jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_uid          uuid := auth.uid();
  v_plan_id      uuid;
  v_workout      jsonb;
  v_template_id  uuid;
  v_ex           jsonb;
  v_exercise_id  uuid;
  v_plan_position integer := 0;
  v_ex_position   integer;
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if jsonb_typeof(p_plan -> 'workouts') is distinct from 'array' or jsonb_array_length(p_plan -> 'workouts') = 0 then
    raise exception 'A plan needs at least one workout' using errcode = '22023';
  end if;

  insert into public.plans (id, user_id, name) values (gen_random_uuid(), v_uid, btrim(p_plan ->> 'plan_name'))
  returning id into v_plan_id;

  for v_workout in select * from jsonb_array_elements(p_plan -> 'workouts') loop
    if jsonb_typeof(v_workout -> 'exercises') is distinct from 'array' or jsonb_array_length(v_workout -> 'exercises') = 0 then
      raise exception 'Each workout needs at least one exercise' using errcode = '22023';
    end if;

    insert into public.templates (id, user_id, name) values (gen_random_uuid(), v_uid, btrim(v_workout ->> 'name'))
    returning id into v_template_id;

    v_ex_position := 0;
    for v_ex in select * from jsonb_array_elements(v_workout -> 'exercises') loop
      if (v_ex ->> 'kind') = 'new' then
        if jsonb_typeof(v_ex -> 'primary') is distinct from 'array' or jsonb_array_length(v_ex -> 'primary') = 0 then
          raise exception 'New exercise "%" needs at least one primary muscle', (v_ex ->> 'name') using errcode = '22023';
        end if;

        insert into public.exercises (user_id, name, added_via)
        values (v_uid, btrim(v_ex ->> 'name'), 'import')
        returning id into v_exercise_id;

        insert into public.exercise_muscles (exercise_id, user_id, muscle_group_id, role)
        select v_exercise_id, v_uid, m.value, 'primary'
          from jsonb_array_elements_text(v_ex -> 'primary') m
        union
        select v_exercise_id, v_uid, m.value, 'secondary'
          from jsonb_array_elements_text(coalesce(v_ex -> 'secondary', '[]'::jsonb)) m
         where m.value not in (select jsonb_array_elements_text(v_ex -> 'primary'));
      else
        v_exercise_id := (v_ex ->> 'exercise_id')::uuid;
        if not exists (select 1 from public.exercises e where e.id = v_exercise_id and e.user_id = v_uid) then
          raise exception 'Exercise not found' using errcode = '23503';
        end if;
      end if;

      insert into public.template_exercises (template_id, user_id, exercise_id, position, target_sets, target_reps)
      values (v_template_id, v_uid, v_exercise_id, v_ex_position, (v_ex ->> 'sets')::integer, (v_ex ->> 'reps')::integer);
      v_ex_position := v_ex_position + 1;
    end loop;

    insert into public.plan_workouts (plan_id, user_id, template_id, position)
    values (v_plan_id, v_uid, v_template_id, v_plan_position);
    v_plan_position := v_plan_position + 1;
  end loop;

  return v_plan_id;
end;
$$;

revoke all on function public.import_plan(jsonb) from public, anon;
grant execute on function public.import_plan(jsonb) to authenticated;
