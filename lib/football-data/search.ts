import type { SupabaseClient } from "@supabase/supabase-js";
import type { FootballMatchPickerItem } from "./types.ts";
import { footballTeamSearchTerms, localizeFootballMatch } from "./localize.ts";
import { futureIsoFloor } from "../upcoming-content.ts";

type SupabaseLike = SupabaseClient;

function cleanSearch(value?: string | null) {
  return (value ?? "").trim().replace(/[,%(){}]/g, " ").replace(/\s+/g, " ").slice(0, 80);
}

function isUuid(value?: string | null) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function getMatchesForPicker({
  id,
  query,
  dateFrom,
  dateTo,
  competitionCode,
  includeFinished = false,
  allowPastDates = false,
  limit = 20,
  supabase,
}: {
  id?: string | null;
  query?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  competitionCode?: string | null;
  includeFinished?: boolean;
  allowPastDates?: boolean;
  limit?: number;
  supabase?: SupabaseLike;
}): Promise<FootballMatchPickerItem[]> {
  const db = supabase ?? (await (await import("../supabase/server.ts")).createClient());
  let request = db
    .from("football_matches")
    .select(`
      id, external_id, competition_code, competition_name, competition_emblem,
      home_team_name, home_team_short_name, home_team_crest,
      away_team_name, away_team_short_name, away_team_crest,
      kickoff_at, status, home_score, away_score
    `)
    .order("kickoff_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (isUuid(id)) request = request.eq("id", id);
  request = request.gte(
    "kickoff_at",
    allowPastDates && dateFrom ? new Date(dateFrom).toISOString() : futureIsoFloor(dateFrom)
  );
  if (dateTo) request = request.lte("kickoff_at", new Date(dateTo).toISOString());
  if (competitionCode) request = request.eq("competition_code", competitionCode.toUpperCase());
  if (!includeFinished) request = request.not("status", "in", "(finished,cancelled)");

  const term = cleanSearch(query);
  if (term) {
    const filters = footballTeamSearchTerms(term)
      .map(cleanSearch)
      .filter(Boolean)
      .slice(0, 6)
      .flatMap((searchTerm) => {
        const pattern = `%${searchTerm}%`;
        return [
          `home_team_name.ilike.${pattern}`,
          `away_team_name.ilike.${pattern}`,
          `competition_name.ilike.${pattern}`,
          `competition_code.ilike.${pattern}`,
        ];
      });
    request = request.or(filters.join(","));
  }

  const { data, error } = await request;
  if (error) throw new Error(error.message);
  return ((data ?? []) as FootballMatchPickerItem[]).map(localizeFootballMatch);
}

export async function getTodayAndUpcomingMatches() {
  const now = new Date();
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + 7);
  return getMatchesForPicker({
    dateFrom: now.toISOString(),
    dateTo: to.toISOString(),
    limit: 30,
  });
}
