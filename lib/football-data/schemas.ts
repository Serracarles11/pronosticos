import type { FootballDataMatchesResponse, FootballDataRawMatch } from "./types";

export function isFootballDataRawMatch(value: unknown): value is FootballDataRawMatch {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.id !== undefined && typeof item.homeTeam === "object" && typeof item.awayTeam === "object";
}

export function parseFootballDataMatchesResponse(value: unknown): FootballDataRawMatch[] {
  if (!value || typeof value !== "object") return [];
  const response = value as FootballDataMatchesResponse;
  if (!Array.isArray(response.matches)) return [];
  return response.matches.filter(isFootballDataRawMatch);
}
