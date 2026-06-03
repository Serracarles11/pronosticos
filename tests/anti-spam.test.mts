import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEventKey,
  decideModerationStatus,
  extractUrlsFromText,
  filterVisibleItemsForModeration,
  findBlockedWordsInText,
  hasRepeatedLinkUse,
  isFollowLimitExceeded,
  isMaxPicksPerMatchExceeded,
  isRateLimited,
  normalizeUrlForSpamCheck,
} from "../lib/anti-spam/pure.ts";

test("enforces anti-spam rate limits", () => {
  assert.equal(isRateLimited(5, 5), true);
  assert.equal(isRateLimited(4, 5), false);
  assert.equal(isMaxPicksPerMatchExceeded(5), true);
  assert.equal(isMaxPicksPerMatchExceeded(4), false);
  assert.equal(isFollowLimitExceeded(50), true);
  assert.equal(isFollowLimitExceeded(49), false);
});

test("normalizes public URLs and detects repeated links by URL or domain", () => {
  const link = normalizeUrlForSpamCheck("https://WWW.Example.com/pick/?utm_source=x&b=2&a=1");
  assert.deepEqual(link, {
    normalizedUrl: "https://www.example.com/pick?a=1&b=2",
    domain: "example.com",
  });

  const incoming = extractUrlsFromText("mira https://example.com/pick?a=1&b=2&utm_campaign=test");
  assert.equal(
    hasRepeatedLinkUse(
      [
        { normalizedUrl: "https://example.com/other", domain: "example.com" },
        { normalizedUrl: "https://example.com/next", domain: "example.com" },
        { normalizedUrl: "https://example.com/more", domain: "example.com" },
      ],
      incoming
    ),
    true
  );
  assert.throws(() => extractUrlsFromText("javascript:alert(1)"));
});

test("detects blocked words by severity", () => {
  const words = [
    { word: "promo rara", severity: "low" as const },
    { word: "estafa", severity: "medium" as const },
    { word: "ilegal", severity: "high" as const },
  ];

  assert.equal(findBlockedWordsInText("Esto parece una estafa", words).highestSeverity, "medium");
  assert.equal(findBlockedWordsInText("contenido ilegal", words).highestSeverity, "high");
  assert.equal(findBlockedWordsInText("sin coincidencias", words).highestSeverity, null);
});

test("decides moderation status for new users, links and blocked words", () => {
  assert.deepEqual(decideModerationStatus({ isNewUser: true, hasLink: true }), {
    blocked: false,
    status: "pending_review",
    reason: "new_user_link",
  });
  assert.equal(
    decideModerationStatus({ isNewUser: false, hasLink: false, blockedWordSeverity: "medium" }).status,
    "pending_review"
  );
  assert.equal(
    decideModerationStatus({ isNewUser: false, hasLink: false, blockedWordSeverity: "high" }).blocked,
    true
  );
  assert.equal(decideModerationStatus({ isNewUser: false, hasLink: true, isShadowbanned: true }).status, "approved");
});

test("filters pending, shadowbanned and muted content from public views", () => {
  const items = [
    { id: "a", user_id: "owner", moderation_status: "pending_review" as const },
    { id: "b", user_id: "shadow", moderation_status: "approved" as const, is_shadowbanned: true },
    { id: "c", user_id: "muted", moderation_status: "approved" as const },
    { id: "d", user_id: "ok", moderation_status: "approved" as const },
  ];

  assert.deepEqual(
    filterVisibleItemsForModeration(items, "viewer", new Set(["muted"])).map((item) => item.id),
    ["d"]
  );
  assert.deepEqual(
    filterVisibleItemsForModeration(items, "owner", new Set(["muted"])).map((item) => item.id),
    ["a", "d"]
  );
});

test("builds stable match keys with event id or normalized event name", () => {
  assert.equal(buildEventKey({ eventId: "ABC-1", evento: "Real Madrid vs Barca" }), "event:abc-1");
  assert.equal(
    buildEventKey({ deporte: "Futbol", competicion: "LaLiga", evento: "Real Madrid vs Barça", fechaEvento: "2026-06-03" }),
    "event-name:real-madrid-vs-barca"
  );
});
