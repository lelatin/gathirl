-- =====================================================================
-- Gathirl : suppression de compte par l'utilisateur lui-même
-- (exigée par l'App Store et le Play Store pour toute app avec comptes).
-- À exécuter une fois dans Supabase → SQL Editor → New query → Run.
-- Déjà inclus dans schema.sql pour les nouvelles installations.
-- =====================================================================
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
