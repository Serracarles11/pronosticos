import Link from "next/link";
import type { ReactNode } from "react";
import { AppLogo } from "./app-logo";
import { HeaderAuth } from "./header-auth";
import { HeaderSearch } from "./header-search";
import { ShellBetaFeedback, ShellNotificationBell } from "./shell-client-widgets";

type NavKey = "feed" | "partidos" | "ranking" | "perfil" | "cuenta" | "guardados" | "landing";

type TodosGanamosShellProps = {
  active?: NavKey;
  headerAction?: ReactNode;
  searchValue?: string;
  hideFooter?: boolean;
  children: ReactNode;
};

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={active ? "is-active" : undefined}>
      {children}
    </Link>
  );
}

function MobileNavIcon({ name }: { name: "feed" | "ranking" | "publish" | "saved" | "account" }) {
  const paths = {
    feed: <><path d="M4 5h16M4 12h16M4 19h10" /><circle cx="18" cy="19" r="2" /></>,
    ranking: <><path d="M5 20V10h4v10M10 20V4h4v16M15 20v-7h4v7" /></>,
    publish: <><path d="M12 5v14M5 12h14" /></>,
    saved: <path d="M6 4h12v17l-6-4-6 4z" />,
    account: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.9-4 3.6-6 8-6s7.1 2 8 6" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      {paths[name]}
    </svg>
  );
}

function MobileBottomNav({ active }: { active: NavKey }) {
  return (
    <nav aria-label="Navegacion movil" className="mobile-bottom-nav">
      <Link className={active === "feed" ? "is-active" : undefined} href="/feed">
        <MobileNavIcon name="feed" />
        <span>Pronosticos</span>
      </Link>
      <Link className={active === "ranking" ? "is-active" : undefined} href="/ranking">
        <MobileNavIcon name="ranking" />
        <span>Ranking</span>
      </Link>
      <Link className="mobile-bottom-nav__publish" href="/nuevo">
        <span className="mobile-bottom-nav__publish-icon"><MobileNavIcon name="publish" /></span>
        <span>Publicar</span>
      </Link>
      <Link className={active === "guardados" ? "is-active" : undefined} href="/guardados">
        <MobileNavIcon name="saved" />
        <span>Guardados</span>
      </Link>
      <Link className={active === "cuenta" || active === "perfil" ? "is-active" : undefined} href="/cuenta">
        <MobileNavIcon name="account" />
        <span>Cuenta</span>
      </Link>
    </nav>
  );
}

export function TodosGanamosShell({
  active = "landing",
  headerAction,
  searchValue = "",
  hideFooter = false,
  children,
}: TodosGanamosShellProps) {
  const logoHref = active === "landing" ? "/" : "/feed";

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <AppLogo href={logoHref} preload />
          <HeaderSearch initialValue={searchValue} key={searchValue} />
          <nav className="nav">
            <NavLink href="/feed" active={active === "feed"}>
              Pronosticos
            </NavLink>
            <NavLink href="/partidos" active={active === "partidos"}>
              Partidos
            </NavLink>
            <NavLink href="/ranking" active={active === "ranking"}>
              Ranking
            </NavLink>
            <NavLink href="/guardados" active={active === "guardados"}>
              Guardados
            </NavLink>
            <NavLink href="/cuenta" active={active === "cuenta"}>
              Cuenta
            </NavLink>
            {active === "landing" ? <a href="#como-funciona">Como funciona</a> : null}
          </nav>
          <div className="header__right">
            <ShellNotificationBell />
            {headerAction ?? <HeaderAuth />}
          </div>
        </div>
      </header>
      <div className="legal-strip">
        <span>18+</span>
        <span>Sin dinero real</span>
        <span>Juega y debate con responsabilidad</span>
      </div>
      {children}
      <ShellBetaFeedback />
      <MobileBottomNav active={active} />
      {!hideFooter && <footer className="footer">
        <div className="footer__inner">
          <AppLogo href={logoHref} />
          <nav className="footer__nav">
            <Link href="/feed">Feed</Link>
            <Link href="/partidos">Partidos</Link>
            <Link href="/ranking">Ranking</Link>
            <Link href="/terminos">Terminos</Link>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/cookies">Cookies</Link>
            <Link href="/juego-seguro">Juego seguro</Link>
          </nav>
          <span className="footer__legal">
            TodosGanamos - 2026 - +18 - COMUNIDAD SIN DINERO REAL
          </span>
        </div>
      </footer>}
    </>
  );
}
