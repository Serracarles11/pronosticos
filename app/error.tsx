"use client";

import Link from "next/link";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="container error-page">
      <span className="badge badge--lock">Error</span>
      <h1>Algo no ha ido bien</h1>
      <p>Hemos recibido una respuesta inesperada. Puedes reintentar o volver al feed.</p>
      <div className="legal-page__actions">
        <button className="btn btn--primary" type="button" onClick={reset}>
          Reintentar
        </button>
        <Link className="btn btn--ghost" href="/feed">
          Ir al feed
        </Link>
      </div>
    </main>
  );
}
