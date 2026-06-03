"use client";

import { useTransition, useState } from "react";
import { savePronostico } from "@/app/actions/pronosticos";

type Props = {
  pronosticoId: string;
  initialSaved: boolean;
};

export function SaveButton({ pronosticoId, initialSaved }: Props) {
  const [saved, setSaved] = useState(initialSaved);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !saved;
    setSaved(next);
    startTransition(() => void savePronostico(pronosticoId));
  }

  return (
    <button
      onClick={handleClick}
      className={saved ? "save-button is-active" : "save-button"}
      aria-label={saved ? "Quitar guardado" : "Guardar"}
    >
      <span aria-hidden="true">{saved ? "✓" : "+"}</span>
      {saved ? "Guardado" : "Guardar"}
    </button>
  );
}
