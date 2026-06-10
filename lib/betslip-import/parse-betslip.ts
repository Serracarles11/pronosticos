import type { ParsedBetSlip } from "../bet-import/types.ts";
import { detectBookmaker } from "./detection/detect-bookmaker.ts";
import { detectTicketPattern } from "./detection/detect-ticket-pattern.ts";
import { calculateTotalOdds } from "./normalization/normalize-odds.ts";
import { normalizeOcrText, splitOcrLines } from "./normalization/normalize-text.ts";
import type { ParsedBetslip } from "./types.ts";
import { parseBet365BetSlipText } from "./parsers/parse-bet365.ts";
import { parseBetfairBetSlipText } from "./parsers/parse-betfair.ts";
import { parseBookmakerGenericBetSlipText } from "./parsers/parse-bookmaker-generic.ts";
import { parseGenericBetSlipText } from "./parsers/parse-generic.ts";
import { parsePartialSelectionList } from "./parsers/parse-partial-selection-list.ts";
import { parseWinamaxBetSlipText } from "./parsers/parse-winamax.ts";
import { validateSlip } from "./validation/validate-slip.ts";

function parseStructuredBetSlip(text: string): ParsedBetslip {
  const normalized = normalizeOcrText(text);
  const pattern = detectTicketPattern(normalized, splitOcrLines(normalized));
  if (pattern.ticketPattern === "partial_selection_list" || pattern.ticketPattern === "single_selection_card") {
    return validateSlip(parsePartialSelectionList(normalized));
  }

  const detection = detectBookmaker(normalized);

  if (detection.bookmaker === "winamax") return validateSlip(parseWinamaxBetSlipText(normalized));
  if (detection.bookmaker === "bet365") return validateSlip(parseBet365BetSlipText(normalized));
  if (detection.bookmaker === "betfair") return validateSlip(parseBetfairBetSlipText(normalized));
  if (detection.bookmaker !== "unknown") return validateSlip(parseBookmakerGenericBetSlipText(normalized, detection.bookmaker));
  return validateSlip(parseGenericBetSlipText(normalized));
}

export function toLegacyParsedBetSlip(parsed: ParsedBetslip): ParsedBetSlip {
  const selections = parsed.selections.map((selection) => ({
    eventName: selection.eventName,
    competition: selection.competition,
    market: selection.market,
    selection: selection.selection,
    odds: selection.odds,
    kickoffAt: selection.kickoffAt,
    confidence: selection.confidence,
    rawText: selection.rawText,
    rawLines: selection.rawLines,
    warnings: selection.warnings,
    fieldConfidence: selection.fieldConfidence,
    isBetBuilder: selection.isBetBuilder,
    builderType: selection.builderType,
  }));
  const totalOdds = calculateTotalOdds(selections) ?? parsed.totalOdds ?? parsed.totalOddsDetected;

  return {
    bookmaker: parsed.bookmaker,
    bookmakerConfidence: parsed.bookmakerConfidence,
    kind: parsed.type === "combined" ? "combinada" : "simple",
    type: parsed.type,
    typeConfidence: parsed.typeConfidence,
    ticketPattern: parsed.ticketPattern,
    ticketPatternConfidence: parsed.ticketPatternConfidence,
    sport: parsed.sport,
    competition: parsed.competition,
    eventName: parsed.eventName,
    market: parsed.market,
    selection: parsed.selection,
    selections,
    totalOdds,
    detectedTotalOdds: parsed.totalOddsDetected,
    totalOddsDetected: parsed.totalOddsDetected,
    totalOddsConfidence: parsed.totalOddsConfidence,
    calculatedTotalOdds: parsed.calculatedTotalOdds,
    potentialReturnDetected: parsed.potentialReturnDetected,
    potentialReturnConfidence: parsed.potentialReturnConfidence,
    boosterPercent: parsed.boosterPercent,
    boosterConfidence: parsed.boosterConfidence,
    totalOddsMatch: parsed.totalOddsMatch,
    warnings: parsed.warnings,
    corrections: parsed.corrections,
    orphanLines: parsed.orphanLines,
    orphanOdds: parsed.orphanOdds,
    stakeSimulated: parsed.stakeDetected,
    stakeDetected: parsed.stakeDetected,
    stakeConfidence: parsed.stakeConfidence,
    kickoffAt: parsed.eventDateDetected,
    eventDateDetected: parsed.eventDateDetected,
    currency: parsed.currency,
    confidence: parsed.confidence,
    rawText: parsed.rawText,
    debug: parsed.debug,
  };
}

export function parseBetSlipText(text: string): ParsedBetSlip {
  return toLegacyParsedBetSlip(parseStructuredBetSlip(text));
}

export { parseStructuredBetSlip };
