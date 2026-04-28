import { extractText } from "../src/lib/pipeline/extract";
import { chunkDocument } from "../src/lib/pipeline/chunk";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Bruk: npx tsx scripts/probe-chunks.ts <fil>");
  process.exit(1);
}

async function main() {
  const doc = await extractText(filePath);
  console.log(`Fil: ${doc.filename}`);
  console.log(`Type: ${doc.filetype}`);
  console.log(`Tekstlengde: ${doc.text.length.toLocaleString()} tegn`);
  console.log(`Sider: ${doc.pageCount ?? "n/a"}`);

  const chunks = chunkDocument(doc, filePath);
  console.log(`\nTotalt chunks: ${chunks.length}`);

  const sizes = chunks.map((c) => c.text.length);
  const avg = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);
  const min = Math.min(...sizes);
  const max = Math.max(...sizes);
  console.log(`Chunk-størrelse: snitt ${avg}, min ${min}, max ${max} tegn`);

  const withTitle = chunks.filter((c) => c.metadata.sectionTitle).length;
  console.log(`Chunks med sectionTitle: ${withTitle} / ${chunks.length}`);

  console.log(`\nFørste 5 chunks (første linje + lengde):`);
  for (let i = 0; i < Math.min(5, chunks.length); i++) {
    const firstLine = chunks[i].text.split("\n")[0].slice(0, 100);
    console.log(`  [${i}] ${chunks[i].text.length} tegn: ${firstLine}`);
  }

  console.log(`\nMidten av dokumentet (chunks ${Math.floor(chunks.length / 2)}–${Math.floor(chunks.length / 2) + 4}):`);
  for (let i = Math.floor(chunks.length / 2); i < Math.min(Math.floor(chunks.length / 2) + 5, chunks.length); i++) {
    const firstLine = chunks[i].text.split("\n")[0].slice(0, 100);
    console.log(`  [${i}] ${chunks[i].text.length} tegn: ${firstLine}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
