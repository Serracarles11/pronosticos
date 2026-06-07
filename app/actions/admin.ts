"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getDefaultFootballSyncRange, syncFootballMatches } from "@/lib/football-data/sync";
import {
  notifyFollowersAboutPronostico,
  notifyPronosticoCommented,
} from "@/lib/notifications/events";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") throw new Error("No autorizado.");

  return supabase;
}

export async function updateReportStatus(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");

  if (!["pendiente", "revisado", "descartado"].includes(estado)) {
    throw new Error("Estado invalido.");
  }

  const { error: updateError } = await supabase
    .from("reportes_pronosticos")
    .update({ estado })
    .eq("id", id);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/admin");
}

export async function updateFeedbackStatus(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");

  if (!["nuevo", "revisado", "cerrado"].includes(estado)) {
    throw new Error("Estado invalido.");
  }

  const { error: updateError } = await supabase
    .from("beta_feedback")
    .update({ estado })
    .eq("id", id);

  if (updateError) throw new Error(updateError.message);

  revalidatePath("/admin");
}

export async function updateSocialReportStatus(formData: FormData) {
  const supabase = await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const estado = String(formData.get("estado") ?? "");

  if (!["pendiente", "revisado", "descartado"].includes(estado)) {
    throw new Error("Estado invalido.");
  }

  const { error } = await supabase
    .from("reportes_sociales")
    .update({ estado })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function updateModerationStatus(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const target = String(formData.get("target") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!["pronosticos", "comentarios"].includes(target)) throw new Error("Contenido invalido.");
  if (!["approved", "pending_review", "rejected", "hidden"].includes(status)) throw new Error("Estado invalido.");

  if (target === "pronosticos") {
    const { data: before } = await supabase
      .from("pronosticos")
      .select("id, moderation_status")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase
      .from("pronosticos")
      .update({ moderation_status: status })
      .eq("id", id);
    if (error) throw new Error(error.message);
    if (status === "approved" && before?.moderation_status !== "approved") {
      await notifyFollowersAboutPronostico(id);
    }
  } else {
    const { data: before } = await supabase
      .from("comentarios")
      .select("id, pronostico_id, user_id, moderation_status")
      .eq("id", id)
      .maybeSingle();
    const { error } = await supabase
      .from("comentarios")
      .update({ moderation_status: status })
      .eq("id", id);
    if (error) throw new Error(error.message);
    if (status === "approved" && before?.moderation_status !== "approved" && before) {
      await notifyPronosticoCommented(String(before.pronostico_id), id, String(before.user_id));
    }
  }

  revalidatePath("/admin");
  revalidatePath("/feed");
  revalidatePath("/ranking");
  revalidatePath("/detalle");
}

export async function updateUserShadowban(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 300);

  if (!userId) throw new Error("Usuario invalido.");
  const shadowban = action === "shadowban";

  const { error } = await supabase
    .from("profiles")
    .update({
      is_shadowbanned: shadowban,
      shadowban_reason: shadowban ? reason || "Revision anti-spam" : null,
      shadowbanned_at: shadowban ? new Date().toISOString() : null,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/feed");
  revalidatePath("/ranking");
}

export async function addBlockedWord(formData: FormData) {
  const supabase = await requireAdmin();
  const word = String(formData.get("word") ?? "").trim().toLowerCase();
  const severity = String(formData.get("severity") ?? "medium");

  if (word.length < 2 || word.length > 80) throw new Error("Palabra invalida.");
  if (!["low", "medium", "high"].includes(severity)) throw new Error("Severidad invalida.");

  const { error } = await supabase
    .from("blocked_words")
    .upsert({ word, severity, is_active: true }, { onConflict: "word" });

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function deactivateBlockedWord(formData: FormData) {
  const supabase = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const { error } = await supabase
    .from("blocked_words")
    .update({ is_active: false })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function syncFootballMatchesNow() {
  const supabase = await requireAdmin();
  const range = getDefaultFootballSyncRange();
  await syncFootballMatches({ ...range, supabase });
  revalidatePath("/admin");
  revalidatePath("/partidos");
  revalidatePath("/nuevo");
}
