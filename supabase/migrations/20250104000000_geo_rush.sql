-- GeoRush : secrets, réponses idempotentes et publication atomique.
begin;

create table if not exists geo_sessions (
  session_id uuid primary key references game_sessions (id) on delete cascade,
  room_id uuid not null references rooms (id) on delete cascade,
  state jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists geo_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references geo_sessions (session_id) on delete cascade,
  round_index integer not null check (round_index >= 0),
  room_player_id uuid not null references room_players (id) on delete cascade,
  submitted_answer text not null check (char_length(submitted_answer) between 1 and 100),
  is_correct boolean not null,
  response_ms integer not null check (response_ms >= 0),
  score integer not null check (score >= 0),
  streak integer not null check (streak >= 0),
  created_at timestamptz not null default now(),
  unique (session_id, round_index, room_player_id)
);

create index if not exists geo_answers_round_idx on geo_answers (session_id, round_index);
alter table geo_sessions enable row level security;
alter table geo_answers enable row level security;

-- Aucune policy cliente : les corrigés et réponses ne passent que par service_role.
revoke all on geo_sessions from anon, authenticated;
revoke all on geo_answers from anon, authenticated;

create or replace function geo_commit_state(
  p_session_id uuid,
  p_expected_version integer,
  p_private_state jsonb,
  p_public_state jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  update geo_sessions
  set state = p_private_state, version = version + 1, updated_at = now()
  where session_id = p_session_id and version = p_expected_version;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;

  update game_sessions
  set state = p_public_state, version = p_expected_version + 1
  where id = p_session_id;
  return true;
end;
$$;

revoke all on function geo_commit_state(uuid, integer, jsonb, jsonb) from public;
grant execute on function geo_commit_state(uuid, integer, jsonb, jsonb) to service_role;

commit;
