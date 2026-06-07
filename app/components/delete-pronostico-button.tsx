"use client";

import { deletePronostico } from "@/app/actions/pronosticos";

export function DeletePronosticoButton({ pronosticoId }: { pronosticoId: string }) {
  return (
    <form
      action={deletePronostico}
      className="delete-pronostico-form"
      onSubmit={(event) => {
        const confirmed = window.confirm(
          "Eliminar este pronostico? Esta accion no se puede deshacer."
        );
        if (!confirmed) event.preventDefault();
      }}
    >
      <input name="pronostico_id" type="hidden" value={pronosticoId} />
      <button className="btn btn--danger" type="submit">
        Eliminar
      </button>
    </form>
  );
}
