create table public.account_roster_libraries (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 rosters jsonb not null default '{}'::jsonb check (jsonb_typeof(rosters)='object' and octet_length(rosters::text)<=4000000),
 version bigint not null default 1 check (version>0)
);
alter table public.account_roster_libraries enable row level security;
create policy "owners read rosters" on public.account_roster_libraries for select to authenticated using (owner_id=(select auth.uid()));
create policy "owners create rosters" on public.account_roster_libraries for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "owners update rosters" on public.account_roster_libraries for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
grant select,insert,update on public.account_roster_libraries to authenticated;
revoke all on public.account_roster_libraries from anon;
alter table public.live_games add column legacy_ref text;
create unique index live_games_owner_legacy_ref on public.live_games(owner_id,legacy_ref);
create table public.shared_team_brands (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 brand_id text not null check(length(brand_id) between 1 and 90),
 name text not null check(length(name) between 1 and 100),
 brand jsonb not null check(jsonb_typeof(brand)='object' and octet_length(brand::text)<=500000),
 published boolean not null default false,
 unique(owner_id,brand_id)
);
alter table public.shared_team_brands enable row level security;
create policy "read published or owned brands" on public.shared_team_brands for select to authenticated using (published or owner_id=(select auth.uid()));
create policy "owners publish brands" on public.shared_team_brands for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "owners change shared brands" on public.shared_team_brands for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
grant select,insert,update on public.shared_team_brands to authenticated;
revoke all on public.shared_team_brands from anon;
