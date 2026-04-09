const API_BASE = "https://api.arealplaner.no/api";
const API_KEY = "D7D7FFB4-1A4A-44EA-BD15-BCDB6CEF8CA5";

// ──────────────────────────────────────────────
// Typer
// ──────────────────────────────────────────────

export interface ArealplanerKunde {
  id: string;
  navn: string;
  beskrivelse: string | null;
  kommunenummer: string;
  norkartKundeId: string | null;
  status: number;
}

export interface Arealplan {
  id: number;
  komnr: string;
  planId: string;
  planNavn: string;
  planTypeId: number;
  planType: string;
  planStatusId: number;
  planStatus: string;
  planBestemmelseId: number;
  planBestemmelse: string | null;
  iKraft: string | null;
  lovreferanseId: number;
  lovrefBeskrivelse: string | null;
  forslagsstillerId: number;
  horingsStart: string | null;
  horingsfrist: string | null;
  sistBehandlet: string | null;
  ubehandletKlage: boolean;
  ubehandletInnsigelse: boolean;
  vertikalniva: { id: number; beskrivelse: string }[];
}

export interface PlanDokument {
  id: number;
  dokumentnavn: string;
  dokumenttittel: string | null;
  dokumentpath: string;
  dokumentdato: string | null;
  beskrivelse: string | null;
  url: string;
  direkteUrl: string | null;
  dokumenttypeId: number;
  dokumenttype: string;
  tilgangId: number;
  tilgang: string;
  visIGjeldendeBestemmelser: boolean;
}

export interface PlanDispensasjon {
  id: number;
  arealplanId: number;
  dispensasjonstypeId: number | null;
  dispensasjonstype: string | null;
  vedtaksdato: string | null;
  vedtak: string | null;
  beskrivelse: string | null;
}

// ──────────────────────────────────────────────
// Hjelpefunksjoner
// ──────────────────────────────────────────────

async function apiFetch<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("api_key", API_KEY);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Arealplaner API-feil: ${res.status} ${res.statusText} (${path})`
    );
  }

  return res.json() as Promise<T>;
}

// ──────────────────────────────────────────────
// Kunde-oppslag (kommune → kundeId)
// ──────────────────────────────────────────────

let _kundeCache: ArealplanerKunde[] | null = null;

async function hentAlleKunder(): Promise<ArealplanerKunde[]> {
  if (_kundeCache) return _kundeCache;
  _kundeCache = await apiFetch<ArealplanerKunde[]>("/kunder");
  return _kundeCache;
}

export async function finnKundeId(kommunenummer: string): Promise<string | null> {
  const kunder = await hentAlleKunder();
  // Prefer status 0 (active), match on kommunenummer
  const aktiv = kunder.find(
    (k) => k.kommunenummer === kommunenummer && k.status === 0
  );
  if (aktiv) return aktiv.id;

  // Fallback to any match
  const match = kunder.find((k) => k.kommunenummer === kommunenummer);
  return match?.id ?? null;
}

// ──────────────────────────────────────────────
// Planer
// ──────────────────────────────────────────────

export async function hentPlanerForKommune(
  kundeId: string,
  params?: { planidentifikasjonLike?: string; planStatusId?: number }
): Promise<Arealplan[]> {
  return apiFetch<Arealplan[]>(`/kunder/${kundeId}/arealplaner`, {
    PlanidentifikasjonLike: params?.planidentifikasjonLike,
    PlanStatusId: params?.planStatusId,
  });
}

export async function hentPlan(
  kundeId: string,
  arealplanId: number
): Promise<Arealplan> {
  return apiFetch<Arealplan>(`/kunder/${kundeId}/arealplaner/${arealplanId}`);
}

// ──────────────────────────────────────────────
// Dokumenter
// ──────────────────────────────────────────────

export async function hentPlanDokumenter(
  kundeId: string,
  arealplanId: number
): Promise<PlanDokument[]> {
  return apiFetch<PlanDokument[]>(
    `/kunder/${kundeId}/arealplaner/${arealplanId}/dokumenter`
  );
}

export function hentBestemmelser(dokumenter: PlanDokument[]): PlanDokument[] {
  return dokumenter.filter(
    (d) =>
      d.dokumenttype === "Bestemmelser" ||
      d.dokumenttypeId === 5 ||
      d.visIGjeldendeBestemmelser
  );
}

export function lagNedlastingsUrl(dokument: PlanDokument): string {
  if (dokument.direkteUrl) return `${dokument.direkteUrl}?api_key=${API_KEY}`;
  return `${API_BASE}/kunder/${dokument.dokumentpath.split("/")[0]}/../dokumenter/${dokument.id}/download/${dokument.dokumentnavn}?api_key=${API_KEY}`;
}

export async function lastNedDokument(dokument: PlanDokument): Promise<ArrayBuffer> {
  const url = dokument.direkteUrl
    ? `${dokument.direkteUrl}?api_key=${API_KEY}`
    : dokument.url;

  const res = await fetch(url, { redirect: "follow" });

  if (!res.ok) {
    throw new Error(
      `Kunne ikke laste ned dokument: ${res.status} ${res.statusText}`
    );
  }

  return res.arrayBuffer();
}

// ──────────────────────────────────────────────
// Dispensasjoner
// ──────────────────────────────────────────────

export async function hentDispensasjoner(
  kundeId: string,
  arealplanId: number
): Promise<PlanDispensasjon[]> {
  return apiFetch<PlanDispensasjon[]>(
    `/kunder/${kundeId}/arealplaner/${arealplanId}/dispensasjoner`
  );
}

// ──────────────────────────────────────────────
// Samlet oppslag: kommunenummer + planidentifikasjon → bestemmelser
// ──────────────────────────────────────────────

export interface PlanMedBestemmelser {
  plan: Arealplan;
  bestemmelser: PlanDokument[];
  dispensasjoner: PlanDispensasjon[];
  alleDokumenter: PlanDokument[];
}

export async function hentPlanMedBestemmelser(
  kommunenummer: string,
  planidentifikasjon: string
): Promise<PlanMedBestemmelser | null> {
  const kundeId = await finnKundeId(kommunenummer);
  if (!kundeId) return null;

  const planer = await hentPlanerForKommune(kundeId, {
    planidentifikasjonLike: planidentifikasjon,
  });

  if (planer.length === 0) return null;

  const plan = planer[0];
  const [alleDokumenter, dispensasjoner] = await Promise.all([
    hentPlanDokumenter(kundeId, plan.id),
    hentDispensasjoner(kundeId, plan.id),
  ]);

  return {
    plan,
    bestemmelser: hentBestemmelser(alleDokumenter),
    dispensasjoner,
    alleDokumenter,
  };
}
