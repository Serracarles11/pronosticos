import { calculateTotalOdds, oddsMatch } from "../normalization/normalize-odds.ts";

export function validateTotalOdds(selections: Array<{ odds: number | null }>, detectedTotalOdds: number | null) {
  const calculated = calculateTotalOdds(selections);
  return {
    calculated,
    match: oddsMatch(calculated, detectedTotalOdds),
  };
}
