"use client";

import { useState, useTransition } from "react";
import { reportPronostico } from "@/app/actions/pronosticos";

type Props = {
  pronosticoId: string;
};

const MOTIVOS = [
  ["spam", "Spam"],
  ["abuso", "Abuso o acoso"],
  ["riesgo", "Riesgo de juego"],
  ["ilegal", "Contenido ilegal"],
  ["otro", "Otro"],
] as const;

export function ReportButton({ pronosticoId }: Props) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("spam");
  const [detalle, setDetalle] = useState("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await reportPronostico(pronosticoId, motivo, detalle);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "ok", text: "Reporte enviado. Lo revisaremos cuanto antes." });
        setDetalle("");
      }
    });
  }

  return (
    <>
      <button className="btn btn--ghost" type="button" onClick={() => setOpen(true)}>
        Reportar
      </button>
      {open && (
        <div className="modal-lite" role="dialog" aria-modal="true" aria-labelledby="report-title">
          <div className="modal-lite__panel">
            <div className="modal-lite__head">
              <div>
                <h3 id="report-title">Reportar pronostico</h3>
                <p>Usa esto solo para contenido que incumpla normas o pueda ser peligroso.</p>
              </div>
              <button
                className="modal-lite__close"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="report-motivo">
                Motivo
              </label>
              <select
                id="report-motivo"
                className="select"
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
              >
                {MOTIVOS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="report-detalle">
                Detalle opcional
              </label>
              <textarea
                id="report-detalle"
                className="textarea"
                rows={4}
                maxLength={800}
                value={detalle}
                onChange={(event) => setDetalle(event.target.value)}
                placeholder="Contexto para moderacion..."
              />
            </div>

            {message && (
              <div className={`account-alert account-alert--${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="modal-lite__actions">
              <button className="btn btn--primary" type="button" onClick={submit} disabled={isPending}>
                {isPending ? "Enviando..." : "Enviar reporte"}
              </button>
              <button className="btn btn--ghost" type="button" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
