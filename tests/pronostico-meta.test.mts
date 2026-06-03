import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPickCategory,
  normalizeBetCopyLink,
  normalizePickCategories,
} from "../lib/pronostico-meta.ts";

test("normalizes pick categories as safe slugs", () => {
  assert.deepEqual(normalizePickCategories("Quiniela, cuota alta, LaLiga!"), [
    "quiniela",
    "cuota-alta",
    "laliga",
  ]);
  assert.equal(formatPickCategory("cuota-alta"), "Cuota Alta");
});

test("validates optional HTTPS copy links", () => {
  assert.equal(normalizeBetCopyLink(""), null);
  assert.equal(normalizeBetCopyLink("https://example.com/betslip?id=1"), "https://example.com/betslip?id=1");
  assert.throws(() => normalizeBetCopyLink("javascript:alert(1)"));
  assert.throws(() => normalizeBetCopyLink("https://user:pass@example.com/bet"));
});
