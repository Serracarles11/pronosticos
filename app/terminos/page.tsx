import Link from "next/link";
import { TodosGanamosShell } from "../components/todosganamos-shell";

export default function TerminosPage() {
  return (
    <TodosGanamosShell active="landing">
      <main className="legal-page">
        <div className="container legal-page__inner">
          <p className="legal-page__eyebrow">Informacion legal</p>
          <h1>Terminos y condiciones</h1>
          <p>
            TodosGanamos es una comunidad de pronosticos deportivos, debate y estadisticas. La
            plataforma no permite apostar dinero real, no gestiona saldos, no acepta
            depositos y no paga premios.
          </p>

          <section>
            <h2>Acceso solo para mayores de edad</h2>
            <p>
              El uso de TodosGanamos esta reservado a personas mayores de 18 anos. Si eres menor
              de edad, no debes registrarte ni acceder al contenido.
            </p>
          </section>

          <section>
            <h2>Uso permitido</h2>
            <p>
              Puedes publicar pronosticos, comentar y seguir a otros usuarios siempre que
              respetes la ley, a otros usuarios y las normas de la comunidad. No esta
              permitido publicar contenido fraudulento, acosador, discriminatorio, ilegal o
              que incentive conductas de juego problematico.
            </p>
          </section>

          <section>
            <h2>Sin asesoramiento ni garantia</h2>
            <p>
              Los pronosticos publicados por usuarios son opiniones. TodosGanamos no garantiza
              resultados deportivos, beneficios economicos ni la exactitud de la informacion
              compartida por la comunidad.
            </p>
          </section>

          <section>
            <h2>Contenido de usuarios</h2>
            <p>
              Cada usuario es responsable del contenido que publica. TodosGanamos puede moderar,
              ocultar o eliminar contenido que incumpla estos terminos o ponga en riesgo a
              otros usuarios.
            </p>
          </section>

          <section>
            <h2>Titularidad y contacto</h2>
            <p>
              Antes de publicar esta pagina en produccion, completa los datos del titular:
              nombre o razon social, NIF/CIF si aplica, domicilio, correo de contacto y
              cualquier otro dato exigible.
            </p>
          </section>

          <div className="legal-page__actions">
            <Link href="/privacidad" className="btn btn--primary">
              Ver privacidad
            </Link>
            <Link href="/juego-seguro" className="btn btn--ghost">
              Juego seguro
            </Link>
          </div>
        </div>
      </main>
    </TodosGanamosShell>
  );
}
