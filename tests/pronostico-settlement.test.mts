import assert from "node:assert/strict";
import test from "node:test";
import {
  canSettlePronostico,
  getPronosticoSettlementAvailableAt,
} from "../lib/pronostico-settlement.ts";

const now = new Date("2026-06-17T12:00:00.000Z");

test("allows settling two hours after the estimated match end", () => {
  assert.equal(canSettlePronostico("2026-06-17T08:00:00.000Z", "pendiente", now), true);
});

test("does not allow settling before the settlement window or after it is already settled", () => {
  assert.equal(canSettlePronostico("2026-06-17T08:01:00.000Z", "pendiente", now), false);
  assert.equal(canSettlePronostico("2026-06-17T08:00:00.000Z", "acertada", now), false);
  assert.equal(canSettlePronostico(null, "pendiente", now), false);
});

test("calculates settlement availability from kickoff plus four hours", () => {
  assert.equal(
    getPronosticoSettlementAvailableAt("2026-06-17T18:00:00.000Z")?.toISOString(),
    "2026-06-17T22:00:00.000Z"
  );
});
