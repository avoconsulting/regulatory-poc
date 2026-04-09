const DIBK_WMS_BASE =
  "https://nap.ft.dibk.no/services/wms/reguleringsplaner/";

// ──────────────────────────────────────────────
// Typer – Planområde (rpomrade)
// ──────────────────────────────────────────────

export interface Planomrade {
  objid: number;
  objekttypenavn: string;
  plantype: number;
  planstatus: number;
  plannavn: string;
  planbestemmelse: number | null;
  ikrafttredelsesdato: string | null;
  lovreferanse: number | null;
  lovreferanseBeskrivelse: string | null;
  forslagsstillerType: number | null;
  vedtakEndeligPlanDato: string | null;
  kunngjøringsdato: string | null;
  vertikalnivå: number;
  "arealplanId.kommunenummer": string;
  "arealplanId.planidentifikasjon": string;
  link: string | null;
  oppdateringsdato: string | null;
}

// ──────────────────────────────────────────────
// Typer – Arealformål (arealformal)
// ──────────────────────────────────────────────

export interface Arealformaal {
  objid: number;
  objekttypenavn: string;
  reguleringsformål: number;
  reguleringsformålsutdyping: string | null;
  feltbetegnelse: string | null;
  "utnytting.utnyttingstype": number | null;
  "utnytting.utnyttingstall": number | null;
  "utnytting.utnyttingstall_minimum": number | null;
  uteoppholdsareal: number | null;
  vertikalnivå: number;
  "arealplanId.kommunenummer": string;
  "arealplanId.planidentifikasjon": string;
  oppdateringsdato: string | null;
}

// ──────────────────────────────────────────────
// Typer – Hensynssone
// ──────────────────────────────────────────────

export interface Hensynssone {
  objid: number;
  objekttypenavn: string;
  hensynSonenavn: string | null;
  hensynskategori: number | null;
  vertikalnivå: number;
  "arealplanId.kommunenummer": string;
  "arealplanId.planidentifikasjon": string;
  oppdateringsdato: string | null;
}

// ──────────────────────────────────────────────
// Samlet resultat
// ──────────────────────────────────────────────

export interface ReguleringsplanResultat {
  planomrader: Planomrade[];
  arealformaal: Arealformaal[];
  hensynssoner: Hensynssone[];
}

// ──────────────────────────────────────────────
// Oppslag-koder
// ──────────────────────────────────────────────

export const PLANTYPE: Record<number, string> = {
  20: "Kommuneplanens arealdel",
  21: "Kommunedelplan",
  30: "Eldre reguleringsplan",
  31: "Mindre reguleringsendring",
  32: "Reguleringsplan (PBL 1985)",
  33: "Bebyggelsesplan (PBL 1985)",
  34: "Detaljregulering",
  35: "Områderegulering",
};

export const PLANSTATUS: Record<number, string> = {
  1: "Planlegging igangsatt",
  2: "Planforslag",
  3: "Endelig vedtatt arealplan",
  4: "Opphevet",
  5: "Utgått/erstattet",
  6: "Vedtatt plan med innsigelse",
  8: "Overstyrt",
};

export const AREALFORMAAL: Record<number, string> = {
  110: "Bebyggelse og anlegg",
  120: "Sentrumsformål",
  130: "Kjøpesenter",
  140: "Boligbebyggelse",
  150: "Fritidsbebyggelse",
  160: "Offentlig eller privat tjenesteyting",
  170: "Fritids- og turistformål",
  180: "Råstoffutvinning",
  200: "Samferdselsanlegg og teknisk infrastruktur",
  300: "Grønnstruktur",
  310: "Naturområde",
  320: "Turdrag",
  330: "Friområde",
  340: "Park",
  399: "Annet grøntformål",
  400: "Forsvaret",
  500: "Landbruks-, natur- og friluftsformål",
  600: "Bruk og vern av sjø og vassdrag",
  700: "Hensynssone",
};

// ──────────────────────────────────────────────
// Hjelpefunksjoner
// ──────────────────────────────────────────────

function buildGetFeatureInfoUrl(
  layer: string,
  lat: number,
  lon: number,
  featureCount = 10
): string {
  // Lager en liten bbox rundt punktet (~50m)
  const delta = 0.001;
  const bbox = `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`;

  const params = new URLSearchParams({
    service: "WMS",
    version: "1.3.0",
    request: "GetFeatureInfo",
    layers: layer,
    query_layers: layer,
    crs: "EPSG:4326",
    bbox,
    width: "256",
    height: "256",
    i: "128",
    j: "128",
    info_format: "application/json",
    feature_count: String(featureCount),
  });

  return `${DIBK_WMS_BASE}?${params.toString()}`;
}

async function wmsFeatureInfo<T>(
  layer: string,
  lat: number,
  lon: number,
  featureCount = 10
): Promise<T[]> {
  const url = buildGetFeatureInfoUrl(layer, lat, lon, featureCount);
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `DiBK WMS-feil: ${res.status} ${res.statusText} (${layer})`
    );
  }

  const data = await res.json();
  return (data.features ?? []).map(
    (f: { properties: T }) => f.properties
  );
}

// ──────────────────────────────────────────────
// Offentlige funksjoner
// ──────────────────────────────────────────────

export async function hentReguleringsplan(
  lat: number,
  lon: number
): Promise<ReguleringsplanResultat> {
  const [planomrader, arealformaal, hensynssoner] = await Promise.all([
    wmsFeatureInfo<Planomrade>("rpomrade_vn2", lat, lon),
    wmsFeatureInfo<Arealformaal>("arealformal_vn2", lat, lon),
    wmsFeatureInfo<Hensynssone>("hensynssoner_vn2", lat, lon),
  ]);

  return { planomrader, arealformaal, hensynssoner };
}

export function plantypeTekst(kode: number): string {
  return PLANTYPE[kode] ?? `Ukjent plantype (${kode})`;
}

export function planstatusTekst(kode: number): string {
  return PLANSTATUS[kode] ?? `Ukjent status (${kode})`;
}

export function arealformaalTekst(kode: number): string {
  return AREALFORMAAL[kode] ?? `Formål ${kode}`;
}
