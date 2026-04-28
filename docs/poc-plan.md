# POC-plan: Reguleringsrisiko MVP

## Hva vi bygger

Et webverktøy der en utbygger legger inn tomt og ønsket tiltak, og får tilbake en strukturert risikovurdering med red flags, strategiforslag og dokumentreferanser. Drevet av AI mot en kuratert kunnskapsbase.

## Teknisk stack

Next.js (frontend), Supabase (auth, database, pgvector for vektorsøk), Claude API (analyse og risikovurdering), Kartverkets åpne API-er (adresse- og eiendomsoppslag).

---

## Uke 1–2: Fundament

### Prosjektoppsett
Sett opp Next.js-prosjekt med Supabase-integrasjon. Konfigurer auth med magic link. Lag datamodell for prosjekter (adresse, gnr/bnr, ønsket tiltak, byggehøyde, utnyttelsesgrad, bruksformål).

### Kartverket-integrasjon
Integrer mot Kartverkets adresse-API og eiendoms-API. Bruker legger inn adresse eller gnr/bnr, systemet henter areal, kommune og plassering automatisk.

### Kunnskapsbase (den store jobben)
Kundens dokumentsamling ligger i Google Drive (`AVO - samarbeid SP/Mappestruktur/`) med ~7800 filer. Strukturen følger norsk **rettskildelære**, ikke en flat tematisk inndeling. Kategoritaksonomien og vekter er beskrevet i [CLAUDE.md](../CLAUDE.md); pipelinens kategorideteksjon i [src/lib/pipeline/chunk.ts](../src/lib/pipeline/chunk.ts).

**Prioritet 1 – må inn i MVP:**
- Rettskilder.vektor database ny/ mappe 1 (Lov og forskrift) — PBL, FVL, KU-forskrift, TEK17, SAK10, Naturmangfoldloven, Statlige planretningslinjer.
- Innsigelse/ og KU/ (tverrgående) — direkte relevant for de dyreste risikoflaggene.
- Utbyggingsavtaler rekkefølgebestemmelser/ — rang 5 på kundens red flag-liste.

**Prioritet 2 – styrker analysen:**
- Mappe 2 (Rettspraksis) og 3 (Lovforarbeider) — presedens og lovgivers intensjon, vekt 0.80–0.90.
- Mappe 4 (Forvaltningspraksis) inkl. rundskriv og statsforvalteruttalelser.
- Red flagg3/Sjekklister.Oslo kommune/ og Støttedokumenter.plan/ — PBE-maler, planbeskrivelser, eksempelsaker.

**Prioritet 3 – kontekst og dybde:**
- Mappe 6 (Fagliteratur, Bygg21, masteroppgaver).
- Mappe 7 (Reelle hensyn), Mappe 5 (Sedvane).

**Seed-bibliotek (fra kundens kuraterte xlsx-filer):**
Tre tabeller seedes direkte inn i Supabase, separat fra vektor-ingest (se [002_seed_risk_library.sql](../supabase/migrations/002_seed_risk_library.sql)):
- `rettskilde_weights` — 17 kildetyper med vekt 0.30–1.00 (Formell/Reell/Supplerende). Brukes til reranking av vektorsøk-resultater.
- `red_flags` — 15 ferdig-kuraterte risikoflagg med sannsynlighet, konsekvens-%, risikokategori og datakilder.
- `risk_categories` — 12 overordnede risikotyper med indikatorer, tiltak og PBL-hjemler.

AI-analysen skal *matche mot og utvide* disse bibliotekene, ikke finne opp flagg fra scratch. Kundens forarbeid er startpunkt for red flag-biblioteket, ikke noe som konkurrerer med det.

**Konkret oppgave:** Prosesser dokumentene (PDF-er, docx-filer) til tekst, chunk dem, generer embeddings, lagre i Supabase pgvector. Start med prioritet 1, utvid etterpå. Bruk metadata (kilde, kategori, lovparagraf) for filtrering ved søk.

**Rettskilde-tagging i vektorindeksen:** kategori-metadata på hver chunk brukes sammen med `rettskilde_weights` for reranking — kilder med høy vekt (lov, rettspraksis, rundskriv) løftes fremfor kilder med lav vekt (media, saksframlegg). Mapper markert som interne organisasjonsdokumenter (RAG.Arkitektur/, Vektordatabase.organisering/) ekskluderes via pipelinens skip-liste.

---

## Uke 3–5: AI-analyse og resultat

### Risikoanalyse-pipeline
Bygg en pipeline der brukerens input (tomt + tiltak) analyseres mot kunnskapsbasen:

1. Hent tomtdata fra Kartverket basert på brukerens input.
2. Hent planstatus både for egen tomt **og tilstøtende eiendommer** (spatial buffer). Detaljregulering på nabotomt binder også, og må inn i kontekst.
3. Gjør vektorsøk i kunnskapsbasen for å finne relevante dokumenter (reguleringsbestemmelser, PBL-paragrafer, tidligere vedtak).
4. Send kontekst + brukerens tiltak til Claude API. Claude identifiserer avvik, vurderer alvorlighetsgrad, og estimerer sannsynlighet for godkjenning.

### KU-trigger som primær risikosjekk
Konsekvensutredning utløst midt i reguleringsfasen er blant de dyreste enkeltrisikoene (kan koste år). Egen sjekk tidlig i pipelinen: matcher tiltaket noen av triggerne i KU-forskriften (formålsendring, størrelse, berørte interesser, beliggenhet i sårbart område)? Høy vekting i samlet risikoscore, eget flagg i output.

### Red flag-bibliotek
Dette er det Miro-brettet fremhever som det viktigste å demonstrere. MVP-en skal vise at løsningen bygger sitt eget red flag-bibliotek gjennom RAG. Konkret: Claude identifiserer røde flagg fra dokumentene og kategoriserer dem (hard stop vs. dispenserbart vs. akseptabel risiko). Over tid vokser biblioteket etter hvert som nye caser analyseres.

### Strategiforslag
Basert på analysen genererer Claude 2–3 strategier med ulik risikoprofil. Hver strategi inneholder begrunnelse, identifiserte red flags, og vurdering av forventet utfall. Ikke hardkodede %-strategier som i Deloittes forslag. AI-en skal gi reelle, kontekstuelle anbefalinger basert på dokumentgrunnlaget.

### Oppsidebibliotek
I tillegg til red flags skal analysen identifisere oppsider. Muligheter som ligger i reguleringsplanen, dispensasjonspraksis eller overordnede planer som tiltakshaver kan utnytte. Eksempel: "Kommuneplanen åpner for høyere utnyttelse i dette området enn gjeldende reguleringsplan tilsier. Omregulering kan gi X ekstra kvm."

### Rådgivning og konseptutvikling
POC-scopet nevner rådgivning/optimalisering og konseptutvikling (kvartal/punkthus, plangrep). I MVP betyr dette at analysen ikke bare sier "dette er risikoen", men også foreslår justeringer av tiltaket som kan redusere risiko. Eksempel: "Reduser byggehøyde fra 24m til 21m for å unngå konflikt med kommuneplanens bestemmelse §X."

### Resultatside
Vis resultatet oversiktlig: samlet risikovurdering, red flags med forklaring, strategialternativer med anbefaling, referanser til relevante dokumenter og lovhjemler. Alt forklart på norsk, i naturlig språk.

Strukturer output etter malen for *planfaglig vurdering* som PBE sammenfatter etter planinitiativ (stedsanalyse, ROS, forhold til overordnede planer, rekkefølgekrav). Da blir analysen direkte brukbar som utgangspunkt for dialog med PBE, ikke bare et internt beslutningsgrunnlag.

---

## Uke 6–7: Testing med reelle caser

### Selma Ellefsens vei
Miro-brettet peker på dette som eksempelcase med fasit. Tom skriver ut dokumentasjon. Dokumentasjonen kan hentes fra Saksinnsyn (krever BankID). Bruk denne casen til å validere at analysen gir fornuftige resultater sammenlignet med det som faktisk skjedde.

### Justering
Iterer på prompts, chunking-strategi og vekting av dokumenttyper basert på testresultatene. Juster hvordan red flags kategoriseres. Test med fagpersonene hos kunden at risikovurderingene gir mening.

---

## Uke 8: Ferdigstilling og demo

Fiks bugs, poler UI, klargjør demo. Lag en gjennomgang som viser hele flyten: opprett prosjekt → legg inn tomt → få risikovurdering → se strategier. Vis at red flag-biblioteket vokser. Vis referanser til konkrete dokumenter.

---

## Avhengigheter fra kunden

Fagkunnskap om reguleringsbestemmelser og red flags må tilgjengeliggjøres løpende. Tom leverer dokumentasjon for Selma Ellefsens vei-casen. Tilgang til Saksinnsyn for å hente relevante vedtak og dispensasjonssaker. Avklaring av hvilke dokumenter i Harddisk-mappene som er mest relevante for MVP (prioritering innenfor kategori 1-7).

## Eksterne datakilder – API-integrasjoner

Undersøkt april 2026. Kartverket-integrasjon og DiBK WMS er allerede på plass. Nedenfor er vurdering av fire tilleggskilder og anbefalt tilnærming.

### Planbestemmelser (Planinnsyn) – HØYEST VERDI

DiBK WMS gir planstruktur (arealformål, hensynssoner), men ikke selve bestemmelsesteksten. Bestemmelsene er der de reelle begrensningene står – byggehøyde, utnyttingsgrad, rekkefølgekrav. Uten dem analyserer Claude kun metadata.

**Anbefalt integrasjon (MVP):**

1. **DiBK OGC API Features** (`nap.ft.dibk.no/services/rest/reguleringsplaner/vn1`) – oppgrader fra WMS til REST/GeoJSON. Hent planidentifikasjon og kommunenummer.
2. **Arealplaner.no PDF-er** – forutsigbare URL-mønstre: `arealplaner.no/{kommunenummer}/dokumenter/{docId}/{filnavn}.pdf`. Kjede: DiBK → arealplaner.no → hent bestemmelser-PDF → parse med Claude. ~200+ kommuner dekket.
3. **Planslurpen API** (`planslurpen.no/api/swagger/index.html`) – DiBKs beta-API som bruker AI til å ekstrahere strukturerte data fra bestemmelser-PDF-er (byggehøyde, utnyttingsgrad, delområder). Åpent, ingen nøkkel. Begrenset til ~10 pilotkommuner, utvides. Bruk der det er tilgjengelig som supplement.

**Ikke nødvendig:** BankID. Planer er offentlig informasjon.

### Saksinnsyn (dispensasjonshistorikk) – HØY VERDI

Dispensasjonshistorikk gir presedens: "har denne typen dispensasjon blitt innvilget her før?" Direkte relevant for risikovurdering.

**Anbefalt integrasjon (MVP):**

1. **eInnsyn API** (`api.einnsyn.no`) – REST API med søk i journalposter og saksmapper. Dekker statlige etater + Oslo. Krever API-nøkkel fra Digdir (se fremgangsmåte nedenfor). Søk etter "dispensasjon" + adresse.
2. **Oslo Saksinnsyn** – saksmeta (tittel, dato, saksnummer) er tilgjengelig uten innlogging via `innsyn.pbe.oslo.kommune.no`. Fulle dokumenter krever BankID. For MVP er metadata tilstrekkelig for å identifisere relevant presedens.

**Fremgangsmåte for eInnsyn API-nøkkel:**

1. Send e-post til `servicedesk@digdir.no` med emne: "Forespørsel om API-tilgang til eInnsyn"
2. Beskriv bruksområde: "Vi utvikler en reguleringsrisiko-tjeneste som trenger søk i dispensasjonssaker og byggesaksvedtak for å vurdere presedens. Vi ønsker API-tilgang for å søke i journalposter og saksmapper."
3. Oppgi organisasjon (Avo), kontaktperson, og teknisk kontakt
4. Oppgi forventet bruksvolum (lavt – titalls kall per dag i POC-fase)
5. API-nøkkelen sendes som `X-EIN-API-KEY: secret_...` header
6. API-spesifikasjon: `github.com/felleslosninger/einnsyn-api-spec`

### Eiendomsverdi – UTSATT TIL FASE 2+

Ingen offentlig API. Kommersielt B2B-produkt eid av bankene. Gir eiendomsverdier og prisstatistikk – relevant for økonomisk side (risikojustert verdi), men ikke for reguleringsrisiko.

**Alternativ:** SSB har gratis, åpent API (`data.ssb.no/api/`) med boligprisindeks per region. Enkel integrasjon om økonomisk kontekst ønskes.

### Finn.no – IKKE RELEVANT FOR MVP

Begrenset partner-API kun for annonsører. Gir boligannonser – ikke relevant for reguleringsrisiko. Ikke anbefalt selv for fase 2.

### Prioritert rekkefølge

| # | Integrasjon | Verdi | Innsats | Fase |
|---|-------------|-------|---------|------|
| 1 | Arealplaner.no PDF-er + Claude-parsing | Høyest – gir bestemmelsestekst | Medium | MVP |
| 2 | DiBK OGC API Features (oppgrader fra WMS) | Høy – bedre plandata | Lav | MVP |
| 3 | Planslurpen API (beta) | Høy – ferdig strukturert | Lav | MVP (pilotkommuner) |
| 4 | eInnsyn API | Høy – dispensasjonspresedens | Lav–medium | MVP (etter nøkkel) |
| 5 | SSB boligprisstatistikk | Lav – kontekst | Lav | Valgfritt |
| 6 | Kartverket Matrikkel API | Moderat – servitutter | Medium | Fase 2 |
| 7 | Eiendomsverdi / Finn.no | Lav / ingen | Høy (kommersiell) | Fase 2+ / Aldri |

---

## Ikke inkludert i MVP

Automatisk innhenting av reguleringsplaner (kurateres manuelt for Oslo). Kartvisning/GIS. Multi-kommune. 3D-visualisering. Avansert brukerhåndtering.

## Hva MVP-en beviser

At reguleringsrisiko kan struktureres og kvantifiseres. At AI kan tolke juridiske dokumenter og gi kontekstuell rådgivning. At red flag-biblioteket bygger seg selv gjennom RAG. At løsningen gir reell beslutningsverdi for utbyggere. At dette er et verktøy investorer kan prøve selv.
