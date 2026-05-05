/**
 * Negativ test: gi grounding-funksjonen tekst som inneholder oppdiktede
 * sitater og verifiser at de flagges som unverified. Sjekker også at
 * ekte sitater verifiseres riktig.
 */
import { ground, extractCitations } from "../src/lib/grounding";

const FAKE_TEXT = `
Tiltaket må vurderes etter PBL § 99-99 og § 4-2.
Borgarting lagmannsrett HR-1900-1 fastslår at...
T-9999/2099 er den nye støyretningslinjen.
KU-forskriften § 6 gjelder her, jf. LB-2019-135154.
TEK17 § 13-6 og TEK99 § 99-99 stiller krav.
`;

function main() {
  const cits = extractCitations(FAKE_TEXT);
  console.log(`Ekstraherte ${cits.length} unike sitater:`);
  for (const c of cits) {
    console.log(`  [${c.type}] ${c.raw} → ${c.normalized}`);
  }

  const result = ground(FAKE_TEXT, []);
  console.log(`\nGrounding-resultat (uten chunks ⇒ kun corpus-sjekk):`);
  console.log(`  Total: ${result.totalCitations}`);
  console.log(`  Verified fra context: ${result.verifiedFromContext.length}`);
  console.log(`  Verified fra corpus: ${result.verifiedFromCorpus.length}`);
  console.log(`  Unverified: ${result.unverified.length}`);
  console.log(`  Coverage: ${(result.coverage * 100).toFixed(0)}%`);

  console.log(`\n✓ Verifisert (skal inneholde ekte sitater):`);
  for (const c of [...result.verifiedFromContext, ...result.verifiedFromCorpus]) {
    console.log(`  [${c.type}] ${c.normalized}`);
  }

  console.log(`\n⚠ Unverified (skal inneholde de oppdiktede):`);
  for (const c of result.unverified) {
    console.log(`  [${c.type}] ${c.normalized}`);
  }

  // Forventet utfall:
  //   Oppdiktet (skal flagges):
  //     §99-99 (PBL eksisterer ikke), HR-1900-1 (oppdiktet dom),
  //     T-9999/2099 (oppdiktet retningslinje), TEK99 (oppdiktet forskrift)
  //   Ekte og i korpus (skal verifiseres):
  //     §4-2 (PBL), §6 (PBL/KU), LB-2019-135154 (Borgarting), TEK17
  //   Ekte men UTENFOR korpus (skal flagges — vi kan ikke verifisere det):
  //     §13-6 (TEK17 lydforhold) — TEK17 er ikke ingestet
  //
  // Det siste tilfellet er forventet og verdifullt: grounding skal være
  // konservativ. "Ikke verifisert" betyr ikke "feil", men "må sjekkes
  // manuelt".
  const expectedUnverified = ["§99-99", "HR-1900-1", "T-9999/2099", "TEK99"];
  const actualUnverifiedNorms = result.unverified.map((c) => c.normalized);
  const missingFlags = expectedUnverified.filter(
    (e) => !actualUnverifiedNorms.includes(e)
  );
  if (missingFlags.length > 0) {
    console.error(`\nFEIL: Følgende oppdiktede sitater ble ikke flagget: ${missingFlags.join(", ")}`);
    process.exit(1);
  }

  const expectedVerified = ["§4-2", "LB-2019-135154", "TEK17"];
  const verifiedNorms = [
    ...result.verifiedFromContext.map((c) => c.normalized),
    ...result.verifiedFromCorpus.map((c) => c.normalized),
  ];
  const missingVerified = expectedVerified.filter((e) => !verifiedNorms.includes(e));
  if (missingVerified.length > 0) {
    console.error(`\nFEIL: Følgende ekte sitater ble ikke verifisert: ${missingVerified.join(", ")}`);
    process.exit(1);
  }

  console.log(`\n✅ Negativ test passerte: alle oppdiktede sitater ble flagget, kjente ekte sitater ble verifisert.`);
  console.log(`   Merk: § 13-6 (TEK17 lydforhold) ble også flagget. Det er forventet —`);
  console.log(`   TEK17 er ikke ingestet i korpuset, så vi kan ikke verifisere det lokalt.`);
}

main();
