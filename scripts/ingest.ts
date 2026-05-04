/**
 * Ingestion script — prosesserer en mappe med dokumenter til Supabase pgvector.
 *
 * Bruk:
 *   npx tsx scripts/ingest.ts ./path/to/documents
 *
 * Flagg:
 *   --force    Reprosesser dokumenter som allerede er indeksert
 *   --dry-run  Vis hva som ville blitt prosessert, uten å lagre
 */

import { findDocuments, extractText } from "../src/lib/pipeline/extract";
import { chunkDocument } from "../src/lib/pipeline/chunk";
import {
  generateEmbeddings,
  storeChunks,
  isDocumentIndexed,
  deleteDocument,
} from "../src/lib/pipeline/embed";
import path from "path";

// ──────────────────────────────────────────────
// CLI-parsing
// ──────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));

const force = flags.has("--force");
const dryRun = flags.has("--dry-run");
const dirPath = positional[0];

if (!dirPath) {
  console.error("Bruk: npx tsx scripts/ingest.ts ./path/to/documents [--force] [--dry-run]");
  process.exit(1);
}

// ──────────────────────────────────────────────
// Hovedlogikk
// ──────────────────────────────────────────────

async function main() {
  const resolvedPath = path.resolve(dirPath);
  console.log(`\nSøker etter dokumenter i: ${resolvedPath}`);
  if (dryRun) console.log("  (dry-run — lagrer ingenting)\n");
  if (force) console.log("  (force — reprosesserer alle)\n");

  const files = await findDocuments(resolvedPath);
  console.log(`Fant ${files.length} dokumenter\n`);

  if (files.length === 0) {
    console.log("Ingen dokumenter å prosessere.");
    return;
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalChunks = 0;

  for (const filePath of files) {
    const filename = path.basename(filePath);
    const relativePath = path.relative(resolvedPath, filePath);

    // Sjekk om allerede indeksert
    if (!force && !dryRun) {
      const indexed = await isDocumentIndexed(filename);
      if (indexed) {
        console.log(`  ⏭  ${relativePath} (allerede indeksert)`);
        skipped++;
        continue;
      }
    }

    try {
      // Steg 1: Ekstraher tekst
      console.log(`  📄 ${relativePath}`);
      const doc = await extractText(filePath);

      if (!doc.text.trim()) {
        console.log(`     ⚠ Tom tekst — hopper over`);
        skipped++;
        continue;
      }

      // PDF-parse returnerer kun sidemarkører ("-- 1 of N --") for scannede
      // PDF-er. Slik tekst gir 0 chunks etter MIN_CHUNK_SIZE-filtrering, og
      // filen vil bli prøvd på nytt ved hver kjøring fordi den aldri ender
      // i DB. Detekter scenariet eksplisitt så det er åpenbart i loggen.
      const meaningfulText = doc.text.replace(/--\s*\d+\s+of\s+\d+\s*--/g, "").trim();
      if (meaningfulText.length < 100) {
        console.log(`     ⚠ Scannet/billed-PDF (${meaningfulText.length} tegn ekstrahert) — krever OCR, hopper over`);
        skipped++;
        continue;
      }

      // Steg 2: Chunk
      const chunks = chunkDocument(doc, filePath);
      console.log(`     ${chunks.length} chunks, kategori: ${chunks[0]?.metadata.category ?? "ukjent"}`);

      if (chunks.length === 0) {
        console.log(`     ⚠ 0 chunks etter filtrering — hopper over`);
        skipped++;
        continue;
      }

      if (dryRun) {
        totalChunks += chunks.length;
        processed++;
        continue;
      }

      // Steg 3: Hvis force, slett gamle chunks først
      if (force) {
        const deleted = await deleteDocument(filename);
        if (deleted > 0) {
          console.log(`     🗑  Slettet ${deleted} gamle chunks`);
        }
      }

      // Steg 4: Generer embeddings
      const texts = chunks.map((c) => c.text);
      const embeddings = await generateEmbeddings(texts);

      // Steg 5: Lagre
      const stored = await storeChunks(chunks, embeddings);
      console.log(`     ✅ Lagret ${stored.length} chunks`);

      totalChunks += stored.length;
      processed++;
    } catch (err) {
      console.error(`     ❌ Feil: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  // Oppsummering
  console.log(`\n${"─".repeat(50)}`);
  console.log(`Ferdig!`);
  console.log(`  Prosessert: ${processed}`);
  console.log(`  Hoppet over: ${skipped}`);
  console.log(`  Feilet: ${failed}`);
  console.log(`  Totalt chunks: ${totalChunks}`);
  if (dryRun) console.log(`\n  (dry-run — ingenting ble lagret)`);
}

main().catch((err) => {
  console.error("Fatal feil:", err);
  process.exit(1);
});
