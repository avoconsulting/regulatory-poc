/**
 * Laster og formaterer kundens kuraterte risikobibliotek for AI-prompten.
 *
 * CLAUDE.md: "AI-analysen skal matche mot og utvide disse bibliotekene,
 * ikke finne opp flagg fra scratch." Denne modulen er broen mellom seed-
 * tabellen i 002_seed_risk_library.sql og prompt-konstruksjonen i analyse.ts.
 *
 * Formatet er tett (én linje per flagg/kategori) for å holde prompt-kostnaden
 * lav. Full beskrivelse ligger i DB hvis vi senere vil rendere flaggene i UI.
 */
import { createClient } from "@supabase/supabase-js";

export interface CuratedRedFlag {
  rang: number;
  navn: string;
  beskrivelse: string | null;
  sannsynlighet: string | null;
  konsekvens: string | null;
  verdipaavirkning: string | null;
  risikokategori: string | null;
  datakilder: string | null;
}

export interface CuratedRiskCategory {
  kategori: string;
  beskrivelse: string | null;
  indikatorer: string | null;
  tiltak: string | null;
  relevante_kilder: string | null;
}

export interface RiskLibrary {
  redFlags: CuratedRedFlag[];
  riskCategories: CuratedRiskCategory[];
}

// Modul-nivå cache. Biblioteket endres bare ved DB-migrasjon (sjelden), så vi
// trenger ikke re-fetche per request. Ved første kall populeres cachen.
let cached: RiskLibrary | null = null;

export async function loadRiskLibrary(): Promise<RiskLibrary> {
  if (cached) return cached;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: redFlags, error: rfErr }, { data: riskCategories, error: rcErr }] =
    await Promise.all([
      supabase.from("red_flags").select("*").order("rang"),
      supabase.from("risk_categories").select("*").order("kategori"),
    ]);

  if (rfErr) throw new Error(`Henting av red_flags feilet: ${rfErr.message}`);
  if (rcErr) throw new Error(`Henting av risk_categories feilet: ${rcErr.message}`);

  cached = {
    redFlags: (redFlags ?? []) as CuratedRedFlag[],
    riskCategories: (riskCategories ?? []) as CuratedRiskCategory[],
  };
  return cached;
}

// ──────────────────────────────────────────────
// Formatering for prompt
// ──────────────────────────────────────────────

export function formatRiskLibraryForPrompt(lib: RiskLibrary): string {
  const lines: string[] = [
    "## Kundens kuraterte risikobibliotek",
    "",
    "Dette er fagansvarliges referansematerial. AI-analysen skal *matche mot og utvide* dette, ikke finne opp flagg fra scratch.",
    "",
    "### 15 kuraterte red flags",
    "",
  ];

  for (const f of lib.redFlags) {
    const parts = [
      `**${f.rang}. ${f.navn}**`,
      f.beskrivelse,
      f.sannsynlighet ? `Sannsynlighet: ${f.sannsynlighet}` : null,
      f.konsekvens ? `Konsekvens: ${f.konsekvens}` : null,
      f.verdipaavirkning ? `Verdipåvirkning: ${f.verdipaavirkning}` : null,
      f.risikokategori ? `Risikonivå: ${f.risikokategori}` : null,
    ].filter(Boolean);
    lines.push(`- ${parts.join(" — ")}`);
  }

  lines.push("", "### 12 overordnede risikokategorier", "");
  for (const c of lib.riskCategories) {
    const parts = [
      `**${c.kategori}**`,
      c.beskrivelse,
      c.indikatorer ? `Indikatorer: ${c.indikatorer}` : null,
    ].filter(Boolean);
    lines.push(`- ${parts.join(" — ")}`);
  }

  return lines.join("\n");
}
