"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { followUser } from "@/app/actions/pronosticos";

type Props = {
  targetUserId: string;
  initialFollowing: boolean;
};

export function FollowButton({ targetUserId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const next = !following;
    setFollowing(next);
    startTransition(async () => {
      const result = await followUser(targetUserId);
      if (result?.error) {
        setFollowing(!next);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={following ? "follow-button is-active" : "follow-button"}
      aria-label={following ? "Dejar de seguir" : "Seguir"}
      title={following ? "Siguiendo" : "Seguir"}
      disabled={isPending}
    >
      <Image
        src={following ? "/follow.svg" : "/unfollow.svg"}
        alt=""
        width={20}
        height={20}
        aria-hidden="true"
      />
    </button>
  );
}
