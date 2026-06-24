import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TodosGanamosShell } from "@/app/components/todosganamos-shell";
import { FollowButton } from "@/app/components/follow-button";
import { ReportUserButton } from "@/app/components/report-user-button";
import { ShareButton } from "@/app/components/share-button";
import { SocialLinks } from "@/app/components/social-links";
import { UserAvatar } from "@/app/components/user-avatar";
import { formatPronosticoSelectionPick } from "@/lib/pronostico-selections";
import { parseProfileSocialLinks, type SocialLink } from "@/lib/social-links";
import { upcomingPronosticoFilter } from "@/lib/upcoming-content";

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
};

const TABS = ["resumen", "picks", "estadisticas", "favoritos", "actividad", "redes"] as const;
type ProfileTab = (typeof TABS)[number];

function isProfileTab(value?: string): value is ProfileTab {
  return TABS.includes(value as ProfileTab);
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Hace unos minutos";
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.floor(hours / 24)} dias`;
}

async function getPublicProfile(username: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfile(username);
  if (!profile) return { title: "Usuario no encontrado" };

  const name = profile.display_name ?? profile.username;
  const description = profile.bio
    ? `${profile.bio.slice(0, 130)} - Perfil publico de ${name} en TodosGanamos.`
    : `Consulta el perfil publico de ${name} en TodosGanamos.`;
  const canonical = `/u/${profile.username}`;

  return {
    title: `${name} (@${profile.username})`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${name} (@${profile.username}) - TodosGanamos`,
      description,
      type: "profile",
      url: canonical,
    },
  };
}

export default async function PublicUserPage({ params, searchParams }: Props) {
  const [{ username }, { tab }] = await Promise.all([params, searchParams]);
  const activeTab = isProfileTab(tab) ? tab : "resumen";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = await getPublicProfile(username);

  if (!profile) notFound();

  const isOwnProfile = user?.id === profile.id;
  const [picksRes, socialsRes, badgesRes, followingRes, requestRes, muteRes] = await Promise.all([
    user
      ? supabase
          .from("pronosticos")
          .select("id, evento, mercado, cuota, estado, competicion, fecha_evento, created_at, visibilidad")
          .eq("user_id", profile.id)
          .neq("visibilidad", "borrador")
          .or(upcomingPronosticoFilter())
          .order("created_at", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] }),
    supabase
      .from("user_social_links")
      .select("id, platform, url, is_public, sort_order")
      .eq("user_id", profile.id)
      .eq("is_public", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("user_badges")
      .select("badges(name, slug, description)")
      .eq("user_id", profile.id),
    user && !isOwnProfile
      ? supabase
          .from("seguimientos")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user && !isOwnProfile
      ? supabase
          .from("seguimiento_solicitudes")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user && !isOwnProfile
      ? supabase
          .from("user_mutes")
          .select("muted_user_id")
          .eq("muter_user_id", user.id)
          .eq("muted_user_id", profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const picks = picksRes.data ?? [];
  const socialLinks = socialsRes.error
    ? parseProfileSocialLinks(profile.social_links)
    : ((socialsRes.data ?? []) as SocialLink[]);
  const badges = (badgesRes.data ?? []).flatMap((item) => {
    const badge = item.badges as unknown as
      | { name: string; slug: string; description: string | null }
      | Array<{ name: string; slug: string; description: string | null }>
      | null;
    return badge ? (Array.isArray(badge) ? badge : [badge]) : [];
  });
  const settledPicks = picks.filter((pick) => pick.estado === "acertada" || pick.estado === "fallada");
  const wonPicks = settledPicks.filter((pick) => pick.estado === "acertada");
  const lostPicks = settledPicks.filter((pick) => pick.estado === "fallada");
  const totalStake = settledPicks.length;
  const simulatedResult = settledPicks.reduce((total, pick) => {
    return total + (pick.estado === "acertada" ? Number(pick.cuota) - 1 : -1);
  }, 0);
  const yieldValue = totalStake > 0 ? (simulatedResult / totalStake) * 100 : 0;
  const hitRate = settledPicks.length > 0 ? (wonPicks.length / settledPicks.length) * 100 : 0;
  const visiblePicks = activeTab === "resumen" ? picks.slice(0, 5) : picks;
  const favoriteCompetitions = (profile.favorite_competitions ?? []) as string[];
  const favoriteBookmakers = (profile.favorite_bookmakers ?? []) as string[];
  const name = profile.display_name ?? profile.username;

  function tabHref(nextTab: ProfileTab) {
    return nextTab === "resumen" ? `/u/${profile.username}` : `/u/${profile.username}?tab=${nextTab}`;
  }

  return (
    <TodosGanamosShell active="perfil">
      <main className="profile public-profile">
        <section className="profile__hero">
          <div className="container">
            <div className="profile__head">
              <UserAvatar avatarUrl={profile.avatar_url} size="xl" username={profile.username} />
              <div className="profile__head-body">
                <div className="profile__name-row">
                  <h1>{name}</h1>
                  {profile.is_verified && <span className="badge badge--ok">Verificado</span>}
                  {profile.plan === "premium" && <span className="badge badge--gold">Premium</span>}
                  {badges.map((badge) => (
                    <span className="badge" key={badge.slug} title={badge.description ?? undefined}>
                      {badge.name}
                    </span>
                  ))}
                </div>
                <div className="profile__handle">
                  @{profile.username}
                  {profile.country_code ? ` - ${profile.country_code.toUpperCase()}` : ""}
                  {profile.is_private ? " - Cuenta privada" : ""}
                </div>
                {profile.bio && <p className="profile__bio">{profile.bio}</p>}
                <div className="profile__meta">
                  <span>Miembro desde {formatDate(profile.created_at)}</span>
                  <span>Resultados simulados e informativos</span>
                </div>
                <SocialLinks links={socialLinks} />
              </div>
              <div className="profile__head-actions">
                {user && !isOwnProfile && (
                  <FollowButton
                    initialFollowing={!!followingRes.data}
                    initialRequested={!!requestRes.data}
                    targetUserId={profile.id}
                  />
                )}
                <ShareButton
                  text={`Consulta el perfil de ${name} en TodosGanamos.`}
                  title={`Perfil de ${name}`}
                />
                {user && !isOwnProfile && !socialsRes.error && (
                  <ReportUserButton initialMuted={!!muteRes.data} userId={profile.id} />
                )}
                {isOwnProfile && (
                  <Link className="btn btn--ghost" href="/cuenta">
                    Editar perfil
                  </Link>
                )}
              </div>
            </div>

            {user ? <div className="profile__stats">
              <div className="stat">
                <div className="stat__label">Seguidores</div>
                <div className="stat__value">{profile.followers_count ?? 0}</div>
              </div>
              <div className="stat">
                <div className="stat__label">Siguiendo</div>
                <div className="stat__value">{profile.following_count ?? 0}</div>
              </div>
              <div className="stat">
                <div className="stat__label">Picks publicos</div>
                <div className="stat__value">{picks.length}</div>
              </div>
              <div className="stat stat--ok">
                <div className="stat__label">Acierto simulado</div>
                <div className="stat__value">{hitRate.toFixed(0)}%</div>
              </div>
              <div className="stat">
                <div className="stat__label">Yield simulado</div>
                <div className="stat__value">{yieldValue >= 0 ? "+" : ""}{yieldValue.toFixed(1)}%</div>
              </div>
            </div> : null}
          </div>
        </section>

        {user ? <section className="container profile__body">
          <nav className="profile__tabs public-profile__tabs">
            {TABS.map((profileTab) => (
              <Link
                className={`tab ${activeTab === profileTab ? "is-active" : ""}`}
                href={tabHref(profileTab)}
                key={profileTab}
                scroll={false}
              >
                {profileTab.charAt(0).toUpperCase() + profileTab.slice(1)}
              </Link>
            ))}
          </nav>

          {activeTab === "estadisticas" ? (
            <div className="profile__grid">
              <section className="card card__pad">
                <h2>Estadisticas simuladas</h2>
                <div className="insight-card">
                  <div><span>Picks cerrados</span><strong>{settledPicks.length}</strong></div>
                  <div><span>Acertados</span><strong>{wonPicks.length}</strong></div>
                  <div><span>Fallados</span><strong>{lostPicks.length}</strong></div>
                  <div><span>ROI simulado</span><strong>{simulatedResult >= 0 ? "+" : ""}{simulatedResult.toFixed(2)} u</strong></div>
                  <div><span>Yield simulado</span><strong>{yieldValue >= 0 ? "+" : ""}{yieldValue.toFixed(1)}%</strong></div>
                </div>
              </section>
              <aside className="card card__pad legal-callout">
                <strong>Metricas informativas</strong>
                <p>Estas estadisticas usan unidades simuladas. No representan dinero real ni garantizan resultados futuros.</p>
              </aside>
            </div>
          ) : activeTab === "favoritos" ? (
            <div className="profile__grid">
              <section className="card card__pad">
                <h2>Competiciones favoritas</h2>
                <div className="tag-list">
                  {favoriteCompetitions.length > 0 ? favoriteCompetitions.map((item) => <span className="badge" key={item}>{item}</span>) : <p className="muted">Sin competiciones publicadas.</p>}
                </div>
              </section>
              <section className="card card__pad">
                <h2>Bookmakers favoritos</h2>
                <div className="tag-list">
                  {favoriteBookmakers.length > 0 ? favoriteBookmakers.map((item) => <span className="badge" key={item}>{item}</span>) : <p className="muted">Sin bookmakers publicados.</p>}
                </div>
              </section>
            </div>
          ) : activeTab === "redes" ? (
            <section className="card card__pad public-profile__panel">
              <h2>Redes sociales</h2>
              {socialLinks.length > 0 ? <SocialLinks links={socialLinks} /> : <p className="muted">Este usuario no ha publicado redes sociales.</p>}
            </section>
          ) : activeTab === "actividad" ? (
            <section className="card card__pad public-profile__panel">
              <h2>Actividad reciente</h2>
              {picks.length > 0 ? (
                <div className="activity-list">
                  {picks.slice(0, 12).map((pick) => (
                    <Link href={`/detalle?id=${pick.id}`} key={pick.id}>
                      <strong>Publico un pick: {pick.evento}</strong>
                      <span>{timeAgo(pick.created_at)} - {formatPronosticoSelectionPick(pick.mercado)}</span>
                    </Link>
                  ))}
                </div>
              ) : <p className="muted">Todavia no hay actividad publica.</p>}
            </section>
          ) : (
            <section className="profile__list public-profile__picks">
              <div className="public-profile__section-head">
                <div>
                  <h2>{activeTab === "picks" ? "Picks publicos" : "Ultimos picks"}</h2>
                  <p>Pronosticos informativos compartidos por @{profile.username}.</p>
                </div>
                {activeTab === "resumen" && picks.length > 5 && <Link className="btn btn--ghost public-profile__view-all" href={tabHref("picks")} scroll={false}>Ver todos</Link>}
              </div>
              {visiblePicks.length > 0 ? visiblePicks.map((pick) => (
                <Link className="card profile__row profile__row--compact public-profile__pick-row" href={`/detalle?id=${pick.id}`} key={pick.id}>
                  <div className="profile__row-body">
                    <h3 className="profile__row-title-clean">{pick.evento}</h3>
                    <h3>{pick.evento} - {formatPronosticoSelectionPick(pick.mercado)}</h3>
                    <span className="profile__row-meta">
                      {pick.competicion ?? "Competicion no indicada"} - {timeAgo(pick.created_at)}
                    </span>
                  </div>
                  <div className="profile__row-stats">
                    <span className="profile__cuota public-profile__pick-odds">
                      <span>Cuota</span>
                      <strong className="mono">{Number(pick.cuota).toFixed(2)}</strong>
                    </span>
                    <span className={`pill ${pick.estado === "acertada" ? "pill--ok" : pick.estado === "fallada" ? "pill--bad" : "pill--warn"}`}>
                      {pick.estado}
                    </span>
                  </div>
                </Link>
              )) : <div className="card card__pad"><p className="muted">Todavia no hay picks publicos para mostrar.</p></div>}
            </section>
          )}
        </section> : (
          <section className="container profile__body">
            <div className="card member-gate">
              <span className="member-gate__icon">+</span>
              <div>
                <h2>Inicia sesion para ver los pronosticos</h2>
                <p>El perfil es publico, pero sus picks y estadisticas solo estan disponibles para miembros de TodosGanamos.</p>
              </div>
              <Link className="btn btn--primary" href={`/auth?next=${encodeURIComponent(`/u/${profile.username}`)}`}>
                Iniciar sesion
              </Link>
            </div>
          </section>
        )}
      </main>
    </TodosGanamosShell>
  );
}
