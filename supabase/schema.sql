-- Combat Control multiplayer schema (idempotent-ish; run once)
create extension if not exists pgcrypto;

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  dm_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  campaign_id uuid not null references public.campaigns on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('dm', 'player')),
  display_name text not null default '',
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table if not exists public.characters (
  id text primary key,
  campaign_id uuid not null references public.campaigns on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists characters_campaign on public.characters (campaign_id);

create table if not exists public.encounters (
  campaign_id uuid primary key references public.campaigns on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.characters replica identity full;
alter table public.encounters replica identity full;

-- helpers (security definer avoids RLS recursion on members)
create or replace function public.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from members where campaign_id = cid and user_id = auth.uid()) $$;
create or replace function public.is_dm(cid uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from members where campaign_id = cid and user_id = auth.uid() and role = 'dm') $$;

-- DM automatically becomes a member
create or replace function public.campaign_add_dm() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  insert into members (campaign_id, user_id, role, display_name)
  values (new.id, new.dm_id, 'dm', coalesce((select raw_user_meta_data->>'display_name' from auth.users where id = new.dm_id), ''))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists campaign_add_dm on public.campaigns;
create trigger campaign_add_dm after insert on public.campaigns for each row execute function public.campaign_add_dm();

-- join by code
create or replace function public.join_campaign(code text, name text default '') returns uuid
language plpgsql security definer set search_path = public as
$$ declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select id into cid from campaigns where join_code = upper(trim(code));
  if cid is null then raise exception 'No campaign with that code'; end if;
  insert into members (campaign_id, user_id, role, display_name) values (cid, auth.uid(), 'player', coalesce(name, ''))
  on conflict (campaign_id, user_id) do update set display_name = excluded.display_name where members.display_name = '';
  return cid;
end $$;
revoke all on function public.join_campaign(text, text) from public, anon;
grant execute on function public.join_campaign(text, text) to authenticated;

alter table public.campaigns enable row level security;
alter table public.members enable row level security;
alter table public.characters enable row level security;
alter table public.encounters enable row level security;

drop policy if exists c_sel on public.campaigns;  create policy c_sel on public.campaigns for select to authenticated using (is_member(id) or dm_id = auth.uid());
drop policy if exists c_ins on public.campaigns;  create policy c_ins on public.campaigns for insert to authenticated with check (dm_id = auth.uid());
drop policy if exists c_upd on public.campaigns;  create policy c_upd on public.campaigns for update to authenticated using (dm_id = auth.uid()) with check (dm_id = auth.uid());
drop policy if exists c_del on public.campaigns;  create policy c_del on public.campaigns for delete to authenticated using (dm_id = auth.uid());

drop policy if exists m_sel on public.members;    create policy m_sel on public.members for select to authenticated using (is_member(campaign_id));
drop policy if exists m_del on public.members;    create policy m_del on public.members for delete to authenticated using (user_id = auth.uid() or is_dm(campaign_id));

drop policy if exists ch_sel on public.characters; create policy ch_sel on public.characters for select to authenticated using (is_member(campaign_id));
drop policy if exists ch_ins on public.characters; create policy ch_ins on public.characters for insert to authenticated with check (is_member(campaign_id) and (owner_id = auth.uid() or is_dm(campaign_id)));
drop policy if exists ch_upd on public.characters; create policy ch_upd on public.characters for update to authenticated using (owner_id = auth.uid() or is_dm(campaign_id)) with check (is_member(campaign_id));
drop policy if exists ch_del on public.characters; create policy ch_del on public.characters for delete to authenticated using (owner_id = auth.uid() or is_dm(campaign_id));

drop policy if exists e_sel on public.encounters; create policy e_sel on public.encounters for select to authenticated using (is_member(campaign_id));
drop policy if exists e_ins on public.encounters; create policy e_ins on public.encounters for insert to authenticated with check (is_dm(campaign_id));
drop policy if exists e_upd on public.encounters; create policy e_upd on public.encounters for update to authenticated using (is_dm(campaign_id)) with check (is_dm(campaign_id));

-- prevent players changing owner_id / campaign_id of a character
create or replace function public.characters_guard() returns trigger language plpgsql as
$$ begin
  if new.owner_id <> old.owner_id or new.campaign_id <> old.campaign_id then raise exception 'Cannot move characters'; end if;
  new.updated_at = now(); return new;
end $$;
drop trigger if exists characters_guard on public.characters;
create trigger characters_guard before update on public.characters for each row execute function public.characters_guard();

do $$ begin
  begin alter publication supabase_realtime add table public.characters; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.encounters; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; end;
end $$;

-- ===== Loot chests + item giving (v3) =====
create table if not exists public.chests (
  id text primary key,
  campaign_id uuid not null references public.campaigns on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists chests_campaign on public.chests (campaign_id);
alter table public.chests replica identity full;
alter table public.chests enable row level security;
drop policy if exists k_sel on public.chests; create policy k_sel on public.chests for select to authenticated using (is_member(campaign_id));
drop policy if exists k_ins on public.chests; create policy k_ins on public.chests for insert to authenticated with check (is_dm(campaign_id));
drop policy if exists k_upd on public.chests; create policy k_upd on public.chests for update to authenticated using (is_dm(campaign_id)) with check (is_dm(campaign_id));
drop policy if exists k_del on public.chests; create policy k_del on public.chests for delete to authenticated using (is_dm(campaign_id));
do $$ begin
  begin alter publication supabase_realtime add table public.chests; exception when duplicate_object then null; end;
end $$;

-- A player gives one of their items to another character in the same campaign.
create or replace function public.give_item(from_id text, to_id text, item_id text) returns void
language plpgsql security definer set search_path = public as
$$ declare f characters; t characters; it jsonb;
begin
  select * into f from characters where id = from_id for update;
  select * into t from characters where id = to_id for update;
  if f is null or t is null then raise exception 'Character not found'; end if;
  if f.campaign_id <> t.campaign_id then raise exception 'Characters are in different campaigns'; end if;
  if not (f.owner_id = auth.uid() or is_dm(f.campaign_id)) then raise exception 'Not your character'; end if;
  select x into it from jsonb_array_elements(coalesce(f.data->'inventory', '[]')) x where x->>'id' = item_id;
  if it is null then raise exception 'Item not found'; end if;
  it := it - 'equipped';
  update characters set data = jsonb_set(data, '{inventory}',
    coalesce((select jsonb_agg(x) from jsonb_array_elements(data->'inventory') x where x->>'id' <> item_id), '[]'))
    where id = from_id;
  update characters set data = jsonb_set(data, '{inventory}', coalesce(data->'inventory', '[]') || jsonb_build_array(it))
    where id = to_id;
end $$;
revoke all on function public.give_item(text, text, text) from public, anon;
grant execute on function public.give_item(text, text, text) to authenticated;
