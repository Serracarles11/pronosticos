"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/app/actions/auth";
import { UserAvatar } from "./user-avatar";
import type { User } from "@supabase/supabase-js";

export function HeaderAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("id", user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
          });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (user === undefined) {
    return <div className="header__auth-placeholder" />;
  }

  if (!user) {
    return (
      <>
        <Link className="btn btn--ghost header-auth__login" href="/auth">
          Iniciar sesion
        </Link>
        <Link className="btn btn--primary header-auth__signup" href="/auth?tab=registro">
          Crear cuenta
        </Link>
      </>
    );
  }

  const name = profile?.username || user.email?.split("@")[0] || "yo";

  return (
    <>
      <UserAvatar
        avatarUrl={profile?.avatar_url}
        href="/cuenta"
        linkClassName="header-auth__avatar"
        size="sm"
        title={name}
        username={name}
      />
      <Link className="btn btn--primary header-auth__publish" href="/nuevo">
        + Publicar
      </Link>
      <form action={logout} className="header-auth__logout">
        <button type="submit" className="btn btn--ghost btn--sm">
          Salir
        </button>
      </form>
    </>
  );
}
