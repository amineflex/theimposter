-- ===========================================================================
-- FlexGames  ·  plateforme multi-jeux
--
-- The Imposter devient un jeu parmi d'autres. Cette migration rend le socle
-- (rooms, joueurs, parties) indépendant du jeu :
--
--   rooms          → sait QUEL jeu, pas comment il se joue
--   game_sessions  → une partie ; une room peut en enchaîner plusieurs
--   games          → devient une table PROPRE à The Imposter, rattachée à une
--                    session (elle garde ses secrets, sa RLS et ses vues)
--
-- Migration additive et rejouable : les rooms et parties existantes sont
-- conservées et rattachées automatiquement à `the-imposter`.
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Rooms : quel jeu, et une configuration opaque
-- ---------------------------------------------------------------------------
alter table rooms add column if not exists game_id text not null default 'the-imposter';
alter table rooms add column if not exists game_config jsonb not null default '{}'::jsonb;

-- Les réglages existants deviennent la configuration du jeu, `mode` compris :
-- la plateforme ne connaît plus la notion de mode, elle appartient au jeu.
update rooms
set game_config = coalesce(settings, '{}'::jsonb) || jsonb_build_object('mode', mode::text)
where game_config = '{}'::jsonb;

alter table rooms add constraint rooms_game_id_format check (game_id ~ '^[a-z0-9-]{2,40}$');

-- Chaque jeu annonce ses propres bornes dans son manifest : la base ne garde
-- qu'un garde-fou large.
alter table rooms drop constraint if exists rooms_max_players_range;
alter table rooms add constraint rooms_max_players_range check (max_players between 2 and 64);

create index if not exists rooms_game_idx on rooms (game_id, status);

-- ---------------------------------------------------------------------------
-- 2. Sessions de jeu (générique)
-- ---------------------------------------------------------------------------
do $$ begin
  create type session_status as enum ('active', 'finished', 'abandoned');
exception when duplicate_object then null;
end $$;

create table if not exists game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  game_id text not null,
  status session_status not null default 'active',
  -- Réglages figés au lancement : modifier le salon n'altère pas la partie.
  config jsonb not null default '{}'::jsonb,
  -- État PUBLIC des jeux sans secret. Les jeux à secrets utilisent leurs tables.
  state jsonb not null default '{}'::jsonb,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists game_sessions_room_idx on game_sessions (room_id, created_at desc);
-- Une seule partie active par room, garantie par la base et non par le code.
create unique index if not exists game_sessions_active_unique
  on game_sessions (room_id) where status = 'active';

alter table game_sessions enable row level security;

-- Lecture réservée aux membres de la room. Aucune écriture client : tout passe
-- par les route handlers avec la clé service_role.
drop policy if exists game_sessions_select on game_sessions;
create policy game_sessions_select on game_sessions for select using (
  is_room_member(room_id) or is_admin()
);

do $$ begin
  alter publication supabase_realtime add table game_sessions;
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 3. The Imposter : ses parties se rattachent à une session
-- ---------------------------------------------------------------------------
alter table games add column if not exists session_id uuid references game_sessions (id) on delete cascade;

-- Reprise des parties existantes : une session par partie déjà jouée.
insert into game_sessions (room_id, game_id, status, config, created_at, finished_at)
select
  g.room_id,
  'the-imposter',
  case
    when g.finished_at is null then 'active'::session_status
    when g.abandoned then 'abandoned'::session_status
    else 'finished'::session_status
  end,
  g.settings,
  g.started_at,
  g.finished_at
from games g
where g.session_id is null;

update games g
set session_id = s.id
from game_sessions s
where g.session_id is null
  and s.room_id = g.room_id
  and s.created_at = g.started_at;

-- Les parties orphelines (room supprimée entre-temps) ne peuvent pas être
-- rattachées : on les retire plutôt que de garder un état incohérent.
delete from games where session_id is null;

alter table games alter column session_id set not null;
create unique index if not exists games_session_unique on games (session_id);

-- ---------------------------------------------------------------------------
-- 4. Vues publiques
-- ---------------------------------------------------------------------------
drop view if exists public_rooms;
drop view if exists game_public_state;

-- Vue publique d'une partie The Imposter : identique à avant, plus le lien vers
-- la session (le client la retrouve à partir de la room).
create view game_public_state
with (security_invoker = false) as
select
  g.id,
  g.session_id,
  g.room_id,
  g.mode,
  g.settings,
  g.phase,
  g.round,
  g.description_pass,
  g.speaking_order,
  g.current_speaker_index,
  g.base_order,
  g.first_speaker_offset,
  g.runoff_candidates,
  g.runoff_count,
  g.empty_vote_streak,
  g.pending_mr_white_id,
  g.last_vote,
  g.last_mr_white_guess,
  g.eliminations,
  g.winner,
  g.abandoned,
  g.phase_ends_at,
  g.is_paused,
  g.version,
  g.started_at,
  g.finished_at,
  -- Les mots ne sont exposés qu'une fois la partie terminée.
  case when g.phase = 'results' or g.finished_at is not null then g.civilian_word end as civilian_word,
  case when g.phase = 'results' or g.finished_at is not null then g.undercover_word end as undercover_word,
  case when g.phase = 'results' or g.finished_at is not null then g.impostor_hint end as impostor_hint,
  -- Exposé seulement en fin de partie : sert à l'anti-répétition côté client.
  case when g.phase = 'results' or g.finished_at is not null then g.word_source_id end as word_source_id,
  g.word_category,
  g.word_difficulty
from games g
where is_game_member(g.id) or is_admin();

-- Parties publiques rejoignables : le jeu, l'affluence, rien d'autre.
create view public_rooms
with (security_invoker = false) as
select
  r.code,
  r.game_id,
  r.status,
  r.created_at,
  r.last_activity_at,
  r.max_players,
  (select count(*) from room_players rp where rp.room_id = r.id and rp.is_present) as player_count
from rooms r
where r.visibility = 'public'
  and r.status = 'lobby'
  and r.expires_at > now();

grant select on game_public_state to anon, authenticated;
grant select on public_rooms to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Analytics : colonnes communes + métadonnées libres par jeu
-- ---------------------------------------------------------------------------
alter table analytics_events add column if not exists game_key text;
alter table analytics_events add column if not exists session_id uuid;
alter table analytics_events add column if not exists meta jsonb;

update analytics_events
set game_key = coalesce(game_key, 'the-imposter'),
    meta = coalesce(
      meta,
      jsonb_strip_nulls(jsonb_build_object('mode', mode::text, 'difficulty', difficulty, 'packs', to_jsonb(packs)))
    )
where game_key is null;

create index if not exists analytics_events_game_idx on analytics_events (game_key, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. Statistiques d'administration, réécrites sur les nouvelles notions
-- ---------------------------------------------------------------------------
create or replace function admin_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_admin() then
    raise exception 'forbidden';
  end if;

  select jsonb_build_object(
    'games_today', (
      select count(*) from game_sessions where created_at >= date_trunc('day', now())
    ),
    'games_total', (select count(*) from game_sessions),
    'players_today', (
      select count(distinct rp.user_id) from room_players rp
      where rp.joined_at >= date_trunc('day', now())
    ),
    'active_rooms', (
      select count(*) from rooms where status in ('lobby', 'in_game') and expires_at > now()
    ),
    'avg_duration_seconds', (
      select coalesce(round(avg(extract(epoch from (finished_at - created_at))))::integer, 0)
      from game_sessions where finished_at is not null
    ),
    'avg_player_count', (
      select coalesce(round(avg(player_count)::numeric, 1), 0)
      from analytics_events where player_count is not null
    ),
    'most_played_game', (
      select game_id from game_sessions group by game_id order by count(*) desc limit 1
    ),
    'games_by_id', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select game_id as game, count(*) as sessions
        from game_sessions group by game_id order by count(*) desc limit 10
      ) t
    ),
    'top_packs', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select pack, count(*) as games from (
          select jsonb_array_elements_text(meta -> 'packs') as pack
          from analytics_events
          where meta ? 'packs'
        ) p group by pack order by count(*) desc limit 5
      ) t
    ),
    'open_reports', (select count(*) from reports where status = 'open'),
    'words_total', (
      select (select count(*) from impostor_words) + (select count(*) from word_pairs)
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function admin_stats() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Nettoyage des rooms : les sessions suivent par cascade
-- ---------------------------------------------------------------------------
-- `rooms.mode` et `rooms.settings` ne sont plus lus par l'application. Les
-- colonnes sont conservées le temps d'une version pour permettre un retour en
-- arrière sans perte, puis pourront être supprimées :
--   alter table rooms drop column mode, drop column settings;

commit;
