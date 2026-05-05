/**
 * OCR for scannede PDF-er som pdf-parse ikke kan tekstutdrage.
 *
 * Bruker Claude Sonnet 4.6 sin native PDF-input (ekvivalent med vision på
 * sider). Sender PDF som base64, ber om ren tekst, skriver resultatet som
 * <filename>.ocr.txt ved siden av originalen.
 *
 * Etter at .ocr.txt-filene ligger i cachen, kjør:
 *   npm run ingest -- "drive-cache/Rettskilder. vektor database ny/Innsigelse"
 * Da plukkes de opp som vanlige .txt-dokumenter av eksisterende ingest-pipeline.
 *
 * Fil-listen er fast (de tre vi vet er scannet) — ikke en automatisk re-skanning
 * av cachen. Hvis nye scannede PDF-er dukker opp, legg dem til SCANNED_FILES.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";

const CACHE_BASE = path.resolve("drive-cache/Rettskilder. vektor database ny");

// Identifisert via ingest-loggen (alle 4 ga "Scannet/billed-PDF" — krever OCR).
// Innsigelse.Statsforvalter.pdf finnes i to mapper med samme bytes; OCR den
// kun én gang og kopier .ocr.txt til begge stier så ingest finner den.
const SCANNED_FILES: ReadonlyArray<{ relpath: string; copies?: string[] }> = [
  {
    relpath: "Innsigelse/Innsigelse.Statsforvalter.pdf",
    copies: ["Innsigelse/Hjemmel/Innsigelse.Statsforvalter.pdf"],
  },
  {
    relpath: "Innsigelse/Innsigelse.SAK/nasjonal-og-vesentlig-regional-interesse-innenfor-jordvern.pdf",
  },
  {
    relpath: "Innsigelse/Innsigelse.SAK/retningslinjer-for-innsigelsespraksis-i-energisaker.pdf",
  },
];

const SYSTEM_PROMPT = `Du er en OCR-assistent for norske offentlige dokumenter. Hent ut all tekst fra det vedlagte dokumentet.

Regler:
- Returner KUN den ekstrakerte teksten, ingen kommentar eller meta-tekst.
- Bevar avsnittsstruktur og overskrifter.
- Ikke "rett opp" innholdet — gjengi det som det står.
- Hvis dokumentet inneholder tabeller, gjengi dem som ren tekst med kolonner separert av tabulator.
- Hvis en side er helt tom eller uleselig, skriv "[uleselig side]" på en egen linje.`;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function ocrPdf(absPath: string): Promise<string> {
  const buffer = await fs.readFile(absPath);
  const base64 = buffer.toString("base64");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Hent ut all tekst fra dette PDF-dokumentet.",
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `OCR avkortet (${response.usage.output_tokens}/${16384} tokens). PDF er for stor — splitt eller øk grensen.`
    );
  }

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  console.log(
    `    tokens: input=${response.usage.input_tokens} output=${response.usage.output_tokens}`
  );

  return text.trim();
}

async function main() {
  for (const entry of SCANNED_FILES) {
    const absPath = path.join(CACHE_BASE, entry.relpath);
    console.log(`\n📄 ${entry.relpath}`);

    try {
      const stat = await fs.stat(absPath);
      console.log(`  Størrelse: ${(stat.size / 1024).toFixed(0)} KB`);
    } catch {
      console.error(`  ⚠ Filen finnes ikke: ${absPath}`);
      continue;
    }

    const t0 = Date.now();
    const ocrText = await ocrPdf(absPath);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✓ OCR ferdig på ${elapsed}s (${ocrText.length} tegn)`);

    // Skriv .ocr.txt ved siden av originalen
    const txtPath = absPath.replace(/\.pdf$/i, ".ocr.txt");
    await fs.writeFile(txtPath, ocrText, "utf-8");
    console.log(`  💾 ${path.relative(CACHE_BASE, txtPath)}`);

    // Kopier til andre stier hvis samme fil ligger flere steder
    for (const copyRelpath of entry.copies ?? []) {
      const copyPath = path
        .join(CACHE_BASE, copyRelpath)
        .replace(/\.pdf$/i, ".ocr.txt");
      await fs.writeFile(copyPath, ocrText, "utf-8");
      console.log(`  💾 ${path.relative(CACHE_BASE, copyPath)} (kopi)`);
    }
  }

  console.log(
    `\nFerdig. Kjør deretter:\n  npm run ingest -- "drive-cache/Rettskilder. vektor database ny/Innsigelse"\nfor å indeksere de nye .ocr.txt-filene.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
