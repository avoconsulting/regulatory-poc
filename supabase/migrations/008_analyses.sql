-- Persistens for komplette risikoanalyser.
--
-- Inntil nå har analyse-resultater bare eksistert i minnet — runAnalysis
-- returnerer RisikoAnalyse til klienten og det forsvinner. UI som vil vise
-- prosjekt-historikk, sammenligne strategier over tid, eller spore hvilke
-- red flags som går igjen i porteføljen, må ha persistens.
--
-- Speiler ku_assessments-mønsteret: hele input + output snapshottes som JSONB
-- for full reproducerbarhet, plus utvalgte felter heves til kolonner for
-- rask filtrering (samletRisiko, antall red flags, grounding-coverage).

create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,

  -- Input snapshot (det vi spurte om)
  adresse text,
  kommunenavn text,
  kommunenummer text,
  gnr int,
  bnr int,
  tiltak jsonb not null,

  -- Output snapshot — hele RisikoAnalyse-objektet
  result jsonb not null,

  -- Kryssreferanse til ku_assessments hvis KU-vurdering ble lagret separat
  ku_assessment_id uuid references ku_assessments(id) on delete set null,

  -- Heisede felter for rask filtrering / aggregering
  samlet_risiko text,
  red_flag_count int,
  hard_stop_count int,
  grounding_coverage real,

  created_at timestamptz not null default now()
);

create index if not exists idx_analyses_project on analyses (project_id);
create index if not exists idx_analyses_created on analyses (created_at desc);
create index if not exists idx_analyses_kommune on analyses (kommunenummer);
create index if not exists idx_analyses_risiko on analyses (samlet_risiko);
