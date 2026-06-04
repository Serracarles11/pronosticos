export type FootballDataCompetitionCode = "PL" | "PD" | "SA" | "BL1" | "FL1" | "CL" | string;

export type FootballDataStatus =
  | "SCHEDULED"
  | "TIMED"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "SUSPENDED"
  | "CANCELED"
  | string;

export type InternalMatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export type FootballDataTeam = {
  id?: number | string | null;
  name?: string | null;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
};

export type FootballDataCompetition = {
  id?: number | string | null;
  name?: string | null;
  code?: string | null;
  emblem?: string | null;
};

export type FootballDataScore = {
  winner?: string | null;
  fullTime?: {
    home?: number | null;
    away?: number | null;
  } | null;
};

export type FootballDataRawMatch = {
  id?: number | string | null;
  utcDate?: string | null;
  status?: FootballDataStatus | null;
  matchday?: number | null;
  stage?: string | null;
  group?: string | null;
  lastUpdated?: string | null;
  competition?: FootballDataCompetition | null;
  homeTeam?: FootballDataTeam | null;
  awayTeam?: FootballDataTeam | null;
  score?: FootballDataScore | null;
};

export type FootballDataMatchesResponse = {
  matches?: FootballDataRawMatch[];
};

export type NormalizedFootballMatch = {
  external_id: string;
  provider: "football-data.org";
  competition_code: string | null;
  competition_name: string | null;
  competition_emblem: string | null;
  home_team_id: string | null;
  home_team_name: string;
  home_team_short_name: string | null;
  home_team_crest: string | null;
  away_team_id: string | null;
  away_team_name: string;
  away_team_short_name: string | null;
  away_team_crest: string | null;
  kickoff_at: string;
  status: InternalMatchStatus;
  matchday: number | null;
  stage: string | null;
  group_name: string | null;
  home_score: number | null;
  away_score: number | null;
  winner: string | null;
  last_updated_provider: string | null;
  raw_json: FootballDataRawMatch;
};

export type FootballMatchPickerItem = {
  id: string;
  external_id: string;
  competition_code: string | null;
  competition_name: string | null;
  competition_emblem: string | null;
  home_team_name: string;
  home_team_short_name: string | null;
  home_team_crest: string | null;
  away_team_name: string;
  away_team_short_name: string | null;
  away_team_crest: string | null;
  kickoff_at: string;
  status: InternalMatchStatus;
  home_score: number | null;
  away_score: number | null;
};

export type FootballSyncStats = {
  status: "ok" | "partial" | "error";
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
};
