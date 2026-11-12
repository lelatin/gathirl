-- =====================================================================
-- GATHIRL — schéma Supabase (remplace les entités Base44)
-- Entités : profiles (User), parties (Partie), participations
--           (Participation), friendships (Friendship), messages (Message)
--
-- À exécuter une fois dans : Supabase → SQL Editor → New query → Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- PROFILS (1 ligne par compte, créée automatiquement à l'inscription)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users on delete cascade,
  full_name        text not null default 'Joueur',
  city             text default '',
  city_lat         double precision,
  city_lng         double precision,
  skill_level      text not null default 'Casual' check (skill_level in ('Débutant','Casual','Compétitif')),
  favorite_formats text[] not null default '{}',
  bio              text default '' check (char_length(bio) <= 600),
  avatar_url       text,
  created_at       timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- PARTIES
-- ---------------------------------------------------------------------
create table if not exists public.parties (
  id               uuid primary key default gen_random_uuid(),
  title            text not null check (char_length(title) between 2 and 120),
  format           text not null default 'Commander',
  level            text not null default 'Casual' check (level in ('Débutant','Casual','Compétitif')),
  date             timestamptz not null,
  city             text not null,
  location         text default '',
  location_address text default '',
  location_lat     double precision,
  location_lng     double precision,
  max_players      int not null default 4 check (max_players between 2 and 20),
  current_players  int not null default 1,
  description      text default '' check (char_length(description) <= 2000),
  host_id          uuid not null references public.profiles(id) on delete cascade,
  host_name        text not null default 'Joueur',
  status           text not null default 'ouvert' check (status in ('ouvert','complet','annulé','terminé')),
  created_at       timestamptz not null default now()
);
create index if not exists parties_date_idx on public.parties (date);

-- ---------------------------------------------------------------------
-- PARTICIPATIONS
-- ---------------------------------------------------------------------
create table if not exists public.participations (
  id         uuid primary key default gen_random_uuid(),
  partie_id  uuid not null references public.parties(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  user_name  text not null default 'Joueur',
  status     text not null default 'inscrit',
  created_at timestamptz not null default now(),
  unique (partie_id, user_id)
);

-- L'hôte est automatiquement inscrit à sa partie
create or replace function public.handle_new_partie()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.participations (partie_id, user_id, user_name)
  values (new.id, new.host_id, new.host_name)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_partie_created on public.parties;
create trigger on_partie_created
  after insert on public.parties
  for each row execute function public.handle_new_partie();

-- Rejoindre une partie (atomique : pas de sur-réservation)
create or replace function public.join_partie(p_partie uuid)
returns public.parties language plpgsql security definer set search_path = public as $$
declare
  p  public.parties;
  me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into p from public.parties where id = p_partie for update;
  if p.id is null then raise exception 'NOT_FOUND'; end if;
  if exists (select 1 from public.participations where partie_id = p_partie and user_id = me.id) then
    raise exception 'ALREADY_JOINED';
  end if;
  if p.current_players >= p.max_players then raise exception 'PARTIE_FULL'; end if;

  insert into public.participations (partie_id, user_id, user_name) values (p_partie, me.id, me.full_name);
  update public.parties
     set current_players = current_players + 1,
         status = case when current_players + 1 >= max_players then 'complet' else 'ouvert' end
   where id = p_partie
   returning * into p;
  return p;
end $$;

-- Quitter une partie
create or replace function public.leave_partie(p_partie uuid)
returns public.parties language plpgsql security definer set search_path = public as $$
declare p public.parties;
begin
  select * into p from public.parties where id = p_partie for update;
  if p.id is null then raise exception 'NOT_FOUND'; end if;
  if p.host_id = auth.uid() then raise exception 'HOST_CANNOT_LEAVE'; end if;

  delete from public.participations where partie_id = p_partie and user_id = auth.uid();
  if found then
    update public.parties
       set current_players = greatest(1, current_players - 1), status = 'ouvert'
     where id = p_partie
     returning * into p;
  end if;
  return p;
end $$;

grant execute on function public.join_partie(uuid) to authenticated;
grant execute on function public.leave_partie(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- AMITIÉS
-- ---------------------------------------------------------------------
create table if not exists public.friendships (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references public.profiles(id) on delete cascade,
  requester_name text not null default 'Joueur',
  receiver_id    uuid not null references public.profiles(id) on delete cascade,
  receiver_name  text not null default 'Joueur',
  status         text not null default 'pending' check (status in ('pending','accepted')),
  created_at     timestamptz not null default now(),
  unique (requester_id, receiver_id),
  check (requester_id <> receiver_id)
);

-- ---------------------------------------------------------------------
-- MESSAGES
-- ---------------------------------------------------------------------
create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles(id) on delete cascade,
  sender_name   text not null default 'Joueur',
  receiver_id   uuid not null references public.profiles(id) on delete cascade,
  receiver_name text not null default 'Joueur',
  content       text not null check (char_length(content) between 1 and 2000),
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists messages_pair_idx on public.messages (sender_id, receiver_id, created_at);

-- =====================================================================
-- SÉCURITÉ (Row Level Security)
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.parties        enable row level security;
alter table public.participations enable row level security;
alter table public.friendships    enable row level security;
alter table public.messages       enable row level security;

-- Profils : lisibles par tous, modifiables par leur propriétaire
drop policy if exists "profiles_read" on public.profiles;
create policy "profiles_read" on public.profiles for select using (true);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Parties : lisibles par tous ; création / modification par l'hôte
drop policy if exists "parties_read" on public.parties;
create policy "parties_read" on public.parties for select using (true);
drop policy if exists "parties_insert" on public.parties;
create policy "parties_insert" on public.parties for insert to authenticated
  with check (auth.uid() = host_id and current_players = 1 and status = 'ouvert');
drop policy if exists "parties_update_host" on public.parties;
create policy "parties_update_host" on public.parties for update using (auth.uid() = host_id) with check (auth.uid() = host_id);
drop policy if exists "parties_delete_host" on public.parties;
create policy "parties_delete_host" on public.parties for delete using (auth.uid() = host_id);

-- Participations : lisibles par tous ; écriture uniquement via join_partie / leave_partie
drop policy if exists "participations_read" on public.participations;
create policy "participations_read" on public.participations for select using (true);

-- Amitiés : visibles par les deux personnes concernées
drop policy if exists "friendships_read" on public.friendships;
create policy "friendships_read" on public.friendships for select using (auth.uid() in (requester_id, receiver_id));
drop policy if exists "friendships_insert" on public.friendships;
create policy "friendships_insert" on public.friendships for insert to authenticated with check (auth.uid() = requester_id and status = 'pending');
drop policy if exists "friendships_accept" on public.friendships;
create policy "friendships_accept" on public.friendships for update using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);
drop policy if exists "friendships_delete" on public.friendships;
create policy "friendships_delete" on public.friendships for delete using (auth.uid() in (requester_id, receiver_id));

-- Messages : visibles par l'expéditeur et le destinataire
drop policy if exists "messages_read" on public.messages;
create policy "messages_read" on public.messages for select using (auth.uid() in (sender_id, receiver_id));
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert to authenticated with check (auth.uid() = sender_id);
drop policy if exists "messages_mark_read" on public.messages;
create policy "messages_mark_read" on public.messages for update using (auth.uid() = receiver_id) with check (auth.uid() = receiver_id);

-- =====================================================================
-- TEMPS RÉEL (messagerie instantanée, places qui se remplissent)
-- =====================================================================
do $$ begin
  begin alter publication supabase_realtime add table public.messages;       exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.participations; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.friendships;    exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;

  -- Libérer les places occupées dans les parties des autres joueurs
  update public.parties p
     set current_players = greatest(p.current_players - 1, 0),
         status = case when p.status = 'complet' then 'ouvert' else p.status end
   where p.host_id <> uid
     and p.id in (select partie_id from public.participations where user_id = uid);

  -- Supprimer le compte : profil, parties organisées, inscriptions, amis et
  -- messages partent avec lui (« on delete cascade » dans tout le schéma)
  delete from auth.users where id = uid;
end $$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
