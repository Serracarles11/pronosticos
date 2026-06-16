import type { BetslipExtractionResult, BetslipSelection } from "../providers/provider.ts";
import { calculateExtractedTotalOdds, oddsApproximatelyMatch } from "./calculate-total-odds.ts";

function hasValidOdds(selection: BetslipSelection) {
  return typeof selection.odds === "number" && Number.isFinite(selection.odds) && selection.odds >= 1.01;
}

function hasUsableSelection(selection: BetslipSelection) {
  return Boolean(
    selection.event &&
      (selection.market || selection.selection) &&
      (hasValidOdds(selection) || selection.isBuilder)
  );
}

function confidenceWithStakeReturnCheck(result: BetslipExtractionResult) {
  if (!result.stake || !result.totalOdds || !result.potentialReturn) return result.confidence;
  const expected = result.stake * result.totalOdds;
  const matches = Math.abs(expected - result.potentialReturn) <= Math.max(0.05, result.potentialReturn * 0.01);
  return matches ? Math.min(1, result.confidence + 0.06) : result.confidence;
}

export function validateExtractedBetslip(result: BetslipExtractionResult): BetslipExtractionResult {
  const warnings = [...result.warnings];
  const validSelections = result.selections.filter(hasUsableSelection);
  const removed = result.selections.length - validSelections.length;
  if (removed > 0) warnings.push("Se eliminaron selecciones incompletas detectadas por la extraccion.");

  const calculatedTotalOdds = calculateExtractedTotalOdds(validSelections);
  const totalOddsMatch = oddsApproximatelyMatch(calculatedTotalOdds, result.totalOdds);
  if (validSelections.length >= 2 && result.type !== "combined") {
    warnings.push("Se ha marcado como combinada porque hay varias selecciones.");
  }
  if (totalOddsMatch === false) {
    warnings.push("La cuota calculada no coincide con la cuota total detectada. Revisa los datos.");
  }

  return {
    ...result,
    type: validSelections.length >= 2 ? "combined" : validSelections.length === 1 ? "single" : result.type,
    calculatedTotalOdds,
    totalOddsMatch,
    selections: validSelections,
    warnings: Array.from(new Set(warnings)),
    confidence: confidenceWithStakeReturnCheck({
      ...result,
      calculatedTotalOdds,
      totalOddsMatch,
      selections: validSelections,
      warnings,
    }),
  };
}
