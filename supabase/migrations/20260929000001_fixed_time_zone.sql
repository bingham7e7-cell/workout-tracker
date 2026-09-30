-- =============================================================================
-- Migration: fixed time zone option for the per-user time zone display setting
--
-- Adds a third `time_zone_mode`, 'fixed', alongside the existing 'auto' and
-- 'utc'. When 'fixed', `time_zone_name` holds the IANA zone (e.g.
-- 'America/Chicago') the user picked from a searchable list; dates/times
-- display in that zone everywhere instead of the device's own zone or UTC.
-- Every timestamp is still stored in UTC (unchanged) — this only affects
-- display, exactly like the existing 'auto'/'utc' modes. No existing data
-- is touched: the new column defaults to null and every existing profile
-- keeps its current mode.
-- =============================================================================

alter table public.profiles
  add column time_zone_name text;

alter table public.profiles
  drop constraint profiles_time_zone_mode_check,
  add constraint profiles_time_zone_mode_check check (time_zone_mode in ('auto', 'utc', 'fixed'));

alter table public.profiles
  add constraint profiles_time_zone_name_check check (time_zone_mode <> 'fixed' or time_zone_name is not null);
