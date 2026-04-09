const EINNSYN_BASE = "https://api.einnsyn.no";

// ──────────────────────────────────────────────
// Typer
// ──────────────────────────────────────────────

export interface Journalpost {
  id: string;
  entity: "Journalpost";
  offentligTittel: string;
  offentligTittelSensitiv: string | null;
  journalposttype: string | null;
  journaldato: string | null;
  dokumentetsDato: string | null;
  publisertDato: string;
  journalaar: number | null;
  journalpostnummer: number | null;
  journalenhet: string;
  saksmappe: string | null;
  korrespondansepart: string[];
  dokumentbeskrivelse: string[];
  slug: string | null;
}

export interface Saksmappe {
  id: string;
  entity: "Saksmappe";
  offentligTittel: string;
  saksnummer: string | null;
  saksaar: number | null;
  sakssekvensnummer: number | null;
  administrativEnhet: string | null;
  publisertDato: string;
  journalenhet: string;
  slug: string | null;
}

export type EInnsynEntity = Journalpost | Saksmappe;

export interface EInnsynSokResultat {
  items: EInnsynEntity[];
  next: string | null;
  previous: string | null;
}

export interface EInnsynSokParams {
  query: string;
  entity?: ("Journalpost" | "Saksmappe")[];
  limit?: number;
  startingAfter?: string[];
  sortBy?: "score" | "publisertDato" | "oppdatertDato";
  sortOrder?: "asc" | "desc";
}

export interface Enhet {
  id: string;
  navn: string;
  entity: string;
  orgnummer: string | null;
}

// ──────────────────────────────────────────────
// Hjelpefunksjoner
// ──────────────────────────────────────────────

async function eInnsynFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${EINNSYN_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `eInnsyn API-feil: ${res.status} ${res.statusText} (${path})`
    );
  }

  return res.json() as Promise<T>;
}

// ──────────────────────────────────────────────
// Søk
// ──────────────────────────────────────────────

export async function sokEInnsyn(
  params: EInnsynSokParams
): Promise<EInnsynSokResultat> {
  const url = new URL(`${EINNSYN_BASE}/search`);
  url.searchParams.set("query", params.query);

  if (params.entity) {
    for (const e of params.entity) {
      url.searchParams.append("entity", e);
    }
  }
  if (params.limit) url.searchParams.set("limit", String(params.limit));
  if (params.sortBy) url.searchParams.set("sortBy", params.sortBy);
  if (params.sortOrder) url.searchParams.set("sortOrder", params.sortOrder);
  if (params.startingAfter) {
    for (const s of params.startingAfter) {
      url.searchParams.append("startingAfter", s);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`eInnsyn søk feilet: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<EInnsynSokResultat>;
}

export async function hentNesteResultater(
  nextPath: string
): Promise<EInnsynSokResultat> {
  return eInnsynFetch<EInnsynSokResultat>(nextPath);
}

// ──────────────────────────────────────────────
// Oppslag
// ──────────────────────────────────────────────

export async function hentJournalpost(id: string): Promise<Journalpost> {
  return eInnsynFetch<Journalpost>(`/journalpost/${id}`);
}

export async function hentSaksmappe(id: string): Promise<Saksmappe> {
  return eInnsynFetch<Saksmappe>(`/saksmappe/${id}`);
}

export async function hentSaksmappeJournalposter(
  saksmappeId: string
): Promise<EInnsynSokResultat> {
  return eInnsynFetch<EInnsynSokResultat>(
    `/saksmappe/${saksmappeId}/journalpost`
  );
}

export async function hentEnhet(id: string): Promise<Enhet> {
  return eInnsynFetch<Enhet>(`/enhet/${id}`);
}

// ──────────────────────────────────────────────
// Dispensasjonssøk – hjelpefunksjon
// ──────────────────────────────────────────────

export async function sokDispensasjoner(
  adresse: string,
  opts?: { kommune?: string; limit?: number }
): Promise<EInnsynSokResultat> {
  const queryParts = ["dispensasjon", adresse];
  if (opts?.kommune) queryParts.push(opts.kommune);

  return sokEInnsyn({
    query: queryParts.join(" "),
    entity: ["Journalpost", "Saksmappe"],
    limit: opts?.limit ?? 20,
    sortBy: "score",
  });
}
