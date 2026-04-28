import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true });
  console.log(`Totalt chunks: ${count}`);

  const { data: sample } = await supabase
    .from("documents")
    .select("id, title, category, metadata, embedding")
    .limit(2);

  for (const row of sample ?? []) {
    console.log(`\nID: ${row.id}`);
    console.log(`  Title: ${row.title}`);
    console.log(`  Category: ${row.category}`);
    console.log(`  Filename: ${row.metadata?.filename}`);
    const emb = row.embedding;
    if (typeof emb === "string") {
      console.log(`  Embedding type: string (length ${emb.length}, first 80 chars: ${emb.slice(0, 80)})`);
    } else if (Array.isArray(emb)) {
      console.log(`  Embedding type: array (length ${emb.length})`);
    } else {
      console.log(`  Embedding type: ${typeof emb}`);
    }
  }

  // Sjekk kapittel 19-chunks spesifikt
  const { data: dispChunks } = await supabase
    .from("documents")
    .select("id, title, content")
    .ilike("metadata->>filename", "%Kapittel 19%")
    .limit(3);
  console.log(`\nKapittel 19-chunks funnet: ${dispChunks?.length ?? 0}`);
  for (const row of dispChunks ?? []) {
    console.log(`  - ${row.title}: ${row.content.slice(0, 100)}…`);
  }
}

main().catch(console.error);
