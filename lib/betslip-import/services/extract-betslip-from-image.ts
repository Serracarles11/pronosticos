import { OpenAIVisionBetslipExtractorProvider } from "../providers/openai-vision-provider.ts";
import { TesseractBetslipExtractorProvider } from "../providers/tesseract-provider.ts";
import type { BetslipExtractionResult, BetslipExtractorInput, BetslipExtractorProvider } from "../providers/provider.ts";
import { normalizeExtractedBetslip } from "../validation/normalize-extracted-betslip.ts";

function isTesseractFallbackEnabled() {
  return process.env.ENABLE_TESSERACT_FALLBACK !== "false";
}

function providerName() {
  return (process.env.BETSLIP_EXTRACTOR_PROVIDER || "openai").toLowerCase();
}

type ExtractBetslipOptions = {
  primaryProvider?: BetslipExtractorProvider;
  fallbackProvider?: BetslipExtractorProvider;
  provider?: string;
  enableFallback?: boolean;
};

export async function extractBetslipFromImage(
  input: BetslipExtractorInput,
  options: ExtractBetslipOptions = {}
): Promise<BetslipExtractionResult> {
  const tesseract = options.fallbackProvider ?? new TesseractBetslipExtractorProvider();
  const configuredProvider = options.provider ?? providerName();

  if (configuredProvider !== "openai") {
    return normalizeExtractedBetslip(await tesseract.extract(input));
  }

  try {
    const openai = options.primaryProvider ?? new OpenAIVisionBetslipExtractorProvider();
    return normalizeExtractedBetslip(await openai.extract(input));
  } catch (error) {
    if (!(options.enableFallback ?? isTesseractFallbackEnabled())) throw error;
    const fallback = normalizeExtractedBetslip(await tesseract.extract(input));
    return {
      ...fallback,
      warnings: [
        "Extraccion avanzada no disponible. Se uso OCR basico.",
        ...fallback.warnings,
      ],
    };
  }
}
