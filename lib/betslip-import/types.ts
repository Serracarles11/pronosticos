export type BetslipType = "single" | "combined" | "unknown";
export type TicketPattern = "full_betslip" | "partial_selection_list" | "single_selection_card" | "unknown";

export type BetslipBookmaker =
  | "winamax"
  | "bet365"
  | "betfair"
  | "betway"
  | "codere"
  | "sportium"
  | "luckia"
  | "bwin"
  | "unknown";

export type FieldConfidence = {
  bookmaker?: number;
  type?: number;
  eventName?: number;
  market?: number;
  selection?: number;
  odds?: number;
  kickoffAt?: number;
  totalOdds?: number;
  stake?: number;
  potentialReturn?: number;
  booster?: number;
};

export type BetslipSelection = {
  eventName: string;
  competition: string;
  market: string;
  selection: string;
  odds: number | null;
  kickoffAt: string | null;
  confidence: number;
  rawText: string;
  rawLines: string[];
  warnings: string[];
  fieldConfidence: FieldConfidence;
  isBetBuilder: boolean;
  isBuilder?: boolean;
  builderType: string | null;
  rawTime?: string | null;
};

export type ParsedBetslip = {
  bookmaker: BetslipBookmaker;
  bookmakerConfidence: number;
  type: BetslipType;
  typeConfidence: number;
  ticketPattern: TicketPattern;
  ticketPatternConfidence: number;
  sport: string;
  competition: string;
  eventName: string;
  market: string;
  selection: string;
  selections: BetslipSelection[];
  totalOdds: number | null;
  totalOddsDetected: number | null;
  totalOddsConfidence: number;
  calculatedTotalOdds: number | null;
  totalOddsMatch: boolean | null;
  stakeDetected: number | null;
  stakeConfidence: number;
  potentialReturnDetected: number | null;
  potentialReturnConfidence: number;
  boosterPercent: number | null;
  boosterConfidence: number;
  currency: string | null;
  eventDateDetected: string | null;
  confidence: number;
  warnings: string[];
  corrections: string[];
  orphanLines: string[];
  orphanOdds: number[];
  rawText: string;
  debug: {
    parser: string;
    bookmakerHints: string[];
    ticketPatternHints: string[];
    lineCount: number;
  };
};

export type ParserResult = ParsedBetslip;
