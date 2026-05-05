import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import {
  plantypeTekst,
  planstatusTekst,
  arealformaalTekst,
  type Planomrade,
  type Arealformaal,
  type Hensynssone,
} from "./reguleringsplan";
import type { PlanbestemmelserResultat } from "./planbestemmelser";
import type { EInnsynSokResultat } from "./einnsyn";
import type { KuAssessment } from "./ku-trigger";
import {
  searchDocuments,
  byggKunnskapsbaseKontekst,
  type SearchResult,
} from "./pipeline/search";
import { ground, type GroundingResult } from "./grounding";
import { loadRiskLibrary, formatRiskLibraryForPrompt } from "./risk-library";

// ──────────────────────────────────────────────
// Typer – brukerinput
// ──────────────────────────────────────────────

export interface Tiltak {
  beskrivelse: string;
  byggehøyde?: number;
  utnyttelsesgrad?: number;
  bruksformål?: string;
  antallEnheter?: number;
  parkering?: string;
  annet?: string;
}

export interface AnalyseInput {
  adresse: string;
  kommunenavn: string;
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  tiltak: Tiltak;
  plandata: PlanbestemmelserResultat;
  dispensasjonshistorikk?: EInnsynSokResultat;
  kuVurdering?: KuAssessment | null;
}

// ──────────────────────────────────────────────
// Typer – analyseresultat
// ──────────────────────────────────────────────

export interface RedFlag {
  tittel: string;
  beskrivelse: string;
  alvorlighet: "hard_stop" | "dispenserbar" | "akseptabel_risiko";
  hjemmel: string;
  anbefaling: string;
  /** Hvis red flag-et matcher et entry i kundens kuraterte 15-flagg-bibliotek,
   *  refererer dette feltet til den entry-en. AI skal foretrekke å matche
   *  fremfor å finne opp nye flagg. null hvis tiltaket avdekker noe utenfor
   *  biblioteket. */
  bibliotekRef?: {
    rang: number;
    navn: string;
  } | null;
  /** Overordnet risikokategori — én av kundens 12 kuraterte kategorier (se
   *  risk_categories-tabellen). Brukes i UI for gruppering og taksonomi.
   *  AI skal velge eksakt navn fra listen i prompten. */
  risikokategori?: string;
}

export interface Strategi {
  navn: string;
  beskrivelse: string;
  risikoprofil: "lav" | "moderat" | "høy";
  redFlags: string[];
  forventetUtfall: string;
  anbefalteJusteringer: string[];
}

export interface Oppside {
  tittel: string;
  beskrivelse: string;
  hjemmel: string;
  potensial: string;
}

export interface RisikoAnalyse {
  oppsummering: string;
  samletRisikovurdering: "lav" | "moderat" | "høy" | "kritisk";
  redFlags: RedFlag[];
  strategier: Strategi[];
  oppsider: Oppside[];
  anbefalinger: string[];
  referanser: string[];
  kuVurdering?: KuAssessment | null;
  /** Citation grounding: hvilke kilde-referanser AI-en ga som faktisk er
   *  forankret i de hentede kunnskapsbase-chunkene. Brukes for å markere
   *  uverifiserte sitater i UI så sluttbruker kan sjekke dem manuelt. */
  grounding?: GroundingResult;
}

// ──────────────────────────────────────────────
// Hjelpefunksjon – bygg kontekst fra plandata
// ──────────────────────────────────────────────

function byggPlandataKontekst(plandata: PlanbestemmelserResultat): string {
  const deler: string[] = [];

  // WMS-data (arealformål, hensynssoner)
  if (plandata.wmsPlanomrader.length > 0) {
    deler.push("## Reguleringsplandata fra DiBK\n");
    for (const p of plandata.wmsPlanomrader) {
      deler.push(
        `### ${p.plannavn}`,
        `- Plantype: ${plantypeTekst(p.plantype)}`,
        `- Status: ${planstatusTekst(p.planstatus)}`,
        `- Plan-ID: ${p["arealplanId.planidentifikasjon"]}`,
        p.ikrafttredelsesdato
          ? `- Ikrafttredelse: ${p.ikrafttredelsesdato.slice(0, 10)}`
          : "",
        ""
      );
    }
  }

  // Planregister-planer
  if (plandata.planregisterPlaner.length > 0) {
    deler.push("## Planer som berører eiendommen\n");
    for (const p of plandata.planregisterPlaner) {
      deler.push(
        `- ${p.plannavn} (${p.plantype}, ${p.planstatus}) — Plan-ID: ${p.planidentifikasjon}`
      );
    }
    deler.push("");
  }

  // Bestemmelser fra arealplaner.no
  if (plandata.planMedBestemmelser.length > 0) {
    deler.push("## Planbestemmelser og dokumenter\n");
    for (const pmb of plandata.planMedBestemmelser) {
      deler.push(`### ${pmb.plan.planNavn} (${pmb.plan.planType})`);
      if (pmb.plan.iKraft) {
        deler.push(`Ikrafttredelse: ${pmb.plan.iKraft.slice(0, 10)}`);
      }

      if (pmb.bestemmelser.length > 0) {
        deler.push(`\nBestemmelser:`);
        for (const b of pmb.bestemmelser) {
          deler.push(`- ${b.dokumentnavn} (${b.dokumenttype})`);
        }
      }

      if (pmb.dispensasjoner.length > 0) {
        deler.push(`\nDispensasjoner innvilget under denne planen:`);
        for (const d of pmb.dispensasjoner) {
          deler.push(
            `- ${d.dispensasjonstype ?? "Dispensasjon"}: ${d.beskrivelse ?? "Ingen beskrivelse"}${d.vedtaksdato ? ` (vedtak ${d.vedtaksdato.slice(0, 10)})` : ""}`
          );
        }
      }

      deler.push("");
    }
  }

  // Planslurpen AI-status
  if (plandata.planslurpStatuser.length > 0) {
    deler.push("## AI-tolkning av bestemmelser (Planslurpen)\n");
    for (const s of plandata.planslurpStatuser) {
      deler.push(
        `- Plan ${s.planId}: ${s.status.navn} (AI v${s.aiVersjon})`
      );
    }
    deler.push("");
  }

  // Naboplaner — kan binde via rekkefølgekrav, hensynssoner, felles utomhus
  if (plandata.naboplaner.length > 0) {
    deler.push(
      "## Naboplaner (~100m radius)",
      "",
      "Detaljregulering på naboeiendom kan binde tiltaket via rekkefølgekrav, hensynssoner som overlapper, eller felles utomhusplan/infrastruktur. Vurder spesielt om tiltaket utløser krav fra disse planene som ikke fremgår av egen plan:",
      ""
    );
    for (const p of plandata.naboplaner) {
      deler.push(
        `- ${p.plannavn} (${plantypeTekst(p.plantype)}, ${planstatusTekst(p.planstatus)}) — Plan-ID: ${p["arealplanId.planidentifikasjon"]}`
      );
    }
    deler.push("");
  }

  // Planer ikke funnet i arealplaner.no
  if (plandata.ikkeIArealplaner.length > 0) {
    deler.push("## Planer uten tilgjengelige bestemmelser\n");
    for (const p of plandata.ikkeIArealplaner) {
      deler.push(
        `- ${p.plannavn} (${p.planidentifikasjon}) — bestemmelsesdokumenter ikke tilgjengelig digitalt`
      );
    }
    deler.push("");
  }

  return deler.filter(Boolean).join("\n");
}

function byggDispensasjonsKontekst(
  resultat: EInnsynSokResultat | undefined
): string {
  if (!resultat || resultat.items.length === 0) return "";

  const deler = ["## Dispensasjonshistorikk fra eInnsyn\n"];
  for (const item of resultat.items) {
    if (item.entity === "Journalpost") {
      deler.push(
        `- [Journalpost] ${item.offentligTittel} (${item.journaldato ?? "ukjent dato"})`
      );
    } else {
      deler.push(
        `- [Saksmappe] ${item.offentligTittel}`
      );
    }
  }
  return deler.join("\n");
}

function byggKuKontekst(ku: KuAssessment | null | undefined): string {
  if (!ku) return "";

  const outcomeTekst = {
    always_ku: "**KU er obligatorisk** (KU-forskriften Vedlegg I)",
    must_assess: "**KU må vurderes nærmere** (KU-forskriften Vedlegg II eller sted-kontekst)",
    no_trigger: "Ingen KU-trigger identifisert",
  }[ku.outcome];

  const deler = [
    "## KU-trigger-vurdering (forhåndsanalyse)",
    `Konklusjon: ${outcomeTekst} (konfidens: ${ku.confidence})`,
    `Rasjonal: ${ku.rationale}`,
  ];

  if (ku.triggers.length > 0) {
    deler.push("\nIdentifiserte triggere:");
    for (const t of ku.triggers) {
      deler.push(
        `- [${t.severity}] ${t.description} *(${t.sourceRef})*`
      );
    }
  }

  deler.push(
    "\n*Bruk denne forhåndsvurderingen som utgangspunkt — ikke gjenta den, men bygg videre i red flags og strategier hvor relevant.*"
  );

  return deler.join("\n");
}

// ──────────────────────────────────────────────
// System-prompt
// ──────────────────────────────────────────────

const SYSTEM_PROMPT = `Du er en ekspert på norsk plan- og bygningsrett med dyp kunnskap om reguleringsplaner, plan- og bygningsloven (PBL), dispensasjonspraksis og kommunal saksbehandling.

Din oppgave er å analysere reguleringsrisiko for et foreslått byggetiltak basert på tilgjengelig plandata, bestemmelser og dispensasjonshistorikk.

## Oppgaven

Gitt en eiendom, gjeldende planer og et ønsket tiltak:

1. **Identifiser red flags** (maks 6, prioriter de viktigste) — konflikter mellom tiltaket og gjeldende bestemmelser. Kategoriser hver som:
   - \`hard_stop\`: Direkte i strid med lov eller plan uten realistisk dispensasjonsmulighet
   - \`dispenserbar\`: Krever dispensasjon, men det finnes presedens eller grunnlag for at det kan innvilges
   - \`akseptabel_risiko\`: Mindre avvik som normalt aksepteres i praksis

   **Match mot biblioteket først.** Du får et bibliotek på 15 ferdig-kategoriserte red flags fra kundens fagvurdering. For hvert red flag du identifiserer:
   - Hvis flagget *passer* (helt eller delvis) til ett av bibliotekets 15 entry-er, sett \`bibliotekRef: { rang: N, navn: "exact navn fra biblioteket" }\`. Beskriv tiltaks-spesifikke detaljer i \`beskrivelse\`, men la matchen være eksplisitt.
   - Hvis ingen bibliotek-flagg passer, sett \`bibliotekRef: null\` — du kan fritt foreslå et nytt flagg, men kun når biblioteket ikke dekker det.
   - Foretrekk å matche fremfor å splitte. Et bredt bibliotek-flagg er mer verdt for kunden enn flere overlappende egendefinerte.

   **Sett alltid \`risikokategori\`** til eksakt navn fra én av de 12 overordnede risikokategoriene som er listet senere i prompten. Brukes til gruppering i UI. Velg den som passer best — ikke finn opp nye kategorier.

2. **Foreslå 2–3 strategier** med ulik risikoprofil. Hver strategi skal inneholde konkrete justeringer av tiltaket.

3. **Identifiser oppsider** (maks 4) — muligheter i planen eller overordnede planer som tiltakshaver kan utnytte.

4. **Gi en samlet risikovurdering** (lav/moderat/høy/kritisk).

5. **Anbefalinger** — maks 6 punkter, prioritert rekkefølge.

## Regler

- Referer alltid til konkrete bestemmelser, paragrafer eller planer.
- Vær spesifikk om byggehøyder, utnyttingsgrad og andre målbare parametre.
- Bruk norske fagtermer.
- Ikke dikter opp lovparagrafer — referer kun til det som finnes i konteksten.
- Hvis data mangler, si eksplisitt hva som mangler og hvordan det påvirker analysen.
- Vær ærlig om usikkerhet.

## Stil — viktig

Vær konsis. Hvert "beskrivelse"-felt: 2–4 setninger, ikke avsnitt. "anbefaling", "forventetUtfall" og "potensial": 1–2 setninger. "anbefalteJusteringer": 3–5 korte stikkord per strategi, ikke fullstendige avsnitt. Ikke gjenta informasjon mellom red flags og strategier. Ikke skriv "selv om data mangler"-disclaimere flere ganger — én gang holder.

## Svarformat

Svar i JSON med følgende struktur:

{
  "oppsummering": "Kort oppsummering av risikobildet (2-3 setninger)",
  "samletRisikovurdering": "lav|moderat|høy|kritisk",
  "redFlags": [
    {
      "tittel": "Kort tittel",
      "beskrivelse": "Detaljert forklaring av konflikten",
      "alvorlighet": "hard_stop|dispenserbar|akseptabel_risiko",
      "hjemmel": "Referanse til bestemmelse, paragraf eller plan",
      "anbefaling": "Hva tiltakshaver bør gjøre",
      "bibliotekRef": { "rang": 5, "navn": "Kostbare rekkefølgebestemmelser" },
      "risikokategori": "Rekkefølge- og gjennomføringsrisiko"
    }
  ],
  "strategier": [
    {
      "navn": "Strateginavn",
      "beskrivelse": "Beskrivelse av tilnærmingen",
      "risikoprofil": "lav|moderat|høy",
      "redFlags": ["Titler på red flags som gjelder denne strategien"],
      "forventetUtfall": "Vurdering av sannsynlig utfall",
      "anbefalteJusteringer": ["Konkrete endringer i tiltaket"]
    }
  ],
  "oppsider": [
    {
      "tittel": "Kort tittel",
      "beskrivelse": "Beskrivelse av muligheten",
      "hjemmel": "Referanse til plan eller bestemmelse",
      "potensial": "Hva dette kan gi tiltakshaver"
    }
  ],
  "anbefalinger": ["Overordnede anbefalinger for veien videre"],
  "referanser": ["Liste over planer og dokumenter brukt i analysen"]
}

Svar KUN med JSON. Ingen tekst før eller etter.`;

// ──────────────────────────────────────────────
// Hovedfunksjon
// ──────────────────────────────────────────────

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
});

export async function analyserReguleringsrisiko(
  input: AnalyseInput
): Promise<RisikoAnalyse> {
  const tiltakTekst = [
    `Beskrivelse: ${input.tiltak.beskrivelse}`,
    input.tiltak.byggehøyde != null
      ? `Ønsket byggehøyde: ${input.tiltak.byggehøyde}m`
      : null,
    input.tiltak.utnyttelsesgrad != null
      ? `Ønsket utnyttelsesgrad: ${input.tiltak.utnyttelsesgrad}%`
      : null,
    input.tiltak.bruksformål
      ? `Bruksformål: ${input.tiltak.bruksformål}`
      : null,
    input.tiltak.antallEnheter != null
      ? `Antall enheter: ${input.tiltak.antallEnheter}`
      : null,
    input.tiltak.parkering
      ? `Parkering: ${input.tiltak.parkering}`
      : null,
    input.tiltak.annet ? `Annet: ${input.tiltak.annet}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Detekter om vi mangler konkrete plan-data (typisk for Oslo, eller andre
  // kommuner som ikke aggregerer til de nasjonale plan-tjenestene).
  const erTomtForPlandata =
    input.plandata.wmsPlanomrader.length === 0 &&
    input.plandata.planregisterPlaner.length === 0 &&
    input.plandata.planMedBestemmelser.length === 0;

  // Søk i kunnskapsbasen — hent flere chunks når plandata mangler, siden
  // kunnskapsbasen blir hovedkilden for plan-relevant kontekst i de tilfellene.
  // searchResults beholdes til grounding-steget etter AI-svaret.
  let kunnskapsbaseKontekst = "";
  let searchResults: SearchResult[] = [];
  try {
    const searchQuery = erTomtForPlandata
      ? `${input.kommunenavn} reguleringsplan kommuneplan ${input.tiltak.beskrivelse} ${input.tiltak.bruksformål ?? ""}`
      : `${input.tiltak.beskrivelse} ${input.tiltak.bruksformål ?? ""} reguleringsplan bestemmelser`;
    searchResults = await searchDocuments(searchQuery, {
      matchCount: erTomtForPlandata ? 12 : 6,
      matchThreshold: 0.3,
    });
    kunnskapsbaseKontekst = byggKunnskapsbaseKontekst(searchResults);
  } catch {
    // Kunnskapsbasen er ikke konfigurert ennå — analyser uten
  }

  // Last kundens kuraterte risikobibliotek. Hvis det av en eller annen grunn
  // ikke kan lastes (DB nede), kjør analysen uten biblioteket — bedre å levere
  // freelancing-output enn ingen output.
  let bibliotekKontekst = "";
  try {
    const lib = await loadRiskLibrary();
    bibliotekKontekst = formatRiskLibraryForPrompt(lib);
  } catch (err) {
    console.error("[analyse] Kunne ikke laste risikobibliotek:", err);
  }

  // Eksplisitt advarsel til AI når plan-data mangler. Forhindrer at AI bare
  // svarer "Kritisk - manglende data" uten å gi nyttig veiledning.
  const plandataAdvarsel = erTomtForPlandata
    ? `\n## VIKTIG: Manglende konkrete plandata\n\nDe nasjonale plan-tjenestene (DiBK NAP, Planslurpen, arealplaner.no) har ikke data for ${input.kommunenavn} (typisk for Oslo som har eget plansystem hos PBE). Analysen må derfor bygges på generell norsk plan- og bygningsrett, kunnskapsbasen, og brukerens beskrivelse av tiltaket.\n\nGi likevel en *brukbar* analyse: identifiser typiske risikoer for tiltakstypen i ${input.kommunenavn}, henvis til konkrete PBL-paragrafer der det er relevant, og foreslå hva utbygger bør sjekke selv (kommunens eget planinnsynssystem, kommunale veiledere, evt. forhåndsdialog med plan- og bygningsetaten). Ikke gi opp med "kritisk – manglende data". Vær eksplisitt om hvilke spørsmål som krever direkte plan-oppslag for å besvares.\n`
    : "";

  const userPrompt = `# Reguleringsrisikoanalyse

## Eiendom
- Adresse: ${input.adresse}
- Kommune: ${input.kommunenavn} (${input.kommunenummer})
- Gnr/Bnr: ${input.gardsnummer}/${input.bruksnummer}

## Ønsket tiltak
${tiltakTekst}

${bibliotekKontekst}

${byggKuKontekst(input.kuVurdering)}
${plandataAdvarsel}
## Tilgjengelig plandata

${byggPlandataKontekst(input.plandata)}

${byggDispensasjonsKontekst(input.dispensasjonshistorikk)}

${kunnskapsbaseKontekst}

Analyser reguleringsrisikoen for dette tiltaket. Husk: match mot bibliotek-flaggene først, foreslå nye kun der biblioteket ikke dekker.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Logg token-bruk — gir oss innsyn for fremtidig optimalisering. Prompt-
  // caching er foreløpig ikke verdt det fordi systemprompten er ~1155 tokens,
  // under Sonnet 4.6 sin 2048-token cacheterskel. Krever redesign (f.eks. å
  // legge stabilt referansemateriale i system-blokken) før caching slår inn.
  const u = response.usage;
  console.log(
    `[analyse] tokens: input=${u.input_tokens} output=${u.output_tokens}`
  );

  // Avkortet output ⇒ JSON er garantert ufullstendig. Kast en tydelig feil
  // i stedet for å la JSON.parse krasje på "Unterminated string".
  if (response.stop_reason === "max_tokens") {
    throw new Error(
      `AI-analysen ble avkortet (genererte ${response.usage.output_tokens} av ${16384} tilgjengelige tokens). Tiltaket eller konteksten gir for mye output. Forsøk å forenkle beskrivelsen, eller meld fra til utvikler så vi øker grensen.`
    );
  }

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Strip markdown code fences om de finnes (```json ... ``` eller ``` ... ```)
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: RisikoAnalyse;
  try {
    parsed = JSON.parse(cleaned) as RisikoAnalyse;
  } catch (err) {
    // Logg råteksten så vi kan diagnostisere — Vercel/Next-loggene fanger dette.
    console.error(
      `[analyse] JSON-parse feilet (stop_reason=${response.stop_reason}, output_tokens=${response.usage.output_tokens}):`,
      cleaned.slice(0, 500),
      "...",
      cleaned.slice(-500)
    );
    throw new Error(
      `Kunne ikke tolke AI-svaret som JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Citation grounding: ekstraher alle siterte paragrafer/dommer/standarder
  // og kryssjekk mot de hentede kunnskapsbase-chunkene.
  const allText = [
    parsed.oppsummering,
    ...parsed.redFlags.flatMap((rf) => [
      rf.tittel,
      rf.beskrivelse,
      rf.hjemmel,
      rf.anbefaling,
    ]),
    ...parsed.strategier.flatMap((s) => [
      s.beskrivelse,
      s.forventetUtfall,
      ...s.anbefalteJusteringer,
    ]),
    ...parsed.oppsider.flatMap((o) => [o.beskrivelse, o.hjemmel, o.potensial]),
    ...parsed.anbefalinger,
    ...parsed.referanser,
  ].join("\n");

  const grounding = ground(allText, searchResults);

  return { ...parsed, grounding };
}

// ──────────────────────────────────────────────
// Persistens
// ──────────────────────────────────────────────

export interface SaveAnalysisArgs {
  adresse: string;
  kommunenavn: string;
  kommunenummer: string;
  gnr: number;
  bnr: number;
  tiltak: Tiltak;
  result: RisikoAnalyse;
  projectId?: string;
  kuAssessmentId?: string;
}

/**
 * Lagrer en komplett RisikoAnalyse til analyses-tabellen.
 *
 * Beste-innsats: hvis migrasjon 008 ikke er kjørt (tabellen finnes ikke),
 * logger vi og returnerer null. Bedre å levere analyse til bruker uten
 * persistens enn å feile hele requesten.
 */
export async function saveAnalysis(
  args: SaveAnalysisArgs
): Promise<{ id: string } | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const hardStops = args.result.redFlags.filter(
    (rf) => rf.alvorlighet === "hard_stop"
  ).length;

  const { data, error } = await supabase
    .from("analyses")
    .insert({
      project_id: args.projectId,
      adresse: args.adresse,
      kommunenavn: args.kommunenavn,
      kommunenummer: args.kommunenummer,
      gnr: args.gnr,
      bnr: args.bnr,
      tiltak: args.tiltak,
      result: args.result,
      ku_assessment_id: args.kuAssessmentId,
      samlet_risiko: args.result.samletRisikovurdering,
      red_flag_count: args.result.redFlags.length,
      hard_stop_count: hardStops,
      grounding_coverage: args.result.grounding?.coverage ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // Tabellen mangler eller annen feil — log og kjør videre
    console.error(`[analyse] saveAnalysis feilet: ${error.message}`);
    return null;
  }

  return { id: data.id };
}
