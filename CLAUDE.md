# Regulatory Risk PoC

Next.js-applikasjon for AI-drevet regulerings- og byggesaksrisikovurdering for norske eiendomsutviklere.

## Stack

Next.js (app router), Supabase (Postgres + pgvector + auth), Claude API, Voyage-3 embeddings. Integrasjoner mot Kartverket, DiBK WMS/OGC, Planslurpen, eInnsyn.

## Dokumentkilder og taksonomi

Kunnskapsbasen bygges på en kuratert Google Drive-samling (`AVO - samarbeid SP/Mappestruktur/`, ~7800 filer). Strukturen følger norsk **rettskildelære**, ikke en flat tematisk inndeling:

| Kategori (DB) | Mappe | Vekt* |
|---|---|---|
| `lov_og_forskrift` | 1. Lov og forskrift (PBL, FVL, KU, Naturmangfold, TEK/SAK, SPR) | 0.90–0.95 |
| `rettspraksis` | 2. Rettspraksis | 0.90 |
| `lovforarbeider` | 3. Lovforarbeider (Prop. L, NOU, Ot.prp.) | 0.80 |
| `forvaltningspraksis` | 4. Forvaltningspraksis | 0.70 |
| `sedvane` | 5. Sedvane alm.rettsoppfattning | — |
| `faglitteratur` | 6. Fagliteratur, masteroppgaver, Bygg21 | 0.50 |
| `reelle_hensyn` | 7. Reelle hensyn | — |
| `innsigelse` | Innsigelse/ (tverrgående) | — |
| `ku` | KU/ (tverrgående) | — |
| `rettskilde_prinsipper` | Rettskilde prinsipper/ | — |
| `utbyggingsavtaler` | Utbyggingsavtaler, Rekkefølgekrav | 0.75 |
| `sjekklister` | Sjekklister.Oslo kommune/ | 0.50 |
| `stottedokumenter_plan` | Støttedokumenter.plan/ | — |
| `arealplan_veileder` | Arealplaner.veileder/ | — |

*Vekt fra `rettskilde_weights`-tabellen (se seed-migrasjon). Brukes for reranking i vektorsøk.

Mapper som skal **ikke** ingestes (interne organisatoriske docs): `RAG.Arkitektur/`, `Vektordatabase.organisering/`, `URL.kilde arealplaner.Norge/`, `Visualisering av scenarier/`. Håndteres i [src/lib/pipeline/extract.ts](src/lib/pipeline/extract.ts) via `SKIP_FOLDERS`.

## Seed-bibliotek (kundens forarbeid)

Tre kuraterte xlsx-filer seedes som strukturerte tabeller (se [002_seed_risk_library.sql](supabase/migrations/002_seed_risk_library.sql)):

- `rettskilde_weights` — 17 kildetyper m/ vekt 0.30–1.00, for reranking. Fra `rettskilder_vekting.xlsx`.
- `red_flags` — 15 ferdig-kategoriserte risikoflagg m/ sannsynlighet, konsekvens-% og datakilder. Fra `Redflagg3.xlsx`.
- `risk_categories` — 12 overordnede risikotyper m/ indikatorer, tiltak, PBL-referanser. Fra `reguleringsrisiko_oversikt.xlsx`.

AI-analysen skal *matche mot og utvide* disse bibliotekene, ikke finne opp flagg fra scratch.

## Skills

- **peer-review** — Team peer code review guidelines. Applied when reviewing or preparing PRs.
