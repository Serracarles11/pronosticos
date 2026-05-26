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
      className={saved ? "btn btn--ghost is-active" : "btn btn--ghost"}
      aria-label={saved ? "Quitar guardado" : "Guardar"}
    >
      {saved ? "🔖 Guardado" : "🔖 Guardar"}
    </button>
  );
}
