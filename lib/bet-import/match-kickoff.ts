import type { SupabaseClient } from "@supabase/supabase-js";
import type { FootballMatchPickerItem } from "../football-data/types.ts";
import type { ImportedBetSelection } from "./types.ts";

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeMatchText(value: string) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function splitEventTeams(eventName: string) {
  const firstSegment = eventName.split(":")[0]?.trim() || eventName.trim();
  const parts = firstSegment
    .split(/\s+(?:-|–|—|vs\.?|v)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) return null;
  return [parts[0], parts[1]] as const;
}

function includesTeamPair(eventName: string, match: FootballMatchPickerItem) {
  const eventText = normalizeMatchText(eventName);
  const home = normalizeMatchText(match.home_team_name);
  const away = normalizeMatchText(match.away_team_name);

  if (!home || !away) return false;
  return eventText.includes(home) && eventText.includes(away);
}

export function findFootballMatchForImportedEvent(
  eventName: string,
  matches: FootballMatchPickerItem[]
) {
  const teams = splitEventTeams(eventName);

  if (teams) {
    const [left, right] = teams.map(normalizeMatchText);
    const exact = matches.find((match) => {
      const home = normalizeMatchText(match.home_team_name);
      const away = normalizeMatchText(match.away_team_name);
      return (left === home && right === away) || (left === away && right === home);
    });
    if (exact) return exact;

    const partial = matches.find((match) => {
      const home = normalizeMatchText(match.home_team_name);
      const away = normalizeMatchText(match.away_team_name);
      const leftHome = home.includes(left) || left.includes(home);
      const rightAway = away.includes(right) || right.includes(away);
      const leftAway = away.includes(left) || left.includes(away);
      const rightHome = home.includes(right) || right.includes(home);
      return (leftHome && rightAway) || (leftAway && rightHome);
    });
    if (partial) return partial;
  }

  return matches.find((match) => includesTeamPair(eventName, match)) ?? null;
}

function latestIsoDate(values: Array<string | null | undefined>) {
  const times = values
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => Number.isFinite(value));

  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

export function latestImportedKickoff(
  fallbackKickoffAt: string | null,
  selections: ImportedBetSelection[]
) {
  return latestIsoDate([fallbackKickoffAt, ...selections.map((selection) => selection.kickoffAt)]);
}

export async function findMatchesForImportedEvent(
  supabase: SupabaseClient,
  eventName: string,
  options: { includeFinished?: boolean; dateFrom?: string } = {}
) {
  const { getMatchesForPicker } = await import("../football-data/search.ts");
  const teams = splitEventTeams(eventName);
  const searchTerms = teams ? [teams[0], stripAccents(teams[0]), teams[1], stripAccents(teams[1])] : [eventName];
  const uniqueTerms = Array.from(new Set(searchTerms.map((term) => term.trim()).filter(Boolean)));
  const byId = new Map<string, FootballMatchPickerItem>();

  for (const query of uniqueTerms.slice(0, 4)) {
    const matches = await getMatchesForPicker({
      query,
      dateFrom: options.dateFrom,
      includeFinished: options.includeFinished,
      allowPastDates: options.includeFinished,
      limit: 30,
      supabase,
    });
    for (const match of matches) byId.set(match.id, match);
  }

  return Array.from(byId.values());
}

export async function resolveFootballMatchForEvent(
  supabase: SupabaseClient,
  eventName: string,
  options: { includeFinished?: boolean; dateFrom?: string } = {}
) {
  const matches = await findMatchesForImportedEvent(supabase, eventName, options);
  return findFootballMatchForImportedEvent(eventName, matches);
}

export async function resolveImportedSelectionKickoffs(
  supabase: SupabaseClient,
  selections: ImportedBetSelection[]
) {
  const matchCache = new Map<string, FootballMatchPickerItem | null>();

  return Promise.all(
    selections.map(async (selection) => {
      if (!selection.eventName) return selection;

      const eventKey = normalizeMatchText(selection.eventName);
      if (!matchCache.has(eventKey)) {
        matchCache.set(eventKey, await resolveFootballMatchForEvent(supabase, selection.eventName));
      }

      const match = matchCache.get(eventKey);
      if (!match) return selection;

      return {
        ...selection,
        competition: selection.competition || match.competition_name || match.competition_code || "",
        kickoffAt: match.kickoff_at,
      };
    })
  );
}
