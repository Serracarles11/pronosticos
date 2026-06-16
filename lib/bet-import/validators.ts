function maxFileSizeMb() {
  const value = Number(process.env.BETSLIP_IMPORT_MAX_FILE_MB);
  return Number.isFinite(value) && value > 0 ? value : 5;
}

export const BETSLIP_MAX_FILE_SIZE = 5 * 1024 * 1024;
export const BETSLIP_ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export type BetSlipImageLike = {
  name?: string;
  size: number;
  type: string;
};

export function validateBetSlipImage(file: BetSlipImageLike | null | undefined) {
  if (!file || file.size <= 0) {
    return { ok: false as const, error: "Sube una captura de la apuesta." };
  }

  const maxBytes = maxFileSizeMb() * 1024 * 1024;
  if (file.size > maxBytes) {
    return { ok: false as const, error: `La captura no puede superar ${maxFileSizeMb()} MB.` };
  }

  const mimeType = file.type.toLowerCase();
  if (!BETSLIP_ALLOWED_MIME_TYPES.has(mimeType)) {
    return { ok: false as const, error: "Formato no permitido. Usa PNG, JPG, JPEG o WEBP." };
  }

  const extension = file.name?.split(".").pop()?.toLowerCase();
  if (extension === "svg" || mimeType === "image/svg+xml") {
    return { ok: false as const, error: "No se aceptan SVG por seguridad." };
  }

  return { ok: true as const };
}

export function getSafeBetSlipExtension(file: BetSlipImageLike) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}
