"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  SOCIAL_PLATFORMS,
  normalizeSocialUrl,
  type SocialLink,
} from "@/lib/social-links";

function accountError(message: string): never {
  redirect(`/cuenta?error=${encodeURIComponent(message)}`);
}

export async function updateSocialLinks(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const links: SocialLink[] = [];
  try {
    SOCIAL_PLATFORMS.forEach((platform, index) => {
      const normalizedUrl = normalizeSocialUrl(
        platform.id,
        String(formData.get(`social_${platform.id}`) ?? "")
      );
      if (!normalizedUrl) return;

      links.push({
        platform: platform.id,
        url: normalizedUrl,
        is_public: formData.get(`social_${platform.id}_public`) === "on",
        sort_order: index,
      });
    });
  } catch (error) {
    accountError(error instanceof Error ? error.message : "Revisa los enlaces sociales.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (links.length > 0) {
    const { error } = await supabase
      .from("user_social_links")
      .upsert(links.map((link) => ({ ...link, user_id: user.id })), {
        onConflict: "user_id,platform",
      });

    if (error) accountError(error.message);
  }

  let deleteQuery = supabase.from("user_social_links").delete().eq("user_id", user.id);
  if (links.length > 0) {
    deleteQuery = deleteQuery.not("platform", "in", `(${links.map((link) => link.platform).join(",")})`);
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) accountError(deleteError.message);

  revalidatePath("/cuenta");
  if (profile?.username) revalidatePath(`/u/${profile.username}`);
  redirect("/cuenta?ok=redes");
}

export async function reportUser(targetUserId: string, motivo: string, detalle: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion para reportar usuarios." };
  if (!targetUserId || user.id === targetUserId) return { error: "No puedes reportar este perfil." };

  const safeReason = motivo.trim();
  const safeDetail = detalle.trim().slice(0, 800);
  if (!["spam", "abuso", "suplantacion", "riesgo", "ilegal", "otro"].includes(safeReason)) {
    return { error: "Selecciona un motivo valido." };
  }

  const { error } = await supabase.from("reportes_sociales").insert({
    reporter_id: user.id,
    target_type: "usuario",
    target_id: targetUserId,
    motivo: safeReason,
    detalle: safeDetail || null,
  });

  if (error?.code === "23505") return { error: "Ya has reportado este perfil." };
  if (error) return { error: error.message };
  return { ok: true };
}

export async function toggleBlockUser(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion para bloquear usuarios." };
  if (!targetUserId || user.id === targetUserId) return { error: "No puedes bloquear este perfil." };

  const { data: existing } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", user.id)
    .eq("blocked_id", targetUserId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId);
    if (error) return { error: error.message };
    return { blocked: false };
  }

  const { error } = await supabase
    .from("user_blocks")
    .insert({ blocker_id: user.id, blocked_id: targetUserId });
  if (error) return { error: error.message };

  await supabase
    .from("seguimientos")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId);
  await supabase
    .from("seguimiento_solicitudes")
    .delete()
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId);

  revalidatePath("/feed");
  return { blocked: true };
}

export async function toggleMuteUser(targetUserId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion para silenciar usuarios." };
  if (!targetUserId || user.id === targetUserId) return { error: "No puedes silenciar este perfil." };

  const { data: existing, error: fetchError } = await supabase
    .from("user_mutes")
    .select("muted_user_id")
    .eq("muter_user_id", user.id)
    .eq("muted_user_id", targetUserId)
    .maybeSingle();

  if (fetchError?.code === "42P01" || fetchError?.message?.toLowerCase().includes("schema cache")) {
    return { error: "La migracion anti-spam aun no esta aplicada." };
  }
  if (fetchError) return { error: fetchError.message };

  if (existing) {
    const { error } = await supabase
      .from("user_mutes")
      .delete()
      .eq("muter_user_id", user.id)
      .eq("muted_user_id", targetUserId);
    if (error) return { error: error.message };
    revalidatePath("/feed");
    revalidatePath("/detalle");
    return { muted: false };
  }

  const { error } = await supabase
    .from("user_mutes")
    .insert({ muter_user_id: user.id, muted_user_id: targetUserId });
  if (error) return { error: error.message };

  revalidatePath("/feed");
  revalidatePath("/detalle");
  return { muted: true };
}
