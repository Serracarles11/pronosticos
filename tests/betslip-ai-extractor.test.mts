import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { validateBetSlipImage } from "../lib/bet-import/validators.ts";
import type { BetslipExtractionResult, BetslipExtractorProvider } from "../lib/betslip-import/providers/provider.ts";
import { parseBetslipExtractionJson } from "../lib/betslip-import/schema/betslip-extraction-schema.ts";
import { extractBetslipFromImage } from "../lib/betslip-import/services/extract-betslip-from-image.ts";
import { createReviewPayload } from "../lib/betslip-import/services/create-review-payload.ts";
import { calculateExtractedTotalOdds } from "../lib/betslip-import/validation/calculate-total-odds.ts";
import { normalizeExtractedBetslip } from "../lib/betslip-import/validation/normalize-extracted-betslip.ts";
import { canPublishBetImport } from "../lib/bet-import/access.ts";

function baseExtraction(overrides: Partial<BetslipExtractionResult> = {}): BetslipExtractionResult {
  return {
    provider: "openai",
    model: "gpt-5-mini",
    bookmaker: "winamax",
    bookmakerConfidence: 0.95,
    type: "combined",
    typeConfidence: 0.95,
    stake: 3,
    totalOdds: 380,
    calculatedTotalOdds: null,
    totalOddsMatch: null,
    potentialReturn: 1140,
    currency: "EUR",
    boosterPercent: null,
    selections: [
      {
        event: "Canada - Bosnia y Herzegovina",
        date: "12/06/2026",
        market: "MyMatch",
        selection: "Jugador decisivo: Tajon Buchanan + Jugador decisivo: Edin Dzeko",
        odds: 20,
        isBuilder: true,
        builderType: "mymatch",
        rawText: null,
        confidence: 0.9,
        warnings: [],
      },
      {
        event: "Estados Unidos - Paraguay",
        date: "12/06/2026",
        market: "MyMatch",
        selection: "Jugador decisivo: Miguel Almiron",
        odds: 19,
        isBuilder: true,
        builderType: "mymatch",
        rawText: null,
        confidence: 0.9,
        warnings: [],
      },
    ],
    warnings: [],
    confidence: 0.9,
    rawText: null,
    rawProviderJson: {},
    ...overrides,
  };
}

test("valid OpenAI JSON is parsed and normalized", () => {
  const parsed = parseBetslipExtractionJson({
    bookmaker: "winamax",
    bookmakerConfidence: 0.95,
    type: "combined",
    typeConfidence: 0.95,
    stake: 3,
    totalOdds: 380,
    potentialReturn: 1140,
    currency: "EUR",
    boosterPercent: null,
    selections: baseExtraction().selections,
    warnings: [],
    confidence: 0.9,
  });

  const normalized = normalizeExtractedBetslip({
    provider: "openai",
    model: "gpt-5-mini",
    ...parsed,
    calculatedTotalOdds: null,
    totalOddsMatch: null,
  });

  assert.equal(normalized.bookmaker, "winamax");
  assert.equal(normalized.totalOdds, 380);
  assert.equal(normalized.calculatedTotalOdds, null);
  assert.equal(normalized.totalOddsMatch, null);
  assert.equal(normalized.selections.length, 3);
});

test("calculatedTotalOdds works with integer builder odds", () => {
  assert.equal(calculateExtractedTotalOdds(baseExtraction().selections), 380);
});

test("MyMatch builder conditions are split into separate review rows", () => {
  const review = createReviewPayload(normalizeExtractedBetslip(baseExtraction()));

  assert.equal(review.selections.length, 3);
  assert.equal(review.selections[0].market, "MyMatch");
  assert.equal(review.selections[0].isBuilder, true);
  assert.equal(review.selections[0].builderType, "mymatch");
  assert.equal(review.selections[0].selection, "Jugador decisivo: Tajon Buchanan");
  assert.equal(review.selections[1].selection, "Jugador decisivo: Edin Dzeko");
  assert.equal(review.selections[2].selection, "Jugador decisivo: Miguel Almiron");
  assert.equal(review.selections[0].odds, null);
});

test("total odds 380 is not converted into a selection", () => {
  const normalized = normalizeExtractedBetslip(baseExtraction({
    selections: [
      ...baseExtraction().selections,
      {
        event: null,
        date: null,
        market: null,
        selection: null,
        odds: 380,
        isBuilder: false,
        builderType: null,
        rawText: "Cuota 380",
        confidence: 0.4,
        warnings: [],
      },
    ],
  }));

  assert.equal(normalized.totalOdds, 380);
  assert.equal(normalized.selections.length, 3);
});

test("invalid JSON shape throws before review payload", () => {
  assert.throws(() => parseBetslipExtractionJson("not-json-object"));
});

test("OpenAI provider failure uses fallback when enabled", async () => {
  const primaryProvider: BetslipExtractorProvider = {
    name: "openai",
    async extract() {
      throw new Error("rate limit");
    },
  };
  const fallbackProvider: BetslipExtractorProvider = {
    name: "tesseract",
    async extract() {
      return baseExtraction({ provider: "tesseract", model: "tesseract:spa", confidence: 0.5 });
    },
  };

  const result = await extractBetslipFromImage(
    { imageBuffer: Buffer.from("image"), mimeType: "image/png", userId: "user-a" },
    { provider: "openai", primaryProvider, fallbackProvider, enableFallback: true }
  );

  assert.equal(result.provider, "tesseract");
  assert.ok(result.warnings.some((warning) => warning.includes("OCR basico")));
});

test("without fallback OpenAI provider failure bubbles up", async () => {
  const primaryProvider: BetslipExtractorProvider = {
    name: "openai",
    async extract() {
      throw new Error("missing key");
    },
  };

  await assert.rejects(
    extractBetslipFromImage(
      { imageBuffer: Buffer.from("image"), mimeType: "image/png", userId: "user-a" },
      { provider: "openai", primaryProvider, enableFallback: false }
    ),
    /missing key/
  );
});

test("Vercel runtime does not fall back to local Tesseract OCR", async () => {
  const previousVercel = process.env.VERCEL;
  const previousVercelEnv = process.env.VERCEL_ENV;
  const previousFallback = process.env.ENABLE_TESSERACT_FALLBACK;
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  delete process.env.ENABLE_TESSERACT_FALLBACK;

  const primaryProvider: BetslipExtractorProvider = {
    name: "openai",
    async extract() {
      throw new Error("missing key");
    },
  };
  const fallbackProvider: BetslipExtractorProvider = {
    name: "tesseract",
    async extract() {
      throw new Error("fallback should not run");
    },
  };

  try {
    await assert.rejects(
      extractBetslipFromImage(
        { imageBuffer: Buffer.from("image"), mimeType: "image/png", userId: "user-a" },
        { provider: "openai", primaryProvider, fallbackProvider }
      ),
      /missing key/
    );
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousVercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousVercelEnv;
    if (previousFallback === undefined) delete process.env.ENABLE_TESSERACT_FALLBACK;
    else process.env.ENABLE_TESSERACT_FALLBACK = previousFallback;
  }
});

test("SVG images are rejected for AI extraction uploads", () => {
  assert.equal(validateBetSlipImage({ name: "ticket.svg", size: 1200, type: "image/svg+xml" }).ok, false);
});

test("imports still require confirmation before publishing", () => {
  assert.equal(canPublishBetImport("processing"), false);
  assert.equal(canPublishBetImport("processed"), true);
  assert.equal(canPublishBetImport("confirmed"), false);
});

test("AI extraction migration adds provider metadata columns", () => {
  const migration = readFileSync("supabase/20_betslip_ai_extractor.sql", "utf8");
  assert.match(migration, /extraction_provider/i);
  assert.match(migration, /raw_provider_json/i);
  assert.match(migration, /validated_json/i);
});

test("OpenAI provider keeps API key server-side only", () => {
  const provider = readFileSync("lib/betslip-import/providers/openai-vision-provider.ts", "utf8");
  assert.match(provider, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(provider, /NEXT_PUBLIC_OPENAI_API_KEY/);
});
