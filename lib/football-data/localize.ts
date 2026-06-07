import type { FootballMatchPickerItem, NormalizedFootballMatch } from "./types";

const TEAM_NAME_ES: Record<string, string> = {
  argentina: "Argentina",
  australia: "Australia",
  austria: "Austria",
  belgium: "Belgica",
  "bosnia and herzegovina": "Bosnia y Herzegovina",
  brazil: "Brasil",
  canada: "Canada",
  "cape verde": "Cabo Verde",
  "cape verde islands": "Cabo Verde",
  chile: "Chile",
  colombia: "Colombia",
  croatia: "Croacia",
  "czech republic": "Republica Checa",
  czechia: "Republica Checa",
  denmark: "Dinamarca",
  ecuador: "Ecuador",
  england: "Inglaterra",
  france: "Francia",
  germany: "Alemania",
  ghana: "Ghana",
  italy: "Italia",
  japan: "Japon",
  "korea republic": "Corea del Sur",
  mexico: "Mexico",
  morocco: "Marruecos",
  netherlands: "Paises Bajos",
  paraguay: "Paraguay",
  poland: "Polonia",
  portugal: "Portugal",
  qatar: "Catar",
  "saudi arabia": "Arabia Saudi",
  senegal: "Senegal",
  serbia: "Serbia",
  "south africa": "Sudafrica",
  spain: "Espana",
  switzerland: "Suiza",
  tunisia: "Tunez",
  "united states": "Estados Unidos",
  "united states of america": "Estados Unidos",
  uruguay: "Uruguay",
  wales: "Gales",
};

const COMPETITION_NAME_ES: Record<string, string> = {
  "fifa world cup": "Mundial",
  "world cup": "Mundial",
  "uefa champions league": "Champions League",
  "primera division": "LaLiga",
};

function key(value: string) {
  return value.trim().toLowerCase();
}

export function localizeFootballTeamName(value: string) {
  return TEAM_NAME_ES[key(value)] ?? value;
}

export function localizeFootballCompetitionName(value: string | null) {
  if (!value) return value;
  return COMPETITION_NAME_ES[key(value)] ?? value;
}

export function footballTeamSearchTerms(value?: string | null) {
  const term = value?.trim();
  if (!term) return [];
  const normalized = key(term);
  const terms = new Set([term]);

  for (const [english, spanish] of Object.entries(TEAM_NAME_ES)) {
    const spanishKey = key(spanish);
    if (spanishKey.includes(normalized) || normalized.includes(spanishKey)) {
      terms.add(english);
      terms.add(spanish);
    }
    if (english.includes(normalized) || normalized.includes(english)) {
      terms.add(english);
      terms.add(spanish);
    }
  }

  return Array.from(terms);
}

export function localizeFootballMatch<T extends FootballMatchPickerItem | NormalizedFootballMatch>(
  match: T
): T {
  return {
    ...match,
    competition_name: localizeFootballCompetitionName(match.competition_name),
    home_team_name: localizeFootballTeamName(match.home_team_name),
    home_team_short_name: match.home_team_short_name
      ? localizeFootballTeamName(match.home_team_short_name)
      : match.home_team_short_name,
    away_team_name: localizeFootballTeamName(match.away_team_name),
    away_team_short_name: match.away_team_short_name
      ? localizeFootballTeamName(match.away_team_short_name)
      : match.away_team_short_name,
  };
}
