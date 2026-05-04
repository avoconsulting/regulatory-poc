/**
 * Probe: vis dekning av kunnskapsbasen.
 *  - Antall chunks per kategori
 *  - Antall unike filer per kategori
 *  - Top filer etter chunk-antall (for å spotte dominerende dokumenter)
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count: total } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true });
  console.log(`Totalt chunks: ${total}\n`);

  // Hent alle rader (kun lette felter) og aggregerer i JS for enkelhets skyld
  const allRows: { category: string | null; filename: string | null }[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("documents")
      .select("category, metadata")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const r of data) {
      allRows.push({
        category: r.category,
        filename: (r.metadata as { filename?: string } | null)?.filename ?? null,
      });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Per kategori
  const perCat = new Map<string, { chunks: number; files: Set<string> }>();
  for (const r of allRows) {
    const cat = r.category ?? "ukjent";
    if (!perCat.has(cat)) perCat.set(cat, { chunks: 0, files: new Set() });
    const entry = perCat.get(cat)!;
    entry.chunks += 1;
    if (r.filename) entry.files.add(r.filename);
  }

  console.log("Per kategori:");
  console.log("  kategori                       chunks   filer");
  const sortedCats = [...perCat.entries()].sort((a, b) => b[1].chunks - a[1].chunks);
  for (const [cat, { chunks, files }] of sortedCats) {
    console.log(`  ${cat.padEnd(30)} ${String(chunks).padStart(6)}   ${String(files.size).padStart(5)}`);
  }

  // Top 20 filer
  const perFile = new Map<string, number>();
  for (const r of allRows) {
    if (!r.filename) continue;
    perFile.set(r.filename, (perFile.get(r.filename) ?? 0) + 1);
  }
  console.log("\nTop 20 filer etter chunk-antall:");
  const topFiles = [...perFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [filename, n] of topFiles) {
    console.log(`  ${String(n).padStart(5)}  ${filename}`);
  }

  console.log(`\nUnike filnavn totalt: ${perFile.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
