/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { createPronostico } from "@/app/actions/pronosticos";
import { formatPickCategory, normalizePickCategories } from "@/lib/pronostico-meta";
import type { FootballMatchPickerItem } from "@/lib/football-data/types";

type Pick = { mercado: string; cuota: string };

const CATEGORY_PRESETS = [
  ["quiniela", "Quiniela"],
  ["cuota-alta", "Cuota alta"],
  ["combinada", "Combinada"],
  ["laliga", "LaLiga"],
  ["champions", "Champions"],
  ["value-bet", "Value bet"],
] as const;

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

function combinedOdds(picks: Pick[]): number {
  return picks.reduce((acc, p) => {
    const v = parseFloat(p.cuota);
    return acc * (isNaN(v) || v < 1.01 ? 1 : v);
  }, 1);
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatMatchDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NuevoPage() {
  const [confianza, setConfianza] = useState(4);
  const [picks, setPicks] = useState<Pick[]>([{ mercado: "", cuota: "" }]);
  const [categorias, setCategorias] = useState("");
  const [copyLink, setCopyLink] = useState("");
  const [deporte, setDeporte] = useState("Futbol");
  const [competicion, setCompeticion] = useState("LaLiga");
  const [evento, setEvento] = useState("");
  const [fechaEvento, setFechaEvento] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<FootballMatchPickerItem | null>(null);
  const [matchQuery, setMatchQuery] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchCompetition, setMatchCompetition] = useState("");
  const [matchResults, setMatchResults] = useState<FootballMatchPickerItem[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [preview, setPreview] = useState({
    evento: "Real Sociedad - Villarreal",
    explicacion: "La Real lleva 6 partidos seguidos con BTTS en casa...",
    competicion: "LaLiga",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updatePick(idx: number, field: keyof Pick, value: string) {
    setPicks((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  function addPick() {
    setPicks((prev) => [...prev, { mercado: "", cuota: "" }]);
  }

  function removePick(idx: number) {
    setPicks((prev) => prev.filter((_, i) => i !== idx));
  }

  function toggleCategory(category: string) {
    setCategorias((current) => {
      const currentCategories = normalizePickCategories(current);
      const next = currentCategories.includes(category)
        ? currentCategories.filter((item) => item !== category)
        : [...currentCategories, category];
      return next.join(", ");
    });
  }

  const totalOdds = combinedOdds(picks);
  const previewMercado =
    picks.length === 1
      ? picks[0].mercado || "..."
      : picks.length > 1
      ? `Combinada (${picks.length} sel.)`
      : "...";
  const previewCuota =
    picks.length === 1
      ? picks[0].cuota || "?"
      : totalOdds.toFixed(2);
  const previewCategories = normalizePickCategories(categorias);

  function applyFootballMatch(match: FootballMatchPickerItem) {
    const eventLabel = `${match.home_team_name} vs ${match.away_team_name}`;
    const matchCompetitionName = match.competition_name ?? match.competition_code ?? "Futbol";
    setSelectedMatch(match);
    setDeporte("Futbol");
    setCompeticion(matchCompetitionName);
    setEvento(eventLabel);
    setFechaEvento(toDatetimeLocal(match.kickoff_at));
    setPreview((current) => ({
      ...current,
      evento: eventLabel,
      competicion: matchCompetitionName,
    }));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get("matchId");
    if (!matchId) return;

    let ignore = false;
    fetch(`/api/football-matches/search?id=${encodeURIComponent(matchId)}&limit=1`)
      .then((response) => response.json())
      .then((payload: { matches?: FootballMatchPickerItem[] }) => {
        if (!ignore && payload.matches?.[0]) applyFootballMatch(payload.matches[0]);
      })
      .catch(() => {
        if (!ignore) setMatchError("No se pudo cargar el partido seleccionado.");
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    const timeout = window.setTimeout(async () => {
      setMatchLoading(true);
      setMatchError(null);

      const params = new URLSearchParams({ limit: "8" });
      if (matchQuery.trim()) params.set("q", matchQuery.trim());
      if (matchCompetition) params.set("competitionCode", matchCompetition);
      if (matchDate) {
        const from = new Date(`${matchDate}T00:00:00`);
        const to = new Date(`${matchDate}T23:59:59`);
        params.set("dateFrom", from.toISOString());
        params.set("dateTo", to.toISOString());
      }

      try {
        const response = await fetch(`/api/football-matches/search?${params.toString()}`);
        const payload = (await response.json()) as {
          matches?: FootballMatchPickerItem[];
          error?: string;
        };
        if (ignore) return;
        setMatchResults(payload.matches ?? []);
        if (payload.error) setMatchError(payload.error);
      } catch {
        if (!ignore) setMatchError("No se pudieron buscar partidos.");
      } finally {
        if (!ignore) setMatchLoading(false);
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timeout);
    };
  }, [matchCompetition, matchDate, matchQuery]);

  async function handleSubmit(formData: FormData) {
    formData.set("confianza", String(confianza));
    formData.set("picks_json", JSON.stringify(picks));
    setError(null);
    startTransition(async () => {
      const result = await createPronostico(formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleDraft() {
    const form = document.getElementById("pred-form") as HTMLFormElement;
    if (!form) return;
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "_action";
    hidden.value = "borrador";
    form.appendChild(hidden);
    form.requestSubmit();
  }

  return (
    <TodosGanamosShell active="feed">
      <main className="publish">
        <div className="publish__inner">
          <section className="publish__form">
            <Link href="/feed" className="publish__back">
              ← Volver al feed
            </Link>
            <h1>Nuevo pronostico</h1>
            <p className="publish__lede">
              Publica lo que ves antes que nadie. Cuanto mas claro lo expliques,
              mas facil sera que la comunidad te siga.
            </p>
            <div className="responsible-note responsible-note--compact">
              <strong>+18</strong>
              <span>No publiques llamadas a apostar dinero real ni promesas de ganancia.</span>
            </div>

            {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

            <form action={handleSubmit} id="pred-form">
              <div className="field match-picker">
                <div className="match-picker__head">
                  <div>
                    <label className="field__label" htmlFor="match_search">
                      Partido real
                    </label>
                    <div className="field__hint">
                      Opcional. Selecciona un partido sincronizado o escribe el evento manualmente.
                    </div>
                  </div>
                  {selectedMatch && (
                    <button
                      className="btn btn--ghost"
                      onClick={() => setSelectedMatch(null)}
                      type="button"
                    >
                      Quitar partido
                    </button>
                  )}
                </div>
                <input type="hidden" name="football_match_id" value={selectedMatch?.id ?? ""} />
                <input
                  type="hidden"
                  name="football_match_external_id"
                  value={selectedMatch?.external_id ?? ""}
                />
                <div className="match-picker__filters">
                  <input
                    className="input"
                    id="match_search"
                    onChange={(event) => setMatchQuery(event.target.value)}
                    placeholder="Buscar Real Madrid, Barcelona, Champions..."
                    type="search"
                    value={matchQuery}
                  />
                  <input
                    className="input"
                    onChange={(event) => setMatchDate(event.target.value)}
                    type="date"
                    value={matchDate}
                  />
                  <select
                    className="select"
                    onChange={(event) => setMatchCompetition(event.target.value)}
                    value={matchCompetition}
                  >
                    {FOOTBALL_COMPETITIONS.map(([value, label]) => (
                      <option key={value || "all"} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedMatch && (
                  <div className="match-picker__selected">
                    <strong>{selectedMatch.home_team_name} vs {selectedMatch.away_team_name}</strong>
                    <span>{selectedMatch.competition_name ?? selectedMatch.competition_code} - {formatMatchDate(selectedMatch.kickoff_at)}</span>
                  </div>
                )}
                <div className="match-picker__results">
                  {matchLoading && <p className="muted">Buscando partidos...</p>}
                  {!matchLoading && matchError && <p className="muted">{matchError}</p>}
                  {!matchLoading && !matchError && matchResults.length === 0 && (
                    <p className="muted">No hay partidos disponibles con esos filtros.</p>
                  )}
                  {matchResults.map((match) => (
                    <button
                      className={`match-option ${selectedMatch?.id === match.id ? "is-active" : ""}`}
                      key={match.id}
                      onClick={() => applyFootballMatch(match)}
                      type="button"
                    >
                      <span className="match-option__teams">
                        {match.home_team_crest && <img alt="" src={match.home_team_crest} />}
                        <strong>{match.home_team_name}</strong>
                        <span>vs</span>
                        {match.away_team_crest && <img alt="" src={match.away_team_crest} />}
                        <strong>{match.away_team_name}</strong>
                      </span>
                      <span className="match-option__meta">
                        {match.competition_name ?? match.competition_code ?? "Futbol"} - {formatMatchDate(match.kickoff_at)} - {match.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="publish__grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="deporte">
                    Deporte
                  </label>
                  <select
                    id="deporte"
                    name="deporte"
                    className="select"
                    value={deporte}
                    onChange={(e) => setDeporte(e.target.value)}
                  >
                    <option>Futbol</option>
                    <option>Tenis</option>
                    <option>NBA</option>
                    <option>eSports</option>
                    <option>Combinada</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="competicion">
                    Competicion
                  </label>
                  <select
                    id="competicion"
                    name="competicion"
                    className="select"
                    value={competicion}
                    onChange={(e) => {
                      setCompeticion(e.target.value);
                      setPreview((p) => ({ ...p, competicion: e.target.value }));
                    }}
                  >
                    <option>LaLiga</option>
                    <option>Premier League</option>
                    <option>Champions League</option>
                    <option>Mundial</option>
                    <option>Liga Hypermotion</option>
                    <option>Roland Garros</option>
                    <option>NBA Playoffs</option>
                    <option>Otra</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="evento">
                  Evento / partido
                </label>
                <input
                  id="evento"
                  name="evento"
                  className="input"
                  placeholder="Ej: Real Sociedad - Villarreal"
                  required
                  onChange={(e) => {
                    setEvento(e.target.value);
                    setPreview((p) => ({ ...p, evento: e.target.value || "..." }));
                  }}
                  value={evento}
                />
                <div className="field__hint">
                  Escribe el nombre del partido o evento.
                </div>
              </div>

              <div className="field">
                <div className="picks-header">
                  <label className="field__label" style={{ margin: 0 }}>
                    Pronosticos / selecciones
                  </label>
                  {picks.length > 1 && (
                    <span className="picks-combined">
                      Cuota combinada: <strong className="mono">{totalOdds.toFixed(2)}</strong>
                    </span>
                  )}
                </div>

                <div className="picks-list">
                  {picks.map((pick, idx) => (
                    <div key={idx} className="pick-row">
                      <span className="pick-row__num">{idx + 1}</span>
                      <input
                        className="input pick-row__mercado"
                        placeholder="Ej: BTTS Si, Mas 2.5, Gana local..."
                        value={pick.mercado}
                        onChange={(e) => updatePick(idx, "mercado", e.target.value)}
                        required
                      />
                      <input
                        className="input mono pick-row__cuota"
                        placeholder="1.82"
                        type="number"
                        step="0.01"
                        min="1.01"
                        value={pick.cuota}
                        onChange={(e) => updatePick(idx, "cuota", e.target.value)}
                        required
                      />
                      {picks.length > 1 && (
                        <button
                          type="button"
                          className="pick-row__remove"
                          onClick={() => removePick(idx)}
                          aria-label="Eliminar seleccion"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn--ghost picks-add"
                  onClick={addPick}
                >
                  + Añadir seleccion
                </button>
                <div className="field__hint">
                  {picks.length === 1
                    ? "Pronostico simple. Añade mas selecciones para hacer una combinada."
                    : `Combinada de ${picks.length} selecciones · Cuota total: ${totalOdds.toFixed(2)}`}
                </div>
              </div>

              <div className="field">
                <label className="field__label">Nivel de confianza</label>
                <div className="confidence">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <button
                      key={step}
                      type="button"
                      className={`confidence__step ${step <= confianza ? "is-on" : ""}`.trim()}
                      onClick={() => setConfianza(step)}
                    >
                      {step}
                    </button>
                  ))}
                </div>
                <div className="field__hint">
                  {confianza}/5 -{" "}
                  {confianza <= 2
                    ? "Conviccion baja."
                    : confianza === 3
                    ? "Conviccion media."
                    : confianza === 4
                    ? "Conviccion alta. La comunidad valora mas cuando explicas por que."
                    : "Conviccion maxima. Asegurate de argumentarlo bien."}
                </div>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="explicacion">
                  Explicacion
                </label>
                <textarea
                  id="explicacion"
                  name="explicacion"
                  className="textarea"
                  rows={5}
                  placeholder="Explica tu razonamiento, estadisticas, lesiones clave..."
                  minLength={20}
                  onChange={(e) =>
                    setPreview((p) => ({ ...p, explicacion: e.target.value || "" }))
                  }
                  defaultValue=""
                />
                <div className="field__hint">
                  Min. 20 caracteres. TodosGanamos premia las apuestas argumentadas.
                </div>
              </div>

              <div className="publish__grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="fecha_evento">
                    Fecha y hora del evento
                  </label>
                  <input
                    id="fecha_evento"
                    name="fecha_evento"
                    className="input"
                    onChange={(event) => setFechaEvento(event.target.value)}
                    type="datetime-local"
                    value={fechaEvento}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="visibilidad">
                    Visibilidad
                  </label>
                  <select id="visibilidad" name="visibilidad" className="select" defaultValue="publico">
                    <option value="publico">Publico</option>
                    <option value="seguidores">Solo seguidores</option>
                    <option value="borrador">Borrador privado</option>
                  </select>
                </div>
              </div>

              <div className="publish__grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="bookmaker">
                    Bookmaker de referencia
                  </label>
                  <select className="select" defaultValue="" id="bookmaker" name="bookmaker">
                    <option value="">No indicar</option>
                    <option>Bet365</option>
                    <option>Winamax</option>
                    <option>Betfair</option>
                    <option>Betway</option>
                    <option>Otro</option>
                  </select>
                  <div className="field__hint">Solo como referencia informativa de la cuota.</div>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="stake_simulado">
                    Stake simulado
                  </label>
                  <input
                    className="input mono"
                    defaultValue="1"
                    id="stake_simulado"
                    max="100"
                    min="0.1"
                    name="stake_simulado"
                    step="0.1"
                    type="number"
                  />
                  <div className="field__hint">Unidades ficticias. Nunca representa dinero real.</div>
                </div>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="copy_link">
                  Link para copiar la apuesta
                </label>
                <input
                  className="input"
                  id="copy_link"
                  name="copy_link"
                  onChange={(event) => setCopyLink(event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={copyLink}
                />
                <div className="field__hint">
                  Opcional. Solo se aceptan enlaces HTTPS. TodosGanamos no permite apostar dentro de la app.
                </div>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="categorias">
                  Categorias de la apuesta
                </label>
                <input
                  className="input"
                  id="categorias"
                  name="categorias"
                  onChange={(event) => setCategorias(event.target.value)}
                  placeholder="quiniela, cuota-alta, laliga"
                  value={categorias}
                />
                <div className="publish-category-presets">
                  {CATEGORY_PRESETS.map(([value, label]) => {
                    const isSelected = previewCategories.includes(value);
                    return (
                      <button
                        aria-pressed={isSelected}
                        className={isSelected ? "is-active" : undefined}
                        key={value}
                        onClick={() => toggleCategory(value)}
                        type="button"
                      >
                        {isSelected ? "×" : "+"} {label}
                      </button>
                    );
                  })}
                </div>
                <div className="field__hint">
                  Separalas con comas. Se normalizan para busqueda y filtros.
                </div>
              </div>

              <div className="publish__actions">
                <button
                  type="submit"
                  className="btn btn--primary btn--lg btn--flex"
                  disabled={isPending}
                >
                  {isPending ? "Publicando..." : "Publicar pronostico"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--lg"
                  onClick={handleDraft}
                  disabled={isPending}
                >
                  Guardar borrador
                </button>
              </div>
            </form>
          </section>

          <aside className="publish__aside">
            <h4 className="side-section__title">Vista previa en el feed</h4>
            <article className="card card--featured pred">
              <header className="pred__head">
                <div className="pred__author">
                  <span className="avatar avatar--md avatar--blue">YO</span>
                  <div className="pred__author-meta">
                    <span className="pred__user">tu_usuario</span>
                    <span className="pred__sub">Ahora · {preview.competicion}</span>
                  </div>
                </div>
                <span className="pill pill--warn">
                  <span className="pill__dot" />
                  Pendiente
                </span>
              </header>
              <h3 className="pred__title">{preview.evento}</h3>
              {previewCategories.length > 0 && (
                <div className="pred-meta-list">
                  {previewCategories.map((category) => (
                    <span className="badge" key={category}>
                      {formatPickCategory(category)}
                    </span>
                  ))}
                </div>
              )}
              <div className="pred__strip">
                <div className="pred__cell">
                  <div className="pred__cell-label">Pronostico</div>
                  <div className="pred__cell-value">{previewMercado}</div>
                </div>
                <div className="pred__cell pred__cell--accent">
                  <div className="pred__cell-label">Cuota</div>
                  <div className="pred__cell-value mono">{previewCuota}</div>
                </div>
                <div className="pred__cell">
                  <div className="pred__cell-label">Confianza</div>
                  <div className="pred__confidence">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={s <= confianza ? "is-on" : ""} />
                    ))}
                  </div>
                </div>
              </div>
              {preview.explicacion && (
                <p className="pred__body">{preview.explicacion.slice(0, 100)}{preview.explicacion.length > 100 ? "..." : ""}</p>
              )}
              {copyLink && (
                <span className="badge badge--purple">Incluye link de copia</span>
              )}
            </article>

            <div className="notice publish__notice">
              <span className="notice__icon">i</span>
              <div>
                <strong className="notice__title">Recuerda</strong>
                <span className="notice__body">
                  TodosGanamos es una comunidad de pronosticos. No se apuesta dinero real.
                </span>
              </div>
            </div>

            <div className="publish__tips">
              <h4 className="side-section__title">Tips de la comunidad</h4>
              <ul>
                <li>Explica el por que, no solo el que.</li>
                <li>Apunta a pronosticos con cuotas entre 1.40 y 2.50.</li>
                <li>Se honesto con tu nivel de confianza.</li>
                <li>Publica antes del inicio del evento.</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </TodosGanamosShell>
  );
}
