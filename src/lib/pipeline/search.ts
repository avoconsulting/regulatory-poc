import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

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
}

// ──────────────────────────────────────────────
// Vektorsøk
// ──────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

async function getQueryEmbedding(query: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke satt");

  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
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
  const threshold = opts?.matchThreshold ?? 0.75;
  const count = opts?.matchCount ?? 8;

  const supabase = getSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("match_documents", {
    query_embedding: JSON.stringify(embedding),
    match_threshold: threshold,
    match_count: count,
  });

  if (error) {
    throw new Error(`Vektorsøk feilet: ${error.message}`);
  }

  let results = (data ?? []) as SearchResult[];

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
