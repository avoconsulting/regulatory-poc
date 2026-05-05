-- Hybrid search: vector + Postgres FTS kombinert via Reciprocal Rank Fusion.
--
-- Bakgrunn: Voyage-3 embeddings er svake på paragraf-referanser ("PBL §19-2",
-- "KU-forskriften §6") og presise nøkkelbegreper ("rekkefølgekrav",
-- "utbyggingsavtale"). Postgres-FTS dekker akkurat dette gapet via leksikalsk
-- matching mot ordstammer.
--
-- RRF (k=60, fra originalpaperet) blander de to ranglistene uten å normalisere
-- score: hver dokument-ID får score = 1/(60+vector_rank) + 1/(60+fts_rank).
-- Robust og avhengig av rang-rekkefølge, ikke score-skala.
--
-- Kategori-vekten fra rettskildelære-taksonomien beholdes som siste faktor
-- (lov_og_forskrift 0.92, rettspraksis 0.90, …) — speilet fra
-- match_documents_reranked.

-- ──────────────────────────────────────────────
-- 1. tsvector-kolonne (generert, alltid synkronisert med content)
-- ──────────────────────────────────────────────

alter table documents
  add column if not exists content_fts tsvector
  generated always as (
    to_tsvector(
      'norwegian',
      coalesce(title, '') || ' ' || coalesce(content, '')
    )
  ) stored;

-- ──────────────────────────────────────────────
-- 2. GIN-indeks for raske @@ -spørringer
-- ──────────────────────────────────────────────

create index if not exists idx_documents_content_fts
  on documents using gin (content_fts);

-- ──────────────────────────────────────────────
-- 3. Hybrid match-funksjon
-- ──────────────────────────────────────────────

create or replace function match_documents_hybrid(
  query_embedding vector(1024),
  query_text text,
  match_threshold float default 0.30,
  match_count int default 8,
  rrf_k int default 60,
  candidate_pool int default 50
)
returns table (
  id uuid,
  title text,
  content text,
  source_url text,
  category text,
  metadata jsonb,
  similarity float,
  fts_rank float,
  category_weight float,
  rrf_score float,
  hybrid_score float
)
language sql stable
as $$
  with
  -- Vektor-kandidater: topp N etter cosine similarity
  vector_ranked as (
    select
      d.id,
      1 - (d.embedding <=> query_embedding) as similarity,
      row_number() over (order by d.embedding <=> query_embedding) as rank_v
    from documents d
    where 1 - (d.embedding <=> query_embedding) > match_threshold
    order by d.embedding <=> query_embedding
    limit candidate_pool
  ),
  -- FTS-kandidater: topp N etter ts_rank_cd
  -- websearch_to_tsquery håndterer brukerinput trygt (ingen syntax-feil)
  fts_query as (
    select websearch_to_tsquery('norwegian', query_text) as q
  ),
  fts_ranked as (
    select
      d.id,
      ts_rank_cd(d.content_fts, fq.q) as fts_rank,
      row_number() over (order by ts_rank_cd(d.content_fts, fq.q) desc) as rank_f
    from documents d, fts_query fq
    where d.content_fts @@ fq.q
    order by ts_rank_cd(d.content_fts, fq.q) desc
    limit candidate_pool
  ),
  -- Foren ID-settene fra begge kilder
  combined as (
    select
      coalesce(v.id, f.id) as id,
      v.similarity,
      v.rank_v,
      f.fts_rank,
      f.rank_f
    from vector_ranked v
    full outer join fts_ranked f on v.id = f.id
  ),
  -- Hent dokumentdata + beregn RRF + kategorivekt
  scored as (
    select
      c.id,
      d.title,
      d.content,
      d.source_url,
      d.category,
      d.metadata,
      c.similarity,
      c.fts_rank,
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
      end as category_weight,
      (
        coalesce(1.0 / (rrf_k + c.rank_v), 0) +
        coalesce(1.0 / (rrf_k + c.rank_f), 0)
      ) as rrf_score
    from combined c
    join documents d on d.id = c.id
  ),
  -- Dedup på md5(content) — korpuset har samme tekst i flere filer
  deduped as (
    select
      *,
      rrf_score * category_weight as hybrid_score,
      row_number() over (
        partition by md5(content)
        order by rrf_score * category_weight desc, category
      ) as rn
    from scored
  )
  select
    id, title, content, source_url, category, metadata,
    similarity, fts_rank, category_weight, rrf_score, hybrid_score
  from deduped
  where rn = 1
  order by hybrid_score desc
  limit match_count;
$$;
