import type { BetslipType, TicketPattern } from "../types.ts";
import { extractLineOdds, extractStandaloneOdds } from "../normalization/normalize-odds.ts";
import { normalizeToken } from "../normalization/normalize-text.ts";

function isTimeLine(line: string) {
  return /\b(?:hoy|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)?\s*\d{1,2}:\d{2}\b/i.test(line);
}

function hasOdds(line: string) {
  if (line.includes(":")) return false;
  if (extractStandaloneOdds(line, 100) ?? extractLineOdds(line, 100)) return true;
  return /^\s*[12]\d{2}\s*$/.test(line);
}

function hasEvent(line: string) {
  return (
    /^\s*(?:[^\p{L}]{0,8}|\w{1,3}\s+\|\s*)?[\p{L}][\p{L}\s.']{1,60}\s*-\s*[\p{L}][\p{L}\s.']{1,60}\s*$/iu.test(line) ||
    /^\s*[\p{L}][\p{L}\s.']{1,60}\s+(?:vs?|v)\s+[\p{L}][\p{L}\s.']{1,60}\s*$/iu.test(line)
  );
}

export function detectTicketPattern(text: string, ocrLinesOrSelectionCount: string[] | number) {
  const normalized = normalizeToken(text);
  const hints: string[] = [];
  const lines = Array.isArray(ocrLinesOrSelectionCount) ? ocrLinesOrSelectionCount : [];
  const selectionCount = Array.isArray(ocrLinesOrSelectionCount) ? 0 : ocrLinesOrSelectionCount;
  const oddsCount = lines.filter((line) => hasOdds(line) && !isTimeLine(line)).length;
  const eventCount = lines.filter(hasEvent).length;
  const hasStake = ["stake", "importe", "apuesta", "unidades"].some((hint) => normalized.includes(hint));
  const hasTotalOdds = ["cuota total", "cuota combinada", "total odds"].some((hint) => normalized.includes(hint));
  const hasPotentialReturn = ["ganancia potencial", "posible ganancia", "potential return"].some((hint) =>
    normalized.includes(hint)
  );

  if (normalized.includes("combinada") || normalized.includes("combo") || normalized.includes("multiple")) {
    hints.push("combinada");
  }
  if (normalized.includes("bet builder") || normalized.includes("same game parlay") || normalized.includes("mymatch")) {
    hints.push("bet-builder");
  }
  if (normalized.includes("cuota total") || normalized.includes("cuota combinada") || normalized.includes("total odds")) {
    hints.push("cuota-total");
  }
  if (oddsCount >= 2) hints.push("varias-cuotas");
  if (eventCount >= 2) hints.push("varios-eventos");

  let type: BetslipType = "unknown";
  let ticketPattern: TicketPattern = "unknown";

  if (oddsCount >= 2 && eventCount >= 2 && !hasStake && !hasTotalOdds && !hasPotentialReturn) {
    ticketPattern = "partial_selection_list";
    type = "combined";
  } else if (oddsCount === 1 && eventCount === 1 && !hasStake && !hasTotalOdds && !hasPotentialReturn) {
    ticketPattern = "single_selection_card";
    type = "single";
  } else if (hasStake || hasTotalOdds || hasPotentialReturn || hints.includes("combinada")) {
    ticketPattern = "full_betslip";
    if (selectionCount > 1 || hints.includes("combinada") || hints.includes("cuota-total")) type = "combined";
    if (selectionCount === 1 && !hints.includes("combinada") && !hints.includes("cuota-total")) type = "single";
  } else {
    if (selectionCount > 1) type = "combined";
    if (selectionCount === 1) type = "single";
  }

  return {
    ticketPattern,
    type,
    confidence:
      ticketPattern === "partial_selection_list" || ticketPattern === "single_selection_card"
        ? 0.82
        : type === "unknown"
          ? 0.35
          : selectionCount > 0
            ? 0.85
            : 0.55,
    hints,
  };
}
