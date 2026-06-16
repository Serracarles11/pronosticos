import type { BetslipExtractionResult } from "../providers/provider.ts";
import { validateExtractedBetslip } from "./validate-extracted-betslip.ts";

function normalizeBookmaker(value: string | null) {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "unknown" || normalized === "no detectado") return null;
  return normalized.slice(0, 40);
}

function normalizeDate(value: string | null) {
  if (!value) return null;
  return value.trim().slice(0, 40) || null;
}

function splitBuilderSelections(result: BetslipExtractionResult) {
  return result.selections.flatMap((selection) => {
    const shouldKeepOdds = !selection.isBuilder || !result.totalOdds;
    if (!selection.isBuilder || !selection.selection) {
      return [{ ...selection, odds: shouldKeepOdds ? selection.odds : null }];
    }

    const parts = selection.selection
      .split(/\s+\+\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length <= 1) return [{ ...selection, odds: shouldKeepOdds ? selection.odds : null }];

    return parts.map((part, index) => ({
      ...selection,
      selection: part,
      odds: shouldKeepOdds && index === 0 ? selection.odds : null,
      rawText: selection.rawText ?? selection.selection,
      warnings: index === 0
        ? [...selection.warnings, "Builder separado en condiciones individuales para revision."]
        : selection.warnings,
    }));
  });
}

export function normalizeExtractedBetslip(result: BetslipExtractionResult): BetslipExtractionResult {
  return validateExtractedBetslip({
    ...result,
    bookmaker: normalizeBookmaker(result.bookmaker),
    selections: splitBuilderSelections(result).map((selection) => ({
      ...selection,
      event: selection.event?.trim().slice(0, 160) || null,
      date: normalizeDate(selection.date),
      market: selection.market?.trim().slice(0, 180) || null,
      selection: selection.selection?.trim().slice(0, 500) || null,
      rawText: selection.rawText?.trim().slice(0, 1000) || null,
      warnings: selection.warnings.map((warning) => warning.trim()).filter(Boolean),
      confidence: Math.max(0, Math.min(1, selection.confidence)),
    })),
    warnings: result.warnings.map((warning) => warning.trim()).filter(Boolean),
    confidence: Math.max(0, Math.min(1, result.confidence)),
  });
}
