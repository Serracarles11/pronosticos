import type {
  BetslipBuilderType,
  BetslipCurrency,
  BetslipExtractionResult,
  BetslipSelection,
  BetslipType,
} from "../providers/provider.ts";

const BETSLIP_TYPES = new Set<BetslipType>(["single", "combined", "unknown"]);
const CURRENCIES = new Set<BetslipCurrency>(["EUR", "USD", "GBP", null]);
const BUILDER_TYPES = new Set<BetslipBuilderType>(["mymatch", "betbuilder", "same_game_multi", null]);

export const BETSLIP_EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "bookmaker",
    "bookmakerConfidence",
    "type",
    "typeConfidence",
    "stake",
    "totalOdds",
    "potentialReturn",
    "currency",
    "boosterPercent",
    "selections",
    "warnings",
    "confidence",
  ],
  properties: {
    bookmaker: { type: ["string", "null"] },
    bookmakerConfidence: { type: "number", minimum: 0, maximum: 1 },
    type: { type: "string", enum: ["single", "combined", "unknown"] },
    typeConfidence: { type: "number", minimum: 0, maximum: 1 },
    stake: { type: ["number", "null"], minimum: 0 },
    totalOdds: { type: ["number", "null"], minimum: 1 },
    potentialReturn: { type: ["number", "null"], minimum: 0 },
    currency: { type: ["string", "null"], enum: ["EUR", "USD", "GBP", null] },
    boosterPercent: { type: ["number", "null"], minimum: 0 },
    selections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "event",
          "date",
          "market",
          "selection",
          "odds",
          "isBuilder",
          "builderType",
          "rawText",
          "confidence",
          "warnings",
        ],
        properties: {
          event: { type: ["string", "null"] },
          date: { type: ["string", "null"] },
          market: { type: ["string", "null"] },
          selection: { type: ["string", "null"] },
          odds: { type: ["number", "null"], minimum: 1 },
          isBuilder: { type: "boolean" },
          builderType: { type: ["string", "null"], enum: ["mymatch", "betbuilder", "same_game_multi", null] },
          rawText: { type: ["string", "null"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          warnings: { type: "array", items: { type: "string" } },
        },
      },
    },
    warnings: { type: "array", items: { type: "string" } },
    confidence: { type: "number", minimum: 0, maximum: 1 },
  },
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, 1000) : null;
}

function cleanNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

function clampConfidence(value: unknown, fallback = 0.5) {
  const number = cleanNumber(value) ?? fallback;
  return Math.max(0, Math.min(1, number));
}

function parseSelection(value: unknown): BetslipSelection | null {
  if (!isRecord(value)) return null;
  const builderType = cleanString(value.builderType);
  const normalizedBuilderType = BUILDER_TYPES.has(builderType as BetslipBuilderType)
    ? (builderType as BetslipBuilderType)
    : null;
  const warnings = Array.isArray(value.warnings) ? value.warnings.map(String).filter(Boolean) : [];

  return {
    event: cleanString(value.event),
    date: cleanString(value.date),
    market: cleanString(value.market),
    selection: cleanString(value.selection),
    odds: cleanNumber(value.odds),
    isBuilder: Boolean(value.isBuilder),
    builderType: normalizedBuilderType,
    rawText: cleanString(value.rawText),
    confidence: clampConfidence(value.confidence),
    warnings,
  };
}

export function parseBetslipExtractionJson(value: unknown): Omit<
  BetslipExtractionResult,
  "provider" | "model" | "calculatedTotalOdds" | "totalOddsMatch" | "rawText" | "rawProviderJson"
> {
  if (!isRecord(value)) throw new Error("La IA no devolvio un objeto JSON valido.");
  const type = cleanString(value.type);
  const currency = cleanString(value.currency);
  const selections = Array.isArray(value.selections)
    ? value.selections.map(parseSelection).filter((selection): selection is BetslipSelection => selection !== null)
    : [];

  return {
    bookmaker: cleanString(value.bookmaker),
    bookmakerConfidence: clampConfidence(value.bookmakerConfidence),
    type: BETSLIP_TYPES.has(type as BetslipType) ? (type as BetslipType) : "unknown",
    typeConfidence: clampConfidence(value.typeConfidence),
    stake: cleanNumber(value.stake),
    totalOdds: cleanNumber(value.totalOdds),
    potentialReturn: cleanNumber(value.potentialReturn),
    currency: CURRENCIES.has(currency as BetslipCurrency) ? (currency as BetslipCurrency) : null,
    boosterPercent: cleanNumber(value.boosterPercent),
    selections,
    warnings: Array.isArray(value.warnings) ? value.warnings.map(String).filter(Boolean) : [],
    confidence: clampConfidence(value.confidence),
  };
}
