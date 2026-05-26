"use client";

import { useTransition, useState } from "react";
import { toggleLike } from "@/app/actions/pronosticos";

type Props = {
  pronosticoId: string;
  initialCount: number;
  initialLiked: boolean;
};

export function LikeButton({ pronosticoId, initialCount, initialLiked }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    startTransition(() => void toggleLike(pronosticoId));
  }

  return (
    <button
      onClick={handleClick}
      className={liked ? "is-active" : ""}
      aria-label={liked ? "Quitar like" : "Dar like"}
    >
      ♥ {count}
    </button>
  );
}
