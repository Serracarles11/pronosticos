/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { getMatchesForPicker } from "@/lib/football-data/search";
import type { FootballMatchPickerItem } from "@/lib/football-data/types";

const FOOTBALL_COMPETITIONS = [
  ["", "Todas"],
  ["PL", "Premier League"],
  ["PD", "LaLiga"],
  ["SA", "Serie A"],
  ["BL1", "Bundesliga"],
  ["FL1", "Ligue 1"],
  ["CL", "Champions League"],
  ["WC", "Mundial"],
] as const;

function dayRange(dateValue?: string) {
  if (!dateValue) {
    const now = new Date();
    const to = new Date(now);
    to.setUTCDate(to.getUTCDate() + 14);
    return { dateFrom: now.toISOString(), dateTo: to.toISOString() };
  }

  const from = new Date(`${dateValue}T00:00:00`);
  const to = new Date(`${dateValue}T23:59:59`);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

function formatMatchDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: string) {
  if (status === "live") return "En directo";
  if (status === "finished") return "Finalizado";
  if (status === "postponed") return "Aplazado";
  if (status === "cancelled") return "Cancelado";
  return "Programado";
}

export default async function PartidosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; date?: string; competitionCode?: string }>;
}) {
  const { q, date, competitionCode } = await searchParams;
  const range = dayRange(date);

  let matches: FootballMatchPickerItem[] = [];
  let error: string | null = null;
  try {
    matches = await getMatchesForPicker({
      query: q,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      competitionCode,
      limit: 50,
    });
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudieron cargar partidos.";
  }

  return (
    <TodosGanamosShell active="partidos">
      <main className="container matches-page">
        <header className="saved-page__header">
          <div>
            <span className="badge badge--purple">Football-data.org</span>
            <h1>Partidos de futbol</h1>
            <p></p>
          </div>
          <Link className="btn btn--primary" href="/nuevo">
            + Crear pronostico
          </Link>
        </header>

        <form className="matches-filters">
          <input
            className="input"
            defaultValue={q ?? ""}
            name="q"
            placeholder="Buscar equipo o competicion"
          />
          <input className="input" defaultValue={date ?? ""} name="date" type="date" />
          <select className="select" defaultValue={competitionCode ?? ""} name="competitionCode">
            {FOOTBALL_COMPETITIONS.map(([value, label]) => (
              <option key={value || "all"} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn btn--ghost" type="submit">
            Filtrar
          </button>
        </form>

        {error ? (
          <div className="card card__pad">
            <p className="muted">No hay partidos disponibles. Aplica la migracion y ejecuta el sync.</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="card card__pad">
            <p className="muted">No hay partidos disponibles con esos filtros.</p>
          </div>
        ) : (
          <div className="matches-list">
            {matches.map((match) => (
              <article className="card match-card" key={match.id}>
                <div>
                  <div className="match-card__teams">
                    <span className="match-card__team">
                      {match.home_team_crest && <img alt="" src={match.home_team_crest} />}
                      <span>{match.home_team_name}</span>
                    </span>
                    <span className="muted">vs</span>
                    <span className="match-card__team">
                      {match.away_team_crest && <img alt="" src={match.away_team_crest} />}
                      <span>{match.away_team_name}</span>
                    </span>
                  </div>
                  <div className="match-card__meta">
                    {match.competition_name ?? match.competition_code ?? "Futbol"} -{" "}
                    {formatMatchDate(match.kickoff_at)} - {statusLabel(match.status)}
                    {match.home_score != null && match.away_score != null
                      ? ` - ${match.home_score}-${match.away_score}`
                      : ""}
                  </div>
                </div>
                <div className="match-card__actions">
                  <span className="badge">{statusLabel(match.status)}</span>
                  <Link className="btn btn--primary" href={`/nuevo?matchId=${match.id}`}>
                    Crear pronostico
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </TodosGanamosShell>
  );
}
