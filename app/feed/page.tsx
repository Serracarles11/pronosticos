import Link from "next/link";
import { PulsoShell } from "../components/pulso-shell";
import { createClient } from "@/lib/supabase/server";
import { LikeButton } from "../components/like-button";

const DEPORTES = ["Futbol", "Tenis", "NBA", "eSports", "Combinadas", "Otros"];

const COLORS = ["blue", "navy", "sky", "steel", "slate", "teal", "indigo", "purple"] as const;
function avatarColor(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Hace unos minutos";
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.floor(h / 24)} dias`;
}

function EstadoPill({ estado }: { estado: string }) {
  if (estado === "acertada")
    return <span className="pill pill--ok"><span className="pill__dot" />Acertada</span>;
  if (estado === "fallada")
    return <span className="pill pill--bad"><span className="pill__dot" />Fallada</span>;
  return <span className="pill pill--warn"><span className="pill__dot" />Pendiente</span>;
}

function Confidence({ value }: { value: number }) {
  return (
    <div className="pred__confidence">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} className={s <= value ? "is-on" : ""} />
      ))}
    </div>
  );
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; deporte?: string }>;
}) {
  const { sort, deporte } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("pronosticos")
    .select(`
      id, evento, mercado, cuota, confianza, explicacion,
      estado, competicion, deporte, created_at, user_id,
      profiles ( username, display_name ),
      likes ( count ),
      comentarios ( count )
    `)
    .eq("visibilidad", "publico");

  if (deporte && deporte !== "todos") {
    query = query.ilike("deporte", deporte);
  }

  if (sort === "votadas") {
    query = query.order("likes", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.limit(20);

  const { data: pronosticos } = await query;

  type FeedItem = Record<string, unknown> & { id: string; likes_count: number; comentarios_count: number };
  const items: FeedItem[] = (pronosticos ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    likes_count: (p.likes as Array<{ count: number }>)?.[0]?.count ?? 0,
    comentarios_count: (p.comentarios as Array<{ count: number }>)?.[0]?.count ?? 0,
  })) as FeedItem[];

  // Get which ones the current user has liked
  const userLikedIds = new Set<string>();
  if (user && items.length > 0) {
    const ids = items.map((i) => i.id as string);
    const { data: userLikes } = await supabase
      .from("likes")
      .select("pronostico_id")
      .eq("user_id", user.id)
      .in("pronostico_id", ids);
    for (const l of userLikes ?? []) {
      userLikedIds.add(l.pronostico_id);
    }
  }

  const activeSort = sort ?? "recientes";
  const activeDeporte = deporte ?? "todos";

  function sortLink(s: string) {
    const params = new URLSearchParams();
    if (s !== "recientes") params.set("sort", s);
    if (activeDeporte !== "todos") params.set("deporte", activeDeporte);
    const qs = params.toString();
    return `/feed${qs ? `?${qs}` : ""}`;
  }

  function deporteLink(d: string) {
    const params = new URLSearchParams();
    if (activeSort !== "recientes") params.set("sort", activeSort);
    if (d !== "todos") params.set("deporte", d);
    const qs = params.toString();
    return `/feed${qs ? `?${qs}` : ""}`;
  }

  return (
    <PulsoShell active="feed">
      <main className="feed">
        <div className="feed__inner">
          <aside className="feed__side feed__side--left hide-mobile">
            <div className="side-section">
              <h4 className="side-section__title">Deportes</h4>
              <nav className="side-list">
                <Link
                  className={`side-link ${activeDeporte === "todos" ? "is-active" : ""}`}
                  href={deporteLink("todos")}
                >
                  Todos
                </Link>
                {DEPORTES.map((d) => (
                  <Link
                    key={d}
                    className={`side-link ${activeDeporte.toLowerCase() === d.toLowerCase() ? "is-active" : ""}`}
                    href={deporteLink(d)}
                  >
                    {d}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="side-section">
              <h4 className="side-section__title">Tu actividad</h4>
              <nav className="side-list">
                <Link className="side-link" href="/perfil">Mi perfil</Link>
                <Link className="side-link" href="/nuevo">Nuevo pronostico</Link>
              </nav>
            </div>
          </aside>

          <section className="feed__main">
            <header className="feed__header">
              <h1>Pronosticos</h1>
              <p>
                {items.length} pronosticos
                {activeDeporte !== "todos" ? ` de ${activeDeporte}` : " en la comunidad"}
              </p>
            </header>

            <div className="feed__filters">
              <div className="cluster">
                <Link
                  className={`chip ${activeSort === "recientes" ? "is-active" : ""}`}
                  href={sortLink("recientes")}
                >
                  Recientes
                </Link>
                <Link
                  className={`chip ${activeSort === "votadas" ? "is-active" : ""}`}
                  href={sortLink("votadas")}
                >
                  Mas votadas
                </Link>
              </div>
              <Link href="/nuevo" className="btn btn--primary">
                + Publicar
              </Link>
            </div>

            {items.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: "center" }}>
                <p style={{ marginBottom: 16 }}>
                  {activeDeporte !== "todos"
                    ? `No hay pronosticos de ${activeDeporte} todavia.`
                    : "Aun no hay pronosticos publicados."}
                </p>
                <Link href="/nuevo" className="btn btn--primary">
                  Publica el primero
                </Link>
              </div>
            ) : (
              items.map((item, i) => {
                const username =
                  (item.profiles as { username: string } | null)?.username ?? "usuario";
                const color = avatarColor(username);
                const initials = username.slice(0, 2).toUpperCase();
                const isLiked = userLikedIds.has(item.id as string);

                return (
                  <article
                    key={item.id as string}
                    className={`card pred ${i === 0 ? "card--featured" : ""}`}
                  >
                    <header className="pred__head">
                      <div className="pred__author">
                        <Link
                          href={`/perfil?user=${username}`}
                          className={`avatar avatar--md avatar--${color}`}
                        >
                          {initials}
                        </Link>
                        <div className="pred__author-meta">
                          <span className="pred__user">
                            <Link href={`/perfil?user=${username}`}>{username}</Link>
                          </span>
                          <span className="pred__sub">
                            {timeAgo(item.created_at as string)}
                            {item.competicion ? ` · ${item.competicion as string}` : ""}
                          </span>
                        </div>
                      </div>
                      <EstadoPill estado={item.estado as string} />
                    </header>
                    <div>
                      <h3 className="pred__title">
                        <Link href={`/detalle?id=${item.id as string}`}>
                          {item.evento as string}
                        </Link>
                      </h3>
                    </div>
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
                        <div className="pred__cell-label">Confianza</div>
                        <Confidence value={Number(item.confianza)} />
                      </div>
                    </div>
                    {item.explicacion != null && (
                      <p className="pred__body">
                        {String(item.explicacion).slice(0, 120)}
                        {String(item.explicacion).length > 120 ? "..." : ""}
                      </p>
                    )}
                    <footer className="pred__foot">
                      <div className="pred__actions">
                        {user ? (
                          <LikeButton
                            pronosticoId={item.id as string}
                            initialCount={item.likes_count as number}
                            initialLiked={isLiked}
                          />
                        ) : (
                          <Link href="/auth">♥ {item.likes_count as number}</Link>
                        )}
                        <Link href={`/detalle?id=${item.id as string}#comentarios`}>
                          💬 {item.comentarios_count as number}
                        </Link>
                        <Link href={`/detalle?id=${item.id as string}`} className="muted">
                          Ver →
                        </Link>
                      </div>
                    </footer>
                  </article>
                );
              })
            )}
          </section>

          <aside className="feed__side feed__side--right hide-mobile">
            <div className="side-section">
              <h4 className="side-section__title">Tendencias</h4>
              <ul className="trends">
                {DEPORTES.slice(0, 4).map((d) => (
                  <li key={d}>
                    <Link
                      className="mono trend__tag"
                      href={deporteLink(d)}
                    >
                      #{d}
                    </Link>
                    <span className="trend__sub">Ver pronosticos</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="side-section">
              <Link href="/nuevo" className="btn btn--primary btn--flex">
                + Publicar pronostico
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </PulsoShell>
  );
}
