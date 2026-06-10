import { parseGenericBetSlipText } from "./parse-generic.ts";

export function parseBetfairBetSlipText(text: string) {
  return parseGenericBetSlipText(text, "betfair");
}
