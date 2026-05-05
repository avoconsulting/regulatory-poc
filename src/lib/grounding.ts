/**
 * Citation grounding for AI-generert reguleringsanalyse.
 *
 * AI-en kan finne på lov-paragrafer, dommer og standarder som ikke finnes.
 * For et juridisk verktøy er oppdiktet rettspraksis det største enkelttapet.
 * Denne modulen ekstraherer alle siterte kilder fra AI-output og kryssjekker
 * dem mot kunnskapsbase-chunkene som faktisk ble brukt i analysen.
 *
 * Filosofi: vi flagger, vi sletter ikke. AI-en kan kjenne en gyldig kilde
 * vi ikke har i basen — sluttbruker må vurdere uverifiserte sitater
 * manuelt. Coverage-tallet sier hvor stor andel av sitatene som er
 * forankret i kontekst-materiell.
 */
import type { SearchResult } from "./pipeline/search";
import {
  CORPUS_PARAGRAPHS,
  CORPUS_CASELAWS,
  CORPUS_STANDARDS,
} from "./citation-index";

export type CitationType = "paragraph" | "caselaw" | "standard";

/** Kilde for verifisering. context = sitat finnes i chunks hentet for
 *  akkurat denne analysen (sterkt signal: AI hadde teksten foran seg).
 *  corpus = sitat finnes ellers i kunnskapsbasen (svakere signal: AI kunne
 *  ha kjent det på generelt grunnlag, men det er minst en reell referanse).
 *  unverified = sitatet finnes ingen steder i korpuset → potensielt
 *  hallusinasjon, må verifiseres manuelt. */
export type VerificationLevel = "context" | "corpus" | "unverified";

export interface ExtractedCitation {
  raw: string;
  type: CitationType;
  normalized: string;
  verification: VerificationLevel;
}

export interface GroundingResult {
  totalCitations: number;
  citations: ExtractedCitation[];
  verifiedFromContext: ExtractedCitation[];
  verifiedFromCorpus: ExtractedCitation[];
  unverified: ExtractedCitation[];
  /** Andel sitater som er forankret enten i context eller korpus (0-1) */
  coverage: number;
}

// ──────────────────────────────────────────────
// Regex
// ──────────────────────────────────────────────

// Paragrafer: § 19-2, §§ 11-9, § 4-2 første ledd, § 6 a, § 11-9 nr. 5
// Vi fanger nummeret + valgfri bokstav-suffix; ledd/punkt/nr.-modifikatorer
// regnes som samme paragraf for grounding-formål.
const PARAGRAPH_REGEX = /§\s*(\d+(?:-\d+)?)\s*([a-z](?=\s|$|[.,;)]))?/gi;

// Norske rettskilder: Høyesterett, Lagmannsrett (LB/LG/LE/LF/LH), Tingrett
// (TOSLO/TBORG/TROMS), Rettstidende. Format: PREFIX-YYYY-NNNN.
const CASELAW_REGEX = /\b(HR|LB|LG|LE|LF|LH|TOSLO|TBORG|TROMS|TSTAV|TKRSA|RG)-\d{4}-\d+\b/g;

// Veiledere/rundskriv/standarder med stabile koder.
// T-1442 (støy), NS 3940 (areal), TEK17, SAK10, h-2487-b (KMD-veileder).
const STANDARD_REGEX =
  /\b(T-\d+(?:\/\d{4})?|NS\s*\d+|TEK\s*\d+|SAK\s*\d+|H-\d+-?[a-z]?)\b/gi;

// ──────────────────────────────────────────────
// Normalisering
// ──────────────────────────────────────────────

function normalizeParagraph(num: string, suffix?: string): string {
  const cleanNum = num.replace(/\s+/g, "");
  return suffix ? `§${cleanNum}${suffix.toLowerCase()}` : `§${cleanNum}`;
}

function normalizeCaselaw(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, "");
}

function normalizeStandard(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, "");
}

// ──────────────────────────────────────────────
// Ekstraksjon
// ──────────────────────────────────────────────

type RawCitation = Omit<ExtractedCitation, "verification">;

export function extractCitations(text: string): RawCitation[] {
  const seen = new Map<string, RawCitation>();

  for (const m of text.matchAll(PARAGRAPH_REGEX)) {
    const norm = normalizeParagraph(m[1], m[2]);
    if (!seen.has(norm)) {
      seen.set(norm, { raw: m[0].trim(), type: "paragraph", normalized: norm });
    }
  }

  for (const m of text.matchAll(CASELAW_REGEX)) {
    const norm = normalizeCaselaw(m[0]);
    if (!seen.has(norm)) {
      seen.set(norm, { raw: m[0], type: "caselaw", normalized: norm });
    }
  }

  for (const m of text.matchAll(STANDARD_REGEX)) {
    const norm = normalizeStandard(m[0]);
    if (!seen.has(norm)) {
      seen.set(norm, { raw: m[0], type: "standard", normalized: norm });
    }
  }

  return Array.from(seen.values());
}

// ──────────────────────────────────────────────
// Korpus-bygging fra hentede chunks
// ──────────────────────────────────────────────

interface CitationCorpus {
  paragraphs: Set<string>;
  caselaws: Set<string>;
  standards: Set<string>;
}

export function buildCitationCorpus(chunks: SearchResult[]): CitationCorpus {
  const paragraphs = new Set<string>();
  const caselaws = new Set<string>();
  const standards = new Set<string>();

  for (const chunk of chunks) {
    const haystack = chunk.content + "\n" + (chunk.title ?? "");

    for (const m of haystack.matchAll(PARAGRAPH_REGEX)) {
      paragraphs.add(normalizeParagraph(m[1], m[2]));
    }
    for (const m of haystack.matchAll(CASELAW_REGEX)) {
      caselaws.add(normalizeCaselaw(m[0]));
    }
    for (const m of haystack.matchAll(STANDARD_REGEX)) {
      standards.add(normalizeStandard(m[0]));
    }

    // Inkluder også prosesserte lov-referanser fra ingest-pipelinen
    const meta = chunk.metadata as { lovReferanser?: string[] } | null;
    for (const ref of meta?.lovReferanser ?? []) {
      for (const m of ref.matchAll(PARAGRAPH_REGEX)) {
        paragraphs.add(normalizeParagraph(m[1], m[2]));
      }
    }

    // Filnavn kan også inneholde dommer/standarder (f.eks. "h-2487-b...pdf",
    // "LB-2019-191203.docx"). Inkluder disse.
    const filename = (chunk.metadata as { filename?: string } | null)?.filename ?? "";
    for (const m of filename.matchAll(CASELAW_REGEX)) {
      caselaws.add(normalizeCaselaw(m[0]));
    }
    for (const m of filename.matchAll(STANDARD_REGEX)) {
      standards.add(normalizeStandard(m[0]));
    }
  }

  return { paragraphs, caselaws, standards };
}

// ──────────────────────────────────────────────
// Verifikasjon
// ──────────────────────────────────────────────

function lookupSet(type: CitationType, source: "context" | "corpus", contextCorpus: CitationCorpus) {
  if (source === "context") {
    return type === "paragraph"
      ? contextCorpus.paragraphs
      : type === "caselaw"
      ? contextCorpus.caselaws
      : contextCorpus.standards;
  }
  return type === "paragraph"
    ? CORPUS_PARAGRAPHS
    : type === "caselaw"
    ? CORPUS_CASELAWS
    : CORPUS_STANDARDS;
}

export function ground(
  text: string,
  chunks: SearchResult[]
): GroundingResult {
  const raws = extractCitations(text);
  const contextCorpus = buildCitationCorpus(chunks);

  const citations: ExtractedCitation[] = raws.map((c) => {
    let level: VerificationLevel;
    if (lookupSet(c.type, "context", contextCorpus).has(c.normalized)) {
      level = "context";
    } else if (lookupSet(c.type, "corpus", contextCorpus).has(c.normalized)) {
      level = "corpus";
    } else {
      level = "unverified";
    }
    return { ...c, verification: level };
  });

  const verifiedFromContext = citations.filter((c) => c.verification === "context");
  const verifiedFromCorpus = citations.filter((c) => c.verification === "corpus");
  const unverified = citations.filter((c) => c.verification === "unverified");

  const grounded = verifiedFromContext.length + verifiedFromCorpus.length;
  return {
    totalCitations: citations.length,
    citations,
    verifiedFromContext,
    verifiedFromCorpus,
    unverified,
    coverage: citations.length === 0 ? 1 : grounded / citations.length,
  };
}
