-- Custom access-token hook (COT-150): stamps `tier` into the JWT from
-- app_metadata so siblings read tier from the token they already verify —
-- no second lookup, no shared table.
--
-- kurt@cotoaga.ai is hardwired to root regardless of stored app_metadata.
-- Root is a fixed identity in the ratified account model, not a mutable
-- flag someone could accidentally downgrade via the admin API.
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

  if account_email = 'kurt@cotoaga.ai' then
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

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
