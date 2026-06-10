import { extractEventName, getLines, isTotalLine, lineOdds, shouldSkipOddsLine } from "./parser-utils.ts";

export type CandidateBlock = {
  eventName: string;
  rawLines: string[];
  odds: number | null;
  corrections: string[];
};

export function groupCandidateBlocks(text: string) {
  const lines = getLines(text);
  const candidates: CandidateBlock[] = [];
  const orphanLines: string[] = [];
  const orphanOdds: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const odds = lineOdds(lines[i]);
    if (!odds) continue;
    if (shouldSkipOddsLine(lines[i])) {
      if (!isTotalLine(lines[i])) orphanOdds.push(odds);
      continue;
    }

    const blockLines: string[] = [lines[i]];
    for (let j = i - 1; j >= 0 && blockLines.length < 7; j--) {
      if (lineOdds(lines[j])) break;
      if (shouldSkipOddsLine(lines[j])) break;
      blockLines.unshift(lines[j]);
      if (extractEventName(lines[j]).eventName) break;
    }

    const eventLine = blockLines.find((line) => extractEventName(line).eventName);
    const event = eventLine ? extractEventName(eventLine) : { eventName: "", corrections: [] };
    if (!event.eventName && blockLines.length <= 1) {
      orphanLines.push(lines[i]);
      orphanOdds.push(odds);
      continue;
    }

    candidates.push({
      eventName: event.eventName,
      rawLines: blockLines,
      odds,
      corrections: event.corrections,
    });
  }

  return { candidates, orphanLines, orphanOdds };
}
