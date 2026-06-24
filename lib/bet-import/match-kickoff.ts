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
    .replace(/\b(?:and|y)\b/g, " ")
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

type MatchResolutionOptions = {
  includeFinished?: boolean;
  dateFrom?: string;
  dateTo?: string;
  preferredKickoffAt?: string | null;
};

function includesTeamPair(eventName: string, match: FootballMatchPickerItem) {
  const eventText = normalizeMatchText(eventName);
  const home = normalizeMatchText(match.home_team_name);
  const away = normalizeMatchText(match.away_team_name);

  if (!home || !away) return false;
  return eventText.includes(home) && eventText.includes(away);
}

function closestMatchToKickoff(
  matches: FootballMatchPickerItem[],
  preferredKickoffAt?: string | null
) {
  if (matches.length <= 1) return matches[0] ?? null;

  const preferredTime = preferredKickoffAt ? new Date(preferredKickoffAt).getTime() : NaN;
  if (!Number.isFinite(preferredTime)) return matches[0] ?? null;

  return matches.reduce((closest, match) => {
    const closestDiff = Math.abs(new Date(closest.kickoff_at).getTime() - preferredTime);
    const matchDiff = Math.abs(new Date(match.kickoff_at).getTime() - preferredTime);
    return matchDiff < closestDiff ? match : closest;
  });
}

export function findFootballMatchForImportedEvent(
  eventName: string,
  matches: FootballMatchPickerItem[],
  options: { preferredKickoffAt?: string | null } = {}
) {
  const teams = splitEventTeams(eventName);

  if (teams) {
    const [left, right] = teams.map(normalizeMatchText);
    const exactMatches = matches.filter((match) => {
      const home = normalizeMatchText(match.home_team_name);
      const away = normalizeMatchText(match.away_team_name);
      return (left === home && right === away) || (left === away && right === home);
    });
    const exact = closestMatchToKickoff(exactMatches, options.preferredKickoffAt);
    if (exact) return exact;

    const partialMatches = matches.filter((match) => {
      const home = normalizeMatchText(match.home_team_name);
      const away = normalizeMatchText(match.away_team_name);
      const leftHome = home.includes(left) || left.includes(home);
      const rightAway = away.includes(right) || right.includes(away);
      const leftAway = away.includes(left) || left.includes(away);
      const rightHome = home.includes(right) || right.includes(home);
      return (leftHome && rightAway) || (leftAway && rightHome);
    });
    const partial = closestMatchToKickoff(partialMatches, options.preferredKickoffAt);
    if (partial) return partial;
  }

  const includedMatches = matches.filter((match) => includesTeamPair(eventName, match));
  return closestMatchToKickoff(includedMatches, options.preferredKickoffAt);
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
  options: MatchResolutionOptions = {}
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
      dateTo: options.dateTo,
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
  options: MatchResolutionOptions = {}
) {
  const preferredKickoffAt = options.preferredKickoffAt ?? null;
  const preferredTime = preferredKickoffAt ? new Date(preferredKickoffAt).getTime() : NaN;
  const searchOptions = Number.isFinite(preferredTime)
    ? {
        ...options,
        includeFinished: options.includeFinished ?? true,
        dateFrom:
          options.dateFrom ??
          new Date(preferredTime - 36 * 60 * 60 * 1000).toISOString(),
        dateTo:
          options.dateTo ??
          new Date(preferredTime + 36 * 60 * 60 * 1000).toISOString(),
      }
    : options;
  let matches = await findMatchesForImportedEvent(supabase, eventName, searchOptions);
  if (matches.length === 0 && searchOptions !== options) {
    matches = await findMatchesForImportedEvent(supabase, eventName, {
      ...options,
      includeFinished: options.includeFinished ?? true,
      preferredKickoffAt: null,
    });
  }
  return findFootballMatchForImportedEvent(eventName, matches, { preferredKickoffAt });
}

export async function resolveImportedSelectionKickoffs(
  supabase: SupabaseClient,
  selections: ImportedBetSelection[],
  fallbackKickoffAt: string | null = null
) {
  const resolved = await resolveImportedSelectionKickoffMatches(supabase, selections, fallbackKickoffAt);
  return resolved.selections;
}

export async function resolveImportedSelectionKickoffMatches(
  supabase: SupabaseClient,
  selections: ImportedBetSelection[],
  fallbackKickoffAt: string | null = null
) {
  const matchCache = new Map<string, FootballMatchPickerItem | null>();
  const historicalDateFrom = new Date();
  historicalDateFrom.setUTCDate(historicalDateFrom.getUTCDate() - 370);

  const resolved = await Promise.all(
    selections.map(async (selection) => {
      if (!selection.eventName) return { selection, unresolvedEventName: null };

      const preferredKickoffAt = selection.kickoffAt ?? fallbackKickoffAt;
      const eventKey = [normalizeMatchText(selection.eventName), preferredKickoffAt ?? ""].join("|");
      if (!matchCache.has(eventKey)) {
        matchCache.set(
          eventKey,
          await resolveFootballMatchForEvent(supabase, selection.eventName, {
            includeFinished: true,
            dateFrom: preferredKickoffAt ? undefined : historicalDateFrom.toISOString(),
            preferredKickoffAt,
          })
        );
      }

      const match = matchCache.get(eventKey);
      if (!match) return { selection, unresolvedEventName: selection.eventName };

      return {
        selection: {
          ...selection,
          competition: selection.competition || match.competition_name || match.competition_code || "",
          kickoffAt: match.kickoff_at,
        },
        unresolvedEventName: null,
      };
    })
  );

  return {
    selections: resolved.map((item) => item.selection),
    unresolvedEventNames: Array.from(
      new Set(
        resolved
          .map((item) => item.unresolvedEventName)
          .filter((value): value is string => Boolean(value))
      )
    ),
  };
}
