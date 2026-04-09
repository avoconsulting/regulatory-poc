"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  searchAddresses,
  fetchPropertyAndMunicipality,
  fetchReguleringsplan,
  fetchPlanbestemmelser,
} from "./actions";
import type { Adresse, EiendomRespons, Kommune } from "@/lib/kartverket";
import type { ReguleringsplanResultat } from "@/lib/reguleringsplan";
import type { PlanbestemmelserResultat } from "@/lib/planbestemmelser";
import {
  plantypeTekst,
  planstatusTekst,
  arealformaalTekst,
} from "@/lib/reguleringsplan";

export default function TestKartverketPage() {
  const [query, setQuery] = useState("");
  const [addresses, setAddresses] = useState<Adresse[]>([]);
  const [totalHits, setTotalHits] = useState<number | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<Adresse | null>(null);
  const [eiendom, setEiendom] = useState<EiendomRespons | null>(null);
  const [kommune, setKommune] = useState<Kommune | null>(null);
  const [regplan, setRegplan] = useState<ReguleringsplanResultat | null>(null);
  const [bestemmelser, setBestemmelser] =
    useState<PlanbestemmelserResultat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setError(null);
    setSelectedAddress(null);
    setEiendom(null);
    setKommune(null);
    setRegplan(null);
    setBestemmelser(null);

    startTransition(async () => {
      const result = await searchAddresses(query);
      if (result.ok) {
        setAddresses(result.data.adresser);
        setTotalHits(result.data.metadata.totaltAntallTreff);
      } else {
        setError(result.error);
        setAddresses([]);
        setTotalHits(null);
      }
    });
  }

  function handleSelectAddress(adresse: Adresse) {
    setSelectedAddress(adresse);
    setError(null);
    setRegplan(null);
    setBestemmelser(null);

    startTransition(async () => {
      const result = await fetchPropertyAndMunicipality(
        adresse.kommunenummer,
        adresse.gardsnummer,
        adresse.bruksnummer
      );
      if (result.ok) {
        setEiendom(result.eiendom);
        setKommune(result.kommune);
      } else {
        setError(result.error);
        setEiendom(null);
        setKommune(null);
      }

      if (adresse.representasjonspunkt) {
        const rpResult = await fetchReguleringsplan(
          adresse.representasjonspunkt.lat,
          adresse.representasjonspunkt.lon
        );
        if (rpResult.ok) {
          setRegplan(rpResult.data);
        }

        const bestResult = await fetchPlanbestemmelser(
          adresse.representasjonspunkt.lat,
          adresse.representasjonspunkt.lon,
          adresse.kommunenummer,
          adresse.gardsnummer,
          adresse.bruksnummer
        );
        if (bestResult.ok) {
          setBestemmelser(bestResult.data);
        }
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Kartverket API-test</h1>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder="Sok etter adresse..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Soker..." : "Sok"}
        </Button>
      </form>

      {error && (
        <Card className="border-destructive">
          <CardContent className="text-destructive text-sm">{error}</CardContent>
        </Card>
      )}

      {totalHits !== null && (
        <p className="text-sm text-muted-foreground">
          {totalHits} treff totalt — viser {addresses.length}
        </p>
      )}

      {addresses.length > 0 && (
        <div className="space-y-2">
          {addresses.map((a, i) => (
            <button
              key={`${a.adressekode}-${a.nummer}-${a.bokstav}-${i}`}
              onClick={() => handleSelectAddress(a)}
              disabled={isPending}
              className="w-full text-left rounded-lg border p-3 hover:bg-muted transition-colors disabled:opacity-50"
            >
              <div className="font-medium">{a.adressetekst}</div>
              <div className="text-sm text-muted-foreground">
                {a.postnummer} {a.poststed} — {a.kommunenavn} ({a.kommunenummer})
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                gnr/bnr: {a.gardsnummer}/{a.bruksnummer}
                {a.festenummer > 0 && `/${a.festenummer}`}
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedAddress && (
        <Card>
          <CardHeader>
            <CardTitle>Valgt adresse</CardTitle>
            <CardDescription>{selectedAddress.adressetekst}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Postnummer</dt>
              <dd>{selectedAddress.postnummer} {selectedAddress.poststed}</dd>
              <dt className="text-muted-foreground">Kommune</dt>
              <dd>{selectedAddress.kommunenavn} ({selectedAddress.kommunenummer})</dd>
              <dt className="text-muted-foreground">Gnr/Bnr</dt>
              <dd>{selectedAddress.gardsnummer}/{selectedAddress.bruksnummer}</dd>
              {selectedAddress.representasjonspunkt && (
                <>
                  <dt className="text-muted-foreground">Koordinater</dt>
                  <dd>
                    {selectedAddress.representasjonspunkt.lat},{" "}
                    {selectedAddress.representasjonspunkt.lon}
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      )}

      {kommune && (
        <Card>
          <CardHeader>
            <CardTitle>Kommuneinfo</CardTitle>
            <CardDescription>Fra kommuneinfo-API-et</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Kommunenavn</dt>
              <dd>{kommune.kommunenavnNorsk}</dd>
              <dt className="text-muted-foreground">Kommunenummer</dt>
              <dd>{kommune.kommunenummer}</dd>
              <dt className="text-muted-foreground">Fylke</dt>
              <dd>{kommune.fylkesnavn} ({kommune.fylkesnummer})</dd>
              <dt className="text-muted-foreground">Samisk forvaltningsomrade</dt>
              <dd>{kommune.samiskForvaltningsomrade ? "Ja" : "Nei"}</dd>
            </dl>
          </CardContent>
        </Card>
      )}

      {eiendom && eiendom.features.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Eiendomsdata</CardTitle>
            <CardDescription>
              {eiendom.features.length} teig(er) funnet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {eiendom.features.map((f, i) => (
              <div key={i} className="rounded-md border p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{f.properties.objekttype}</Badge>
                  <span className="font-medium text-sm">
                    {f.properties.matrikkelnummertekst}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Kommunenummer</dt>
                  <dd>{f.properties.kommunenummer}</dd>
                  <dt className="text-muted-foreground">Gnr/Bnr/Fnr/Snr</dt>
                  <dd>
                    {f.properties.gardsnummer}/{f.properties.bruksnummer}/
                    {f.properties.festenummer}/{f.properties.seksjonsnummer}
                  </dd>
                  <dt className="text-muted-foreground">Noyaktighetsklasse</dt>
                  <dd>{f.properties.nøyaktighetsklasseteig}</dd>
                  {f.geometry?.coordinates && (
                    <>
                      <dt className="text-muted-foreground">Koordinater</dt>
                      <dd>
                        {f.geometry.coordinates[1]}, {f.geometry.coordinates[0]}
                      </dd>
                    </>
                  )}
                  <dt className="text-muted-foreground">Oppdatert</dt>
                  <dd>{f.properties.oppdateringsdato}</dd>
                </dl>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {eiendom && eiendom.features.length === 0 && (
        <Card>
          <CardContent className="text-sm text-muted-foreground">
            Ingen eiendomsdata funnet for denne adressen.
          </CardContent>
        </Card>
      )}

      {regplan && (
        <Card>
          <CardHeader>
            <CardTitle>Reguleringsplan</CardTitle>
            <CardDescription>
              Fra DiBK Nasjonal arealplanbase (NAP)
              {regplan.planomrader.length === 0 &&
                " — ingen plandata funnet (kommunen kan mangle i NAP)"}
            </CardDescription>
          </CardHeader>
          {regplan.planomrader.length > 0 && (
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">
                  Planomrader ({regplan.planomrader.length})
                </h3>
                {regplan.planomrader.map((p, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {plantypeTekst(p.plantype)}
                      </Badge>
                      <Badge variant="outline">
                        {planstatusTekst(p.planstatus)}
                      </Badge>
                    </div>
                    <div className="font-medium text-sm mt-1">{p.plannavn}</div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-1">
                      <dt className="text-muted-foreground">Plan-ID</dt>
                      <dd>{p["arealplanId.planidentifikasjon"]}</dd>
                      <dt className="text-muted-foreground">Kommune</dt>
                      <dd>{p["arealplanId.kommunenummer"]}</dd>
                      {p.ikrafttredelsesdato && (
                        <>
                          <dt className="text-muted-foreground">Ikrafttredelse</dt>
                          <dd>{p.ikrafttredelsesdato.slice(0, 10)}</dd>
                        </>
                      )}
                      {p.oppdateringsdato && (
                        <>
                          <dt className="text-muted-foreground">Oppdatert</dt>
                          <dd>{p.oppdateringsdato.slice(0, 10)}</dd>
                        </>
                      )}
                    </dl>
                    {p.link && (
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary underline underline-offset-2 mt-1 inline-block"
                      >
                        Se plan i arealplaner.no
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {regplan.arealformaal.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Arealformaal ({regplan.arealformaal.length})
                  </h3>
                  {regplan.arealformaal.map((a, i) => (
                    <div key={i} className="rounded-md border p-3 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>
                          {arealformaalTekst(a.reguleringsformål)}
                        </Badge>
                        {a.reguleringsformålsutdyping && (
                          <Badge variant="outline">
                            {a.reguleringsformålsutdyping}
                          </Badge>
                        )}
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-1">
                        <dt className="text-muted-foreground">Plan-ID</dt>
                        <dd>{a["arealplanId.planidentifikasjon"]}</dd>
                        {a["utnytting.utnyttingstall"] != null && (
                          <>
                            <dt className="text-muted-foreground">Utnyttingstall</dt>
                            <dd>{a["utnytting.utnyttingstall"]}</dd>
                          </>
                        )}
                        {a.feltbetegnelse && (
                          <>
                            <dt className="text-muted-foreground">Felt</dt>
                            <dd>{a.feltbetegnelse}</dd>
                          </>
                        )}
                      </dl>
                    </div>
                  ))}
                </div>
              )}

              {regplan.hensynssoner.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Hensynssoner ({regplan.hensynssoner.length})
                  </h3>
                  {regplan.hensynssoner.map((h, i) => (
                    <div key={i} className="rounded-md border p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">Hensynssone</Badge>
                        {h.hensynSonenavn && (
                          <span className="text-sm">{h.hensynSonenavn}</span>
                        )}
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-1">
                        <dt className="text-muted-foreground">Kategori</dt>
                        <dd>{h.hensynskategori ?? "Ukjent"}</dd>
                        <dt className="text-muted-foreground">Plan-ID</dt>
                        <dd>{h["arealplanId.planidentifikasjon"]}</dd>
                      </dl>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}
      {bestemmelser && (
        <Card>
          <CardHeader>
            <CardTitle>Planbestemmelser</CardTitle>
            <CardDescription>
              Fra Planslurpen + arealplaner.no — {bestemmelser.planregisterPlaner.length} plan(er) funnet,{" "}
              {bestemmelser.planMedBestemmelser.length} med dokumenter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bestemmelser.planMedBestemmelser.map((pmb, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{pmb.plan.planType}</Badge>
                  <Badge variant="outline">{pmb.plan.planStatus}</Badge>
                </div>
                <div className="font-medium text-sm">{pmb.plan.planNavn}</div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Plan-ID</dt>
                  <dd>{pmb.plan.planId}</dd>
                  {pmb.plan.iKraft && (
                    <>
                      <dt className="text-muted-foreground">Ikrafttredelse</dt>
                      <dd>{pmb.plan.iKraft.slice(0, 10)}</dd>
                    </>
                  )}
                </dl>

                {pmb.bestemmelser.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">
                      Bestemmelser ({pmb.bestemmelser.length})
                    </h4>
                    {pmb.bestemmelser.map((dok) => (
                      <div
                        key={dok.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Badge variant="default">PDF</Badge>
                        <a
                          href={dok.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          {dok.dokumentnavn}
                        </a>
                        {dok.dokumentdato && (
                          <span className="text-muted-foreground">
                            ({dok.dokumentdato.slice(0, 10)})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {pmb.dispensasjoner.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">
                      Dispensasjoner ({pmb.dispensasjoner.length})
                    </h4>
                    {pmb.dispensasjoner.map((disp) => (
                      <div key={disp.id} className="rounded border p-2 text-sm">
                        <div className="font-medium">
                          {disp.dispensasjonstype ?? "Dispensasjon"}
                        </div>
                        {disp.vedtaksdato && (
                          <span className="text-muted-foreground">
                            Vedtak: {disp.vedtaksdato.slice(0, 10)}
                          </span>
                        )}
                        {disp.beskrivelse && (
                          <p className="text-muted-foreground mt-1">
                            {disp.beskrivelse}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {pmb.alleDokumenter.length > pmb.bestemmelser.length && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      Alle dokumenter ({pmb.alleDokumenter.length})
                    </summary>
                    <ul className="mt-1 space-y-1 pl-4">
                      {pmb.alleDokumenter.map((dok) => (
                        <li key={dok.id}>
                          <a
                            href={dok.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2"
                          >
                            {dok.dokumentnavn}
                          </a>
                          <span className="text-muted-foreground ml-1">
                            ({dok.dokumenttype})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}

            {bestemmelser.planslurpStatuser.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  Planslurpen AI-tolkning
                </h3>
                {bestemmelser.planslurpStatuser.map((s) => (
                  <div key={s.id} className="rounded border p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          s.status.navn === "Ferdig" ? "default" : "secondary"
                        }
                      >
                        {s.status.navn}
                      </Badge>
                      <span>Plan {s.planId}</span>
                    </div>
                    <span className="text-muted-foreground">
                      AI v{s.aiVersjon}
                      {s.avsluttet &&
                        ` — ferdig ${s.avsluttet.slice(0, 10)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {bestemmelser.ikkeIArealplaner.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-muted-foreground">
                  Ikke funnet i arealplaner.no
                </h3>
                {bestemmelser.ikkeIArealplaner.map((p) => (
                  <div
                    key={`${p.kommunenummer}-${p.planidentifikasjon}`}
                    className="text-sm text-muted-foreground"
                  >
                    {p.plannavn} ({p.planidentifikasjon})
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
