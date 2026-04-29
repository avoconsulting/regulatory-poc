-- A. Senk default threshold fra 0.40 til 0.30.
-- Voyage-3 på norsk lovtekst varierer 0.39-0.59 for relevante treff.
-- 0.40 filtrerte bort gyldige resultater for queryer som "rekkefølgekrav etter PBL §12-7"
-- (topp-treff på 0.392). 0.30 fanger disse uten å slippe inn ren støy.

create or replace function match_documents(
  query_embedding vector(1024),
  match_threshold float default 0.30,
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

-- B. Reranked-versjon: dedup ved query-tid på md5(content).
-- Korpuset har samme chunk-tekst i flere filer (f.eks. "Lov om..." og "Kapittel X..."
-- er utdrag av samme PBL-tekst). Identisk score er signaturen — vi behaller
-- den høyest-rangerte instansen per unike content-hash.

create or replace function match_documents_reranked(
  query_embedding vector(1024),
  match_threshold float default 0.30,
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
  ),
  deduped as (
    select
      *,
      (similarity * weight) as rerank_score,
      row_number() over (
        partition by md5(content)
        order by (similarity * weight) desc, category
      ) as rn
    from scored
  )
  select
    id, title, content, source_url, category, metadata,
    similarity, weight, rerank_score
  from deduped
  where rn = 1
  order by rerank_score desc
  limit match_count;
$$;
