import { runOcrOnBetSlip } from "../../bet-import/ocr.ts";
import { preprocessBetslipImage } from "../image/preprocess-betslip-image.ts";
import { parseBetSlipText } from "../parse-betslip.ts";
import type { BetslipExtractionResult, BetslipExtractorInput, BetslipExtractorProvider } from "./provider.ts";

function legacyTypeToProviderType(value: string | undefined) {
  if (value === "single" || value === "combined" || value === "unknown") return value;
  return value === "combinada" ? "combined" : value === "simple" ? "single" : "unknown";
}

export class TesseractBetslipExtractorProvider implements BetslipExtractorProvider {
  name = "tesseract" as const;

  async extract(input: BetslipExtractorInput): Promise<BetslipExtractionResult> {
    const preparedImage = await preprocessBetslipImage(input.imageBuffer);
    const ocr = await runOcrOnBetSlip(preparedImage.buffer);
    const parsed = parseBetSlipText(ocr.text);

    return {
      provider: "tesseract",
      model: ocr.provider,
      bookmaker: parsed.bookmaker === "unknown" ? null : parsed.bookmaker,
      bookmakerConfidence: parsed.bookmakerConfidence ?? 0.4,
      type: legacyTypeToProviderType(parsed.type ?? parsed.kind),
      typeConfidence: parsed.typeConfidence ?? 0.45,
      stake: parsed.stakeDetected ?? parsed.stakeSimulated ?? null,
      totalOdds: parsed.detectedTotalOdds ?? parsed.totalOdds ?? null,
      calculatedTotalOdds: parsed.calculatedTotalOdds ?? null,
      totalOddsMatch: parsed.totalOddsMatch ?? null,
      potentialReturn: parsed.potentialReturnDetected ?? null,
      currency: parsed.currency === "EUR" || parsed.currency === "USD" || parsed.currency === "GBP" ? parsed.currency : null,
      boosterPercent: parsed.boosterPercent ?? null,
      selections: parsed.selections.map((selection) => ({
        event: selection.eventName || null,
        date: selection.kickoffAt ?? selection.rawTime ?? null,
        market: selection.market || null,
        selection: selection.selection || null,
        odds: selection.odds,
        isBuilder: Boolean(selection.isBuilder ?? selection.isBetBuilder),
        builderType:
          selection.builderType === "mymatch" ||
          selection.builderType === "betbuilder" ||
          selection.builderType === "same_game_multi"
            ? selection.builderType
            : null,
        rawText: selection.rawText || null,
        confidence: selection.confidence,
        warnings: selection.warnings ?? [],
      })),
      warnings: parsed.warnings ?? [],
      confidence: parsed.confidence ?? 0.45,
      rawText: ocr.text,
      rawProviderJson: { parsed, ocrProvider: ocr.provider, imagePreprocess: preparedImage.steps },
    };
  }
}
