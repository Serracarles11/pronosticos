import type { BetslipSelection } from "../types.ts";
import { buildSelection, extractEventName, lineOdds, shouldSkipOddsLine, splitMarketSelection } from "./parser-utils.ts";

export function buildSelectionsFromEventBlocks(lines: string[]) {
  const selections: BetslipSelection[] = [];
  const corrections: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const event = extractEventName(lines[i]);
    if (!event.eventName) continue;

    const rawLines = [lines[i]];
    for (let j = i + 1; j < lines.length && rawLines.length < 10; j++) {
      if (j !== i + 1 && extractEventName(lines[j]).eventName) break;
      rawLines.push(lines[j]);
      if (lineOdds(lines[j]) && !shouldSkipOddsLine(lines[j])) break;
    }

    const odds = [...rawLines].reverse().map(lineOdds).find((value) => value !== null) ?? null;
    if (!odds) continue;

    const contentLines = rawLines
      .slice(1)
      .filter((line) => !lineOdds(line))
      .filter((line) => !shouldSkipOddsLine(line));
    const parsed = splitMarketSelection(contentLines);
    selections.push(
      buildSelection({
        eventName: event.eventName,
        market: parsed.market,
        selection: parsed.selection,
        odds,
        rawLines,
        isBetBuilder: parsed.isBetBuilder,
        builderType: parsed.builderType,
      })
    );
    corrections.push(...event.corrections);
  }

  return { selections, corrections };
}
