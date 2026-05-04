-- KU-vurderinger fra ku-trigger-pipeline.
-- Lagrer både input (tiltak + adresse) og output (outcome + triggere + sted-kontekst-snapshot)
-- så vi kan vise historikk og rebuilde analyser ved kildedata-endring.

create type ku_outcome as enum ('always_ku', 'must_assess', 'no_trigger');
create type ku_confidence as enum ('high', 'medium', 'low');

create table if not exists ku_assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,

  -- Snapshot av input (for audit og reproducerbarhet)
  adresse text,
  kommunenavn text,
  kommunenummer text,
  gnr int,
  bnr int,
  tiltak jsonb not null,

  -- Resultat fra Claude
  outcome ku_outcome not null,
  confidence ku_confidence not null,
  rationale text,
  triggers jsonb not null default '[]',

  -- Snapshot av sted-kontekst (verneområder, kulturminne osv.) på analysetidspunkt
  sted_kontekst jsonb not null default '{}',
  -- Audit-info: hvilke RAG-kilder ble brukt
  context_snapshot jsonb,

  created_at timestamptz not null default now()
);

create index if not exists idx_ku_assessments_project on ku_assessments (project_id);
create index if not exists idx_ku_assessments_outcome on ku_assessments (outcome);
create index if not exists idx_ku_assessments_created on ku_assessments (created_at desc);
