import { createClient } from "@supabase/supabase-js";

async function embedQuery(text: string): Promise<number[]> {
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: "voyage-3", input: [text], input_type: "query" }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}

async function main() {
  const query = process.argv.slice(2).join(" ") || "Når kreves dispensasjon etter PBL §19?";
  console.log(`Spørring: "${query}"\n`);

  const queryEmbedding = await embedQuery(query);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc("debug_search", {
    query_embedding: queryEmbedding,
    match_count: 10,
  });

  if (error) {
    console.error("RPC-feil:", error);
    process.exit(1);
  }

  console.log(`Topp ${data.length} treff (debug_search, ren seq-scan):\n`);
  for (const row of data) {
    const fn = row.filename ?? "?";
    const isKap19 = fn.toLowerCase().includes("kapittel 19");
    const marker = isKap19 ? " ⭐ DISP" : "";
    console.log(`  [${row.similarity.toFixed(4)}] ${fn}${marker}`);
    console.log(`     ${row.preview.replace(/\s+/g, " ")}…\n`);
  }
}

main().catch(console.error);
