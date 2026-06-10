import { parseGenericBetSlipText } from "./parse-generic.ts";

export function parseBet365BetSlipText(text: string) {
  return parseGenericBetSlipText(text, "bet365");
}
