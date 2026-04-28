-- Diagnose-funksjon: hent topp-N uavhengig av indeks/threshold
create or replace function debug_search(
  query_embedding vector(1024),
  match_count int default 10
)
returns table (
  filename text,
  similarity float,
  preview text
)
language sql stable
as $$
  select
    coalesce(d.metadata->>'filename', d.title) as filename,
    1 - (d.embedding <=> query_embedding) as similarity,
    left(d.content, 120) as preview
  from documents d
  order by d.embedding <=> query_embedding
  limit match_count;
$$;

-- Drop IVFFlat-indeksen hvis den eksisterer (centroidene er meningsløse pga. opprettet før vektorer)
drop index if exists idx_documents_embedding;
