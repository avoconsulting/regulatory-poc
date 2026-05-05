/**
 * Sjekk om en spesifikk sitat-streng (paragraf, dom, standard) finnes i
 * korpuset. Brukes for å validere grounding-verifikasjoner.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const term = process.argv.slice(2).join(" ");
  if (!term) {
    console.error("Bruk: tsx scripts/probe-citation.ts <søkestreng>");
    process.exit(1);
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await sb
    .from("documents")
    .select("title, content, metadata")
    .ilike("content", `%${term}%`)
    .limit(5);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log(`Treff for "${term}": ${data?.length ?? 0} (viser maks 5)`);
  for (const r of data ?? []) {
    const fn = (r.metadata as { filename?: string } | null)?.filename ?? "?";
    const idx = r.content.indexOf(term);
    const ctx = r.content.slice(Math.max(0, idx - 60), idx + 200).replace(/\s+/g, " ");
    console.log(`\n  Fil: ${fn}`);
    console.log(`  Tittel: ${r.title}`);
    console.log(`  …${ctx}…`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
