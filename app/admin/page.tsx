import Link from "next/link";
import { redirect } from "next/navigation";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { createClient } from "@/lib/supabase/server";
import {
  addBlockedWord,
  deactivateBlockedWord,
  updateFeedbackStatus,
  updateModerationStatus,
  updateReportStatus,
  updateSocialReportStatus,
  updateUserShadowban,
} from "../actions/admin";

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") redirect("/feed");

  const [
    { data: reportes },
    { data: feedback },
    { data: socialReports },
    { data: antiSpamEvents },
    { data: pendingPicks },
    { data: pendingComments },
    { data: shadowbannedUsers },
    { data: blockedWords },
  ] = await Promise.all([
    supabase
      .from("reportes_pronosticos")
      .select(`
        id, motivo, detalle, estado, created_at,
        pronosticos ( id, evento, mercado ),
        profiles!reportes_pronosticos_user_id_fkey ( username )
      `)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("beta_feedback")
      .select("id, categoria, mensaje, page_url, rating, estado, created_at, profiles!beta_feedback_user_id_fkey(username)")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("reportes_sociales")
      .select("id, target_type, target_id, motivo, detalle, estado, created_at, profiles!reportes_sociales_reporter_id_fkey(username)")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("anti_spam_events")
      .select("id, event_type, target_type, severity, reason, created_at, profiles!anti_spam_events_user_id_fkey(username)")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("pronosticos")
      .select("id, evento, mercado, user_id, created_at, profiles!pronosticos_user_id_fkey(username)")
      .eq("moderation_status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("comentarios")
      .select("id, contenido, user_id, created_at, profiles!comentarios_user_id_fkey(username)")
      .eq("moderation_status", "pending_review")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("profiles")
      .select("id, username, display_name, shadowban_reason, shadowbanned_at")
      .eq("is_shadowbanned", true)
      .order("shadowbanned_at", { ascending: false })
      .limit(20),
    supabase
      .from("blocked_words")
      .select("id, word, severity, is_active, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <TodosGanamosShell active="cuenta">
      <main className="container admin-page">
        <header className="saved-page__header">
          <div>
            <span className="badge badge--purple">Admin</span>
            <h1>Moderacion beta</h1>
            <p>Reportes de contenido y feedback operativo para el lanzamiento.</p>
          </div>
          <Link className="btn btn--ghost" href="/cuenta">
            Volver a cuenta
          </Link>
        </header>

        <section className="admin-grid">
          <div className="card card__pad admin-panel">
            <div className="account-panel__head">
              <h2>Anti-spam</h2>
              <p>Eventos recientes, cola de revision, shadowban y palabras bloqueadas.</p>
            </div>

            <div className="admin-list">
              <article className="admin-item">
                <div className="admin-item__head">
                  <strong>Cola de revision</strong>
                  <span className="badge">{(pendingPicks?.length ?? 0) + (pendingComments?.length ?? 0)}</span>
                </div>
                {(pendingPicks ?? []).slice(0, 6).map((pick) => {
                  const author = Array.isArray(pick.profiles) ? pick.profiles[0] : pick.profiles;
                  return (
                    <div className="admin-item__actions" key={pick.id}>
                      <Link className="btn btn--ghost" href={`/detalle?id=${pick.id}`}>
                        {pick.evento}
                      </Link>
                      <span className="muted">@{author?.username ?? "usuario"}</span>
                      {["approved", "rejected", "hidden"].map((status) => (
                        <form action={updateModerationStatus} key={status}>
                          <input type="hidden" name="target" value="pronosticos" />
                          <input type="hidden" name="id" value={pick.id} />
                          <input type="hidden" name="status" value={status} />
                          <button className="btn btn--ghost" type="submit">{status}</button>
                        </form>
                      ))}
                      <form action={updateUserShadowban}>
                        <input type="hidden" name="user_id" value={pick.user_id} />
                        <input type="hidden" name="action" value="shadowban" />
                        <input type="hidden" name="reason" value="Contenido pendiente anti-spam" />
                        <button className="btn btn--ghost" type="submit">Shadowban</button>
                      </form>
                    </div>
                  );
                })}
                {(pendingComments ?? []).slice(0, 6).map((comment) => {
                  const author = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
                  return (
                    <div className="admin-item__actions" key={comment.id}>
                      <span>{String(comment.contenido).slice(0, 70)}</span>
                      <span className="muted">@{author?.username ?? "usuario"}</span>
                      {["approved", "rejected", "hidden"].map((status) => (
                        <form action={updateModerationStatus} key={status}>
                          <input type="hidden" name="target" value="comentarios" />
                          <input type="hidden" name="id" value={comment.id} />
                          <input type="hidden" name="status" value={status} />
                          <button className="btn btn--ghost" type="submit">{status}</button>
                        </form>
                      ))}
                      <form action={updateUserShadowban}>
                        <input type="hidden" name="user_id" value={comment.user_id} />
                        <input type="hidden" name="action" value="shadowban" />
                        <input type="hidden" name="reason" value="Comentario pendiente anti-spam" />
                        <button className="btn btn--ghost" type="submit">Shadowban</button>
                      </form>
                    </div>
                  );
                })}
                {(pendingPicks ?? []).length === 0 && (pendingComments ?? []).length === 0 && (
                  <p className="muted">Sin contenido pendiente.</p>
                )}
              </article>

              <article className="admin-item">
                <div className="admin-item__head">
                  <strong>Eventos recientes</strong>
                  <span className="badge">{antiSpamEvents?.length ?? 0}</span>
                </div>
                {(antiSpamEvents ?? []).slice(0, 8).map((event) => {
                  const owner = Array.isArray(event.profiles) ? event.profiles[0] : event.profiles;
                  return (
                    <p className="muted" key={event.id}>
                      {formatDate(event.created_at)} - {event.event_type} - {event.severity} - @
                      {owner?.username ?? "usuario"}
                    </p>
                  );
                })}
                {(antiSpamEvents ?? []).length === 0 && <p className="muted">Sin eventos recientes.</p>}
              </article>

              <article className="admin-item">
                <div className="admin-item__head">
                  <strong>Usuarios shadowbaneados</strong>
                  <span className="badge">{shadowbannedUsers?.length ?? 0}</span>
                </div>
                {(shadowbannedUsers ?? []).map((shadowUser) => (
                  <div className="admin-item__actions" key={shadowUser.id}>
                    <span>@{shadowUser.username}</span>
                    <span className="muted">{shadowUser.shadowban_reason ?? "Sin motivo"}</span>
                    <form action={updateUserShadowban}>
                      <input type="hidden" name="user_id" value={shadowUser.id} />
                      <input type="hidden" name="action" value="unshadowban" />
                      <button className="btn btn--ghost" type="submit">Quitar shadowban</button>
                    </form>
                  </div>
                ))}
                {(shadowbannedUsers ?? []).length === 0 && <p className="muted">Sin usuarios shadowbaneados.</p>}
              </article>

              <article className="admin-item">
                <div className="admin-item__head">
                  <strong>Palabras bloqueadas</strong>
                  <span className="badge">{blockedWords?.length ?? 0}</span>
                </div>
                <form action={addBlockedWord} className="admin-item__actions">
                  <input className="input" name="word" placeholder="palabra o frase" />
                  <select className="select" name="severity" defaultValue="medium">
                    <option value="low">low</option>
                    <option value="medium">medium</option>
                    <option value="high">high</option>
                  </select>
                  <button className="btn btn--primary" type="submit">Anadir</button>
                </form>
                {(blockedWords ?? []).map((word) => (
                  <div className="admin-item__actions" key={word.id}>
                    <span>{word.word}</span>
                    <span className="badge">{word.severity}</span>
                    <span className="muted">{word.is_active ? "activa" : "inactiva"}</span>
                    {word.is_active && (
                      <form action={deactivateBlockedWord}>
                        <input type="hidden" name="id" value={word.id} />
                        <button className="btn btn--ghost" type="submit">Desactivar</button>
                      </form>
                    )}
                  </div>
                ))}
              </article>
            </div>
          </div>

          <div className="card card__pad admin-panel">
            <div className="account-panel__head">
              <h2>Reportes sociales</h2>
              <p>{socialReports?.length ?? 0} reportes de usuarios, comentarios o redes.</p>
            </div>
            <div className="admin-list">
              {(socialReports ?? []).length === 0 ? (
                <p className="muted">Sin reportes sociales.</p>
              ) : (
                (socialReports ?? []).map((report) => {
                  const reporterData = report.profiles as unknown;
                  const reporter = Array.isArray(reporterData) ? reporterData[0] : reporterData;
                  return (
                    <article className="admin-item" key={report.id}>
                      <div className="admin-item__head">
                        <strong>{report.target_type} - {report.motivo}</strong>
                        <span className="badge">{report.estado}</span>
                      </div>
                      {report.detalle && <p>{report.detalle}</p>}
                      <span className="muted">
                        {formatDate(report.created_at)} - @
                        {typeof reporter === "object" && reporter && "username" in reporter
                          ? String((reporter as Record<string, unknown>).username)
                          : "usuario"}
                      </span>
                      <div className="admin-item__actions">
                        <span className="muted mono">{report.target_id}</span>
                        <form action={updateSocialReportStatus}>
                          <input type="hidden" name="id" value={report.id} />
                          <input type="hidden" name="estado" value="revisado" />
                          <button className="btn btn--primary" type="submit">Revisado</button>
                        </form>
                        <form action={updateSocialReportStatus}>
                          <input type="hidden" name="id" value={report.id} />
                          <input type="hidden" name="estado" value="descartado" />
                          <button className="btn btn--ghost" type="submit">Descartar</button>
                        </form>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="card card__pad admin-panel">
            <div className="account-panel__head">
              <h2>Reportes</h2>
              <p>{reportes?.length ?? 0} ultimos reportes.</p>
            </div>
            <div className="admin-list">
              {(reportes ?? []).length === 0 ? (
                <p className="muted">Sin reportes pendientes.</p>
              ) : (
                (reportes ?? []).map((report) => {
                  const pronosticoData = report.pronosticos as unknown;
                  const pronostico = Array.isArray(pronosticoData)
                    ? pronosticoData[0]
                    : pronosticoData;
                  const reporterData = report.profiles as unknown;
                  const reporter = Array.isArray(reporterData) ? reporterData[0] : reporterData;
                  return (
                    <article className="admin-item" key={report.id}>
                      <div className="admin-item__head">
                        <strong>{report.motivo}</strong>
                        <span className="badge">{report.estado}</span>
                      </div>
                      <p>
                        {typeof pronostico === "object" && pronostico && "evento" in pronostico
                          ? String((pronostico as Record<string, unknown>).evento)
                          : "Pronostico no disponible"}
                      </p>
                      {report.detalle && <p className="muted">{report.detalle}</p>}
                      <span className="muted">
                        {formatDate(report.created_at)} - @
                        {typeof reporter === "object" && reporter && "username" in reporter
                          ? String((reporter as Record<string, unknown>).username)
                          : "usuario"}
                      </span>
                      <div className="admin-item__actions">
                        {typeof pronostico === "object" && pronostico && "id" in pronostico && (
                          <Link
                            className="btn btn--ghost"
                            href={`/detalle?id=${String((pronostico as Record<string, unknown>).id)}`}
                          >
                            Ver
                          </Link>
                        )}
                        <form action={updateReportStatus}>
                          <input type="hidden" name="id" value={report.id} />
                          <input type="hidden" name="estado" value="revisado" />
                          <button className="btn btn--primary" type="submit">
                            Revisado
                          </button>
                        </form>
                        <form action={updateReportStatus}>
                          <input type="hidden" name="id" value={report.id} />
                          <input type="hidden" name="estado" value="descartado" />
                          <button className="btn btn--ghost" type="submit">
                            Descartar
                          </button>
                        </form>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          <div className="card card__pad admin-panel">
            <div className="account-panel__head">
              <h2>Feedback</h2>
              <p>{feedback?.length ?? 0} ultimos envios.</p>
            </div>
            <div className="admin-list">
              {(feedback ?? []).length === 0 ? (
                <p className="muted">Sin feedback todavia.</p>
              ) : (
                (feedback ?? []).map((item) => {
                  const userData = item.profiles as unknown;
                  const feedbackUser = Array.isArray(userData) ? userData[0] : userData;
                  return (
                    <article className="admin-item" key={item.id}>
                      <div className="admin-item__head">
                        <strong>{item.categoria}</strong>
                        <span className="badge">{item.estado}</span>
                      </div>
                      <p>{item.mensaje}</p>
                      <span className="muted">
                        {formatDate(item.created_at)} - {item.rating ?? "-"} / 5 - @
                        {typeof feedbackUser === "object" && feedbackUser && "username" in feedbackUser
                          ? String((feedbackUser as Record<string, unknown>).username)
                          : "anonimo"}
                      </span>
                      {item.page_url && <span className="muted">{item.page_url}</span>}
                      <div className="admin-item__actions">
                        <form action={updateFeedbackStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="estado" value="revisado" />
                          <button className="btn btn--primary" type="submit">
                            Revisado
                          </button>
                        </form>
                        <form action={updateFeedbackStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="estado" value="cerrado" />
                          <button className="btn btn--ghost" type="submit">
                            Cerrar
                          </button>
                        </form>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </main>
    </TodosGanamosShell>
  );
}
