"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { login, signup } from "@/app/actions/auth";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "registro">("login");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleLogin(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  async function handleSignup(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await signup(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="auth-layout">
      {/* Panel izquierdo — branding */}
      <div className="auth-panel auth-panel--left">
        <Link href="/" className="logo auth-panel__logo">
          <span className="logo__glyph" />
          <span className="logo__word">
            Pulso<span className="logo__dot">.</span>
          </span>
        </Link>

        <div className="auth-panel__copy">
          <h2>La comunidad de tipsters mas transparente.</h2>
          <p>
            Publica tus pronosticos, comparte tu razonamiento y sube en el
            ranking basandote en tus aciertos reales. Sin dinero real.
          </p>
        </div>

        <ul className="auth-features">
          <li className="auth-feature">
            <span className="auth-feature__icon">📊</span>
            <div>
              <strong>Estadisticas reales</strong>
              <span>Tu historial de aciertos visible para todos</span>
            </div>
          </li>
          <li className="auth-feature">
            <span className="auth-feature__icon">🏆</span>
            <div>
              <strong>Ranking por meritos</strong>
              <span>Solo suben los que de verdad aciertan</span>
            </div>
          </li>
          <li className="auth-feature">
            <span className="auth-feature__icon">💬</span>
            <div>
              <strong>Debate argumentado</strong>
              <span>Comenta, vota y aprende de los mejores</span>
            </div>
          </li>
        </ul>

        <div className="auth-panel__quote">
          <p>"Llevo 3 meses en Pulso y mi tasa de acierto ha subido un 12% solo por tener que argumentar cada pronostico."</p>
          <div className="auth-panel__quote-author">
            <span className="avatar avatar--sm avatar--navy">LR</span>
            <div>
              <strong>LauraRivas</strong>
              <span className="muted">Top tipster · Futbol</span>
            </div>
          </div>
        </div>
      </div>

      {/* Panel derecho — formulario */}
      <div className="auth-panel auth-panel--right">
        <div className="auth-box">
          <div className="auth-box__header">
            <h1 className="auth-box__title">
              {tab === "login" ? "Bienvenido de vuelta" : "Crea tu cuenta"}
            </h1>
            <p className="auth-box__sub">
              {tab === "login"
                ? "Inicia sesion para ver tus pronosticos y el ranking."
                : "Unete gratis. Sin tarjeta, sin dinero real."}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              className={`auth-tab ${tab === "login" ? "is-active" : ""}`}
              onClick={() => { setTab("login"); setError(null); }}
            >
              Iniciar sesion
            </button>
            <button
              className={`auth-tab ${tab === "registro" ? "is-active" : ""}`}
              onClick={() => { setTab("registro"); setError(null); }}
            >
              Crear cuenta
            </button>
          </div>

          {error && (
            <div className="auth-error">
              <span className="auth-error__icon">!</span>
              {error}
            </div>
          )}

          {tab === "login" ? (
            <form action={handleLogin} className="auth-form">
              <div className="field">
                <label className="field__label" htmlFor="login-email">
                  Correo electronico
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  className="input"
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="login-password">
                  Contrasena
                </label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                className="btn btn--primary btn--lg btn--flex auth-submit"
                disabled={isPending}
              >
                {isPending ? (
                  <span className="auth-spinner" />
                ) : null}
                {isPending ? "Entrando..." : "Entrar a Pulso"}
              </button>

              <p className="auth-switch">
                ¿No tienes cuenta?{" "}
                <button
                  type="button"
                  className="auth-switch__link"
                  onClick={() => { setTab("registro"); setError(null); }}
                >
                  Registrate gratis
                </button>
              </p>
            </form>
          ) : (
            <form action={handleSignup} className="auth-form">
              <div className="field">
                <label className="field__label" htmlFor="reg-username">
                  Nombre de usuario
                </label>
                <div className="input-prefix">
                  <span className="input-prefix__at">@</span>
                  <input
                    id="reg-username"
                    name="username"
                    type="text"
                    className="input input--prefixed"
                    placeholder="tipster_pro"
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[a-zA-Z0-9_]+"
                    autoComplete="username"
                  />
                </div>
                <div className="field__hint">
                  Solo letras, numeros y guion bajo. Minimo 3 caracteres.
                </div>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="reg-email">
                  Correo electronico
                </label>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  className="input"
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="reg-password">
                  Contrasena
                </label>
                <input
                  id="reg-password"
                  name="password"
                  type="password"
                  className="input"
                  placeholder="Minimo 6 caracteres"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
                <div className="field__hint">Minimo 6 caracteres.</div>
              </div>
              <button
                type="submit"
                className="btn btn--primary btn--lg btn--flex auth-submit"
                disabled={isPending}
              >
                {isPending ? <span className="auth-spinner" /> : null}
                {isPending ? "Creando cuenta..." : "Crear cuenta gratis"}
              </button>

              <p className="auth-switch">
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  className="auth-switch__link"
                  onClick={() => { setTab("login"); setError(null); }}
                >
                  Inicia sesion
                </button>
              </p>
            </form>
          )}

          <p className="auth-legal">
            Al continuar aceptas los{" "}
            <a href="#">Terminos de uso</a> y la{" "}
            <a href="#">Politica de privacidad</a>.
            Pulso es una comunidad sin dinero real.
          </p>
        </div>
      </div>
    </div>
  );
}
