import assert from "node:assert/strict";
import test from "node:test";
import {
  PRODUCTION_SITE_ORIGIN,
  getPublicSiteOrigin,
  getRequestSiteOrigin,
  normalizeSiteOrigin,
} from "../lib/site-url.ts";

function withEnv<T>(updates: Record<string, string | undefined>, callback: () => T) {
  const previous: Record<string, string | undefined> = {};
  for (const key of Object.keys(updates)) {
    previous[key] = process.env[key];
    const value = updates[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("normalizes public origins and rejects localhost unless explicitly allowed", () => {
  assert.equal(normalizeSiteOrigin("todosganamos.es"), PRODUCTION_SITE_ORIGIN);
  assert.equal(normalizeSiteOrigin("https://todosganamos.es/"), PRODUCTION_SITE_ORIGIN);
  assert.equal(normalizeSiteOrigin("http://localhost:3000"), null);
  assert.equal(
    normalizeSiteOrigin("http://localhost:3000", { allowLocalhost: true }),
    "http://localhost:3000"
  );
});

test("uses production domain when NEXT_PUBLIC_SITE_URL points to localhost in production", () => {
  withEnv({ NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, () => {
    assert.equal(getPublicSiteOrigin(), PRODUCTION_SITE_ORIGIN);
  });
});

test("google oauth origin ignores localhost env on production requests", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, () => {
    const headers = new Headers({
      host: "todosganamos.es",
      "x-forwarded-proto": "https",
    });
    assert.equal(getRequestSiteOrigin(headers), PRODUCTION_SITE_ORIGIN);
  });
});

test("google oauth still supports localhost during local development", () => {
  withEnv({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }, () => {
    const headers = new Headers({
      host: "localhost:3000",
      "x-forwarded-proto": "http",
    });
    assert.equal(getRequestSiteOrigin(headers), "http://localhost:3000");
  });
});
