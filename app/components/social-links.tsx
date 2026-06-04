import { normalizeSocialUrl, socialPlatformLabel, type SocialLink } from "@/lib/social-links";
import { SocialIcon, socialIconSrc } from "./social-icon";

function iconText(platform: SocialLink["platform"]) {
  if (platform === "instagram") return "IG";
  return platform.toUpperCase().slice(0, 2);
}

export function SocialLinks({ links }: { links: SocialLink[] }) {
  const safeLinks = links
    .map((link) => {
      try {
        return { ...link, url: normalizeSocialUrl(link.platform, link.url) };
      } catch {
        return null;
      }
    })
    .filter((link): link is SocialLink => !!link?.url && link.is_public)
    .sort((a, b) => a.sort_order - b.sort_order);

  if (safeLinks.length === 0) return null;

  return (
    <div className="social-links">
      {safeLinks.map((link) => (
        <a
          className="social-link"
          href={link.url}
          key={link.platform}
          rel="noopener noreferrer"
          target="_blank"
        >
          {socialIconSrc(link.platform) ? (
            <SocialIcon platform={link.platform} />
          ) : (
            <span>{iconText(link.platform)}</span>
          )}
          {socialPlatformLabel(link.platform)}
        </a>
      ))}
    </div>
  );
}
