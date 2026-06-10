import type { BetslipSelection } from "../types.ts";

export function validateSelection(selection: BetslipSelection) {
  const warnings = [...selection.warnings];
  if (!selection.eventName) warnings.push("Falta el partido o evento.");
  if (!selection.selection && !selection.market) warnings.push("Falta el mercado o seleccion.");
  if (!selection.odds || selection.odds < 1.01) warnings.push("Falta una cuota valida.");

  return {
    ok: warnings.length === 0,
    warnings: [...new Set(warnings)],
  };
}
