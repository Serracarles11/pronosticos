"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/app/actions/auth";
import type { User } from "@supabase/supabase-js";

const COLORS = ["blue", "navy", "sky", "steel", "slate", "teal", "indigo", "purple"] as const;

function avatarColor(username: string) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function HeaderAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [username, setUsername] = useState<string>("");

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setUsername(data.username);
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setUsername("");
    });

    return () => subscription.unsubscribe();
  }, []);

  if (user === undefined) {
    return <div className="header__auth-placeholder" />;
  }

  if (!user) {
    return (
      <>
        <Link className="btn btn--ghost" href="/auth">
          Iniciar sesion
        </Link>
        <Link className="btn btn--primary" href="/auth?tab=registro">
          Crear cuenta
        </Link>
      </>
    );
  }

  const name = username || user.email?.split("@")[0] || "yo";
  const color = avatarColor(name);

  return (
    <>
      <Link href="/perfil" className={`avatar avatar--sm avatar--${color}`} title={name}>
        {initials(name)}
      </Link>
      <Link className="btn btn--primary" href="/nuevo">
        + Publicar
      </Link>
      <form action={logout}>
        <button type="submit" className="btn btn--ghost btn--sm">
          Salir
        </button>
      </form>
    </>
  );
}
