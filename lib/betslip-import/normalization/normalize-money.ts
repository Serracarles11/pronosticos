import { normalizeDecimal } from "./normalize-odds.ts";

export function extractMoneyAmount(line: string) {
  if (!/(eur|€|\$|gbp|usd)/i.test(line)) return null;
  const matches = [...line.matchAll(/(?<!\d)(\d{1,6}(?:[.,]\d{1,4})?)(?!\d)/g)];
  const value = matches.map((match) => normalizeDecimal(match[1])).filter(Number.isFinite).at(-1);
  return value && value > 0 ? value : null;
}

export function detectCurrency(text: string) {
  if (/€|eur/i.test(text)) return "EUR";
  if (/\$|usd/i.test(text)) return "USD";
  if (/gbp|£/i.test(text)) return "GBP";
  return null;
}
