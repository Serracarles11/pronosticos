import type { BetslipSelection } from "../types.ts";
import { calculateTotalOdds, oddsMatch } from "../normalization/normalize-odds.ts";
import { detectCurrency, extractMoneyAmount } from "../normalization/normalize-money.ts";
import { normalizeOcrText } from "../normalization/normalize-text.ts";
import { extractDateIso } from "../normalization/normalize-date.ts";
import { applyOcrCorrections } from "../normalization/ocr-corrections.ts";
import { detectBookmaker } from "../detection/detect-bookmaker.ts";
import { detectTicketPattern } from "../detection/detect-ticket-pattern.ts";
import {
  buildSelection,
  extractNumberNearHints,
  extractTotalOdds,
  getLines,
  isBoosterLine,
  isReturnLine,
  isStakeLine,
  splitMarketSelection,
} from "./parser-utils.ts";
import { groupCandidateBlocks } from "./line-grouping.ts";
import { buildSelectionsFromEventBlocks } from "./event-block-builder.ts";

function dedupeSelections(selections: BetslipSelection[]) {
  const seen = new Set<string>();
  const result: BetslipSelection[] = [];
  for (const selection of selections) {
    const key = selection.rawText || `${selection.eventName}|${selection.market}|${selection.selection}|${selection.odds}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(selection);
  }
  return result;
}

export function parseGenericBetSlipText(text: string, parser = "generic") {
  const correctionResult = applyOcrCorrections(text);
  const normalized = normalizeOcrText(correctionResult.text);
  const lines = getLines(normalized);
  const { candidates, orphanLines, orphanOdds } = groupCandidateBlocks(normalized);
  const eventBlockResult = buildSelectionsFromEventBlocks(lines);

  const groupedSelections = candidates.map((candidate) => {
    const contentLines = candidate.rawLines.filter((line) => !line.includes(candidate.eventName) && !line.match(/\b([\p{L}][\p{L}\s.'-]{1,55})\s+(?:vs?|v|-)\s+([\p{L}][\p{L}\s.'-]{1,55})\b/iu));
    const parsed = splitMarketSelection(contentLines);
    return buildSelection({
      eventName: candidate.eventName,
      market: parsed.market,
      selection: parsed.selection,
      odds: candidate.odds,
      rawLines: candidate.rawLines,
      isBetBuilder: parsed.isBetBuilder,
      builderType: parsed.builderType,
    });
  });

  let selections = dedupeSelections([...eventBlockResult.selections, ...groupedSelections]).filter(
    (selection) => selection.eventName || selection.market || selection.selection
  );
  const hasBuilderHint = /bet builder|same game parlay|mymatch|my match/i.test(normalized);
  if (hasBuilderHint) {
    selections = selections.map((selection) =>
      selection.selection.includes("+") || selection.rawText.includes("+")
        ? {
            ...selection,
            market: selection.market || "Bet builder",
            isBetBuilder: true,
            builderType: /mymatch|my match/i.test(normalized) ? "MyMatch" : "Bet builder",
          }
        : selection
    );
  }
  const totalOddsDetected = extractTotalOdds(lines);
  const calculatedTotalOdds = calculateTotalOdds(selections);
  const firstSelection = selections[0];
  const bookmaker = detectBookmaker(normalized);
  const pattern = detectTicketPattern(normalized, selections.length);
  const stakeDetected =
    lines.map(extractMoneyAmount).find((value) => value !== null && value <= 10000) ??
    extractNumberNearHints(lines, isStakeLine);
  const potentialReturnDetected = extractNumberNearHints(lines, isReturnLine);
  const boosterPercent = extractNumberNearHints(lines, isBoosterLine);
  const warnings = [
    ...correctionResult.corrections,
    ...eventBlockResult.corrections,
    ...candidates.flatMap((candidate) => candidate.corrections),
  ];

  if (selections.length === 0) warnings.push("No se detectaron selecciones completas. Revisa la captura manualmente.");
  if (totalOddsDetected && calculatedTotalOdds && oddsMatch(calculatedTotalOdds, totalOddsDetected) === false) {
    warnings.push("La cuota total detectada no coincide con el producto de selecciones.");
  }
  if (orphanOdds.length > 0) warnings.push("Hay cuotas sueltas que no se han convertido en selecciones.");

  const averageSelectionConfidence =
    selections.length > 0
      ? selections.reduce((acc, selection) => acc + selection.confidence, 0) / selections.length
      : 0.2;

  return {
    bookmaker: bookmaker.bookmaker,
    bookmakerConfidence: bookmaker.confidence,
    type: pattern.type,
    typeConfidence: pattern.confidence,
    ticketPattern: pattern.ticketPattern === "unknown" ? "full_betslip" : pattern.ticketPattern,
    ticketPatternConfidence: pattern.confidence,
    sport: "Futbol",
    competition: firstSelection?.competition || "",
    eventName: firstSelection?.eventName ?? "",
    market: selections.length > 1 ? `Combinada (${selections.length} selecciones)` : firstSelection?.market ?? "",
    selection: selections.length > 1 ? selections.map((item) => item.selection || item.market).join(" + ") : firstSelection?.selection ?? "",
    selections,
    totalOdds: calculatedTotalOdds ?? totalOddsDetected,
    totalOddsDetected,
    totalOddsConfidence: totalOddsDetected ? 0.85 : 0.2,
    calculatedTotalOdds,
    totalOddsMatch: oddsMatch(calculatedTotalOdds, totalOddsDetected),
    stakeDetected,
    stakeConfidence: stakeDetected ? 0.65 : 0.15,
    potentialReturnDetected,
    potentialReturnConfidence: potentialReturnDetected ? 0.65 : 0.15,
    boosterPercent,
    boosterConfidence: boosterPercent ? 0.7 : 0.15,
    currency: detectCurrency(normalized),
    eventDateDetected: firstSelection?.kickoffAt ?? extractDateIso(normalized),
    confidence: Math.min(
      0.96,
      Math.max(0.12, averageSelectionConfidence * 0.75 + bookmaker.confidence * 0.1 + pattern.confidence * 0.1)
    ),
    warnings: [...new Set(warnings)],
    corrections: [...new Set([...correctionResult.corrections, ...eventBlockResult.corrections])],
    orphanLines: [...new Set(orphanLines)],
    orphanOdds: [...new Set(orphanOdds)],
    rawText: normalized,
    debug: {
      parser,
      bookmakerHints: bookmaker.hints,
      ticketPatternHints: pattern.hints,
      lineCount: lines.length,
    },
  };
}
