import Link from "next/link";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { createClient } from "@/lib/supabase/server";
import { FollowButton } from "../components/follow-button";
import { isMissingOptionalSchema } from "@/lib/anti-spam/server";
import { filterVisibleItemsForModeration } from "@/lib/anti-spam/pure";

const COLORS = ["blue", "navy", "sky", "steel", "slate", "teal", "indigo", "purple"] as const;
function avatarColor(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

type RankUser = {
  userId: string;
  username: string;
  displayName: string;
  total: number;
  acertadas: number;
  falladas: number;
  acierto: number;
  deporte: string;
};

type RankingPronostico = {
  id: string;
  user_id: string;
  estado: string;
  deporte: string | null;
  profiles: unknown;
  moderation_status?: "approved" | "pending_review" | "rejected" | "hidden" | null;
  is_shadowbanned?: boolean | null;
};

export default async function RankingPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string; deporte?: string }>;
}) {
  const { periodo, deporte } = await searchParams;
  const activePeriodo = periodo ?? "semana";
  const activeDeporte = deporte ?? "todos";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let followedUserIds: string[] = [];
  let requestedUserIds: string[] = [];
  if (user) {
    const [followsRes, requestsRes] = await Promise.all([
      supabase
        .from("seguimientos")
        .select("following_id")
        .eq("follower_id", user.id),
      supabase
        .from("seguimiento_solicitudes")
        .select("following_id")
        .eq("follower_id", user.id),
    ]);
    followedUserIds = (followsRes.data ?? []).map((follow) => follow.following_id);
    requestedUserIds = (requestsRes.data ?? []).map((request) => request.following_id);
  }

  // Date filter
  const now = new Date();
  let desde: string | null = null;
  if (activePeriodo === "semana") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    desde = d.toISOString();
  } else if (activePeriodo === "mes") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    desde = d.toISOString();
  }

  let query = supabase
    .from("pronosticos")
    .select("id, user_id, estado, deporte, profiles!pronosticos_user_id_fkey(id, username, display_name)")
    .eq("visibilidad", "publico")
    .order("created_at", { ascending: false })
    .limit(1000);

  if (desde) query = query.gte("created_at", desde);
  if (activeDeporte !== "todos") query = query.ilike("deporte", activeDeporte);

  const { data: prons } = await query;
  let visibleProns = (prons ?? []) as RankingPronostico[];

  if (visibleProns.length > 0) {
    const [{ data: profileRows, error: profileError }, { data: moderationRows, error: moderationError }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, is_shadowbanned")
          .in("id", visibleProns.map((p) => p.user_id)),
        supabase
          .from("pronosticos")
          .select("id, moderation_status")
          .in("id", visibleProns.map((p) => p.id)),
      ]);

    const shadowByUser = new Map<string, boolean>();
    if (!isMissingOptionalSchema(profileError) && !profileError) {
      for (const profile of profileRows ?? []) {
        shadowByUser.set(profile.id, !!profile.is_shadowbanned);
      }
    }

    const moderationById = new Map<string, RankingPronostico["moderation_status"]>();
    if (!isMissingOptionalSchema(moderationError) && !moderationError) {
      for (const row of moderationRows ?? []) {
        moderationById.set(row.id, row.moderation_status);
      }
    }

    visibleProns = filterVisibleItemsForModeration<RankingPronostico>(
      visibleProns.map((p) => ({
        ...p,
        moderation_status: moderationById.get(p.id) ?? "approved",
        is_shadowbanned: shadowByUser.get(p.user_id) ?? false,
      })),
      user?.id ?? null,
      new Set(),
      false
    );
  }

  // Aggregate by user
  const byUser = new Map<string, RankUser>();
  for (const p of visibleProns) {
    const prof = p.profiles as unknown as { id: string; username: string; display_name: string | null } | null;
    if (!prof) continue;
    const existing = byUser.get(p.user_id) ?? {
      userId: p.user_id,
      username: prof.username,
      displayName: prof.display_name ?? prof.username,
      total: 0,
      acertadas: 0,
      falladas: 0,
      acierto: 0,
      deporte: p.deporte ?? "Multi",
    };
    existing.total++;
    if (p.estado === "acertada") existing.acertadas++;
    if (p.estado === "fallada") existing.falladas++;
    byUser.set(p.user_id, existing);
  }

  const ranking: RankUser[] = Array.from(byUser.values())
    .map((u) => ({
      ...u,
      acierto: u.total > 0 ? Math.round((u.acertadas / u.total) * 100) : 0,
    }))
    .sort((a, b) => b.acertadas - a.acertadas || b.acierto - a.acierto)
    .slice(0, 20);

  // Get current user's position
  let myRank: { pos: number; acierto: number; total: number } | null = null;
  if (user) {
    const myProfile = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    const myUsername = myProfile.data?.username;
    const myIdx = ranking.findIndex((r) => r.username === myUsername);
    if (myIdx !== -1) {
      myRank = { pos: myIdx + 1, acierto: ranking[myIdx].acierto, total: ranking[myIdx].total };
    }
  }

  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  const followedUserIdSet = new Set(followedUserIds);
  const requestedUserIdSet = new Set(requestedUserIds);

  // Reorder podium: 2nd, 1st, 3rd
  const podiumOrdered =
    podium.length === 3
      ? [podium[1], podium[0], podium[2]]
      : podium;

  function periodoLink(p: string) {
    const params = new URLSearchParams();
    if (p !== "semana") params.set("periodo", p);
    if (activeDeporte !== "todos") params.set("deporte", activeDeporte);
    const qs = params.toString();
    return `/ranking${qs ? `?${qs}` : ""}`;
  }

  function deporteLink(d: string) {
    const params = new URLSearchParams();
    if (activePeriodo !== "semana") params.set("periodo", activePeriodo);
    if (d !== "todos") params.set("deporte", d);
    const qs = params.toString();
    return `/ranking${qs ? `?${qs}` : ""}`;
  }

  return (
    <TodosGanamosShell active="ranking" hideFooter>
      <main className="container ranking">
        <header className="ranking__header">
          <div>
            <h1>Ranking de tipsters</h1>
            <p>
              Quien esta acertando mas. Sube en el ranking publicando
              pronosticos argumentados y acertando.
            </p>
          </div>
        </header>

        <div className="ranking__filters">
          <div className="cluster">
            <Link className={`chip ${activePeriodo === "semana" ? "is-active" : ""}`} href={periodoLink("semana")}>
              Esta semana
            </Link>
            <Link className={`chip ${activePeriodo === "mes" ? "is-active" : ""}`} href={periodoLink("mes")}>
              Este mes
            </Link>
            <Link className={`chip ${activePeriodo === "historico" ? "is-active" : ""}`} href={periodoLink("historico")}>
              Historico
            </Link>
          </div>
          <div className="cluster">
            <span className="muted ranking__filter-label">Deporte:</span>
            {["todos", "Futbol", "Tenis", "NBA", "eSports"].map((d) => (
              <Link
                key={d}
                className={`chip ${activeDeporte === d ? "is-active" : ""}`}
                href={deporteLink(d)}
              >
                {d === "todos" ? "Todos" : d}
              </Link>
            ))}
          </div>
        </div>

        {ranking.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: "center" }}>
            <p>No hay datos para este periodo o deporte.</p>
          </div>
        ) : (
          <>
            {podiumOrdered.length >= 1 && (
              <div className="podium">
                {podiumOrdered.map((u, idx) => {
                  const realPos = podiumOrdered.length === 3
                    ? [2, 1, 3][idx]
                    : idx + 1;
                  const isFirst = realPos === 1;
                  const color = avatarColor(u.username);
                  const initials = u.username.slice(0, 2).toUpperCase();
                  return (
                    <article
                      key={u.userId}
                      className={`card podium__card ${isFirst ? "card--featured podium__card--gold" : ""}`.trim()}
                    >
                      <span className="mono podium__pos">{realPos}</span>
                      <Link
                        href={`/u/${u.username}`}
                        className={`avatar ${isFirst ? "avatar--xl podium__avatar-xl" : "avatar--lg"} avatar--${color}`}
                      >
                        {initials}
                      </Link>
                      <div className="podium__body">
                        <div className="podium__name">
                          <Link href={`/u/${u.username}`}>{u.username}</Link>
                          {isFirst && <span className="badge badge--gold">Top</span>}
                        </div>
                        <div className="podium__meta">
                          {u.deporte} · {u.total} pronosticos
                        </div>
                      </div>
                      <div className="podium__stats">
                        <div className="mono podium__profit">{u.acertadas} aciertos</div>
                        <div className="mono muted">{u.acierto}%</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {rest.length > 0 && (
              <div className="card ranking__table">
                <div className="rank-table__head">
                  <div>Pos</div>
                  <div>Tipster</div>
                  <div className="num">Acierto</div>
                  <div className="num">Acertadas</div>
                  <div className="num">Pronosticos</div>
                  <div />
                </div>

                {rest.map((u, idx) => {
                  const pos = idx + 4;
                  const color = avatarColor(u.username);
                  const initials = u.username.slice(0, 2).toUpperCase();
                  const isMe = user && myRank && pos === myRank.pos;
                  return (
                    <div
                      key={u.userId}
                      className={`rank-table__row ${isMe ? "rank-table__row--me" : ""}`}
                    >
                      <div className="mono rank-table__pos">{pos}</div>
                      <div className="rank-table__user">
                        <Link
                          href={`/u/${u.username}`}
                          className={`avatar avatar--sm avatar--${color}`}
                        >
                          {initials}
                        </Link>
                        <div>
                          <div className="rank-table__name">
                            <Link href={`/u/${u.username}`}>{u.username}</Link>
                          </div>
                          <div className="rank-table__sub">
                            {u.deporte} · {u.total} pron.
                          </div>
                        </div>
                      </div>
                      <div className="num mono">{u.acierto}%</div>
                      <div className="num mono stat-positive">{u.acertadas}</div>
                      <div className="num mono">{u.total}</div>
                      <div className="rank-table__action">
                        {user && user.id !== u.userId ? (
                          <FollowButton
                            targetUserId={u.userId}
                            initialFollowing={followedUserIdSet.has(u.userId)}
                            initialRequested={requestedUserIdSet.has(u.userId)}
                          />
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {myRank && myRank.pos > ranking.length && (
              <div className="card ranking__table">
                <div className="rank-table__row rank-table__row--me">
                  <div className="mono rank-table__pos rank-table__pos--me">{myRank.pos}</div>
                  <div className="rank-table__user">
                    <span className="avatar avatar--sm avatar--blue">YO</span>
                    <div>
                      <div className="rank-table__name">Tu posicion</div>
                      <div className="rank-table__sub rank-table__sub--me">
                        Sigue publicando →
                      </div>
                    </div>
                  </div>
                  <div className="num mono">{myRank.acierto}%</div>
                  <div className="num mono">-</div>
                  <div className="num mono">{myRank.total}</div>
                  <div />
                </div>
              </div>
            )}
          </>
        )}

        {!user && (
          <div className="card" style={{ padding: 24, textAlign: "center", marginTop: 16 }}>
            <p style={{ marginBottom: 12 }}>
              Registrate para aparecer en el ranking y seguir a otros tipsters.
            </p>
            <Link href="/auth?tab=registro" className="btn btn--primary">
              Crear cuenta gratis
            </Link>
          </div>
        )}
      </main>
    </TodosGanamosShell>
  );
}
