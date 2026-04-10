import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import type { DocumentChunk } from "./chunk";

// ──────────────────────────────────────────────
// Konfigurasjon
// ──────────────────────────────────────────────

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 20; // OpenAI anbefaler maks 2048, men vi holder det lavt for stabilitet

// ──────────────────────────────────────────────
// Klienter (bruker service role for skrivetilgang)
// ──────────────────────────────────────────────

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY er ikke satt");
  return new OpenAI({ apiKey });
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY må være satt");
  }
  return createClient(url, key);
}

// ──────────────────────────────────────────────
// Generer embeddings i batches
// ──────────────────────────────────────────────

export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  const openai = getOpenAI();
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    for (const item of response.data) {
      embeddings.push(item.embedding);
    }
  }

  return embeddings;
}

// ──────────────────────────────────────────────
// Lagre chunks med embeddings i Supabase
// ──────────────────────────────────────────────

export interface StoredDocument {
  id: string;
  chunkIndex: number;
  filename: string;
}

export async function storeChunks(
  chunks: DocumentChunk[],
  embeddings: number[][]
): Promise<StoredDocument[]> {
  if (chunks.length !== embeddings.length) {
    throw new Error(
      `Mismatch: ${chunks.length} chunks, ${embeddings.length} embeddings`
    );
  }

  const supabase = getSupabase();
  const stored: StoredDocument[] = [];

  // Sett inn i batches for å unngå for store payloads
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batchChunks = chunks.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

    const rows = batchChunks.map((chunk, j) => ({
      title: chunk.metadata.sectionTitle ?? chunk.metadata.filename,
      content: chunk.text,
      category: chunk.metadata.category,
      embedding: JSON.stringify(batchEmbeddings[j]),
      metadata: {
        filename: chunk.metadata.filename,
        filetype: chunk.metadata.filetype,
        subcategory: chunk.metadata.subcategory,
        chunkIndex: chunk.metadata.chunkIndex,
        totalChunks: chunk.metadata.totalChunks,
        lovReferanser: chunk.metadata.lovReferanser,
        sectionTitle: chunk.metadata.sectionTitle,
      },
    }));

    const { data, error } = await supabase
      .from("documents")
      .insert(rows)
      .select("id");

    if (error) {
      throw new Error(`Supabase insert feilet: ${error.message}`);
    }

    if (data) {
      for (let j = 0; j < data.length; j++) {
        stored.push({
          id: data[j].id,
          chunkIndex: batchChunks[j].metadata.chunkIndex,
          filename: batchChunks[j].metadata.filename,
        });
      }
    }
  }

  return stored;
}

// ──────────────────────────────────────────────
// Sjekk om et dokument allerede er indeksert
// ──────────────────────────────────────────────

export async function isDocumentIndexed(filename: string): Promise<boolean> {
  const supabase = getSupabase();
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("metadata->>filename", filename);

  return (count ?? 0) > 0;
}

// ──────────────────────────────────────────────
// Slett et dokument (alle chunks)
// ──────────────────────────────────────────────

export async function deleteDocument(filename: string): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("metadata->>filename", filename)
    .select("id");

  if (error) throw new Error(`Sletting feilet: ${error.message}`);
  return data?.length ?? 0;
}
