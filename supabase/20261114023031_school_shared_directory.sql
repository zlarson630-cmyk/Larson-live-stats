-- Shared school directories are opt-in. Only LLS staff attest official sources.
alter table public.shared_team_brands
  add column official boolean not null default false,
  add column search_text text generated always as (
    lower(name || ' ' || coalesce(brand->>'nickname','') || ' ' || coalesce(brand->>'shortName',''))
  ) stored;
revoke insert, update on public.shared_team_brands from authenticated;
grant insert (owner_id,brand_id,name,brand,published),
  update (owner_id,brand_id,name,brand,published) on public.shared_team_brands to authenticated;
create unique index shared_one_official_brand
  on public.shared_team_brands (lower(btrim(name))) where official and published;

create table public.shared_season_rosters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  team text not null check (length(team) between 1 and 100 and team=btrim(team) and position('|' in team)=0),
  team_key text generated always as (lower(regexp_replace(team,'[[:space:]]+',' ','g'))) stored,
  season text not null check (season ~ '^[0-9]{4}–[0-9]{2}$'),
  program text not null check (program in ('boys','girls')),
  level text not null check (level in ('varsity','jv','freshman')),
  roster text not null check (length(roster) between 1 and 16000),
  player_count smallint generated always as (1+length(roster)-length(replace(roster,chr(10),''))) stored check (player_count between 1 and 50),
  published boolean not null default false,
  official boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (owner_id,team_key,season,program,level)
);
alter table public.shared_season_rosters enable row level security;
create policy "read published season rosters" on public.shared_season_rosters
  for select to anon,authenticated using (published);
create policy "read own season rosters" on public.shared_season_rosters
  for select to authenticated using (owner_id=(select auth.uid()));
create policy "publish own season rosters" on public.shared_season_rosters
  for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "change own season rosters" on public.shared_season_rosters
  for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
revoke all on public.shared_season_rosters from public,anon,authenticated;
grant select (id,team,team_key,season,program,level,roster,player_count,published,official,updated_at)
  on public.shared_season_rosters to anon;
grant select on public.shared_season_rosters to authenticated;
grant insert (owner_id,team,season,program,level,roster,published),
  update (owner_id,team,season,program,level,roster,published) on public.shared_season_rosters to authenticated;
create index shared_roster_lookup on public.shared_season_rosters (team_key,season,program,level,official desc) where published;
create unique index shared_one_official_roster on public.shared_season_rosters (team_key,season,program,level)
  where official and published;

create schema if not exists directory_private;
revoke all on schema directory_private from public;
grant usage on schema directory_private to authenticated;

create function directory_private.keep_school_attestation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name='shared_season_rosters' then
    if tg_op='INSERT' or new.roster is distinct from old.roster then
      if exists (select 1 from regexp_split_to_table(new.roster,chr(10)) line
        where line !~ '^[0-9]{1,2},[^,[:cntrl:]]*,[^,[:cntrl:]]*,[^,[:cntrl:]]*$')
      or (select count(distinct split_part(line,',',1)::integer)
        from regexp_split_to_table(new.roster,chr(10)) line) <> 1+length(new.roster)-length(replace(new.roster,chr(10),''))
      then raise exception 'Use up to 50 player rows with unique jersey numbers.'; end if;
    end if;
    if tg_op='INSERT' then return new; end if;
    if (lower(regexp_replace(new.team,'[[:space:]]+',' ','g')),new.season,new.program,new.level,new.owner_id)
      is distinct from (old.team_key,old.season,old.program,old.level,old.owner_id) then new.official := false; end if;
    if new.roster is distinct from old.roster or new.published is distinct from old.published then new.updated_at := now(); end if;
  elsif (lower(btrim(new.name)),new.owner_id,new.brand_id)
      is distinct from (lower(btrim(old.name)),old.owner_id,old.brand_id) then new.official := false;
  end if;
  return new;
end;
$$;
revoke execute on function directory_private.keep_school_attestation() from public,anon,authenticated;
create trigger brand_school_attestation before update on public.shared_team_brands
  for each row execute function directory_private.keep_school_attestation();
create trigger roster_school_attestation before insert or update on public.shared_season_rosters
  for each row execute function directory_private.keep_school_attestation();

create function directory_private.verify_school_listing(listing_type text, listing_id uuid, verified boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or (select auth.jwt())->'app_metadata'->>'lls_staff' is distinct from 'true' then
    raise exception 'LLS staff access required.' using errcode='42501';
  end if;
  if listing_type='brand' then
    update public.shared_team_brands set official=verified where id=listing_id and published;
  elsif listing_type='roster' then
    update public.shared_season_rosters set official=verified where id=listing_id and published;
  else raise exception 'Unknown listing type.';
  end if;
  if not found then raise exception 'This listing is no longer public.'; end if;
end;
$$;
create function public.verify_school_listing(listing_type text, listing_id uuid, verified boolean)
returns void language sql security invoker set search_path = ''
as $$ select directory_private.verify_school_listing(listing_type,listing_id,verified); $$;
revoke execute on function directory_private.verify_school_listing(text,uuid,boolean),
  public.verify_school_listing(text,uuid,boolean) from public,anon;
grant execute on function directory_private.verify_school_listing(text,uuid,boolean),
  public.verify_school_listing(text,uuid,boolean) to authenticated;
