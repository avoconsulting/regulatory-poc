import { hentReguleringsplan, type Planomrade } from "./reguleringsplan";
import { hentNaboplaner } from "./naboplaner";
import {
  hentPlanregister,
  hentPlanslurpStatus,
  filtrerGjeldendePlaner,
  type PlanregistreringRef,
  type PlanslurpStatus,
} from "./planslurpen";
import {
  hentPlanMedBestemmelser,
  type PlanMedBestemmelser,
} from "./arealplaner";

// ──────────────────────────────────────────────
// Samlet resultat fra hele pipeline
// ──────────────────────────────────────────────

export interface PlanInfo {
  planidentifikasjon: string;
  kommunenummer: string;
  plannavn: string;
  plantype: string;
  planstatus: string;
}

export interface PlanbestemmelserResultat {
  /** Planer funnet via DiBK WMS (geometri/metadata) */
  wmsPlanomrader: Planomrade[];
  /** Planer funnet via Planslurpen planregister (gnr/bnr-basert) */
  planregisterPlaner: PlanInfo[];
  /** Planbestemmelser-dokumenter fra arealplaner.no */
  planMedBestemmelser: PlanMedBestemmelser[];
  /** AI-tolkningsstatus fra Planslurpen (der tilgjengelig) */
  planslurpStatuser: (PlanslurpStatus & { planId: string })[];
  /** Planer som ikke ble funnet på arealplaner.no */
  ikkeIArealplaner: PlanInfo[];
  /** Naboplaner — detaljregulering på tilliggende eiendommer som kan binde
   *  tiltaket via rekkefølgekrav, hensynssoner eller felles utomhusplan.
   *  Kun metadata; bestemmelser hentes ikke automatisk for å holde latency nede. */
  naboplaner: Planomrade[];
}

// ──────────────────────────────────────────────
// Pipeline
// ──────────────────────────────────────────────

export async function hentPlanbestemmelser(
  lat: number,
  lon: number,
  kommunenummer: string,
  gardsnummer: number,
  bruksnummer: number
): Promise<PlanbestemmelserResultat> {
  // Steg 1: Hent plandata fra egen tomt + planregister parallelt
  const [wmsResultat, planregisterResultat] = await Promise.all([
    hentReguleringsplan(lat, lon).catch(() => ({
      planomrader: [],
      arealformaal: [],
      hensynssoner: [],
    })),
    hentPlanregister(kommunenummer, gardsnummer, bruksnummer).catch(() => null),
  ]);

  // Steg 1b: Hent naboplaner i ~100m ring. Ekskluderer egne plan-ID-er
  // så naboplaner-listen kun inneholder ny informasjon. Gjøres etter steg 1
  // for å kunne filtrere mot egne plan-ID-er.
  const egneplanIds = new Set(
    wmsResultat.planomrader.map(
      (p) => `${p["arealplanId.kommunenummer"]}-${p["arealplanId.planidentifikasjon"]}`
    )
  );
  const naboplaner = await hentNaboplaner(lat, lon, egneplanIds).catch(
    () => [] as Planomrade[]
  );

  // Steg 2: Samle unike planidentifikasjoner fra begge kilder
  const planerMap = new Map<string, PlanInfo>();

  for (const p of wmsResultat.planomrader) {
    const id = p["arealplanId.planidentifikasjon"];
    const knr = p["arealplanId.kommunenummer"];
    if (!planerMap.has(`${knr}-${id}`)) {
      planerMap.set(`${knr}-${id}`, {
        planidentifikasjon: id,
        kommunenummer: knr,
        plannavn: p.plannavn,
        plantype: String(p.plantype),
        planstatus: String(p.planstatus),
      });
    }
  }

  if (planregisterResultat) {
    for (const p of filtrerGjeldendePlaner(planregisterResultat)) {
      const id = p.nasjonalArealplanId.planidentifikasjon;
      const knr = p.nasjonalArealplanId.administrativEnhet.kommunenummer;
      if (!planerMap.has(`${knr}-${id}`)) {
        planerMap.set(`${knr}-${id}`, {
          planidentifikasjon: id,
          kommunenummer: knr,
          plannavn: p.plannavn,
          plantype: p.plantype.kodebeskrivelse,
          planstatus: p.planstatus.kodebeskrivelse,
        });
      }
    }
  }

  const allePlaner = Array.from(planerMap.values());

  // Steg 3: For hver plan, hent bestemmelser fra arealplaner.no + sjekk Planslurpen
  const [bestemmelserResultater, planslurpResultater] = await Promise.all([
    Promise.all(
      allePlaner.map((p) =>
        hentPlanMedBestemmelser(p.kommunenummer, p.planidentifikasjon).catch(
          () => null
        )
      )
    ),
    Promise.all(
      allePlaner.map((p) =>
        hentPlanslurpStatus(p.kommunenummer, p.planidentifikasjon).then(
          (status) =>
            status
              ? { ...status, planId: p.planidentifikasjon }
              : null
        )
      )
    ),
  ]);

  const planMedBestemmelser: PlanMedBestemmelser[] = [];
  const ikkeIArealplaner: PlanInfo[] = [];

  for (let i = 0; i < allePlaner.length; i++) {
    const resultat = bestemmelserResultater[i];
    if (resultat) {
      planMedBestemmelser.push(resultat);
    } else {
      ikkeIArealplaner.push(allePlaner[i]);
    }
  }

  const planslurpStatuser = planslurpResultater.filter(
    (s): s is PlanslurpStatus & { planId: string } => s !== null
  );

  return {
    wmsPlanomrader: wmsResultat.planomrader,
    planregisterPlaner: allePlaner,
    planMedBestemmelser,
    planslurpStatuser,
    ikkeIArealplaner,
    naboplaner,
  };
}
