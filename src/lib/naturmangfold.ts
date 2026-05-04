import { wmsFeatureInfo } from "./wms";

// Miljødirektoratet — vern (verneområder) og naturtyper med KU-verdi.
const VERN_WMS =
  "https://kart.miljodirektoratet.no/arcgis/services/vern/MapServer/WMSServer";
const NATURTYPER_KUVERDI_WMS =
  "https://kart.miljodirektoratet.no/arcgis/services/naturtyper_kuverdi/MapServer/WMSServer";

export interface VerneomradeFeature {
  [key: string]: unknown;
}

export interface Verneomrade {
  navn: string | null;
  verneform: string | null;
  vernedato: string | null;
  raw: Record<string, unknown>;
}

export interface Naturtype {
  navn: string | null;
  kuVerdi: "stor" | "svært_stor" | "middels" | null;
  raw: Record<string, unknown>;
}

export interface NaturmangfoldResultat {
  verneomrader: Verneomrade[];
  naturtyper: Naturtype[];
}

async function hentNaturtypeMedVerdi(
  lat: number,
  lon: number,
  layer: string,
  verdi: Naturtype["kuVerdi"]
): Promise<Naturtype[]> {
  const features = await wmsFeatureInfo<VerneomradeFeature>(
    NATURTYPER_KUVERDI_WMS,
    layer,
    lat,
    lon,
    { format: "geojson" }
  ).catch(() => []);

  return features.map((f) => ({
    navn:
      (f.naturtype as string) ??
      (f.NATURTYPE as string) ??
      (f.navn as string) ??
      null,
    kuVerdi: verdi,
    raw: f,
  }));
}

export async function hentNaturmangfold(
  lat: number,
  lon: number
): Promise<NaturmangfoldResultat> {
  const [verneFeatures, storVerdi, sværtStorVerdi, middelsVerdi] =
    await Promise.all([
      wmsFeatureInfo<VerneomradeFeature>(
        VERN_WMS,
        "naturvern_omrade",
        lat,
        lon,
        { format: "geojson" }
      ).catch(() => []),
      hentNaturtypeMedVerdi(lat, lon, "kuverdi_stor_verdi", "stor"),
      hentNaturtypeMedVerdi(lat, lon, "kuverdi_svært_stor_verdi", "svært_stor"),
      hentNaturtypeMedVerdi(lat, lon, "kuverdi_middels_verdi", "middels"),
    ]);

  return {
    verneomrader: verneFeatures.map((f) => ({
      navn:
        (f.offisieltNavn as string) ??
        (f.navn as string) ??
        null,
      verneform: (f.verneform as string) ?? null,
      vernedato: (f.vernedato as string) ?? null,
      raw: f,
    })),
    naturtyper: [...sværtStorVerdi, ...storVerdi, ...middelsVerdi],
  };
}
