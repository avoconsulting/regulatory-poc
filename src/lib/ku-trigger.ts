import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import type { Tiltak } from "./analyse";
import type { StedKontekst } from "./sted-kontekst";
import { formatStedKontekstForPrompt } from "./sted-kontekst";
import {
  searchDocuments,
  byggKunnskapsbaseKontekst,
} from "./pipeline/search";

// ──────────────────────────────────────────────
// Typer
// ──────────────────────────────────────────────

export type KuOutcome = "always_ku" | "must_assess" | "no_trigger";

export interface KuTrigger {
  category:
    | "formålsendring"
    | "størrelse"
    | "sårbart_område"
    | "berørte_interesser"
    | "annet";
  description: string;
  sourceRef: string;
  severity: "critical" | "high" | "medium";
}

export interface KuAssessment {
  outcome: KuOutcome;
  triggers: KuTrigger[];
  confidence: "high" | "medium" | "low";
  rationale: string;
  // Audit-info: hvilke kilder som ble brukt i vurderingen
  contextSnapshot: {
    relevantKilder: string[]; // filnavn fra RAG
    antallStedFlagg: number;
  };
}

export interface KuTriggerInput {
  tiltak: Tiltak;
  tidligereFormaal?: string; // valgfri — kan utledes fra plandata senere
  adresse: string;
  kommunenavn: string;
}

// ──────────────────────────────────────────────
// System-prompt
// ──────────────────────────────────────────────

const SYSTEM_PROMPT = `Du er ekspert på norsk plan- og bygningsrett, særlig konsekvensutredning (KU) etter PBL kapittel 4 og forskrift om konsekvensutredninger (KU-forskriften).

Din oppgave er å avgjøre om et planlagt byggetiltak utløser krav om konsekvensutredning, basert på:
1. KU-forskriften (Vedlegg I = alltid KU; Vedlegg II = må vurderes nærmere)
2. PBL § 4-2 (planforslag som kan ha vesentlige virkninger)
3. Sted-kontekst (verneområder, kulturminne, flomaktsomhet, hensynssoner)

## Konklusjon

Returner én av tre konklusjoner i feltet "outcome":
- **always_ku**: tiltaket faller inn under KU-forskriften Vedlegg I → KU er obligatorisk
- **must_assess**: tiltaket faller inn under Vedlegg II eller har sted-kontekst som krever nærmere vurdering
- **no_trigger**: ingen utløsere identifisert

## Trigger-typer

For hver utløser du identifiserer, oppgi:
- **category**: formålsendring | størrelse | sårbart_område | berørte_interesser | annet
- **description**: kort, konkret beskrivelse av hvorfor dette utløser KU-vurdering
- **sourceRef**: kildereferanse (f.eks. "KU-forskriften § 6 a", "Vedlegg I punkt 24", "PBL § 4-2")
- **severity**: critical (Vedlegg I, eller fredet kulturminne/verneområde) | high (Vedlegg II) | medium (indikator, ikke direkte trigger)

## Regler

- Bruk KUN det som finnes i konteksten — ikke dikt opp paragrafer
- Vær konservativ: ved tvil, foreslå must_assess i stedet for no_trigger
- Sted-kontekst-flagg merket "Kritisk" (verneområde, fredet kulturminne) skal alltid løfte konklusjonen til minst must_assess
- Konfidensnivå:
  - **high**: tydelig match mot Vedlegg I/II, eller flere uavhengige indikatorer
  - **medium**: én klar indikator
  - **low**: usikker eller manglende data

## Svarformat (KUN JSON)

{
  "outcome": "always_ku|must_assess|no_trigger",
  "triggers": [
    {
      "category": "formålsendring|størrelse|sårbart_område|berørte_interesser|annet",
      "description": "Konkret beskrivelse",
      "sourceRef": "KU-forskrift § X eller Vedlegg I/II punkt Y",
      "severity": "critical|high|medium"
    }
  ],
  "confidence": "high|medium|low",
  "rationale": "2-3 setninger som forklarer konklusjonen i naturlig norsk"
}

Svar KUN med JSON. Ingen tekst før eller etter.`;

// ──────────────────────────────────────────────
// Hovedfunksjon
// ──────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
});

export async function assessKuTrigger(
  input: KuTriggerInput,
  stedKontekst: StedKontekst
): Promise<KuAssessment> {
  // Hent relevante KU-paragrafer via RAG. Vi prioriterer lov_og_forskrift
  // (forskriften selv) framfor forarbeider, siden vi vil ha den faktiske
  // ordlyden, ikke tolkningsbidrag.
  const searchQuery = `konsekvensutredning vedlegg krav trigger ${
    input.tiltak.bruksformål ?? ""
  } ${input.tiltak.beskrivelse}`;

  const ragResults = await searchDocuments(searchQuery, {
    matchCount: 8,
    matchThreshold: 0.3,
    category: "lov_og_forskrift",
  }).catch(() => []);

  const ragContext =
    ragResults.length > 0
      ? byggKunnskapsbaseKontekst(ragResults)
      : "*Ingen treff i kunnskapsbasen — vurder basert på generell kunnskap om KU-forskriften.*";

  const tiltakLinjer = [
    `- Adresse: ${input.adresse}`,
    `- Kommune: ${input.kommunenavn}`,
    `- Beskrivelse: ${input.tiltak.beskrivelse}`,
    input.tiltak.byggehøyde != null
      ? `- Byggehøyde: ${input.tiltak.byggehøyde}m`
      : null,
    input.tiltak.utnyttelsesgrad != null
      ? `- Utnyttelsesgrad: ${input.tiltak.utnyttelsesgrad}%`
      : null,
    input.tiltak.bruksformål
      ? `- Nytt bruksformål: ${input.tiltak.bruksformål}`
      : null,
    input.tidligereFormaal
      ? `- Tidligere formål: ${input.tidligereFormaal}`
      : null,
    input.tiltak.antallEnheter != null
      ? `- Antall enheter: ${input.tiltak.antallEnheter}`
      : null,
    input.tiltak.annet ? `- Annet: ${input.tiltak.annet}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = `# KU-trigger-vurdering

## Tiltak
${tiltakLinjer}

${formatStedKontekstForPrompt(stedKontekst)}

${ragContext}

Vurder om tiltaket utløser krav om konsekvensutredning.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Omit<KuAssessment, "contextSnapshot">;

  return {
    ...parsed,
    contextSnapshot: {
      relevantKilder: ragResults
        .map((r) => {
          const meta = r.metadata as Record<string, unknown> | null;
          return (meta?.filename as string) ?? r.title;
        })
        .filter(Boolean),
      antallStedFlagg: stedKontekst.flagg.length,
    },
  };
}

// ──────────────────────────────────────────────
// Persistens
// ──────────────────────────────────────────────

export interface SaveKuArgs {
  input: KuTriggerInput;
  stedKontekst: StedKontekst;
  assessment: KuAssessment;
  projectId?: string;
  kommunenummer?: string;
  gnr?: number;
  bnr?: number;
}

export async function saveKuAssessment(
  args: SaveKuArgs
): Promise<{ id: string }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("ku_assessments")
    .insert({
      project_id: args.projectId,
      adresse: args.input.adresse,
      kommunenavn: args.input.kommunenavn,
      kommunenummer: args.kommunenummer,
      gnr: args.gnr,
      bnr: args.bnr,
      tiltak: args.input.tiltak,
      outcome: args.assessment.outcome,
      confidence: args.assessment.confidence,
      rationale: args.assessment.rationale,
      triggers: args.assessment.triggers,
      sted_kontekst: {
        verneomrader: args.stedKontekst.verneomrader,
        kulturminne: args.stedKontekst.kulturminne,
        flomsoner: args.stedKontekst.flomsoner,
        naturtyper: args.stedKontekst.naturtyper,
        hensynssoner: args.stedKontekst.hensynssoner,
        flagg: args.stedKontekst.flagg,
      },
      context_snapshot: args.assessment.contextSnapshot,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Lagring av KU-vurdering feilet: ${error.message}`);
  }
  return { id: data.id };
}
