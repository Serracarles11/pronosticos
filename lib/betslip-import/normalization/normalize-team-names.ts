import { correctLikelyTeamName } from "./ocr-corrections.ts";
import { normalizeToken, titleCaseEs } from "./normalize-text.ts";

const TEAM_TRANSLATIONS: Record<string, string> = {
  "south africa": "Sudafrica",
  "south korea": "Corea del Sur",
  "czech republic": "Republica Checa",
  czechia: "Republica Checa",
  "united states": "Estados Unidos",
  ivory: "Costa de Marfil",
  "ivory coast": "Costa de Marfil",
  switzerland: "Suiza",
  netherlands: "Paises Bajos",
  morocco: "Marruecos",
  germany: "Alemania",
  england: "Inglaterra",
  scotland: "Escocia",
  spain: "Espana",
  france: "Francia",
  italy: "Italia",
  portugal: "Portugal",
  brazil: "Brasil",
  argentina: "Argentina",
  mexico: "Mexico",
  canada: "Canada",
  paraguay: "Paraguay",
  qatar: "Qatar",
  haiti: "Haiti",
  australia: "Australia",
  turkey: "Turquia",
  japan: "Japon",
  ecuador: "Ecuador",
  uruguay: "Uruguay",
  belgium: "Belgica",
  egypt: "Egipto",
  croatia: "Croacia",
  tunisia: "Tunez",
  senegal: "Senegal",
  norway: "Noruega",
  greece: "Grecia",
};

export function normalizeTeamName(value: string) {
  const likely = correctLikelyTeamName(value);
  const translated = TEAM_TRANSLATIONS[normalizeToken(likely.value)] ?? titleCaseEs(likely.value);
  return { value: translated, correction: likely.correction };
}

export function normalizeEventTeams(home: string, away: string) {
  const homeTeam = normalizeTeamName(home);
  const awayTeam = normalizeTeamName(away);
  return {
    eventName: `${homeTeam.value} vs ${awayTeam.value}`,
    corrections: [homeTeam.correction, awayTeam.correction].filter((item): item is string => Boolean(item)),
  };
}
