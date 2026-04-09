"use server";

import {
  sokAdresse,
  hentEiendom,
  hentKommune,
  type AdresseSokResultat,
  type EiendomRespons,
  type Kommune,
} from "@/lib/kartverket";
import {
  hentReguleringsplan,
  type ReguleringsplanResultat,
} from "@/lib/reguleringsplan";
import {
  hentPlanbestemmelser,
  type PlanbestemmelserResultat,
} from "@/lib/planbestemmelser";

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

export async function fetchPropertyAndMunicipality(
  kommunenummer: string,
  gardsnummer: number,
  bruksnummer: number
): Promise<
  | { ok: true; eiendom: EiendomRespons; kommune: Kommune }
  | { ok: false; error: string }
> {
  try {
    const [eiendom, kommune] = await Promise.all([
      hentEiendom({ kommunenummer, gardsnummer, bruksnummer }),
      hentKommune(kommunenummer),
    ]);
    return { ok: true, eiendom, kommune };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchReguleringsplan(
  lat: number,
  lon: number
): Promise<
  | { ok: true; data: ReguleringsplanResultat }
  | { ok: false; error: string }
> {
  try {
    const data = await hentReguleringsplan(lat, lon);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchPlanbestemmelser(
  lat: number,
  lon: number,
  kommunenummer: string,
  gardsnummer: number,
  bruksnummer: number
): Promise<
  | { ok: true; data: PlanbestemmelserResultat }
  | { ok: false; error: string }
> {
  try {
    const data = await hentPlanbestemmelser(
      lat,
      lon,
      kommunenummer,
      gardsnummer,
      bruksnummer
    );
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
