import Link from "next/link";

const COLORS = ["blue", "navy", "sky", "steel", "slate", "teal", "indigo", "purple"] as const;

export function avatarColor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

type Props = {
  username: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  href?: string;
  linkClassName?: string;
  title?: string;
};

export function UserAvatar({ username, avatarUrl, size = "md", href, linkClassName, title }: Props) {
  const safeAvatarUrl = avatarUrl?.startsWith("https://") ? avatarUrl : null;
  const content = safeAvatarUrl ? (
    // Avatar URLs are stored as profile data and rendered as a background to keep sizing consistent.
    <span
      aria-label={`Avatar de ${username}`}
      className={`avatar avatar--${size} avatar--image`}
      role="img"
      style={{ backgroundImage: `url(${safeAvatarUrl})` }}
    />
  ) : (
    <span className={`avatar avatar--${size} avatar--${avatarColor(username)}`}>
      {username.slice(0, 2).toUpperCase()}
    </span>
  );

  return href ? (
    <Link aria-label={`Ver perfil de ${username}`} className={linkClassName} href={href} title={title}>
      {content}
    </Link>
  ) : (
    content
  );
}
