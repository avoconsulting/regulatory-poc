"use server";

import { sokAdresse, type AdresseSokResultat } from "@/lib/kartverket";
import { hentPlanbestemmelser } from "@/lib/planbestemmelser";
import { sokDispensasjoner } from "@/lib/einnsyn";
import {
  analyserReguleringsrisiko,
  saveAnalysis,
  type Tiltak,
  type RisikoAnalyse,
} from "@/lib/analyse";
import { hentStedKontekst } from "@/lib/sted-kontekst";
import { assessKuTrigger, saveKuAssessment } from "@/lib/ku-trigger";

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
    // Hent plandata, dispensasjonshistorikk og sted-kontekst parallelt
    const [plandata, dispensasjoner, stedKontekst] = await Promise.all([
      hentPlanbestemmelser(lat, lon, kommunenummer, gardsnummer, bruksnummer),
      sokDispensasjoner(adresse, { kommune: kommunenavn }).catch(() => null),
      hentStedKontekst(lat, lon),
    ]);

    // KU-trigger først — hovedanalysen skal kunne bygge på konklusjonen
    const kuVurdering = await assessKuTrigger(
      { tiltak, adresse, kommunenavn },
      stedKontekst
    ).catch((err) => {
      console.error("KU-trigger feilet:", err);
      return null;
    });

    // Hovedanalyse + KU-lagring parallelt etter at KU-resultatet foreligger.
    // KU-id må fanges så vi kan koble den til analyses-raden.
    const [analyse, kuSaveResult] = await Promise.all([
      analyserReguleringsrisiko({
        adresse,
        kommunenavn,
        kommunenummer,
        gardsnummer,
        bruksnummer,
        tiltak,
        plandata,
        dispensasjonshistorikk: dispensasjoner ?? undefined,
        kuVurdering,
      }),
      kuVurdering
        ? saveKuAssessment({
            input: { tiltak, adresse, kommunenavn },
            stedKontekst,
            assessment: kuVurdering,
            kommunenummer,
            gnr: gardsnummer,
            bnr: bruksnummer,
          }).catch((err) => {
            console.error("Lagring av KU-vurdering feilet:", err);
            return null;
          })
        : Promise.resolve(null),
    ]);

    const fullResult: RisikoAnalyse = { ...analyse, kuVurdering };

    // Persistens — beste-innsats. Feil her skal ikke blokkere svaret.
    saveAnalysis({
      adresse,
      kommunenavn,
      kommunenummer,
      gnr: gardsnummer,
      bnr: bruksnummer,
      tiltak,
      result: fullResult,
      kuAssessmentId: kuSaveResult?.id,
    }).catch((err) => {
      console.error("Lagring av analyse feilet:", err);
    });

    return { ok: true, data: fullResult };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
