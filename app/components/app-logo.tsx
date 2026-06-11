import Image from "next/image";
import Link from "next/link";

type AppLogoProps = {
  className?: string;
  href?: string;
  preload?: boolean;
};

export function AppLogo({ className = "", href = "/", preload = false }: AppLogoProps) {
  return (
    <Link className={`logo ${className}`.trim()} href={href} aria-label="TodosGanamos">
      <span className="logo__glyph" aria-hidden="true">
        <Image
          alt=""
          className="logo__image"
          height={1254}
          preload={preload}
          sizes="(max-width: 480px) 24px, 32px"
          src="/logo-v2.png"
          width={1254}
        />
      </span>
      <span className="logo__word">
        TodosGanamos<span className="logo__dot">.</span>
      </span>
    </Link>
  );
}
