import Link from "next/link";
import { TodosGanamosShell } from "../components/todosganamos-shell";

export default function CookiesPage() {
  return (
    <TodosGanamosShell active="landing">
      <main className="legal-page">
        <div className="container legal-page__inner">
          <p className="legal-page__eyebrow">Cookies</p>
          <h1>Politica de cookies</h1>
          <p>
            TodosGanamos usa cookies tecnicas necesarias para que la aplicacion funcione y
            mantener la sesion cuando inicias sesion.
          </p>

          <section>
            <h2>Cookies tecnicas necesarias</h2>
            <p>
              Supabase puede usar cookies tecnicas de autenticacion para mantener la sesion.
              Estas cookies son necesarias para prestar el servicio solicitado por el usuario.
            </p>
          </section>

          <section>
            <h2>Analitica y publicidad</h2>
            <p>
              Esta implementacion no anade cookies de analitica ni publicidad. Si se instalan
              herramientas de medicion o marketing, debe actualizarse esta politica y, cuando
              sea necesario, solicitar consentimiento previo.
            </p>
          </section>

          <section>
            <h2>Gestion</h2>
            <p>
              Puedes borrar o bloquear cookies desde la configuracion de tu navegador. Si
              bloqueas cookies tecnicas, algunas funciones como iniciar sesion pueden dejar de
              funcionar.
            </p>
          </section>

          <div className="legal-page__actions">
            <Link href="/privacidad" className="btn btn--primary">
              Ver privacidad
            </Link>
            <Link href="/terminos" className="btn btn--ghost">
              Ver terminos
            </Link>
          </div>
        </div>
      </main>
    </TodosGanamosShell>
  );
}
