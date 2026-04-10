"use server";

import { sokAdresse, type AdresseSokResultat } from "@/lib/kartverket";
import { hentPlanbestemmelser } from "@/lib/planbestemmelser";
import { sokDispensasjoner } from "@/lib/einnsyn";
import {
  analyserReguleringsrisiko,
  type Tiltak,
  type RisikoAnalyse,
} from "@/lib/analyse";

export async function searchAddresses(
  query: string
): Promise<{ ok: true; data: AdresseSokResultat } | { ok: false; error: string }> {
  try {
    const data = await sokAdresse({ sok: query, treffPerSide: 10 });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function runAnalysis(
  adresse: string,
  kommunenavn: string,
  kommunenummer: string,
  gardsnummer: number,
  bruksnummer: number,
  lat: number,
  lon: number,
  tiltak: Tiltak
): Promise<{ ok: true; data: RisikoAnalyse } | { ok: false; error: string }> {
  try {
    // Hent plandata og dispensasjonshistorikk parallelt
    const [plandata, dispensasjoner] = await Promise.all([
      hentPlanbestemmelser(lat, lon, kommunenummer, gardsnummer, bruksnummer),
      sokDispensasjoner(adresse, { kommune: kommunenavn }).catch(() => null),
    ]);

    const analyse = await analyserReguleringsrisiko({
      adresse,
      kommunenavn,
      kommunenummer,
      gardsnummer,
      bruksnummer,
      tiltak,
      plandata,
      dispensasjonshistorikk: dispensasjoner ?? undefined,
    });

    return { ok: true, data: analyse };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
