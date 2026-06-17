import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { createClient } from "@/lib/supabase/server";
import { LikeButton } from "../components/like-button";
import { CommentForm } from "../components/comment-form";
import { CommentLink } from "../components/comment-link";
import { SaveButton } from "../components/save-button";
import { FollowButton } from "../components/follow-button";
import { SettlementForm } from "../components/settlement-form";
import { ProofImageModal } from "../components/proof-image-modal";
import { ReportButton } from "../components/report-button";
import { CopyLinkButton, ShareButton } from "../components/share-button";
import { DeletePronosticoButton } from "../components/delete-pronostico-button";
import { EditPronosticoLinkButton } from "../components/edit-pronostico-link-button";
import { BackButton } from "../components/back-button";
import { formatPickCategory } from "@/lib/pronostico-meta";
import {
  formatPronosticoSelectionPick,
  parsePronosticoSelections,
} from "@/lib/pronostico-selections";
import { getBookmakerAccentFromSources } from "@/lib/bookmaker-accent";
import { resolvePronosticoMatchContext } from "@/lib/pronostico-match-resolution";
import { getMutedUserIds, isMissingOptionalSchema } from "@/lib/anti-spam/server";
import { filterVisibleItemsForModeration } from "@/lib/anti-spam/pure";
import { upcomingPronosticoFilter } from "@/lib/upcoming-content";
import { canSettlePronostico } from "@/lib/pronostico-settlement";

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

function getCopyLink(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
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
  if (!user) redirect(`/auth?next=${encodeURIComponent(`/detalle?id=${id}`)}`);

  const { data: p } = await supabase
    .from("pronosticos")
    .select("*, profiles!pronosticos_user_id_fkey(username, display_name, bio, is_private)")
    .eq("id", id)
    .single();

  if (!p) notFound();

  const [{ count: likesCount }, likedRes, savedRes, followingRes, requestRes, comentariosRes, masDelAutorRes] =
    await Promise.all([
      supabase
        .from("likes")
        .select("user_id", { count: "exact", head: true })
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
      user
        ? supabase
            .from("seguimiento_solicitudes")
            .select("follower_id")
            .eq("follower_id", user.id)
            .eq("following_id", p.user_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("comentarios")
        .select("id, user_id, contenido, created_at, moderation_status, profiles!comentarios_user_id_fkey(username)")
        .eq("pronostico_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("pronosticos")
        .select("id, evento, cuota, visibilidad, fecha_evento")
        .eq("user_id", p.user_id)
        .neq("id", id)
        .neq("visibilidad", "borrador")
        .or(upcomingPronosticoFilter())
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

  const totalLikes = likesCount ?? 0;
  const isLiked = !!likedRes?.data;
  const isSaved = !!savedRes?.data;
  const isFollowing = !!followingRes?.data;
  const hasRequested = !!requestRes?.data;
  let comentarios = comentariosRes?.data ?? [];
  const masDelAutor = masDelAutorRes?.data ?? [];

  const autor = p.profiles as { username: string; display_name: string | null; bio: string | null; is_private?: boolean } | null;
  const autorUsername = autor?.username ?? "usuario";
  const autorColor = avatarColor(autorUsername);
  const autorInitials = autorUsername.slice(0, 2).toUpperCase();

  const userInitials = user
    ? (user.email?.split("@")[0] ?? "yo").slice(0, 2).toUpperCase()
    : "??";
  const userColor = user ? avatarColor(user.email?.split("@")[0] ?? "yo") : "blue";
  const isOwner = user?.id === p.user_id;
  const { data: currentProfile, error: currentProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = !isMissingOptionalSchema(currentProfileError) && currentProfile?.role === "admin";

  if (comentarios.length > 0) {
    const mutedUserIds = await getMutedUserIds(supabase, user.id);
    const commenterIds = Array.from(new Set(comentarios.map((comment) => comment.user_id).filter(Boolean)));
    const { data: commenterProfiles, error: commenterProfilesError } = await supabase
      .from("profiles")
      .select("id, is_shadowbanned")
      .in("id", commenterIds);
    const shadowByUser = new Map<string, boolean>();
    if (!isMissingOptionalSchema(commenterProfilesError) && !commenterProfilesError) {
      for (const profile of commenterProfiles ?? []) {
        shadowByUser.set(profile.id, !!profile.is_shadowbanned);
      }
    }
    comentarios = filterVisibleItemsForModeration(
      comentarios.map((comment) => ({
        ...comment,
        is_shadowbanned: shadowByUser.get(comment.user_id) ?? false,
      })),
      user.id,
      mutedUserIds,
      isAdmin
    );
  }

  const resolvedMatchContext =
    isOwner && p.estado === "pendiente" && !p.fecha_evento
      ? await resolvePronosticoMatchContext({
          supabase,
          evento: String(p.evento ?? ""),
          mercado: String(p.mercado ?? ""),
        })
      : null;
  const settlementFechaEvento = p.fecha_evento ?? resolvedMatchContext?.kickoffAt ?? null;
  const canSettle = isOwner && canSettlePronostico(settlementFechaEvento, p.estado);
  const impliedProbability = Math.round((1 / Number(p.cuota)) * 100);
  const confidenceLabel =
    p.confianza >= 4 ? "Conviccion alta" : p.confianza === 3 ? "Conviccion media" : "Conviccion prudente";
  const categorias = Array.isArray(p.categorias) ? (p.categorias as string[]) : [];
  const copyLink = getCopyLink(p.copy_link);
  const selections = parsePronosticoSelections(String(p.mercado ?? ""));
  const isCombined = selections.length > 1;
  const bookmakerAccent = getBookmakerAccentFromSources(p.bookmaker, copyLink);

  return (
    <TodosGanamosShell active="feed">
      <main className="detail">
        <div className="detail__inner">
          <section className="detail__main">
            <BackButton />
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

            <article
              className={[
                "card detail__pred pred",
                bookmakerAccent?.className ?? "",
              ].filter(Boolean).join(" ")}
            >
              {error && (
                <div className="auth-error">
                  <span className="auth-error__icon">!</span>
                  {error}
                </div>
              )}

              <header className="pred__head">
                <div className="pred__author">
                  <Link
                    href={`/u/${autorUsername}`}
                    className={`avatar avatar--lg avatar--${autorColor}`}
                  >
                    {autorInitials}
                  </Link>
                  <div className="pred__author-meta">
                    <span className="pred__user">
                      <Link href={`/u/${autorUsername}`}>{autorUsername}</Link>
                    </span>
                    <span className="pred__sub">
                      {timeAgo(p.created_at)}
                      {p.competicion ? ` · ${p.competicion}` : ""}
                    </span>
                  </div>
                </div>
                <div className="pred__head-actions">
                  {bookmakerAccent && (
                    <span className="pred__bookmaker">{bookmakerAccent.label}</span>
                  )}
                  <EstadoPill estado={p.estado} />
                  {p.moderation_status === "pending_review" && isOwner && (
                    <span className="badge badge--warn">Pendiente de revision</span>
                  )}
                </div>
              </header>

              <div>
                <h1>{p.evento}</h1>
                {settlementFechaEvento && (
                  <p className="detail__event">
                    {new Date(settlementFechaEvento).toLocaleString("es-ES", {
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

              {categorias.length > 0 && (
                <div className="pred-meta-list">
                  {categorias.map((category) => (
                    <span className="badge" key={category}>
                      {formatPickCategory(category)}
                    </span>
                  ))}
                </div>
              )}

              {isCombined && (
                <div className="combo-selections">
                  {selections.map((selection, selectionIndex) => (
                    <div className="combo-selection" key={`${selection.eventName}-${selection.pick}-${selectionIndex}`}>
                      <span className="combo-selection__num">{selectionIndex + 1}</span>
                      <div>
                        {selection.eventName && <strong>{selection.eventName}</strong>}
                        <span>{formatPronosticoSelectionPick(selection.pick)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={`pred__strip ${isCombined ? "pred__strip--combo" : ""}`}>
                {!isCombined && (
                  <div className="pred__cell">
                    <div className="pred__cell-label">Pronostico</div>
                    <div className="pred__cell-value">{formatPronosticoSelectionPick(p.mercado)}</div>
                  </div>
                )}
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
                  <CommentLink
                    className="btn btn--ghost"
                    count={comentarios.length}
                    href="#comentarios"
                    label="comentarios"
                  />
                  {user && (
                    <SaveButton pronosticoId={id} initialSaved={isSaved} />
                  )}
                  <CopyLinkButton disabled={!copyLink} url={copyLink ?? undefined} />
                  <ShareButton title={`${p.evento} - ${p.mercado}`} />
                  {isOwner && <EditPronosticoLinkButton initialCopyLink={copyLink} pronosticoId={id} />}
                  {isOwner && <DeletePronosticoButton pronosticoId={id} />}
                  {user && !isOwner && <ReportButton pronosticoId={id} />}
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
                  const cProfileData = c.profiles as unknown as
                    | { username: string }
                    | Array<{ username: string }>
                    | null;
                  const cProfile = Array.isArray(cProfileData)
                    ? cProfileData[0] ?? null
                    : cProfileData;
                  const cUsername = cProfile?.username ?? "usuario";
                  const cColor = avatarColor(cUsername);
                  const cInitials = cUsername.slice(0, 2).toUpperCase();
                  return (
                    <article className="comment" key={c.id}>
                      <Link
                        href={`/u/${cUsername}`}
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
                          {c.moderation_status === "pending_review" && c.user_id === user.id && (
                            <span className="badge badge--warn">Pendiente de revision</span>
                          )}
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
            <div className="side-section">
              <h4 className="side-section__title">Lectura rapida</h4>
              <div className="insight-card">
                <div>
                  <span>Probabilidad implicita</span>
                  <strong className="mono">{impliedProbability}%</strong>
                </div>
                <div>
                  <span>Confianza del autor</span>
                  <strong>{confidenceLabel}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <strong>{p.estado}</strong>
                </div>
              </div>
            </div>

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
                        <span>Cuota</span>
                        <span className="mono">{Number(mp.cuota).toFixed(2)}</span>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  href={`/u/${autorUsername}`}
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
                  href={`/u/${autorUsername}`}
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
                    initialRequested={hasRequested}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </TodosGanamosShell>
  );
}
