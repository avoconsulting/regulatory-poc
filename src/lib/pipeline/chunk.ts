import path from "path";
import type { ExtractedDocument } from "./extract";

// ──────────────────────────────────────────────
// Typer
// ──────────────────────────────────────────────

export interface DocumentChunk {
  text: string;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  filename: string;
  filetype: string;
  category: string;
  subcategory: string | null;
  chunkIndex: number;
  totalChunks: number;
  lovReferanser: string[];
  sectionTitle: string | null;
}

// ──────────────────────────────────────────────
// Kategori fra mappestruktur
// ──────────────────────────────────────────────
//
// Kundens dokumentsamling følger norsk rettskildelære. Kategoriene under
// matcher både de nummererte toppmappene (1-7) i "Rettskilder. vektor
// database ny/" og tverrgående mapper (Innsigelse, KU, Utbyggingsavtaler
// osv.). Andre toppmapper (Red flagg3/, Arealplaner.veileder/) mappes til
// relevante kategorier basert på undermappenavn.

const NUMBERED_CATEGORIES: Record<string, string> = {
  "1": "lov_og_forskrift",
  "2": "rettspraksis",
  "3": "lovforarbeider",
  "4": "forvaltningspraksis",
  "5": "sedvane",
  "6": "faglitteratur",
  "7": "reelle_hensyn",
};

function normalizeFolderName(name: string): string {
  return name.trim().toLowerCase();
}

function matchFolderToCategory(folderName: string): string | null {
  const normalized = normalizeFolderName(folderName);

  const numberedMatch = normalized.match(/^(\d+)[\s.\-–]+/);
  if (numberedMatch && NUMBERED_CATEGORIES[numberedMatch[1]]) {
    return NUMBERED_CATEGORIES[numberedMatch[1]];
  }

  if (normalized.startsWith("innsigelse")) return "innsigelse";
  if (normalized === "ku" || normalized.startsWith("ku ")) return "ku";
  if (normalized.startsWith("rettskilde prinsipper")) return "rettskilde_prinsipper";
  if (
    normalized.startsWith("utbyggingsavtaler") ||
    normalized.startsWith("rekkefølgekrav") ||
    normalized.startsWith("rekkefolgekrav")
  ) {
    return "utbyggingsavtaler";
  }

  if (normalized.startsWith("sjekklister")) return "sjekklister";
  if (
    normalized.startsWith("støttedokumenter") ||
    normalized.startsWith("stottedokumenter")
  ) {
    return "stottedokumenter_plan";
  }
  if (
    normalized.startsWith("masteroppgaver") ||
    normalized.startsWith("referansesaker")
  ) {
    return "faglitteratur";
  }
  if (normalized.startsWith("arealplan")) return "arealplan_veileder";
  if (
    normalized.startsWith("rettsavgjørelser") ||
    normalized.startsWith("rettsavgjorelser")
  ) {
    return "rettspraksis";
  }

  return null;
}

export function detectCategory(filePath: string): {
  category: string;
  subcategory: string | null;
} {
  const parts = filePath.split(path.sep);

  for (let i = 0; i < parts.length; i++) {
    const category = matchFolderToCategory(parts[i]);
    if (category) {
      const next = parts[i + 1];
      const subcategory =
        next && next.trim() && !/\.[a-z]+$/i.test(next) ? next.trim() : null;
      return { category, subcategory };
    }
  }

  return { category: "ukategorisert", subcategory: null };
}

// ──────────────────────────────────────────────
// Finn lovhenvisninger i tekst
// ──────────────────────────────────────────────

const LOV_REGEX = /§\s*\d+[-–]?\d*(?:\s*(?:bokstav|ledd|punkt|nr\.?)\s*[a-zæøå0-9]+)?/gi;
const PBL_REGEX = /(?:pbl|plan-\s*og\s*bygningsloven)\s*§?\s*\d+[-–]?\d*/gi;
const TEK_REGEX = /TEK\s*17?\s*§?\s*\d+[-–]?\d*/gi;

export function finnLovReferanser(text: string): string[] {
  const refs = new Set<string>();
  const matches = [
    ...text.matchAll(LOV_REGEX),
    ...text.matchAll(PBL_REGEX),
    ...text.matchAll(TEK_REGEX),
  ];
  for (const m of matches) {
    refs.add(m[0].trim());
  }
  return Array.from(refs);
}

// ──────────────────────────────────────────────
// Chunking
// ──────────────────────────────────────────────

const TARGET_CHUNK_SIZE = 1500; // tegn (~375 tokens)
const MAX_CHUNK_SIZE = 2500;
const MIN_CHUNK_SIZE = 100; // dropp TOC-fragmenter og overskrifter uten innhold
const OVERLAP = 200; // tegn overlapp mellom chunks

// Forsøk å dele på seksjonsoverskrifter først
const HEADING_REGEX = /\n(?=(?:#{1,4}\s|Kapittel\s+\d|KAPITTEL\s+\d|Kap\.\s+\d|\d+\.\d+\s+[A-ZÆØÅ]))/;

function splitOnHeadings(text: string): string[] {
  const sections = text.split(HEADING_REGEX).filter((s) => s.trim().length > 0);
  return sections;
}

function splitBySize(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + TARGET_CHUNK_SIZE;

    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    // Prøv å bryte på avsnitt
    const breakPoint = text.lastIndexOf("\n\n", end);
    if (breakPoint > start + TARGET_CHUNK_SIZE * 0.5) {
      end = breakPoint;
    } else {
      // Bryt på setningsgrense
      const sentenceBreak = text.lastIndexOf(". ", end);
      if (sentenceBreak > start + TARGET_CHUNK_SIZE * 0.5) {
        end = sentenceBreak + 1;
      } else {
        // Fallback: bryt på ordgrense, aldri midt i et ord
        const wordBreak = text.lastIndexOf(" ", end);
        if (wordBreak > start + TARGET_CHUNK_SIZE * 0.3) {
          end = wordBreak;
        }
      }
    }

    chunks.push(text.slice(start, end));

    // Snap overlap-start til neste ord-grense så vi ikke begynner midt i et ord
    const overlapStart = end - OVERLAP;
    const nextSpace = text.indexOf(" ", overlapStart);
    start = nextSpace !== -1 && nextSpace < end ? nextSpace + 1 : overlapStart;
  }

  return chunks;
}

function extractSectionTitle(text: string): string | null {
  const firstLine = text.trim().split("\n")[0];
  if (
    firstLine &&
    firstLine.length < 120 &&
    (/^#{1,4}\s/.test(firstLine) ||
      /^(?:Kapittel|KAPITTEL|Kap\.)\s+\d/.test(firstLine) ||
      /^\d+\.\d+\s+[A-ZÆØÅ]/.test(firstLine))
  ) {
    return firstLine.replace(/^#+\s*/, "").trim();
  }
  return null;
}

export function chunkDocument(
  doc: ExtractedDocument,
  filePath: string
): DocumentChunk[] {
  const { category, subcategory } = detectCategory(filePath);

  // Rens tekst
  const cleanText = doc.text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleanText) return [];

  // Steg 1: Del på overskrifter
  const sections = splitOnHeadings(cleanText);

  // Steg 2: Del store seksjoner videre
  const rawChunks: string[] = [];
  for (const section of sections) {
    if (section.length <= MAX_CHUNK_SIZE) {
      rawChunks.push(section);
    } else {
      rawChunks.push(...splitBySize(section));
    }
  }

  // Steg 3: Filtrer ut for korte chunks (TOC-fragmenter, tomme overskrifter)
  const filteredChunks = rawChunks.filter(
    (c) => c.trim().length >= MIN_CHUNK_SIZE
  );

  // Steg 4: Bygg chunks med metadata
  const totalChunks = filteredChunks.length;
  return filteredChunks.map((text, i) => ({
    text: text.trim(),
    metadata: {
      filename: doc.filename,
      filetype: doc.filetype,
      category,
      subcategory,
      chunkIndex: i,
      totalChunks,
      lovReferanser: finnLovReferanser(text),
      sectionTitle: extractSectionTitle(text),
    },
  }));
}
