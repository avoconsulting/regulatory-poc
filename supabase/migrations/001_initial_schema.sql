-- Enable pgvector extension for embedding search
create extension if not exists vector;

-- ──────────────────────────────────────────────
-- Projects
-- ──────────────────────────────────────────────

create type project_status as enum ('draft', 'active', 'completed', 'archived');

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  address text,
  municipality_number text,
  property_id text,
  status project_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_status on projects (status);
create index idx_projects_municipality on projects (municipality_number);

-- ──────────────────────────────────────────────
-- Risk assessments
-- ──────────────────────────────────────────────

create type risk_severity as enum ('low', 'medium', 'high', 'critical');
create type risk_likelihood as enum ('unlikely', 'possible', 'likely', 'certain');
create type risk_status as enum ('identified', 'mitigated', 'accepted', 'resolved');

create table risk_assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  category text not null,
  title text not null,
  description text,
  severity risk_severity not null,
  likelihood risk_likelihood not null,
  status risk_status not null default 'identified',
  mitigation text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_risk_project on risk_assessments (project_id);
create index idx_risk_severity on risk_assessments (severity);
create index idx_risk_status on risk_assessments (status);

-- ──────────────────────────────────────────────
-- Documents (knowledge base with embeddings)
-- ──────────────────────────────────────────────

create table documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  source_url text,
  category text,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_documents_category on documents (category);
create index idx_documents_embedding on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ──────────────────────────────────────────────
-- Similarity search function
-- ──────────────────────────────────────────────

create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float default 0.78,
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  content text,
  source_url text,
  category text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    d.id,
    d.title,
    d.content,
    d.source_url,
    d.category,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- ──────────────────────────────────────────────
-- Auto-update updated_at trigger
-- ──────────────────────────────────────────────

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

create trigger trg_risk_assessments_updated_at
  before update on risk_assessments
  for each row execute function update_updated_at();

create trigger trg_documents_updated_at
  before update on documents
  for each row execute function update_updated_at();
