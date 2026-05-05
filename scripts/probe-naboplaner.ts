/**
 * Verifiser at hentNaboplaner returnerer ekte data utenfor Oslo. Tester
 * sentrumsadresser i Bergen, Trondheim og Stavanger — alle dekket av DiBK
 * NAP. Kjøres uten Anthropic-kall, så raskt og billig.
 */
import { sokAdresse } from "../src/lib/kartverket";
import { hentReguleringsplan, plantypeTekst, planstatusTekst } from "../src/lib/reguleringsplan";
import { hentNaboplaner } from "../src/lib/naboplaner";

const ADRESSER = [
  "Storgata 1, Bergen",
  "Munkegata 1, Trondheim",
  "Olav Vs gate 1, Stavanger",
  "Selma Ellefsens vei 1, Oslo", // forventet 0 naboer (Oslo)
];

async function main() {
  for (const query of ADRESSER) {
    console.log(`\n${"━".repeat(70)}\n${query}\n${"━".repeat(70)}`);

    const sok = await sokAdresse({ sok: query, treffPerSide: 1 });
    if (sok.adresser.length === 0) {
      console.log("  Fant ingen treff i Kartverket");
      continue;
    }
    const adr = sok.adresser[0];
    console.log(
      `  ${adr.adressetekst}, ${adr.postnummer} ${adr.poststed}  (gnr/bnr ${adr.gardsnummer}/${adr.bruksnummer}, kommune ${adr.kommunenavn})`
    );

    const t0 = Date.now();
    const own = await hentReguleringsplan(
      adr.representasjonspunkt.lat,
      adr.representasjonspunkt.lon
    ).catch(() => ({ planomrader: [], arealformaal: [], hensynssoner: [] }));

    const egneIds = new Set(
      own.planomrader.map(
        (p) => `${p["arealplanId.kommunenummer"]}-${p["arealplanId.planidentifikasjon"]}`
      )
    );

    const naboer = await hentNaboplaner(
      adr.representasjonspunkt.lat,
      adr.representasjonspunkt.lon,
      egneIds
    );
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    console.log(`  Egen tomt: ${own.planomrader.length} planomrader`);
    for (const p of own.planomrader.slice(0, 3)) {
      console.log(`    - ${p.plannavn} (${plantypeTekst(p.plantype)}) [own]`);
    }

    console.log(`  Naboplaner: ${naboer.length} unike (${elapsed}s totalt)`);
    for (const p of naboer.slice(0, 5)) {
      console.log(
        `    - ${p.plannavn} (${plantypeTekst(p.plantype)}, ${planstatusTekst(p.planstatus)}) — ${p["arealplanId.planidentifikasjon"]}`
      );
    }
    if (naboer.length > 5) console.log(`    … og ${naboer.length - 5} til`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
