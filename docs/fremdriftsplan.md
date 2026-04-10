# Fremdriftsplan: Reguleringsrisiko MVP

## Hva vi bygger

Et webverktøy der en utbygger legger inn tomt og ønsket tiltak, og får tilbake en strukturert risikovurdering med red flags, strategiforslag og dokumentreferanser — drevet av AI mot offentlige datakilder og en kuratert kunnskapsbase.

---

## Status per 10. april 2026

### Ferdig

- Next.js-prosjekt med Supabase-integrasjon og databaseskjema
- Kartverket-integrasjon: adressesøk, eiendomsoppslag, kommuneinfo
- DiBK-integrasjon: reguleringsplandata (planområder, arealformål, hensynssoner)
- Arealplaner.no-integrasjon: henter planbestemmelser (PDF-dokumenter), dispensasjoner og plandokumenter for ~200+ kommuner
- Planslurpen-integrasjon: eiendom-til-plan-oppslag, AI-tolkningsstatus
- eInnsyn-integrasjon: søk i offentlige journalposter og saksmapper for dispensasjonspresedens
- Planbestemmelser-pipeline: kjeder alle kilder og finner bestemmelsesdokumenter for en gitt eiendom
- UI-komponenter og testside for å verifisere datakjeden
- Prosjektdokumentasjon, driftsinstruks og API-vurderinger

### Avhengigheter fra kunden (uendret)

- Dokumenter fra Harddisken (~730 filer, 7 kategorier) for kunnskapsbasen
- Fagkunnskap om reguleringsbestemmelser og red flags
- Tom leverer dokumentasjon for Selma Ellefsens vei-casen
- Prioritering av hvilke dokumenter som er mest relevante for MVP

---

## Fase 1: Fundament og datakjede

**Mål:** All data som trengs for analyse er tilgjengelig og sammenkoblet.

| Oppgave | Status |
|---------|--------|
| Prosjektoppsett (Next.js, Supabase, CI/CD) | Ferdig |
| Kartverket adresse- og eiendoms-API | Ferdig |
| DiBK reguleringsplandata (WMS) | Ferdig |
| Arealplaner.no (planbestemmelser-PDF, dispensasjoner) | Ferdig |
| Planslurpen (eiendom → plan-register, AI-tolkning) | Ferdig |
| eInnsyn (dispensasjonshistorikk, journalposter) | Ferdig |
| Auth med magic link | Gjenstår |
| Datamodell og Supabase-migrasjoner i prod | Gjenstår |

---

## Fase 2: Kunnskapsbase

**Mål:** Kundens dokumenter er søkbare og gir grunnlag for AI-analysen.

| Oppgave | Status |
|---------|--------|
| Motta og kategorisere dokumenter fra kunden (Prioritet 1-mappene) | Venter på kunde |
| Dokumentprosessering: PDF/docx → tekst → chunking | Gjenstår |
| Embedding-generering og lagring i Supabase pgvector | Gjenstår |
| Vektorsøk-funksjon med metadata-filtrering | Skjema ferdig, implementasjon gjenstår |
| Indeksere Prioritet 2-dokumenter | Gjenstår |

---

## Fase 3: AI-analyse og resultat

**Mål:** Bruker legger inn tomt + tiltak og får en strukturert risikovurdering.

| Oppgave | Status |
|---------|--------|
| Analysepipeline: tomtdata + planbestemmelser + kunnskapsbase → Claude API | Gjenstår |
| Red flag-identifisering (hard stop / dispenserbart / akseptabel risiko) | Gjenstår |
| Strategiforslag med ulik risikoprofil (2–3 alternativer) | Gjenstår |
| Oppsidebibliotek (muligheter i reguleringsplan/overordnede planer) | Gjenstår |
| Rådgivning: foreslå justeringer som reduserer risiko | Gjenstår |
| Resultatside med risikovurdering, red flags, strategier og referanser | Gjenstår |
| Prosjektopprettelse og -lagring | Gjenstår |

---

## Fase 4: Testing med reelle caser

**Mål:** Validere at analysen gir fornuftige resultater mot en kjent case.

| Oppgave | Status |
|---------|--------|
| Test med Selma Ellefsens vei (case med fasit) | Venter på dokumentasjon fra Tom |
| Iterere på prompts, chunking og red flag-kategorisering | Gjenstår |
| Fagvalidering med kundens eksperter | Gjenstår |
| Test med 2–3 ytterligere caser | Gjenstår |

---

## Fase 5: Ferdigstilling og demo

**Mål:** Demobar løsning som viser hele flyten for investorer.

| Oppgave | Status |
|---------|--------|
| Fiks bugs og poler UI | Gjenstår |
| Gjennomgang av hele flyten: opprett prosjekt → tomt → risikovurdering → strategier | Gjenstår |
| Klargjøre demo | Gjenstår |

---

## Ikke inkludert i MVP

- Kartvisning / GIS
- Multi-kommune (fungerer allerede for ~200+ kommuner via arealplaner.no, men UI og testing er fokusert på én kommune)
- 3D-visualisering
- Avansert brukerhåndtering og roller
- Eiendomsverdi-integrasjon (kommersiell, ikke relevant for reguleringsrisiko)
- Finn.no-integrasjon (ikke relevant)

---

## Teknisk stack

| Komponent | Verktøy |
|-----------|---------|
| Frontend | Next.js + shadcn/ui + Tailwind |
| Database + auth + vektorsøk | Supabase (pgvector) |
| AI-analyse | Claude API |
| Adresse/eiendom | Kartverket Geonorge API |
| Reguleringsplandata | DiBK WMS |
| Planbestemmelser (tekst) | Arealplaner.no API |
| Planregister (eiendom → plan) | Planslurpen API (DiBK beta) |
| Dispensasjonshistorikk | eInnsyn API (Digdir) |
| Hosting | Vercel |
