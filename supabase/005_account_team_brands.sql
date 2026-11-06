-- One private brand library per scorer account, with versioned writes.
create table public.team_brand_libraries (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 teams jsonb not null default '[]'::jsonb check (jsonb_typeof(teams)='array' and jsonb_array_length(teams)<=100),
 version bigint not null default 1 check (version>0)
);
alter table public.team_brand_libraries enable row level security;
create policy "owners read brand library" on public.team_brand_libraries for select to authenticated using (owner_id=(select auth.uid()));
create policy "owners create brand library" on public.team_brand_libraries for insert to authenticated with check (owner_id=(select auth.uid()));
create policy "owners update brand library" on public.team_brand_libraries for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
grant select,insert,update on public.team_brand_libraries to authenticated;
revoke all on public.team_brand_libraries from anon;
