import Image from "next/image";
import type { SocialPlatform } from "@/lib/social-links";

const SOCIAL_ICON_SRC: Partial<Record<SocialPlatform, string>> = {
  instagram: "/instagram-icon.svg",
  tiktok: "/tiktok-icon-dark.svg",
  x: "/x_dark.svg",
};

export function socialIconSrc(platform: SocialPlatform) {
  return SOCIAL_ICON_SRC[platform] ?? null;
}

export function SocialIcon({ platform, size = 18 }: { platform: SocialPlatform; size?: number }) {
  const src = socialIconSrc(platform);
  if (!src) return null;

  return (
    <Image
      alt=""
      aria-hidden="true"
      className="social-icon-img"
      height={size}
      src={src}
      width={size}
    />
  );
}
