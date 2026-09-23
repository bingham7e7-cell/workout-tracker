-- =============================================================================
-- Migration: remap muscle groups to MuscleMap's 21-group set
--
-- The body diagram now uses the @musclemap/react library, whose most detailed
-- muscle set has 21 groups (vs. our previous 18). Our muscle_groups.id values
-- are set to MuscleMap's own group names, lowercased (e.g. "SHOULDERS_FRONT"
-- -> "shoulders_front"), so converting between the two is a pure string
-- case-change with no lookup table (see src/components/MuscleDiagram.tsx).
--
-- No real user data exists yet, so this is a clean reseed rather than a
-- data migration: exercise_muscles is rebuilt from scratch for every
-- existing exercise that matches a default exercise by name. Any manually
-- edited muscle mappings on custom exercises are not preserved.
-- =============================================================================

delete from public.exercise_muscles;
delete from public.muscle_groups;

insert into public.muscle_groups (id, name, sort_order) values
  ('chest',           'Chest',         1),
  ('shoulders_front', 'Front delts',   2),
  ('shoulders_side',  'Side delts',    3),
  ('shoulders_rear',  'Rear delts',    4),
  ('trapezius',       'Traps',         5),
  ('rhomboids',       'Rhomboids',     6),
  ('back_upper',      'Upper back',    7),
  ('lats',            'Lats',          8),
  ('back_lower',      'Lower back',    9),
  ('biceps',          'Biceps',       10),
  ('triceps',         'Triceps',      11),
  ('forearms',        'Forearms',     12),
  ('core',            'Abs',          13),
  ('obliques',        'Obliques',     14),
  ('hip_flexors',     'Hip flexors',  15),
  ('glutes',          'Glutes',       16),
  ('quads',           'Quads',        17),
  ('hamstrings',      'Hamstrings',   18),
  ('adductors',       'Adductors',    19),
  ('abductors',       'Abductors',    20),
  ('calves',          'Calves',       21);

-- Rename old ids to their MuscleMap equivalents in the default library
-- (chest, biceps, triceps, forearms, lats, obliques, glutes, quads,
-- hamstrings, adductors and calves keep the same id).
update app_private.default_exercises set
  primary_muscles = array(
    select case m
      when 'front_delts' then 'shoulders_front'
      when 'side_delts'  then 'shoulders_side'
      when 'rear_delts'  then 'shoulders_rear'
      when 'traps'       then 'trapezius'
      when 'upper_back'  then 'back_upper'
      when 'lower_back'  then 'back_lower'
      when 'abs'         then 'core'
      else m
    end
    from unnest(primary_muscles) m
  ),
  secondary_muscles = array(
    select case m
      when 'front_delts' then 'shoulders_front'
      when 'side_delts'  then 'shoulders_side'
      when 'rear_delts'  then 'shoulders_rear'
      when 'traps'       then 'trapezius'
      when 'upper_back'  then 'back_upper'
      when 'lower_back'  then 'back_lower'
      when 'abs'         then 'core'
      else m
    end
    from unnest(secondary_muscles) m
  );

-- MuscleMap's most detailed set adds three groups this library never tracked:
-- rhomboids, hip flexors and abductors. Row/rear-delt work also recruits the
-- rhomboids, and hanging leg raises and lunges recruit the hip flexors, so
-- those exercises gain a secondary mapping; two exercises are added so
-- abductors and hip flexors also have at least one primary mapping.
update app_private.default_exercises set secondary_muscles = array_append(secondary_muscles, 'rhomboids')
  where name in ('Face Pull', 'Barbell Row', 'Dumbbell Row', 'Seated Cable Row', 'T-Bar Row', 'Rear Delt Fly');
update app_private.default_exercises set secondary_muscles = array_append(secondary_muscles, 'hip_flexors')
  where name in ('Hanging Leg Raise', 'Walking Lunge');

insert into app_private.default_exercises (name, equipment, primary_muscles, secondary_muscles) values
  ('Hip Abduction Machine', 'Machine', '{abductors}',   '{glutes}'),
  ('Cable Hip Flexion',     'Cable',   '{hip_flexors}', '{}')
on conflict (name) do nothing;

-- Give every existing user the two new default exercises above, the same
-- way app_private.provision_user does for a brand-new user.
insert into public.exercises (user_id, name, equipment)
select distinct e.user_id, d.name, d.equipment
from public.exercises e
cross join app_private.default_exercises d
where d.name in ('Hip Abduction Machine', 'Cable Hip Flexion')
on conflict (user_id, lower(btrim(name))) do nothing;

-- Rebuild exercise_muscles for every exercise (existing or just added above)
-- that matches a default exercise by name.
insert into public.exercise_muscles (exercise_id, user_id, muscle_group_id, role)
select e.id, e.user_id, m.muscle, m.role
from public.exercises e
join app_private.default_exercises d on lower(btrim(e.name)) = lower(btrim(d.name))
cross join lateral (
  select unnest(d.primary_muscles) as muscle, 'primary' as role
  union all
  select unnest(d.secondary_muscles), 'secondary'
) m
on conflict (exercise_id, muscle_group_id) do nothing;
