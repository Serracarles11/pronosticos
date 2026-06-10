import type { BetslipSelection } from "../types.ts";
import { extractDateIso } from "../normalization/normalize-date.ts";
import { extractLineOdds, extractStandaloneOdds } from "../normalization/normalize-odds.ts";
import { cleanLine, normalizeToken, removeOddsFromLine, splitOcrLines } from "../normalization/normalize-text.ts";
import { normalizeEventTeams } from "../normalization/normalize-team-names.ts";
import { isBuilderMarket, normalizeMarket } from "../normalization/normalize-market.ts";
import { normalizeSelection } from "../normalization/normalize-selection.ts";

const TOTAL_HINTS = ["cuota total", "total odds", "cuota combinada", "cuota", "total stake"];
const STAKE_HINTS = ["stake", "importe", "apuesta", "unidades", "wager"];
const RETURN_HINTS = ["ganancia potencial", "posible ganancia", "ganancias", "retorno", "premio", "potential return"];
const BOOSTER_HINTS = ["combo booster", "booster", "bonus"];
const IGNORE_HINTS = [...TOTAL_HINTS, ...STAKE_HINTS, ...RETURN_HINTS, ...BOOSTER_HINTS, "cashout", "cash out"];

export function getLines(text: string) {
  return splitOcrLines(text);
}

export function isTotalLine(line: string) {
  const normalized = normalizeToken(line);
  return normalized === "cu" || TOTAL_HINTS.some((hint) => normalized.includes(hint));
}

export function isStakeLine(line: string) {
  const normalized = normalizeToken(line);
  return STAKE_HINTS.some((hint) => normalized.includes(hint));
}

export function isReturnLine(line: string) {
  const normalized = normalizeToken(line);
  return RETURN_HINTS.some((hint) => normalized.includes(hint));
}

export function isBoosterLine(line: string) {
  const normalized = normalizeToken(line);
  return BOOSTER_HINTS.some((hint) => normalized.includes(hint)) || /%/.test(line);
}

export function isIgnoredSlipLine(line: string) {
  const normalized = normalizeToken(line);
  return IGNORE_HINTS.some((hint) => normalized.includes(hint));
}

export function lineOdds(line: string) {
  const normalized = normalizeToken(line);
  const looksLikeMarketLine =
    /\b(over|under|mas|menos|goles|goals|corners|handicap|puntos|points)\b/i.test(normalized) &&
    !/(?:@|cuota)/i.test(line) &&
    !/^\s*\d{1,5}[.,]\d{1,4}\s*$/.test(line);
  if (looksLikeMarketLine) return null;
  return extractStandaloneOdds(line, 100) ?? extractLineOdds(line, 100);
}

export function extractEventName(line: string) {
  if (line.includes(":")) return { eventName: "", corrections: [] };
  const match = line.match(/\b([\p{L}][\p{L}\s.'-]{1,55})\s+(?:vs?|v|-)\s+([\p{L}][\p{L}\s.'-]{1,55})\b/iu);
  if (!match) return { eventName: "", corrections: [] };
  return normalizeEventTeams(match[1], match[2]);
}

export function extractTotalOdds(lines: string[]) {
  for (let i = 0; i < lines.length; i++) {
    const windowText = [lines[i], lines[i + 1], lines[i + 2]].filter(Boolean).join(" ");
    if (!isTotalLine(windowText)) continue;
    const odds = extractLineOdds(windowText);
    if (odds && odds >= 1.01) return odds;
  }
  return null;
}

export function extractNumberNearHints(lines: string[], predicate: (line: string) => boolean) {
  for (const line of lines) {
    if (!predicate(line)) continue;
    const numbers = [...line.matchAll(/(?<!\d)(\d{1,6}(?:[.,]\d{1,4})?)(?!\d)/g)]
      .map((match) => Number(match[1].replace(",", ".")))
      .filter(Number.isFinite);
    const value = numbers.at(-1);
    if (value && value > 0) return value;
  }
  return null;
}

export function splitMarketSelection(rawLines: string[]) {
  const value = rawLines
    .map((line) => (lineOdds(line) ? removeOddsFromLine(line) : cleanLine(line)))
    .filter(Boolean)
    .join(" | ");
  const builder = isBuilderMarket(value);
  if (builder) {
    const parts = value
      .replace(/bet builder|same game parlay|mymatch|my match/gi, "")
      .split(/\s+\+\s+|\s+\|\s+/)
      .map(cleanLine)
      .filter(Boolean);
    return {
      market: normalizeMarket(value.includes("MyMatch") || value.includes("mymatch") ? "MyMatch" : "Bet builder"),
      selection: parts.join(" + "),
      isBetBuilder: true,
      builderType: value.includes("MyMatch") || value.includes("mymatch") ? "MyMatch" : "Bet builder",
    };
  }

  const colonIndex = value.indexOf(":");
  if (colonIndex > 0) {
    return {
      market: normalizeMarket(value.slice(0, colonIndex)),
      selection: normalizeSelection(value.slice(colonIndex + 1)),
      isBetBuilder: false,
      builderType: null,
    };
  }

  const parts = value
    .split(/\s+\|\s+|;|\s+-\s+/)
    .map(cleanLine)
    .filter(Boolean);

  if (parts.length > 1) {
    return {
      market: normalizeMarket(parts.slice(0, -1).join(" - ")),
      selection: normalizeSelection(parts.at(-1) ?? ""),
      isBetBuilder: false,
      builderType: null,
    };
  }

  return {
    market: "",
    selection: normalizeSelection(value),
    isBetBuilder: false,
    builderType: null,
  };
}

export function buildSelection(input: {
  eventName: string;
  competition?: string;
  market: string;
  selection: string;
  odds: number | null;
  rawLines: string[];
  corrections?: string[];
  isBetBuilder?: boolean;
  builderType?: string | null;
}) {
  const warnings: string[] = [];
  if (!input.eventName) warnings.push("Evento no detectado con confianza.");
  if (!input.selection && !input.market) warnings.push("Mercado o seleccion incompletos.");
  if (!input.odds) warnings.push("Cuota no detectada.");

  const confidence =
    (input.eventName ? 0.28 : 0) +
    (input.odds ? 0.32 : 0) +
    (input.selection ? 0.2 : 0) +
    (input.market ? 0.1 : 0) +
    (input.rawLines.length <= 6 ? 0.08 : 0.03);

  return {
    eventName: input.eventName,
    competition: input.competition ?? "",
    market: input.market,
    selection: input.selection,
    odds: input.odds,
    kickoffAt: extractDateIso(input.rawLines.join(" ")),
    confidence: Math.min(0.98, Math.max(0.15, confidence)),
    rawText: input.rawLines.join(" | "),
    rawLines: input.rawLines,
    warnings,
    fieldConfidence: {
      eventName: input.eventName ? 0.85 : 0.2,
      market: input.market ? 0.75 : 0.35,
      selection: input.selection ? 0.78 : 0.3,
      odds: input.odds ? 0.92 : 0.1,
      kickoffAt: extractDateIso(input.rawLines.join(" ")) ? 0.7 : 0.15,
    },
    isBetBuilder: input.isBetBuilder ?? false,
    builderType: input.builderType ?? null,
  } satisfies BetslipSelection;
}

export function shouldSkipOddsLine(line: string) {
  return isTotalLine(line) || isStakeLine(line) || isReturnLine(line) || isBoosterLine(line) || isIgnoredSlipLine(line);
}
