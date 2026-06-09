"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePronosticoCopyLink } from "@/app/actions/pronosticos";

type Props = {
  pronosticoId: string;
  initialCopyLink?: string | null;
};

export function EditPronosticoLinkButton({ pronosticoId, initialCopyLink }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copyLink, setCopyLink] = useState(initialCopyLink ?? "");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setMessage(null);
    startTransition(async () => {
      const result = await updatePronosticoCopyLink(pronosticoId, copyLink);
      if (result?.error) {
        setMessage({ type: "error", text: result.error });
        return;
      }

      if (result?.copyLink) setCopyLink(result.copyLink);
      setMessage({ type: "ok", text: "Link guardado." });
      router.refresh();
    });
  }

  return (
    <>
      <button className="btn btn--ghost" type="button" onClick={() => setOpen(true)}>
        Editar apuesta
      </button>

      {open && (
        <div className="modal-lite" role="dialog" aria-modal="true" aria-labelledby="edit-pick-link-title">
          <div className="modal-lite__panel">
            <div className="modal-lite__head">
              <div>
                <h3 id="edit-pick-link-title">Editar apuesta</h3>
                <p>Solo puedes añadir o cambiar el link para copiar la apuesta.</p>
              </div>
              <button
                aria-label="Cerrar"
                className="modal-lite__close"
                type="button"
                onClick={() => setOpen(false)}
              >
                x
              </button>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="edit-copy-link">
                Link para copiar la apuesta
              </label>
              <input
                className="input"
                id="edit-copy-link"
                maxLength={500}
                onChange={(event) => setCopyLink(event.target.value)}
                placeholder="https://..."
                type="url"
                value={copyLink}
              />
              <div className="field__hint">Solo se aceptan enlaces HTTPS.</div>
            </div>

            {message && (
              <div className={`account-alert account-alert--${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="modal-lite__actions">
              <button className="btn btn--primary" type="button" onClick={submit} disabled={isPending}>
                {isPending ? "Guardando..." : "Guardar link"}
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
