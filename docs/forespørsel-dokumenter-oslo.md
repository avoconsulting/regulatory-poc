# Forespørsel: Dokumenter for Oslo / Selma Ellefsens vei

## Bakgrunn

Verktøyet henter automatisk reguleringsplaner, planbestemmelser, dispensasjoner og sakshistorikk fra offentlige API-er for ~200 kommuner. Oslo er unntaket — kommunen bruker eget system (PBE) som ikke har åpent API. For å teste med Selma Ellefsens vei trenger vi derfor dokumentene manuelt.

## Hva vi trenger

### 1. Reguleringsplan og bestemmelser (viktigst)

- Gjeldende reguleringsplan for området (plannavn og plan-ID)
- **Planbestemmelsene** som PDF eller Word — dette er det viktigste dokumentet. Det er her byggehøyder, utnyttingsgrad, rekkefølgekrav og andre begrensninger står.
- Plankart om tilgjengelig

### 2. Dispensasjonshistorikk

- Har det blitt søkt om eller innvilget dispensasjoner i området? I så fall: vedtaksbrev, begrunnelse, vilkår.
- Særlig interessant: dispensasjoner knyttet til byggehøyde, utnyttingsgrad, bruksformål eller avstand til nabogrense.
- *NB: For andre kommuner henter vi dette automatisk. Oslo PBE krever BankID-innlogging. Om du har tilgang: en eksport eller skjermdump av dispensasjonslisten for gnr 122/bnr 378 fra Saksinnsyn er tilstrekkelig — vi trenger ikke nødvendigvis fulle vedtaksdokumenter.*

### 3. Sakshistorikk fra PBE

- Byggesaksvedtak og rammetillatelser
- Eventuelle klager eller innsigelser og utfallet av disse
- Nabovarsler og merknader
- *NB: Også bak BankID i Oslo. En saksliste med tittel, dato og utfall er tilstrekkelig — vi trenger ikke alle vedlegg.*

### 4. Konsekvensutredninger og fagrapporter

- KU-rapporter eller risiko- og sårbarhetsanalyser (ROS) knyttet til planen
- Støyrapporter, trafikkanalyser, sol-/skyggestudier eller andre fagutredninger
- Geotekniske rapporter om relevante
- *NB: Disse ligger typisk som vedlegg i PBE Saksinnsyn eller i planarkivet. For andre kommuner henter vi dem automatisk fra arealplaner.no.*

### 5. Overordnede planer

- ~~Kommuneplanens arealdel~~ — henter vi selv ([Juridisk arealdel 2015, PDF](https://www.oslo.kommune.no/politikk/kommuneplan/kommuneplanens-arealdel/))
- ~~Kommunedelplaner~~ — publiseres på oslo.kommune.no, ingen relevant kommunedelplan for SE vei-området
- **Utbyggingsavtale eller rekkefølgebestemmelser** for SE vei-prosjektet spesifikt, om det finnes — disse ligger typisk i PBE

### 6. «Fasiten» — hva som faktisk skjedde

- Kort oppsummering av prosjektet: hva ble søkt om, hva ble resultatet?
- Hvilke red flags oppsto underveis?
- Hva tok lengst tid eller skapte mest motstand?
- Dette brukes til å validere at AI-analysen treffer — vi sammenligner vår risikovurdering med det faktiske utfallet.

## Format

PDF, Word eller skannede dokumenter er alle fine. Vi prosesserer dem maskinelt. Om mulig, legg filene i en delt mappe (Google Drive, OneDrive, eller lignende) så kan vi hente dem fortløpende.

## Prioritering

Hvis alt ikke er tilgjengelig med en gang:

1. **Planbestemmelser** — kan ikke analysere uten
2. **Dispensasjonshistorikk** — direkte input til risikovurderingen
3. **Fasiten** — trengs for validering
4. Resten styrker analysen men er ikke blokkerende
