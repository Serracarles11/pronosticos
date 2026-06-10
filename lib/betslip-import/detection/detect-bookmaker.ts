import type { BetslipBookmaker } from "../types.ts";
import { normalizeToken } from "../normalization/normalize-text.ts";

const BOOKMAKER_HINTS: Array<{ id: BetslipBookmaker; labels: string[] }> = [
  { id: "winamax", labels: ["winamax", "wnamax", "lo mas importante es ganar"] },
  { id: "bet365", labels: ["bet365", "bet 365"] },
  { id: "betfair", labels: ["betfair"] },
  { id: "betway", labels: ["betway"] },
  { id: "codere", labels: ["codere"] },
  { id: "sportium", labels: ["sportium"] },
  { id: "luckia", labels: ["luckia"] },
  { id: "bwin", labels: ["bwin"] },
];

export function detectBookmaker(text: string) {
  const normalized = normalizeToken(text);
  const matchedHints: string[] = [];

  for (const bookmaker of BOOKMAKER_HINTS) {
    const hit = bookmaker.labels.find((label) => normalized.includes(normalizeToken(label)));
    if (!hit) continue;
    matchedHints.push(hit);
    return {
      bookmaker: bookmaker.id,
      confidence: hit.length > 5 ? 0.95 : 0.85,
      hints: matchedHints,
    };
  }

  return { bookmaker: "unknown" as BetslipBookmaker, confidence: 0.15, hints: matchedHints };
}
