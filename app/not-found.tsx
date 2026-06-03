import Link from "next/link";
import { TodosGanamosShell } from "./components/todosganamos-shell";

export default function NotFound() {
  return (
    <TodosGanamosShell active="landing">
      <main className="container error-page">
        <span className="badge">404</span>
        <h1>Pagina no encontrada</h1>
        <p>El enlace no existe, ha caducado o el contenido ya no esta disponible.</p>
        <div className="legal-page__actions">
          <Link className="btn btn--primary" href="/feed">
            Ir al feed
          </Link>
          <Link className="btn btn--ghost" href="/">
            Volver al inicio
          </Link>
        </div>
      </main>
    </TodosGanamosShell>
  );
}
