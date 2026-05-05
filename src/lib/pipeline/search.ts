import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-3";

function getSupabase() {
  // Server-only modul — bruk service role for å unngå RLS som skjuler
  // documents-tabellen for anon. (Ingest-pipelinen i embed.ts bruker også
  // service role; konsistens på tvers er bevisst.)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient<Database>(url, key);
}

// ──────────────────────────────────────────────
// Typer
// ──────────────────────────────────────────────

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  category: string | null;
  sourceUrl: string | null;
  metadata: Record<string, unknown> | null;
  similarity: number;
  weight?: number;
  rerankScore?: number;
  // Hybrid-spesifikke felter (kun satt når searchDocumentsHybrid brukes)
  ftsRank?: number;
  rrfScore?: number;
  hybridScore?: number;
}

// ──────────────────────────────────────────────
// Vektorsøk
// ──────────────────────────────────────────────

async function getQueryEmbedding(query: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY er ikke satt");

  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: [query],
      input_type: "query",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage API-feil: ${res.status} ${body}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

export async function searchDocuments(
  query: string,
  opts?: {
    matchThreshold?: number;
    matchCount?: number;
    category?: string;
  }
): Promise<SearchResult[]> {
  const embedding = await getQueryEmbedding(query);
  const threshold = opts?.matchThreshold ?? 0.3;
  const count = opts?.matchCount ?? 8;

  // Når en kategori er spesifisert filtrerer vi i JS etter RPC. Hent derfor
  // en moderat større pool slik at smale kategorier ikke faller helt ut når
  // topp-treff globalt er i andre kategorier. Holder oversamplingen lav nok
  // til å unngå statement-timeout — for strenge kategorifilter på smal
  // kategori er bedre å pushe filteret inn i SQL (se TODO i ku-trigger).
  const rpcCount = opts?.category ? Math.max(count * 4, 24) : count;

  const supabase = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("match_documents_reranked", {
    query_embedding: JSON.stringify(embedding),
    match_threshold: threshold,
    match_count: rpcCount,
  });

  if (error) {
    throw new Error(`Vektorsøk feilet: ${error.message}`);
  }

  type Row = Omit<SearchResult, "weight" | "rerankScore"> & {
    weight: number;
    rerank_score: number;
  };

  let results = (data ?? []).map((r: Row) => ({
    ...r,
    weight: r.weight,
    rerankScore: r.rerank_score,
  })) as SearchResult[];

  if (opts?.category) {
    results = results.filter((r) => r.category === opts.category).slice(0, count);
  }

  return results;
}

// ──────────────────────────────────────────────
// Hybrid-søk (vektor + Postgres FTS via RRF)
// ──────────────────────────────────────────────
//
// Krever migrasjon 007_hybrid_search.sql. Faller tilbake til vektor-only via
// searchDocuments hvis RPC-funksjonen ikke er tilgjengelig (f.eks. i et nytt
// miljø der migrasjonen ennå ikke er kjørt).

export async function searchDocumentsHybrid(
  query: string,
  opts?: {
    matchThreshold?: number;
    matchCount?: number;
    category?: string;
  }
): Promise<SearchResult[]> {
  const embedding = await getQueryEmbedding(query);
  const threshold = opts?.matchThreshold ?? 0.3;
  const count = opts?.matchCount ?? 8;
  const rpcCount = opts?.category ? Math.max(count * 4, 24) : count;

  const supabase = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("match_documents_hybrid", {
    query_embedding: JSON.stringify(embedding),
    query_text: query,
    match_threshold: threshold,
    match_count: rpcCount,
  });

  if (error) {
    // Hvis hybrid-RPC ikke finnes (migrasjon ikke kjørt), fall tilbake til
    // vektor-only. PostgREST returnerer typisk PGRST202 for manglende
    // funksjoner; vi sjekker også på "function" i meldingen som backup.
    const code = (error as { code?: string }).code;
    const msg = error.message ?? "";
    if (code === "PGRST202" || /function .* does not exist|could not find/i.test(msg)) {
      console.warn(
        `[search] match_documents_hybrid mangler — faller tilbake til vektor-only. Kjør migrasjon 007_hybrid_search.sql.`
      );
      return searchDocuments(query, opts);
    }
    throw new Error(`Hybrid-søk feilet: ${msg}`);
  }

  type Row = {
    id: string;
    title: string;
    content: string;
    source_url: string | null;
    category: string | null;
    metadata: Record<string, unknown> | null;
    similarity: number | null;
    fts_rank: number | null;
    category_weight: number;
    rrf_score: number;
    hybrid_score: number;
  };

  let results: SearchResult[] = (data ?? []).map((r: Row) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    sourceUrl: r.source_url,
    category: r.category,
    metadata: r.metadata,
    similarity: r.similarity ?? 0,
    weight: r.category_weight,
    ftsRank: r.fts_rank ?? undefined,
    rrfScore: r.rrf_score,
    hybridScore: r.hybrid_score,
    rerankScore: r.hybrid_score, // alias for bakoverkompatibilitet
  }));

  if (opts?.category) {
    results = results.filter((r) => r.category === opts.category).slice(0, count);
  }

  return results;
}

// ──────────────────────────────────────────────
// Bygg kontekst fra søkeresultater for Claude
// ──────────────────────────────────────────────

export function byggKunnskapsbaseKontekst(results: SearchResult[]): string {
  if (results.length === 0) return "";

  const deler = ["## Relevante dokumenter fra kunnskapsbasen\n"];

  for (const r of results) {
    const meta = r.metadata as Record<string, unknown> | null;
    const filename = meta?.filename ?? "ukjent";
    const lovRefs = (meta?.lovReferanser as string[]) ?? [];

    deler.push(`### ${r.title} (${r.category ?? "ukategorisert"})`);
    deler.push(`Kilde: ${filename}`);
    if (lovRefs.length > 0) {
      deler.push(`Lovhenvisninger: ${lovRefs.join(", ")}`);
    }
    deler.push(`\n${r.content}\n`);
  }

  return deler.join("\n");
}
