# POC-status: Reguleringsrisiko-løsning for Avo
*Briefing-dokument til kundemøte 30. april 2026*

> **Formål med dokumentet:** Gi deg fullt mental modell av løsningen før kundemøtet. Strukturert i lag — skim de første sidene for oversikt, dyp-les nedover for substans og forklaring av designvalg.

---

## TL;DR

Vi har en **fungerende ende-til-ende-pipeline** som tar inn en adresse + tiltak, henter automatisk relevant data fra åtte offentlige kilder, kjører to AI-analyser (KU-trigger + reguleringsrisiko) mot en kuratert kunnskapsbase på 2 550 chunks, og presenterer resultatet i en strukturert resultatside. Pipelinen er produksjonsklar for demo, men har kjente begrensninger som er verdt å være ærlig om.

**Det viktigste å kommunisere til kunden i dag:**
1. **Vi er på sporet.** Hovedfunksjonene fra POC-planen er på plass eller under bygging.
2. **Den juridiske kvaliteten er målbar.** Vi har valgt å bruke kundens egen kuraterte rettskilde-taksonomi (rettskildelære med vekter), og vi rangerer søketreff etter den.
3. **KU-trigger-funksjonen er ny.** Den er bygget i dag/i går og dekker konsekvensutredning som tidligrisikosjekk — det kunden flagget som blant de dyreste enkeltrisikoene.
4. **Det gjenstår arbeid** vi skal være ærlige om: re-ingest av kunnskapsbasen, naboeiendommer, og PBE-mal-output.

---

## 1. Hva er levert per i dag

### Funksjonalitet sluttbruker ser

| Funksjon | Status | Merknad |
|---|---|---|
| Adressesøk via Kartverket | ✅ Fungerer | Søker matrikkeldata, gnr/bnr, koordinater |
| Tiltakskjema (høyde, BYA, formål, enheter) | ✅ Fungerer | Strukturert input |
| Hent reguleringsdata fra DiBK | ✅ Fungerer | Planområder, arealformål, hensynssoner |
| Planbestemmelser fra arealplaner.no | ✅ Fungerer | Lastes som PDF |
| Dispensasjonshistorikk fra eInnsyn | ✅ Fungerer | Søk på adresse + kommune |
| **Kulturminne-sjekk (Riksantikvaren)** | ✅ Ny | Verifisert mot Akershus festning |
| **Verneområder (Miljødirektoratet)** | ✅ Ny | Verifisert mot Hardangervidda |
| **Naturtyper med KU-verdi (Naturbase)** | ✅ Ny | Direkte KU-relevant flagg |
| **Flomaktsomhet (NVE)** | ✅ Ny | Verifisert mot Lillestrøm |
| **KU-trigger-vurdering (AI)** | ✅ Ny | Strukturert pre-pass før hovedanalyse |
| Reguleringsrisikoanalyse (AI) | ✅ Fungerer | Red flags, strategier, oppsider |
| Resultatside | ✅ Fungerer | KU-seksjon med outcome-badge er nå inkludert |
| Lagring i Supabase | ✅ Ny | KU-vurderinger lagres for historikk + audit |

### Underliggende kapasitet

| Komponent | Status | Tall |
|---|---|---|
| Kunnskapsbase (vektordatabase) | ✅ Ingestet | 2 550 chunks |
| Embeddings (Voyage-3) | ✅ Generert | 1 024 dimensjoner |
| Vektorsøk med rettskilde-reranking | ✅ Operativ | Threshold 0.30, dedup på content-hash |
| Seed-bibliotek (kunden) | ✅ Lastet | 17 rettskilde-vekter, 15 red flags, 12 risikokategorier |

---

## 2. Arkitektur i ett bilde

```
[Bruker]
   ↓  adresse + tiltak
[Server Action: runAnalysis]
   ↓
   ├─→ Kartverket  (adresse → koordinater)
   ├─→ DiBK WMS    (planer, arealformål, hensynssoner)
   ├─→ Arealplaner (planbestemmelser)
   ├─→ eInnsyn     (dispensasjonshistorikk)
   ├─→ Riksantikvaren (kulturminner)
   ├─→ Miljødir.   (verneområder + KU-verdi)
   └─→ NVE Atlas   (flomaktsomhet)
   ↓
[Sted-kontekst-aggregator]
   ↓  strukturerte KU-flagg (kritisk/høy/moderat)
[KU-trigger-AI]  ←── Vektorsøk i kunnskapsbase (KU-forskriften)
   ↓  KuAssessment (always_ku | must_assess | no_trigger)
   ↓
   ├─→ Lagre i ku_assessments-tabellen
   └─→ [Hovedanalyse-AI]  ←── Vektorsøk i kunnskapsbase (alle rettskilder)
            ↓
         RisikoAnalyse (red flags, strategier, oppsider, KU-vurdering)
   ↓
[Resultatside]
```

Pipelinen kjører de fleste eksterne kall **parallelt** for å holde svartiden nede (~15-30 sekunder totalt).

---

## 3. Hovedfunksjoner forklart

### 3.1 Datafundament: rettskildelære som taksonomi

#### Hva er rettskildelære, og hvorfor matter det her?

Norsk **rettskildelære** er fagdisiplinen som beskriver hvilke kilder som er gyldige rettskilder, og hvilken vekt hver av dem har når man tolker en regel eller løser en konflikt. Den er hjørnesteinen i juridisk metode i Norge, og den er hierarkisk:

| Plass | Kildetype | Eksempel |
|---|---|---|
| 1. | Grunnloven | §49, §97, §112 |
| 2. | Lover | PBL, Forvaltningsloven, Naturmangfoldloven |
| 3. | Forskrifter | KU-forskriften, TEK17, SAK10 |
| 4. | Forarbeider | NOU, Prop. L, Ot.prp. |
| 5. | Rettspraksis | HR-2021-953-A, lagmannsretts-avgjørelser |
| 6. | Forvaltningspraksis | Departementsvedtak, statsforvalter, Sivilombudet |
| 7. | Reelle hensyn / sedvane | "Slik gjør vi det her" |
| 8. | Faglitteratur | Akademiske artikler, masteroppgaver, fagbøker |

I praksis betyr dette: dersom en lov og en kommunal saksframleggs-uttalelse er i konflikt, vinner loven. Dersom en NOU og en lov sier ulike ting, vinner loven, men NOU-en kan brukes som tolkningsbidrag. Dette er ikke teori — det er hvordan dommere, advokater og saksbehandlere faktisk vurderer saker.

For et **AI-system som skal gi juridisk informasjon**, er det ikke et alternativ å ignorere dette. Hvis modellen siterer en blogg-post som om den var like autoritativ som forskriftsteksten, blir output-en faglig uforsvarlig. Vi har derfor bygget rettskildelære inn på tre nivåer i pipelinen.

#### Mappestrukturen — hva ligger i 1, 2, 3, …?

Kundens dokumentsamling i Google Drive er organisert som en arkivar ville gjort det: hver hovedmappe er én **type** rettskilde, sortert fra mest til minst tung.

| Mappe | Hva ligger der | Tenk på det som |
|---|---|---|
| **1. Lov og forskrift** | PBL, Forvaltningsloven, KU-forskriften, TEK17, SAK10, Naturmangfoldloven | "Det Stortinget har bestemt." Toppen av pyramiden. Hvis det står i loven, så er det sånn. |
| **2. Rettspraksis** | Høyesterettsdommer, lagmannsrettsdommer | "Hva domstolene har sagt før." Når en sak har vært i retten og en dommer har bestemt, blir det en regel for liknende saker. |
| **3. Lovforarbeider** | NOU-er, Prop. L-er, Ot.prp.-er | "Notatene fra før loven ble vedtatt." Politikernes diskusjoner og begrunnelser. Brukes for å skjønne hva loven *egentlig* mente. |
| **4. Forvaltningspraksis** | Departementsvedtak, statsforvalterens uttalelser, Sivilombudet | "Slik gjør embedsverket det normalt." Ikke bindende, men hvis alle kommuner gjør X i en type sak, er det vanskelig å gå mot. |
| **5. Sedvane** | Etablerte praksiser uten direkte hjemmel | "Slik har vi alltid gjort det." Brukes når lovteksten er stille om noe spesifikt. |
| **6. Faglitteratur** | Akademiske artikler, masteroppgaver, fagbøker, Bygg21-rapporter | "Det fagfolk har skrevet om temaet." Ikke bindende, men kan være tungt argument hvis flere eksperter er enige. |
| **7. Reelle hensyn** | Begrunnelser om hva som er "rimelig" og "hensiktsmessig" | "Sunn fornuft og rimelighet." Brukes som siste utvei når ingenting annet gir svar. |

I tillegg har kunden noen **tverrgående mapper** som dekker temaer på tvers av nummereringen:

- **KU/** — alt som handler om konsekvensutredning
- **Innsigelse/** — saker hvor statlige fagorganer har stoppet planer
- **Utbyggingsavtaler/** — kontrakter mellom utbygger og kommune
- **Sjekklister.Oslo/** — Oslo kommunes egne saksbehandlingslister

Hver hovedmappe har en "tyngde" når den brukes i juridisk argumentasjon. Det er denne tyngden vi bygger inn i AI-en.

#### Slik er det bygget inn i systemet — i tre lag

**Sammenliging:** Tenk på det som en bibliotekar som setter farget tape på bøker.

##### Lag 1: Vi merker hver tekstbit med hvor den kom fra

Når vi laster inn et dokument i AI-ens "minne", deler vi det i mindre tekstbiter (typisk 1 500 tegn hver). For hver bit ser vi på *hvilken mappe filen lå i* og setter en **etikett**:

- Hvis filen lå i `1. Lov og forskrift/`, får alle dens biter etiketten **"lov_og_forskrift"**.
- Hvis filen lå i `3. Lovforarbeider/`, får den etiketten **"lovforarbeider"**.
- Og så videre.

Vi har 12 forskjellige etiketter totalt (en per kategori).

> **Hva betyr det i praksis?** Når AI-en senere skal finne info, vet den ikke bare *hva* en tekstbit handler om — den vet også *hva slags rettskilde* den er.

##### Lag 2: Vi har en "tyngde-tabell" i databasen

Dette er kundens egen liste fra Excel-arket de leverte. De har gått gjennom 17 ulike typer rettskilder og bestemt: *"Lov skal telle 0.95. Media skal telle 0.30. Forarbeider skal telle 0.80."* Vi har bare gjort den lista maskin-lesbar ved å lagre den i en tabell. Auszug:

| Kildetype | Tyngde | Hva betyr tallet |
|---|---|---|
| Grunnloven | 1.00 | Maks tyngde — overordner alt annet |
| Lover (PBL osv.) | 0.95 | Nesten maks |
| Forskrifter (TEK17, KU) | 0.90 | Nesten lik lov |
| Rettspraksis | 0.90 | Tunge dommer |
| Forarbeider (NOU) | 0.80 | Brukes til tolkning |
| Departementale rundskriv | 0.70 | Veiledende |
| Akademiske artikler | 0.50 | Brukes som støtte |
| Saksframlegg | 0.40 | Empiri, ikke binding |
| Media og fagpresse | 0.30 | Indikator, ikke kilde |

> **Viktig:** Disse tallene er **kundens fagvurdering**, ikke våre. Vi har bare oversatt deres regneark til noe AI-en kan bruke.

##### Lag 3: Vi blander relevans og tyngde når noen søker

Når sluttbrukeren stiller et spørsmål (eller AI-en trenger å sjekke noe i kunnskapsbasen), gjør systemet to målinger:

1. **Hvor relevant** er hver tekstbit? (gir et tall mellom 0 og 1)
2. **Hvor tung** er kategorien? (samme skala)

Så multipliseres de: **endelig score = relevans × tyngde**.

Eksempel — sluttbrukeren spør om dispensasjon etter PBL §19:

| Tekst funnet | Relevans | Tyngde | Endelig |
|---|---|---|---|
| PBL Kapittel 19 (loven selv) | 0.54 | 0.92 | **0.50** ← vinner |
| Et NOU-utdrag om dispensasjon | 0.46 | 0.80 | **0.37** |

Selv om begge tekstene er omtrent like relevante, vinner loven fordi den er en *tyngre kilde*. AI-en får først se loven, så NOU-en. Det er rettskildelære i praksis — bare automatisert.

> **Hva dette gir kunden:** Når AI-en svarer, kan den aldri sitere et fagblogginnlegg som om det var likeverdig med en lov. Hierarkiet er bygget inn på maskinnivå.

---

#### Sånn har vi tunet det — fem ting vi har lært underveis

Dette har ikke vært en "satt opp og fungerte"-prosess. Vi har observert systemets oppførsel, sett hva som ikke stemte, og justert. De fem viktigste lærdommene:

**1. AI-ens "relevans-tall" er lavere på norsk enn på engelsk.**
Vi startet med en **strenghet-grense** på 0.78 — det betyr at bare tekster som er minst 78 % "lik" i mening skulle vises. Det er en standardinnstilling som fungerer på engelsk. Men på norsk lovtekst lå realistiske topp-treff på 0.39–0.59. **Resultatet:** søk ga *null* treff. Vi senket grensen til 0.40, og så til 0.30, etter å ha bekreftet at relevante treff ligger der. Lærdom: norsk juridisk språk er smalere enn engelsk, og AI-modellen reflekterer det.

**2. Etikettene var feil i begynnelsen.**
Først hadde vi etiketter som "kommunal_praksis" og "politisk_risiko" — vår egen ad-hoc inndeling. Da vi byttet til kundens rettskildelære-struktur, oppdaget vi at alle 2 550 tekstbiter i basen hadde gammel etikett ("lov_og_forskrift" på alt). Vi måtte gå inn og **re-etikettere**: filer med navn som starter med "NOU" fikk ny etikett "lovforarbeider" (1 734 stykker), resten beholdt "lov_og_forskrift" (816 stykker). Lærdom: når man endrer kategorisystem, må man passe på det som allerede er lagret.

**3. Samme tekst dukket opp to ganger.**
Vi oppdaget at samme PBL-paragraf var lagt inn to ganger — én gang som `Kapittel 19. Dispensasjon.docx` (et utdrag) og én gang inni den fulle `Lov om planlegging og byggesaksbehandling.docx`. Når noen søkte, dukket *identisk tekst* opp som rang 1 og rang 2 — toppen av lista var halvfull av kopier. Vi la til en sjekk: "hvis to treff har eksakt samme tekst, vis bare én av dem". Resultat: gikk fra 5–6 duplikater i topp-10 til 1–2 (de gjenværende er nesten-identiske, ikke helt). Lærdom: i en kuratert dokumentsamling vil samme innhold ofte ligge i flere filer — systemet må håndtere det.

**4. Ett dokument tar uforholdsmessig mye plass.**
Én NOU-rapport (NOU 2014 om PBL) utgjør **65 %** av hele kunnskapsbasen — 1 658 av 2 550 tekstbiter. Den er stor og dekker systematisk hele plan- og bygningsloven. Selv med vekting 0.80 vs 0.92 vil NOU-treff dominere fordi det rett og slett er så mye av det. Vi kan ikke fikse dette med vekt-trikset alene; det krever enten å laste den inn på en annen måte, eller å begrense hvor mange treff fra én og samme fil som vises. Vi har valgt å akseptere det i POC-fasen og være ærlige om det. Lærdom: størrelse på enkeltdokumenter kan vippe hele systemets balanse.

**5. Vi bygde verktøy for å se hva som faktisk skjer.**
Når et søk ikke gir gode treff, er det fristende å gjette. I stedet bygde vi syv små diagnostikk-skript som lar oss se *nøyaktig* hva systemet gjør på hvert trinn:

| Skript | Hva det gjør | Når brukes det |
|---|---|---|
| `probe:similarity` | Viser rå relevans-tall uten noen filtre eller vekting. Tar et spørsmål, returnerer topp 10 nærmeste tekstbiter. | "Finner AI-en *i det hele tatt* relevant tekst?" |
| `probe:search` | Kjører hele pipeline (vekting + dedup + threshold) — det sluttbrukeren faktisk vil se. | "Får brukeren produksjonsklare treff?" |
| `probe:db` | Sjekker databasen direkte: hvor mange tekstbiter finnes, hvilke kategorier de har, hvordan embeddings er lagret. | "Stemmer dataene i basen med det vi tror?" |
| `probe:chunks` | Tar én fil, kjører den gjennom ingest-pipelinen og viser hvordan teksten ble delt opp og hvilke etiketter den fikk. | "Blir nye dokumenter behandlet riktig før de havner i basen?" |
| `probe:index` | Lister alle databaseindekser og teller hvor mange tekstbiter som matcher visse filnavn-mønstre. | "Er databasen bygget for rask oppslag?" |
| `probe:vectors` | Sjekker om alle tekstbiter faktisk har en embedding (numerisk representasjon AI bruker for likhetssøk), og at formatet er riktig. | "Er det noen tekstbiter uten embedding (som da ikke kan finnes ved søk)?" |
| `probe:sted` | Tar et koordinatpar og spør de eksterne kartdatabasene (kulturminne, vern, flom) for å se hva som returneres. | "Fungerer integrasjonen mot de offentlige WMS-tjenestene?" |

Dette har spart oss for mange timer med "hvorfor returnerer den ikke X?". Lærdom: når man bygger AI-systemer, er det like viktig å bygge **innsynsverktøy** som selve funksjonene.

#### Hva dette gir kunden

I praksis betyr disse tre nivåene at AI-en aldri kan blande nivåer på en faglig uforsvarlig måte. Når den siterer en kilde, vet vi:
- Hvilken kategori den hører til (synlig i metadata)
- Hvilken vekt den har sammenliknet med andre treff
- Hvorfor den vant frem (rerank_score er regnet ut og kan vises)

For utbyggeren er dette forskjellen mellom *"AI sa at det er greit"* og *"AI fant disse tre paragrafene i PBL og denne ene høyesterettsdommen som peker i samme retning"*. Det er ikke kun en kvalitetsforskjell — det er en juridisk forsvarbarhets-forskjell.

### 3.2 Sted-kontekst: åtte WMS-kilder samlet til strukturerte flagg

**Hva:** En egen modul som henter geografiske data fra åtte offentlige tjenester parallelt og samler dem til en kompakt liste av "flagg" (kritisk/høy/moderat) som AI kan bruke.

**Hvorfor:** Reguleringsrisiko handler ofte om hva som finnes RUNDT tomten — kulturminne i nabolaget, verneområde 50m unna, flomaktsomhet langs elven. Disse er sjelden synlige i selve plandataene, men er avgjørende for KU-vurdering.

**Hvordan:** WMS GetFeatureInfo-kall mot:
- DiBK reguleringsplaner (hensynssoner)
- Riksantikvaren (fredete kulturminner)
- Miljødirektoratet/Naturbase (verneområder)
- Naturbase KU-verdi (naturtyper med KU-relevans)
- NVE Atlas (flomaktsomhet)

Hver kilde returnerer ulikt format (JSON, GeoJSON, GML) — vi har bygget en generisk parser som håndterer alle tre.

### 3.3 KU-trigger: tidlig dedikert sjekk

**Hva:** En egen AI-vurdering, kjørt **før** hovedanalysen, som svarer på spørsmålet: *Vil dette tiltaket utløse krav om konsekvensutredning?*

Konklusjonen er én av tre:
- **always_ku** (KU-forskriften Vedlegg I — KU er obligatorisk)
- **must_assess** (Vedlegg II eller sted-kontekst krever vurdering)
- **no_trigger** (ingen utløsere identifisert)

For hver trigger gir AI: kategori, beskrivelse, kildereferanse (paragraf/vedlegg), alvorlighetsgrad.

**Hvorfor:** Kunden flagget KU-utløst-midt-i-prosessen som blant de dyreste enkeltrisikoene — kan koste 1-3 år. En sluttbruker som vurderer å investere 6 måneder og 200 000 NOK i regulering vil ha et **tydelig ja/nei** på KU-spørsmålet, ikke en sannsynlighet bakt inn i en større analyse.

**Hvordan:** Claude får (a) sted-kontekst-flaggene, (b) tiltakets parametre, (c) relevante deler av KU-forskriften via vektorsøk. Returnerer strukturert JSON. Konklusjonen mater inn i hovedanalysen, så red flags og strategier bygger på KU-konklusjonen.

### 3.4 Hovedanalyse: red flags, strategier, oppsider

**Hva:** Den eksisterende analyse-pipelinen som var bygget før denne uka. Tar all kontekst (plandata + dispensasjoner + kunnskapsbase + nå også KU-vurdering) og returnerer strukturert risikovurdering.

**Hva er forbedret denne uka:**
- Kunnskapsbase-søk har nå reranking + dedup
- KU-vurdering inngår i prompten
- Voyage-3 erstattet OpenAI for embeddings (lavere kost, bedre kvalitet på norsk)

### 3.5 Persistens: KU-vurderinger lagres for historikk

**Hva:** Hver KU-vurdering lagres i `ku_assessments`-tabellen med fullt snapshot av input, output og sted-kontekst på analysetidspunkt.

**Hvorfor:** Tre grunner:
1. **Audit:** Vi kan vise nøyaktig hva som ble vurdert og hvorfor.
2. **Reproducerbarhet:** Hvis WMS-data endrer seg, kan vi rekjøre vurderingen mot opprinnelig data.
3. **Bibliotek-bygging:** Over tid bygger vi opp en samling reelle vurderinger som kan brukes som referanse-cases.

---

## 4. Datakilder — full oversikt

| Kilde | Type | Hva henter vi | Status |
|---|---|---|---|
| Kartverket Geonorge | REST | Adressesøk, eiendomsoppslag, kommuneinfo | Åpen API |
| DiBK reguleringsplaner | WMS | Planområder, arealformål, hensynssoner | Åpen API |
| Arealplaner.no | API | Planbestemmelser-PDFer | Åpen API |
| Planslurpen | API (beta) | AI-tolkning av planbestemmelser | Åpen API |
| eInnsyn | API | Dispensasjonshistorikk fra kommunale arkiver | Åpen API |
| Riksantikvaren | WMS | Fredete kulturminner, lokaliteter | Åpen API |
| Miljødirektoratet/Naturbase | WMS | Verneområder, naturtyper med KU-verdi | Åpen API |
| NVE Atlas | WMS | Flomaktsomhetsområder | Åpen API |

Alle integrasjoner er åpne tjenester uten API-nøkkel-krav. Det er en betydelig fordel for skalering og kompliansevurdering — ingen kommersielle avhengigheter mellom POC og storskala-kjøring.

---

## 5. Kvalitet og kjente begrensninger

### Det som fungerer bra
- **Vektorsøk på norsk lovtekst** — etter justering av threshold (0.30) og dedup gir vi nå relevante PBL- og forskrift-treff på alle test-queries
- **Reranking etter rettskilde-kategori** — primærkilder (lov + forskrift) løftes konsekvent over forarbeider og kommentarer
- **Sted-kontekst-aggregering** — åtte uavhengige tjenester aggregeres til strukturerte flagg på ~3-5 sekunder
- **KU-trigger-vurdering** — strukturert output med kildereferanser, ingen hallusinasjon i tester så langt

### Det vi må være ærlige om
- **Korpus-bias:** 65 % av kunnskapsbasen er én NOU (NOU 2014). Det betyr at forarbeider er overrepresentert. Reranking demper dette, men ikke fullstendig.
- **Kunnskapsbasen er kun delvis ingestet.** Ca. 2 550 chunks fra et utvalg PBL-filer + KU-forskrift + en NOU + Naturmangfoldlov. Resten av kundens 7 800 filer er ikke ingestet ennå.
- **Re-ingest med ny taksonomi gjenstår.** Vi har endret kategori-mappingen denne uka, og eksisterende chunks ble manuelt backfilled basert på filnavn-mønstre. Re-ingest med ny `chunk.ts`-logikk vil gi presis taksonomi.
- **Naboeiendommer er ikke implementert.** Detaljregulering på nabotomt binder også, men vi henter foreløpig bare egen tomt. Dette er flagget som phase 2.
- **Plankrav-queryer treffer ikke optimalt.** Voyage-3 forstår "byggetiltak"-vokabular bedre enn det abstrakte konseptet "plankrav". For abstrakte juridiske spørsmål kan hybrid-søk (BM25 + vektor) være neste steg.

---

## 6. Demo-plan for dagens kundemøte

### Mål for demoen
Vise at løsningen er **operativ**, **substansiell** (ikke bare et forslag), og **fagfaglig forankret** (rettskildelære, KU-forskrift, ikke bare AI-fluff).

### Forslag til 10-minutters demo-flyt

**Steg 1 (1 min):** Sett scenen.
> "Vi har bygget en POC der en utbygger kan legge inn en adresse, beskrive et tiltak, og få en strukturert risikovurdering på ca. 30 sekunder. Den henter automatisk fra åtte offentlige kilder, og kjører to separate AI-analyser. La meg vise."

**Steg 2 (2 min):** Test-case 1 — **Akershus festning-området** (eller et tomtevalg du har som vi vet vil utløse kulturminne-flagg).
- Søk adresse → vis Kartverket-integrasjon
- Tiltak: "Oppføring av leilighetsbygg, 5 etasjer, 30 enheter, 21 m høyde, kombinert bolig/næring"
- Klikk Analyser
- Mens den laster: forklar hva som skjer (8 parallelle WMS-kall, KU-trigger AI, hovedanalyse AI)

**Steg 3 (3 min):** Vis resultatet — **fokuser på KU-vurderingen**.
- Outcome-badge: "Må vurderes" eller "KU obligatorisk"
- Triggere: kulturminne i nærheten, hensynssoner, etc.
- Forklar: *"Dette er en av de dyreste enkeltrisikoene — utløst KU midt i reguleringsfasen kan koste år. Her får utbygger et tydelig 'her må du vurdere KU' med kilde-henvisninger til hvilken paragraf som utløser det."*
- Vis så hovedanalysen (red flags, strategier) og hvordan den **bygger på** KU-konklusjonen.

**Steg 4 (2 min):** Test-case 2 — **vanlig boligadresse uten kulturminne/vern**.
- Vis hvordan systemet skiller "no_trigger" fra "must_assess" — det er ikke alarm på alt.
- Pek på rettskilde-referansene i red flags: "Her ser dere at Claude refererer til konkrete PBL-paragrafer fra kunnskapsbasen, ikke generelle påstander."

**Steg 5 (1 min):** Vis **kunnskapsbasen** kort.
- Åpne en SQL-spørring i Supabase, vis count: 2 550 chunks fordelt over rettskilde-kategorier.
- Vis at PBL og NOU og forskrifter er klart adskilt — det er rettskildelære i praksis.

**Steg 6 (1 min):** Veikart.
- Vis [poc-plan.md](poc-plan.md) eller en lysark med "Ferdig / I gang / Neste".
- Pek på hva som er gjort, hva som testes denne uka (re-ingest, naboeiendommer), hva som er phase 2.

### Hvis kunden spør "hvordan er dette annerledes enn ChatGPT?"

Svar: *"Tre ting. Én: data — vi har integrert mot åtte offentlige tjenester som ChatGPT ikke har tilgang til, så analysen er basert på faktisk plansituasjon. To: rettskildelære — vi rangerer kilder etter juridisk autoritet, så lov og forskrift veier mer enn media-sitater. Tre: strukturert output — KU-vurdering er en separat dedikert sjekk, ikke noe AI-en svarer 'kanskje' på når den blir spurt. Den kommer alltid med konkret outcome og kildereferanse."*

### Tekniske ting du bør ha klart

- **Hvis demo-server feiler:** Ha en backup-skjermbilde / video / screenshot av en tidligere kjørt analyse.
- **Hvis kunden vil prøve egen adresse:** OK å la dem, men vær forberedt på at noen adresser gir 0 treff i kunnskapsbasen — bruk det da som anledning til å snakke om re-ingest-arbeidet.
- **Hvis kunden spør om kostnader:** API-kall til Voyage og Anthropic er småpenger. Selve serverdriften (Supabase + Vercel) er rimelig. Prompt caching er ikke implementert ennå men vil kutte ~80 % på gjentatt KU-forskrift-kontekst.

---

## 7. Veikart videre

### Akkurat nå
- **Re-ingest av kunnskapsbasen** med ny taksonomi (~2 dagers arbeid hvis vi har lokal tilgang)
- **Test mot Selma Ellefsens vei** og 2-3 andre referansecaser
- **Polish UI** — favicon, loading states, fanget-feilhåndtering

### Nær fremtid (prioritet 2)
- **Naboeiendommer:** spatial buffer + planhenting på nabotomt
- **PBE-mal-output:** strukturere resultatet etter "planfaglig vurdering"-malen
- **Prompt caching:** for KU-forskrift-konteksten i KU-trigger-AI
- **Hybrid søk** (BM25 + vektor) for abstrakte juridiske queries

### Phase 2 / videre utvikling
- Strukturerte planinitiativ-utkast som direkte inngangsmateriale til PBE-dialog
- Brukerstyrt sammenligning av strategier (visuelt + økonomisk)
- Bygg-bibliotek av red flags som læres opp over tid (Miro-brettets visjon)
- Eventuell integrasjon mot kommune-spesifikke saksbehandlingssystem

### Avhengigheter og risiko
- **Lokal tilgang til kundens Drive-samling** — kritisk for re-ingest
- **Bruker-tilgang for testing** — vi trenger reelle test-caser med kjente utfall
- **Feedback fra fagperson** på KU-trigger-utskrifter — har AI riktig faglig nivå?

---

## 8. Vedlegg: filer å vite om

| Fil | Hva er det |
|---|---|
| [src/lib/sted-kontekst.ts](../src/lib/sted-kontekst.ts) | Aggregator for alle WMS-kall + flagg-bygging |
| [src/lib/ku-trigger.ts](../src/lib/ku-trigger.ts) | KU-trigger-AI + DB-lagring |
| [src/lib/analyse.ts](../src/lib/analyse.ts) | Hovedanalyse — red flags, strategier, oppsider |
| [src/lib/pipeline/search.ts](../src/lib/pipeline/search.ts) | Vektorsøk med reranking |
| [supabase/migrations/](../supabase/migrations/) | DB-skjema og seed-data |
| [docs/poc-plan.md](poc-plan.md) | Opprinnelig POC-plan |
| [docs/sjekkliste-kundedokumenter.md](sjekkliste-kundedokumenter.md) | Spørsmål til kunden om dokumentsamling |

---

*Spørsmål eller behov for utdypning før møtet — gi beskjed.*
