# Analyse: MVP Boligbyggeapp – Scope, risiko og forenklingsstrategi

## Hva løsningen skal gjøre (kjerneverdien)

Hjelpe utbyggere/ansvarlig søker med å forstå **reguleringsrisiko** før de går inn i en byggeprosess. Konkret: gitt en tomt og ønskede byggetiltak, skal systemet si noe om hva som er lovlig, hva som krever dispensasjon, og hva den reelle risikoen er – basert på lovverk, reguleringsplaner og presedens fra tidligere vedtak.

**Kjerneverdien i én setning:** "Før du bruker 6 måneder og 200 000 kr på en reguleringsprosess – vet du om det er verdt det?"

---

## Hva Deloitte har foreslått (24 slides, ~600 timer)

| Komponent | Timer (ca.) | Hva det innebærer |
|-----------|-------------|-------------------|
| Backend (FastAPI + Auth) | 300–350 | Full API, strategimotor, redflag-engine, risikoaggregering, Qdrant-integrasjon, PostgreSQL+PostGIS |
| Frontend (Next.js + Mapbox) | 150–200 | Dashboard, tabellvisning, prosjektopprettelse, kartvisning |
| DevOps | 50 | AWS EC2, Docker Compose |
| PL/QA | 80 | Prosjektledelse og testing |
| **Totalt** | **~600** | **500 000 – 750 000 kr** |

### Deloittes scope inneholder følgende moduler:

1. **Prosjektopprettelse** – bruker registrerer tomt, høyde, kommune, markedsantagelser
2. **Strategimotor** – genererer 3 faste strategier (aggressiv/moderat/konservativ) med %-nedskalering
3. **RedFlag Engine** – 10-15 hardkodede risikoflagg med severity, vekting, hard stop
4. **Risikojustert verdi** – Expected Value = Margin × P(godkjent)
5. **Dashboard** – tabell med strategisammenligning + aktive red flags
6. **Juridisk oppslag (RAG)** – vektorsøk mot 20-30 kuraterte dokumenter via Qdrant
7. **Core Chain** – 7-stegs pipeline fra rammeforståelse til strategisk anbefaling

---

## Hvor Deloitte har bommet

### 1. Overengineered arkitektur for en MVP
De foreslår Qdrant (vektordatabase), PostGIS, FastAPI med auth, Next.js med Mapbox – dette er produksjonsstack, ikke MVP-stack. Å sette opp og integrere alt dette spiser timer uten å bevise noe.

### 2. Strategimotoren er triviell, men pakket inn som kompleks
Tre faste strategier med 70/85/100% skalering er i praksis en enkel kalkulator. Det trenger ikke en "motor" – det er en funksjon på 20 linjer. Likevel er det gjort til et kjernekonsept som driver arkitekturen.

### 3. Core Chain (slide 15-23) beskriver et fremtidig system, ikke en MVP
Denne 7-stegs kjeden (rammeforståelse → strategigenerering → redflag → presedens → risikoaggregering → kapitaljustering → anbefaling) er en ambisiøs arkitekturtegning. I en lean MVP bør man bevise at **ett** av disse stegene gir verdi – ikke bygge hele kjeden med placeholder-logikk.

### 4. De bruker ikke AI der AI faktisk gir verdi
Presentasjonen sier eksplisitt "ingen ML i MVP" – men paradoksalt nok foreslår de Qdrant og vektorsøk (som ER ML-infrastruktur). Samtidig unngår de å bruke LLM-er til det de er best på: tolke juridiske dokumenter, gi kontekstuell rådgivning, og forklare risiko på naturlig språk.

### 5. 600 timer for å vise en tabell med tre rader
Sluttproduktet er et dashboard som viser tre strategier i en tabell med red flags. Det er output du kan generere med en god prompt, et par API-kall, og en enkel frontend.

---

## Forenklet scope: Ekte Lean MVP

### Mål: Bevise at reguleringsrisiko kan struktureres og gi verdi – på 150-200 timer

| Komponent | Beskrivelse | Timer |
|-----------|-------------|-------|
| **Enkel webform** | Bruker legger inn tomt-info: adresse/kommune, ønsket tiltak, areal, høyde | 20 |
| **Kunnskapsbase** | 20-30 kuraterte dokumenter (reguleringsplaner, PBL-paragrafer, vedtak) indeksert med enkel vektorstore (f.eks. Supabase pgvector eller Pinecone) | 30 |
| **AI-drevet analyse** | LLM (Claude/GPT) analyserer input mot kunnskapsbasen. Genererer: lovlige rammer, identifiserte red flags, risikovurdering, strategiforslag med begrunnelse | 40 |
| **Resultatside** | Enkel visning av analysen: risikoprofil, anbefalte strategier, relevante dokumentreferanser, forklart på norsk | 30 |
| **Infrastruktur** | Vercel/Railway deploy, enkel auth (magic link), database for prosjekter | 20 |
| **QA + iterasjon** | Test med reelle caser, juster prompts og kunnskapsbase | 20–30 |
| **Prosjektledelse** | Koordinering, demo-prep | 15 |
| **Totalt** | | **~175–185 timer** |

### Pris ved 1000 kr/time: **~175 000 – 185 000 kr**

---

## Hva den forenklede MVP-en beviser (identisk med Deloittes suksesskriterier)

Deloitte lister fire suksesskriterier (slide 13). Her er hvordan en forenklet MVP møter alle:

| Suksesskriterium | Deloitte-løsning | Forenklet MVP |
|------------------|------------------|---------------|
| Risiko kan kvantifiseres | Hardkodet redflag-engine med 15 parametre | LLM analyserer mot kunnskapsbase, gir strukturert risikovurdering |
| Strategiene gir ulike Expected Values | 3 faste %-strategier × enkel formel | AI genererer strategier basert på faktisk reguleringsdata, ikke bare skalering |
| Parameterendringer gir forutsigbare endringer | Lineær formel | Demonstreres gjennom test-caser |
| Juridisk oppslag gir relevante dokumenter | Qdrant vektorsøk | Vektorsøk via pgvector + LLM-tolkning |

**Bonusverdi i forenklet MVP:** AI-en kan faktisk *forklare* risikoen på naturlig språk, gi kontekstuell begrunnelse, og referere til spesifikke dokumenter. Deloittes versjon gir bare en score.

---

## Strategi for møtet

### Avos posisjon

Avo er ikke ute etter å selge mest mulig timer. Avo vil demonstrere at vi bygger **riktig omfang til riktig tid** – effektivt, med moderne AI-verktøy, og med fokus på faktisk verdi.

### Foreslått tilnærming i møtet

**1. Anerkjenn det gode arbeidet.** Deloitte har gjort en solid arkitekturtegning for et fremtidig produkt. Kjeden fra rammeforståelse til strategisk anbefaling (slide 15-23) er en god visjon.

**2. Skill mellom visjon og MVP.** Presentasjonen blander "hva systemet skal bli" med "hva vi bygger først". En MVP skal ikke være en mini-versjon av alt – den skal bevise én ting: at reguleringsrisiko kan struktureres og gi beslutningsverdi.

**3. Foreslå to-fase tilnærming:**

- **Fase 1 (6-8 uker, ~175k):** Fungerende prototype som tar inn tomtdata og gir risikovurdering med AI-drevet analyse. Reelle dokumenter, reelle caser, demonstrerbart for investorer.
- **Fase 2 (etter validering, ~300-400k):** Hvis fase 1 validerer konseptet – bygg ut strategimotor, utvidet redflag-bibliotek, dashboard med historikk, multi-kommune, osv.

**4. Fremhev AI-fordelen.** Deloittes tilnærming bygger mye deterministisk logikk (redflag-engine, strategiformler) som en LLM kan gjøre bedre og raskere – med den ekstra fordelen at den kan forklare, kontekstualisere og tilpasse seg nye dokumenter uten kodeendringer.

### Potensielle innvendinger og svar

| Innvending | Svar |
|------------|------|
| "Vi trenger deterministisk logikk, ikke AI-hallusinasjoner" | Kunnskapsbasen er kuratert og strukturert. LLM-en henter og tolker – den dikter ikke. Vi kan bygge inn validering og sporbarhet. |
| "175k høres for billig ut" | Det er fordi vi kutter overhead, ikke funksjonalitet. Sluttproduktet demonstrerer det samme – men raskere. |
| "Vi har lovet investorer 600k-scope" | En MVP som virker etter 8 uker er mer overbevisende for investorer enn en teknisk spesifikasjon. Resten av budsjettet kan brukes på fase 2 med reell brukerdata. |
| "Deloitte har allerede gjort arkitekturen" | Arkitekturen er verdifull som veikart. Vi bruker den som referanse for fase 2. Ingenting kastes – det reprioriteres. |

---

## Oppsummert

| | Deloitte | Avo-forslag |
|--|---------|-------------|
| Timer | ~600 | ~175 |
| Pris | 500–750k | ~175k |
| Leveransetid | 12-16 uker? | 6-8 uker |
| Teknologi | FastAPI + Qdrant + PostGIS + Next.js + Mapbox | Next.js + pgvector + LLM API + DiBK/Planslurpen/eInnsyn |
| Output | Dashboard med tabell og score | Interaktiv risikoanalyse med forklaringer |
| AI-bruk | Kun vektorsøk | Kjernen av produktet |
| Investorverdi | Teknisk demo | Fungerende verktøy man kan prøve |
