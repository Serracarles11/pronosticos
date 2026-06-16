import Link from "next/link";
import { redirect } from "next/navigation";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { createClient } from "@/lib/supabase/server";
import { FollowButton } from "../components/follow-button";
import { upcomingPronosticoFilter } from "@/lib/upcoming-content";

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

function canSettlePronostico(fechaEvento: string | null, estado: string) {
  if (!fechaEvento || estado !== "pendiente") return false;
  return Date.now() >= new Date(fechaEvento).getTime() + 24 * 60 * 60 * 1000;
}

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; user?: string }>;
}) {
  const { tab, user: userParam } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) redirect("/auth?next=/perfil");

  // Determine whose profile to show
  let profileData = null;
  let isOwnProfile = false;

  if (userParam) {
    // Viewing someone else's profile
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", userParam)
      .single();
    profileData = data;
    isOwnProfile = authUser?.id === profileData?.id;
  } else {
    // Own profile - require login
    if (!authUser) {
      redirect("/auth");
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();
    profileData = data;
    isOwnProfile = true;
  }

  if (!profileData) {
    return (
      <TodosGanamosShell active="perfil">
        <main className="container" style={{ padding: "64px 0", textAlign: "center" }}>
          <h2>Usuario no encontrado</h2>
          <Link href="/feed" className="btn btn--primary" style={{ marginTop: 16 }}>
            Volver al feed
          </Link>
        </main>
      </TodosGanamosShell>
    );
  }

  const username = profileData.username;
  const displayName = profileData.display_name ?? username;
  const color = avatarColor(username);
  const initials = username.slice(0, 2).toUpperCase();
  let isFollowing = false;
  let hasRequested = false;

  if (authUser && !isOwnProfile) {
    const [followingRes, requestRes] = await Promise.all([
      supabase
        .from("seguimientos")
        .select("follower_id")
        .eq("follower_id", authUser.id)
        .eq("following_id", profileData.id)
        .maybeSingle(),
      supabase
        .from("seguimiento_solicitudes")
        .select("follower_id")
        .eq("follower_id", authUser.id)
        .eq("following_id", profileData.id)
        .maybeSingle(),
    ]);
    isFollowing = !!followingRes.data;
    hasRequested = !!requestRes.data;
  }

  let pronosticosQuery = supabase
    .from("pronosticos")
    .select("id, evento, mercado, cuota, estado, competicion, created_at, visibilidad, fecha_evento")
    .eq("user_id", profileData.id)
    .or(upcomingPronosticoFilter());

  if (!isOwnProfile) {
    pronosticosQuery = pronosticosQuery.neq("visibilidad", "borrador");
  }

  const { data: pronosticos } = await pronosticosQuery
    .order("created_at", { ascending: false })
    .limit(50);

  const visibleProns = pronosticos ?? [];

  const total = visibleProns.length;
  const acertadas = visibleProns.filter((p) => p.estado === "acertada").length;
  const falladas = visibleProns.filter((p) => p.estado === "fallada").length;
  const pendientes = total - acertadas - falladas;
  const acierto = total > 0 ? Math.round((acertadas / total) * 100) : 0;

  const activeTab = tab ?? "todas";
  const filtered =
    activeTab === "acertadas"
      ? visibleProns.filter((p) => p.estado === "acertada")
      : activeTab === "falladas"
      ? visibleProns.filter((p) => p.estado === "fallada")
      : activeTab === "pendientes"
      ? visibleProns.filter((p) => p.estado === "pendiente")
      : visibleProns;

  function tabLink(t: string) {
    const params = new URLSearchParams();
    if (t !== "todas") params.set("tab", t);
    if (userParam) params.set("user", userParam);
    const qs = params.toString();
    return `/perfil${qs ? `?${qs}` : ""}`;
  }

  return (
    <TodosGanamosShell active="perfil">
      <main className="profile">
        <section className="profile__hero">
          <div className="container">
            <div className="profile__head">
              <span className={`avatar avatar--xl avatar--${color}`}>{initials}</span>
              <div className="profile__head-body">
                <div className="profile__name-row">
                  <h1>{displayName}</h1>
                  {acertadas >= 10 && (
                    <span className="badge badge--gold">Tipster activo</span>
                  )}
                  {authUser && !isOwnProfile && (
                    <FollowButton
                      targetUserId={profileData.id}
                      initialFollowing={isFollowing}
                      initialRequested={hasRequested}
                    />
                  )}
                </div>
                <div className="profile__handle">
                  @{username} - {profileData.is_private ? "Cuenta privada" : "Miembro de TodosGanamos"}
                </div>
                {profileData.bio && (
                  <p className="profile__bio">{profileData.bio}</p>
                )}
                {profileData.is_private && !isOwnProfile && !isFollowing && (
                  <p className="profile__bio">
                    Envia una solicitud para ver los pronosticos marcados como solo seguidores.
                  </p>
                )}
              </div>
            </div>

            <div className="profile__stats">
              <div className="stat">
                <div className="stat__label">Pronosticos</div>
                <div className="stat__value">{total}</div>
              </div>
              <div className={`stat ${acierto >= 60 ? "stat--ok" : ""}`}>
                <div className="stat__label">Acierto</div>
                <div className="stat__value">{acierto}%</div>
              </div>
              <div className="stat stat--ok">
                <div className="stat__label">Acertadas</div>
                <div className="stat__value">{acertadas}</div>
              </div>
              <div className="stat">
                <div className="stat__label">Falladas</div>
                <div className="stat__value">{falladas}</div>
              </div>
              <div className="stat">
                <div className="stat__label">Pendientes</div>
                <div className="stat__value">{pendientes}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="container profile__body">
          <div className="profile__tabs">
            <Link href={tabLink("todas")} className={`tab ${activeTab === "todas" ? "is-active" : ""}`}>
              Todas <span className="tab__count">{total}</span>
            </Link>
            <Link href={tabLink("acertadas")} className={`tab ${activeTab === "acertadas" ? "is-active" : ""}`}>
              Acertadas <span className="tab__count">{acertadas}</span>
            </Link>
            <Link href={tabLink("falladas")} className={`tab ${activeTab === "falladas" ? "is-active" : ""}`}>
              Falladas <span className="tab__count">{falladas}</span>
            </Link>
            <Link href={tabLink("pendientes")} className={`tab ${activeTab === "pendientes" ? "is-active" : ""}`}>
              Pendientes <span className="tab__count">{pendientes}</span>
            </Link>
          </div>

          <div className="profile__grid">
            <div className="profile__list">
              {filtered.length === 0 ? (
                <div className="card" style={{ padding: 24, textAlign: "center" }}>
                  {isOwnProfile ? (
                    <>
                      <p style={{ marginBottom: 16 }}>
                        {activeTab === "todas"
                          ? "Todavia no has publicado ningun pronostico."
                          : `No tienes pronosticos ${activeTab}.`}
                      </p>
                      {activeTab === "todas" && (
                        <Link href="/nuevo" className="btn btn--primary">
                          Publicar mi primero
                        </Link>
                      )}
                    </>
                  ) : (
                    <p>No hay pronosticos {activeTab !== "todas" ? activeTab : ""} para mostrar.</p>
                  )}
                </div>
              ) : (
                filtered.map((p) => (
                  <Link
                    href={`/detalle?id=${p.id}`}
                    className="card profile__row"
                    key={p.id}
                    style={{ textDecoration: "none", display: "block" }}
                  >
                    <div className="profile__row-body">
                      <h3>
                        {p.evento} · {p.mercado}
                      </h3>
                      <span className="profile__row-meta">
                        {p.competicion ?? ""}
                        {p.competicion ? " · " : ""}
                        {timeAgo(p.created_at)}
                        {isOwnProfile && p.visibilidad !== "publico" && (
                          <span className="badge" style={{ marginLeft: 6 }}>
                            {p.visibilidad === "borrador" ? "Borrador" : "Solo seguidores"}
                          </span>
                        )}
                        {isOwnProfile && canSettlePronostico(p.fecha_evento, p.estado) && (
                          <span className="badge badge--purple" style={{ marginLeft: 6 }}>
                            Pendiente de cierre
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="profile__row-stats">
                      {isOwnProfile && canSettlePronostico(p.fecha_evento, p.estado) && (
                        <span className="btn btn--soft">Cerrar</span>
                      )}
                      <span className="mono profile__cuota">
                        {Number(p.cuota).toFixed(2)}
                      </span>
                      <span
                        className={
                          p.estado === "acertada"
                            ? "pill pill--ok"
                            : p.estado === "fallada"
                            ? "pill pill--bad"
                            : "pill pill--warn"
                        }
                      >
                        <span className="pill__dot" />
                        {p.estado.charAt(0).toUpperCase() + p.estado.slice(1)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <aside className="card card__pad">
              <div className="profile__chart-head">
                <strong>Rendimiento</strong>
                {acierto > 0 && (
                  <span
                    className={`mono profile__trend ${
                      acierto >= 60 ? "stat-positive" : "stat-negative"
                    }`}
                  >
                    {acierto}% acierto
                  </span>
                )}
              </div>

              <div className="profile__by-sport">
                <h4 className="side-section__title">Estadisticas globales</h4>
                <div className="bar">
                  <span>Total</span>
                  <div className="bar__track">
                    <div className="bar__fill" style={{ width: "100%" }} />
                  </div>
                  <span className="mono">{total}</span>
                </div>
                <div className="bar">
                  <span>Acertadas</span>
                  <div className="bar__track">
                    <div className="bar__fill" style={{ width: `${acierto}%` }} />
                  </div>
                  <span className="mono">{acertadas}</span>
                </div>
                <div className="bar">
                  <span>Falladas</span>
                  <div className="bar__track">
                    <div
                      className="bar__fill bar__fill--light"
                      style={{
                        width:
                          total > 0
                            ? `${Math.round((falladas / total) * 100)}%`
                            : "0%",
                      }}
                    />
                  </div>
                  <span className="mono">{falladas}</span>
                </div>
              </div>

              {isOwnProfile && (
                <Link
                  href="/nuevo"
                  className="btn btn--primary btn--flex"
                  style={{ marginTop: 16 }}
                >
                  + Nuevo pronostico
                </Link>
              )}
            </aside>
          </div>
        </section>
      </main>
    </TodosGanamosShell>
  );
}
