"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
};

export function BackButton({ fallbackHref = "/feed", label = "Volver atras" }: BackButtonProps) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button className="back-button" type="button" onClick={goBack}>
      {label}
    </button>
  );
}
