import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSocialUrl } from "../lib/social-links.ts";

test("normalizes supported HTTPS social URLs", () => {
  assert.equal(
    normalizeSocialUrl("instagram", "https://www.instagram.com/pulso/#perfil"),
    "https://www.instagram.com/pulso/"
  );
  assert.equal(normalizeSocialUrl("tiktok", "https://www.tiktok.com/@pulso"), "https://www.tiktok.com/pulso");
  assert.equal(normalizeSocialUrl("x", "https://x.com/pulso"), "https://x.com/pulso");
});

test("builds social URLs from usernames", () => {
  assert.equal(normalizeSocialUrl("instagram", "nombre_usuario"), "https://www.instagram.com/nombre_usuario/");
  assert.equal(normalizeSocialUrl("x", "@nombre"), "https://x.com/nombre");
  assert.equal(normalizeSocialUrl("tiktok", "nombre"), "https://www.tiktok.com/nombre");
});

test("rejects executable or insecure URL schemes", () => {
  assert.throws(() => normalizeSocialUrl("x", "javascript:alert(1)"));
  assert.throws(() => normalizeSocialUrl("x", "http://x.com/pulso"));
  assert.throws(() => normalizeSocialUrl("x", "https://user:pass@x.com/pulso"));
});

test("rejects a URL from the wrong provider", () => {
  assert.throws(() => normalizeSocialUrl("instagram", "https://example.com/pulso"));
  assert.throws(() => normalizeSocialUrl("tiktok", "https://instagram.com/pulso"));
  assert.throws(() => normalizeSocialUrl("x", "nombre con espacios"));
});

test("accepts empty optional fields", () => {
  assert.equal(normalizeSocialUrl("x", "  "), null);
});
