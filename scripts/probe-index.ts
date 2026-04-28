import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // List indexes via system catalog
  const { data, error } = await supabase
    .from("pg_indexes")
    .select("*")
    .eq("tablename", "documents");

  if (error) {
    console.log("(Kan ikke spørre pg_indexes direkte: " + error.message + ")");
  } else {
    console.log("Indexes på documents:", JSON.stringify(data, null, 2));
  }

  // Test rå count: hent alle rader og se om similarity-spørringen returnerer mer enn 4 stk
  // ved å gjøre en spørring uten å bruke embedding-distance
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .ilike("metadata->>filename", "Kapittel%");
  console.log(`\nKapittel-chunks i DB: ${count}`);

  // Ren JS-baseert kontroll: hent alle Kapittel 19-chunks med embedding
  const { data: kap19 } = await supabase
    .from("documents")
    .select("id, embedding")
    .ilike("metadata->>filename", "%Kapittel 19%");

  console.log(`Kapittel 19 funnet: ${kap19?.length ?? 0}`);
  if (kap19?.[0]) {
    const emb = kap19[0].embedding;
    console.log(`Embedding type: ${typeof emb}, lengde: ${typeof emb === "string" ? emb.length : "n/a"}`);
  }
}

main().catch(console.error);
