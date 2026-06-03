import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_AUTH_REDIRECT, normalizeAuthRedirect } from "../lib/auth-redirect.ts";

test("keeps safe internal redirects including query parameters", () => {
  assert.equal(normalizeAuthRedirect("/detalle?id=pick-1"), "/detalle?id=pick-1");
  assert.equal(normalizeAuthRedirect("/feed?q=laliga"), "/feed?q=laliga");
});

test("blocks external and recursive auth redirects", () => {
  assert.equal(normalizeAuthRedirect("https://example.com"), DEFAULT_AUTH_REDIRECT);
  assert.equal(normalizeAuthRedirect("//example.com"), DEFAULT_AUTH_REDIRECT);
  assert.equal(normalizeAuthRedirect("/auth/callback?next=/admin"), DEFAULT_AUTH_REDIRECT);
});
