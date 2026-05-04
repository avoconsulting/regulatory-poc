/**
 * Ende-til-ende-test: kjør analyse-pipelinen for Selma Ellefsens vei (Oslo).
 *
 * Selma Ellefsens vei ligger i Hasle-området, Oslo (postnr 0581). Området har
 * vært gjenstand for omfattende transformasjon fra næring til bolig — en god
 * test-case for en ambisiøs bolig-transformasjon.
 *
 * Oslo har eget plansystem (PBE), så de nasjonale plan-tjenestene returnerer
 * tomt. Pipelinen skal håndtere dette gracefully (jf. analyse.ts:erTomtForPlandata)
 * — testen sjekker at vi får en *brukbar* analyse selv uten DiBK/Planslurpen-data.
 */
import { sokAdresse } from "../src/lib/kartverket";
import { hentPlanbestemmelser } from "../src/lib/planbestemmelser";
import { sokDispensasjoner } from "../src/lib/einnsyn";
import { hentStedKontekst } from "../src/lib/sted-kontekst";
import { assessKuTrigger } from "../src/lib/ku-trigger";
import {
  analyserReguleringsrisiko,
  type Tiltak,
} from "../src/lib/analyse";

const ADRESSE_QUERY = "Selma Ellefsens vei 1";

const TILTAK: Tiltak = {
  beskrivelse:
    "Oppføring av leilighetsbygg på næringstomt — transformasjon fra næring/lager til bolig",
  byggehøyde: 21,
  utnyttelsesgrad: 70,
  bruksformål: "Bolig (leiligheter), eventuelt med næring i 1. etasje",
  antallEnheter: 45,
  parkering: "Underjordisk garasje, 0,5 plasser per enhet",
};

function header(label: string) {
  console.log(`\n${"━".repeat(70)}`);
  console.log(label);
  console.log("━".repeat(70));
}

async function main() {
  const startTid = Date.now();

  header("1) Adressesøk via Kartverket");
  const adresseSok = await sokAdresse({ sok: ADRESSE_QUERY, treffPerSide: 1 });
  if (adresseSok.adresser.length === 0) {
    console.error(`Fant ingen treff for "${ADRESSE_QUERY}"`);
    process.exit(1);
  }
  const adr = adresseSok.adresser[0];
  console.log(`  ${adr.adressetekst}, ${adr.postnummer} ${adr.poststed}`);
  console.log(`  Gnr/Bnr: ${adr.gardsnummer}/${adr.bruksnummer}`);
  console.log(`  Kommune: ${adr.kommunenavn} (${adr.kommunenummer})`);
  console.log(`  Lat/Lon: ${adr.representasjonspunkt.lat}, ${adr.representasjonspunkt.lon}`);

  header("2) Eksterne kilder (parallelt)");
  const t0 = Date.now();
  const [plandata, dispensasjoner, stedKontekst] = await Promise.all([
    hentPlanbestemmelser(
      adr.representasjonspunkt.lat,
      adr.representasjonspunkt.lon,
      adr.kommunenummer,
      adr.gardsnummer,
      adr.bruksnummer
    ),
    sokDispensasjoner(adr.adressetekst, { kommune: adr.kommunenavn }).catch(
      () => null
    ),
    hentStedKontekst(
      adr.representasjonspunkt.lat,
      adr.representasjonspunkt.lon
    ),
  ]);
  console.log(`  Hentet på ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  console.log(`\n  DiBK WMS plandata:`);
  console.log(`    - planomrader: ${plandata.wmsPlanomrader.length}`);
  console.log(`    - planregister-planer: ${plandata.planregisterPlaner.length}`);
  console.log(`    - bestemmelser-dokumenter: ${plandata.planMedBestemmelser.length}`);
  console.log(`    - planslurpStatuser: ${plandata.planslurpStatuser.length}`);
  console.log(`    - planer uten arealplaner-data: ${plandata.ikkeIArealplaner.length}`);

  console.log(`\n  Dispensasjonshistorikk (eInnsyn): ${dispensasjoner?.items.length ?? 0} treff`);
  if (dispensasjoner && dispensasjoner.items.length > 0) {
    for (const item of dispensasjoner.items.slice(0, 5)) {
      console.log(`    - ${item.offentligTittel.slice(0, 80)}`);
    }
    if (dispensasjoner.items.length > 5) {
      console.log(`    … og ${dispensasjoner.items.length - 5} til`);
    }
  }

  console.log(`\n  Sted-kontekst:`);
  console.log(`    - Kulturminne: ${stedKontekst.kulturminne.length}`);
  console.log(`    - Verneområder: ${stedKontekst.verneomrader.length}`);
  console.log(`    - Naturtyper: ${stedKontekst.naturtyper.length}`);
  console.log(`    - Flomsoner: ${stedKontekst.flomsoner.length}`);
  console.log(`    - I aktsomhetsområde flom: ${stedKontekst.iAktsomhetsomraadeFlom}`);
  console.log(`    - Hensynssoner (DiBK): ${stedKontekst.hensynssoner.length}`);
  console.log(`    - Aggregerte KU-flagg: ${stedKontekst.flagg.length}`);
  for (const flag of stedKontekst.flagg) {
    console.log(`      [${flag.alvorlighet}] ${flag.type}: ${flag.beskrivelse}`);
  }

  header("3) KU-trigger-AI (Claude)");
  const t1 = Date.now();
  const kuVurdering = await assessKuTrigger(
    {
      tiltak: TILTAK,
      adresse: adr.adressetekst,
      kommunenavn: adr.kommunenavn,
    },
    stedKontekst
  ).catch((err) => {
    console.error(`  KU-trigger feilet: ${err.message}`);
    return null;
  });
  console.log(`  Ferdig på ${((Date.now() - t1) / 1000).toFixed(1)}s`);

  if (kuVurdering) {
    console.log(`\n  Outcome: ${kuVurdering.outcome} (konfidens: ${kuVurdering.confidence})`);
    console.log(`  Rasjonal: ${kuVurdering.rationale}`);
    if (kuVurdering.triggers.length > 0) {
      console.log(`\n  Triggere:`);
      for (const t of kuVurdering.triggers) {
        console.log(`    - [${t.severity}] (${t.category}) ${t.description}`);
        console.log(`        kilde: ${t.sourceRef}`);
      }
    }
    console.log(`\n  Kilder fra kunnskapsbase: ${kuVurdering.contextSnapshot.relevantKilder.length}`);
    for (const k of kuVurdering.contextSnapshot.relevantKilder.slice(0, 5)) {
      console.log(`    - ${k}`);
    }
  }

  header("4) Hovedanalyse-AI (Claude)");
  const t2 = Date.now();
  const analyse = await analyserReguleringsrisiko({
    adresse: adr.adressetekst,
    kommunenavn: adr.kommunenavn,
    kommunenummer: adr.kommunenummer,
    gardsnummer: adr.gardsnummer,
    bruksnummer: adr.bruksnummer,
    tiltak: TILTAK,
    plandata,
    dispensasjonshistorikk: dispensasjoner ?? undefined,
    kuVurdering,
  });
  console.log(`  Ferdig på ${((Date.now() - t2) / 1000).toFixed(1)}s`);

  console.log(`\n  Samlet risikovurdering: ${analyse.samletRisikovurdering.toUpperCase()}`);
  console.log(`  Oppsummering: ${analyse.oppsummering}`);

  console.log(`\n  Red flags (${analyse.redFlags.length}):`);
  for (const rf of analyse.redFlags) {
    console.log(`    [${rf.alvorlighet}] ${rf.tittel}`);
    console.log(`      Beskrivelse: ${rf.beskrivelse}`);
    console.log(`      Hjemmel: ${rf.hjemmel}`);
    console.log(`      Anbefaling: ${rf.anbefaling}`);
    console.log();
  }

  console.log(`  Strategier (${analyse.strategier.length}):`);
  for (const s of analyse.strategier) {
    console.log(`    [${s.risikoprofil}] ${s.navn}`);
    console.log(`      ${s.beskrivelse}`);
    console.log(`      Forventet utfall: ${s.forventetUtfall}`);
    console.log(`      Justeringer: ${s.anbefalteJusteringer.join("; ")}`);
    console.log();
  }

  console.log(`  Oppsider (${analyse.oppsider.length}):`);
  for (const o of analyse.oppsider) {
    console.log(`    - ${o.tittel} — ${o.potensial}`);
    console.log(`      hjemmel: ${o.hjemmel}`);
  }

  console.log(`\n  Anbefalinger:`);
  for (const a of analyse.anbefalinger) {
    console.log(`    - ${a}`);
  }

  console.log(`\n  Referanser brukt: ${analyse.referanser.length}`);
  for (const r of analyse.referanser.slice(0, 10)) {
    console.log(`    - ${r}`);
  }

  header(`Totalt: ${((Date.now() - startTid) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("Fatal feil:", err);
  process.exit(1);
});
