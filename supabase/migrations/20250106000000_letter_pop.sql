-- LetterPop! : état privé versionné, réponses secrètes et fin de manche atomique.
begin;

create table if not exists letter_pop_sessions (
  session_id uuid primary key references game_sessions (id) on delete cascade,
  room_id uuid not null references rooms (id) on delete cascade,
  state jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table if not exists letter_pop_answers (
  session_id uuid not null references letter_pop_sessions (session_id) on delete cascade,
  round_index integer not null check (round_index >= 0),
  room_player_id uuid not null references room_players (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  evaluations jsonb not null default '{}'::jsonb check (jsonb_typeof(evaluations) = 'object'),
  locked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (session_id, round_index, room_player_id)
);

create table if not exists letter_pop_votes (
  session_id uuid not null references letter_pop_sessions (session_id) on delete cascade,
  round_index integer not null check (round_index >= 0),
  pending_id text not null check (char_length(pending_id) between 3 and 180),
  voter_id uuid not null references room_players (id) on delete cascade,
  decision boolean not null,
  created_at timestamptz not null default now(),
  primary key (session_id, round_index, pending_id, voter_id)
);

create index if not exists letter_pop_answers_round_idx
  on letter_pop_answers (session_id, round_index);
create index if not exists letter_pop_votes_pending_idx
  on letter_pop_votes (session_id, round_index, pending_id);

alter table letter_pop_sessions enable row level security;
alter table letter_pop_answers enable row level security;
alter table letter_pop_votes enable row level security;

-- Aucune lecture navigateur : les réponses ne sortent que via private-state.
revoke all on letter_pop_sessions from anon, authenticated;
revoke all on letter_pop_answers from anon, authenticated;
revoke all on letter_pop_votes from anon, authenticated;

create or replace function letter_pop_commit_state(
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
  update letter_pop_sessions
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

create or replace function letter_pop_save_answers(
  p_session_id uuid,
  p_round_index integer,
  p_player_id uuid,
  p_answers jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saved integer;
begin
  insert into letter_pop_answers (session_id, round_index, room_player_id, answers, updated_at)
  select p_session_id, p_round_index, p_player_id, p_answers, now()
  where exists (
    select 1 from letter_pop_sessions s
    where s.session_id = p_session_id
      and (s.state ->> 'phase') in ('answering', 'final_countdown')
      and (s.state ->> 'roundIndex')::integer = p_round_index
  )
  on conflict (session_id, round_index, room_player_id) do update
  set answers = excluded.answers, updated_at = now()
  where letter_pop_answers.locked_at is null;
  get diagnostics v_saved = row_count;
  return v_saved = 1;
end;
$$;

create or replace function letter_pop_trigger_finish(
  p_session_id uuid,
  p_expected_version integer,
  p_round_index integer,
  p_player_id uuid,
  p_answers jsonb,
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
  update letter_pop_sessions
  set state = p_private_state, version = version + 1, updated_at = now()
  where session_id = p_session_id
    and version = p_expected_version
    and (state ->> 'phase') = 'answering'
    and (state ->> 'roundIndex')::integer = p_round_index;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return false; end if;

  insert into letter_pop_answers (session_id, round_index, room_player_id, answers, locked_at, updated_at)
  values (p_session_id, p_round_index, p_player_id, p_answers, now(), now())
  on conflict (session_id, round_index, room_player_id) do update
  set answers = excluded.answers, locked_at = now(), updated_at = now();

  update game_sessions
  set state = p_public_state, version = p_expected_version + 1
  where id = p_session_id;
  return true;
end;
$$;

revoke all on function letter_pop_commit_state(uuid, integer, jsonb, jsonb) from public;
revoke all on function letter_pop_save_answers(uuid, integer, uuid, jsonb) from public;
revoke all on function letter_pop_trigger_finish(uuid, integer, integer, uuid, jsonb, jsonb, jsonb) from public;
grant execute on function letter_pop_commit_state(uuid, integer, jsonb, jsonb) to service_role;
grant execute on function letter_pop_save_answers(uuid, integer, uuid, jsonb) to service_role;
grant execute on function letter_pop_trigger_finish(uuid, integer, integer, uuid, jsonb, jsonb, jsonb) to service_role;

commit;
