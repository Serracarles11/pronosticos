import { parseGenericBetSlipText } from "./parse-generic.ts";

export function parseBookmakerGenericBetSlipText(text: string, bookmaker: string) {
  return parseGenericBetSlipText(text, bookmaker);
}
