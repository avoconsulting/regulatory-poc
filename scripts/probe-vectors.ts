import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Hvor mange rader har faktisk en gyldig embedding?
  const { count: total } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true });
  console.log(`Totalt rader: ${total}`);

  const { count: withEmb } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .not("embedding", "is", null);
  console.log(`Rader med ikke-null embedding: ${withEmb}`);

  // Sample en rad og sjekk embedding-format eksakt
  const { data: sample } = await supabase
    .from("documents")
    .select("id, embedding")
    .limit(1)
    .single();
  if (sample) {
    const emb = sample.embedding as unknown;
    console.log(`\nSample embedding type: ${typeof emb}`);
    if (typeof emb === "string") {
      try {
        const parsed = JSON.parse(emb);
        console.log(`  Parsed length: ${parsed.length}`);
        console.log(`  First 3 vals: ${parsed.slice(0, 3).join(", ")}`);
      } catch {
        console.log(`  Could not parse as JSON`);
      }
    }
  }
}

main().catch(console.error);
