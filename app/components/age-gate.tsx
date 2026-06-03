"use client";

import { useState } from "react";

export function AgeGate() {
  const [status, setStatus] = useState<"pending" | "blocked" | "accepted">("pending");

  function accept() {
    setStatus("accepted");
  }

  function reject() {
    setStatus("blocked");
  }

  if (status === "accepted") return null;

  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-labelledby="age-gate-title">
      <div className="age-gate__panel">
        {status === "blocked" ? (
          <>
            <span className="age-gate__mark">18+</span>
            <h2 id="age-gate-title">Acceso no permitido</h2>
            <p>
              TodosGanamos esta dirigido exclusivamente a personas mayores de edad. Si no tienes
              18 anos, no puedes acceder al contenido de la comunidad.
            </p>
            <a className="btn btn--primary btn--flex" href="https://www.ordenacionjuego.es/">
              Salir
            </a>
          </>
        ) : (
          <>
            <span className="age-gate__mark">18+</span>
            <h2 id="age-gate-title">Confirma tu edad</h2>
            <p>
              TodosGanamos es una comunidad de pronosticos deportivos sin dinero real. El contenido
              esta reservado a mayores de edad y no constituye asesoramiento financiero ni
              invitacion a apostar.
            </p>
            <div className="age-gate__actions">
              <button className="btn btn--primary btn--flex" type="button" onClick={accept}>
                Soy mayor de edad
              </button>
              <button className="btn btn--ghost btn--flex" type="button" onClick={reject}>
                No soy mayor de edad
              </button>
            </div>
            <p className="age-gate__fine">
              Al continuar aceptas los terminos, la politica de privacidad y el uso de
              los avisos legales de la plataforma.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
