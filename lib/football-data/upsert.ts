import type { NormalizedFootballMatch } from "./types";

export type FootballMatchDbClient = {
  from(table: "football_matches"): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
    upsert(
      match: NormalizedFootballMatch,
      options: { onConflict: string }
    ): {
      select(columns: string): {
        maybeSingle(): Promise<{ data: { id: string } | null; error: { message: string } | null }>;
      };
    };
  };
};

export async function upsertFootballMatch(
  supabase: FootballMatchDbClient,
  match: NormalizedFootballMatch
) {
  const { data: existing, error: existingError } = await supabase
    .from("football_matches")
    .select("id")
    .eq("external_id", match.external_id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);

  const { data, error } = await supabase
    .from("football_matches")
    .upsert(match, { onConflict: "external_id" })
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    id: data?.id ?? existing?.id ?? null,
    inserted: !existing,
    updated: !!existing,
  };
}
