# Sjekkliste: Ting å verifisere i kundens dokumentsamling

Etter kundemøte 16. april. Sjekk disse punktene når vi får tilgang til Harddisk-mappene.

---

## Innhold og dekning

- [ ] Finnes KMD-rundskriv i samlingen? Kunden fremhever disse som rettskilder — de bør ligge i Mappe 3 (Forvaltningspraksis KMD). Hvis de mangler, må vi skaffe dem selv.
- [ ] Er KU-forskriften inkludert i Mappe 1 (Lov og forskrift)? Kritisk for å flagge konsekvensutredningskrav tidlig.
- [ ] Ligger "Nasjonale forventninger til regional og kommunal planlegging" (utgis hvert 4. år) i samlingen? Hvis ikke — offentlig tilgjengelig, vi kan laste ned selv.
- [ ] Inneholder Mappe 5 (Kommunalpraksis) eksempler på område- og prosessavklaringer fra kommuner? Disse viser hva PBE typisk krever etter planinitiativ.
- [ ] Finnes det eksempler på stedsanalyser og ROS-analyser i samlingen? Relevant for å forstå hva Claude bør referere til.
- [ ] Er det dokumenter om krav til felles planlegging (PBL § 12-1)? Kunden nevner dette som viktig.
- [ ] Inneholder samlingen noe om endring fra næringsareal til boligareal? Kunden nevner at KMD-rundskriv dekker dette — sjekk at vi har det.
- [ ] Finnes det eksempler på *planfaglige vurderinger* fra PBE (det kommunen sammenfatter etter planinitiativ)? Disse er malen output vår bør følge — verdifulle som few-shot-eksempler for Claude.
- [ ] For referansecaser (inkl. Selma Ellefsens vei): har vi også reguleringsbestemmelser for *tilstøtende* eiendommer? Detaljregulering på nabotomt binder — vi må kunne teste at pipelinen henter naboplanene riktig.

## Filformater og kvalitet

- [ ] Hvilke filformater finnes? Pipelinen støtter PDF, DOCX og TXT. Sjekk om det er .xlsx, .pptx, .msg eller andre formater som trenger egen håndtering.
- [ ] Er PDF-ene søkbare (OCR) eller skannet? Skannede PDF-er gir tom tekst ved ekstraksjon — kan trenge OCR-steg.
- [ ] Omfang i GB — påvirker kostnaden for embedding-generering og tidsbruk.
- [ ] Er det duplikater? Samme dokument i flere mapper?

## Mappestruktur

- [ ] Matcher mappenavnene det vi forventer (starter med tall 1-7)? Pipelinen auto-detekterer kategori fra mappenavn.
- [ ] Er det undermapper som gir nyttig subcategory-info? F.eks. "1.2 TEK17" eller "5.3 Oslo kommune".
- [ ] Finnes "Referansesaker"-mappen nevnt i POC-planen? Denne er prioritet 2 men verdifull for presedens.

## Mangler vi bør etterspørre

- [ ] Planbestemmelser + fasit for Selma Ellefsens vei (egen forespørsel allerede sendt til Tom)
- [ ] Utbyggingsavtaler — ligger dette i Mappe 7, eller må vi be om konkrete eksempler?
- [ ] Dispensasjonsvedtak med begrunnelse — finnes dette i samlingen, eller er det kun tilgjengelig via Saksinnsyn/BankID?
