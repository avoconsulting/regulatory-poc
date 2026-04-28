/**
 * Sanity-check: gjør et vektorsøk mot kunnskapsbasen.
 *
 * Bruk:
 *   npm run search "Når kreves dispensasjon etter PBL §19?"
 */

import { createClient } from "@supabase/supabase-js";

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";

async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY mangler");

  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "voyage-3", input: [text], input_type: "query" }),
  });
  if (!res.ok) throw new Error(`Voyage feilet: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function main() {
  const query = process.argv.slice(2).join(" ");
  if (!query) {
    console.error("Bruk: npx tsx scripts/probe-search.ts <spørring>");
    process.exit(1);
  }

  console.log(`\nSpørring: "${query}"\n`);

  const embedding = await embedQuery(query);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc("match_documents_reranked", {
    query_embedding: embedding,
    match_threshold: 0.4,
    match_count: 10,
  });

  if (error) {
    console.error("RPC-feil:", error);
    process.exit(1);
  }

  console.log(`Topp ${data.length} treff (reranked, threshold 0.4):\n`);
  for (const row of data) {
    const filename = row.metadata?.filename ?? "(ukjent)";
    const sectionTitle = row.metadata?.sectionTitle;
    const preview = row.content.replace(/\s+/g, " ").slice(0, 200);
    console.log(
      `  [rerank ${row.rerank_score.toFixed(3)} = sim ${row.similarity.toFixed(3)} × w ${row.weight.toFixed(2)}] ${filename} (${row.category ?? "ukat"})`
    );
    if (sectionTitle) console.log(`     § ${sectionTitle}`);
    console.log(`     ${preview}…\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
