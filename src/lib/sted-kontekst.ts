import { hentReguleringsplan, type Hensynssone } from "./reguleringsplan";
import { hentKulturminne, type KulturminneTreff } from "./kulturminne";
import {
  hentNaturmangfold,
  type Verneomrade,
  type Naturtype,
} from "./naturmangfold";
import { hentFlomsone, type Flomsone } from "./flomsone";

// Forhåndskategoriserte flagg som er direkte relevante for KU-trigger.
// Hver flag mapper mot en KU-forskrift-trigger (Vedlegg I/II eller § 6/10).
export interface KuRelevantFlag {
  type:
    | "kulturminne"
    | "verneomrade"
    | "naturtype_kuverdi"
    | "flomsone"
    | "hensynssone";
  alvorlighet: "critical" | "high" | "medium";
  beskrivelse: string;
  kilde: string;
  raw: unknown;
}

export interface StedKontekst {
  // Rådata fra hver kilde
  hensynssoner: Hensynssone[];
  kulturminne: KulturminneTreff[];
  verneomrader: Verneomrade[];
  naturtyper: Naturtype[];
  flomsoner: Flomsone[];
  iAktsomhetsomraadeFlom: boolean;

  // Aggregerte flagg klare for KU-trigger og AI-analyse
  flagg: KuRelevantFlag[];
}

function bygFlagg(
  hensynssoner: Hensynssone[],
  kulturminne: KulturminneTreff[],
  verneomrader: Verneomrade[],
  naturtyper: Naturtype[],
  flomsoner: Flomsone[],
  iAktsomhetsomraadeFlom: boolean
): KuRelevantFlag[] {
  const flagg: KuRelevantFlag[] = [];

  // Verneområder — alltid critical (KU-forskrift Vedlegg I)
  for (const v of verneomrader) {
    flagg.push({
      type: "verneomrade",
      alvorlighet: "critical",
      beskrivelse: `${v.verneform ?? "Verneområde"}: ${v.navn ?? "ukjent"}`,
      kilde: "Miljødirektoratet/Naturbase",
      raw: v,
    });
  }

  // Kulturminne — fredete er critical, andre er high
  for (const k of kulturminne) {
    const erFredet =
      typeof k.vernestatus === "string" &&
      k.vernestatus.toLowerCase().includes("fredet");
    flagg.push({
      type: "kulturminne",
      alvorlighet: erFredet ? "critical" : "high",
      beskrivelse: `${k.vernestatus ?? "Kulturminne"}: ${k.navn ?? "ukjent"}${
        k.kategori ? ` (${k.kategori})` : ""
      }`,
      kilde: "Riksantikvaren",
      raw: k,
    });
  }

  // Naturtyper med KU-verdi
  for (const n of naturtyper) {
    const alvorlighet: KuRelevantFlag["alvorlighet"] =
      n.kuVerdi === "svært_stor" || n.kuVerdi === "stor" ? "high" : "medium";
    const verdiTekst = n.kuVerdi
      ? n.kuVerdi.replace("_", " ")
      : "ukjent";
    flagg.push({
      type: "naturtype_kuverdi",
      alvorlighet,
      beskrivelse: `Naturtype med ${verdiTekst} KU-verdi: ${n.navn ?? "ukjent"}`,
      kilde: "Miljødirektoratet/Naturbase",
      raw: n,
    });
  }

  // Flom-aktsomhet — high (Vedlegg II §10 sårbart område)
  if (iAktsomhetsomraadeFlom) {
    flagg.push({
      type: "flomsone",
      alvorlighet: "high",
      beskrivelse: `Tomten ligger i NVE-aktsomhetsområde for flom (${flomsoner.length} sone${flomsoner.length === 1 ? "" : "r"})`,
      kilde: "NVE Atlas",
      raw: flomsoner,
    });
  }

  // Hensynssoner — medium med mindre navnet indikerer noe spesifikt
  for (const h of hensynssoner) {
    if (!h.hensynSonenavn) continue;
    flagg.push({
      type: "hensynssone",
      alvorlighet: "medium",
      beskrivelse: `Hensynssone: ${h.hensynSonenavn}`,
      kilde: "DiBK reguleringsplan",
      raw: h,
    });
  }

  return flagg;
}

export async function hentStedKontekst(
  lat: number,
  lon: number
): Promise<StedKontekst> {
  const [regplan, kult, natur, flom] = await Promise.all([
    hentReguleringsplan(lat, lon).catch(() => ({
      planomrader: [],
      arealformaal: [],
      hensynssoner: [],
    })),
    hentKulturminne(lat, lon).catch(() => ({ treff: [] })),
    hentNaturmangfold(lat, lon).catch(() => ({
      verneomrader: [],
      naturtyper: [],
    })),
    hentFlomsone(lat, lon).catch(() => ({
      flomsoner: [],
      iAktsomhetsomraade: false,
    })),
  ]);

  const flagg = bygFlagg(
    regplan.hensynssoner,
    kult.treff,
    natur.verneomrader,
    natur.naturtyper,
    flom.flomsoner,
    flom.iAktsomhetsomraade
  );

  return {
    hensynssoner: regplan.hensynssoner,
    kulturminne: kult.treff,
    verneomrader: natur.verneomrader,
    naturtyper: natur.naturtyper,
    flomsoner: flom.flomsoner,
    iAktsomhetsomraadeFlom: flom.iAktsomhetsomraade,
    flagg,
  };
}

// Bygg en kompakt tekst-representasjon av sted-kontekst egnet for AI-prompts.
// Inkluderer kun forhold som er relevante for KU-vurdering — ingen tom struktur.
export function formatStedKontekstForPrompt(k: StedKontekst): string {
  if (k.flagg.length === 0) {
    return "## Sted-kontekst\n\nIngen kulturminne, verneområder, naturtyper med KU-verdi, flomaktsomhet eller hensynssoner identifisert i nærheten av tomten.";
  }

  const grupper = {
    critical: k.flagg.filter((f) => f.alvorlighet === "critical"),
    high: k.flagg.filter((f) => f.alvorlighet === "high"),
    medium: k.flagg.filter((f) => f.alvorlighet === "medium"),
  };

  const linjer: string[] = ["## Sted-kontekst (fra offentlige WMS-kilder)"];

  if (grupper.critical.length > 0) {
    linjer.push("\n### Kritisk:");
    grupper.critical.forEach((f) =>
      linjer.push(`- ${f.beskrivelse} *(${f.kilde})*`)
    );
  }
  if (grupper.high.length > 0) {
    linjer.push("\n### Høy:");
    grupper.high.forEach((f) =>
      linjer.push(`- ${f.beskrivelse} *(${f.kilde})*`)
    );
  }
  if (grupper.medium.length > 0) {
    linjer.push("\n### Moderat:");
    grupper.medium.forEach((f) =>
      linjer.push(`- ${f.beskrivelse} *(${f.kilde})*`)
    );
  }

  return linjer.join("\n");
}
