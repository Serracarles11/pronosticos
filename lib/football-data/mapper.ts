import type {
  FootballDataRawMatch,
  FootballDataStatus,
  InternalMatchStatus,
  NormalizedFootballMatch,
} from "./types";
import {
  localizeFootballCompetitionName,
  localizeFootballTeamName,
} from "./localize.ts";

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalIso(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const UNKNOWN_TEAM_NAME = "Por definir";

export function mapFootballDataStatus(status?: FootballDataStatus | null): InternalMatchStatus {
  if (status === "IN_PLAY" || status === "PAUSED") return "live";
  if (status === "FINISHED") return "finished";
  if (status === "POSTPONED" || status === "SUSPENDED") return "postponed";
  if (status === "CANCELED") return "cancelled";
  return "scheduled";
}

export function normalizeFootballDataMatch(rawMatch: FootballDataRawMatch): NormalizedFootballMatch {
  const externalId = rawMatch.id == null ? "" : String(rawMatch.id);
  const kickoffAt = optionalIso(rawMatch.utcDate);
  const homeTeamName = optionalString(rawMatch.homeTeam?.name);
  const awayTeamName = optionalString(rawMatch.awayTeam?.name);
  const homeTeamShortName = optionalString(rawMatch.homeTeam?.shortName ?? rawMatch.homeTeam?.tla);
  const awayTeamShortName = optionalString(rawMatch.awayTeam?.shortName ?? rawMatch.awayTeam?.tla);

  if (!externalId || !kickoffAt) {
    throw new Error("Partido football-data incompleto.");
  }

  return {
    external_id: externalId,
    provider: "football-data.org",
    competition_code: optionalString(rawMatch.competition?.code),
    competition_name: localizeFootballCompetitionName(optionalString(rawMatch.competition?.name)),
    competition_emblem: optionalString(rawMatch.competition?.emblem),
    home_team_id: rawMatch.homeTeam?.id == null ? null : String(rawMatch.homeTeam.id),
    home_team_name: localizeFootballTeamName(homeTeamName ?? UNKNOWN_TEAM_NAME),
    home_team_short_name: homeTeamShortName ? localizeFootballTeamName(homeTeamShortName) : null,
    home_team_crest: optionalString(rawMatch.homeTeam?.crest),
    away_team_id: rawMatch.awayTeam?.id == null ? null : String(rawMatch.awayTeam.id),
    away_team_name: localizeFootballTeamName(awayTeamName ?? UNKNOWN_TEAM_NAME),
    away_team_short_name: awayTeamShortName ? localizeFootballTeamName(awayTeamShortName) : null,
    away_team_crest: optionalString(rawMatch.awayTeam?.crest),
    kickoff_at: kickoffAt,
    status: mapFootballDataStatus(rawMatch.status),
    matchday: optionalNumber(rawMatch.matchday),
    stage: optionalString(rawMatch.stage),
    group_name: optionalString(rawMatch.group),
    home_score: optionalNumber(rawMatch.score?.fullTime?.home),
    away_score: optionalNumber(rawMatch.score?.fullTime?.away),
    winner: optionalString(rawMatch.score?.winner),
    last_updated_provider: optionalIso(rawMatch.lastUpdated),
    raw_json: rawMatch,
  };
}

export function dedupeFootballMatches(matches: NormalizedFootballMatch[]) {
  const byExternalId = new Map<string, NormalizedFootballMatch>();
  for (const match of matches) {
    byExternalId.set(match.external_id, match);
  }
  return Array.from(byExternalId.values());
}
