import { parseWinamaxBetSlipText as parseLegacyWinamax } from "../../bet-import/parser.ts";
import type { BetslipSelection } from "../types.ts";
import { applyOcrCorrections } from "../normalization/ocr-corrections.ts";
import { calculateTotalOdds, oddsMatch } from "../normalization/normalize-odds.ts";
import { detectCurrency } from "../normalization/normalize-money.ts";
import { normalizeOcrText } from "../normalization/normalize-text.ts";
import { detectTicketPattern } from "../detection/detect-ticket-pattern.ts";
import { parseGenericBetSlipText } from "./parse-generic.ts";

function fromLegacySelection(selection: ReturnType<typeof parseLegacyWinamax>["selections"][number]) {
  return {
    ...selection,
    rawLines: selection.rawText.split("|").map((line) => line.trim()).filter(Boolean),
    warnings: [],
    fieldConfidence: {
      eventName: selection.eventName ? 0.9 : 0.2,
      market: selection.market ? 0.85 : 0.35,
      selection: selection.selection ? 0.85 : 0.35,
      odds: selection.odds ? 0.95 : 0.1,
      kickoffAt: selection.kickoffAt ? 0.7 : 0.15,
    },
    isBetBuilder: /mymatch|bet builder/i.test(selection.market),
    builderType: /mymatch/i.test(selection.market) ? "MyMatch" : null,
  } satisfies BetslipSelection;
}

export function parseWinamaxBetSlipText(text: string) {
  const corrected = applyOcrCorrections(text);
  const normalized = normalizeOcrText(corrected.text);
  const legacy = parseLegacyWinamax(normalized);
  if (legacy.selections.length === 0) return parseGenericBetSlipText(normalized, "winamax-generic");

  const selections = legacy.selections.map(fromLegacySelection);
  const calculatedTotalOdds = calculateTotalOdds(selections);
  const pattern = detectTicketPattern(normalized, selections.length);
  const warnings = [...legacy.warnings, ...corrected.corrections];

  if (legacy.detectedTotalOdds && oddsMatch(calculatedTotalOdds, legacy.detectedTotalOdds) === false) {
    warnings.push("La cuota total detectada no coincide con el producto de selecciones.");
  }

  return {
    bookmaker: "winamax" as const,
    bookmakerConfidence: 0.96,
    type: pattern.type,
    typeConfidence: pattern.confidence,
    ticketPattern: "full_betslip" as const,
    ticketPatternConfidence: pattern.confidence,
    sport: legacy.sport,
    competition: legacy.competition,
    eventName: legacy.eventName,
    market: legacy.market,
    selection: legacy.selection,
    selections,
    totalOdds: legacy.totalOdds,
    totalOddsDetected: legacy.detectedTotalOdds,
    totalOddsConfidence: legacy.detectedTotalOdds ? 0.9 : 0.2,
    calculatedTotalOdds,
    totalOddsMatch: legacy.totalOddsMatch,
    stakeDetected: legacy.stakeSimulated,
    stakeConfidence: legacy.stakeSimulated ? 0.75 : 0.15,
    potentialReturnDetected: legacy.potentialReturnDetected,
    potentialReturnConfidence: legacy.potentialReturnDetected ? 0.75 : 0.15,
    boosterPercent: legacy.boosterPercent,
    boosterConfidence: legacy.boosterPercent ? 0.8 : 0.15,
    currency: detectCurrency(normalized),
    eventDateDetected: legacy.kickoffAt,
    confidence: Math.min(0.97, selections.reduce((acc, item) => acc + item.confidence, 0) / selections.length),
    warnings: [...new Set(warnings)],
    corrections: [...new Set(corrected.corrections)],
    orphanLines: [],
    orphanOdds: [],
    rawText: normalized,
    debug: {
      parser: "winamax",
      bookmakerHints: ["winamax"],
      ticketPatternHints: pattern.hints,
      lineCount: normalized.split("\n").filter(Boolean).length,
    },
  };
}
