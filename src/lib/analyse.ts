import Anthropic from "@anthropic-ai/sdk";
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
} from "./pipeline/search";

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

1. **Identifiser red flags** — konflikter mellom tiltaket og gjeldende bestemmelser. Kategoriser hver som:
   - \`hard_stop\`: Direkte i strid med lov eller plan uten realistisk dispensasjonsmulighet
   - \`dispenserbar\`: Krever dispensasjon, men det finnes presedens eller grunnlag for at det kan innvilges
   - \`akseptabel_risiko\`: Mindre avvik som normalt aksepteres i praksis

2. **Foreslå 2–3 strategier** med ulik risikoprofil. Hver strategi skal inneholde konkrete justeringer av tiltaket.

3. **Identifiser oppsider** — muligheter i planen eller overordnede planer som tiltakshaver kan utnytte.

4. **Gi en samlet risikovurdering** (lav/moderat/høy/kritisk).

## Regler

- Referer alltid til konkrete bestemmelser, paragrafer eller planer.
- Vær spesifikk om byggehøyder, utnyttingsgrad og andre målbare parametre.
- Bruk norske fagtermer.
- Ikke dikter opp lovparagrafer — referer kun til det som finnes i konteksten.
- Hvis data mangler, si eksplisitt hva som mangler og hvordan det påvirker analysen.
- Vær ærlig om usikkerhet.

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
      "anbefaling": "Hva tiltakshaver bør gjøre"
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
  let kunnskapsbaseKontekst = "";
  try {
    const searchQuery = erTomtForPlandata
      ? `${input.kommunenavn} reguleringsplan kommuneplan ${input.tiltak.beskrivelse} ${input.tiltak.bruksformål ?? ""}`
      : `${input.tiltak.beskrivelse} ${input.tiltak.bruksformål ?? ""} reguleringsplan bestemmelser`;
    const searchResults = await searchDocuments(searchQuery, {
      matchCount: erTomtForPlandata ? 12 : 6,
      matchThreshold: 0.3,
    });
    kunnskapsbaseKontekst = byggKunnskapsbaseKontekst(searchResults);
  } catch {
    // Kunnskapsbasen er ikke konfigurert ennå — analyser uten
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

${byggKuKontekst(input.kuVurdering)}
${plandataAdvarsel}
## Tilgjengelig plandata

${byggPlandataKontekst(input.plandata)}

${byggDispensasjonsKontekst(input.dispensasjonshistorikk)}

${kunnskapsbaseKontekst}

Analyser reguleringsrisikoen for dette tiltaket.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Strip markdown code fences om de finnes (```json ... ``` eller ``` ... ```)
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned) as RisikoAnalyse;
}
