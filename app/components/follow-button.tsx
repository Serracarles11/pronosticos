"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { followUser } from "@/app/actions/pronosticos";

type Props = {
  targetUserId: string;
  initialFollowing: boolean;
  initialRequested?: boolean;
};

export function FollowButton({ targetUserId, initialFollowing, initialRequested = false }: Props) {
  const [status, setStatus] = useState<"none" | "following" | "requested">(
    initialFollowing ? "following" : initialRequested ? "requested" : "none"
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const previous = status;
    const next = status === "none" ? "following" : "none";
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const result = await followUser(targetUserId);
      if (result?.error) {
        setStatus(previous);
        setError(result.error);
        return;
      }
      setStatus(result?.following ? "following" : result?.requested ? "requested" : "none");
      router.refresh();
    });
  }

  const following = status === "following";
  const requested = status === "requested";
  const label = following ? "Dejar de seguir" : requested ? "Cancelar solicitud" : "Seguir";
  const text = following ? "Siguiendo" : requested ? "Pendiente" : "Seguir";

  return (
    <span className="follow-button-wrap">
      <button
        type="button"
        onClick={handleClick}
        className={`follow-button ${following ? "is-active" : ""} ${requested ? "is-requested" : ""} ${isPending ? "is-pending" : ""}`.trim()}
        aria-label={label}
        title={requested ? "Solicitud enviada" : following ? "Siguiendo" : "Seguir"}
        disabled={isPending}
      >
        <span className="follow-button__icon" aria-hidden="true">
          {requested ? (
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 6v6l4 2" />
              <circle cx="12" cy="12" r="8" />
            </svg>
          ) : following ? (
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="m5 12 4 4L19 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M12 5v14M5 12h14" />
            </svg>
          )}
        </span>
        <span className="follow-button__text">{text}</span>
      </button>
      {error && <span className="form-hint form-hint--error">{error}</span>}
    </span>
  );
}
