"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleLike } from "@/app/actions/pronosticos";
import { Heart } from "@/components/animate-ui/icons/heart";
import { CountUp } from "./count-up";

type Props = {
  pronosticoId: string;
  initialCount: number;
  initialLiked: boolean;
};

export function LikeButton({ pronosticoId, initialCount, initialLiked }: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [previousCount, setPreviousCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (isPending) return;

    const previousLiked = liked;
    const previousValue = count;
    const next = !liked;

    setPreviousCount(previousValue);
    setLiked(next);
    setCount(Math.max(0, previousValue + (next ? 1 : -1)));

    startTransition(async () => {
      const result = await toggleLike(pronosticoId);
      if (result?.error) {
        setPreviousCount(count);
        setLiked(previousLiked);
        setCount(previousValue);
        return;
      }
      if (typeof result?.liked === "boolean") {
        setLiked(result.liked);
      }
      if (typeof result?.count === "number") {
        setPreviousCount(Math.max(0, previousValue + (next ? 1 : -1)));
        setCount(result.count);
      }
      router.refresh();
    });
  }

  return (
    <button
      aria-label={liked ? "Quitar like" : "Dar like"}
      className={`like-button ${liked ? "is-active" : ""}`}
      disabled={isPending}
      onClick={handleClick}
      type="button"
    >
      <Heart
        animate={liked ? "fill" : false}
        animateOnHover
        animation={liked ? "fill" : "default"}
        className="like-button__icon"
        data-liked={liked ? "true" : "false"}
        size={18}
      />
      <CountUp
        className="count-up-text"
        direction={count >= previousCount ? "up" : "down"}
        duration={0.7}
        from={previousCount}
        separator="."
        to={count}
      />
    </button>
  );
}
