import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../supabase/admin.ts";
import {
  fetchMatchesByCompetition,
  fetchMatchesGlobal,
  FootballDataApiError,
  getFootballDataConfig,
} from "./client.ts";
import { dedupeFootballMatches, normalizeFootballDataMatch } from "./mapper.ts";
import { upsertFootballMatch, type FootballMatchDbClient } from "./upsert.ts";
import type {
  FootballDataCompetitionCode,
  FootballSyncStats,
} from "./types";

type SupabaseLike = SupabaseClient;

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function getDefaultFootballSyncRange(now = new Date()) {
  const config = getFootballDataConfig();
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + config.syncDaysAhead);
  return {
    dateFrom: toDateOnly(now),
    dateTo: toDateOnly(to),
    competitions: config.competitions,
  };
}

export function shouldSyncFullSeasonCompetition(
  competition: FootballDataCompetitionCode,
  fullSeasonCompetitions: FootballDataCompetitionCode[] = ["WC"]
) {
  return fullSeasonCompetitions
    .map((item) => item.toUpperCase())
    .includes(competition.toUpperCase());
}

async function insertSyncLog(supabase: SupabaseLike, stats: FootballSyncStats, startedAt: string) {
  await supabase.from("football_data_sync_logs").insert({
    status: stats.status,
    fetched: stats.fetched,
    inserted: stats.inserted,
    updated: stats.updated,
    skipped: stats.skipped,
    errors_json: stats.errors,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
  });
}

export async function syncFootballMatches({
  dateFrom,
  dateTo,
  competitions,
  supabase,
}: {
  dateFrom: string;
  dateTo: string;
  competitions?: FootballDataCompetitionCode[];
  supabase?: SupabaseLike;
}): Promise<FootballSyncStats> {
  const startedAt = new Date().toISOString();
  const db = supabase ?? createAdminClient();
  const config = getFootballDataConfig();
  const targetCompetitions = competitions ?? config.competitions;
  const errors: string[] = [];
  const rawMatches = [];

  if (targetCompetitions.length > 0) {
    for (const competition of targetCompetitions) {
      try {
        const fullSeason = shouldSyncFullSeasonCompetition(
          competition,
          config.fullSeasonCompetitions
        );
        rawMatches.push(
          ...(await fetchMatchesByCompetition(
            competition,
            fullSeason ? undefined : dateFrom,
            fullSeason ? undefined : dateTo
          ))
        );
      } catch (error) {
        const message =
          error instanceof FootballDataApiError
            ? `${competition}: ${error.message}`
            : `${competition}: ${error instanceof Error ? error.message : "Error desconocido"}`;
        console.warn(`[football-data] ${message}`);
        errors.push(message);
      }
    }
  } else {
    try {
      rawMatches.push(...(await fetchMatchesGlobal(dateFrom, dateTo)));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      console.warn(`[football-data] global: ${message}`);
      errors.push(message);
    }
  }

  const stats: FootballSyncStats = {
    status: "ok",
    fetched: rawMatches.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors,
  };

  const normalized = [];
  for (const rawMatch of rawMatches) {
    try {
      normalized.push(normalizeFootballDataMatch(rawMatch));
    } catch (error) {
      stats.skipped++;
      stats.errors.push(error instanceof Error ? error.message : "Partido omitido.");
    }
  }

  for (const match of dedupeFootballMatches(normalized)) {
    try {
      const result = await upsertFootballMatch(db as unknown as FootballMatchDbClient, match);
      if (result.inserted) stats.inserted++;
      if (result.updated) stats.updated++;
    } catch (error) {
      stats.skipped++;
      stats.errors.push(error instanceof Error ? error.message : "No se pudo guardar partido.");
    }
  }

  stats.status = stats.errors.length > 0 ? (stats.inserted + stats.updated > 0 ? "partial" : "error") : "ok";

  try {
    await insertSyncLog(db, stats, startedAt);
  } catch (error) {
    console.warn("[football-data] No se pudo guardar el log de sync", error);
  }

  return stats;
}
