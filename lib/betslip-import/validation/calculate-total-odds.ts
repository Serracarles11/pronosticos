import type { BetslipSelection } from "../providers/provider.ts";

export function roundBetslipOdds(value: number) {
  return Math.round(value * 100) / 100;
}

export function calculateExtractedTotalOdds(selections: Pick<BetslipSelection, "odds">[]) {
  const odds = selections
    .map((selection) => selection.odds)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value >= 1.01);

  if (odds.length === 0) return null;
  return roundBetslipOdds(odds.reduce((acc, value) => acc * value, 1));
}

export function oddsApproximatelyMatch(left: number | null, right: number | null) {
  if (!left || !right) return null;
  return Math.abs(left - right) <= Math.max(0.03, right * 0.005);
}
