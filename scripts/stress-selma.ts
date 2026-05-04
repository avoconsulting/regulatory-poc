/**
 * Stress-test: kjør analyse mot Selma Ellefsens vei med en VERBOS tiltak-
 * beskrivelse som tidligere har trigget JSON-truncation. Verifiserer at
 * max_tokens-grensen (16384) er romslig nok og at stop_reason-sjekken
 * fanger kant-tilfeller.
 */
import { sokAdresse } from "../src/lib/kartverket";
import { hentPlanbestemmelser } from "../src/lib/planbestemmelser";
import { sokDispensasjoner } from "../src/lib/einnsyn";
import { hentStedKontekst } from "../src/lib/sted-kontekst";
import { assessKuTrigger } from "../src/lib/ku-trigger";
import { analyserReguleringsrisiko, type Tiltak } from "../src/lib/analyse";

const TILTAK: Tiltak = {
  beskrivelse:
    "Helhetlig transformasjon av næringseiendom til urban boligbebyggelse med integrert næring og tjenesteyting. Prosjektet inkluderer riving av eksisterende lagerbygg, oppføring av tre nye bygningsvolumer i 6-7 etasjer, etablering av offentlig tilgjengelig torg, gangakse mellom Selma Ellefsens vei og Grenseveien, samt felles uteoppholdsareal med lekeplass, sosialt areal og urban grøntstruktur. Tiltaket koordineres med pågående transformasjon i Hovinbyen og forutsetter ny detaljreguleringsplan",
  byggehøyde: 24,
  utnyttelsesgrad: 85,
  bruksformål:
    "Bolig (45-60 leiligheter), næring/handel i 1. etasje, mulig barnehage på tak/gårdsrom, energistasjon",
  antallEnheter: 55,
  parkering:
    "Underjordisk parkering 0,3 plasser per enhet, sykkelparkering 2 plasser per enhet, mobilitetspunkt med bildeling og elsykler",
  annet:
    "Krav om tilfluktsrom vurderes (>50 enheter), støyanalyse mot Grenseveien, sol/skygge-analyse mot eksisterende bebyggelse, koordinering med VA-bidrag for hele Hovinbyen-feltet, forhåndsvurdering av kulturminnehensyn for tilgrensende bevaringsverdig industribebyggelse",
};

async function main() {
  const t0 = Date.now();
  const adresseSok = await sokAdresse({ sok: "Selma Ellefsens vei 1", treffPerSide: 1 });
  const adr = adresseSok.adresser[0];

  const [plandata, dispensasjoner, stedKontekst] = await Promise.all([
    hentPlanbestemmelser(
      adr.representasjonspunkt.lat,
      adr.representasjonspunkt.lon,
      adr.kommunenummer,
      adr.gardsnummer,
      adr.bruksnummer
    ),
    sokDispensasjoner(adr.adressetekst, { kommune: adr.kommunenavn }).catch(() => null),
    hentStedKontekst(adr.representasjonspunkt.lat, adr.representasjonspunkt.lon),
  ]);

  const kuVurdering = await assessKuTrigger(
    { tiltak: TILTAK, adresse: adr.adressetekst, kommunenavn: adr.kommunenavn },
    stedKontekst
  );

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

  console.log(`Stress-test passert på ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  Risiko: ${analyse.samletRisikovurdering}`);
  console.log(`  Red flags: ${analyse.redFlags.length}`);
  console.log(`  Strategier: ${analyse.strategier.length}`);
  console.log(`  Oppsider: ${analyse.oppsider.length}`);
  console.log(`  Anbefalinger: ${analyse.anbefalinger.length}`);
  console.log(`  Referanser: ${analyse.referanser.length}`);
  console.log(`  KU-outcome: ${kuVurdering.outcome}`);
}

main().catch((err) => {
  console.error("Stress-test FEILET:", err.message);
  process.exit(1);
});
