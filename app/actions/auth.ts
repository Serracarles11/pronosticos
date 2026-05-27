"use server";

import { revalidatePath } from "next/cache";
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

function accountError(message: string) {
  redirect(`/cuenta?error=${encodeURIComponent(message)}`);
}

export async function updateAccount(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const username = String(formData.get("username") ?? "").toLowerCase().trim();
  const displayName = String(formData.get("display_name") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    accountError("El usuario debe tener entre 3 y 24 caracteres: letras, numeros o guion bajo.");
  }

  if (displayName.length > 40) {
    accountError("El nombre publico no puede superar 40 caracteres.");
  }

  if (bio.length > 180) {
    accountError("La bio no puede superar 180 caracteres.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      display_name: displayName || username,
      bio: bio || null,
    })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      accountError("Ese nombre de usuario ya esta en uso.");
    }
    accountError(error.message);
  }

  revalidatePath("/cuenta");
  revalidatePath("/perfil");
  redirect("/cuenta?ok=perfil");
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password.length < 8) {
    accountError("La nueva contrasena debe tener al menos 8 caracteres.");
  }

  if (password !== confirmPassword) {
    accountError("Las contrasenas no coinciden.");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    accountError(error.message);
  }

  redirect("/cuenta?ok=password");
}
