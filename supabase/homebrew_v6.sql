-- Homebrew batch (v6) — party stash, town fountain, session recap.
-- Safe to run more than once. Does not require service-role secrets.
--
-- No new tables. These already ride along inside jsonb the app already syncs:
--   characters.data.inventory[]     new optional item fields (weaponId, tier on weapons,
--                                   kitTier, materialKey, equipSlot, special, synced, salvaged, slotCost)
--   characters.data.favor           { [merchantId]: 0-100 }
--
-- Party stash, the town list, the fountain pool, and the session recap are DM-owned
-- and live on campaigns.settings (jsonb added in v5). Players cannot update campaigns.
-- Record fountain offerings and stash moves on the DM's device so the pool stays shared.
--
-- settings.homebrew = {
--   party: { shared: bool, gold: int, silver: int, items: Item[] },
--   town:  { places: [{ id, name, hasFountain }], currentId: text,
--            fountain: { contributedSilver: int, thresholdGold: int|null } },
--   recap: [{ id, at, kind, text }]
-- }
-- thresholdGold is the secret fountain target (one of 10, 50, 100, 200). Do not surface it
-- on a player-facing screen.

alter table public.campaigns add column if not exists settings jsonb not null default '{}'::jsonb;

comment on column public.campaigns.settings is
  'DM json: originBudget, allowReroll, and homebrew.{party,town,recap} for the homebrew batch.';

-- Move gold/silver between two characters in the same campaign.
-- The caller must own the source character, or be the DM. Makes change (1 gp = 10 sp).
create or replace function public.transfer_coins(from_id text, to_id text, gold int, silver int) returns void
language plpgsql security definer set search_path = public as
$$ declare f characters; t characters; cost int; have int; left int; dest int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into f from characters where id = from_id for update;
  select * into t from characters where id = to_id for update;
  if f is null or t is null then raise exception 'Character not found'; end if;
  if f.campaign_id <> t.campaign_id then raise exception 'Characters are in different campaigns'; end if;
  if not (f.owner_id = auth.uid() or is_dm(f.campaign_id)) then raise exception 'Not your character'; end if;
  cost := greatest(coalesce(gold, 0), 0) * 10 + greatest(coalesce(silver, 0), 0);
  if cost <= 0 then raise exception 'Enter an amount'; end if;
  have := coalesce((f.data->'purse'->>'gold')::int, 0) * 10 + coalesce((f.data->'purse'->>'silver')::int, 0);
  if have < cost then raise exception 'Not enough coin'; end if;
  left := have - cost;
  dest := coalesce((t.data->'purse'->>'gold')::int, 0) * 10 + coalesce((t.data->'purse'->>'silver')::int, 0) + cost;
  update characters set data = jsonb_set(data, '{purse}', jsonb_build_object('gold', left / 10, 'silver', left % 10)) where id = from_id;
  update characters set data = jsonb_set(data, '{purse}', jsonb_build_object('gold', dest / 10, 'silver', dest % 10)) where id = to_id;
end $$;
revoke all on function public.transfer_coins(text, text, int, int) from public, anon;
grant execute on function public.transfer_coins(text, text, int, int) to authenticated;
