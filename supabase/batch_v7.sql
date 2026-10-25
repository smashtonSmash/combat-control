-- Book-character batch (v7). Safe to run more than once.
--
-- No new tables and no new columns. Favor, trades, notes, the origin library,
-- and the blackjack table ride in jsonb the app already syncs.
--
-- Favor is app-side only: characters.data.favor values are −100..+100.
-- 0 is the center of the bar. At −40 or lower the merchant refuses to sell.
-- Older 0..100 scores stay as positive favor (40 stays +40). Do not migrate them.
--
-- settings.homebrew gains, beside party / town / recap:
--   library:     saved custom race / class / background entries
--   notes:       { body, author, at }  — everyone can edit; last save wins
--   casino:      the blackjack table (DM is the dealer and the writer)
--   casinoInbox: player actions waiting for the DM client to apply
--
-- Players still cannot update campaigns directly (c_upd is DM-only).
-- The functions below are security definer so a player can accept a trade,
-- save a note, save a library entry, or sit at the table.

-- Recipient accepts an offer stored on the giver (characters.data.trades[]).
-- The item moves only here. The giver, or the DM, may also call it.
create or replace function public.accept_item_trade(from_id text, trade_id text) returns void
language plpgsql security definer set search_path = public as $$
declare f characters; t characters; tr jsonb; it jsonb; to_id text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into f from characters where id = from_id for update;
  if f is null then raise exception 'Character not found'; end if;
  select x into tr from jsonb_array_elements(coalesce(f.data->'trades', '[]'::jsonb)) x where x->>'id' = trade_id;
  if tr is null then raise exception 'Offer not found'; end if;
  to_id := tr->>'toId';
  select * into t from characters where id = to_id for update;
  if t is null then raise exception 'Recipient not found'; end if;
  if f.campaign_id <> t.campaign_id then raise exception 'Characters are in different campaigns'; end if;
  if not (t.owner_id = auth.uid() or f.owner_id = auth.uid() or is_dm(f.campaign_id)) then
    raise exception 'Not your offer to accept';
  end if;
  select x into it from jsonb_array_elements(coalesce(f.data->'inventory', '[]'::jsonb)) x where x->>'id' = tr->>'itemId';
  if it is null then
    update characters set data = jsonb_set(data, '{trades}',
      coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(data->'trades', '[]'::jsonb)) x where x->>'id' <> trade_id), '[]'::jsonb))
      where id = from_id;
    raise exception 'That item is no longer in the pack';
  end if;
  it := it - 'equipped';
  update characters set data = jsonb_set(
    jsonb_set(data, '{inventory}',
      coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(data->'inventory', '[]'::jsonb)) x where x->>'id' <> (tr->>'itemId')), '[]'::jsonb)),
    '{trades}',
    coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(data->'trades', '[]'::jsonb)) x where x->>'id' <> trade_id), '[]'::jsonb)
  ) where id = from_id;
  update characters set data = jsonb_set(data, '{inventory}', coalesce(data->'inventory', '[]'::jsonb) || jsonb_build_array(it))
    where id = to_id;
end $$;
revoke all on function public.accept_item_trade(text, text) from public, anon;
grant execute on function public.accept_item_trade(text, text) to authenticated;

create or replace function public.decline_item_trade(from_id text, trade_id text) returns void
language plpgsql security definer set search_path = public as $$
declare f characters; tr jsonb; t characters;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into f from characters where id = from_id for update;
  if f is null then raise exception 'Character not found'; end if;
  select x into tr from jsonb_array_elements(coalesce(f.data->'trades', '[]'::jsonb)) x where x->>'id' = trade_id;
  if tr is null then raise exception 'Offer not found'; end if;
  select * into t from characters where id = tr->>'toId';
  if not (f.owner_id = auth.uid() or (t.owner_id = auth.uid()) or is_dm(f.campaign_id)) then
    raise exception 'Not your offer';
  end if;
  update characters set data = jsonb_set(data, '{trades}',
    coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(data->'trades', '[]'::jsonb)) x where x->>'id' <> trade_id), '[]'::jsonb))
    where id = from_id;
end $$;
revoke all on function public.decline_item_trade(text, text) from public, anon;
grant execute on function public.decline_item_trade(text, text) to authenticated;

-- Last-write-wins shared pad. Any member of the campaign.
create or replace function public.save_shared_note(cid uuid, note jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare stamped jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not is_member(cid) then raise exception 'Not in this campaign'; end if;
  stamped := jsonb_build_object(
    'body', left(coalesce(note->>'body', ''), 20000),
    'author', left(coalesce(note->>'author', ''), 80),
    'at', coalesce((note->>'at')::bigint, (extract(epoch from now()) * 1000)::bigint)
  );
  update campaigns set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{homebrew,notes}', stamped, true)
    where id = cid;
end $$;
revoke all on function public.save_shared_note(uuid, jsonb) from public, anon;
grant execute on function public.save_shared_note(uuid, jsonb) to authenticated;

-- One custom race, class, or background. Members append; the DM's client also writes the whole list.
create or replace function public.save_origin_entry(cid uuid, entry jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare lib jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not is_member(cid) then raise exception 'Not in this campaign'; end if;
  if coalesce(entry->>'id', '') = '' or coalesce(entry->>'name', '') = '' then raise exception 'Bad entry'; end if;
  select coalesce(jsonb_agg(x), '[]'::jsonb) into lib
    from jsonb_array_elements(coalesce((select settings#>'{homebrew,library}' from campaigns where id = cid), '[]'::jsonb)) x
    where x->>'id' is distinct from entry->>'id';
  lib := jsonb_build_array(entry) || coalesce(lib, '[]'::jsonb);
  update campaigns set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{homebrew,library}', lib, true)
    where id = cid;
end $$;
revoke all on function public.save_origin_entry(uuid, jsonb) from public, anon;
grant execute on function public.save_origin_entry(uuid, jsonb) to authenticated;

-- A seated player sends sit / bet / hit / stand / double / split / insure.
-- The DM client applies the inbox and writes settings.homebrew.casino.
-- Offline play does not need this function.
create or replace function public.casino_act(cid uuid, action jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare inbox jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if not is_member(cid) then raise exception 'Not in this campaign'; end if;
  if coalesce(action->>'id', '') = '' or coalesce(action->>'charId', '') = '' or coalesce(action->>'action', '') = '' then
    raise exception 'Bad action';
  end if;
  if not is_dm(cid) and not exists (
    select 1 from characters where id = action->>'charId' and campaign_id = cid and owner_id = auth.uid()
  ) then
    raise exception 'Not your character';
  end if;
  select coalesce(settings#>'{homebrew,casinoInbox}', '[]'::jsonb) || jsonb_build_array(action) into inbox from campaigns where id = cid;
  update campaigns set settings = jsonb_set(coalesce(settings, '{}'::jsonb), '{homebrew,casinoInbox}', inbox, true)
    where id = cid;
end $$;
revoke all on function public.casino_act(uuid, jsonb) from public, anon;
grant execute on function public.casino_act(uuid, jsonb) to authenticated;
