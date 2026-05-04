// Probe for å verifisere at de tre nye WMS-kildene (kulturminne, naturmangfold,
// flomsone) faktisk svarer mot reelle koordinater. Dumper rå respons så vi
// ser om layer-navn og felt-navn stemmer med antakelsene i modulene.
//
// Bruk:
//   npm run probe:sted -- 59.9139 10.7522        # Oslo sentrum
//   npm run probe:sted -- 59.9264 10.7747        # Selma Ellefsens vei

import { hentKulturminne } from "../src/lib/kulturminne";
import { hentNaturmangfold } from "../src/lib/naturmangfold";
import { hentFlomsone } from "../src/lib/flomsone";

async function main() {
  const lat = parseFloat(process.argv[2]);
  const lon = parseFloat(process.argv[3]);

  if (isNaN(lat) || isNaN(lon)) {
    console.error("Bruk: npm run probe:sted -- <lat> <lon>");
    process.exit(1);
  }

  console.log(`Spør lat=${lat}, lon=${lon}\n`);

  const [kult, natur, flom] = await Promise.allSettled([
    hentKulturminne(lat, lon),
    hentNaturmangfold(lat, lon),
    hentFlomsone(lat, lon),
  ]);

  console.log("=== Kulturminne ===");
  if (kult.status === "fulfilled") {
    console.log(`Treff: ${kult.value.treff.length}`);
    if (kult.value.treff[0]) {
      console.log("Første treff (parsed):", {
        navn: kult.value.treff[0].navn,
        kategori: kult.value.treff[0].kategori,
        vernestatus: kult.value.treff[0].vernestatus,
      });
      console.log("Første treff (raw keys):", Object.keys(kult.value.treff[0].raw));
    }
  } else {
    console.error("Feil:", kult.reason);
  }

  console.log("\n=== Naturmangfold ===");
  if (natur.status === "fulfilled") {
    console.log(`Verneområder: ${natur.value.verneomrader.length}`);
    console.log(`Naturtyper: ${natur.value.naturtyper.length}`);
    if (natur.value.verneomrader[0]) {
      console.log("Første verneomrade (parsed):", {
        navn: natur.value.verneomrader[0].navn,
        verneform: natur.value.verneomrader[0].verneform,
      });
      console.log("Første verneomrade (raw keys):", Object.keys(natur.value.verneomrader[0].raw));
    }
    if (natur.value.naturtyper[0]) {
      console.log("Første naturtype (raw keys):", Object.keys(natur.value.naturtyper[0].raw));
    }
  } else {
    console.error("Feil:", natur.reason);
  }

  console.log("\n=== Flomsone ===");
  if (flom.status === "fulfilled") {
    console.log(`Treff: ${flom.value.flomsoner.length}`);
    console.log(`I aktsomhetsområde: ${flom.value.iAktsomhetsomraade}`);
    if (flom.value.flomsoner[0]) {
      console.log("Første treff (parsed):", {
        type: flom.value.flomsoner[0].type,
        vassdragsomraadeId: flom.value.flomsoner[0].vassdragsomraadeId,
      });
      console.log("Første treff (raw keys):", Object.keys(flom.value.flomsoner[0].raw));
    }
  } else {
    console.error("Feil:", flom.reason);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
