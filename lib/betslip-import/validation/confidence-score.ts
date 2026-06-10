import type { BetslipSelection, ParsedBetslip } from "../types.ts";

export function scoreSelection(selection: BetslipSelection) {
  const score =
    (selection.eventName ? 0.28 : 0) +
    (selection.market ? 0.14 : 0) +
    (selection.selection ? 0.2 : 0) +
    (selection.odds ? 0.3 : 0) +
    (selection.rawLines.length > 0 ? 0.08 : 0);
  return Math.min(0.98, Math.max(0.1, score));
}

export function scoreSlip(parsed: ParsedBetslip) {
  const selectionScore =
    parsed.selections.length > 0
      ? parsed.selections.reduce((acc, selection) => acc + selection.confidence, 0) / parsed.selections.length
      : 0.15;
  const totalScore = parsed.totalOddsMatch === false ? 0.45 : parsed.totalOddsDetected ? 0.75 : 0.45;
  return Math.min(
    0.98,
    Math.max(0.1, selectionScore * 0.7 + parsed.bookmakerConfidence * 0.1 + parsed.typeConfidence * 0.1 + totalScore * 0.1)
  );
}
