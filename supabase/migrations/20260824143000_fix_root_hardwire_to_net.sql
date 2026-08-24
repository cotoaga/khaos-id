-- COT-150 correction (Kurt-ratified 2026-08-24, option B): root identity is
-- kurt@cotoaga.net — the account that actually exists and has been Kurt's
-- living login since 2026-05-13. The originally ratified kurt@cotoaga.ai
-- matched zero rows in prod; the two earlier migration files are history,
-- this one supersedes their hardwire target.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  account_email text;
  account_tier text;
begin
  select email, raw_app_meta_data ->> 'tier'
    into account_email, account_tier
    from auth.users
    where id = (event ->> 'user_id')::uuid;

  if account_email = 'kurt@cotoaga.net' then
    account_tier := 'root';
  elsif account_tier is null then
    account_tier := 'guest';
  end if;

  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{tier}', to_jsonb(account_tier));
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Stored tier follows the corrected hardwire.
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('tier', 'root')
where email = 'kurt@cotoaga.net';
