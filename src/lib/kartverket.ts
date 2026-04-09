const GEONORGE_BASE = "https://ws.geonorge.no";

// ──────────────────────────────────────────────
// Adressesøk – typer
// ──────────────────────────────────────────────

export interface Adresse {
  adressetekst: string;
  adressetekstutenadressetilleggsnavn: string;
  adressetilleggsnavn: string;
  adressekode: number;
  nummer: number;
  bokstav: string;
  kommunenummer: string;
  kommunenavn: string;
  gardsnummer: number;
  bruksnummer: number;
  festenummer: number;
  undernummer: number;
  postnummer: string;
  poststed: string;
  representasjonspunkt: {
    epsg: string;
    lat: number;
    lon: number;
  };
  oppdateringsdato: string;
  objtype: string;
}

export interface AdresseSokResultat {
  metadata: {
    totaltAntallTreff: number;
    vpiTotaltAntallTreff: number;
    sokeStreng: string;
    asciiKompatibeltSokeStreng: string;
    side: number;
    treffPerSide: number;
  };
  adresser: Adresse[];
}

export interface AdresseSokParams {
  sok: string;
  side?: number;
  treffPerSide?: number;
  kommunenummer?: string;
  postnummer?: string;
}

// ──────────────────────────────────────────────
// Eiendom (geokoding) – typer
// ──────────────────────────────────────────────

export interface EiendomProperties {
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  festenummer: number;
  seksjonsnummer: number;
  matrikkelnummertekst: string;
  objekttype: string;
  hovedområde: boolean;
  teigmedflerematrikkelenheter: boolean;
  uregistrertjordsameie: boolean;
  nøyaktighetsklasseteig: string;
  oppdateringsdato: string;
  lokalid: number;
}

export interface EiendomFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: [number, number];
  };
  properties: EiendomProperties;
}

export interface EiendomRespons {
  type: "FeatureCollection";
  features: EiendomFeature[];
}

export interface EiendomSokParams {
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  festenummer?: number;
  seksjonsnummer?: number;
}

// ──────────────────────────────────────────────
// Kommuneinfo – typer
// ──────────────────────────────────────────────

export interface Kommune {
  kommunenummer: string;
  kommunenavnNorsk: string;
  fylkesnummer: string;
  fylkesnavn: string;
  samiskForvaltningsomrade: boolean;
  punktIOmrade?: {
    coordinates: [number, number];
    type: string;
  };
  avgrensningsboks?: {
    coordinates: [number, number][][];
    type: string;
  };
}

export interface KommuneInfoParams {
  kommunenummer?: string;
  kommunenavn?: string;
}

// ──────────────────────────────────────────────
// Hjelpefunksjoner
// ──────────────────────────────────────────────

async function geonorgeFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Geonorge API-feil: ${res.status} ${res.statusText} (${url})`
    );
  }

  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)])
  ).toString();
}

// ──────────────────────────────────────────────
// 1) Adressesøk
// ──────────────────────────────────────────────

export async function sokAdresse(
  params: AdresseSokParams
): Promise<AdresseSokResultat> {
  const query = buildQuery({
    sok: params.sok,
    side: params.side,
    treffPerSide: params.treffPerSide,
    kommunenummer: params.kommunenummer,
    postnummer: params.postnummer,
  });

  return geonorgeFetch<AdresseSokResultat>(
    `${GEONORGE_BASE}/adresser/v1/sok${query}`
  );
}

// ──────────────────────────────────────────────
// 2) Eiendomsoppslag
// ──────────────────────────────────────────────

export async function hentEiendom(
  params: EiendomSokParams
): Promise<EiendomRespons> {
  const query = buildQuery({
    kommunenummer: params.kommunenummer,
    gardsnummer: params.gardsnummer,
    bruksnummer: params.bruksnummer,
    festenummer: params.festenummer,
    seksjonsnummer: params.seksjonsnummer,
  });

  return geonorgeFetch<EiendomRespons>(
    `${GEONORGE_BASE}/eiendom/v1/geokoding${query}`
  );
}

// ──────────────────────────────────────────────
// 3) Kommuneinfo
// ──────────────────────────────────────────────

export async function hentKommune(
  kommunenummer: string
): Promise<Kommune> {
  return geonorgeFetch<Kommune>(
    `${GEONORGE_BASE}/kommuneinfo/v1/kommuner/${kommunenummer}`
  );
}

export async function sokKommuner(
  params?: KommuneInfoParams
): Promise<Kommune[]> {
  const query = buildQuery({
    kommunenummer: params?.kommunenummer,
    kommunenavnNorsk: params?.kommunenavn,
  });

  return geonorgeFetch<Kommune[]>(
    `${GEONORGE_BASE}/kommuneinfo/v1/kommuner${query}`
  );
}
