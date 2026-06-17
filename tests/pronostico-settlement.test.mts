import assert from "node:assert/strict";
import test from "node:test";
import { canSettlePronostico } from "../lib/pronostico-settlement.ts";

const now = new Date("2026-06-17T12:00:00.000Z");

test("allows settling a pending pick as soon as event time has passed", () => {
  assert.equal(canSettlePronostico("2026-06-17T11:59:00.000Z", "pendiente", now), true);
});

test("does not allow settling before event time or after it is already settled", () => {
  assert.equal(canSettlePronostico("2026-06-17T12:01:00.000Z", "pendiente", now), false);
  assert.equal(canSettlePronostico("2026-06-17T11:59:00.000Z", "acertada", now), false);
  assert.equal(canSettlePronostico(null, "pendiente", now), false);
});
