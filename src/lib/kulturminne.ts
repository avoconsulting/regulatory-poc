import { wmsFeatureInfo } from "./wms";

// Riksantikvaren — Kulturminner WMS.
// Layer "Lokaliteter" inneholder kulturminne-lokaliteter med vernestatus
// (fredede, verneverdige, listeførte). For KU-trigger §6 og Vedlegg I er
// det fredede og verneverdige som er relevante.
const RA_KULTURMINNE_WMS = "https://kart.ra.no/wms/kulturminner2";

export interface KulturminneFeature {
  [key: string]: unknown;
}

export interface KulturminneTreff {
  navn: string | null;
  kategori: string | null;
  vernestatus: string | null;
  vernedato: string | null;
  raw: Record<string, unknown>;
}

export interface KulturminneResultat {
  treff: KulturminneTreff[];
}

export async function hentKulturminne(
  lat: number,
  lon: number
): Promise<KulturminneResultat> {
  const features = await wmsFeatureInfo<KulturminneFeature>(
    RA_KULTURMINNE_WMS,
    "Lokaliteter",
    lat,
    lon,
    { delta: 0.002, format: "gml" }
  ).catch(() => []);

  return {
    treff: features.map((f) => ({
      navn: (f.navn as string) ?? null,
      kategori:
        (f.lokaliteteskategori as string) ??
        (f.lokalitetsart as string) ??
        null,
      vernestatus: (f.vernetype as string) ?? null,
      vernedato: (f.vernedato as string) ?? null,
      raw: f,
    })),
  };
}
