import type { ParsedBetSlip } from "../../bet-import/types.ts";
import type { BetslipExtractionResult } from "../providers/provider.ts";

function firstText(...values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean) ?? "";
}

function kindFromType(type: BetslipExtractionResult["type"]): ParsedBetSlip["kind"] {
  return type === "single" ? "simple" : "combinada";
}

export function createReviewPayload(result: BetslipExtractionResult): ParsedBetSlip {
  const firstSelection = result.selections[0];
  const selections = result.selections.map((selection) => ({
    eventName: firstText(selection.event),
    competition: "",
    market: firstText(selection.market, selection.builderType ? "MyMatch" : null),
    selection: firstText(selection.selection),
    odds: selection.odds,
    kickoffAt: null,
    confidence: selection.confidence,
    rawText: selection.rawText ?? "",
    rawLines: selection.rawText ? [selection.rawText] : [],
    warnings: selection.warnings,
    fieldConfidence: {
      odds: selection.odds ? selection.confidence : undefined,
      eventName: selection.event ? selection.confidence : undefined,
      market: selection.market ? selection.confidence : undefined,
      selection: selection.selection ? selection.confidence : undefined,
    },
    isBetBuilder: selection.isBuilder,
    isBuilder: selection.isBuilder,
    builderType: selection.builderType,
    rawTime: selection.date,
  }));

  return {
    bookmaker: result.bookmaker ?? "unknown",
    bookmakerConfidence: result.bookmakerConfidence,
    kind: kindFromType(result.type),
    type: result.type,
    typeConfidence: result.typeConfidence,
    ticketPattern: result.stake || result.totalOdds ? "full_betslip" : "partial_selection_list",
    ticketPatternConfidence: result.confidence,
    sport: "Futbol",
    competition: "",
    eventName: firstText(firstSelection?.event, result.type === "combined" ? `Combinada (${result.selections.length} selecciones)` : null),
    market: firstText(firstSelection?.market),
    selection: firstText(firstSelection?.selection),
    selections,
    totalOdds: result.totalOdds ?? result.calculatedTotalOdds,
    detectedTotalOdds: result.totalOdds,
    totalOddsDetected: result.totalOdds,
    totalOddsConfidence: result.totalOdds ? result.confidence : 0,
    calculatedTotalOdds: result.calculatedTotalOdds,
    potentialReturnDetected: result.potentialReturn,
    potentialReturnConfidence: result.potentialReturn ? result.confidence : 0,
    boosterPercent: result.boosterPercent,
    boosterConfidence: result.boosterPercent ? result.confidence : 0,
    totalOddsMatch: result.totalOddsMatch,
    warnings: result.warnings,
    corrections: [],
    orphanLines: [],
    orphanOdds: [],
    stakeSimulated: result.stake,
    stakeDetected: result.stake,
    stakeConfidence: result.stake ? result.confidence : 0,
    kickoffAt: null,
    eventDateDetected: firstSelection?.date ?? null,
    currency: result.currency,
    confidence: result.confidence,
    rawText: result.rawText ?? "",
    debug: {
      parser: result.provider === "openai" ? "openai-vision" : "tesseract-fallback",
      bookmakerHints: result.bookmaker ? [result.bookmaker] : [],
      ticketPatternHints: [],
      lineCount: result.rawText?.split("\n").filter(Boolean).length ?? 0,
    },
    extractionProvider: result.provider,
    extractionModel: result.model ?? null,
    extractionConfidence: result.confidence,
    rawProviderJson: result.rawProviderJson,
  };
}
