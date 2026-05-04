/**
 * Probe: ekstrahér tekst fra én PDF og rapporter lengde + første tegn.
 * Brukes til å finne ut om en PDF er scannet (lite/ingen tekst).
 */
import { extractText } from "../src/lib/pipeline/extract";
import { chunkDocument } from "../src/lib/pipeline/chunk";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Bruk: tsx scripts/probe-extract.ts <path>");
  process.exit(1);
}

async function main() {
  const doc = await extractText(filePath);
  const text = doc.text;
  const trimmed = text.trim();
  const chunks = chunkDocument(doc, filePath);

  console.log(`Filename: ${doc.filename}`);
  console.log(`Filetype: ${doc.filetype}`);
  console.log(`Page count: ${doc.pageCount ?? "n/a"}`);
  console.log(`Total text length: ${text.length}`);
  console.log(`Trimmed length: ${trimmed.length}`);
  console.log(`Chunks produced: ${chunks.length}`);
  console.log(`\nFirst 500 chars:\n${trimmed.slice(0, 500)}`);
  console.log(`\nLast 200 chars:\n${trimmed.slice(-200)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
