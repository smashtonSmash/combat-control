-- Vault batch (v8). Safe to run more than once.
--
-- The shared magical bank lives on settings.homebrew.town.vault.
-- It is the same vault in every town. Players cannot UPDATE campaigns
-- (c_upd is DM-only), so a deposit uses this function and only those two keys.
-- vaultRev is the client's counter. A later town save from the DM keeps the
-- higher rev so a stale sheet does not wipe a deposit.

create or replace function public.save_vault(cid uuid, vault jsonb, vault_rev bigint) returns void
language plpgsql security definer set search_path = public as $$
declare town jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not is_member(cid) then raise exception 'Not in this campaign'; end if;
  select coalesce(settings#>'{homebrew,town}', '{}'::jsonb) into town from campaigns where id = cid;
  town := jsonb_set(town, '{vault}', coalesce(vault, '{}'::jsonb), true);
  town := jsonb_set(town, '{vaultRev}', to_jsonb(vault_rev), true);
  update campaigns
    set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{homebrew,town}', town, true)
    where id = cid;
end $$;
revoke all on function public.save_vault(uuid, jsonb, bigint) from public, anon;
grant execute on function public.save_vault(uuid, jsonb, bigint) to authenticated;
