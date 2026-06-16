import { isMissingOptionalSchema } from "@/lib/anti-spam/server";

type BookmakerRow = { id: string; bookmaker: string | null };
type BookmakerQueryResult = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};
export type PronosticoBookmakerSupabase = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => PromiseLike<BookmakerQueryResult>;
    };
  };
};

export async function fetchPronosticoBookmakers(
  supabase: PronosticoBookmakerSupabase,
  ids: string[]
) {
  if (ids.length === 0) return new Map<string, string | null>();

  const { data, error } = await supabase
    .from("pronosticos")
    .select("id, bookmaker")
    .in("id", ids);

  if (error) {
    if (!isMissingOptionalSchema(error)) {
      console.error("pronostico_bookmakers_error", error.message);
    }
    return new Map<string, string | null>();
  }

  return new Map(((data ?? []) as BookmakerRow[]).map((row) => [row.id, row.bookmaker]));
}
