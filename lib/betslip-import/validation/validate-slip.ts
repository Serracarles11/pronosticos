import type { ParsedBetslip } from "../types.ts";
import { scoreSlip } from "./confidence-score.ts";
import { validateSelection } from "./validate-selection.ts";
import { validateTotalOdds } from "./validate-total-odds.ts";

export function validateSlip(parsed: ParsedBetslip): ParsedBetslip {
  const selectionWarnings = parsed.selections.flatMap((selection, index) =>
    validateSelection(selection).warnings.map((warning) => `Seleccion ${index + 1}: ${warning}`)
  );
  const total = validateTotalOdds(parsed.selections, parsed.totalOddsDetected);
  const warnings = [...parsed.warnings, ...selectionWarnings];

  if (parsed.selections.length === 0) warnings.push("No publiques automaticamente: completa la revision manual.");
  if (total.match === false) warnings.push("La cuota total detectada no coincide con las cuotas seleccionadas.");

  return {
    ...parsed,
    calculatedTotalOdds: total.calculated,
    totalOdds: total.calculated ?? parsed.totalOddsDetected ?? parsed.totalOdds,
    totalOddsMatch: total.match,
    confidence: scoreSlip({ ...parsed, warnings }),
    warnings: [...new Set(warnings)],
  };
}
