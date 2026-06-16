export type BetslipExtractionProviderName = "openai" | "tesseract" | "manual";
export type BetslipType = "single" | "combined" | "unknown";
export type BetslipCurrency = "EUR" | "USD" | "GBP" | null;
export type BetslipBuilderType = "mymatch" | "betbuilder" | "same_game_multi" | null;

export type BetslipSelection = {
  event: string | null;
  date: string | null;
  market: string | null;
  selection: string | null;
  odds: number | null;
  isBuilder: boolean;
  builderType: BetslipBuilderType;
  rawText: string | null;
  confidence: number;
  warnings: string[];
};

export type BetslipExtractionResult = {
  provider: BetslipExtractionProviderName;
  model?: string | null;
  bookmaker: string | null;
  bookmakerConfidence: number;
  type: BetslipType;
  typeConfidence: number;
  stake: number | null;
  totalOdds: number | null;
  calculatedTotalOdds: number | null;
  totalOddsMatch: boolean | null;
  potentialReturn: number | null;
  currency: BetslipCurrency;
  boosterPercent: number | null;
  selections: BetslipSelection[];
  warnings: string[];
  confidence: number;
  rawText?: string | null;
  rawProviderJson?: unknown;
};

export type BetslipExtractorInput = {
  imageBuffer: Buffer;
  mimeType: string;
  userId: string;
};

export interface BetslipExtractorProvider {
  name: BetslipExtractionProviderName;
  extract(input: BetslipExtractorInput): Promise<BetslipExtractionResult>;
}
