import Link from "next/link";
import { TodosGanamosShell } from "../components/todosganamos-shell";

export default function JuegoSeguroPage() {
  return (
    <TodosGanamosShell active="landing">
      <main className="legal-page">
        <div className="container legal-page__inner">
          <p className="legal-page__eyebrow">Juego seguro</p>
          <h1>Juego responsable y proteccion de menores</h1>
          <p>
            TodosGanamos no permite apostar dinero real, pero el contenido deportivo puede estar
            relacionado con cuotas y mercados. Por eso aplicamos mensajes de prevencion y
            acceso reservado a mayores de edad.
          </p>

          <section>
            <h2>Mayores de 18 anos</h2>
            <p>
              No uses TodosGanamos si eres menor de edad. La plataforma muestra un aviso de edad al
              acceder y puede retirar cuentas o contenido si detecta incumplimientos.
            </p>
          </section>

          <section>
            <h2>No persigas perdidas</h2>
            <p>
              Las cuotas no garantizan resultados. No uses pronosticos como recomendacion de
              inversion ni como incentivo para apostar dinero que no puedes permitirte perder.
            </p>
          </section>

          <section>
            <h2>Senales de riesgo</h2>
            <p>
              Detente y busca ayuda si el juego afecta a tu descanso, estudios, trabajo,
              relaciones, economia o estado de animo, o si sientes que pierdes el control.
            </p>
          </section>

          <section>
            <h2>Recursos oficiales</h2>
            <p>
              Puedes consultar informacion de juego seguro y proteccion de participantes en
              la Direccion General de Ordenacion del Juego.
            </p>
            <a className="btn btn--ghost" href="https://www.ordenacionjuego.es/" rel="noreferrer">
              Ir a ordenacionjuego.es
            </a>
          </section>

          <div className="legal-page__actions">
            <Link href="/terminos" className="btn btn--primary">
              Ver terminos
            </Link>
            <Link href="/feed" className="btn btn--ghost">
              Volver al feed
            </Link>
          </div>
        </div>
      </main>
    </TodosGanamosShell>
  );
}
