import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveFootballMatchForEvent } from "./bet-import/match-kickoff.ts";
import { parsePronosticoSelections } from "./pronostico-selections.ts";

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function historicalSearchStart(now = new Date()) {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - 370);
  return start.toISOString();
}

export async function resolvePronosticoMatchContext({
  supabase,
  evento,
  mercado,
  now = new Date(),
}: {
  supabase: SupabaseClient;
  evento: string;
  mercado: string;
  now?: Date;
}) {
  const selections = parsePronosticoSelections(mercado);
  const eventNames = unique([
    evento,
    ...selections.map((selection) => selection.eventName),
  ]);
  const matches = [];

  for (const eventName of eventNames) {
    const match = await resolveFootballMatchForEvent(supabase, eventName, {
      includeFinished: true,
      dateFrom: historicalSearchStart(now),
    });
    if (match) matches.push(match);
  }

  if (matches.length === 0) return null;

  const latest = matches.reduce((currentLatest, match) =>
    new Date(match.kickoff_at).getTime() > new Date(currentLatest.kickoff_at).getTime()
      ? match
      : currentLatest
  );
  const uniqueMatchIds = new Set(matches.map((match) => match.id));

  return {
    kickoffAt: latest.kickoff_at,
    footballMatchId: uniqueMatchIds.size === 1 ? latest.id : null,
    footballMatchExternalId: uniqueMatchIds.size === 1 ? latest.external_id : null,
    competition: unique(matches.map((match) => match.competition_name ?? match.competition_code ?? "")),
  };
}
