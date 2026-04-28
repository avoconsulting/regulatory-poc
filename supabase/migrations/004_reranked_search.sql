-- A. Senk default threshold på match_documents fra 0.78 til 0.40.
-- Voyage-3 på norsk lovtekst lander typisk i 0.4-0.6 for relevante treff,
-- så 0.78 returnerte null treff i praksis.

create or replace function match_documents(
  query_embedding vector(1024),
  match_threshold float default 0.40,
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

-- B. Rerank-variant: ganger similarity med kildevekt basert på kategori.
-- Vektene speiler rettskildelære-taksonomien i CLAUDE.md og er avledet fra
-- rettskilde_weights-tabellen (002). Filtrerer på rå similarity før rerank
-- så lavt-vektede men perfekte treff ikke faller ut prematurt.

create or replace function match_documents_reranked(
  query_embedding vector(1024),
  match_threshold float default 0.40,
  match_count int default 8
)
returns table (
  id uuid,
  title text,
  content text,
  source_url text,
  category text,
  metadata jsonb,
  similarity float,
  weight float,
  rerank_score float
)
language sql stable
as $$
  with scored as (
    select
      d.id,
      d.title,
      d.content,
      d.source_url,
      d.category,
      d.metadata,
      1 - (d.embedding <=> query_embedding) as similarity,
      case d.category
        when 'lov_og_forskrift'      then 0.92
        when 'rettspraksis'          then 0.90
        when 'ku'                    then 0.85
        when 'lovforarbeider'        then 0.80
        when 'utbyggingsavtaler'     then 0.75
        when 'forvaltningspraksis'   then 0.70
        when 'innsigelse'            then 0.70
        when 'arealplan_veileder'    then 0.55
        when 'rettskilde_prinsipper' then 0.50
        when 'faglitteratur'         then 0.50
        when 'sjekklister'           then 0.50
        when 'stottedokumenter_plan' then 0.45
        when 'sedvane'               then 0.40
        when 'reelle_hensyn'         then 0.40
        else 0.40
      end as weight
    from documents d
    where 1 - (d.embedding <=> query_embedding) > match_threshold
  )
  select
    id, title, content, source_url, category, metadata,
    similarity,
    weight,
    similarity * weight as rerank_score
  from scored
  order by rerank_score desc
  limit match_count;
$$;
