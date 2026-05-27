"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type ProofImageModalProps = {
  imageUrl: string;
};

export function ProofImageModal({ imageUrl }: ProofImageModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button className="btn btn--ghost" type="button" onClick={() => setOpen(true)}>
        Ver captura
      </button>

      {open && (
        <div
          className="proof-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Captura de la apuesta"
          onClick={() => setOpen(false)}
        >
          <div className="proof-modal__panel" onClick={(event) => event.stopPropagation()}>
            <header className="proof-modal__head">
              <strong>Captura de la apuesta</strong>
              <button
                className="proof-modal__close"
                type="button"
                aria-label="Cerrar captura"
                onClick={() => setOpen(false)}
              >
                x
              </button>
            </header>
            <div className="proof-modal__image-wrap">
              <Image
                src={imageUrl}
                alt="Captura de la apuesta"
                width={1200}
                height={900}
                unoptimized
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
