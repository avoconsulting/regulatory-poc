-- Seed av kundens kuraterte risiko- og rettskildebibliotek.
-- Kilder: Redflagg3.xlsx, rettskilder_vekting.xlsx, reguleringsrisiko_oversikt.xlsx
-- (delt gjennom Google Drive: AVO - samarbeid SP/Mappestruktur/)

-- ──────────────────────────────────────────────
-- Rettskilde-vekting (reranking-grunnlag for vektorsøk)
-- ──────────────────────────────────────────────

create table rettskilde_weights (
  id uuid primary key default gen_random_uuid(),
  kategori text not null check (kategori in ('Formell', 'Reell', 'Supplerende')),
  kilde text not null unique,
  eksempler text,
  vekt numeric(3, 2) not null check (vekt >= 0 and vekt <= 1),
  kommentar text,
  typisk_bruk text
);

create index idx_rettskilde_weights_kategori on rettskilde_weights (kategori);

insert into rettskilde_weights (kategori, kilde, eksempler, vekt, kommentar, typisk_bruk) values
  ('Formell', 'Grunnloven', '§49, §97, §112', 1.00, 'Overordnet rammeverk for plan- og bygningslovgivningen', 'Tolkningsramme for alle lover'),
  ('Formell', 'Lover', 'PBL, Forvaltningsloven, Naturmangfoldloven', 0.95, 'Lovgrunnlag for planprosesser', 'Hjemler og rettsvirkninger'),
  ('Formell', 'Forskrifter', 'KU-forskrift, SAK10, TEK17', 0.90, 'Utfyller og konkretiserer lovens krav', 'Gir detaljerte bestemmelser'),
  ('Formell', 'Forarbeider', 'Prop. L, NOU-er, Ot.prp.', 0.80, 'Tolkningsbidrag for lovgivers intensjon', 'Brukes i rettsanvendelse og veiledning'),
  ('Formell', 'Rettspraksis', 'HR-2021-953-A, LB-2019-135154', 0.90, 'Avklarer anvendelse og tolkning', 'Normdannende og presiserende'),
  ('Formell', 'Forvaltningspraksis', 'Departementale vedtak, statsforvalter', 0.70, 'Viser praktisering av lov/forskrift', 'Kan danne presedens i praksis'),
  ('Formell', 'Sivilombudet', 'Uttalelser om planvedtak', 0.70, 'Veiledende om saksbehandling og god forvaltningsskikk', 'Ikke bindende, men vektig'),
  ('Reell', 'Departementale rundskriv', 'KDD H-5/18', 0.70, 'Tolkning og praktisk veiledning', 'Brukes av kommuner som rettesnor'),
  ('Reell', 'Direktoratsveiledere', 'DiBK veiledning TEK17, DSB ROS-veileder', 0.60, 'Gir retningslinjer for faglig praksis', 'Anbefalt, ikke bindende'),
  ('Reell', 'Kommunale veiledere og normer', 'PBE Oslo veiledere', 0.50, 'Lokal praksis, tekniske krav', 'Brukes som standard i kommunal behandling'),
  ('Reell', 'Planvedtak', 'Kommuneplan, KDP, reguleringsplan', 0.85, 'Lokalt bindende rettsvirkning', 'Styrer arealdisponering'),
  ('Reell', 'Utbyggingsavtaler', 'Kommunale avtaler etter PBL §17-1', 0.75, 'Kontraktsrettslig forankret, politisk sensitiv', 'Regulerer gjennomføring'),
  ('Reell', 'Saksframlegg og møtereferater', 'Kommunale beslutningsgrunnlag', 0.40, 'Empiri på faktisk praksis', 'Indikerer risiko og prosessmønstre'),
  ('Supplerende', 'Akademiske artikler / masteroppgaver', 'NMBU, NTNU, UiB', 0.50, 'Forskning og analyse av praksis', 'Gir innsikt i politisk og reguleringsrisiko'),
  ('Supplerende', 'Riksrevisjonen / Difi-rapporter', 'Evalueringer av planprosesser', 0.65, 'Påvirker fremtidig regelverksutvikling', 'Indikator på systemiske risikoer'),
  ('Supplerende', 'Media og fagpresse', 'Arkitektnytt, NRK, Retriever', 0.30, 'Indikator på opinion og politisk risiko', 'Påvirker legitimitet og offentlig debatt'),
  ('Supplerende', 'Empiriske kilder', 'eInnsyn, PBE saksmapper', 0.45, 'Dokumenterer faktisk prosess og praksis', 'Underlag for risikomodellering');

-- ──────────────────────────────────────────────
-- Red flag-bibliotek (konkrete risikoflagg med sannsynlighet/konsekvens)
-- ──────────────────────────────────────────────

create table red_flags (
  id uuid primary key default gen_random_uuid(),
  rang int not null unique,
  navn text not null unique,
  beskrivelse text,
  sannsynlighet text,
  konsekvens text,
  verdipaavirkning text,
  risikokategori text,
  datakilder text
);

create index idx_red_flags_kategori on red_flags (risikokategori);

insert into red_flags (rang, navn, beskrivelse, sannsynlighet, konsekvens, verdipaavirkning, risikokategori, datakilder) values
  (1, 'Mangelfull ROS (flom/kvikkleire/overvann)', 'Plan stoppes eller må utredes på nytt – tids- og verdileveranse', 'Høy (4-5)', 'Kritisk (5)', '20–50%', 'Svært høy', 'NVE flomkart, PBE saksinnsyn, ROS-analyser, NVEs kvikkleiredatabase'),
  (2, 'Konflikt med nasjonale/regionale interesser', 'Innsigelse fra Statsforvalter/statlige fagorgan – risiko for lang behandling', 'Høy (4-5)', 'Kritisk (5)', '20–50%', 'Svært høy', 'Statsforvalteren, KDD H-2/14, Regjeringen.no, Planregisteret (Geonorge)'),
  (3, 'Kulturmiljø/kulturminner', 'Riksantikvaren kan stanse eller kreve store volumendringer', 'Moderat–høy (3-4)', 'Høy (4-5)', '15–40%', 'Høy', 'Kulturminnesøk, Byantikvaren, Riksantikvaren, PBE planregister'),
  (4, 'Frist- og prosessfeil i innsigelseshåndtering', 'Formelle feil utløser forsinkelse/ny runde', 'Moderat (3)', 'Høy (4)', '10–25%', 'Moderat–høy', 'KDD tolkingsnotater, PBE saksinnsyn, Statsforvalteren prosessveileder'),
  (5, 'Kostbare rekkefølgebestemmelser', 'Krav om infrastruktur før byggestart reduserer nettoverdi', 'Høy (4)', 'Høy (4–5)', '15–35%', 'Høy', 'PBE planbestemmelser, VPOR, Planbeskrivelser, Bymiljøetaten'),
  (6, 'Krav om felles planlegging/samordning', 'Forhandlingslås og tidsrisiko ved flere grunneiere', 'Høy (4–5)', 'Høy (4)', '15–40%', 'Svært høy', 'Planregister §12-7, VPOR, PBE saksinnsyn, Kartverket eiendomsdata'),
  (7, 'Urealistisk utnyttelse vs. plan/VPOR', 'Nedjustering av volum eller høyde – arealtap', 'Moderat (3)', 'Høy (4)', '10–30%', 'Høy', 'KP, VPOR, PBE planinnsyn, tidligere planvedtak'),
  (8, 'Støy/forurensningskonflikt', 'Kostbare avbøtende tiltak eller innsigelse', 'Moderat (3)', 'Moderat–høy (3–4)', '10–25%', 'Moderat–høy', 'Miljødirektoratet, NILU, Miljøstatus.no, PBE saksuttalelser'),
  (9, 'NVE-interesser (flom/overvann/vassdrag)', 'Restriksjoner og tekniske tiltak reduserer areal/økonomi', 'Moderat–høy (3–4)', 'Høy (4)', '10–25%', 'Høy', 'NVE veileder 2017-02, NVE flomkart, Planregisteret'),
  (10, 'Lav politisk forankring/endrede prioriteringer', 'Politisk omkamp eller utsettelse', 'Moderat–høy (3–4)', 'Høy (4–5)', '15–35%', 'Høy', 'Bystyresaker, byrådserklæringer, komitéprotokoller, lokalpresse'),
  (11, 'Kompleks myndighetsdialog', 'Mange etater med motstridende krav gir tidstap', 'Høy (4–5)', 'Moderat (3)', '5–15%', 'Moderat', 'Planinnsyn høringsuttalelser, Statsforvalteren, Bymiljøetaten'),
  (12, 'Manglende infrastrukturkapasitet', 'Forsinker byggestart og øker investeringsbehov', 'Høy (4)', 'Moderat (3–4)', '10–20%', 'Moderat–høy', 'VAV Oslo, BYM, Planregister, tekniske etater'),
  (13, 'Planfaglig svakhet (ROS/KU/planbeskrivelse)', 'Ny høring og forsinket vedtak', 'Moderat (3)', 'Moderat (3–4)', '5–15%', 'Moderat', 'KDD veileder for planbeskrivelse, PBE veiledere, ROS-analyser'),
  (14, 'Nabo-/interessekonflikter', 'Ekstra runder og krav, verdidempende i sum', 'Høy (4)', 'Moderat (3)', '5–15%', 'Moderat', 'Planinnsyn merknader, høringsuttalelser, lokalpresse'),
  (15, 'Regelverks-/styringsskifte (innsigelsesrommet endres)', 'Uforutsigbart rammeverk i overgangsperioder', 'Moderat (3)', 'Moderat (3–4)', '5–10%', 'Moderat', 'Regjeringen.no, KDD rundskriv, Statsforvalteren veiledning');

-- ──────────────────────────────────────────────
-- Risikokategorier (overordnet taksonomi + tiltak per kategori)
-- ──────────────────────────────────────────────

create table risk_categories (
  id uuid primary key default gen_random_uuid(),
  kategori text not null unique,
  beskrivelse text,
  indikatorer text,
  tiltak text,
  relevante_kilder text
);

insert into risk_categories (kategori, beskrivelse, indikatorer, tiltak, relevante_kilder) values
  ('Planstrategisk risiko', 'Risiko for konflikt med overordnede planer, kommuneplan eller strategiske føringer.', 'Motstrid til kommuneplanens arealdel, temakart, endrede politiske føringer.', 'Tidlig screening mot kommuneplan/KDP, dialog med planmyndighet, scenarioanalyse.', 'PBL §11-5, Kommuneplanens arealdel, Statlige planretningslinjer'),
  ('Politisk risiko', 'Risiko for avslag, forsinkelse eller endrede rammer som følge av politisk behandling.', 'Nyvalg, lokal motstand, medieomtale, endrede prioriteringer.', 'Bygg relasjoner, tidlig informasjon, lokal medvirkning, politisk forankring.', 'PBL kap. 12, kommuneloven, HR-2021-953-A (Mortensrud-dommen)'),
  ('Juridisk risiko', 'Risiko for ugyldighet, klage eller rettslige feil i prosess eller vedtak.', 'Mangelfull KU, saksbehandlingsfeil, overskridelse av hjemmel.', 'Kvalitetssikring av prosess, juridisk forhåndsvurdering, revisjon av bestemmelser.', 'PBL §§12-7, 12-10, 17-3, Forvaltningsloven §41'),
  ('Prosessrisiko / tidsrisiko', 'Risiko for lang behandlingstid, omarbeiding eller nye planrunder.', 'Manglende kapasitet i kommunen, omarbeiding, etatskonflikt.', 'Prosjektstyring, tidlig dialog, parallellbehandling av tema, milepælsplan.', 'PBL §12-8, planprogram, KU-forskrift'),
  ('Rekkefølge- og gjennomføringsrisiko', 'Risiko for at rekkefølgekrav og infrastrukturpålegg gir uforholdsmessige kostnader eller forsinkelser.', 'Krav om opparbeidelse av vei/VA/skole uten proporsjonalitet, uenighet om utbyggingsavtale.', 'Forhandling, faseinndeling, kostnadsanalyse, alternativ planbestemmelse.', 'PBL §12-7 nr.10, HR-2021-953-A, LB-2019-135154'),
  ('Økonomisk og finansiell risiko', 'Risiko for verdifall eller reduserte marginer som følge av planutfall eller pålegg.', 'Lavere utnyttelse, krav om sosial infrastruktur, markedsendring.', 'Sensitivitetsanalyse, buffer i kalkyle, risikojustert avkastningskrav.', 'PBL §12-7, Kommunal- og distriktsdep. veiledere om utbyggingsavtaler'),
  ('Miljø- og temabasert risiko', 'Risiko for at miljøforhold eller hensynssoner begrenser eller stopper plan.', 'Flom, støy, kulturminne, naturmangfold, hensynssoner.', 'Tidlig KU/ROS, datainnsamling, justering av arealformål.', 'PBL §12-6, KU-forskrift, NVE-retningslinjer, RPR for klima'),
  ('Koordineringsrisiko', 'Risiko for forsinkelser og konflikt mellom sektormyndigheter.', 'Uenighet mellom SVV, VAV, Byantikvaren, Statsforvalteren.', 'Koordineringsmøter, referatstruktur, felles planforståelse.', 'PBL §3-2, plan- og samordningsprinsippet'),
  ('Sosial og medvirkningsrisiko', 'Risiko for motstand fra naboer, organisasjoner eller lokalsamfunn.', 'Høringsuttalelser, media, mobilisering.', 'Tidlig medvirkning, visualisering, transparens, tydelig konsekvensformidling.', 'PBL §§5-1, 12-8, Medvirkningsveilederen (KDD)'),
  ('Innholdsmessig risiko', 'Risiko for at endelig regulering ikke gir ønsket utnyttelse, volum eller funksjon.', 'Endrede byggegrenser, lavere utnyttelse, krav til arkitektur.', 'Dialog med saksbehandler, alternativ plan, arkitektonisk kvalitet som forhandlingsverdi.', 'PBL §§12-7, 12-10'),
  ('Endrings- og stabilitetsrisiko', 'Risiko for at reguleringen endres eller oppheves før realisering.', 'Ny kommuneplan, revidert KDP, statlige føringer.', 'Faseinndelt prosjektstrategi, sikring av rettsvirkning, tidlig rammesøknad.', 'PBL §§12-4, 12-14, 13-1'),
  ('Datagrunnlagsrisiko', 'Risiko for feil eller utdatert kunnskapsgrunnlag i planprosessen.', 'Gamle temakart, feil høydegrunnlag, manglende støy- eller flomdata.', 'Datavalidering, oppdatert grunnlagsdokumentasjon, kvalitetskontroll.', 'PBL §4-2, KU-forskrift, SOSI-standarder');
