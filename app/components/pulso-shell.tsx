import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderAuth } from "./header-auth";

type NavKey = "feed" | "ranking" | "perfil" | "landing";

type PulsoShellProps = {
  active?: NavKey;
  headerAction?: ReactNode;
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

export function PulsoShell({
  active = "landing",
  headerAction,
  children,
}: PulsoShellProps) {
  return (
    <>
      <header className="header">
        <div className="header__inner">
          <Link href="/" className="logo">
            <span className="logo__glyph" />
            <span className="logo__word">
              Pulso<span className="logo__dot">.</span>
            </span>
          </Link>
          <div className="search">
            <input
              type="search"
              placeholder="Busca pronosticos, partidos o tipsters..."
            />
          </div>
          <nav className="nav">
            <NavLink href="/feed" active={active === "feed"}>
              Pronosticos
            </NavLink>
            <NavLink href="/ranking" active={active === "ranking"}>
              Ranking
            </NavLink>
            <NavLink href="/perfil" active={active === "perfil"}>
              Tipsters
            </NavLink>
            {active === "landing" ? <a href="#como-funciona">Como funciona</a> : null}
          </nav>
          <div className="header__right">
            {headerAction ?? <HeaderAuth />}
          </div>
        </div>
      </header>
      {children}
      <footer className="footer">
        <div className="footer__inner">
          <Link href="/" className="logo">
            <span className="logo__glyph" />
            <span className="logo__word">
              Pulso<span className="logo__dot">.</span>
            </span>
          </Link>
          <nav className="footer__nav">
            <Link href="/feed">Feed</Link>
            <Link href="/ranking">Ranking</Link>
            <a href="#">Terminos</a>
            <a href="#">Privacidad</a>
          </nav>
          <span className="footer__legal">
            PULSO · 2026 · COMUNIDAD SIN DINERO REAL
          </span>
        </div>
      </footer>
    </>
  );
}
