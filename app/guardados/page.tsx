import Link from "next/link";
import { redirect } from "next/navigation";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { createClient } from "@/lib/supabase/server";
import { SaveButton } from "../components/save-button";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Hace unos minutos";
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.floor(h / 24)} dias`;
}

function estadoClass(estado: string) {
  if (estado === "acertada") return "pill pill--ok";
  if (estado === "fallada") return "pill pill--bad";
  return "pill pill--warn";
}

export default async function GuardadosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/guardados");

  const { data: guardados } = await supabase
    .from("guardados")
    .select(`
      created_at,
      pronosticos (
        id, evento, mercado, cuota, confianza, estado, competicion, deporte, created_at,
        profiles!pronosticos_user_id_fkey ( username )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const items = (guardados ?? [])
    .flatMap((item) => {
      const pronosticos = item.pronosticos as unknown;
      if (!pronosticos) return [];
      return Array.isArray(pronosticos) ? pronosticos : [pronosticos];
    }) as Array<Record<string, unknown>>;

  return (
    <TodosGanamosShell active="guardados">
      <main className="container saved-page">
        <header className="saved-page__header">
          <div>
            <span className="badge">Biblioteca personal</span>
            <h1>Pronosticos guardados</h1>
            <p>Ten a mano cuotas que quieres seguir, revisar o comentar mas tarde.</p>
          </div>
          <Link className="btn btn--primary" href="/feed">
            Explorar feed
          </Link>
        </header>

        {items.length === 0 ? (
          <section className="card empty-state">
            <h2>Aun no has guardado nada</h2>
            <p>Guarda pronosticos desde el feed o desde el detalle para crear tu lista.</p>
            <Link className="btn btn--primary" href="/feed">
              Ver pronosticos
            </Link>
          </section>
        ) : (
          <section className="saved-grid">
            {items.map((item) => {
              const profile = item.profiles as { username: string } | Array<{ username: string }> | null;
              const author = Array.isArray(profile) ? profile[0]?.username : profile?.username;
              return (
                <article className="card pred saved-card" key={item.id as string}>
                  <header className="pred__head">
                    <div>
                      <span className="pred__sub">
                        {author ? `@${author}` : "usuario"}
                        {item.competicion ? ` - ${item.competicion as string}` : ""}
                      </span>
                      <h3 className="pred__title">
                        <Link href={`/detalle?id=${item.id as string}`}>{item.evento as string}</Link>
                      </h3>
                    </div>
                    <span className={estadoClass(item.estado as string)}>
                      <span className="pill__dot" />
                      {item.estado === "acertada"
                        ? "Acertada"
                        : item.estado === "fallada"
                        ? "Fallada"
                        : "Pendiente"}
                    </span>
                  </header>
                  <div className="pred__strip">
                    <div className="pred__cell">
                      <div className="pred__cell-label">Pronostico</div>
                      <div className="pred__cell-value">{item.mercado as string}</div>
                    </div>
                    <div className="pred__cell pred__cell--accent">
                      <div className="pred__cell-label">Cuota</div>
                      <div className="pred__cell-value mono">
                        {Number(item.cuota).toFixed(2)}
                      </div>
                    </div>
                    <div className="pred__cell">
                      <div className="pred__cell-label">Publicado</div>
                      <div className="pred__cell-value">{timeAgo(item.created_at as string)}</div>
                    </div>
                  </div>
                  <footer className="pred__foot">
                    <div className="pred__actions">
                      <SaveButton pronosticoId={item.id as string} initialSaved />
                      <Link href={`/detalle?id=${item.id as string}`} className="muted">
                        Ver detalle
                      </Link>
                    </div>
                  </footer>
                </article>
              );
            })}
          </section>
        )}
      </main>
    </TodosGanamosShell>
  );
}
