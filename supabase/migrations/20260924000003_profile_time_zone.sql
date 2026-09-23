-- =============================================================================
-- Migration: per-user time zone display setting
--
-- Every timestamp is still stored in UTC (unchanged). This only controls how
-- the app *displays* dates/times: "auto" follows the device's own time zone
-- (the app's original, only behavior); "utc" always shows Zulu time.
-- =============================================================================

alter table public.profiles
  add column time_zone_mode text not null default 'auto' check (time_zone_mode in ('auto', 'utc'));
