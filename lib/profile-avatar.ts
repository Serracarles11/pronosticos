export const PROFILE_AVATAR_BUCKET = "profile-avatars";
export const PROFILE_AVATAR_MAX_FILE_SIZE = 3 * 1024 * 1024;

const PROFILE_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type AvatarFileLike = {
  size: number;
  type: string;
};

export function validateProfileAvatarFile(file: AvatarFileLike) {
  if (!PROFILE_AVATAR_MIME_TYPES.has(file.type)) {
    return { ok: false, error: "La foto debe ser JPG, PNG o WebP." } as const;
  }

  if (file.size > PROFILE_AVATAR_MAX_FILE_SIZE) {
    return { ok: false, error: "La foto de perfil no puede superar 3 MB." } as const;
  }

  return { ok: true } as const;
}

export function profileAvatarStoragePath(userId: string) {
  return `${userId}/avatar`;
}
