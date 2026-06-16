import { parseFootballDataMatchesResponse } from "./schemas.ts";
import type { FootballDataCompetitionCode, FootballDataRawMatch } from "./types";

const DEFAULT_BASE_URL = "https://api.football-data.org/v4";
const DEFAULT_COMPETITIONS = ["PL", "PD", "SA", "BL1", "FL1", "CL", "WC"];
const DEFAULT_FULL_SEASON_COMPETITIONS = ["WC"];

export type FootballDataConfig = {
  apiKey: string;
  baseUrl: string;
  syncDaysAhead: number;
  competitions: FootballDataCompetitionCode[];
  fullSeasonCompetitions: FootballDataCompetitionCode[];
};

export class FootballDataApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FootballDataApiError";
    this.status = status;
  }
}

function parseCompetitionList(value?: string) {
  return (value ?? DEFAULT_COMPETITIONS.join(","))
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

export function getFootballDataConfig(): FootballDataConfig {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY?.trim();
  if (!apiKey) throw new Error("Falta FOOTBALL_DATA_API_KEY.");

  return {
    apiKey,
    baseUrl: (process.env.FOOTBALL_DATA_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    syncDaysAhead: Math.max(1, Number(process.env.FOOTBALL_DATA_SYNC_DAYS_AHEAD ?? 14) || 14),
    competitions: parseCompetitionList(process.env.FOOTBALL_DATA_COMPETITIONS),
    fullSeasonCompetitions: parseCompetitionList(
      process.env.FOOTBALL_DATA_FULL_SEASON_COMPETITIONS ?? DEFAULT_FULL_SEASON_COMPETITIONS.join(",")
    ),
  };
}

function buildUrl(path: string, params: Record<string, string | undefined>, baseUrl: string) {
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  return url;
}

async function fetchFootballData(path: string, params: Record<string, string | undefined>) {
  const config = getFootballDataConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(buildUrl(path, params, config.baseUrl), {
      headers: {
        "X-Auth-Token": config.apiKey,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (response.status === 401) {
        throw new FootballDataApiError(401, "API key de football-data.org invalida.");
      }
      if (response.status === 429) {
        throw new FootballDataApiError(429, "Rate limit de football-data.org alcanzado.");
      }
      throw new FootballDataApiError(
        response.status,
        `football-data.org respondio ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`
      );
    }

    return response.json() as Promise<unknown>;
  } catch (error) {
    if (error instanceof FootballDataApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new FootballDataApiError(408, "Timeout consultando football-data.org.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMatchesByCompetition(
  competitionCode: FootballDataCompetitionCode,
  dateFrom?: string,
  dateTo?: string
): Promise<FootballDataRawMatch[]> {
  const data = await fetchFootballData(`/competitions/${encodeURIComponent(competitionCode)}/matches`, {
    dateFrom,
    dateTo,
  });
  return parseFootballDataMatchesResponse(data);
}

export async function fetchMatchesGlobal(
  dateFrom: string,
  dateTo: string
): Promise<FootballDataRawMatch[]> {
  const data = await fetchFootballData("/matches", { dateFrom, dateTo });
  return parseFootballDataMatchesResponse(data);
}
