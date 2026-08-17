-- ===========================================================================
-- The Imposter  ·  schéma initial
--
-- Principes de sécurité :
--  * Le client navigateur n'écrit JAMAIS dans les tables de jeu. Toutes les
--    mutations passent par les route handlers Next.js (clé service_role), qui
--    exécutent le moteur de jeu TypeScript et font autorité.
--  * Les RLS n'accordent au client anonyme que des LECTURES, et uniquement sur
--    ce qu'il a le droit de voir. Les rôles et mots secrets vivent dans
--    `game_players`, dont la politique de lecture est limitée à sa propre
--    ligne : même en interrogeant Supabase directement, un joueur ne peut pas
--    lire le rôle d'un autre.
--  * L'état public d'un joueur (vivant / éliminé / rôle révélé) est stocké
--    séparément dans `game_player_status`, lisible par la room : Realtime
--    diffuse donc uniquement des colonnes non sensibles.
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type game_mode as enum ('impostor', 'undercover');
create type difficulty_level as enum ('easy', 'medium', 'hard');
create type player_role as enum ('civilian', 'impostor', 'undercover', 'mr_white');
create type game_phase as enum (
  'lobby',
  'role_assignment',
  'role_reveal',
  'discussion',
  'voting',
  'vote_result',
  'elimination',
  'mr_white_guess',
  'next_round',
  'game_over',
  'results'
);
create type room_status as enum ('lobby', 'in_game', 'finished', 'cancelled', 'expired');
create type room_visibility as enum ('private', 'public');
create type winner_side as enum ('civilians', 'impostors', 'undercover', 'mr_white');

-- ---------------------------------------------------------------------------
-- Identités
-- ---------------------------------------------------------------------------

-- Profil minimal adossé à auth.users (session anonyme ou compte admin).
-- Prévu pour accueillir plus tard pseudo persistant, XP, statistiques.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_anonymous boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Administrateurs : compte email/mot de passe Supabase Auth.
create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins a where a.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Catalogue de mots
-- ---------------------------------------------------------------------------
create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  emoji text not null default '🎯',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Mots du mode Imposteur : un mot secret + un indice général.
create table impostor_words (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  word text not null,
  hint text not null,
  category_id uuid references categories (id) on delete set null,
  difficulty difficulty_level not null default 'medium',
  accepted_answers text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint impostor_words_hint_differs check (lower(hint) <> lower(word))
);

-- Paires du mode Undercover : deux mots du même univers sémantique.
create table word_pairs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  civilian_word text not null,
  undercover_word text not null,
  category_id uuid references categories (id) on delete set null,
  difficulty difficulty_level not null default 'medium',
  accepted_answers text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint word_pairs_distinct check (lower(civilian_word) <> lower(undercover_word))
);

-- Appartenance aux packs (many-to-many, polymorphe léger mais contraint).
create table pack_impostor_words (
  pack_id uuid not null references packs (id) on delete cascade,
  word_id uuid not null references impostor_words (id) on delete cascade,
  primary key (pack_id, word_id)
);

create table pack_word_pairs (
  pack_id uuid not null references packs (id) on delete cascade,
  pair_id uuid not null references word_pairs (id) on delete cascade,
  primary key (pack_id, pair_id)
);

create index impostor_words_difficulty_idx on impostor_words (difficulty) where is_active;
create index word_pairs_difficulty_idx on word_pairs (difficulty) where is_active;
create index pack_impostor_words_pack_idx on pack_impostor_words (pack_id);
create index pack_word_pairs_pack_idx on pack_word_pairs (pack_id);

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------
create table rooms (
  id uuid primary key default gen_random_uuid(),
  -- Code public de 6 caractères, sans caractères ambigus (0/O/1/I/L).
  code text not null unique,
  host_player_id uuid,
  status room_status not null default 'lobby',
  visibility room_visibility not null default 'private',
  mode game_mode not null default 'undercover',
  -- Configuration validée côté serveur avant écriture (schéma Zod).
  settings jsonb not null default '{}'::jsonb,
  max_players integer not null default 12,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '6 hours',
  constraint rooms_code_format check (code ~ '^[A-Z0-9]{6}$'),
  constraint rooms_max_players_range check (max_players between 3 and 12)
);

create index rooms_status_idx on rooms (status);
create index rooms_public_idx on rooms (visibility, status, last_activity_at desc)
  where visibility = 'public' and status = 'lobby';
create index rooms_expires_idx on rooms (expires_at) where status <> 'expired';

create table room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  avatar_key text not null,
  is_host boolean not null default false,
  -- Le joueur est-il présent (false = a quitté volontairement) ?
  is_present boolean not null default true,
  -- Historique récent de rôles spéciaux, pour l'équité des rematchs.
  recent_special_count integer not null default 0,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint room_players_name_length check (char_length(name) between 2 and 20)
);

-- Un pseudo unique par room (insensible à la casse) et un seul siège par user.
create unique index room_players_unique_name on room_players (room_id, lower(name));
create unique index room_players_unique_user on room_players (room_id, user_id);
create index room_players_room_idx on room_players (room_id);

alter table rooms
  add constraint rooms_host_fk foreign key (host_player_id)
  references room_players (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Parties
-- ---------------------------------------------------------------------------
create table games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  mode game_mode not null,
  settings jsonb not null,
  phase game_phase not null default 'role_assignment',
  round integer not null default 1,
  description_pass integer not null default 1,
  -- Ordre de parole du tour courant (ids de room_players).
  speaking_order uuid[] not null default '{}',
  current_speaker_index integer not null default -1,
  base_order uuid[] not null default '{}',
  first_speaker_offset integer not null default 0,
  runoff_candidates uuid[],
  runoff_count integer not null default 0,
  empty_vote_streak integer not null default 0,
  pending_mr_white_id uuid references room_players (id) on delete set null,
  -- Résultat du dernier scrutin (public une fois le vote fermé).
  last_vote jsonb,
  last_mr_white_guess jsonb,
  eliminations jsonb not null default '[]'::jsonb,
  winner winner_side,
  -- `true` quand la partie s'est terminée sans vainqueur (table AFK).
  abandoned boolean not null default false,
  -- Contenu lexical : reste secret côté client jusqu'aux résultats.
  word_source_id uuid,
  civilian_word text not null,
  undercover_word text,
  impostor_hint text,
  accepted_answers text[] not null default '{}',
  word_category text,
  word_difficulty difficulty_level,
  phase_ends_at timestamptz,
  is_paused boolean not null default false,
  -- Verrou optimiste : chaque transition incrémente `version`. Les écritures du
  -- backend sont conditionnées à la version lue, ce qui empêche deux clients
  -- d'appliquer simultanément la même transition (double avance de phase).
  version integer not null default 0,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint games_round_positive check (round >= 1)
);

create index games_room_idx on games (room_id, started_at desc);
create index games_active_idx on games (phase) where finished_at is null;

-- Données SECRÈTES par joueur : rôle et mot personnel.
-- RLS : lecture limitée à sa propre ligne. Aucune écriture client.
create table game_players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  room_player_id uuid not null references room_players (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role player_role not null,
  word text,
  hint text,
  has_seen_role boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index game_players_unique on game_players (game_id, room_player_id);
create index game_players_user_idx on game_players (game_id, user_id);

-- État PUBLIC par joueur : diffusé en Realtime à toute la room.
create table game_player_status (
  game_id uuid not null references games (id) on delete cascade,
  room_player_id uuid not null references room_players (id) on delete cascade,
  is_alive boolean not null default true,
  eliminated_round integer,
  -- Rôle révélé publiquement (élimination avec révélation, ou fin de partie).
  revealed_role player_role,
  has_seen_role boolean not null default false,
  has_voted boolean not null default false,
  primary key (game_id, room_player_id)
);

create index game_player_status_game_idx on game_player_status (game_id);

-- Miroir PUBLIC de la phase courante, diffusé en Realtime.
--
-- `games` n'est pas lisible par le client pendant la partie (elle contient les
-- mots secrets), et un événement Realtime sur une ligne non lisible n'atteint
-- pas le client. Cette table ne contient aucune donnée sensible : elle sert de
-- signal « la partie a changé d'état, rechargez `game_public_state` ».
create table game_phase_events (
  game_id uuid primary key references games (id) on delete cascade,
  room_id uuid not null references rooms (id) on delete cascade,
  phase game_phase not null,
  round integer not null default 1,
  version integer not null default 0,
  updated_at timestamptz not null default now()
);

create index game_phase_events_room_idx on game_phase_events (room_id);

-- Votes : secrets pendant le scrutin (lecture limitée à son propre vote).
create table votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  round integer not null,
  -- Numéro de barrage (0 = scrutin principal du tour).
  runoff integer not null default 0,
  voter_id uuid not null references room_players (id) on delete cascade,
  target_id uuid not null references room_players (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint votes_no_self check (voter_id <> target_id)
);

-- Un seul vote par joueur et par scrutin : garde-fou contre le double vote,
-- y compris si deux requêtes arrivent au même instant.
create unique index votes_unique_per_ballot on votes (game_id, round, runoff, voter_id);
create index votes_game_idx on votes (game_id, round, runoff);

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  room_player_id uuid not null references room_players (id) on delete cascade,
  -- 'text' ou 'reaction'
  kind text not null default 'text',
  body text not null,
  created_at timestamptz not null default now(),
  constraint chat_messages_kind check (kind in ('text', 'reaction')),
  constraint chat_messages_body_length check (char_length(body) between 1 and 200)
);

create index chat_messages_room_idx on chat_messages (room_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Analytics anonymes & signalements
-- ---------------------------------------------------------------------------
create table analytics_events (
  id bigserial primary key,
  event text not null,
  room_id uuid,
  game_id uuid,
  mode game_mode,
  player_count integer,
  duration_seconds integer,
  packs text[],
  difficulty text,
  winner winner_side,
  created_at timestamptz not null default now()
);

create index analytics_events_event_idx on analytics_events (event, created_at desc);
create index analytics_events_created_idx on analytics_events (created_at desc);

create table reports (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references rooms (id) on delete set null,
  reporter_user_id uuid references auth.users (id) on delete set null,
  reason text not null,
  details text,
  -- 'open' | 'reviewed' | 'dismissed'
  status text not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_status check (status in ('open', 'reviewed', 'dismissed')),
  constraint reports_reason_length check (char_length(reason) between 3 and 80)
);

create index reports_status_idx on reports (status, created_at desc);

-- Réglages globaux modifiables depuis l'admin.
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Anti-abus : compteurs par utilisateur et par action
-- ---------------------------------------------------------------------------
create table rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null default now(),
  count integer not null default 0,
  primary key (user_id, action)
);

-- Incrémente le compteur d'une action et indique si la limite est dépassée.
create or replace function rate_limit_hit(
  p_user_id uuid,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_start timestamptz;
begin
  insert into rate_limits (user_id, action, window_start, count)
  values (p_user_id, p_action, now(), 1)
  on conflict (user_id, action) do update
    set count = case
          when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else rate_limits.count + 1
        end,
        window_start = case
          when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else rate_limits.window_start
        end
  returning count, window_start into v_count, v_start;

  -- true = autorisé, false = limite atteinte
  return v_count <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers de permission
-- ---------------------------------------------------------------------------

-- L'utilisateur courant est-il membre de cette room ?
create or replace function is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from room_players rp
    where rp.room_id = p_room_id and rp.user_id = auth.uid()
  );
$$;

-- L'utilisateur courant est-il membre de la room de cette partie ?
create or replace function is_game_member(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from games g
    join room_players rp on rp.room_id = g.room_id
    where g.id = p_game_id and rp.user_id = auth.uid()
  );
$$;

-- Cette partie est-elle terminée (les secrets deviennent publics) ?
create or replace function is_game_finished(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select g.phase = 'results' or g.finished_at is not null from games g where g.id = p_game_id),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table admins enable row level security;
alter table categories enable row level security;
alter table packs enable row level security;
alter table impostor_words enable row level security;
alter table word_pairs enable row level security;
alter table pack_impostor_words enable row level security;
alter table pack_word_pairs enable row level security;
alter table rooms enable row level security;
alter table room_players enable row level security;
alter table games enable row level security;
alter table game_players enable row level security;
alter table game_player_status enable row level security;
alter table game_phase_events enable row level security;
alter table votes enable row level security;
alter table chat_messages enable row level security;
alter table analytics_events enable row level security;
alter table reports enable row level security;
alter table app_settings enable row level security;
alter table rate_limits enable row level security;

-- Profils : chacun voit et met à jour le sien.
create policy profiles_select_self on profiles for select using (id = auth.uid());
create policy profiles_update_self on profiles for update using (id = auth.uid());
create policy profiles_admin_all on profiles for select using (is_admin());

-- Admins : la table n'est lisible que par les admins eux-mêmes.
create policy admins_select_self on admins for select using (user_id = auth.uid());

-- Catalogue : lecture publique des entrées actives (nécessaire au mode local),
-- écriture réservée aux admins.
create policy categories_read on categories for select using (true);
create policy packs_read on packs for select using (is_active or is_admin());
create policy impostor_words_read on impostor_words for select using (is_active or is_admin());
create policy word_pairs_read on word_pairs for select using (is_active or is_admin());
create policy pack_impostor_words_read on pack_impostor_words for select using (true);
create policy pack_word_pairs_read on pack_word_pairs for select using (true);

create policy categories_admin_write on categories for all using (is_admin()) with check (is_admin());
create policy packs_admin_write on packs for all using (is_admin()) with check (is_admin());
create policy impostor_words_admin_write on impostor_words for all using (is_admin()) with check (is_admin());
create policy word_pairs_admin_write on word_pairs for all using (is_admin()) with check (is_admin());
create policy pack_impostor_words_admin_write on pack_impostor_words for all
  using (is_admin()) with check (is_admin());
create policy pack_word_pairs_admin_write on pack_word_pairs for all
  using (is_admin()) with check (is_admin());

-- Rooms : lecture par les membres, plus les rooms publiques en attente
-- (pour la liste des parties ouvertes) et les admins.
create policy rooms_select on rooms for select using (
  is_room_member(id)
  or (visibility = 'public' and status = 'lobby')
  or is_admin()
);
create policy rooms_admin_write on rooms for all using (is_admin()) with check (is_admin());

-- Joueurs d'une room : visibles par les membres de la room. Les rooms publiques
-- exposent seulement leur compteur via la vue `public_rooms`.
create policy room_players_select on room_players for select using (
  is_room_member(room_id) or is_admin()
);
create policy room_players_admin_write on room_players for all using (is_admin()) with check (is_admin());

-- Parties : l'état public est lisible par les membres de la room.
-- ATTENTION : cette table contient `civilian_word` / `undercover_word` /
-- `impostor_hint`. Le client ne lit donc JAMAIS `games` directement : la
-- politique ci-dessous n'autorise la lecture qu'une fois la partie terminée.
-- Pendant la partie, l'état public passe par la vue `game_public_state`.
create policy games_select_finished on games for select using (
  (is_game_member(id) and (phase = 'results' or finished_at is not null)) or is_admin()
);
create policy games_admin_write on games for all using (is_admin()) with check (is_admin());

-- Rôles/mots secrets : STRICTEMENT sa propre ligne, ou tout le monde dans la
-- room une fois la partie terminée (mode spectateur / écran de résultats).
create policy game_players_select_own on game_players for select using (
  user_id = auth.uid()
  or (is_game_member(game_id) and is_game_finished(game_id))
  or is_admin()
);

-- État public par joueur : lisible par la room (diffusé en Realtime).
create policy game_player_status_select on game_player_status for select using (
  is_game_member(game_id) or is_admin()
);

-- Signal de phase : lisible par la room, aucune donnée sensible.
create policy game_phase_events_select on game_phase_events for select using (
  is_room_member(room_id) or is_admin()
);

-- Votes : on ne voit que son propre vote pendant le scrutin ; tous les votes
-- deviennent visibles quand la partie est terminée.
create policy votes_select_own on votes for select using (
  user_id = auth.uid()
  or (is_game_member(game_id) and is_game_finished(game_id))
  or is_admin()
);

-- Chat : lisible par les membres de la room. L'écriture passe par l'API.
create policy chat_messages_select on chat_messages for select using (
  is_room_member(room_id) or is_admin()
);
create policy chat_messages_admin_write on chat_messages for all using (is_admin()) with check (is_admin());

-- Analytics : écriture serveur uniquement, lecture admin.
create policy analytics_admin_read on analytics_events for select using (is_admin());

-- Signalements : un joueur authentifié peut signaler ; seuls les admins lisent.
create policy reports_insert_authenticated on reports for insert to authenticated
  with check (reporter_user_id = auth.uid());
create policy reports_admin_read on reports for select using (is_admin());
create policy reports_admin_write on reports for update using (is_admin()) with check (is_admin());

-- Réglages applicatifs : lecture publique, écriture admin.
create policy app_settings_read on app_settings for select using (true);
create policy app_settings_admin_write on app_settings for all using (is_admin()) with check (is_admin());

-- Rate limits : jamais exposés au client (aucune policy de lecture).

-- ---------------------------------------------------------------------------
-- Vues publiques (sans données sensibles)
-- ---------------------------------------------------------------------------

-- État de partie diffusable : ne contient AUCUN mot ni rôle non révélé.
--
-- Cette vue est volontairement en `security_invoker = false` (défaut) : elle
-- contourne la RLS de `games` (qui interdit toute lecture pendant la partie)
-- mais n'expose que des colonnes non sensibles, et sa clause WHERE applique
-- elle-même le contrôle d'accès (membre de la room, ou admin).
create view game_public_state as
select
  g.id,
  g.room_id,
  g.mode,
  g.settings,
  g.phase,
  g.round,
  g.description_pass,
  g.speaking_order,
  g.current_speaker_index,
  g.runoff_candidates,
  g.runoff_count,
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
  -- Exposé seulement en fin de partie : sert à l'anti-répétition côté client
  -- (le client mémorise les mots déjà joués, sans compte utilisateur).
  case when g.phase = 'results' or g.finished_at is not null then g.word_source_id end as word_source_id,
  g.word_category,
  g.word_difficulty
from games g
where is_game_member(g.id) or is_admin();

-- Liste des parties publiques rejoignables : aucune info sensible.
-- Également en `security_invoker = false` afin de pouvoir compter les joueurs
-- d'une room dont on n'est pas encore membre.
create view public_rooms as
select
  r.code,
  r.mode,
  r.status,
  r.created_at,
  r.last_activity_at,
  r.max_players,
  (r.settings ->> 'difficulty') as difficulty,
  (select count(*) from room_players rp where rp.room_id = r.id and rp.is_present) as player_count
from rooms r
where r.visibility = 'public'
  and r.status = 'lobby'
  and r.expires_at > now();

grant select on game_public_state to anon, authenticated;
grant select on public_rooms to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime : publier uniquement les tables non sensibles
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table room_players;
alter publication supabase_realtime add table game_player_status;
alter publication supabase_realtime add table game_phase_events;
alter publication supabase_realtime add table chat_messages;
-- `games` est publiée pour les changements de phase : la RLS n'autorisant la
-- lecture qu'en fin de partie, les clients reçoivent l'événement mais pas la
-- ligne pendant le jeu ; l'application recharge alors `game_public_state`.
alter publication supabase_realtime add table games;

-- ---------------------------------------------------------------------------
-- Expiration et nettoyage des rooms
--
-- Stratégie :
--  * `last_activity_at` est mis à jour à chaque action (join, réglages, phase).
--  * `expires_at` = last_activity_at + 6h, prolongé à chaque activité.
--  * Une room inactive depuis 2h en lobby, ou dont `expires_at` est dépassé,
--    passe en `expired`.
--  * Les rooms expirées/terminées depuis plus de 24h sont supprimées (cascade
--    sur joueurs, parties, votes, chat).
--  * Appelé par /api/cron/cleanup (Vercel Cron) ou pg_cron si disponible.
-- ---------------------------------------------------------------------------
create or replace function cleanup_rooms()
returns table (expired_count integer, deleted_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired integer;
  v_deleted integer;
begin
  with updated as (
    update rooms r
    set status = 'expired'
    where r.status in ('lobby', 'in_game')
      and (
        r.expires_at < now()
        or (r.status = 'lobby' and r.last_activity_at < now() - interval '2 hours')
        or (r.status = 'in_game' and r.last_activity_at < now() - interval '4 hours')
      )
    returning 1
  )
  select count(*)::integer into v_expired from updated;

  with removed as (
    delete from rooms r
    where r.status in ('expired', 'finished', 'cancelled')
      and r.last_activity_at < now() - interval '24 hours'
    returning 1
  )
  select count(*)::integer into v_deleted from removed;

  return query select v_expired, v_deleted;
end;
$$;

-- Ces fonctions sont réservées au backend (clé service_role).
revoke all on function cleanup_rooms() from public, anon, authenticated;
revoke all on function rate_limit_hit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function cleanup_rooms() to service_role;
grant execute on function rate_limit_hit(uuid, text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Statistiques du dashboard admin (agrégats, aucune donnée personnelle)
-- ---------------------------------------------------------------------------
create or replace function admin_stats()
returns jsonb
language plpgsql
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
      select count(*) from games where started_at >= date_trunc('day', now())
    ),
    'games_total', (select count(*) from games),
    'players_today', (
      select count(distinct rp.user_id) from room_players rp
      where rp.joined_at >= date_trunc('day', now())
    ),
    'active_rooms', (
      select count(*) from rooms where status in ('lobby', 'in_game') and expires_at > now()
    ),
    'avg_duration_seconds', (
      select coalesce(round(avg(extract(epoch from (finished_at - started_at))))::integer, 0)
      from games where finished_at is not null
    ),
    'avg_player_count', (
      select coalesce(round(avg(player_count)::numeric, 1), 0)
      from analytics_events where event = 'game_started' and player_count is not null
    ),
    'most_played_mode', (
      select mode::text from games where mode is not null
      group by mode order by count(*) desc limit 1
    ),
    'top_packs', (
      select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select unnest(packs) as pack, count(*) as games
        from analytics_events
        where event = 'game_started' and packs is not null
        group by pack order by count(*) desc limit 5
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
grant execute on function is_admin() to anon, authenticated, service_role;
grant execute on function is_room_member(uuid) to anon, authenticated, service_role;
grant execute on function is_game_member(uuid) to anon, authenticated, service_role;
grant execute on function is_game_finished(uuid) to anon, authenticated, service_role;
