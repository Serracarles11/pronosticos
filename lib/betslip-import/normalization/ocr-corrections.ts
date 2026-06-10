import { normalizeToken } from "./normalize-text.ts";

const DIRECT_CORRECTIONS: Array<[RegExp, string, string]> = [
  [/\bSi\b/g, "Si", "Se ha detectado 'Si'; revisa si debe ser 'Si' o 'Si gana'."],
  [/\bMas\b/g, "Mas", "Se ha detectado 'Mas'; revisa el mercado de goles."],
  [/\bM[eé]s\s+de\s+15\b/gi, "Mas de 1,5", "Mas de 15 corregido a Mas de 1,5."],
  [/\bC[oó]meres\b/gi, "Corners", "Comeres corregido a Corners."],
  [/\bComeres\b/gi, "Corners", "Comeres corregido a Corners."],
];

const TEAM_CORRECTIONS: Record<string, string> = {
  greca: "Grecia",
  maruega: "Noruega",
  emrador: "Ecuador",
  mala: "Italia",
};

export function applyOcrCorrections(value: string) {
  const corrections: string[] = [];
  let next = value
    .replace(/SÃƒÂ­|SÃ­/g, "Si")
    .replace(/MÃƒÂ¡s|MÃ¡s/g, "Mas")
    .replace(/NÃƒÂºmero|NÃºmero/g, "Numero")
    .replace(/CÃƒÂ³rners|CÃ³rners/g, "Corners")
    .replace(/â‚¬|Ã¢â€šÂ¬/g, " EUR");

  for (const [pattern, replacement, message] of DIRECT_CORRECTIONS) {
    if (!pattern.test(next)) continue;
    next = next.replace(pattern, replacement);
    if (!corrections.includes(message)) corrections.push(message);
  }

  return { text: next, corrections };
}

export function correctLikelyTeamName(value: string) {
  const cleaned = value.trim();
  const correction = TEAM_CORRECTIONS[normalizeToken(cleaned)];
  if (!correction) return { value: cleaned, correction: null };
  return { value: correction, correction: `${cleaned} corregido a ${correction}.` };
}
