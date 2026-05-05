/**
 * Sammenlign hybrid-søk mot vektor-only på en håndfull representative
 * spørsmål. Gjør det enkelt å se hva BM25/FTS-laget faktisk legger til.
 *
 * Krever at migrasjon 007_hybrid_search.sql er kjørt. Hvis ikke faller
 * searchDocumentsHybrid tilbake til vektor-only og resultatene blir
 * identiske — som er en gyldig sanity-check i seg selv.
 */
import { searchDocuments, searchDocumentsHybrid } from "../src/lib/pipeline/search";

const QUERIES = [
  "PBL § 19-2 dispensasjon",
  "rekkefølgekrav utbyggingsavtale",
  "KU-forskriften vedlegg I og II",
  "transformasjon fra næring til bolig Oslo",
  "T-1442 støy boligbygg",
];

async function main() {
  for (const q of QUERIES) {
    console.log(`\n${"━".repeat(70)}\nQuery: "${q}"\n${"━".repeat(70)}`);

    const [vec, hyb] = await Promise.all([
      searchDocuments(q, { matchCount: 5, matchThreshold: 0.3 }),
      searchDocumentsHybrid(q, { matchCount: 5, matchThreshold: 0.3 }),
    ]);

    console.log(`\nVektor-only (topp 5):`);
    for (const r of vec) {
      const fn = (r.metadata as { filename?: string } | null)?.filename ?? "?";
      console.log(`  [${r.category}] ${fn} (sim ${r.similarity.toFixed(3)} × w ${r.weight?.toFixed(2)} = ${r.rerankScore?.toFixed(3)})`);
    }

    console.log(`\nHybrid (topp 5):`);
    for (const r of hyb) {
      const fn = (r.metadata as { filename?: string } | null)?.filename ?? "?";
      const sim = r.similarity?.toFixed(3) ?? "n/a";
      const fts = r.ftsRank?.toFixed(3) ?? "n/a";
      const rrf = r.rrfScore?.toFixed(4) ?? "n/a";
      const score = r.hybridScore?.toFixed(4) ?? "n/a";
      console.log(`  [${r.category}] ${fn}`);
      console.log(`    sim=${sim} fts=${fts} rrf=${rrf} hybrid=${score}`);
    }

    // Diff: hvilke filer er i hybrid men ikke vektor-only?
    const vecIds = new Set(vec.map((r) => r.id));
    const hybIds = new Set(hyb.map((r) => r.id));
    const newInHybrid = hyb.filter((r) => !vecIds.has(r.id));
    const lostFromVector = vec.filter((r) => !hybIds.has(r.id));

    if (newInHybrid.length > 0) {
      console.log(`\n  ➕ Nye i hybrid:`);
      for (const r of newInHybrid) {
        const fn = (r.metadata as { filename?: string } | null)?.filename ?? "?";
        console.log(`    ${fn}`);
      }
    }
    if (lostFromVector.length > 0) {
      console.log(`\n  ➖ Falt ut sammenlignet med vektor-only:`);
      for (const r of lostFromVector) {
        const fn = (r.metadata as { filename?: string } | null)?.filename ?? "?";
        console.log(`    ${fn}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
