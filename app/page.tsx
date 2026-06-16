import Link from "next/link";
import { TodosGanamosShell } from "./components/todosganamos-shell";
import { CommunityStatsCard } from "@/components/home/CommunityStatsCard";
import { createClient } from "@/lib/supabase/server";
import { getBookmakerAccentFromSources } from "@/lib/bookmaker-accent";
import {
  fetchPronosticoBookmakers,
  type PronosticoBookmakerSupabase,
} from "@/lib/pronostico-bookmakers";
import { upcomingPronosticoFilter } from "@/lib/upcoming-content";

const COLORS = ["blue", "navy", "sky", "steel", "slate", "teal", "indigo", "purple"] as const;
type FeaturedPronostico = {
  id: string;
  evento: string;
  mercado: string;
  cuota: number;
  confianza: number;
  estado: string;
  bookmaker?: string | null;
  copy_link?: string | null;
  fecha_evento?: string | null;
  profiles: unknown;
};

function avatarColor(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [communityCountRes, latestUsersRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_shadowbanned", false),
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, created_at")
      .eq("is_shadowbanned", false)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);
  const communitySummary = {
    totalUsers: communityCountRes.count ?? 0,
    latestUsers: (latestUsersRes.data ?? []).map((profile) => ({
      id: String(profile.id),
      username: String(profile.username ?? "usuario"),
      displayName: profile.display_name ?? null,
      avatarUrl: profile.avatar_url ?? null,
      createdAt: String(profile.created_at),
    })),
    error: Boolean(communityCountRes.error || latestUsersRes.error),
  };

  const [featuredRes, allPronsRes] = user
    ? await Promise.all([
        supabase
          .from("pronosticos")
          .select("id, evento, mercado, cuota, confianza, estado, copy_link, fecha_evento, profiles!pronosticos_user_id_fkey(username)")
          .eq("visibilidad", "publico")
          .or(upcomingPronosticoFilter())
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("pronosticos")
          .select("user_id, estado, profiles!pronosticos_user_id_fkey(username, display_name)")
          .eq("visibilidad", "publico")
          .order("created_at", { ascending: false })
          .limit(500),
      ])
    : [{ data: [] }, { data: [] }];
  let featured = (featuredRes.data ?? []) as FeaturedPronostico[];
  if (featured.length > 0) {
    const bookmakerById = await fetchPronosticoBookmakers(
      supabase as unknown as PronosticoBookmakerSupabase,
      featured.map((item) => item.id as string)
    );
    featured = featured.map((item) => ({
      ...item,
      bookmaker: bookmakerById.get(item.id as string) ?? null,
    }));
  }
  const allProns = allPronsRes.data;

  type TipsterMap = { username: string; displayName: string; total: number; acertadas: number };
  const byUser = new Map<string, TipsterMap>();
  for (const p of allProns ?? []) {
    const prof = p.profiles as unknown as { username: string; display_name: string | null } | null;
    if (!prof) continue;
    const ex = byUser.get(p.user_id) ?? {
      username: prof.username,
      displayName: prof.display_name ?? prof.username,
      total: 0,
      acertadas: 0,
    };
    ex.total++;
    if (p.estado === "acertada") ex.acertadas++;
    byUser.set(p.user_id, ex);
  }
  const topTipsters = Array.from(byUser.values())
    .map((u) => ({ ...u, acierto: u.total > 0 ? Math.round((u.acertadas / u.total) * 100) : 0 }))
    .sort((a, b) => b.acertadas - a.acertadas)
    .slice(0, 3);

  return (
    <TodosGanamosShell active="landing">
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <span className="pill pill--blue">
              <span className="pill__dot" />
              Comunidad de tipsters
            </span>
            <h1>
              Comparte tus pronosticos.
              <br />
              <span className="hero__accent">Descubre las mejores</span>{" "}
              apuestas de la comunidad.
            </h1>
            <p>
              Los usuarios votan, comentan y siguen a los tipsters que aciertan.
              Sin dinero real: solo reputacion, estadisticas y debate transparente.
            </p>
            <div className="responsible-note">
              <strong>+18</strong>
              <span>Contenido para mayores de edad. TodosGanamos no acepta apuestas ni depositos.</span>
            </div>
            <div className="hero__cta">
              <Link className="btn btn--primary btn--lg" href={user ? "/feed" : "/auth?next=/feed"}>
                {user ? "Explorar pronosticos" : "Crear cuenta para explorar"} →
              </Link>
              <Link className="btn btn--ghost btn--lg" href="/auth?tab=registro">
                Crear cuenta gratis
              </Link>
            </div>
          </div>

          <div className="hero__preview">
            <CommunityStatsCard {...communitySummary} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section__head">
            <h2>Destacadas hoy</h2>
            <Link href="/feed" className="section__link">Ver feed completo →</Link>
          </div>
          <div className="grid grid--3">
            {(featured ?? []).length > 0
              ? (featured ?? []).map((p, i) => {
                  const id = String(p.id);
                  const estado = String(p.estado ?? "");
                  const cuota = Number(p.cuota);
                  const confianza = Number(p.confianza);
                  const username =
                    (p.profiles as unknown as { username: string } | null)?.username ?? "usuario";
                  const color = avatarColor(username);
                  const initials = username.slice(0, 2).toUpperCase();
                  const bookmakerAccent = getBookmakerAccentFromSources(p.bookmaker, p.copy_link);
                  return (
                    <article
                      key={id}
                      className={[
                        "card pred",
                        i === 1 ? "card--featured" : "",
                        bookmakerAccent?.className ?? "",
                      ].filter(Boolean).join(" ")}
                    >
                      <header className="pred__head">
                        <div className="pred__author">
                          <Link href={`/u/${username}`} className={`avatar avatar--sm avatar--${color}`}>
                            {initials}
                          </Link>
                          <div className="pred__author-meta">
                            <span className="pred__user">{username}</span>
                          </div>
                        </div>
                        <div className="pred__head-actions">
                          {bookmakerAccent && (
                            <span className="pred__bookmaker">{bookmakerAccent.label}</span>
                          )}
                          <span
                            className={
                              estado === "acertada"
                                ? "pill pill--ok"
                                : estado === "fallada"
                                ? "pill pill--bad"
                                : "pill pill--warn"
                            }
                          >
                            <span className="pill__dot" />
                            {estado === "acertada" ? "Acertada" : estado === "fallada" ? "Fallada" : "Pendiente"}
                          </span>
                        </div>
                      </header>
                      <Link href={`/detalle?id=${id}`}>
                        <h3 className="pred__title">{p.evento} · {p.mercado}</h3>
                      </Link>
                      <div className="cluster">
                        <span className="badge">
                          Cuota <span className="mono">{cuota.toFixed(2)}</span>
                        </span>
                        <span className="badge">Confianza {confianza}/5</span>
                      </div>
                    </article>
                  );
                })
              : <article className="card card__pad member-gate">
                  <span className="member-gate__icon">+</span>
                  <div>
                    <h3>{user ? "Todavia no hay picks destacados" : "Crea una cuenta para consultar pronosticos"}</h3>
                    <p>{user ? "Publica el primero desde tu cuenta." : "El feed, las cuotas informativas y los analisis estan disponibles solo para miembros."}</p>
                  </div>
                  {!user && <Link className="btn btn--primary" href="/auth?tab=registro&next=/feed">Registrarme gratis</Link>}
                </article>}
          </div>
        </div>
      </section>

      {topTipsters.length > 0 && (
        <section className="section section--surface">
          <div className="container">
            <div className="section__head">
              <h2>Top tipsters</h2>
              <Link href="/ranking" className="section__link">Ver ranking completo →</Link>
            </div>
            <div className="ranking-grid">
              {topTipsters.map((u, i) => {
                const color = avatarColor(u.username);
                const initials = u.username.slice(0, 2).toUpperCase();
                return (
                  <article className="card rank-card" key={u.username}>
                    <span className="rank-card__pos mono">{i + 1}</span>
                    <Link href={`/u/${u.username}`} className={`avatar avatar--lg avatar--${color}`}>
                      {initials}
                    </Link>
                    <div className="rank-card__body">
                      <div className="rank-card__name">{u.username}</div>
                      <div className="rank-card__sub">{u.total} pronosticos</div>
                    </div>
                    <div className="rank-card__stats">
                      <div className="mono rank-card__profit">{u.acertadas} aciertos</div>
                      <div className="mono muted rank-card__accuracy">{u.acierto}% acierto</div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="section" id="como-funciona">
        <div className="container">
          <div className="section__head">
            <h2>Asi funciona TodosGanamos</h2>
            <span className="mono muted section__eyebrow">3 pasos</span>
          </div>
          <div className="grid grid--3">
            <article className="step">
              <span className="step__num mono">01</span>
              <h3>Publica tu pronostico</h3>
              <p>Elige deporte, partido y mercado. Anade tu cuota y explica por que crees que va a salir.</p>
            </article>
            <article className="step">
              <span className="step__num mono">02</span>
              <h3>La comunidad vota</h3>
              <p>Otros tipsters debaten, comentan y likean tus pronosticos. Los argumentos solidos suben al top.</p>
            </article>
            <article className="step">
              <span className="step__num mono">03</span>
              <h3>Sube en el ranking</h3>
              <p>Si aciertas, ganas reputacion, racha y badges. Sin saldo real: solo reconocimiento.</p>
            </article>
          </div>
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <Link href="/auth?tab=registro" className="btn btn--primary btn--lg">
              Unirme a TodosGanamos →
            </Link>
          </div>
        </div>
      </section>
    </TodosGanamosShell>
  );
}
