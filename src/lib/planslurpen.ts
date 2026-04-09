const PLANSLURPEN_BASE = "https://planslurpen.no/api";

// ──────────────────────────────────────────────
// Typer – Planregister (åpen, ingen nøkkel)
// ──────────────────────────────────────────────

export interface PlanregistreringRef {
  nasjonalArealplanId: {
    administrativEnhet: { kommunenummer: string };
    planidentifikasjon: string;
  };
  plannavn: string;
  plantype: { kodeverdi: string; kodebeskrivelse: string };
  planstatus: { kodeverdi: string; kodebeskrivelse: string };
}

export interface PlanregisterResultat {
  matrikkelnummer: {
    kommunenummer: string;
    gardsnummer: string;
    bruksnummer: string;
  };
  plan: PlanregistreringRef[];
}

// ──────────────────────────────────────────────
// Typer – Planslurp (åpen, ingen nøkkel)
// ──────────────────────────────────────────────

export interface PlanslurpStatus {
  id: string;
  kommune: { kommunenummer: string; navn: string };
  planId: string;
  ikrafttredelsesdato: string | null;
  versjon: number;
  status: { navn: string; beskrivelse: string };
  startet: string;
  avsluttet: string | null;
  tidsbruk: number;
  aiVersjon: string;
}

// ──────────────────────────────────────────────
// Hjelpefunksjoner
// ──────────────────────────────────────────────

async function planslurpenFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${PLANSLURPEN_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Planslurpen API-feil: ${res.status} ${res.statusText} (${path})`
    );
  }

  return res.json() as Promise<T>;
}

// ──────────────────────────────────────────────
// 1) Planregister – finn planer for en eiendom
//    Åpen – ingen API-nøkkel nødvendig
// ──────────────────────────────────────────────

export async function hentPlanregister(
  kommunenummer: string,
  gardsnummer: number,
  bruksnummer: number
): Promise<PlanregisterResultat> {
  return planslurpenFetch<PlanregisterResultat>(
    `/planregister/${kommunenummer}/${gardsnummer}/${bruksnummer}`
  );
}

// ──────────────────────────────────────────────
// 2) Planslurp-status – sjekk om bestemmelser
//    er AI-tolket for en gitt plan
//    Åpen – ingen API-nøkkel nødvendig
// ──────────────────────────────────────────────

export async function hentPlanslurpStatus(
  kommunenummer: string,
  planId: string
): Promise<PlanslurpStatus | null> {
  try {
    return await planslurpenFetch<PlanslurpStatus>(
      `/planslurp/${kommunenummer}/${planId}`
    );
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// Hjelpefunksjoner for visning
// ──────────────────────────────────────────────

export function erGjeldendePlan(plan: PlanregistreringRef): boolean {
  return plan.planstatus.kodeverdi === "3"; // Endelig vedtatt
}

export function filtrerGjeldendePlaner(
  resultat: PlanregisterResultat
): PlanregistreringRef[] {
  return resultat.plan.filter(erGjeldendePlan);
}
