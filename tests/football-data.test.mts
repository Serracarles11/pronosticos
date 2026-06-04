import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dedupeFootballMatches, mapFootballDataStatus, normalizeFootballDataMatch } from "../lib/football-data/mapper.ts";
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

test("dedupes matches by external id before upsert", () => {
  const match = normalizeFootballDataMatch(rawMatch);
  assert.equal(dedupeFootballMatches([match, { ...match, status: "scheduled" }]).length, 1);
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
