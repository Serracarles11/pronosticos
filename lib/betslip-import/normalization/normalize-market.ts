import { cleanLine, normalizeToken } from "./normalize-text.ts";

const MARKET_TRANSLATIONS: Array<[RegExp, string]> = [
  [/^both teams to score$/i, "Ambos marcan"],
  [/^btts$/i, "Ambos marcan"],
  [/^match result$/i, "Resultado"],
  [/^full time result$/i, "Resultado"],
  [/^winner$/i, "Ganador"],
  [/^total goals$/i, "Total goles"],
  [/^over\/under$/i, "Mas/Menos"],
  [/^double chance$/i, "Doble oportunidad"],
  [/^draw no bet$/i, "Empate no valido"],
  [/^bet builder$/i, "Bet builder"],
  [/^same game parlay$/i, "Bet builder"],
  [/^mymatch$/i, "MyMatch"],
];

export function normalizeMarket(value: string) {
  const cleaned = cleanLine(value.replace(/^mercado\s*:?\s*/i, ""));
  const translated = MARKET_TRANSLATIONS.find(([pattern]) => pattern.test(cleaned))?.[1];
  if (translated) return translated;
  if (normalizeToken(cleaned).includes("bet builder")) return "Bet builder";
  if (normalizeToken(cleaned).includes("mymatch") || normalizeToken(cleaned).includes("my match")) return "MyMatch";
  return cleaned;
}

export function isBuilderMarket(value: string) {
  const token = normalizeToken(value);
  return token.includes("bet builder") || token.includes("same game parlay") || token.includes("mymatch") || token.includes("my match");
}
