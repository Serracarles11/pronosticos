import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  findFootballMatchForImportedEvent,
  latestImportedKickoff,
  resolveFootballMatchForEvent,
  resolveImportedSelectionKickoffMatches,
} from "../lib/bet-import/match-kickoff.ts";
import { dedupeFootballMatches, mapFootballDataStatus, normalizeFootballDataMatch } from "../lib/football-data/mapper.ts";
import type { FootballMatchPickerItem } from "../lib/football-data/types.ts";
import { footballTeamSearchTerms, localizeFootballTeamName } from "../lib/football-data/localize.ts";
import { shouldSyncFullSeasonCompetition } from "../lib/football-data/sync.ts";
import { upsertFootballMatch } from "../lib/football-data/upsert.ts";

const rawMatch = {
  id: 123,
  utcDate: "2026-06-14T20:00:00Z",
  status: "FINISHED",
  matchday: 1,
  stage: "REGULAR_SEASON",
  group: "Group A",
  lastUpdated: "2026-06-14T22:00:00Z",
  competition: { code: "PD", name: "LaLiga", emblem: "https://example.com/laliga.png" },
  homeTeam: { id: 1, name: "Real Madrid", shortName: "Madrid", crest: "https://example.com/rma.png" },
  awayTeam: { id: 2, name: "Barcelona", shortName: "Barca", crest: "https://example.com/fcb.png" },
  score: { winner: "HOME_TEAM", fullTime: { home: 2, away: 1 } },
};

test("maps football-data statuses to internal statuses", () => {
  assert.equal(mapFootballDataStatus("SCHEDULED"), "scheduled");
  assert.equal(mapFootballDataStatus("TIMED"), "scheduled");
  assert.equal(mapFootballDataStatus("IN_PLAY"), "live");
  assert.equal(mapFootballDataStatus("PAUSED"), "live");
  assert.equal(mapFootballDataStatus("FINISHED"), "finished");
  assert.equal(mapFootballDataStatus("POSTPONED"), "postponed");
  assert.equal(mapFootballDataStatus("SUSPENDED"), "postponed");
  assert.equal(mapFootballDataStatus("CANCELED"), "cancelled");
});

test("normalizes football-data matches", () => {
  const match = normalizeFootballDataMatch(rawMatch);
  assert.equal(match.external_id, "123");
  assert.equal(match.provider, "football-data.org");
  assert.equal(match.competition_code, "PD");
  assert.equal(match.home_team_name, "Real Madrid");
  assert.equal(match.away_team_name, "Barcelona");
  assert.equal(match.status, "finished");
  assert.equal(match.home_score, 2);
  assert.equal(match.away_score, 1);
});

test("normalizes future knockout matches with unknown teams", () => {
  const match = normalizeFootballDataMatch({
    ...rawMatch,
    id: 456,
    status: "TIMED",
    stage: "LAST_16",
    homeTeam: null,
    awayTeam: null,
    score: { winner: null, fullTime: { home: null, away: null } },
  });

  assert.equal(match.external_id, "456");
  assert.equal(match.home_team_name, "Por definir");
  assert.equal(match.away_team_name, "Por definir");
  assert.equal(match.status, "scheduled");
});

test("localizes football-data team names for Spanish UI", () => {
  assert.equal(localizeFootballTeamName("Spain"), "Espana");
  assert.equal(localizeFootballTeamName("Algeria"), "Argelia");
  assert.equal(localizeFootballTeamName("Bosnia-Herzegovina"), "Bosnia y Herzegovina");
  assert.equal(localizeFootballTeamName("Cape Verde Islands"), "Cabo Verde");
  assert.equal(localizeFootballTeamName("Ivory Coast"), "Costa de Marfil");
  assert.equal(localizeFootballTeamName("Jordan"), "Jordania");
  assert.equal(localizeFootballTeamName("Korea Republic"), "Corea del Sur");
  assert.equal(footballTeamSearchTerms("Espana").includes("spain"), true);
  assert.equal(footballTeamSearchTerms("Bosnia y Herzegovina").includes("bosnia-herzegovina"), true);
});

test("dedupes matches by external id before upsert", () => {
  const match = normalizeFootballDataMatch(rawMatch);
  assert.equal(dedupeFootballMatches([match, { ...match, status: "scheduled" }]).length, 1);
});

test("syncs World Cup as a full active-season competition", () => {
  assert.equal(shouldSyncFullSeasonCompetition("WC"), true);
  assert.equal(shouldSyncFullSeasonCompetition("PD"), false);
  assert.equal(shouldSyncFullSeasonCompetition("CL", ["WC", "CL"]), true);
});

test("matches imported OCR events to stored football matches", () => {
  const matches: FootballMatchPickerItem[] = [
    {
      id: "match-1",
      external_id: "1",
      competition_code: "WC",
      competition_name: "Mundial",
      competition_emblem: null,
      home_team_name: "Canada",
      home_team_short_name: null,
      home_team_crest: null,
      away_team_name: "Catar",
      away_team_short_name: null,
      away_team_crest: null,
      kickoff_at: "2026-06-19T00:00:00.000Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    },
    {
      id: "match-2",
      external_id: "2",
      competition_code: "WC",
      competition_name: "Mundial",
      competition_emblem: null,
      home_team_name: "Francia",
      home_team_short_name: null,
      home_team_crest: null,
      away_team_name: "Senegal",
      away_team_short_name: null,
      away_team_crest: null,
      kickoff_at: "2026-06-16T19:00:00.000Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    },
  ];

  assert.equal(findFootballMatchForImportedEvent("Canadá - Catar", matches)?.id, "match-1");
  assert.equal(
    findFootballMatchForImportedEvent("Francia - Senegal - Francia - Senegal: Resultado Francia", matches)?.id,
    "match-2"
  );
});

test("uses detected kickoff as a hint when an imported event has multiple stored matches", () => {
  const matches: FootballMatchPickerItem[] = [
    {
      id: "early-match",
      external_id: "1",
      competition_code: "WC",
      competition_name: "Mundial",
      competition_emblem: null,
      home_team_name: "Canada",
      home_team_short_name: null,
      home_team_crest: null,
      away_team_name: "Catar",
      away_team_short_name: null,
      away_team_crest: null,
      kickoff_at: "2026-06-19T00:00:00.000Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    },
    {
      id: "late-match",
      external_id: "2",
      competition_code: "WC",
      competition_name: "Mundial",
      competition_emblem: null,
      home_team_name: "Canada",
      home_team_short_name: null,
      home_team_crest: null,
      away_team_name: "Catar",
      away_team_short_name: null,
      away_team_crest: null,
      kickoff_at: "2026-06-24T19:00:00.000Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    },
  ];

  assert.equal(
    findFootballMatchForImportedEvent("Canada - Catar", matches, {
      preferredKickoffAt: "2026-06-24T20:00:00.000Z",
    })?.id,
    "late-match"
  );
});

test("matches both teams instead of the next match for only the first imported team", () => {
  const matches: FootballMatchPickerItem[] = [
    {
      id: "switzerland-next",
      external_id: "1",
      competition_code: "WC",
      competition_name: "Mundial",
      competition_emblem: null,
      home_team_name: "Suiza",
      home_team_short_name: null,
      home_team_crest: null,
      away_team_name: "Alemania",
      away_team_short_name: null,
      away_team_crest: null,
      kickoff_at: "2026-07-01T19:00:00.000Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    },
    {
      id: "switzerland-bosnia",
      external_id: "2",
      competition_code: "WC",
      competition_name: "Mundial",
      competition_emblem: null,
      home_team_name: "Suiza",
      home_team_short_name: null,
      home_team_crest: null,
      away_team_name: "Bosnia-Herzegovina",
      away_team_short_name: null,
      away_team_crest: null,
      kickoff_at: "2026-06-24T19:00:00.000Z",
      status: "finished",
      home_score: null,
      away_score: null,
    },
  ];

  assert.equal(
    findFootballMatchForImportedEvent("Suiza - Bosnia y Herzegovina", matches)?.id,
    "switzerland-bosnia"
  );
});

test("does not resolve imported events from the first team alone", () => {
  const matches: FootballMatchPickerItem[] = [
    {
      id: "switzerland-next",
      external_id: "1",
      competition_code: "WC",
      competition_name: "Mundial",
      competition_emblem: null,
      home_team_name: "Suiza",
      home_team_short_name: null,
      home_team_crest: null,
      away_team_name: "Alemania",
      away_team_short_name: null,
      away_team_crest: null,
      kickoff_at: "2026-07-01T19:00:00.000Z",
      status: "scheduled",
      home_score: null,
      away_score: null,
    },
  ];

  assert.equal(findFootballMatchForImportedEvent("Suiza - Bosnia y Herzegovina", matches), null);
});

test("resolves finished matches when the imported kickoff points to a played match", async () => {
  const finishedMatch: FootballMatchPickerItem = {
    id: "switzerland-bosnia",
    external_id: "2",
    competition_code: "WC",
    competition_name: "Mundial",
    competition_emblem: null,
    home_team_name: "Suiza",
    home_team_short_name: null,
    home_team_crest: null,
    away_team_name: "Bosnia-Herzegovina",
    away_team_short_name: null,
    away_team_crest: null,
    kickoff_at: "2026-06-24T19:00:00.000Z",
    status: "finished",
    home_score: null,
    away_score: null,
  };

  function fakeClient() {
    return {
      from() {
        const query = {
          excludesFinished: false,
          select() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          gte() {
            return this;
          },
          lte() {
            return this;
          },
          or() {
            return this;
          },
          not() {
            this.excludesFinished = true;
            return this;
          },
          then(resolve: (value: { data: FootballMatchPickerItem[]; error: null }) => unknown) {
            return Promise.resolve({
              data: this.excludesFinished ? [] : [finishedMatch],
              error: null,
            }).then(resolve);
          },
        };
        return query;
      },
    };
  }

  const match = await resolveFootballMatchForEvent(
    fakeClient() as unknown as Parameters<typeof resolveFootballMatchForEvent>[0],
    "Suiza - Bosnia y Herzegovina",
    { preferredKickoffAt: "2026-06-24T19:00:00.000Z" }
  );

  assert.equal(match?.id, "switzerland-bosnia");
});

test("marks imported selections unresolved when only the first team's next match exists", async () => {
  const nextSwitzerlandMatch: FootballMatchPickerItem = {
    id: "switzerland-next",
    external_id: "1",
    competition_code: "WC",
    competition_name: "Mundial",
    competition_emblem: null,
    home_team_name: "Suiza",
    home_team_short_name: null,
    home_team_crest: null,
    away_team_name: "Alemania",
    away_team_short_name: null,
    away_team_crest: null,
    kickoff_at: "2026-07-01T19:00:00.000Z",
    status: "scheduled",
    home_score: null,
    away_score: null,
  };

  function fakeClient() {
    return {
      from() {
        const query = {
          select() {
            return this;
          },
          order() {
            return this;
          },
          limit() {
            return this;
          },
          gte() {
            return this;
          },
          lte() {
            return this;
          },
          or() {
            return this;
          },
          not() {
            return this;
          },
          then(resolve: (value: { data: FootballMatchPickerItem[]; error: null }) => unknown) {
            return Promise.resolve({
              data: [nextSwitzerlandMatch],
              error: null,
            }).then(resolve);
          },
        };
        return query;
      },
    };
  }

  const resolved = await resolveImportedSelectionKickoffMatches(
    fakeClient() as unknown as Parameters<typeof resolveImportedSelectionKickoffMatches>[0],
    [
      {
        eventName: "Suiza - Bosnia y Herzegovina",
        competition: "Mundial",
        market: "Resultado",
        selection: "Suiza",
        odds: 1.5,
        kickoffAt: null,
        confidence: 0.9,
        rawText: "",
      },
    ]
  );

  assert.deepEqual(resolved.unresolvedEventNames, ["Suiza - Bosnia y Herzegovina"]);
  assert.equal(resolved.selections[0].kickoffAt, null);
});

test("uses the latest matched kickoff to close combined imported picks", () => {
  const kickoff = latestImportedKickoff("2026-06-16T19:00:00.000Z", [
    {
      eventName: "Francia - Senegal",
      competition: "Mundial",
      market: "Resultado",
      selection: "Francia",
      odds: null,
      kickoffAt: "2026-06-16T19:00:00.000Z",
      confidence: 0.9,
      rawText: "",
    },
    {
      eventName: "Canada - Catar",
      competition: "Mundial",
      market: "Resultado",
      selection: "Canada",
      odds: null,
      kickoffAt: "2026-06-19T00:00:00.000Z",
      confidence: 0.9,
      rawText: "",
    },
  ]);

  assert.equal(kickoff, "2026-06-19T00:00:00.000Z");
});

test("upsert marks duplicate football matches as updated", async () => {
  const match = normalizeFootballDataMatch(rawMatch);
  const stored = new Map<string, { id: string }>();

  function fakeClient() {
    return {
      from() {
        const query = {
          externalId: "",
          select() {
            return this;
          },
          eq(_column: string, value: string) {
            this.externalId = value;
            return this;
          },
          async maybeSingle() {
            return { data: stored.get(this.externalId) ?? null, error: null };
          },
          upsert(payload: typeof match) {
            if (!stored.has(payload.external_id)) stored.set(payload.external_id, { id: "match-1" });
            return {
              select() {
                return this;
              },
              async maybeSingle() {
                return { data: stored.get(payload.external_id) ?? null, error: null };
              },
            };
          },
        };
        return query;
      },
    };
  }

  const client = fakeClient() as unknown as Parameters<typeof upsertFootballMatch>[0];
  assert.deepEqual(await upsertFootballMatch(client, match), {
    id: "match-1",
    inserted: true,
    updated: false,
  });
  assert.deepEqual(await upsertFootballMatch(client, match), {
    id: "match-1",
    inserted: false,
    updated: true,
  });
});

test("football-data API key is not referenced in client components", () => {
  const nuevoPage = readFileSync("app/nuevo/page.tsx", "utf8");
  assert.equal(nuevoPage.includes("FOOTBALL_DATA_API_KEY"), false);
  assert.equal(nuevoPage.includes("/api/football-matches/search"), true);
});
