"use client";

import { useTransition, useState } from "react";
import { followUser } from "@/app/actions/pronosticos";

type Props = {
  targetUserId: string;
  initialFollowing: boolean;
};

export function FollowButton({ targetUserId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [, startTransition] = useTransition();

  function handleClick() {
    const next = !following;
    setFollowing(next);
    startTransition(() => void followUser(targetUserId));
  }

  return (
    <button
      onClick={handleClick}
      className={following ? "btn btn--soft is-active" : "btn btn--soft"}
    >
      {following ? "Siguiendo" : "Seguir"}
    </button>
  );
}
