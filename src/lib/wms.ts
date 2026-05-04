// Generisk WMS GetFeatureInfo-helper. Brukes av reguleringsplan, kulturminne,
// naturmangfold og flomsone. Norske offentlige WMS-er bruker ulike formater:
//
// - DiBK reguleringsplaner: application/json (klassisk OGC JSON)
// - Miljødirektoratet (ArcGIS): application/geo+json
// - NVE Atlas (ArcGIS): application/geo+json
// - Riksantikvaren (MapServer 8): application/vnd.ogc.gml (kun GML)
//
// Vi støtter alle tre via `format`-opsjonen og parser GML med en enkel
// regex (RAs format er flat, ikke nested).

const DEFAULT_DELTA = 0.001; // ~50m bbox rundt punktet

export type WmsFormat = "json" | "geojson" | "gml";

export interface WmsOptions {
  delta?: number;
  featureCount?: number;
  crs?: string;
  version?: string;
  format?: WmsFormat;
}

const FORMAT_HEADER: Record<WmsFormat, string> = {
  json: "application/json",
  geojson: "application/geo+json",
  gml: "application/vnd.ogc.gml",
};

function buildGetFeatureInfoUrl(
  baseUrl: string,
  layer: string,
  lat: number,
  lon: number,
  opts: WmsOptions
): string {
  const delta = opts.delta ?? DEFAULT_DELTA;
  const bbox = `${lat - delta},${lon - delta},${lat + delta},${lon + delta}`;
  const format = opts.format ?? "json";

  const params = new URLSearchParams({
    service: "WMS",
    version: opts.version ?? "1.3.0",
    request: "GetFeatureInfo",
    layers: layer,
    query_layers: layer,
    styles: "",
    crs: opts.crs ?? "EPSG:4326",
    bbox,
    width: "256",
    height: "256",
    i: "128",
    j: "128",
    info_format: FORMAT_HEADER[format],
    feature_count: String(opts.featureCount ?? 10),
  });

  return `${baseUrl}?${params.toString()}`;
}

// Enkel GML-parser for MapServer-format (msGMLOutput).
// Features ligger som <Layer_feature>...</Layer_feature> med direkte child-tags
// som properties. Håndterer ikke nested <gml:*>-elementer (boundedBy osv.).
function parseGmlFeatures<T>(xml: string, layer: string): T[] {
  const featurePattern = new RegExp(
    `<${layer}_feature>([\\s\\S]*?)</${layer}_feature>`,
    "g"
  );
  const features: T[] = [];

  for (const match of xml.matchAll(featurePattern)) {
    const body = match[1];
    const props: Record<string, string> = {};

    // Match tags som ikke er gml:* og som har innhold
    const propPattern = /<(\w+)>([^<]*)<\/\1>/g;
    for (const pm of body.matchAll(propPattern)) {
      props[pm[1]] = pm[2].trim();
    }

    features.push(props as unknown as T);
  }

  return features;
}

export async function wmsFeatureInfo<T>(
  baseUrl: string,
  layer: string,
  lat: number,
  lon: number,
  opts: WmsOptions = {}
): Promise<T[]> {
  const format = opts.format ?? "json";
  const url = buildGetFeatureInfoUrl(baseUrl, layer, lat, lon, opts);

  const res = await fetch(url, {
    headers: { Accept: FORMAT_HEADER[format] },
  });

  if (!res.ok) {
    throw new Error(
      `WMS-feil: ${res.status} ${res.statusText} (${baseUrl} layer=${layer})`
    );
  }

  if (format === "gml") {
    const text = await res.text();
    return parseGmlFeatures<T>(text, layer);
  }

  const data = await res.json();
  return (data.features ?? []).map(
    (f: { properties: T }) => f.properties
  );
}
