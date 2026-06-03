"use client";

import { useState, useTransition } from "react";
import { submitBetaFeedback } from "@/app/actions/pronosticos";

const CATEGORIES = [
  ["bug", "Bug"],
  ["idea", "Idea"],
  ["ux", "UX"],
  ["contenido", "Contenido"],
  ["otro", "Otro"],
] as const;

export function BetaFeedback() {
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState("bug");
  const [rating, setRating] = useState(4);
  const [mensaje, setMensaje] = useState("");
  const [status, setStatus] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setStatus(null);
    startTransition(async () => {
      const result = await submitBetaFeedback(categoria, mensaje, window.location.href, rating);
      if (result?.error) {
        setStatus({ type: "error", text: result.error });
      } else {
        setStatus({ type: "ok", text: "Feedback enviado. Gracias por probar la beta." });
        setMensaje("");
      }
    });
  }

  return (
    <div className={`beta-feedback ${open ? "is-open" : ""}`}>
      {open && (
        <div className="beta-feedback__panel">
          <div className="beta-feedback__head">
            <div>
              <strong>Feedback beta</strong>
              <span>Reporta fallos o mejoras en 30 segundos.</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar">
              x
            </button>
          </div>
          <div className="beta-feedback__grid">
            <select
              className="select"
              value={categoria}
              onChange={(event) => setCategoria(event.target.value)}
            >
              {CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value}/5
                </option>
              ))}
            </select>
          </div>
          <textarea
            className="textarea"
            rows={4}
            maxLength={1200}
            value={mensaje}
            onChange={(event) => setMensaje(event.target.value)}
            placeholder="Que falla, que echas en falta o que mejorarias..."
          />
          {status && (
            <div className={`account-alert account-alert--${status.type}`}>{status.text}</div>
          )}
          <button
            className="btn btn--primary btn--flex"
            type="button"
            onClick={submit}
            disabled={isPending}
          >
            {isPending ? "Enviando..." : "Enviar feedback"}
          </button>
        </div>
      )}
      <button className="beta-feedback__trigger" type="button" onClick={() => setOpen(true)}>
        Beta feedback
      </button>
    </div>
  );
}
