import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInternalSearchHref } from "../lib/search-history.ts";

test("migrates legacy profile links to the public profile route", () => {
  assert.equal(normalizeInternalSearchHref("/perfil?user=analista_10"), "/u/analista_10");
});

test("keeps valid internal routes and blocks external navigation", () => {
  assert.equal(normalizeInternalSearchHref("/feed?q=laliga"), "/feed?q=laliga");
  assert.equal(normalizeInternalSearchHref("//example.com"), "/feed");
  assert.equal(normalizeInternalSearchHref("https://example.com"), "/feed");
});
