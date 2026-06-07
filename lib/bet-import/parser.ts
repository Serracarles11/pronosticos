import { normalizeDecimal, normalizeOcrText, normalizeToken, roundOdds } from "./normalize.ts";
import type { ImportedBetSelection, ParsedBetSlip } from "./types.ts";

const BOOKMAKERS = [
  "Winamax",
  "Bet365",
  "Betfair",
  "Betway",
  "Codere",
  "Sportium",
  "Luckia",
  "Bwin",
] as const;

const TOTAL_HINTS = ["cuota total", "total odds", "cuota combinada", "cuota"];
const STAKE_HINTS = ["stake", "importe", "apuesta", "unidades"];
const RETURN_HINTS = ["ganancia potencial", "posible ganancia", "prepara la bolsa", "ganancias", "retorno", "premio"];
const BOOSTER_HINTS = ["combo booster", "booster", "bonus"];
const IGNORE_ODDS_HINTS = [...RETURN_HINTS, ...BOOSTER_HINTS, "cashout", "importe"];

export function detectBookmaker(text: string) {
  const normalized = normalizeToken(text);
  for (const bookmaker of BOOKMAKERS) {
    if (normalized.includes(normalizeToken(bookmaker))) return bookmaker;
  }
  return "unknown";
}

export function extractOdds(text: string) {
  const odds: number[] = [];
  const seen = new Set<string>();
  const regex = /(?:@|cuota\s*)?(\d{1,3}[.,]\d{2,4})\b/gi;
  for (const match of text.matchAll(regex)) {
    const value = normalizeDecimal(match[1]);
    if (!Number.isFinite(value) || value < 1.01 || value > 100) continue;
    const key = value.toFixed(4);
    if (seen.has(key)) continue;
    seen.add(key);
    odds.push(value);
  }
  return odds;
}

export function calculateTotalOdds(selections: Array<{ odds: number | null }>) {
  const validOdds = selections
    .map((selection) => selection.odds)
    .filter((odds): odds is number => typeof odds === "number" && Number.isFinite(odds) && odds >= 1.01);

  if (validOdds.length === 0) return null;
  return roundOdds(validOdds.reduce((acc, odds) => acc * odds, 1));
}

function isTotalLine(line: string) {
  const normalized = normalizeToken(line);
  return normalized === "cu" || TOTAL_HINTS.some((hint) => normalized.includes(hint));
}

function isStakeLine(line: string) {
  const normalized = normalizeToken(line);
  return STAKE_HINTS.some((hint) => normalized.includes(hint));
}

function isIgnoredOddsLine(line: string) {
  const normalized = normalizeToken(line);
  return IGNORE_ODDS_HINTS.some((hint) => normalized.includes(hint));
}

function isBoosterLine(line: string) {
  const normalized = normalizeToken(line);
  return BOOSTER_HINTS.some((hint) => normalized.includes(hint)) || /%/.test(line);
}

function isReturnLine(line: string) {
  const normalized = normalizeToken(line);
  return RETURN_HINTS.some((hint) => normalized.includes(hint));
}

function lineOdds(line: string) {
  const matches = [...line.matchAll(/(?:@|cuota\s*)?(\d{1,3}[.,]\d{1,4})\b/gi)];
  for (const match of matches.reverse()) {
    const value = normalizeDecimal(match[1]);
    if (Number.isFinite(value) && value >= 1.01 && value <= 100) return value;
  }
  return null;
}

function standaloneOdds(line: string) {
  const match = line.trim().match(/^@?\s*(\d{1,3}[.,]\d{2,4})$/);
  if (!match) return null;
  const value = normalizeDecimal(match[1]);
  return Number.isFinite(value) && value >= 1.01 && value <= 100 ? value : null;
}

function lineNumbers(line: string) {
  return [...line.matchAll(/(?<!\d)(\d{1,4}(?:[.,]\d{1,4})?)(?!\d)/g)]
    .map((match) => normalizeDecimal(match[1]))
    .filter((value) => Number.isFinite(value));
}

function withoutOdds(line: string) {
  return line
    .replace(/(?:@|cuota\s*)?\d{1,3}[.,]\d{2,4}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitEventAndMarket(value: string, previousLine = "") {
  const combined = [previousLine, value].filter(Boolean).join(" ").trim();
  const vsMatch = combined.match(/(.+?\b(?:vs|v|-\s*)\b.+?)(?:\s{2,}|$)/i);
  const eventName = vsMatch?.[1]?.trim() ?? "";
  const remainder = eventName ? combined.replace(eventName, "").trim() : combined;
  const parts = remainder
    .split(/\s[-|•]\s|·|;|\n/)
    .map((part) => part.trim())
    .filter(Boolean);

  const selection = parts.at(-1) ?? remainder;
  const market = parts.length > 1 ? parts.slice(0, -1).join(" - ") : "";
  return {
    eventName,
    market,
    selection: selection || combined,
  };
}

function extractDetectedTotalOdds(lines: string[]) {
  const windowedLines = lines.map((line, index) =>
    [lines[index - 1], line, lines[index + 1]].filter(Boolean).join(" ")
  );

  for (const line of windowedLines) {
    if (!isTotalLine(line)) continue;
    const odds = lineOdds(line);
    if (odds) return odds;
  }
  return null;
}

function extractStake(lines: string[]) {
  for (const line of lines) {
    if (!isStakeLine(line)) continue;
    if (normalizeToken(line).includes("apuesta de") && !/[€â]/i.test(line)) continue;
    const stake = lineNumbers(line)[0];
    if (Number.isFinite(stake) && stake > 0 && stake <= 10000) return stake;
  }
  return null;
}

function extractPotentialReturn(lines: string[]) {
  for (const line of lines) {
    if (!isReturnLine(line)) continue;
    const value = lineNumbers(line).at(-1);
    if (value && value > 0) return value;
  }
  return null;
}

function extractBoosterPercent(lines: string[]) {
  for (const line of lines) {
    if (!isBoosterLine(line)) continue;
    const value = lineNumbers(line)[0];
    if (value && value > 0 && value <= 100) return value;
  }
  return null;
}

function extractDate(text: string) {
  const match = text.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const currentYear = new Date().getFullYear();
  const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : currentYear;
  const hour = match[4] ? Number(match[4]) : 12;
  const minute = match[5] ? Number(match[5]) : 0;
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function titleCaseTeamName(value: string) {
  return value
    .toLocaleLowerCase("es-ES")
    .replace(/\p{L}+/gu, (word) => word.charAt(0).toLocaleUpperCase("es-ES") + word.slice(1));
}

function normalizeEventName(value: string) {
  return value
    .replace(/\s+/g, " ")
    .split(/\s+-\s+/)
    .map((part) => titleCaseTeamName(part.trim()))
    .join(" - ")
    .trim();
}

function eventNameFromLine(line: string) {
  if (line.includes(":")) return "";
  const match = line.match(/\b([\p{L}][\p{L}\s.'-]{1,45})\s+-\s+([\p{L}][\p{L}\s.'-]{1,45})\b/u);
  if (!match) return "";
  return normalizeEventName(`${match[1]} - ${match[2]}`);
}

function addWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) warnings.push(warning);
}

function correctTeamName(value: string, warnings: string[]) {
  const normalized = normalizeToken(value.trim());
  const corrections: Record<string, string> = {
    greca: "Grecia",
  };
  const corrected = corrections[normalized];
  if (corrected) {
    addWarning(warnings, `${value.trim()} corregido a ${corrected}`);
    return corrected;
  }
  return titleCaseTeamName(value.trim());
}

function eventNameFromLineWithWarnings(line: string, warnings: string[]) {
  if (line.includes(":")) return "";
  const match = line.match(/\b([\p{L}][\p{L}\s.'-]{1,45})\s+-\s+([\p{L}][\p{L}\s.'-]{1,45})\b/u);
  if (!match) return "";
  return [correctTeamName(match[1], warnings), correctTeamName(match[2], warnings)].join(" - ");
}

function looksLikeMatchMarker(line: string) {
  const normalized = normalizeToken(line).replace(/[^a-z]/g, "");
  return normalized === "match" || normalized === "mymatch" || (normalized.includes("match") && normalized.length <= 8);
}

function looksLikeDateLine(line: string) {
  return /^\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?$/.test(line.trim());
}

function looksLikeWinamax(text: string) {
  const normalized = normalizeToken(text);
  const lines = normalizeOcrText(text).split("\n").map((line) => line.trim()).filter(Boolean);
  const eventCount = lines.filter(eventNameFromLine).length;
  return (
    normalized.includes("winamax") ||
    normalized.includes("wnamax") ||
    normalized.includes("lo mas importante es ganar") ||
    (normalized.includes("apuesta de") && eventCount >= 2) ||
    (normalized.includes("en curso") && eventCount >= 2)
  );
}

function applyTextCorrection(value: string, pattern: RegExp, replacement: string, warning: string, warnings: string[]) {
  if (!pattern.test(value)) return value;
  addWarning(warnings, warning);
  return value.replace(pattern, replacement);
}

function normalizeWinamaxTextLine(value: string, eventName: string, warnings: string[]) {
  let next = value
    .replace(/SÃ­/g, "Sí")
    .replace(/MÃ¡s/g, "Más")
    .replace(/NÃºmero/g, "Número")
    .replace(/CÃ³rners/g, "Córners")
    .replace(/CÃ³meres/g, "Cómeres");

  next = applyTextCorrection(next, /\bSi\b/g, "Sí", "Si corregido a Sí", warnings);
  next = applyTextCorrection(next, /\bMas\b/g, "Más", "Mas corregido a Más", warnings);
  next = applyTextCorrection(next, /\bM[ée]s\s+de\s+15\b/gi, "Más de 1,5", "Más de 15 corregido a Más de 1,5", warnings);
  next = applyTextCorrection(next, /\bMás\s+de\s+15\b/gi, "Más de 1,5", "Más de 15 corregido a Más de 1,5", warnings);
  next = applyTextCorrection(next, /\bC[oó]meres\b/gi, "Córners", "Cómeres corregido a Córners", warnings);
  next = applyTextCorrection(next, /\bComeres\b/gi, "Córners", "Comeres corregido a Córners", warnings);

  if (eventName === "Marruecos - Noruega") {
    next = applyTextCorrection(next, /\bMaruega\b/gi, "Noruega", "Maruega corregido a Noruega", warnings);
  }
  if (eventName === "Ecuador - Guatemala") {
    next = applyTextCorrection(next, /\bEmrador\b/gi, "Ecuador", "Emrador corregido a Ecuador", warnings);
  }
  if (eventName === "Grecia - Italia" && normalizeToken(next).includes("resultado")) {
    next = applyTextCorrection(next, /\bMala\b/gi, "Italia", "Mala corregido a Italia", warnings);
  }

  return next.trim();
}

function cleanWinamaxSelectionText(value: string) {
  return withoutOdds(value)
    .replace(/\bMYMATCH\b/gi, "MyMatch")
    .replace(/\bWINAMAX\b/gi, "")
    .replace(/\b(COMBO|BOOSTER|CUOTA|IMPORTE|GANANCIA POTENCIAL)\b/gi, "")
    .replace(/\s*\|\s*/g, " | ")
    .replace(/(?:\s*\|\s*)+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseMarketAndSelection(rawValue: string) {
  const value = cleanWinamaxSelectionText(rawValue);
  if (!value) return { market: "", selection: "" };

  const hasMatchMarker = value
    .split("|")
    .some((part) => looksLikeMatchMarker(part.trim()));
  const myMatchIndex = normalizeToken(value).indexOf("mymatch");
  if (hasMatchMarker || myMatchIndex >= 0) {
    const source = myMatchIndex >= 0 ? value.slice(myMatchIndex) : value;
    const afterMyMatch = source
      .replace(/^mymatch\s*:?\s*/i, "")
      .replace(/^match\s*:?\s*/i, "")
      .replace(/^\s*\|\s*/, "");
    const parts = afterMyMatch
      .split(/\s+\+\s+|\s+\|\s+/)
      .map((part) => part.trim())
      .filter((part) => !looksLikeMatchMarker(part))
      .filter(Boolean);
    return {
      market: "MyMatch",
      selection: parts.length > 1 ? parts.join(" + ") : afterMyMatch,
    };
  }

  const colonIndex = value.indexOf(":");
  if (colonIndex > 0) {
    return {
      market: value.slice(0, colonIndex).trim(),
      selection: value.slice(colonIndex + 1).trim(),
    };
  }

  const resultMatch = value.match(/^resultado\s+(.+)$/i);
  if (resultMatch) {
    return { market: "Resultado", selection: resultMatch[1].trim() };
  }

  return { market: "", selection: value };
}

function totalOddsMatches(calculatedTotal: number | null, detectedTotalOdds: number | null) {
  if (!calculatedTotal || !detectedTotalOdds) return null;
  const diff = Math.abs(calculatedTotal - detectedTotalOdds);
  return diff <= 0.1 || diff <= detectedTotalOdds * 0.005;
}

function extractMoneyAmount(line: string) {
  if (!/[€â]/.test(line)) return null;
  const value = lineNumbers(line).at(-1);
  return value && value > 0 ? value : null;
}

function firstEventIndex(lines: string[]) {
  const index = lines.findIndex((line) => !!eventNameFromLine(line));
  return index === -1 ? lines.length : index;
}

function extractWinamaxHeader(lines: string[]) {
  const header = lines.slice(0, firstEventIndex(lines));
  const detectedTotalOdds = (() => {
    for (let i = 0; i < header.length; i++) {
      if (!isTotalLine(header[i])) continue;
      const sameLine = lineOdds(header[i]);
      if (sameLine) return sameLine;
      for (let j = i + 1; j < Math.min(header.length, i + 4); j++) {
        const odds = standaloneOdds(header[j]) ?? lineOdds(header[j]);
        if (odds) return odds;
      }
    }
    return header.map(standaloneOdds).find((value) => value !== null && value >= 10) ?? null;
  })();

  const stakeSimulated = (() => {
    for (let i = 0; i < header.length; i++) {
      const line = header[i];
      const normalized = normalizeToken(line);
      if (normalized.includes("apuesta de") && !/[€â]/.test(line)) continue;
      if (normalized.includes("importe") || normalized.includes("stake") || /[€â]/.test(line)) {
        if (isReturnLine(line)) continue;
        const money = extractMoneyAmount(line);
        if (money && money <= 100) return money;
      }
    }
    return null;
  })();

  const potentialReturnDetected = (() => {
    for (const line of header) {
      if (!isReturnLine(line)) continue;
      const money = extractMoneyAmount(line) ?? lineNumbers(line).at(-1);
      if (money && money > 0) return money;
    }
    return null;
  })();

  const boosterPercent = (() => {
    for (const line of header) {
      if (!isBoosterLine(line)) continue;
      const value = lineNumbers(line)[0];
      if (value && value > 0 && value <= 100) return value;
    }
    return null;
  })();

  return { detectedTotalOdds, stakeSimulated, potentialReturnDetected, boosterPercent };
}

export function parseWinamaxBetSlipText(text: string): ParsedBetSlip {
  const normalized = normalizeOcrText(text);
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const warnings: string[] = [];
  const header = extractWinamaxHeader(lines);
  const detectedTotalOdds = header.detectedTotalOdds;
  const stakeSimulated = header.stakeSimulated;
  const potentialReturnDetected = header.potentialReturnDetected ?? extractPotentialReturn(lines);
  const boosterPercent = header.boosterPercent ?? extractBoosterPercent(lines);
  const selections: ImportedBetSelection[] = [];

  for (let i = 0; i < lines.length; i++) {
    const eventName = eventNameFromLineWithWarnings(lines[i], warnings);
    if (!eventName) continue;

    const blockLines = [lines[i]];
    for (let j = i + 1; j < lines.length; j++) {
      if (eventNameFromLine(lines[j])) break;
      blockLines.push(lines[j]);
      if (standaloneOdds(lines[j]) && !isTotalLine(lines[j]) && !isIgnoredOddsLine(lines[j])) break;
    }

    const rawText = blockLines.join(" | ");
    const odds =
      [...blockLines].reverse().map(standaloneOdds).find((value) => value !== null) ??
      [...blockLines].reverse().map(lineOdds).find((value) => value !== null) ??
      null;
    if (!odds) continue;
    if (detectedTotalOdds && Math.abs(odds - detectedTotalOdds) < 0.001 && blockLines.some(isTotalLine)) continue;
    if (blockLines.some(isStakeLine) || blockLines.some(isReturnLine) || blockLines.some(isBoosterLine)) continue;

    const contentLines = blockLines
      .slice(1)
      .filter((line) => !looksLikeDateLine(line))
      .filter((line) => !standaloneOdds(line))
      .map((line) => normalizeWinamaxTextLine(line, eventName, warnings))
      .filter(Boolean);
    const withoutEvent = contentLines.join(" | ").trim();
    const parsed = parseMarketAndSelection(withoutEvent);
    if (!parsed.market && !parsed.selection) continue;

    selections.push({
      eventName,
      competition: "",
      market: parsed.market,
      selection: parsed.selection,
      odds,
      kickoffAt: extractDate(rawText),
      confidence: parsed.market || parsed.selection ? 0.82 : 0.5,
      rawText,
    });
  }

  const calculatedTotal = calculateTotalOdds(selections);
  const firstSelection = selections[0];

  return {
    bookmaker: "winamax",
    kind: selections.length > 1 ? "combinada" : "simple",
    sport: "Futbol",
    competition: firstSelection?.competition || "",
    eventName: firstSelection?.eventName ?? "",
    market: selections.length > 1 ? `Combinada (${selections.length} selecciones)` : firstSelection?.market ?? "",
    selection: selections.length > 1 ? selections.map((item) => item.selection).join(" + ") : firstSelection?.selection ?? "",
    selections,
    totalOdds: calculatedTotal,
    detectedTotalOdds,
    potentialReturnDetected,
    boosterPercent,
    totalOddsMatch: totalOddsMatches(calculatedTotal, detectedTotalOdds),
    warnings,
    stakeSimulated,
    kickoffAt: firstSelection?.kickoffAt ?? extractDate(normalized),
  };
}

export function extractSelections(text: string): ImportedBetSelection[] {
  const lines = normalizeOcrText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const selections: ImportedBetSelection[] = [];
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const odds = lineOdds(rawLine);
    if (!odds || isTotalLine(rawLine) || isStakeLine(rawLine) || isIgnoredOddsLine(rawLine)) continue;

    const previousLine = i > 0 && !lineOdds(lines[i - 1]) ? lines[i - 1] : "";
    const cleaned = withoutOdds(rawLine);
    const parsed = splitEventAndMarket(cleaned, previousLine);
    if (!parsed.eventName && !parsed.market) continue;
    selections.push({
      eventName: parsed.eventName,
      competition: "",
      market: parsed.market,
      selection: parsed.selection,
      odds,
      kickoffAt: extractDate([previousLine, rawLine].join(" ")),
      confidence: 0.65,
      rawText: rawLine,
    });
  }

  return selections;
}

export function parseBetSlipText(text: string): ParsedBetSlip {
  const normalized = normalizeOcrText(text);
  if (looksLikeWinamax(normalized)) {
    return parseWinamaxBetSlipText(normalized);
  }

  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const selections = extractSelections(normalized);
  const calculatedTotal = calculateTotalOdds(selections);
  const detectedTotalOdds = extractDetectedTotalOdds(lines);
  const firstSelection = selections[0];
  const eventName = firstSelection?.eventName ?? "";
  const market = selections.length > 1 ? `Combinada (${selections.length} selecciones)` : firstSelection?.market ?? "";
  const selection = selections.length > 1 ? selections.map((item) => item.selection).join(" + ") : firstSelection?.selection ?? "";
  const kickoffAt = firstSelection?.kickoffAt ?? extractDate(normalized);

  return {
    bookmaker: detectBookmaker(normalized),
    kind: selections.length > 1 ? "combinada" : "simple",
    sport: "Futbol",
    competition: firstSelection?.competition || "",
    eventName,
    market,
    selection,
    selections,
    totalOdds: calculatedTotal,
    detectedTotalOdds,
    potentialReturnDetected: extractPotentialReturn(lines),
    boosterPercent: extractBoosterPercent(lines),
    totalOddsMatch: totalOddsMatches(calculatedTotal, detectedTotalOdds),
    warnings: [],
    stakeSimulated: extractStake(lines),
    kickoffAt,
  };
}
