# Status før demo — Reguleringsrisiko POC

## Hva vi viser i morgen

En fungerende prototype som tar inn en adresse og et tiltak, henter alt av relevante plandata fra offentlige kilder, og gir en AI-drevet risikovurdering med red flags, strategier og anbefalinger.

## Hva som er ferdig

### Datakjede mot offentlige kilder

Verktøyet kobler seg automatisk til seks offentlige datakilder og henter alt av relevante plandata for en gitt adresse:

- **Kartverket** — adressesøk, eiendomsoppslag (gnr/bnr), kommuneinfo
- **DiBK NAP (WMS)** — gjeldende reguleringsplaner, arealformål, hensynssoner
- **Arealplaner.no** — planbestemmelser som PDF, dispensasjoner og plandokumenter for ~200+ kommuner
- **Planslurpen (DiBK beta)** — eiendom-til-plan-oppslag, AI-tolkningsstatus
- **eInnsyn (Digdir)** — søk i offentlige journalposter og saksmapper for dispensasjonspresedens

Alt henter sanntidsdata, ingen manuell innlegging.

### AI-analyse

Claude (Anthropic Sonnet) analyserer tomtdata + planbestemmelser + dispensasjonshistorikk mot ønsket tiltak, og returnerer en strukturert risikovurdering:

- Samlet risikovurdering (lav / moderat / høy / kritisk)
- Red flags kategorisert som *hard stop*, *dispenserbar*, eller *akseptabel risiko* — med hjemmel og anbefaling
- 2-3 strategier med ulik risikoprofil og konkrete justeringer
- Oppsider og muligheter
- Anbefalinger og dokumentreferanser

### Brukergrensesnitt

Tre-stegs flyt på `/analyse`:

1. Søk etter adresse → velg eiendom
2. Beskriv tiltak (byggehøyde, utnyttelsesgrad, bruksformål, antall enheter)
3. Få strukturert risikovurdering

### Kunnskapsbase-pipeline (klar til bruk)

Komplett pipeline for å prosessere kundens ~730 dokumenter til en søkbar kunnskapsbase:

- Tekstekstraksjon (PDF, DOCX, TXT)
- Smart chunking med automatisk gjenkjenning av lov-referanser (§) og kategorier
- Embeddings (Voyage-3) lagret i Supabase pgvector
- Vektorsøk integrert i analysepipelinen — beriker AI-analysen med relevant lovverk og praksis

Pipelinen er bygget og testet, men venter på dokumenter fra kunden.

## Begrensninger som er viktig å være oppmerksom på

### Oslo-spesifikt

Oslo bruker eget system (PBE Saksinnsyn) som ikke har åpent API. For å demonstrere Selma Ellefsens vei-casen trenger vi dokumentene manuelt — egen forespørsel sendes til Tom. Andre kommuner (~200+) fungerer automatisk.

### Kunnskapsbasen er tom

Den AI-drevne analysen kjører nå uten kontekst fra kundens dokumentsamling. Den bruker kun sanntidsdata fra offentlige API-er. Når dokumentene er på plass og indeksert, vil analysen bli vesentlig dypere — den får tilgang til lovverk, rettspraksis, KMD-tolkninger og kommunal praksis.

### Designnivå

Funksjonelt UI med shadcn/ui-komponenter — rent og lesbart, men ikke designet av profesjonell designer. Bevisst valg for å holde POC-fasen lean. Designjustering kommer etter at flyten er validert.

### Modellvalg

Bruker Claude Sonnet for analysen. Kan oppgraderes til Opus for bedre kvalitet om det blir aktuelt, eller bytte til en lokal modell hvis personvern krever det.

## Hva vi ikke har bygget i denne fasen

Bevisst utelatt fra MVP — kan komme i fase 2:

- Brukerautentisering og prosjektlagring (datamodell er klar, mangler innlogging)
- Kartvisning / GIS
- Multi-kommune-UI (datakjeden støtter det allerede)
- Avansert brukerhåndtering og roller
- Eiendomsverdi og finansielle data (ikke relevant for reguleringsrisiko)

## Avhengigheter fra kunden videre

For å validere mot Selma Ellefsens vei-casen i morgen trenger vi:

1. Planbestemmelser for området (egen forespørsel sendt)
2. "Fasiten" — kort beskrivelse av prosjektet og faktisk utfall

For å gjøre kunnskapsbasen reell trenger vi:

3. Tilgang til Harddisk-mappene — særlig prioritet 1 (lov og forskrift, kommunal praksis, rekkefølgekrav)

## Hva som kommer nærmest

Når dokumenter er mottatt:

1. Indeksere prioritet 1-mappene i kunnskapsbasen
2. Kjøre full analyse på Selma Ellefsens vei og sammenligne med fasiten
3. Iterere på prompts og chunking basert på resultatet
4. Indeksere prioritet 2-dokumenter
5. Polere demo for investorpresentasjon

---

**Demo-rute i morgen:** Anbefaler å bruke en **Bergen-adresse** for å vise full automatisk datakjede (alle API-ene fungerer), deretter forklare hvordan flyten ser ut for Oslo når dokumentene er på plass.
