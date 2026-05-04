import { wmsFeatureInfo } from "./wms";

// NVE — Flomaktsomhet (kart.nve.no Enterprise WMS).
// Returnerer aktsomhetsområder for flom uten å skille på returperiode.
// For KU-trigger §10 er dette tilstrekkelig — om tomten ligger i et
// aktsomhetsområde er det relevant uavhengig av nøyaktig returperiode.
const NVE_FLOM_WMS =
  "https://kart.nve.no/enterprise/services/Flomaktsomhet/MapServer/WMSServer";

export interface FlomsoneFeature {
  [key: string]: unknown;
}

export interface Flomsone {
  type: string | null;             // f.eks. "FlomAktsomhetOmr"
  vassdragsomraadeId: string | null; // f.eks. "002"
  malemetode: string | null;
  noyaktighet: string | null;
  raw: Record<string, unknown>;
}

export interface FlomsoneResultat {
  flomsoner: Flomsone[];
  iAktsomhetsomraade: boolean;
}

export async function hentFlomsone(
  lat: number,
  lon: number
): Promise<FlomsoneResultat> {
  const features = await wmsFeatureInfo<FlomsoneFeature>(
    NVE_FLOM_WMS,
    "Flom_aktsomhetsomrade",
    lat,
    lon,
    { format: "geojson" }
  ).catch(() => []);

  const flomsoner = features.map((f) => ({
    type: (f.objType as string) ?? null,
    vassdragsomraadeId: (f.vassOmr as string) ?? null,
    malemetode: (f.malemetode as string) ?? null,
    noyaktighet: (f.noyaktighet as string) ?? null,
    raw: f,
  }));

  return {
    flomsoner,
    iAktsomhetsomraade: flomsoner.length > 0,
  };
}
