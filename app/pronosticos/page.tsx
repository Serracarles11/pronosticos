import type { Metadata } from "next";
import Link from "next/link";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { createClient } from "@/lib/supabase/server";
import { filterVisibleItemsForModeration } from "@/lib/anti-spam/pure";
import { isMissingOptionalSchema } from "@/lib/anti-spam/server";

export const metadata: Metadata = {
  title: "Pronósticos deportivos gratis | TodosGanamos",
  description:
    "Consulta pronósticos deportivos gratuitos de la comunidad, descubre picks, cuotas informativas y sigue a los mejores tipsters en TodosGanamos.",
  alternates: {
    canonical: "https://todosganamos.es/pronosticos",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const COLORS = ["blue", "navy", "sky", "steel", "slate", "teal", "indigo", "purple"] as const;

type PublicPronostico = {
  id: string;
  user_id: string;
  evento: string;
  mercado: string;
  cuota: number;
  confianza: number;
  estado: string;
  competicion: string | null;
  created_at: string;
  profiles: unknown;
  moderation_status?: "approved" | "pending_review" | "rejected" | "hidden" | null;
  is_shadowbanned?: boolean | null;
};

function avatarColor(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function estadoLabel(estado: string) {
  if (estado === "acertada") return "Acertada";
  if (estado === "fallada") return "Fallada";
  return "Pendiente";
}

function estadoClassName(estado: string) {
  if (estado === "acertada") return "pill pill--ok";
  if (estado === "fallada") return "pill pill--bad";
  return "pill pill--warn";
}

export default async function PronosticosPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pronosticos")
    .select(`
      id, user_id, evento, mercado, cuota, confianza, estado, competicion, created_at,
      profiles!pronosticos_user_id_fkey(username, display_name, is_shadowbanned)
    `)
    .eq("visibilidad", "publico")
    .order("created_at", { ascending: false })
    .limit(12);

  let pronosticos = (data ?? []) as PublicPronostico[];

  if (pronosticos.length > 0) {
    const { data: moderationRows, error: moderationError } = await supabase
      .from("pronosticos")
      .select("id, moderation_status")
      .in("id", pronosticos.map((item) => item.id));

    if (!isMissingOptionalSchema(moderationError) && !moderationError) {
      const moderationById = new Map(
        (moderationRows ?? []).map((row) => [row.id, row.moderation_status])
      );
      pronosticos = pronosticos.map((item) => ({
        ...item,
        moderation_status: moderationById.get(item.id) ?? "approved",
      }));
    }

    pronosticos = filterVisibleItemsForModeration(
      pronosticos.map((item) => {
        const profile = item.profiles as { is_shadowbanned?: boolean } | null;
        return { ...item, is_shadowbanned: !!profile?.is_shadowbanned };
      }),
      null,
      new Set(),
      false
    );
  }

  return (
    <TodosGanamosShell active="pronosticos">
      <main>
        <section className="section">
          <div className="container">
            <div className="saved-page__header">
              <div>
                <span className="badge badge--purple">Comunidad +18</span>
                <h1>Pronósticos deportivos gratis</h1>
                <p>
                  Consulta pronósticos deportivos de la comunidad, descubre picks con cuotas
                  informativas y sigue la actividad de tipsters en TodosGanamos.
                </p>
              </div>
              <div className="hero__cta">
                <Link className="btn btn--primary btn--lg" href="/ranking">
                  Ver ranking
                </Link>
                <Link className="btn btn--ghost btn--lg" href="/partidos">
                  Ver partidos
                </Link>
              </div>
            </div>

            <div className="responsible-note" style={{ marginBottom: 24 }}>
              <strong>+18</strong>
              <span>
                TodosGanamos es una comunidad informativa. No se apuesta dinero real ni se
                aceptan depósitos dentro de la app.
              </span>
            </div>

            <div className="section__head">
              <h2>Pronósticos públicos recientes</h2>
              <Link className="section__link" href="/auth?tab=registro&next=/feed">
                Crear cuenta para participar →
              </Link>
            </div>

            {pronosticos.length > 0 ? (
              <div className="grid grid--3">
                {pronosticos.slice(0, 6).map((pronostico) => {
                  const profile = pronostico.profiles as { username: string } | null;
                  const username = profile?.username ?? "usuario";
                  const initials = username.slice(0, 2).toUpperCase();
                  const color = avatarColor(username);

                  return (
                    <article className="card pred" key={pronostico.id}>
                      <header className="pred__head">
                        <div className="pred__author">
                          <span className={`avatar avatar--sm avatar--${color}`}>
                            {initials}
                          </span>
                          <div className="pred__author-meta">
                            <span className="pred__user">{username}</span>
                            <span className="pred__sub">
                              {pronostico.competicion ?? "Pronóstico"}
                            </span>
                          </div>
                        </div>
                        <span className={estadoClassName(pronostico.estado)}>
                          <span className="pill__dot" />
                          {estadoLabel(pronostico.estado)}
                        </span>
                      </header>

                      <h3 className="pred__title">{pronostico.evento}</h3>
                      <div className="pred__strip">
                        <div className="pred__cell">
                          <div className="pred__cell-label">Pronóstico</div>
                          <div className="pred__cell-value">{pronostico.mercado}</div>
                        </div>
                        <div className="pred__cell pred__cell--accent">
                          <div className="pred__cell-label">Cuota</div>
                          <div className="pred__cell-value mono">
                            {Number(pronostico.cuota).toFixed(2)}
                          </div>
                        </div>
                        <div className="pred__cell">
                          <div className="pred__cell-label">Confianza</div>
                          <div className="pred__cell-value">{pronostico.confianza}/5</div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <article className="card card__pad member-gate">
                <span className="member-gate__icon">+</span>
                <div>
                  <h2>Pronto habrá más pronósticos públicos</h2>
                  <p>
                    Mientras tanto puedes consultar el ranking de tipsters o revisar los
                    próximos partidos disponibles.
                  </p>
                </div>
              </article>
            )}
          </div>
        </section>
      </main>
    </TodosGanamosShell>
  );
}
