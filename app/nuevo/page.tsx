"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { PulsoShell } from "../components/pulso-shell";
import { createPronostico } from "@/app/actions/pronosticos";

type Pick = { mercado: string; cuota: string };

function combinedOdds(picks: Pick[]): number {
  return picks.reduce((acc, p) => {
    const v = parseFloat(p.cuota);
    return acc * (isNaN(v) || v < 1.01 ? 1 : v);
  }, 1);
}

export default function NuevoPage() {
  const [confianza, setConfianza] = useState(4);
  const [picks, setPicks] = useState<Pick[]>([{ mercado: "", cuota: "" }]);
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
    <PulsoShell active="feed">
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

            {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

            <form action={handleSubmit} id="pred-form">
              <div className="publish__grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="deporte">
                    Deporte
                  </label>
                  <select
                    id="deporte"
                    name="deporte"
                    className="select"
                    defaultValue="Futbol"
                    onChange={(e) => setPreview((p) => ({ ...p, deporte: e.target.value }))}
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
                    defaultValue="LaLiga"
                    onChange={(e) => setPreview((p) => ({ ...p, competicion: e.target.value }))}
                  >
                    <option>LaLiga</option>
                    <option>Premier League</option>
                    <option>Champions League</option>
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
                  onChange={(e) => setPreview((p) => ({ ...p, evento: e.target.value || "..." }))}
                  defaultValue=""
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
                  Min. 20 caracteres. Pulso premia las apuestas argumentadas.
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
                    type="datetime-local"
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
            </article>

            <div className="notice publish__notice">
              <span className="notice__icon">i</span>
              <div>
                <strong className="notice__title">Recuerda</strong>
                <span className="notice__body">
                  Pulso es una comunidad de pronosticos. No se apuesta dinero real.
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
    </PulsoShell>
  );
}
