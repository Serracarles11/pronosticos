import Link from "next/link";
import { redirect } from "next/navigation";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { createClient } from "@/lib/supabase/server";
import { logout, updateAccount, updatePassword } from "@/app/actions/auth";
import { acceptFollowRequest, rejectFollowRequest } from "@/app/actions/pronosticos";
import { updateSocialLinks } from "@/app/actions/social";
import { SOCIAL_PLATFORMS, type SocialLink } from "@/lib/social-links";

const COLORS = ["blue", "navy", "sky", "steel", "slate", "teal", "indigo", "purple"] as const;

function avatarColor(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function formatDate(value?: string | null) {
  if (!value) return "No disponible";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusMessage(ok?: string, error?: string) {
  if (error) return { type: "error" as const, text: error };
  if (ok === "perfil") return { type: "ok" as const, text: "Datos de cuenta actualizados." };
  if (ok === "redes") return { type: "ok" as const, text: "Redes sociales actualizadas." };
  if (ok === "password") return { type: "ok" as const, text: "Contrasena actualizada." };
  return null;
}

export default async function CuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const [{ data: profile }, { data: pronosticos }, savedRes, { data: pendingRequests }, socialLinksRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single(),
    supabase
      .from("pronosticos")
      .select("id, estado, visibilidad, likes(count)")
      .eq("user_id", user.id),
    supabase
      .from("guardados")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("seguimiento_solicitudes")
      .select("follower_id, created_at, profiles!seguimiento_solicitudes_follower_id_fkey(username, display_name)")
      .eq("following_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_social_links")
      .select("id, platform, url, is_public, sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true }),
  ]);

  if (!profile) {
    redirect("/auth");
  }

  const username = profile.username;
  const displayName = profile.display_name ?? username;
  const color = avatarColor(username);
  const initials = username.slice(0, 2).toUpperCase();
  const message = statusMessage(ok, error);
  const socialLinkMap = new Map(
    ((socialLinksRes.data ?? []) as SocialLink[]).map((link) => [link.platform, link])
  );

  const total = pronosticos?.length ?? 0;
  const publicos = pronosticos?.filter((p) => p.visibilidad === "publico").length ?? 0;
  const soloSeguidores = pronosticos?.filter((p) => p.visibilidad === "seguidores").length ?? 0;
  const borradores = pronosticos?.filter((p) => p.visibilidad === "borrador").length ?? 0;
  const acertadas = pronosticos?.filter((p) => p.estado === "acertada").length ?? 0;
  const likesRecibidos =
    pronosticos?.reduce((sum, p) => {
      const likes = p.likes as Array<{ count: number }> | null;
      return sum + (likes?.[0]?.count ?? 0);
    }, 0) ?? 0;

  async function acceptRequest(formData: FormData) {
    "use server";
    await acceptFollowRequest(String(formData.get("requester_id") ?? ""));
  }

  async function rejectRequest(formData: FormData) {
    "use server";
    await rejectFollowRequest(String(formData.get("requester_id") ?? ""));
  }

  return (
    <TodosGanamosShell active="cuenta">
      <main className="account">
        <section className="account__hero">
          <div className="container account__hero-inner">
            <span className={`avatar avatar--xl avatar--${color}`}>{initials}</span>
            <div className="account__identity">
              <h1>Cuenta</h1>
              <p>
                {displayName} <span>@{username}</span>
              </p>
            </div>
            <div className="account__hero-actions">
              <Link className="btn btn--ghost" href={`/u/${username}`}>
                Ver perfil publico
              </Link>
              <Link className="btn btn--primary" href="/nuevo">
                + Publicar
              </Link>
              {profile.role === "admin" && (
                <Link className="btn btn--ghost" href="/admin">
                  Admin
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="container account__body">
          {message && (
            <div className={`account-alert account-alert--${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="account__stats">
            <div className="stat">
              <div className="stat__label">Pronosticos</div>
              <div className="stat__value">{total}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Publicos</div>
              <div className="stat__value">{publicos}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Seguidores</div>
              <div className="stat__value">{soloSeguidores}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Borradores</div>
              <div className="stat__value">{borradores}</div>
            </div>
            <div className="stat stat--ok">
              <div className="stat__label">Acertadas</div>
              <div className="stat__value">{acertadas}</div>
            </div>
            <div className="stat">
              <div className="stat__label">Likes</div>
              <div className="stat__value">{likesRecibidos}</div>
            </div>
          </div>

          <div className="account__grid">
            <section className="card card__pad account-panel">
              <div className="account-panel__head">
                <div>
                  <h2>Datos de perfil</h2>
                  <p>Estos datos aparecen en tu perfil publico y en tus pronosticos.</p>
                </div>
              </div>

              <form action={updateAccount} className="account-form">
                <div className="field">
                  <label className="field__label" htmlFor="display_name">
                    Nombre publico
                  </label>
                  <input
                    id="display_name"
                    name="display_name"
                    className="input"
                    maxLength={40}
                    defaultValue={displayName}
                  />
                </div>

                <div className="publish__grid-2">
                  <div className="field">
                    <label className="field__label" htmlFor="country_code">
                      Pais
                    </label>
                    <input
                      className="input"
                      defaultValue={profile.country_code ?? ""}
                      id="country_code"
                      maxLength={2}
                      name="country_code"
                      placeholder="ES"
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="favorite_competitions">
                      Competiciones favoritas
                    </label>
                    <input
                      className="input"
                      defaultValue={(profile.favorite_competitions ?? []).join(", ")}
                      id="favorite_competitions"
                      name="favorite_competitions"
                      placeholder="LaLiga, Champions League"
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="favorite_bookmakers">
                    Bookmakers favoritos
                  </label>
                  <input
                    className="input"
                    defaultValue={(profile.favorite_bookmakers ?? []).join(", ")}
                    id="favorite_bookmakers"
                    name="favorite_bookmakers"
                    placeholder="Bet365, Winamax"
                  />
                  <div className="field__hint">
                    Solo se muestran como preferencias informativas. TodosGanamos no permite apostar.
                  </div>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="username">
                    Usuario
                  </label>
                  <div className="input-prefix">
                    <span className="input-prefix__at">@</span>
                    <input
                      id="username"
                      name="username"
                      className="input input--prefixed"
                      minLength={3}
                      maxLength={24}
                      pattern="[a-z0-9_]+"
                      defaultValue={username}
                      required
                    />
                  </div>
                  <div className="field__hint">
                    Solo letras minusculas, numeros y guion bajo.
                  </div>
                </div>

                <div className="field">
                  <label className="field__label" htmlFor="bio">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    className="textarea"
                    rows={4}
                    maxLength={180}
                    defaultValue={profile.bio ?? ""}
                  />
                </div>

                <label className="check-field" htmlFor="is_private">
                  <input
                    id="is_private"
                    name="is_private"
                    type="checkbox"
                    defaultChecked={profile.is_private}
                  />
                  <span>
                    <strong>Cuenta privada</strong>
                    <small>Los nuevos seguidores tendran que enviarte una solicitud.</small>
                  </span>
                </label>

                <button className="btn btn--primary" type="submit">
                  Guardar datos
                </button>
              </form>

              <div className="account-panel__divider" />

              <div className="account-panel__head">
                <div>
                  <h2>Redes sociales</h2>
                  <p>Añade enlaces HTTPS y decide cuales aparecen en tu perfil publico.</p>
                </div>
              </div>

              {socialLinksRes.error ? (
                <div className="account-alert account-alert--info">
                  Las redes sociales estaran disponibles al aplicar la migracion social pendiente.
                </div>
              ) : <form action={updateSocialLinks} className="account-form social-settings">
                {SOCIAL_PLATFORMS.map((platform) => {
                  const link = socialLinkMap.get(platform.id);
                  return (
                    <div className="social-settings__row" key={platform.id}>
                      <div className="field">
                        <label className="field__label" htmlFor={`social_${platform.id}`}>
                          {platform.label}
                        </label>
                        <input
                          className="input"
                          defaultValue={link?.url ?? ""}
                          id={`social_${platform.id}`}
                          name={`social_${platform.id}`}
                          placeholder="https://..."
                          type="url"
                        />
                      </div>
                      <label className="check-field social-settings__visibility">
                        <input
                          defaultChecked={link?.is_public ?? true}
                          name={`social_${platform.id}_public`}
                          type="checkbox"
                        />
                        <span><strong>Publica</strong></span>
                      </label>
                    </div>
                  );
                })}
                <button className="btn btn--primary" type="submit">
                  Guardar redes
                </button>
              </form>}
            </section>

            <aside className="account__side">
              <section className="card card__pad account-panel">
                <div className="account-panel__head">
                  <div>
                    <h2>Datos de acceso</h2>
                    <p>Correo, sesion y seguridad de tu cuenta.</p>
                  </div>
                </div>

                <dl className="account-details">
                  <div>
                    <dt>Email</dt>
                    <dd>{user.email}</dd>
                  </div>
                  <div>
                    <dt>Cuenta creada</dt>
                    <dd>{formatDate(user.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Ultimo acceso</dt>
                    <dd>{formatDate(user.last_sign_in_at)}</dd>
                  </div>
                </dl>
              </section>

              <section className="card card__pad account-panel">
                <div className="account-panel__head">
                  <div>
                    <h2>Cambiar contrasena</h2>
                    <p>Usa al menos 8 caracteres.</p>
                  </div>
                </div>

                <form action={updatePassword} className="account-form">
                  <div className="field">
                    <label className="field__label" htmlFor="password">
                      Nueva contrasena
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      className="input"
                      minLength={8}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="confirm_password">
                      Repetir contrasena
                    </label>
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      type="password"
                      className="input"
                      minLength={8}
                      required
                    />
                  </div>
                  <button className="btn btn--ghost" type="submit">
                    Actualizar contrasena
                  </button>
                </form>
              </section>

              <section className="card card__pad account-panel">
                <div className="account-panel__head">
                  <div>
                    <h2>Ajustes de actividad</h2>
                    <p>Accesos rapidos a lo que gestionas a menudo.</p>
                  </div>
                </div>

                <div className="account-actions">
                  <Link className="btn btn--ghost btn--flex" href="/perfil">
                    Mis pronosticos
                  </Link>
                  <Link className="btn btn--ghost btn--flex" href="/guardados">
                    Guardados
                  </Link>
                  <Link className="btn btn--ghost btn--flex" href="/feed">
                    Feed publico
                  </Link>
                  <span className="badge">Guardados {savedRes.count ?? 0}</span>
                  <span className="badge">Seguidores {profile.followers_count ?? 0}</span>
                  <span className="badge">Siguiendo {profile.following_count ?? 0}</span>
                </div>
              </section>

              <section className="card card__pad account-panel">
                <div className="account-panel__head">
                  <div>
                    <h2>Beta launch</h2>
                    <p>Estado rapido de lo necesario para probar con usuarios.</p>
                  </div>
                </div>
                <div className="beta-checklist">
                  <span className="is-done">Perfil completo</span>
                  <span className={total > 0 ? "is-done" : ""}>Primer pronostico</span>
                  <span className={profile.is_private ? "is-done" : ""}>Privacidad configurada</span>
                  <span className="is-done">Feedback activo</span>
                </div>
              </section>

              <section className="card card__pad account-panel">
                <div className="account-panel__head">
                  <div>
                    <h2>Solicitudes</h2>
                    <p>Aprueba quien puede seguir una cuenta privada.</p>
                  </div>
                </div>

                <div className="request-list">
                  {(pendingRequests ?? []).length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      No tienes solicitudes pendientes.
                    </p>
                  ) : (
                    (pendingRequests ?? []).map((request) => {
                      const requesterData = request.profiles as unknown as
                        | {
                            username: string;
                            display_name: string | null;
                          }
                        | Array<{
                            username: string;
                            display_name: string | null;
                          }>
                        | null;
                      const requester = Array.isArray(requesterData)
                        ? requesterData[0] ?? null
                        : requesterData;
                      const requesterProfile = requester as {
                        username: string;
                        display_name: string | null;
                      } | null;
                      const requesterName = requesterProfile?.username ?? "usuario";
                      return (
                        <div className="request-row" key={request.follower_id}>
                          <div>
                            <strong>@{requesterName}</strong>
                            <span>{requesterProfile?.display_name ?? requesterName}</span>
                          </div>
                          <div className="request-row__actions">
                            <form action={acceptRequest}>
                              <input type="hidden" name="requester_id" value={request.follower_id} />
                              <button className="btn btn--primary" type="submit">
                                Aceptar
                              </button>
                            </form>
                            <form action={rejectRequest}>
                              <input type="hidden" name="requester_id" value={request.follower_id} />
                              <button className="btn btn--ghost" type="submit">
                                Rechazar
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <form action={logout}>
                <button className="btn btn--ghost btn--flex account__logout" type="submit">
                  Cerrar sesion
                </button>
              </form>
            </aside>
          </div>
        </section>
      </main>
    </TodosGanamosShell>
  );
}
