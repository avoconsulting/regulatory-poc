import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  console.log(`URL: ${url.slice(0, 40)}…`);
  console.log(`Anon key: ${anon ? "set (" + anon.length + " chars)" : "MISSING"}`);
  console.log(`Service key: ${service ? "set (" + service.length + " chars)" : "MISSING"}`);

  for (const [label, key] of [["anon", anon], ["service", service]] as const) {
    const sb = createClient(url, key);
    const { count, error } = await sb
      .from("documents")
      .select("id", { count: "exact", head: true });
    console.log(`\n[${label}] documents-tabell: count=${count}, error=${error?.message ?? "none"}`);

    const { data, error: e2 } = await (sb.rpc as unknown as (
      fn: string,
      args: unknown
    ) => Promise<{ data: unknown[] | null; error: { message: string } | null }>)(
      "match_documents_reranked",
      {
        query_embedding: JSON.stringify(Array(1024).fill(0.001)),
        match_threshold: 0.0,
        match_count: 3,
      }
    );
    console.log(`[${label}] RPC match_documents_reranked: rows=${(data as unknown[] | null)?.length ?? 0}, error=${e2?.message ?? "none"}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
