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

export function normalizeExtractedBetslip(result: BetslipExtractionResult): BetslipExtractionResult {
  return validateExtractedBetslip({
    ...result,
    bookmaker: normalizeBookmaker(result.bookmaker),
    selections: result.selections.map((selection) => ({
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
