import Link from "next/link";
import { redirect } from "next/navigation";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { createClient } from "@/lib/supabase/server";
import { LikeButton } from "../components/like-button";
import { FollowButton } from "../components/follow-button";
import { SaveButton } from "../components/save-button";
import { getMutedUserIds, isMissingOptionalSchema } from "@/lib/anti-spam/server";
import { filterVisibleItemsForModeration } from "@/lib/anti-spam/pure";

const DEPORTES = ["Futbol", "Tenis", "NBA", "eSports", "Combinadas", "Otros"];
const CATEGORIAS = [
  ["quiniela", "Quiniela"],
  ["cuota-alta", "Cuota alta"],
] as const;

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

function cleanSearchTerm(value?: string) {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function cleanPostgrestSearch(value: string) {
  return value.replace(/[,%(){}]/g, " ").trim();
}

function extractExactOdds(value: string) {
  const match = value.match(/^(?:cuota\s*)?(\d+(?:[.,]\d{1,2})?)$/i);
  if (!match) return null;

  const odds = Number(match[1].replace(",", "."));
  return odds >= 1.01 ? odds : null;
}

function madridMidnightIso(date: Date) {
  const offset =
    new Intl.DateTimeFormat("en", {
      timeZone: "Europe/Madrid",
      timeZoneName: "longOffset",
    })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")
      ?.value.replace("GMT", "") ?? "+00:00";

  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00${offset}`).toISOString();
}

function currentMadridWeekRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const start = new Date(Date.UTC(value("year"), value("month") - 1, value("day"), 12));
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);

  return { start: madridMidnightIso(start), end: madridMidnightIso(end) };
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    deporte?: string;
    q?: string;
    filtro?: string;
    estado?: string;
    confianza?: string;
    cuota?: string;
    periodo?: string;
    categoria?: string;
  }>;
}) {
  const { sort, deporte, q, filtro, estado, confianza, cuota, periodo, categoria } =
    await searchParams;
  const searchTerm = cleanSearchTerm(q);
  const searchFilter = cleanPostgrestSearch(searchTerm);
  const exactOdds = extractExactOdds(searchTerm);
  const activeEstado = ["pendiente", "acertada", "fallada"].includes(estado ?? "")
    ? String(estado)
    : "todos";
  const activeConfianza = confianza === "alta" ? "alta" : "todas";
  const activeCuota = cuota === "2" ? "2" : "todas";
  const activePeriodo = periodo === "semana" ? "semana" : "proximas";
  const activeCategoria = CATEGORIAS.some(([value]) => value === categoria)
    ? String(categoria)
    : "todas";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth?next=/feed");

  const activeFilter = filtro === "siguiendo" ? "siguiendo" : "todos";
  let followedUserIds: string[] = [];
  let requestedUserIds: string[] = [];
  let blockedUserIds: string[] = [];
  if (user) {
    const [{ data: follows }, { data: requests }, { data: blocks }] = await Promise.all([
      supabase
        .from("seguimientos")
        .select("following_id")
        .eq("follower_id", user.id),
      supabase
        .from("seguimiento_solicitudes")
        .select("following_id")
        .eq("follower_id", user.id),
      supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id),
    ]);
    followedUserIds = (follows ?? []).map((follow) => follow.following_id);
    requestedUserIds = (requests ?? []).map((request) => request.following_id);
    blockedUserIds = (blocks ?? []).map((block) => block.blocked_id);
  }

  let query = supabase
    .from("pronosticos")
    .select(`
      id, evento, mercado, cuota, confianza, explicacion,
      estado, competicion, deporte, fecha_evento, created_at, user_id, visibilidad,
      profiles!pronosticos_user_id_fkey ( username, display_name, is_private ),
      likes ( count ),
      comentarios ( count )
    `)
    .neq("visibilidad", "borrador");

  if (activeFilter === "siguiendo") {
    if (user && followedUserIds.length > 0) {
      query = query.in("user_id", followedUserIds);
    } else {
      query = query.eq("user_id", "00000000-0000-0000-0000-000000000000");
    }
  } else if (user) {
    const visibilityRules = ["visibilidad.eq.publico", `user_id.eq.${user.id}`];
    if (followedUserIds.length > 0) {
      visibilityRules.push(
        `and(visibilidad.eq.seguidores,user_id.in.(${followedUserIds.join(",")}))`
      );
    }
    query = query.or(visibilityRules.join(","));
  } else {
    query = query.eq("visibilidad", "publico");
  }

  if (blockedUserIds.length > 0) {
    query = query.not("user_id", "in", `(${blockedUserIds.join(",")})`);
  }

  if (activePeriodo === "semana") {
    const week = currentMadridWeekRange();
    query = query.gte("fecha_evento", week.start).lt("fecha_evento", week.end);
  } else {
    query = query.gte("fecha_evento", new Date().toISOString());
  }

  type SearchProfile = {
    id: string;
    username: string;
    display_name: string | null;
    bio: string | null;
    is_private: boolean;
  };
  let matchedProfiles: SearchProfile[] = [];
  if (searchFilter) {
    const pattern = `%${searchFilter}%`;
    const profilePattern = `%${searchFilter.replace(/^@/, "")}%`;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, bio, is_private")
      .or(`username.ilike.${profilePattern},display_name.ilike.${profilePattern}`)
      .limit(8);
    matchedProfiles = (data ?? []) as SearchProfile[];

    const authorFilters =
      matchedProfiles.length > 0
        ? [`user_id.in.(${matchedProfiles.map((profile) => profile.id).join(",")})`]
        : [];
    const oddsFilters = exactOdds === null ? [] : [`cuota.eq.${exactOdds}`];

    query = query.or(
      [
        `evento.ilike.${pattern}`,
        `mercado.ilike.${pattern}`,
        `explicacion.ilike.${pattern}`,
        `competicion.ilike.${pattern}`,
        `deporte.ilike.${pattern}`,
        ...oddsFilters,
        ...authorFilters,
      ].join(",")
    );
  }

  if (deporte && deporte !== "todos") {
    query = query.ilike("deporte", deporte);
  }

  if (activeEstado !== "todos") {
    query = query.eq("estado", activeEstado);
  }

  if (activeConfianza === "alta") {
    query = query.gte("confianza", 4);
  }

  if (activeCuota === "2") {
    query = query.gte("cuota", 2);
  }

  if (activeCategoria === "quiniela") {
    query = query.or(
      "evento.ilike.%quiniela%,mercado.ilike.%quiniela%,competicion.ilike.%quiniela%,explicacion.ilike.%quiniela%"
    );
  } else if (activeCategoria === "cuota-alta") {
    query = query.gte("cuota", 3);
  }

  if (sort === "votadas") {
    query = query.order("likes", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  query = query.limit(20);

  const { data: pronosticos } = await query;

  type FeedItem = Record<string, unknown> & {
    id: string;
    user_id?: string | null;
    moderation_status?: "approved" | "pending_review" | "rejected" | "hidden" | null;
    is_shadowbanned?: boolean | null;
    likes_count: number;
    comentarios_count: number;
  };
  let items: FeedItem[] = (pronosticos ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    likes_count: (p.likes as Array<{ count: number }>)?.[0]?.count ?? 0,
    comentarios_count: (p.comentarios as Array<{ count: number }>)?.[0]?.count ?? 0,
  })) as FeedItem[];

  const mutedUserIds = await getMutedUserIds(supabase, user?.id);
  let isAdmin = false;
  if (user) {
    const { data: currentProfile, error: currentProfileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (!isMissingOptionalSchema(currentProfileError)) {
      isAdmin = currentProfile?.role === "admin";
    }
  }

  if (items.length > 0) {
    const { data: moderationRows, error: moderationError } = await supabase
      .from("pronosticos")
      .select("id, user_id, moderation_status, profiles!pronosticos_user_id_fkey(is_shadowbanned)")
      .in("id", items.map((item) => item.id));

    if (!isMissingOptionalSchema(moderationError) && !moderationError) {
      const moderationById = new Map(
        (moderationRows ?? []).map((row: Record<string, unknown>) => {
          const profile = row.profiles as { is_shadowbanned?: boolean } | null;
          return [
            row.id as string,
            {
              moderation_status: row.moderation_status as FeedItem["moderation_status"],
              is_shadowbanned: !!profile?.is_shadowbanned,
            },
          ];
        })
      );
      items = items.map((item) => ({ ...item, ...(moderationById.get(item.id) ?? {}) }));
    }

    items = filterVisibleItemsForModeration(
      items,
      user?.id ?? null,
      mutedUserIds,
      isAdmin
    ) as FeedItem[];
  }

  // Get which ones the current user has liked
  const userLikedIds = new Set<string>();
  const userSavedIds = new Set<string>();
  if (user && items.length > 0) {
    const ids = items.map((i) => i.id as string);
    const [{ data: userLikes }, { data: userSaved }] = await Promise.all([
      supabase
        .from("likes")
        .select("pronostico_id")
        .eq("user_id", user.id)
        .in("pronostico_id", ids),
      supabase
        .from("guardados")
        .select("pronostico_id")
        .eq("user_id", user.id)
        .in("pronostico_id", ids),
    ]);
    for (const l of userLikes ?? []) {
      userLikedIds.add(l.pronostico_id);
    }
    for (const saved of userSaved ?? []) {
      userSavedIds.add(saved.pronostico_id);
    }
  }

  const followedUserIdSet = new Set(followedUserIds);
  const requestedUserIdSet = new Set(requestedUserIds);
  const activeSort = sort ?? "recientes";
  const activeDeporte = deporte ?? "todos";

  function feedLink(overrides: {
    sort?: string;
    deporte?: string;
    filtro?: string;
    estado?: string;
    confianza?: string;
    cuota?: string;
    q?: string;
    periodo?: string;
    categoria?: string;
  }) {
    const params = new URLSearchParams();
    const nextSort = overrides.sort ?? activeSort;
    const nextDeporte = overrides.deporte ?? activeDeporte;
    const nextFiltro = overrides.filtro ?? activeFilter;
    const nextEstado = overrides.estado ?? activeEstado;
    const nextConfianza = overrides.confianza ?? activeConfianza;
    const nextCuota = overrides.cuota ?? activeCuota;
    const nextSearch = overrides.q ?? searchTerm;
    const nextPeriodo = overrides.periodo ?? activePeriodo;
    const nextCategoria = overrides.categoria ?? activeCategoria;

    if (nextSort !== "recientes") params.set("sort", nextSort);
    if (nextDeporte !== "todos") params.set("deporte", nextDeporte);
    if (nextSearch) params.set("q", nextSearch);
    if (nextFiltro !== "todos") params.set("filtro", nextFiltro);
    if (nextEstado !== "todos") params.set("estado", nextEstado);
    if (nextConfianza !== "todas") params.set("confianza", nextConfianza);
    if (nextCuota !== "todas") params.set("cuota", nextCuota);
    if (nextPeriodo !== "proximas") params.set("periodo", nextPeriodo);
    if (nextCategoria !== "todas") params.set("categoria", nextCategoria);
    const qs = params.toString();
    return `/feed${qs ? `?${qs}` : ""}`;
  }

  function sortLink(s: string) {
    return feedLink({ sort: s });
  }

  function deporteLink(d: string) {
    return feedLink({ deporte: d });
  }

  function filtroLink(f: string) {
    return feedLink({ filtro: f });
  }

  function categoriaLink(c: string) {
    return feedLink({ categoria: c });
  }

  return (
    <TodosGanamosShell active="feed" searchValue={searchTerm} hideFooter>
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
              <h4 className="side-section__title">Categorias</h4>
              <nav className="side-list">
                <Link
                  className={`side-link ${activeCategoria === "todas" ? "is-active" : ""}`}
                  href={categoriaLink("todas")}
                >
                  Todas
                </Link>
                {CATEGORIAS.map(([value, label]) => (
                  <Link
                    key={value}
                    className={`side-link ${activeCategoria === value ? "is-active" : ""}`}
                    href={categoriaLink(value)}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="side-section">
              <h4 className="side-section__title">Tu actividad</h4>
              <nav className="side-list">
                <Link
                  className={`side-link ${activeFilter === "siguiendo" ? "is-active" : ""}`}
                  href={filtroLink("siguiendo")}
                >
                  Siguiendo
                </Link>
                <Link className="side-link" href="/perfil">Mi perfil</Link>
                <Link className="side-link" href="/guardados">Guardados</Link>
                <Link className="side-link" href="/nuevo">Nuevo pronostico</Link>
              </nav>
            </div>
          </aside>

          <section className="feed__main">
            <header className="feed__header">
              <h1>Pronosticos</h1>
              <p>
                {items.length} pronosticos
                {searchTerm
                  ? ` encontrados para "${searchTerm}"`
                  : activeDeporte !== "todos"
                  ? ` de ${activeDeporte}`
                  : " en la comunidad"}
              </p>
            </header>

            <div className="feed__filters">
              <div className="cluster">
                <Link
                  className={`chip ${activeFilter === "todos" ? "is-active" : ""}`}
                  href={filtroLink("todos")}
                >
                  Todos
                </Link>
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
                <Link
                  className={`chip ${activeFilter === "siguiendo" ? "is-active" : ""}`}
                  href={filtroLink("siguiendo")}
                >
                  Siguiendo
                </Link>
                <Link
                  className={`chip ${activeEstado === "pendiente" ? "is-active" : ""}`}
                  href={feedLink({ estado: activeEstado === "pendiente" ? "todos" : "pendiente" })}
                >
                  Pendientes
                </Link>
                <Link
                  className={`chip ${activeEstado === "acertada" ? "is-active" : ""}`}
                  href={feedLink({ estado: activeEstado === "acertada" ? "todos" : "acertada" })}
                >
                  Acertadas
                </Link>
                <Link
                  className={`chip ${activeConfianza === "alta" ? "is-active" : ""}`}
                  href={feedLink({ confianza: activeConfianza === "alta" ? "todas" : "alta" })}
                >
                  Confianza alta
                </Link>
                <Link
                  className={`chip ${activeCuota === "2" ? "is-active" : ""}`}
                  href={feedLink({ cuota: activeCuota === "2" ? "todas" : "2" })}
                >
                  Cuota 2+
                </Link>
                {CATEGORIAS.map(([value, label]) => (
                  <Link
                    key={value}
                    className={`chip ${activeCategoria === value ? "is-active" : ""}`}
                    href={categoriaLink(activeCategoria === value ? "todas" : value)}
                  >
                    {label}
                  </Link>
                ))}
                <Link
                  className={`chip ${activePeriodo === "semana" ? "is-active" : ""}`}
                  href={feedLink({ periodo: activePeriodo === "semana" ? "proximas" : "semana" })}
                >
                  {activePeriodo === "semana"
                    ? "Ver solo las proximas"
                    : "Ver todas las de la semana"}
                </Link>
                {searchTerm && (
                  <Link className="chip" href="/feed">
                    Limpiar busqueda
                  </Link>
                )}
              </div>
              <Link href="/nuevo" className="btn btn--primary">
                + Publicar
              </Link>
            </div>

            <div className="feed__scroll">
            {searchTerm && matchedProfiles.length > 0 && (
              <section className="feed-search-users">
                <div className="feed-search-users__head">
                  <strong>Usuarios encontrados</strong>
                  <span>{matchedProfiles.length}</span>
                </div>
                <div className="feed-search-users__list">
                  {matchedProfiles.map((profile) => {
                    const displayName = profile.display_name ?? profile.username;
                    return (
                      <Link
                        className="feed-search-user"
                        href={`/u/${profile.username}`}
                        key={profile.id}
                      >
                        <span className={`avatar avatar--md avatar--${avatarColor(profile.username)}`}>
                          {profile.username.slice(0, 2).toUpperCase()}
                        </span>
                        <span>
                          <strong>{displayName}</strong>
                          <small>
                            @{profile.username}
                            {profile.is_private ? " - Cuenta privada" : ""}
                          </small>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
            {items.length === 0 ? (
              <div className="card" style={{ padding: 32, textAlign: "center" }}>
                <p style={{ marginBottom: 16 }}>
                  {searchTerm
                    ? `No hay pronosticos publicos que coincidan con "${searchTerm}".`
                    : activeFilter === "siguiendo" && !user
                    ? "Inicia sesion para ver solo pronosticos de gente que sigues."
                    : activeFilter === "siguiendo"
                    ? "Aun no hay pronosticos publicos de gente que sigues."
                    : activeDeporte !== "todos"
                    ? `No hay pronosticos de ${activeDeporte} todavia.`
                    : activePeriodo === "semana"
                    ? "No hay pronosticos publicados esta semana."
                    : "No hay pronosticos proximos. Puedes ver todos los de esta semana."}
                </p>
                <Link href="/nuevo" className="btn btn--primary">
                  Publica el primero
                </Link>
              </div>
            ) : (
              items.map((item, i) => {
                const username =
                  (item.profiles as { username: string } | null)?.username ?? "usuario";
                const profile = item.profiles as { username: string; is_private?: boolean } | null;
                const color = avatarColor(username);
                const initials = username.slice(0, 2).toUpperCase();
                const isLiked = userLikedIds.has(item.id as string);
                const isSaved = userSavedIds.has(item.id as string);
                const userId = item.user_id as string;
                const canFollow = !!user && user.id !== userId;

                return (
                  <article
                    key={item.id as string}
                    className={`card pred ${i === 0 ? "card--featured" : ""}`}
                  >
                    <header className="pred__head">
                      <div className="pred__author">
                        <Link
                          href={`/u/${username}`}
                          className={`avatar avatar--md avatar--${color}`}
                        >
                          {initials}
                        </Link>
                        <div className="pred__author-meta">
                          <span className="pred__user">
                            <Link href={`/u/${username}`}>{username}</Link>
                          </span>
                          <span className="pred__sub">
                            {timeAgo(item.created_at as string)}
                            {item.competicion ? ` · ${item.competicion as string}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="pred__head-actions">
                        <EstadoPill estado={item.estado as string} />
                        {item.moderation_status === "pending_review" && user?.id === userId && (
                          <span className="badge badge--warn">Pendiente de revision</span>
                        )}
                        {canFollow && (
                          <FollowButton
                            targetUserId={userId}
                            initialFollowing={followedUserIdSet.has(userId)}
                            initialRequested={requestedUserIdSet.has(userId)}
                          />
                        )}
                      </div>
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
                    {profile?.is_private && !followedUserIdSet.has(userId) && user?.id !== userId && (
                      <span className="badge badge--lock">Cuenta privada</span>
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
                        {user && (
                          <SaveButton
                            pronosticoId={item.id as string}
                            initialSaved={isSaved}
                          />
                        )}
                        <Link href={`/detalle?id=${item.id as string}`} className="muted">
                          Ver →
                        </Link>
                      </div>
                    </footer>
                  </article>
                );
              })
            )}
            </div>
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
    </TodosGanamosShell>
  );
}
