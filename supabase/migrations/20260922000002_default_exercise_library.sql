-- =============================================================================
-- Migration 2: default exercise library + new-user setup
--
-- The default library below is copied into each user's own `exercises` table
-- the first time they sign in, so they can rename/edit/extend it freely.
-- =============================================================================

create table app_private.default_exercises (
  name               text primary key,
  equipment          text,
  primary_muscles    text[] not null,
  secondary_muscles  text[] not null default '{}'
);
-- Internal reference data: only the new-user setup function reads it.
-- RLS on with no policies + no grants = app users can never read or change it.
alter table app_private.default_exercises enable row level security;
revoke all on app_private.default_exercises from public, anon, authenticated;

insert into app_private.default_exercises (name, equipment, primary_muscles, secondary_muscles) values
  -- Chest
  ('Barbell Bench Press',         'Barbell',    '{chest}',                        '{front_delts,triceps}'),
  ('Incline Barbell Bench Press', 'Barbell',    '{chest,front_delts}',            '{triceps}'),
  ('Dumbbell Bench Press',        'Dumbbell',   '{chest}',                        '{front_delts,triceps}'),
  ('Incline Dumbbell Press',      'Dumbbell',   '{chest,front_delts}',            '{triceps}'),
  ('Machine Chest Press',         'Machine',    '{chest}',                        '{front_delts,triceps}'),
  ('Dumbbell Fly',                'Dumbbell',   '{chest}',                        '{front_delts}'),
  ('Cable Crossover',             'Cable',      '{chest}',                        '{front_delts}'),
  ('Push-Up',                     'Bodyweight', '{chest}',                        '{front_delts,triceps,abs}'),
  ('Dip',                         'Bodyweight', '{chest,triceps}',                '{front_delts}'),
  -- Shoulders
  ('Overhead Press',              'Barbell',    '{front_delts}',                  '{side_delts,triceps,traps}'),
  ('Seated Dumbbell Shoulder Press','Dumbbell', '{front_delts}',                  '{side_delts,triceps}'),
  ('Arnold Press',                'Dumbbell',   '{front_delts,side_delts}',       '{triceps}'),
  ('Lateral Raise',               'Dumbbell',   '{side_delts}',                   '{traps}'),
  ('Cable Lateral Raise',         'Cable',      '{side_delts}',                   '{}'),
  ('Upright Row',                 'Barbell',    '{side_delts,traps}',             '{biceps}'),
  ('Rear Delt Fly',               'Dumbbell',   '{rear_delts}',                   '{upper_back}'),
  ('Face Pull',                   'Cable',      '{rear_delts}',                   '{upper_back,traps}'),
  ('Barbell Shrug',               'Barbell',    '{traps}',                        '{forearms}'),
  -- Back
  ('Deadlift',                    'Barbell',    '{hamstrings,glutes,lower_back}', '{quads,traps,upper_back,forearms}'),
  ('Sumo Deadlift',               'Barbell',    '{glutes,hamstrings,adductors}',  '{quads,lower_back,traps,forearms}'),
  ('Romanian Deadlift',           'Barbell',    '{hamstrings,glutes}',            '{lower_back,forearms}'),
  ('Good Morning',                'Barbell',    '{hamstrings,lower_back}',        '{glutes}'),
  ('Pull-Up',                     'Bodyweight', '{lats}',                         '{biceps,upper_back,forearms}'),
  ('Chin-Up',                     'Bodyweight', '{lats,biceps}',                  '{upper_back,forearms}'),
  ('Lat Pulldown',                'Cable',      '{lats}',                         '{biceps,upper_back}'),
  ('Straight-Arm Pulldown',       'Cable',      '{lats}',                         '{triceps}'),
  ('Barbell Row',                 'Barbell',    '{upper_back,lats}',              '{rear_delts,biceps,lower_back}'),
  ('Dumbbell Row',                'Dumbbell',   '{lats,upper_back}',              '{rear_delts,biceps}'),
  ('Seated Cable Row',            'Cable',      '{upper_back,lats}',              '{rear_delts,biceps}'),
  ('T-Bar Row',                   'Barbell',    '{upper_back,lats}',              '{rear_delts,biceps,lower_back}'),
  ('Back Extension',              'Bodyweight', '{lower_back}',                   '{glutes,hamstrings}'),
  -- Arms
  ('Barbell Curl',                'Barbell',    '{biceps}',                       '{forearms}'),
  ('Dumbbell Curl',               'Dumbbell',   '{biceps}',                       '{forearms}'),
  ('Hammer Curl',                 'Dumbbell',   '{biceps,forearms}',              '{}'),
  ('Preacher Curl',               'EZ Bar',     '{biceps}',                       '{}'),
  ('Cable Curl',                  'Cable',      '{biceps}',                       '{forearms}'),
  ('Close-Grip Bench Press',      'Barbell',    '{triceps,chest}',                '{front_delts}'),
  ('Triceps Pushdown',            'Cable',      '{triceps}',                      '{}'),
  ('Overhead Triceps Extension',  'Cable',      '{triceps}',                      '{}'),
  ('Skull Crusher',               'EZ Bar',     '{triceps}',                      '{}'),
  ('Wrist Curl',                  'Dumbbell',   '{forearms}',                     '{}'),
  -- Legs
  ('Back Squat',                  'Barbell',    '{quads,glutes}',                 '{adductors,hamstrings,lower_back}'),
  ('Front Squat',                 'Barbell',    '{quads}',                        '{glutes,abs,upper_back}'),
  ('Leg Press',                   'Machine',    '{quads,glutes}',                 '{adductors,hamstrings}'),
  ('Hack Squat',                  'Machine',    '{quads}',                        '{glutes}'),
  ('Bulgarian Split Squat',       'Dumbbell',   '{quads,glutes}',                 '{adductors,hamstrings}'),
  ('Walking Lunge',               'Dumbbell',   '{quads,glutes}',                 '{hamstrings,adductors}'),
  ('Leg Extension',               'Machine',    '{quads}',                        '{}'),
  ('Lying Leg Curl',              'Machine',    '{hamstrings}',                   '{calves}'),
  ('Seated Leg Curl',             'Machine',    '{hamstrings}',                   '{}'),
  ('Hip Thrust',                  'Barbell',    '{glutes}',                       '{hamstrings}'),
  ('Hip Adduction',               'Machine',    '{adductors}',                    '{}'),
  ('Standing Calf Raise',         'Machine',    '{calves}',                       '{}'),
  ('Seated Calf Raise',           'Machine',    '{calves}',                       '{}'),
  -- Core
  ('Hanging Leg Raise',           'Bodyweight', '{abs}',                          '{obliques}'),
  ('Cable Crunch',                'Cable',      '{abs}',                          '{obliques}'),
  ('Ab Wheel Rollout',            'Bodyweight', '{abs}',                          '{obliques,lats}');

-- Sets up a user's profile and copies the default exercise library.
-- Safe to run more than once for the same user.
create function app_private.provision_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (p_user_id) on conflict (id) do nothing;

  insert into public.exercises (user_id, name, equipment)
  select p_user_id, d.name, d.equipment
  from app_private.default_exercises d
  on conflict (user_id, lower(btrim(name))) do nothing;

  insert into public.exercise_muscles (exercise_id, user_id, muscle_group_id, role)
  select e.id, p_user_id, m.muscle, m.role
  from app_private.default_exercises d
  join public.exercises e
    on e.user_id = p_user_id and lower(btrim(e.name)) = lower(btrim(d.name))
  cross join lateral (
    select unnest(d.primary_muscles) as muscle, 'primary' as role
    union all
    select unnest(d.secondary_muscles), 'secondary'
  ) m
  on conflict (exercise_id, muscle_group_id) do nothing;
end;
$$;
revoke all on function app_private.provision_user(uuid) from public, anon, authenticated;

create function app_private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app_private.provision_user(new.id);
  return new;
end;
$$;
revoke all on function app_private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.handle_new_user();

-- Users who signed up before this migration ran.
select app_private.provision_user(u.id) from auth.users u;
