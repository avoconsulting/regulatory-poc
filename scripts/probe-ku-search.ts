import { searchDocuments } from "../src/lib/pipeline/search";

async function main() {
  const longQuery =
    "konsekvensutredning vedlegg krav trigger Bolig leiligheter Oppføring av leilighetsbygg på næringstomt transformasjon næring/lager til bolig";
  const focusedQuery = "KU-forskriften vedlegg I og II";

  const r1 = await searchDocuments(longQuery, { matchCount: 8 });
  console.log(`Uten kategori (long query, top 8):`);
  for (const x of r1) {
    const fn = (x.metadata as Record<string, unknown> | null)?.filename ?? "?";
    console.log(`  [${x.category}] ${fn} (sim ${x.similarity.toFixed(3)})`);
  }

  const r2 = await searchDocuments(longQuery, {
    matchCount: 8,
    category: "lov_og_forskrift",
  });
  console.log(`\nMed lov_og_forskrift-filter (oversampled top 80, filtrert):`);
  for (const x of r2) {
    const fn = (x.metadata as Record<string, unknown> | null)?.filename ?? "?";
    console.log(`  [${x.category}] ${fn} (sim ${x.similarity.toFixed(3)})`);
  }
  if (r2.length === 0) console.log("  (ingen treff)");

  const r3 = await searchDocuments(longQuery, {
    matchCount: 8,
    category: "ku",
  });
  console.log(`\nMed ku-filter:`);
  for (const x of r3) {
    const fn = (x.metadata as Record<string, unknown> | null)?.filename ?? "?";
    console.log(`  [${x.category}] ${fn} (sim ${x.similarity.toFixed(3)})`);
  }
  if (r3.length === 0) console.log("  (ingen treff)");

  const r4 = await searchDocuments(focusedQuery, { matchCount: 8 });
  console.log(`\nFokusert query "${focusedQuery}" uten kategori:`);
  for (const x of r4) {
    const fn = (x.metadata as Record<string, unknown> | null)?.filename ?? "?";
    console.log(`  [${x.category}] ${fn} (sim ${x.similarity.toFixed(3)})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
