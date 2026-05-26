"use client";

import { useState, useTransition } from "react";
import { addComentario } from "@/app/actions/pronosticos";

type Props = {
  pronosticoId: string;
  userInitials: string;
  userColor: string;
};

export function CommentForm({ pronosticoId, userInitials, userColor }: Props) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addComentario(pronosticoId, text);
      if (result?.error) {
        setError(result.error);
      } else {
        setText("");
      }
    });
  }

  return (
    <form className="comments__compose" onSubmit={handleSubmit}>
      <span className={`avatar avatar--md avatar--${userColor}`}>{userInitials}</span>
      <input
        className="input"
        placeholder="Aporta tu opinion sobre este pronostico..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isPending}
      />
      <button
        type="submit"
        className="btn btn--primary"
        disabled={isPending || !text.trim()}
      >
        {isPending ? "Enviando..." : "Comentar"}
      </button>
      {error && <p style={{ color: "var(--c-bad, red)", fontSize: 13, marginTop: 4 }}>{error}</p>}
    </form>
  );
}
