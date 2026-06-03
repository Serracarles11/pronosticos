import Link from "next/link";
import { TodosGanamosShell } from "../components/todosganamos-shell";

export default function PrivacidadPage() {
  return (
    <TodosGanamosShell active="landing">
      <main className="legal-page">
        <div className="container legal-page__inner">
          <p className="legal-page__eyebrow">Proteccion de datos</p>
          <h1>Politica de privacidad</h1>
          <p>
            Esta politica resume como TodosGanamos trata los datos necesarios para crear cuenta,
            publicar pronosticos y mantener la seguridad de la comunidad.
          </p>

          <section>
            <h2>Responsable</h2>
            <p>
              Completa antes de produccion los datos del responsable del tratamiento:
              titular, NIF/CIF si aplica, domicilio y email de contacto para privacidad.
            </p>
          </section>

          <section>
            <h2>Datos tratados</h2>
            <p>
              Podemos tratar email, nombre de usuario, nombre publico, biografia, contenido
              publicado, seguidores, comentarios, guardados, likes, datos tecnicos de sesion
              y registros necesarios para seguridad.
            </p>
          </section>

          <section>
            <h2>Finalidades</h2>
            <p>
              Usamos los datos para gestionar cuentas, autenticar usuarios, mostrar perfiles
              y pronosticos, aplicar privacidad de perfiles, prevenir abusos y mantener el
              servicio.
            </p>
          </section>

          <section>
            <h2>Base juridica</h2>
            <p>
              El tratamiento se apoya en la ejecucion de los terminos de uso, el interes
              legitimo en proteger la comunidad y, cuando corresponda, el consentimiento del
              usuario.
            </p>
          </section>

          <section>
            <h2>Derechos</h2>
            <p>
              Puedes solicitar acceso, rectificacion, supresion, oposicion, limitacion y
              portabilidad de tus datos. Tambien puedes reclamar ante la Agencia Espanola de
              Proteccion de Datos.
            </p>
          </section>

          <section>
            <h2>Conservacion y proveedores</h2>
            <p>
              Los datos se conservan mientras la cuenta este activa o mientras exista una
              obligacion legal. La autenticacion, base de datos y almacenamiento se apoyan en
              Supabase como proveedor tecnico.
            </p>
          </section>

          <div className="legal-page__actions">
            <Link href="/cookies" className="btn btn--primary">
              Ver cookies
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
