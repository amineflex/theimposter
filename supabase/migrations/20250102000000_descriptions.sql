-- ===========================================================================
-- The Imposter  ·  descriptions écrites
--
-- En mode en ligne, chaque joueur ÉCRIT sa description à son tour au lieu de
-- passer par le chat. Les descriptions sont publiques par nature (c'est le cœur
-- du jeu) et restent affichées au moment du vote, comme un historique.
--
-- Migration additive : elle peut être appliquée sur une base déjà en service.
-- ===========================================================================

create table if not exists game_descriptions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  room_player_id uuid not null references room_players (id) on delete cascade,
  -- Tour de jeu et passe de description auxquels appartient la prise de parole.
  round integer not null,
  pass integer not null default 1,
  body text not null,
  created_at timestamptz not null default now(),
  constraint game_descriptions_body_length check (char_length(body) between 1 and 120)
);

-- Une seule description par joueur et par passe : garde-fou contre le double
-- envoi, y compris si deux requêtes arrivent au même instant.
create unique index if not exists game_descriptions_unique
  on game_descriptions (game_id, round, pass, room_player_id);

create index if not exists game_descriptions_game_idx
  on game_descriptions (game_id, round, pass);

alter table game_descriptions enable row level security;

-- Lecture par les membres de la room : une description n'a de sens que si tout
-- le monde la voit. Aucune écriture client : elle passe par /api/game/describe.
drop policy if exists game_descriptions_select on game_descriptions;
create policy game_descriptions_select on game_descriptions for select using (
  is_game_member(game_id) or is_admin()
);

-- Diffusion temps réel : chaque description apparaît immédiatement chez tous.
do $$
begin
  alter publication supabase_realtime add table game_descriptions;
exception
  when duplicate_object then null;
end
$$;
