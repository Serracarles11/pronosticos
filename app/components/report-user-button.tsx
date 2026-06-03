"use client";

import { useState, useTransition } from "react";
import { reportUser, toggleBlockUser, toggleMuteUser } from "@/app/actions/social";

const REASONS = [
  ["spam", "Spam"],
  ["abuso", "Abuso o acoso"],
  ["suplantacion", "Suplantacion de identidad"],
  ["riesgo", "Contenido de riesgo"],
  ["ilegal", "Contenido ilegal"],
  ["otro", "Otro"],
] as const;

export function ReportUserButton({ userId, initialMuted = false }: { userId: string; initialMuted?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("spam");
  const [detail, setDetail] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [muted, setMuted] = useState(initialMuted);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitReport() {
    setMessage(null);
    startTransition(async () => {
      const result = await reportUser(userId, reason, detail);
      setMessage(
        result?.error
          ? { type: "error", text: result.error }
          : { type: "ok", text: "Reporte enviado para revision." }
      );
      if (!result?.error) setDetail("");
    });
  }

  function toggleBlock() {
    setMessage(null);
    startTransition(async () => {
      const result = await toggleBlockUser(userId);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setBlocked(!!result?.blocked);
      setMessage({
        type: "ok",
        text: result?.blocked ? "Usuario bloqueado." : "Usuario desbloqueado.",
      });
    });
  }

  function toggleMute() {
    setMessage(null);
    startTransition(async () => {
      const result = await toggleMuteUser(userId);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }
      setMuted(!!result?.muted);
      setMessage({
        type: "ok",
        text: result?.muted ? "Usuario silenciado." : "Usuario visible de nuevo.",
      });
    });
  }

  return (
    <>
      <button className="btn btn--ghost" type="button" onClick={() => setOpen(true)}>
        Mas opciones
      </button>
      {open && (
        <div className="modal-lite" role="dialog" aria-modal="true" aria-labelledby="report-user-title">
          <div className="modal-lite__panel">
            <div className="modal-lite__head">
              <div>
                <h3 id="report-user-title">Seguridad del perfil</h3>
                <p>Reporta incumplimientos o bloquea este usuario para tu cuenta.</p>
              </div>
              <button
                aria-label="Cerrar"
                className="modal-lite__close"
                onClick={() => setOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="report-user-reason">
                Motivo del reporte
              </label>
              <select
                className="select"
                id="report-user-reason"
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              >
                {REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="report-user-detail">
                Detalle opcional
              </label>
              <textarea
                className="textarea"
                id="report-user-detail"
                maxLength={800}
                onChange={(event) => setDetail(event.target.value)}
                placeholder="Contexto para moderacion..."
                rows={4}
                value={detail}
              />
            </div>

            {message && <div className={`account-alert account-alert--${message.type}`}>{message.text}</div>}

            <div className="modal-lite__actions">
              <button className="btn btn--primary" disabled={isPending} onClick={submitReport} type="button">
                Enviar reporte
              </button>
              <button className="btn btn--ghost" disabled={isPending} onClick={toggleBlock} type="button">
                {blocked ? "Desbloquear usuario" : "Bloquear usuario"}
              </button>
              <button className="btn btn--ghost" disabled={isPending} onClick={toggleMute} type="button">
                {muted ? "Dejar de silenciar" : "Silenciar usuario"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
