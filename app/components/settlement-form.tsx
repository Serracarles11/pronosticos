"use client";

import { useRef, useState, useTransition } from "react";
import { settlePronostico } from "@/app/actions/pronosticos";

type SettlementFormProps = {
  pronosticoId: string;
};

const MAX_IMAGE_SIDE = 1600;
const WEBP_QUALITY = 0.72;
const JPEG_QUALITY = 0.76;

function fileNameWithoutExtension(name: string) {
  return name.replace(/\.[^.]+$/, "") || "captura";
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}

async function imageToBitmap(file: File) {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo leer la imagen."));
    };
    image.src = url;
  });
}

async function compressImage(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  const source = await imageToBitmap(file);
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return file;
  ctx.drawImage(source, 0, 0, width, height);

  const webpBlob = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  const fallbackBlob =
    webpBlob ?? (await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY));

  if (!fallbackBlob || fallbackBlob.size >= file.size) {
    return file;
  }

  const ext = fallbackBlob.type === "image/webp" ? "webp" : "jpg";
  return new File([fallbackBlob], `${fileNameWithoutExtension(file.name)}.${ext}`, {
    type: fallbackBlob.type,
    lastModified: Date.now(),
  });
}

export function SettlementForm({ pronosticoId }: SettlementFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(estado: "acertada" | "fallada") {
    const form = formRef.current;
    if (!form) return;

    const input = form.elements.namedItem("captura") as HTMLInputElement | null;
    const file = input?.files?.[0];

    setError(null);

    try {
      const formData = new FormData(form);
      formData.set("estado", estado);
      if (file) {
        const optimizedFile = await compressImage(file);
        formData.set("captura", optimizedFile);
      } else {
        formData.delete("captura");
      }

      startTransition(() => {
        void settlePronostico(formData);
      });
    } catch {
      setError("No se pudo optimizar la captura. Prueba con otra imagen.");
    }
  }

  return (
    <form ref={formRef} className="settlement-form">
      <input type="hidden" name="pronostico_id" value={pronosticoId} />
      <div>
        <h3>Cerrar pronostico</h3>
        <p>
          Marca si la apuesta fue acertada o fallada. La captura es opcional.
        </p>
      </div>
      {error && <div className="auth-error">{error}</div>}
      <div className="field">
        <label className="field__label" htmlFor="captura">
          Captura de la apuesta (opcional)
        </label>
        <input
          id="captura"
          name="captura"
          type="file"
          className="input"
          accept="image/*"
        />
        <div className="field__hint">
          Si la adjuntas, se optimiza automaticamente antes de subirla.
        </div>
      </div>
      <div className="settlement-form__actions">
        <button
          className="btn btn--primary"
          type="button"
          disabled={isPending}
          onClick={() => void handleSubmit("acertada")}
        >
          {isPending ? "Guardando..." : "Acertada"}
        </button>
        <button
          className="btn btn--ghost"
          type="button"
          disabled={isPending}
          onClick={() => void handleSubmit("fallada")}
        >
          Fallada
        </button>
      </div>
    </form>
  );
}
