"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { searchAddresses, runAnalysis } from "./actions";
import type { Adresse } from "@/lib/kartverket";
import type { RisikoAnalyse, RedFlag } from "@/lib/analyse";
import type { KuOutcome, KuTrigger } from "@/lib/ku-trigger";

// ──────────────────────────────────────────────
// Hjelpefunksjoner for visning
// ──────────────────────────────────────────────

function alvorlighetFarge(a: RedFlag["alvorlighet"]) {
  switch (a) {
    case "hard_stop":
      return "destructive";
    case "dispenserbar":
      return "default";
    case "akseptabel_risiko":
      return "secondary";
  }
}

function alvorlighetTekst(a: RedFlag["alvorlighet"]) {
  switch (a) {
    case "hard_stop":
      return "Hard stop";
    case "dispenserbar":
      return "Dispenserbar";
    case "akseptabel_risiko":
      return "Akseptabel risiko";
  }
}

function risikoFarge(r: string) {
  switch (r) {
    case "kritisk":
      return "destructive";
    case "høy":
      return "destructive";
    case "moderat":
      return "default";
    case "lav":
      return "secondary";
    default:
      return "outline";
  }
}

function kuOutcomeFarge(o: KuOutcome) {
  switch (o) {
    case "always_ku":
      return "destructive";
    case "must_assess":
      return "default";
    case "no_trigger":
      return "secondary";
  }
}

function kuOutcomeTekst(o: KuOutcome) {
  switch (o) {
    case "always_ku":
      return "KU obligatorisk";
    case "must_assess":
      return "Må vurderes";
    case "no_trigger":
      return "Ingen trigger";
  }
}

function kuSeverityFarge(s: KuTrigger["severity"]) {
  switch (s) {
    case "critical":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
  }
}

// ──────────────────────────────────────────────
// Steg-enum
// ──────────────────────────────────────────────

type Step = "adresse" | "tiltak" | "analyserer" | "resultat";

export default function AnalysePage() {
  const [step, setStep] = useState<Step>("adresse");

  // Adressesøk
  const [query, setQuery] = useState("");
  const [addresses, setAddresses] = useState<Adresse[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Adresse | null>(null);

  // Tiltak
  const [beskrivelse, setBeskrivelse] = useState("");
  const [byggehøyde, setByggehøyde] = useState("");
  const [utnyttelsesgrad, setUtnyttelsesgrad] = useState("");
  const [bruksformål, setBruksformål] = useState("");
  const [antallEnheter, setAntallEnheter] = useState("");
  const [annet, setAnnet] = useState("");

  // Resultat
  const [analyse, setAnalyse] = useState<RisikoAnalyse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // ────────── Adressesøk ──────────

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setError(null);

    startTransition(async () => {
      const result = await searchAddresses(query);
      if (result.ok) {
        setAddresses(result.data.adresser);
      } else {
        setError(result.error);
      }
    });
  }

  function handleSelectAddress(adresse: Adresse) {
    setSelectedAddress(adresse);
    setAddresses([]);
    setStep("tiltak");
  }

  // ────────── Analyse ──────────

  function handleRunAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAddress || !beskrivelse.trim()) return;
    setError(null);
    setStep("analyserer");

    startTransition(async () => {
      const result = await runAnalysis(
        selectedAddress.adressetekst,
        selectedAddress.kommunenavn,
        selectedAddress.kommunenummer,
        selectedAddress.gardsnummer,
        selectedAddress.bruksnummer,
        selectedAddress.representasjonspunkt.lat,
        selectedAddress.representasjonspunkt.lon,
        {
          beskrivelse,
          byggehøyde: byggehøyde ? Number(byggehøyde) : undefined,
          utnyttelsesgrad: utnyttelsesgrad
            ? Number(utnyttelsesgrad)
            : undefined,
          bruksformål: bruksformål || undefined,
          antallEnheter: antallEnheter ? Number(antallEnheter) : undefined,
          annet: annet || undefined,
        }
      );

      if (result.ok) {
        setAnalyse(result.data);
        setStep("resultat");
      } else {
        setError(result.error);
        setStep("tiltak");
      }
    });
  }

  function handleReset() {
    setStep("adresse");
    setSelectedAddress(null);
    setAnalyse(null);
    setQuery("");
    setBeskrivelse("");
    setByggehøyde("");
    setUtnyttelsesgrad("");
    setBruksformål("");
    setAntallEnheter("");
    setAnnet("");
    setError(null);
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reguleringsrisikoanalyse</h1>
          <p className="text-muted-foreground text-sm">
            Legg inn tomt og tiltak — få en AI-drevet risikovurdering
          </p>
        </div>
        {step !== "adresse" && (
          <Button variant="outline" onClick={handleReset}>
            Start på nytt
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="text-destructive text-sm pt-4">
            {error}
          </CardContent>
        </Card>
      )}

      {/* ── Steg 1: Adressesøk ── */}
      {step === "adresse" && (
        <Card>
          <CardHeader>
            <CardTitle>1. Velg eiendom</CardTitle>
            <CardDescription>
              Søk etter adresse for å identifisere eiendommen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                placeholder="Søk etter adresse..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={isPending}>
                {isPending ? "Søker..." : "Søk"}
              </Button>
            </form>

            {addresses.length > 0 && (
              <div className="space-y-2">
                {addresses.map((a, i) => (
                  <button
                    key={`${a.adressekode}-${a.nummer}-${a.bokstav}-${i}`}
                    onClick={() => handleSelectAddress(a)}
                    className="w-full text-left rounded-lg border p-3 hover:bg-muted transition-colors"
                  >
                    <div className="font-medium">{a.adressetekst}</div>
                    <div className="text-sm text-muted-foreground">
                      {a.postnummer} {a.poststed} — {a.kommunenavn} (
                      {a.kommunenummer}) — gnr/bnr: {a.gardsnummer}/
                      {a.bruksnummer}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Steg 2: Tiltak ── */}
      {step === "tiltak" && selectedAddress && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Valgt eiendom</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Adresse</dt>
                <dd>{selectedAddress.adressetekst}</dd>
                <dt className="text-muted-foreground">Kommune</dt>
                <dd>
                  {selectedAddress.kommunenavn} (
                  {selectedAddress.kommunenummer})
                </dd>
                <dt className="text-muted-foreground">Gnr/Bnr</dt>
                <dd>
                  {selectedAddress.gardsnummer}/{selectedAddress.bruksnummer}
                </dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Beskriv tiltaket</CardTitle>
              <CardDescription>
                Hva ønsker du å bygge eller endre på denne eiendommen?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRunAnalysis} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="beskrivelse">
                    Beskrivelse av tiltaket *
                  </Label>
                  <Textarea
                    id="beskrivelse"
                    placeholder="F.eks: Oppføring av boligblokk med 40 leiligheter i 6 etasjer, næring i 1. etasje, underjordisk parkering..."
                    value={beskrivelse}
                    onChange={(e) => setBeskrivelse(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="byggehøyde">Byggehøyde (meter)</Label>
                    <Input
                      id="byggehøyde"
                      type="number"
                      placeholder="F.eks. 21"
                      value={byggehøyde}
                      onChange={(e) => setByggehøyde(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="utnyttelsesgrad">
                      Utnyttelsesgrad (% BYA)
                    </Label>
                    <Input
                      id="utnyttelsesgrad"
                      type="number"
                      placeholder="F.eks. 60"
                      value={utnyttelsesgrad}
                      onChange={(e) => setUtnyttelsesgrad(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bruksformål">Bruksformål</Label>
                    <Input
                      id="bruksformål"
                      placeholder="F.eks. bolig, kombinert bolig/næring"
                      value={bruksformål}
                      onChange={(e) => setBruksformål(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="antallEnheter">Antall enheter</Label>
                    <Input
                      id="antallEnheter"
                      type="number"
                      placeholder="F.eks. 40"
                      value={antallEnheter}
                      onChange={(e) => setAntallEnheter(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="annet">Annet relevant</Label>
                  <Textarea
                    id="annet"
                    placeholder="Parkeringsløsning, uteoppholdsareal, tilpasning til terreng, osv."
                    value={annet}
                    onChange={(e) => setAnnet(e.target.value)}
                    rows={2}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isPending || !beskrivelse.trim()}
                  className="w-full"
                  size="lg"
                >
                  Analyser reguleringsrisiko
                </Button>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Steg 3: Analyserer ── */}
      {step === "analyserer" && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            <div className="text-center">
              <p className="font-medium">Analyserer reguleringsrisiko...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Henter plandata, bestemmelser og dispensasjonshistorikk, og
                kjører AI-analyse. Dette kan ta 15–30 sekunder.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Steg 4: Resultat ── */}
      {step === "resultat" && analyse && selectedAddress && (
        <>
          {/* Oppsummering */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Risikovurdering</CardTitle>
                <Badge
                  variant={risikoFarge(analyse.samletRisikovurdering)}
                  className="text-sm px-3 py-1"
                >
                  {analyse.samletRisikovurdering.toUpperCase()}
                </Badge>
              </div>
              <CardDescription>
                {selectedAddress.adressetekst} — gnr/bnr{" "}
                {selectedAddress.gardsnummer}/{selectedAddress.bruksnummer}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{analyse.oppsummering}</p>
            </CardContent>
          </Card>

          {/* KU-vurdering */}
          {analyse.kuVurdering && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Konsekvensutredning (KU)</CardTitle>
                  <Badge
                    variant={kuOutcomeFarge(analyse.kuVurdering.outcome)}
                    className="text-sm px-3 py-1"
                  >
                    {kuOutcomeTekst(analyse.kuVurdering.outcome)}
                  </Badge>
                </div>
                <CardDescription>
                  Vurdering basert på KU-forskriften, sted-kontekst og
                  tiltakets karakter (konfidens:{" "}
                  {analyse.kuVurdering.confidence})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed">
                  {analyse.kuVurdering.rationale}
                </p>

                {analyse.kuVurdering.triggers.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">
                      Identifiserte triggere ({analyse.kuVurdering.triggers.length})
                    </h3>
                    {analyse.kuVurdering.triggers.map((t, i) => (
                      <div
                        key={i}
                        className="rounded-lg border p-3 space-y-1 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium">{t.description}</div>
                          <Badge variant={kuSeverityFarge(t.severity)}>
                            {t.severity}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-3">
                          <span>Kategori: {t.category.replace("_", " ")}</span>
                          <span>Kilde: {t.sourceRef}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Red flags */}
          {analyse.redFlags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Red flags ({analyse.redFlags.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {analyse.redFlags.map((rf, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium">{rf.tittel}</h3>
                      <Badge variant={alvorlighetFarge(rf.alvorlighet)}>
                        {alvorlighetTekst(rf.alvorlighet)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rf.beskrivelse}
                    </p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Hjemmel: </span>
                        <span>{rf.hjemmel}</span>
                      </div>
                    </div>
                    <div className="text-sm bg-muted rounded p-2">
                      <span className="font-medium">Anbefaling: </span>
                      {rf.anbefaling}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Strategier */}
          {analyse.strategier.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Strategier</CardTitle>
                <CardDescription>
                  Ulike tilnærminger med forskjellig risikoprofil
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {analyse.strategier.map((s, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">{s.navn}</h3>
                      <Badge variant={risikoFarge(s.risikoprofil)}>
                        {s.risikoprofil} risiko
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {s.beskrivelse}
                    </p>
                    <div className="text-sm">
                      <span className="font-medium">Forventet utfall: </span>
                      {s.forventetUtfall}
                    </div>
                    {s.anbefalteJusteringer.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium">
                          Anbefalte justeringer:
                        </span>
                        <ul className="list-disc list-inside mt-1 space-y-1 text-muted-foreground">
                          {s.anbefalteJusteringer.map((j, ji) => (
                            <li key={ji}>{j}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {s.redFlags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.redFlags.map((rf, ri) => (
                          <Badge key={ri} variant="outline" className="text-xs">
                            {rf}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Oppsider */}
          {analyse.oppsider.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Oppsider og muligheter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analyse.oppsider.map((o, i) => (
                  <div key={i} className="rounded-lg border p-4 space-y-1">
                    <h3 className="font-medium">{o.tittel}</h3>
                    <p className="text-sm text-muted-foreground">
                      {o.beskrivelse}
                    </p>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Hjemmel: </span>
                      {o.hjemmel}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Potensial: </span>
                      {o.potensial}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Anbefalinger */}
          {analyse.anbefalinger.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Anbefalinger</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {analyse.anbefalinger.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span className="text-muted-foreground shrink-0">
                        {i + 1}.
                      </span>
                      {a}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Referanser */}
          {analyse.referanser.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Referanser</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {analyse.referanser.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
