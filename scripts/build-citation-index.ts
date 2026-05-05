/**
 * Bygg statisk citation-index fra hele kunnskapsbasen.
 *
 * Outputten er en TypeScript-fil som eksporterer Set-er av paragrafer,
 * dommer og standarder som finnes i korpuset. grounding.ts bruker dette
 * for å verifisere AI-sitater også når relevante chunks ikke ble hentet
 * i akkurat den analysen.
 *
 * Kjør på nytt når korpuset endres (re-ingest, nye dokumenter):
 *   npx tsx --env-file=.env.local scripts/build-citation-index.ts
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";
import path from "path";

// Samme regex som grounding.ts — hold synkronisert
const PARAGRAPH_REGEX = /§\s*(\d+(?:-\d+)?)\s*([a-z](?=\s|$|[.,;)]))?/gi;
const CASELAW_REGEX =
  /\b(HR|LB|LG|LE|LF|LH|TOSLO|TBORG|TROMS|TSTAV|TKRSA|RG)-\d{4}-\d+\b/g;
const STANDARD_REGEX =
  /\b(T-\d+(?:\/\d{4})?|NS\s*\d+|TEK\s*\d+|SAK\s*\d+|H-\d+-?[a-z]?)\b/gi;

function normalizeParagraph(num: string, suffix?: string): string {
  const cleanNum = num.replace(/\s+/g, "");
  return suffix ? `§${cleanNum}${suffix.toLowerCase()}` : `§${cleanNum}`;
}

async function main() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const paragraphs = new Set<string>();
  const caselaws = new Set<string>();
  const standards = new Set<string>();

  let from = 0;
  const pageSize = 1000;
  let processed = 0;

  while (true) {
    const { data, error } = await sb
      .from("documents")
      .select("title, content, metadata")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    for (const r of data) {
      const haystack = `${r.title ?? ""}\n${r.content}`;

      for (const m of haystack.matchAll(PARAGRAPH_REGEX)) {
        paragraphs.add(normalizeParagraph(m[1], m[2]));
      }
      for (const m of haystack.matchAll(CASELAW_REGEX)) {
        caselaws.add(m[0].toUpperCase());
      }
      for (const m of haystack.matchAll(STANDARD_REGEX)) {
        standards.add(m[0].replace(/\s+/g, "").toUpperCase());
      }

      const meta = r.metadata as
        | { lovReferanser?: string[]; filename?: string }
        | null;
      for (const ref of meta?.lovReferanser ?? []) {
        for (const m of ref.matchAll(PARAGRAPH_REGEX)) {
          paragraphs.add(normalizeParagraph(m[1], m[2]));
        }
      }
      const filename = meta?.filename ?? "";
      for (const m of filename.matchAll(CASELAW_REGEX)) {
        caselaws.add(m[0].toUpperCase());
      }
      for (const m of filename.matchAll(STANDARD_REGEX)) {
        standards.add(m[0].replace(/\s+/g, "").toUpperCase());
      }
    }

    processed += data.length;
    process.stdout.write(`\r  Behandlet ${processed} chunks…`);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(
    `\n\nFunnet:\n  ${paragraphs.size} unike paragrafer\n  ${caselaws.size} unike domsavgjørelser\n  ${standards.size} unike standarder/veiledere\n`
  );

  // Sortert output for stabil git-diff
  const para = [...paragraphs].sort();
  const cases = [...caselaws].sort();
  const stds = [...standards].sort();

  const generated = `// Auto-generert av scripts/build-citation-index.ts
// Sist oppdatert: ${new Date().toISOString()}
// Antall chunks behandlet: ${processed}
//
// Brukes av grounding.ts for å verifisere AI-sitater mot hele korpuset,
// ikke bare chunks som ble hentet i en gitt analyse. Kjør build-skriptet
// på nytt etter re-ingest eller endringer i korpuset.

export const CORPUS_PARAGRAPHS = new Set<string>(${JSON.stringify(para, null, 2)});

export const CORPUS_CASELAWS = new Set<string>(${JSON.stringify(cases, null, 2)});

export const CORPUS_STANDARDS = new Set<string>(${JSON.stringify(stds, null, 2)});

export const CORPUS_INDEX_META = {
  generatedAt: ${JSON.stringify(new Date().toISOString())},
  chunkCount: ${processed},
  paragraphCount: ${para.length},
  caselawCount: ${cases.length},
  standardCount: ${stds.length},
};
`;

  const outPath = path.resolve("src/lib/citation-index.ts");
  writeFileSync(outPath, generated, "utf-8");
  console.log(`Skrevet til ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
