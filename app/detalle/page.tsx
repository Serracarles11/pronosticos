import Link from "next/link";
import { notFound } from "next/navigation";
import { PulsoShell } from "../components/pulso-shell";
import { createClient } from "@/lib/supabase/server";
import { LikeButton } from "../components/like-button";
import { CommentForm } from "../components/comment-form";
import { SaveButton } from "../components/save-button";
import { FollowButton } from "../components/follow-button";
import { SettlementForm } from "../components/settlement-form";
import { ProofImageModal } from "../components/proof-image-modal";

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

function canSettlePronostico(fechaEvento: string | null, estado: string) {
  if (!fechaEvento || estado !== "pendiente") return false;
  return Date.now() >= new Date(fechaEvento).getTime() + 24 * 60 * 60 * 1000;
}

export default async function DetallePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; error?: string }>;
}) {
  const { id, error } = await searchParams;

  if (!id) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: p } = await supabase
    .from("pronosticos")
    .select("*, profiles!pronosticos_user_id_fkey(username, display_name, bio)")
    .eq("id", id)
    .single();

  if (!p) notFound();

  const [{ count: likesCount }, likedRes, savedRes, followingRes, comentariosRes, masDelAutorRes] =
    await Promise.all([
      supabase
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("pronostico_id", id),
      user
        ? supabase
            .from("likes")
            .select("user_id")
            .eq("user_id", user.id)
            .eq("pronostico_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? supabase
            .from("guardados")
            .select("user_id")
            .eq("user_id", user.id)
            .eq("pronostico_id", id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user
        ? supabase
            .from("seguimientos")
            .select("follower_id")
            .eq("follower_id", user.id)
            .eq("following_id", p.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("comentarios")
        .select("*, profiles!comentarios_user_id_fkey(username)")
        .eq("pronostico_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("pronosticos")
        .select("id, evento, mercado, estado")
        .eq("user_id", p.user_id)
        .neq("id", id)
        .eq("visibilidad", "publico")
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

  const totalLikes = likesCount ?? 0;
  const isLiked = !!likedRes?.data;
  const isSaved = !!savedRes?.data;
  const isFollowing = !!followingRes?.data;
  const comentarios = comentariosRes?.data ?? [];
  const masDelAutor = masDelAutorRes?.data ?? [];

  const autor = p.profiles as { username: string; display_name: string | null; bio: string | null } | null;
  const autorUsername = autor?.username ?? "usuario";
  const autorColor = avatarColor(autorUsername);
  const autorInitials = autorUsername.slice(0, 2).toUpperCase();

  const userInitials = user
    ? (user.email?.split("@")[0] ?? "yo").slice(0, 2).toUpperCase()
    : "??";
  const userColor = user ? avatarColor(user.email?.split("@")[0] ?? "yo") : "blue";
  const isOwner = user?.id === p.user_id;
  const canSettle = isOwner && canSettlePronostico(p.fecha_evento, p.estado);

  return (
    <PulsoShell active="feed">
      <main className="detail">
        <div className="detail__inner">
          <section className="detail__main">
            <nav className="detail__crumbs">
              <Link href="/feed">Pronosticos</Link>
              {p.deporte && (
                <>
                  <span>/</span>
                  <Link href={`/feed?deporte=${encodeURIComponent(p.deporte)}`}>{p.deporte}</Link>
                </>
              )}
              {p.competicion && (
                <>
                  <span>/</span>
                  <span>{p.competicion}</span>
                </>
              )}
            </nav>

            <article className="card detail__pred pred">
              {error && (
                <div className="auth-error">
                  <span className="auth-error__icon">!</span>
                  {error}
                </div>
              )}

              <header className="pred__head">
                <div className="pred__author">
                  <Link
                    href={`/perfil?user=${autorUsername}`}
                    className={`avatar avatar--lg avatar--${autorColor}`}
                  >
                    {autorInitials}
                  </Link>
                  <div className="pred__author-meta">
                    <span className="pred__user">
                      <Link href={`/perfil?user=${autorUsername}`}>{autorUsername}</Link>
                    </span>
                    <span className="pred__sub">
                      {timeAgo(p.created_at)}
                      {p.competicion ? ` · ${p.competicion}` : ""}
                    </span>
                  </div>
                </div>
                <EstadoPill estado={p.estado} />
              </header>

              <div>
                <h1>{p.evento}</h1>
                {p.fecha_evento && (
                  <p className="detail__event">
                    {new Date(p.fecha_evento).toLocaleString("es-ES", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                )}
              </div>

              <div className="pred__strip">
                <div className="pred__cell">
                  <div className="pred__cell-label">Pronostico</div>
                  <div className="pred__cell-value">{p.mercado}</div>
                </div>
                <div className="pred__cell pred__cell--accent">
                  <div className="pred__cell-label">Cuota</div>
                  <div className="pred__cell-value mono">{Number(p.cuota).toFixed(2)}</div>
                </div>
                <div className="pred__cell">
                  <div className="pred__cell-label">Confianza</div>
                  <div className="pred__confidence">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={s <= p.confianza ? "is-on" : ""} />
                    ))}
                  </div>
                </div>
              </div>

              {p.explicacion && (
                <div className="detail__body">
                  {String(p.explicacion)
                    .split("\n")
                    .map((line: string, i: number) => (
                      <p key={i}>{line}</p>
                    ))}
                </div>
              )}

              {p.resultado_captura_url && (
                <div className="settlement-proof">
                  <div>
                    <strong>Captura de cierre</strong>
                    <span>Resultado marcado como {p.estado}.</span>
                  </div>
                  <ProofImageModal imageUrl={p.resultado_captura_url} />
                </div>
              )}

              {canSettle && (
                <SettlementForm pronosticoId={id} />
              )}

              <footer className="pred__foot detail__foot">
                <div className="detail__actions">
                  {user ? (
                    <LikeButton
                      pronosticoId={id}
                      initialCount={totalLikes}
                      initialLiked={isLiked}
                    />
                  ) : (
                    <Link href="/auth" className="btn btn--ghost">
                      ♥ {totalLikes}
                    </Link>
                  )}
                  <a href="#comentarios" className="btn btn--ghost">
                    💬 {comentarios.length} comentarios
                  </a>
                  {user && (
                    <SaveButton pronosticoId={id} initialSaved={isSaved} />
                  )}
                </div>
              </footer>
            </article>

            <section className="comments" id="comentarios">
              <h2>{comentarios.length} comentarios</h2>

              {user ? (
                <CommentForm
                  pronosticoId={id}
                  userInitials={userInitials}
                  userColor={userColor}
                />
              ) : (
                <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                  <Link href="/auth" className="btn btn--primary">
                    Inicia sesion para comentar
                  </Link>
                </div>
              )}

              <div className="comments__list">
                {comentarios.map((c) => {
                  const cUsername =
                    (c.profiles as { username: string } | null)?.username ?? "usuario";
                  const cColor = avatarColor(cUsername);
                  const cInitials = cUsername.slice(0, 2).toUpperCase();
                  return (
                    <article className="comment" key={c.id}>
                      <Link
                        href={`/perfil?user=${cUsername}`}
                        className={`avatar avatar--md avatar--${cColor}`}
                      >
                        {cInitials}
                      </Link>
                      <div className="comment__body">
                        <div className="comment__bubble">
                          <header className="comment__head">
                            <span className="comment__name">{cUsername}</span>
                            <span className="comment__time">· {timeAgo(c.created_at)}</span>
                          </header>
                          <p>{c.contenido}</p>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {comentarios.length === 0 && (
                  <p className="muted" style={{ padding: "16px 0" }}>
                    Sin comentarios aun. Se el primero en opinar.
                  </p>
                )}
              </div>
            </section>
          </section>

          <aside className="detail__rail">
            {masDelAutor.length > 0 && (
              <div className="side-section">
                <h4 className="side-section__title">Mas de {autorUsername}</h4>
                <div className="rail__list">
                  {masDelAutor.map((mp) => (
                    <Link
                      className="card rail__item"
                      href={`/detalle?id=${mp.id}`}
                      key={mp.id}
                    >
                      <div className="rail__item-title">{mp.evento}</div>
                      <div className="rail__item-meta">
                        <span>{mp.mercado}</span>
                        <span
                          className={
                            mp.estado === "acertada"
                              ? "mono stat-positive"
                              : mp.estado === "fallada"
                              ? "mono stat-negative"
                              : "mono muted"
                          }
                        >
                          {mp.estado === "acertada"
                            ? "Acertada"
                            : mp.estado === "fallada"
                            ? "Fallada"
                            : "Pendiente"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  href={`/perfil?user=${autorUsername}`}
                  className="btn btn--ghost"
                  style={{ marginTop: 8, width: "100%" }}
                >
                  Ver perfil completo →
                </Link>
              </div>
            )}

            <div className="side-section">
              <h4 className="side-section__title">Sobre {autorUsername}</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Link
                  href={`/perfil?user=${autorUsername}`}
                  className={`avatar avatar--lg avatar--${autorColor}`}
                  style={{ alignSelf: "flex-start" }}
                >
                  {autorInitials}
                </Link>
                <strong>{autor?.display_name ?? autorUsername}</strong>
                {autor?.bio && <p className="muted" style={{ fontSize: 13 }}>{autor.bio}</p>}
                {user && user.id !== p.user_id && (
                  <FollowButton
                    targetUserId={p.user_id}
                    initialFollowing={isFollowing}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </PulsoShell>
  );
}
