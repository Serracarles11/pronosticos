import assert from "node:assert/strict";
import test from "node:test";
import {
  futureIsoFloor,
  isUpcomingOrUndated,
  LIVE_PRONOSTICO_WINDOW_MS,
  upcomingPronosticoFilter,
} from "../lib/upcoming-content.ts";

const now = new Date("2026-06-16T10:00:00.000Z");

test("keeps undated, future and recently started pronosticos visible", () => {
  assert.equal(isUpcomingOrUndated(null, now), true);
  assert.equal(isUpcomingOrUndated("2026-06-16T10:00:00.000Z", now), true);
  assert.equal(isUpcomingOrUndated("2026-06-16T09:59:59.000Z", now), true);
  assert.equal(
    isUpcomingOrUndated(
      new Date(now.getTime() - LIVE_PRONOSTICO_WINDOW_MS - 1).toISOString(),
      now
    ),
    false
  );
});

test("builds the Supabase filter for upcoming or live pronosticos", () => {
  assert.equal(
    upcomingPronosticoFilter(now),
    "fecha_evento.is.null,fecha_evento.gte.2026-06-16T07:00:00.000Z"
  );
});

test("floors old match ranges to now for API match searches", () => {
  assert.equal(futureIsoFloor("2026-06-15T10:00:00.000Z", now), now.toISOString());
  assert.equal(
    futureIsoFloor("2026-06-17T10:00:00.000Z", now),
    "2026-06-17T10:00:00.000Z"
  );
});
