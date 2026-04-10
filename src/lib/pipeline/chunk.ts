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

const CATEGORY_MAP: Record<string, string> = {
  "1": "lov_og_forskrift",
  "2": "rettspraksis",
  "3": "forvaltningspraksis",
  "4": "faglitteratur",
  "5": "kommunal_praksis",
  "6": "politisk_risiko",
  "7": "rekkefolgekrav",
};

export function detectCategory(filePath: string): {
  category: string;
  subcategory: string | null;
} {
  const parts = filePath.split(path.sep);

  // Prøv å matche mappenummer (f.eks. "1 Lov og forskrift", "Mappe 1", etc.)
  for (const part of parts) {
    const match = part.match(/^(\d)/);
    if (match && CATEGORY_MAP[match[1]]) {
      return {
        category: CATEGORY_MAP[match[1]],
        subcategory: part.replace(/^\d+\s*[-–.]?\s*/, "").trim() || null,
      };
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
      }
    }

    chunks.push(text.slice(start, end));
    start = end - OVERLAP;
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

  // Steg 3: Bygg chunks med metadata
  const totalChunks = rawChunks.length;
  return rawChunks.map((text, i) => ({
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
