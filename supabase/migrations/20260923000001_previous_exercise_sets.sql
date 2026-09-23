-- =============================================================================
-- Migration 3 (Stage 2): "previous values" lookup
--
-- Returns, for each requested exercise id, the sets logged the last time the
-- signed-in user performed that exercise (any workout, most recent by
-- started_at). Used by the active workout screen to show what you did last
-- time. Read-only, security invoker, so Row Level Security still restricts
-- results to the caller's own workouts.
-- =============================================================================

create function public.previous_exercise_sets(p_exercise_ids uuid[])
returns table (exercise_id uuid, sets jsonb)
language sql security invoker stable set search_path = '' as $$
  select distinct on (we.exercise_id)
    we.exercise_id,
    (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'weight_kg', ws.weight_kg, 'reps', ws.reps, 'rpe', ws.rpe, 'is_warmup', ws.is_warmup
               ) order by ws.position
             ), '[]'::jsonb)
      from public.workout_sets ws
      where ws.workout_exercise_id = we.id
    ) as sets
  from public.workout_exercises we
  join public.workouts w on w.id = we.workout_id
  where we.exercise_id = any(p_exercise_ids)
  order by we.exercise_id, w.started_at desc, w.created_at desc, we.id desc;
$$;

revoke all on function public.previous_exercise_sets(uuid[]) from public, anon;
grant execute on function public.previous_exercise_sets(uuid[]) to authenticated;
