import Link from "next/link";
import type { ReactNode } from "react";
import { AppLogo } from "./app-logo";
import { HeaderAuth } from "./header-auth";
import { HeaderSearch } from "./header-search";
import { ShellBetaFeedback, ShellNotificationBell } from "./shell-client-widgets";

type NavKey = "feed" | "pronosticos" | "partidos" | "ranking" | "perfil" | "cuenta" | "guardados" | "landing";

type TodosGanamosShellProps = {
  active?: NavKey;
  headerAction?: ReactNode;
  searchValue?: string;
  hideFooter?: boolean;
  children: ReactNode;
};

const WORLDCUP_FLAGS = [
  ["CA", "Canada"],
  ["MX", "Mexico"],
  ["US", "Estados Unidos"],
  ["AU", "Australia"],
  ["IQ", "Irak"],
  ["IR", "Iran"],
  ["JP", "Japon"],
  ["JO", "Jordania"],
  ["KR", "Corea del Sur"],
  ["QA", "Qatar"],
  ["SA", "Arabia Saudi"],
  ["UZ", "Uzbekistan"],
  ["DZ", "Argelia"],
  ["CV", "Cabo Verde"],
  ["CD", "RD Congo"],
  ["CI", "Costa de Marfil"],
  ["EG", "Egipto"],
  ["GH", "Ghana"],
  ["MA", "Marruecos"],
  ["SN", "Senegal"],
  ["ZA", "Sudafrica"],
  ["TN", "Tunez"],
  ["CW", "Curazao"],
  ["HT", "Haiti"],
  ["PA", "Panama"],
  ["AR", "Argentina"],
  ["BR", "Brasil"],
  ["CO", "Colombia"],
  ["EC", "Ecuador"],
  ["PY", "Paraguay"],
  ["UY", "Uruguay"],
  ["NZ", "Nueva Zelanda"],
  ["AT", "Austria"],
  ["BE", "Belgica"],
  ["BA", "Bosnia y Herzegovina"],
  ["HR", "Croacia"],
  ["CZ", "Chequia"],
  ["ENG", "Inglaterra"],
  ["FR", "Francia"],
  ["DE", "Alemania"],
  ["NL", "Paises Bajos"],
  ["NO", "Noruega"],
  ["PT", "Portugal"],
  ["SCO", "Escocia"],
  ["ES", "Espana"],
  ["SE", "Suecia"],
  ["CH", "Suiza"],
  ["TR", "Turquia"],
] as const;

function flagEmoji(code: string) {
  if (code === "ENG") {
    return String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0065, 0xe006e, 0xe0067, 0xe007f);
  }
  if (code === "SCO") {
    return String.fromCodePoint(0x1f3f4, 0xe0067, 0xe0062, 0xe0073, 0xe0063, 0xe0074, 0xe007f);
  }

  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65));
}

function flagImageCode(code: string) {
  if (code === "ENG") return "gb-eng";
  if (code === "SCO") return "gb-sct";
  return code.toLowerCase();
}

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
  const publicNav = active === "landing" || active === "pronosticos";
  const logoHref = publicNav ? "/" : "/feed";
  const pronosticosHref = publicNav ? "/feed" : "/feed";

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <AppLogo href={logoHref} preload />
          <HeaderSearch initialValue={searchValue} key={searchValue} />
          <nav className="nav">
            <NavLink href={pronosticosHref} active={active === "feed" || active === "pronosticos"}>
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
        <div className="legal-strip__flags" aria-hidden="true">
          <div className="legal-strip__flag-track">
            {[...WORLDCUP_FLAGS, ...WORLDCUP_FLAGS].map(([code, label], index) => (
              <span className="legal-strip__flag" key={`${code}-${index}`} title={label}>
                <img
                  alt=""
                  decoding="async"
                  draggable={false}
                  height={28}
                  loading="lazy"
                  src={`https://flagcdn.com/w40/${flagImageCode(code)}.png`}
                  width={40}
                />
                <span className="legal-strip__flag-fallback">{flagEmoji(code)}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="legal-strip__content">
          <span>18+</span>
          <span>Sin dinero real</span>
          <span>Juega y debate con responsabilidad</span>
        </div>
      </div>
      {children}
      <ShellBetaFeedback />
      <MobileBottomNav active={active} />
      {!hideFooter && <footer className="footer">
        <div className="footer__inner">
          <AppLogo href={logoHref} />
          <nav className="footer__nav">
            <Link href="/feed">Pronosticos</Link>
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
