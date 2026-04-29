import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const EMBEDDING_MODEL = "voyage-3";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
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

  const supabase = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("match_documents_reranked", {
    query_embedding: JSON.stringify(embedding),
    match_threshold: threshold,
    match_count: count,
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

  // Filtrer på kategori om spesifisert
  if (opts?.category) {
    results = results.filter((r) => r.category === opts.category);
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
