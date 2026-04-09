# Driftsinstruks: AI-drevet driftsoppsett for Boligbyggeapp POC

Denne instruksen beskriver hvordan boligbyggeapp-POC-en brukes som testcase for Avos driftsoppsett. Målet er å teste et oppsett som kan gjenbrukes på tvers av kundeprosjekter.

Instruksen følger POC-planens tidslinjer og legger driftsoppgavene inn der de hører hjemme.

---

## Prinsipper

Managed services der det finnes. Ikke bygg infrastruktur vi kan kjøpe. Supabase håndterer database, auth og vektorsøk. Vercel håndterer deploy og edge. Cloudflare håndterer DNS og sikkerhet.

Alt som kode. Ingen klikking i dashboards for å sette opp ting. Infrastruktur, miljøvariabler, deploy-konfigurasjon og overvåkning skal ligge i repoet og versjoneres.

AI i driftsloopen. Bruk AI til å overvåke, analysere og foreslå. Mennesket godkjenner og lærer.

---

## Uke 1–2: Fundament (parallelt med prosjektoppsett)

### Repo-struktur og CI/CD

Sett opp GitHub-repo med følgende struktur:

```
/app              → Next.js-applikasjonen
/infra            → Infrastrukturkonfigurasjon
  /supabase       → Supabase-migrasjoner og seed-data
  /cloudflare     → Cloudflare-konfig (DNS, WAF-regler, caching)
  /vercel         → vercel.json med env-config
/scripts          → Driftsscripts (backup, monitoring, deploy)
/.github/workflows → CI/CD-pipelines
```

Lag tre GitHub Actions-workflows fra start:

**ci.yml** — Kjører på hver PR. Linter, typechecking, tester. Inkluder en AI-review-step som sender diffen til Claude API og ber om en kodegjennomgang. Resultatet postes som PR-kommentar. Dette er lavterskel og gir umiddelbar verdi.

**deploy-staging.yml** — Trigger på merge til main. Deployer til Vercel preview. Kjører Supabase-migrasjoner mot staging-prosjekt. Poster deploy-URL i Slack/Teams.

**deploy-prod.yml** — Manuell trigger med approval gate. Kjører samme steg som staging, men mot prod. Krever at minst én person godkjenner i GitHub.

### Supabase som kode

Bruk Supabase CLI fra dag én. Alle databaseendringer skal skje via migrasjoner (`supabase migration new`), ikke via dashboardet. Dette gir versjonert databasehistorikk og gjør det mulig å gjenskape miljøet fra scratch.

Sett opp to Supabase-prosjekter: ett for staging, ett for prod. Bruk `supabase link` for å koble repoet til begge.

Lag et seed-script som populerer staging med testdata (dummy-prosjekter, noen dokumenter i pgvector). Gjør det enkelt å resette staging til en kjent tilstand.

### Cloudflare-oppsett

Sett opp domene i Cloudflare med Terraform (eller Pulumi hvis teamet foretrekker TypeScript). Konfigurer DNS-records, SSL, og basis WAF-regler. Lagre Terraform-state i Azure Blob Storage.

Poenget er ikke at Cloudflare-oppsettet er komplisert. Poenget er å etablere mønsteret: infrastruktur endres via kode og PR, ikke via et dashboard.

### Hemmeligheter

Bruk GitHub Environments for secrets (Supabase-nøkler, Claude API-key, Cloudflare API-token). Staging og prod har separate environments med egne secrets. Ingen secrets i kode, ingen secrets i .env-filer som committes.

### Avhengigheter og supply chain security

Sett opp Dependabot fra dag én. Legg til `.github/dependabot.yml` som scanner `package.json` (og `requirements.txt` for eventuelle Python-scripts) mot kjente CVE-er. Dependabot lager automatisk PR-er når en sårbar pakke har en tilgjengelig fix. Konfigurer den til å gruppere minor/patch-oppdateringer ukentlig og lage separate PR-er for sikkerhetspatcher umiddelbart.

Slå på GitHubs innebygde Security Alerts under repo-settings (Code security and analysis → Dependabot alerts + Dependabot security updates). Rut varslingene til Slack via en GitHub webhook eller en enkel Actions-workflow som poster til kanalen.

Legg til et `npm audit`-steg i `ci.yml` som kjører på hver PR. Sett den til å feile bygget ved kritiske (`critical`) og høye (`high`) sårbarheter. For Python-scripts: bruk `pip audit` tilsvarende. Da stopper ingen PR med en kjent sårbar avhengighet fra å bli merget.

Eksempel for `dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/app"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
```

Eksempel for audit-steg i `ci.yml`:

```yaml
- name: Security audit
  run: npm audit --audit-level=high
  working-directory: ./app
```

---

## Uke 3–5: Overvåkning og AI-monitoring (parallelt med AI-analyse)

### Strukturert logging

Sett opp strukturert logging i Next.js-appen fra starten. Bruk et enkelt oppsett: Vercel Logs for request-level logging, Supabase Logs for database-queries.

Logg spesifikt:
- Responstid for Claude API-kall (dette blir den dyreste og tregeste operasjonen)
- Antall tokens brukt per analyse (kostnadskontroll)
- pgvector-querytider (blir relevant når kunnskapsbasen vokser)
- Feilede API-kall mot Kartverket

### AI-drevet logganalyse

Sett opp et script (`scripts/analyze-logs.py`) som henter logger fra Vercel og Supabase, og sender dem til Claude API med en systemprompt som ber om:
- Identifisering av anomalier (uvanlig høye responstider, feilmønstre)
- Kostnadsestimater basert på token-bruk
- Forslag til optimaliseringer

Kjør dette scriptet som en GitHub Actions scheduled workflow, f.eks. daglig. Resultatet postes i en Slack-kanal eller lagres som en markdown-fil i repoet.

Dette er kjernen i "AI-drevet drift": ikke en fancy plattform, men et script som leser logger og gir deg en daglig oppsummering med forslag.

### Alerting

Sett opp enkle alerts via Vercel (eller en gratis tier på Betterstack/Grafana Cloud):
- App nede (health check feiler)
- Claude API-kall feiler mer enn 5 ganger på 10 minutter
- Supabase connection pool er full
- Daglig kostnad overstiger terskelverdi

Alerts skal gå til en Slack-kanal, ikke til e-post. Lavere terskel for å se og reagere.

### Kostnadsdashboard

Claude API og Supabase er de to kostnadsdriverne. Lag et enkelt dashboard (kan være en Supabase-tabell + en Next.js admin-side) som viser:
- Daglig/ukentlig token-forbruk
- Antall analyser kjørt
- Estimert månedskostnad

AI-logganalysescriptet kan oppdatere dette dashboardet automatisk.

---

## Uke 6–7: Testing av driftsoppsettet (parallelt med casetesting)

### Chaos-testing light

Mens teamet tester med Selma Ellefsens vei-casen, test driftsoppsettet samtidig:

Simuler at Claude API er nede. Har appen graceful degradation? Får brukeren en fornuftig feilmelding? Logges det riktig?

Simuler høy last. Kjør 50 samtidige analyser mot staging. Hvordan oppfører pgvector-queries seg? Treffer vi Supabase connection limits?

Simuler en dårlig deploy. Push en bevisst buggy migration til staging. Fungerer rollback? Kan du gjenskape staging fra scratch med seed-scriptet?

Dokumenter resultatene. Dette er gull for taskforcen.

### Incident response-prosess

Definer en enkel prosess:

1. Alert trigger i Slack
2. AI-scriptet analyserer logger og poster en oppsummering med mulig årsak
3. Menneske vurderer og beslutter tiltak
4. Tiltak gjennomføres (rollback, config-endring, hotfix)
5. Post-mortem skrives (kan også AI-assisteres: gi den loggen og tiltaket, be den lage et utkast)

Test denne prosessen minst én gang med en simulert incident.

---

## Uke 8: Dokumentasjon og overføring til taskforcen

### Driftshåndbok

Skriv en kort driftshåndbok som dekker:
- Hvordan deploye til staging og prod
- Hvordan kjøre database-migrasjoner
- Hvordan lese og tolke AI-logganalysen
- Hvordan håndtere vanlige feilsituasjoner
- Kostnadsstruktur og hva som trigger alerts

Denne håndboken er like mye for taskforcen som for dette prosjektet. Den blir malen for neste kundeprosjekt.

### Evaluering for taskforcen

Dokumenter hva som fungerte og ikke. Spesifikt:

Hva ga AI-overvåkningen som manuell overvåkning ikke ville gitt? Var de daglige logganalysene nyttige, eller bare støy? Tok infra-as-code for mye tid sammenlignet med å bare klikke i dashboards? Hva ville dere gjort annerledes på neste prosjekt?

---

## Verktøyvalg oppsummert

| Funksjon | Verktøy | Kommentar |
|----------|---------|-----------|
| Hosting frontend | Vercel | Zero-config for Next.js, innebygd preview deploys |
| Database + auth + vektorsøk | Supabase | Allerede valgt i POC-planen |
| DNS + CDN + WAF | Cloudflare | Avo bruker dette allerede |
| CI/CD | GitHub Actions | Gratis for public repos, rimelig for private |
| Infra as code | Terraform (Cloudflare) + Supabase CLI (db) | Pulumi er alternativ hvis teamet vil ha TypeScript |
| Logging | Vercel Logs + Supabase Logs | Managed, ingen oppsett |
| AI-overvåkning | Egenutviklet script mot Claude API | Enkelt å starte, kan byttes ut med dedikert verktøy senere |
| Alerting | Betterstack eller Grafana Cloud (gratis tier) | Slack-integrasjon er et krav |
| Secrets | GitHub Environments | Separert per miljø |
| Dependency scanning | Dependabot + npm audit i CI | Automatiske PR-er ved CVE-er, blokkerer merge ved kritiske sårbarheter |
| Plandata (struktur) | DiBK OGC API Features | Oppgradert fra WMS – REST/GeoJSON, åpent |
| Planbestemmelser (tekst) | Arealplaner.no PDF + Claude-parsing | ~200+ kommuner, forutsigbare URL-er |
| Planbestemmelser (strukturert) | Planslurpen API (DiBK beta) | AI-ekstrahert, ~10 pilotkommuner |
| Dispensasjonshistorikk | eInnsyn API | Krever API-nøkkel fra Digdir |

---

## Hva dette oppsettet beviser for taskforcen

At Avo kan drifte en kundeløsning uten dedikert ops-team. At AI kan gjøre den daglige driftsovervåkningen og gi handlingsforslag. At infra-as-code fungerer for Avos typiske stack uten uforholdsmessig mye overhead. At managed services dekker 90% av behovene. At oppsettet kan gjenbrukes som template for neste prosjekt.

---

## Ikke inkludert (men relevant for taskforcen å vurdere senere)

Kubernetes eller container-orkestrering. Overkill for denne typen app. Vurder først når Avo har prosjekter som trenger det.

Sentralisert logging på tvers av prosjekter. Relevant når Avo drifter 3+ løsninger. Da kan en felles Grafana-instans eller Azure Monitor gi verdi.

AI-agent som autonomt fikser problemer. Bevisst utelatt. Agenten skal foreslå, ikke handle. Menneskelig godkjenning er et prinsipp, ikke en midlertidig begrensning.

Intern utviklerplattform. Verdt å bygge når templatene fra dette prosjektet er validert på 2-3 prosjekter. Ikke før.
