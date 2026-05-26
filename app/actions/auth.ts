"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/feed");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = (formData.get("username") as string).toLowerCase().trim();

  if (!username || username.length < 3) {
    return { error: "El nombre de usuario debe tener al menos 3 caracteres." };
  }

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      username,
      display_name: username,
    });

    if (profileError) {
      if (profileError.code === "23505") {
        return { error: "Ese nombre de usuario ya esta en uso." };
      }
      return { error: profileError.message };
    }
  }

  redirect("/feed");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
