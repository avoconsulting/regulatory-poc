# UI-evaluering for POC V1

*Møteagenda for evaluering av to design-mockups med designer og kollega.*

Mål: bestemme hvilken UI-retning vi går for, og hva som er V1-scope.

---

## 1. Hva utbygger faktisk skal beslutte

Sluttbruker er en utbygger eller ansvarlig søker som står foran spørsmålet:

> "Skal jeg bruke 6 måneder og 200k+ NOK på en reguleringsprosess på denne tomten — eller pivotere/avstå?"

Sekundære beslutninger som UI-en må støtte:

1. **Hvilken strategi skal jeg velge** (lav/moderat/høy risiko-profil)?
2. **Hvor skal jeg være mest forsiktig** (red flags i prioritert rekkefølge)?
3. **Hva skal jeg spørre PBE om i oppstartsmøtet**?
4. **Hva er det som faktisk taler i min favør** (oppsider)?
5. **Hvor mye av analysen kan jeg stole på** (grounding/uverifiserte sitater)?

UI-ens jobb er å gjøre svaret på #1 (samletRisikovurdering) umiddelbart synlig, og #2–5 raskt skannbart.

---

## 2. Reell datafrukt — Selma Ellefsens vei 1, Oslo

Dette er en faktisk kjøring av analyse-pipelinen 2026-05-05. Test-tilfellet er bevisst krevende: Oslo (sparse plandata fra nasjonale tjenester), bytransformasjon næring→bolig, ambisiøst volum.

**Tiltak inn:**
- Adresse: Selma Ellefsens vei 1, 0581 Oslo (gnr/bnr 122/378)
- Beskrivelse: Oppføring av leilighetsbygg på næringstomt — transformasjon fra næring/lager til bolig
- Byggehøyde: 21 m
- Utnyttelse: 70 %
- Bruksformål: Bolig (leiligheter), eventuelt med næring i 1. etasje
- Antall enheter: 45
- Parkering: Underjordisk garasje, 0,5 plasser per enhet

**Eksterne datakilder (parallelt, 3,6s):**
| Kilde | Antall treff |
|---|---|
| DiBK WMS (planomrader, planregister, bestemmelser) | 0 (typisk for Oslo) |
| Naboplaner (~100m radius) | 0 |
| Sted-kontekst (kulturminne, vern, naturtyper, flom) | 0 |
| Dispensasjonshistorikk (eInnsyn) | 20 treff (Selma Ellefsens vei 1, 4, 9, 11) |

**KU-trigger (21,3s):**
- Outcome: `must_assess` (konfidens medium)
- 3 triggere: 2× high, 1× medium
- Rasjonal: 1 paragraf

**Hovedanalyse (123,9s):**
- Samlet risiko: **HØY**
- Oppsummering: 1 avsnitt, 4 setninger
- 6 red flags (1 hard_stop, 5 dispenserbar)
- 3 strategier (lav, moderat, lav)
- 4 oppsider
- 6 anbefalinger
- 13 referanser
- Grounding: 3 ✓context + 10 ◐corpus + 1 ⚠unverified (coverage 93%)

**Total tid: 149 sekunder.**

### 2.1 Red flags som faktisk kommer ut

Hver flag har: tittel, alvorlighet (hard_stop / dispenserbar / akseptabel_risiko), bibliotekRef (matchet kuratert flagg #1–15), risikokategori (1 av 12), beskrivelse (3–6 setninger), hjemmel (1–3 paragraf-/dom-referanser), anbefaling (1–2 setninger).

| # | Tittel | Alvorlighet | bibliotekRef | risikokategori |
|---|---|---|---|---|
| 1 | Formålskonflikt: næring/lager vs. bolig krever reguleringsendring | hard_stop | #7 Urealistisk utnyttelse vs. plan/VPOR | Innholdsmessig risiko |
| 2 | KU-plikt: screening påkrevd ved reguleringsendring | dispenserbar | #13 Planfaglig svakhet | Juridisk risiko |
| 3 | Byggehøyde 21 m: konflikt med kommuneplan og nabolag | dispenserbar | #7 Urealistisk utnyttelse vs. plan/VPOR | Innholdsmessig risiko |
| 4 | Støy fra industri-/næringsnaboer | dispenserbar | #8 Støy/forurensningskonflikt | Miljø- og temabasert risiko |
| 5 | Rekkefølgekrav: infrastruktur og utbyggingsavtale | dispenserbar | #5 Kostbare rekkefølgebestemmelser | Rekkefølge- og gjennomføringsrisiko |
| 6 | Overvann og geoteknisk risiko | dispenserbar | #1 Mangelfull ROS | Miljø- og temabasert risiko |

**Merk**: To flagg matcher samme bibliotek-entry (#7). Designet må håndtere at flere flagg kan referere til samme kuraterte rang.

### 2.2 Eksempel på én red flag, full datastruktur

```json
{
  "tittel": "Rekkefølgekrav: infrastruktur og utbyggingsavtale",
  "alvorlighet": "dispenserbar",
  "bibliotekRef": { "rang": 5, "navn": "Kostbare rekkefølgebestemmelser" },
  "risikokategori": "Rekkefølge- og gjennomføringsrisiko",
  "beskrivelse": "Dispensasjonshistorikken viser at Selma Ellefsens vei 11 har hatt dispensasjon fra rekkefølgekrav (2021-09-30). Dette er et sterkt signal om at gjeldende eller kommende regulering vil ha rekkefølgebestemmelser knyttet til vei, VA og eventuelt sosial infrastruktur. Utbyggingsavtale med Oslo kommune vil sannsynligvis kreves, og kan inkludere bidrag til tiltak utenfor planområdet — noe Borgarting lagmannsrett har akseptert i transformasjonsområder i Oslo (LB-2019-135154).",
  "hjemmel": "PBL §§ 17-2 og 17-3 (utbyggingsavtaler), PBL § 12-7 nr. 10 (rekkefølgebestemmelser), LB-2019-135154",
  "anbefaling": "Avklar omfang av rekkefølgekrav og utbyggingsavtale i oppstartsmøte med PBE. Budsjetter for bidrag til felles infrastruktur — erfaringstall fra Oslo-transformasjoner ligger på 3 000–8 000 kr/m² BRA."
}
```

### 2.3 Strategier som faktisk kommer ut

Hver strategi har: navn, risikoprofil (lav/moderat/høy), beskrivelse (1–2 setninger), forventetUtfall (1 setning), anbefalteJusteringer (3–5 stikkord).

| Strategi | Risikoprofil | Anbefalte justeringer (antall) |
|---|---|---|
| Konform transformasjonsplan — lav profil | lav | 5 |
| Ambisiøs transformasjonsplan med forhandlingsrom | moderat | 5 |
| Etappevis tilnærming — næring først | lav | 5 |

**Merk**: To strategier kan ha samme risikoprofil. UI bør ikke anta unike farger per profil.

### 2.4 KU-vurdering (separat boks)

```json
{
  "outcome": "must_assess",  // eller "always_ku" / "no_trigger"
  "confidence": "medium",     // low / medium / high
  "rationale": "Tiltaket er en typisk bytransformasjon...",
  "triggers": [
    { "category": "formålsendring", "severity": "high", "description": "...", "sourceRef": "PBL § 4-2 andre ledd" },
    { "category": "størrelse", "severity": "high", "description": "...", "sourceRef": "KU-forskriften Vedlegg II..." },
    { "category": "berørte_interesser", "severity": "medium", "description": "...", "sourceRef": "PBL § 4-2..." }
  ],
  "contextSnapshot": { "relevantKilder": [...], "antallStedFlagg": 0 }
}
```

### 2.5 Grounding-data

```json
{
  "totalCitations": 14,
  "verifiedFromContext": 3,    // sterkt signal: AI så kilden i RAG-treff
  "verifiedFromCorpus": 10,    // svakere: finnes ellers i kunnskapsbasen
  "unverified": 1,             // potensielt hallusinasjon, sjekk manuelt
  "coverage": 0.93              // 93%
}
```

Den ene uverifiserte var `§ 13-6` (TEK17 lydforhold) — reell men TEK17 ikke ingestet.

---

## 3. Tilstander designet MÅ håndtere

Et design som ser pent ut for "happy path Selma" kan kollapse på første kant. Sjekk eksplisitt at hver mockup har et klart svar for:

### Variasjon i mengde

| Felt | Min observert | Maks rimelig | Kollapse-risiko |
|---|---|---|---|
| Red flags | 1–2 (enkle tilfeller) | 6 (vi caps i prompt) | Liste-design vs kort-design |
| Strategier | 2 | 3 (caps) | "3 kort side-ved-side" — fungerer på mobil? |
| Oppsider | 0 | 4 (caps) | Hva om det er 0? |
| Anbefalinger | 3 | 6 (caps) | Litt vs mye whitespace |
| Referanser | 5 | 15+ | Fold/expand? |
| Triggere (KU) | 0 (no_trigger) | 5+ | Tom seksjon? Skjul? |
| Naboplaner | 0 (Oslo) | 5+ (Trondheim sentrum) | Gjelder kun ~200 av ~356 kommuner |
| Dispensasjoner | 0 | 50+ (eInnsyn-treff) | Liste blir veldig lang |

### Variasjon i innhold

- **alvorlighet**: hard_stop (rødt), dispenserbar (gult/oransje), akseptabel_risiko (grønt). Designet må ha tre tydelige visuelle nivåer.
- **KU outcome**: `always_ku` (kritisk), `must_assess` (advarsel), `no_trigger` (ok). Tre klare states.
- **bibliotekRef**: present (vis bibliotek-badge) vs null (vis "egendefinert"-badge eller ingenting?).
- **risikokategori**: 12 forskjellige kategorier — bør vises som filtrerbar taksonomi eller bare badge per flagg?
- **plandata**: full (Bergen) vs tom (Oslo) — designet må eksplisitt håndtere "vi har ikke plandata for denne kommunen, her er hva du må sjekke selv".

### Lasting og feil

- **Lasting tar 2–3 minutter** på ekte kjøring (123–149s for Selma). Den eksisterende loading-meldingen sier "15–30 sekunder" og det er løgn. Hva viser designet?
  - Forslag: progress-steg (1/4 Henter plandata… 2/4 KU-vurdering… 3/4 Risikoanalyse… 4/4 Citation grounding…)
  - Eller fortløpende streamede deler (KU først, så hovedanalyse)
- **Feilstater**: nettverksfeil, JSON-parse fail, "AI-svaret avkortet". Hva ser brukeren?
- **Tom respons**: hva hvis Anthropic returnerer et tomt array? (Skjer aldri i praksis, men hvordan ser det ut?)

### Grounding-coverage

| Coverage | Indikator | Hva designet bør si |
|---|---|---|
| 100% | Grønn | "Alle sitater er forankret" |
| 70–99% | Gul | "X uverifiserte sitater — sjekk manuelt" |
| <70% | Rød | "Lav forankring — dette bør valideres av fagperson" |

---

## 4. Sjekkliste — felter designet MÅ rendere

Gå gjennom hver designmockup og marker ✓ for hva som er tydelig synlig, ⚠ for hva som er der men begravet, ✗ for hva som mangler.

### Eiendomsoverskrift
- [ ] Adressetekst (Selma Ellefsens vei 1)
- [ ] Postnummer + poststed (0581 Oslo)
- [ ] Kommune + kommunenummer (Oslo, 0301)
- [ ] Gnr/Bnr (122/378)
- [ ] Lat/Lon eller kart (valgfritt)

### Headline-vurdering (det første brukeren ser)
- [ ] samletRisikovurdering med tydelig farge (lav/moderat/høy/kritisk)
- [ ] Oppsummering (1 avsnitt)
- [ ] KU-outcome (must_assess / always_ku / no_trigger) som badge
- [ ] Antall red flags
- [ ] Antall hard_stops (er det blockers?)
- [ ] Estimert prosesstid hvis tilgjengelig (V2)

### Per red flag
- [ ] Tittel
- [ ] Alvorlighet (visuelt distinkt)
- [ ] bibliotekRef-badge (hvis matchet)
- [ ] risikokategori-badge
- [ ] Beskrivelse (3–6 setninger — ikke avkortes!)
- [ ] Hjemmel (lov/dom-referanser)
- [ ] Anbefaling (uthevet — det handlingsrettede)

### Per strategi
- [ ] Navn
- [ ] Risikoprofil (lav/moderat/høy som tag)
- [ ] Beskrivelse
- [ ] Forventet utfall
- [ ] Anbefalte justeringer (liste, 3–5 punkter)

### Per oppside
- [ ] Tittel
- [ ] Beskrivelse (kortere enn red flags, typisk 1–2 setninger)
- [ ] Hjemmel
- [ ] Potensial

### KU-vurdering
- [ ] Outcome-badge (always_ku / must_assess / no_trigger)
- [ ] Konfidensnivå (high/medium/low)
- [ ] Rasjonal (1 avsnitt)
- [ ] Triggere som liste, hver med severity, kategori, description, sourceRef

### Anbefalinger
- [ ] Nummerert liste, prioritert rekkefølge

### Referanser brukt
- [ ] Liste over kilder AI har sitert
- [ ] Bør være sammenklappbar — kan være mange (15+)

### Grounding (hvis V1)
- [ ] Coverage-prosent som indikator
- [ ] Antall verifisert vs uverifisert
- [ ] Hvilke sitater er uverifiserte (markert i hver red flag/oppside?)

### Naboplaner (kun ~200 kommuner)
- [ ] "Tilliggende reguleringsplaner" som egen seksjon
- [ ] Per nabo: plannavn, plantype, planstatus, planID
- [ ] Forklarende tekst om at disse kan binde tiltaket
- [ ] Tom-state hvis 0 (Oslo)

### Dispensasjonshistorikk
- [ ] Journalposter fra eInnsyn (typisk 5–20)
- [ ] Per post: tittel, dato, link til eInnsyn
- [ ] Kan være lang — fold/expand?

---

## 5. Beslutningsspørsmål per seksjon

For hver designmockup, gå gjennom de viktigste seksjonene og spør:

### Headline
- Ser brukeren risikovurderingen *før* alt annet, eller må de scrolle?
- Er hard_stop synlig over folden? (kritisk for go/no-go-beslutningen)
- Hvor lenge tar det å lese: "skal jeg satse 6 mnd og 200k på dette?"

### Red flag-listen
- Kan brukeren skanne 6 flagg på 30 sekunder?
- Er hierarkiet riktig: tittel → alvorlighet → kategori → detalj?
- Funker det med 1 flagg? Med 6? Med 0 (sjeldent men teoretisk)?
- Er bibliotek-badge subtilt nok til ikke å konkurrere med tittel?

### KU-vurdering
- Skiller den seg tydelig fra red flags? (KU er ikke en red flag, det er en formell vurdering)
- Hvis outcome er `no_trigger`, kollapses seksjonen, eller vises det at KU er sjekket?

### Strategier
- Side-ved-side eller stablet?
- Funker det på mobil med 3 strategier?
- Er forskjellen i risikoprofil tydelig?

### Lasting
- Hva ser brukeren i 2–3 minutter mens AI tenker?
- Er det progress-steg, eller bare en spinner?
- Kan brukeren avbryte?

---

## 6. MoSCoW for V1

Filtrér de to designmockupene gjennom dette — V1 skal ha alt under MUST, prøve å ha SHOULD, ignorere COULD, og parkere WON'T.

### MUST (uten dette er det ikke en demo-bar POC)

- Adressesøk via Kartverket (autocomplete)
- Tiltakskjema (beskrivelse, høyde, utnyttelse, bruksformål, enheter, parkering, annet)
- Lasting med ærlig tidsindikator (2–3 min)
- Resultatside: samletRisikovurdering (headline) + oppsummering
- Red flags rendret med alvorlighet, beskrivelse, hjemmel, anbefaling
- KU-vurdering med outcome-badge og triggere
- Strategier med risikoprofil og anbefalte justeringer
- Anbefalinger som nummerert liste
- "Start på nytt"-knapp

### SHOULD (gir kvalitet, men kan kuttes hvis tid)

- bibliotekRef-badge per red flag (kobler til kundens fagvurdering)
- risikokategori-badge per red flag
- Oppsider-seksjon
- Referanser-liste (foldet ut)
- Grounding coverage-indikator (uten per-sitat-detaljer)
- Naboplaner-seksjon (kun synlig hvis > 0)
- Dispensasjonshistorikk (foldet ut, kun 5 første)

### COULD (V1.5)

- Filtrer red flags etter risikokategori
- Kart-visning (lat/lon, naboplan-overlapp)
- Eksporter analyse til PDF
- Per-sitat grounding-status (markering i tekst)
- Sammenligning av strategier i tabellform

### WON'T (V2 eller senere)

- Prosjekt-historikk og lagrede analyser (krever auth-flow)
- Sammenligning av analyser over tid
- Multi-bruker / teams
- Brukerstyrt kommentering
- Integrert kart med tegning av bygningsfotavtrykk

---

## 7. Beslutninger vi skal ta i møtet

1. **Hvilken designmockup går vi for?**
   - Kriterier (i rekkefølge): (a) håndterer ekte data uten å bryte, (b) prioriterer headline-beslutningen, (c) skalerer til 6 red flags og 3 strategier, (d) realistisk innenfor 175h budsjett.

2. **Hva ligger i V1 vs senere?**
   - Bruk MoSCoW i §6 som utgangspunkt. Stryk ting fra MUST hvis tid presser.

3. **Hvordan håndterer vi 2–3 min lastetid?**
   - Statisk spinner, progress-steg, eller streamet rendering?

4. **Hvor mye av rådata skal vi vise?**
   - Skal grounding-detaljer være med, eller bare en sammendrags-prosent?
   - Skal alle 20 dispensasjoner vises, eller topp 5?

5. **Hvordan ser tom-state for Oslo ut?**
   - Vi har 0 plandata fra DiBK for Oslo. Skal designet eksplisitt vise dette og forklare?

6. **Mobil — krevd for V1, eller desktop-first?**
   - Avgjør tidlig — påvirker valg av strategi-layout (side-ved-side vs stablet).

---

## Vedlegg: Hele Selma-output som test-case

Bruk denne for å manuelt rendere mot mockupen — punkt for punkt. Full output ligger i `/tmp/selma-allthree.log` etter siste kjøring av `npx tsx scripts/test-selma.ts`. Kjør på nytt om dataen trengs oppdatert.

For andre test-tilfeller:
- **Trondheim Munkegata 1**: vil vise naboplaner-seksjon (3 reelle naboplaner)
- **Bergen-adresse**: vil ha full plandata fra DiBK
- **Adresse i flomsone (NVE)**: vil utløse sted-kontekst-flagg

Be Tom (eller bruk lokalkart) for å finne en adresse som garantert utløser hvert tilfelle, så designet stress-testes mot reelle states.
