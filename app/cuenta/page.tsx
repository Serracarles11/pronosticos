import Link from "next/link";
import { redirect } from "next/navigation";
import { PulsoShell } from "../components/pulso-shell";
import { createClient } from "@/lib/supabase/server";
import { logout, updateAccount, updatePassword } from "@/app/actions/auth";

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

  const [{ data: profile }, { data: pronosticos }, savedRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, display_name, bio, followers_count, following_count, created_at")
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
  ]);

  if (!profile) {
    redirect("/auth");
  }

  const username = profile.username;
  const displayName = profile.display_name ?? username;
  const color = avatarColor(username);
  const initials = username.slice(0, 2).toUpperCase();
  const message = statusMessage(ok, error);

  const total = pronosticos?.length ?? 0;
  const publicos = pronosticos?.filter((p) => p.visibilidad === "publico").length ?? 0;
  const borradores = pronosticos?.filter((p) => p.visibilidad === "borrador").length ?? 0;
  const acertadas = pronosticos?.filter((p) => p.estado === "acertada").length ?? 0;
  const likesRecibidos =
    pronosticos?.reduce((sum, p) => {
      const likes = p.likes as Array<{ count: number }> | null;
      return sum + (likes?.[0]?.count ?? 0);
    }, 0) ?? 0;

  return (
    <PulsoShell active="cuenta">
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
              <Link className="btn btn--ghost" href={`/perfil?user=${username}`}>
                Ver perfil publico
              </Link>
              <Link className="btn btn--primary" href="/nuevo">
                + Publicar
              </Link>
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

                <button className="btn btn--primary" type="submit">
                  Guardar datos
                </button>
              </form>
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
                  <Link className="btn btn--ghost btn--flex" href="/feed">
                    Feed publico
                  </Link>
                  <span className="badge">Guardados {savedRes.count ?? 0}</span>
                  <span className="badge">Seguidores {profile.followers_count ?? 0}</span>
                  <span className="badge">Siguiendo {profile.following_count ?? 0}</span>
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
    </PulsoShell>
  );
}
