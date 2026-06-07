export type ImportedBetSelection = {
  eventName: string;
  competition: string;
  market: string;
  selection: string;
  odds: number | null;
  kickoffAt: string | null;
  confidence: number;
  rawText: string;
};

export type ParsedBetSlip = {
  bookmaker: string;
  kind: "simple" | "combinada";
  sport: string;
  competition: string;
  eventName: string;
  market: string;
  selection: string;
  selections: ImportedBetSelection[];
  totalOdds: number | null;
  detectedTotalOdds: number | null;
  potentialReturnDetected: number | null;
  boosterPercent: number | null;
  totalOddsMatch: boolean | null;
  warnings: string[];
  stakeSimulated: number | null;
  kickoffAt: string | null;
};

export type BetImportReviewPayload = ParsedBetSlip & {
  importId: string;
  extractedText: string;
};

export type ConfirmBetImportPayload = {
  importId: string;
  bookmaker: string;
  kind: "simple" | "combinada";
  sport: string;
  competition: string;
  eventName: string;
  market: string;
  selection: string;
  selections: ImportedBetSelection[];
  totalOdds: number | null;
  detectedTotalOdds: number | null;
  potentialReturnDetected: number | null;
  boosterPercent: number | null;
  totalOddsMatch: boolean | null;
  warnings: string[];
  stakeSimulated: number | null;
  kickoffAt: string | null;
  explanation: string;
  visibility: string;
};
