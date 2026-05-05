/**
 * Henting av reguleringsplaner på nabotomter.
 *
 * Bakgrunn (CLAUDE.md, briefing 30.04): detaljregulering på naboeiendom kan
 * binde tiltakshaver via rekkefølgekrav, hensynssoner og felles utomhus-
 * planer. Pipelinen hentet bare plandata for tiltakets egen tomt — denne
 * modulen lukker det gapet.
 *
 * Tilnærming: WMS GetFeatureInfo gir features ved et spesifikt pixel-punkt,
 * så å bare utvide bbox hjelper ikke. I stedet sampler vi 8 retninger i en
 * ring rundt input-punktet og dedupliserer plan-ID-ene.
 *
 * Begrensning: Oslo har ikke data i de nasjonale plan-tjenestene (bruker
 * eget PBE-system), så denne funksjonen returnerer tomt for Oslo-adresser.
 * For de øvrige ~200 kommunene som DiBK dekker, gir den et reelt bilde av
 * naboregulering.
 */
import { wmsFeatureInfo } from "./wms";
import type { Planomrade } from "./reguleringsplan";

const DIBK_WMS_BASE = "https://nap.ft.dibk.no/services/wms/reguleringsplaner/";

// 8 kompasspunkter rundt input. Bruker forsterket retning (~0.7 i diagonal)
// så samplerne ikke ligger for tett opp mot input-punktet.
const COMPASS_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],   // N
  [-1, 0],  // S
  [0, 1],   // E
  [0, -1],  // W
  [0.7, 0.7],
  [-0.7, 0.7],
  [0.7, -0.7],
  [-0.7, -0.7],
] as const;

// Approksimasjon: 1° lat ≈ 111 km, 1° lon ≈ 56 km på 60°N.
const METERS_PER_DEG_LAT = 111_000;
const METERS_PER_DEG_LON_AT_60N = 56_000;

function planKey(p: Planomrade): string {
  return `${p["arealplanId.kommunenummer"]}-${p["arealplanId.planidentifikasjon"]}`;
}

export async function hentNaboplaner(
  lat: number,
  lon: number,
  egneplanIds: ReadonlySet<string>,
  radiusMeters: number = 100
): Promise<Planomrade[]> {
  const dLat = radiusMeters / METERS_PER_DEG_LAT;
  const dLon = radiusMeters / METERS_PER_DEG_LON_AT_60N;

  const samplePoints = COMPASS_OFFSETS.map(([fLat, fLon]) => ({
    lat: lat + fLat * dLat,
    lon: lon + fLon * dLon,
  }));

  // Kjør alle 8 punkt-spørringer parallelt. Liten delta gir presis pixel-treff.
  const results = await Promise.all(
    samplePoints.map((p) =>
      wmsFeatureInfo<Planomrade>(
        DIBK_WMS_BASE,
        "rpomrade_vn2",
        p.lat,
        p.lon,
        { delta: 0.0001, featureCount: 5 }
      ).catch(() => [] as Planomrade[])
    )
  );

  // Flat ut, dedup på plan-ID, ekskluder eiendommens egne planer
  const seen = new Set<string>();
  const naboplaner: Planomrade[] = [];

  for (const planList of results) {
    for (const p of planList) {
      const key = planKey(p);
      if (egneplanIds.has(key) || seen.has(key)) continue;
      seen.add(key);
      naboplaner.push(p);
    }
  }

  return naboplaner;
}
