"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuthRedirect } from "@/lib/auth-redirect";
import { getPublicSiteOrigin } from "@/lib/site-url";
import { checkBlockedWords, checkRepeatedLinks, logAntiSpamEvent, recordLinkUsage } from "@/lib/anti-spam/server";
import {
  PROFILE_AVATAR_BUCKET,
  profileAvatarStoragePath,
  validateProfileAvatarFile,
} from "@/lib/profile-avatar";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const next = normalizeAuthRedirect(String(formData.get("next") ?? ""));

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect(next);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = (formData.get("username") as string).toLowerCase().trim();
  const next = normalizeAuthRedirect(String(formData.get("next") ?? ""));

  if (!username || username.length < 3) {
    return { error: "El nombre de usuario debe tener al menos 3 caracteres." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getPublicSiteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
      data: {
        username,
        display_name: username,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  let signedUserId = data.user?.id ?? null;
  if (!data.session) {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (loginError) {
      return {
        error:
          "La cuenta se ha creado, pero Supabase requiere confirmar el correo antes de iniciar sesion. Desactiva la confirmacion de email para entrar automaticamente.",
      };
    }
    signedUserId = loginData.user?.id ?? signedUserId;
  }

  if (signedUserId) {
    await supabase.from("profiles").upsert({
      id: signedUserId,
      username,
      display_name: username,
    });
  }

  redirect(next);
}

export async function loginWithGoogle(formData: FormData) {
  const supabase = await createClient();
  const next = normalizeAuthRedirect(String(formData.get("next") ?? ""));
  const origin = getPublicSiteOrigin();
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    const message = error?.message ?? "No se ha podido iniciar sesion con Google.";
    redirect(`/auth?next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`);
  }

  redirect(data.url);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

function accountError(message: string) {
  redirect(`/cuenta?error=${encodeURIComponent(message)}`);
}

function isMissingOptionalSchema(error: { code?: string; message?: string } | null) {
  return (
    error?.code === "PGRST204" ||
    error?.code === "42703" ||
    error?.message?.toLowerCase().includes("schema cache") === true
  );
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
  const countryCode = String(formData.get("country_code") ?? "").trim().toUpperCase();
  const favoriteCompetitions = String(formData.get("favorite_competitions") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
  const favoriteBookmakers = String(formData.get("favorite_bookmakers") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
  const isPrivate = formData.get("is_private") === "on";
  const removeAvatar = formData.get("remove_avatar") === "on";
  const avatar = formData.get("avatar");
  const avatarFile = avatar instanceof File && avatar.size > 0 ? avatar : null;

  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    accountError("El usuario debe tener entre 3 y 24 caracteres: letras, numeros o guion bajo.");
  }

  if (displayName.length > 40) {
    accountError("El nombre publico no puede superar 40 caracteres.");
  }

  if (bio.length > 180) {
    accountError("La bio no puede superar 180 caracteres.");
  }

  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    accountError("Usa un codigo de pais de dos letras, por ejemplo ES.");
  }

  if (avatarFile) {
    const avatarValidation = validateProfileAvatarFile(avatarFile);
    if (!avatarValidation.ok) {
      accountError(avatarValidation.error);
    }
  }

  const linkCheck = await checkRepeatedLinks(supabase, user.id, bio);
  if (!linkCheck.allowed) {
    accountError(linkCheck.error);
  }

  const profileWords = await checkBlockedWords(supabase, `${displayName} ${bio}`);
  if (profileWords.highestSeverity) {
    await logAntiSpamEvent(supabase, {
      userId: user.id,
      eventType: "blocked_word",
      targetType: "profile",
      severity: profileWords.highestSeverity,
      reason: "profile text matched blocked word",
      metadata: { words: profileWords.matches.map((word) => word.word) },
    });
  }
  if (profileWords.highestSeverity === "high") {
    accountError("El perfil incluye palabras bloqueadas.");
  }

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  const avatarPath = profileAvatarStoragePath(user.id);
  let avatarUpdate: { avatar_url?: string | null } = {};

  if (removeAvatar || avatarFile) {
    await supabase.storage.from(PROFILE_AVATAR_BUCKET).remove([avatarPath]);
    avatarUpdate = { avatar_url: null };
  }

  if (avatarFile) {
    const { error: uploadError } = await supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .upload(avatarPath, avatarFile, {
        contentType: avatarFile.type,
        upsert: true,
      });

    if (uploadError) {
      const message = uploadError.message.toLowerCase().includes("bucket")
        ? "No existe el bucket profile-avatars. Aplica la migracion de avatares en Supabase."
        : uploadError.message;
      accountError(message);
    }

    const { data: publicUrlData } = supabase.storage
      .from(PROFILE_AVATAR_BUCKET)
      .getPublicUrl(avatarPath);

    avatarUpdate = {
      avatar_url: `${publicUrlData.publicUrl}?v=${Date.now()}`,
    };
  }

  const baseUpdates = {
    username,
    display_name: displayName || username,
    ...avatarUpdate,
    bio: bio || null,
    is_private: isPrivate,
  };

  let { error } = await supabase
    .from("profiles")
    .update({
      ...baseUpdates,
      country_code: countryCode || null,
      favorite_competitions: favoriteCompetitions,
      favorite_bookmakers: favoriteBookmakers,
    })
    .eq("id", user.id);

  if (isMissingOptionalSchema(error)) {
    ({ error } = await supabase.from("profiles").update(baseUpdates).eq("id", user.id));
  }

  if (error) {
    if (error.code === "23505") {
      accountError("Ese nombre de usuario ya esta en uso.");
    }
    accountError(error.message);
  }

  await recordLinkUsage(supabase, user.id, linkCheck.links, "profile", user.id);

  revalidatePath("/cuenta");
  revalidatePath("/perfil");
  if (currentProfile?.username && currentProfile.username !== username) {
    revalidatePath(`/u/${currentProfile.username}`);
  }
  revalidatePath(`/u/${username}`);
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
