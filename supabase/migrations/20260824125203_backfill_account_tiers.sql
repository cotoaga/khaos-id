-- Backfill (COT-150, ratified 2026-08-24): every account that existed before
-- the tiered model lands on guest, except the hardwired root identity.
-- Accounts born after this point arrive via invite or approved request
-- (COT-151) and get their tier stamped at creation.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tier', 'root')
where email = 'kurt@cotoaga.ai';

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('tier', 'guest')
where email <> 'kurt@cotoaga.ai'
  and not (coalesce(raw_app_meta_data, '{}'::jsonb) ? 'tier');
