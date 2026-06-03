import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSocialUrl } from "../lib/social-links.ts";

test("normalizes supported HTTPS social URLs", () => {
  assert.equal(
    normalizeSocialUrl("instagram", "https://www.instagram.com/pulso/#perfil"),
    "https://www.instagram.com/pulso/"
  );
  assert.equal(normalizeSocialUrl("telegram", "https://t.me/pulso"), "https://t.me/pulso");
  assert.equal(normalizeSocialUrl("website", "https://example.com/profile"), "https://example.com/profile");
});

test("rejects executable or insecure URL schemes", () => {
  assert.throws(() => normalizeSocialUrl("website", "javascript:alert(1)"));
  assert.throws(() => normalizeSocialUrl("website", "http://example.com"));
  assert.throws(() => normalizeSocialUrl("website", "https://user:pass@example.com"));
});

test("rejects a URL from the wrong provider", () => {
  assert.throws(() => normalizeSocialUrl("instagram", "https://example.com/pulso"));
  assert.throws(() => normalizeSocialUrl("discord", "https://discord.example.com/invite"));
});

test("accepts empty optional fields", () => {
  assert.equal(normalizeSocialUrl("x", "  "), null);
});
