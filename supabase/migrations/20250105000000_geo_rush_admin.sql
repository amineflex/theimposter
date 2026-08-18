-- Champs GeoRush modifiables depuis le panel admin.
-- La géométrie et les identifiants ISO restent dans le catalogue versionné.
begin;

create table if not exists geo_country_overrides (
  code text primary key check (code ~ '^[a-z]{2}$'),
  name text check (name is null or char_length(trim(name)) between 1 and 80),
  capital text check (capital is null or char_length(trim(capital)) between 1 and 80),
  difficulty text check (difficulty is null or difficulty in ('easy', 'normal', 'hard')),
  aliases text[] check (aliases is null or cardinality(aliases) <= 25),
  capital_aliases text[] check (capital_aliases is null or cardinality(capital_aliases) <= 25),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table geo_country_overrides enable row level security;

-- Lecture et écriture uniquement via les routes serveur protégées par requireAdminUser.
revoke all on geo_country_overrides from anon, authenticated;

commit;
