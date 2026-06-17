"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeBetCopyLink, normalizePickCategories } from "@/lib/pronostico-meta";
import {
  localizeFootballCompetitionName,
  localizeFootballTeamName,
} from "@/lib/football-data/localize";
import {
  notifyFollowCreated,
  notifyFollowRequestAccepted,
  notifyFollowRequestCreated,
  notifyFollowersAboutPronostico,
  notifyPronosticoCommented,
  notifyPronosticoLiked,
  notifyPronosticoSaved,
  notifyPronosticoSettled,
} from "@/lib/notifications/events";
import {
  buildEventKey,
  checkCommentRateLimit,
  checkFollowRateLimit,
  checkMaxPicksPerMatch,
  checkPickRateLimit,
  isMissingOptionalSchema,
  recordLinkUsage,
  reviewContentForSpam,
} from "@/lib/anti-spam/server";
import { canSettlePronostico } from "@/lib/pronostico-settlement";

export async function createPronostico(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/nuevo");
  }

  const action = formData.get("_action") as string;
  let deporte = formData.get("deporte") as string;
  let competicion = formData.get("competicion") as string;
  let evento = formData.get("evento") as string;
  const confianza = parseInt(formData.get("confianza") as string, 10);
  const explicacion = formData.get("explicacion") as string;
  let fechaEvento = formData.get("fecha_evento") as string;
  const eventId = String(formData.get("event_id") ?? "").trim();
  let footballMatchId = String(formData.get("football_match_id") ?? "").trim();
  let footballMatchExternalId = String(formData.get("football_match_external_id") ?? "").trim();
  const bookmaker = String(formData.get("bookmaker") ?? "").trim().slice(0, 40);
  const stakeSimulado = parseFloat(String(formData.get("stake_simulado") ?? "1"));
  let copyLink: string | null = null;
  try {
    copyLink = normalizeBetCopyLink(formData.get("copy_link"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Revisa el enlace para copiar la apuesta." };
  }
  const categorias = normalizePickCategories(formData.get("categorias"));
  let visibilidad = formData.get("visibilidad") as string;

  if (action === "borrador") {
    visibilidad = "borrador";
  }

  if (!["publico", "seguidores", "borrador"].includes(visibilidad)) {
    visibilidad = "publico";
  }

  if (footballMatchId) {
    const { data: footballMatch } = await supabase
      .from("football_matches")
      .select("id, external_id, home_team_name, away_team_name, competition_name, kickoff_at")
      .eq("id", footballMatchId)
      .maybeSingle();

    if (footballMatch) {
      footballMatchExternalId = footballMatch.external_id;
      deporte = "Futbol";
      competicion = localizeFootballCompetitionName(footballMatch.competition_name) ?? competicion;
      evento = `${localizeFootballTeamName(footballMatch.home_team_name)} vs ${localizeFootballTeamName(
        footballMatch.away_team_name
      )}`;
      fechaEvento = footballMatch.kickoff_at;
    }
  }

  // Picks: puede venir como JSON (múltiples selecciones) o campo simple
  let mercado: string;
  let cuota: number;

  const picksJson = formData.get("picks_json") as string | null;
  if (picksJson) {
    type PickItem = {
      mercado: string;
      seleccion?: string;
      cuota: string;
      eventName?: string;
      competition?: string;
      kickoffAt?: string;
      footballMatchId?: string;
      footballMatchExternalId?: string;
    };
    const picks: PickItem[] = JSON.parse(picksJson);
    if (!picks.length || picks.some((p) => !p.mercado || !p.cuota)) {
      return { error: "Rellena todos los campos de cada seleccion." };
    }
    const cleanPicks = picks.map((pick) => ({
      mercado: String(pick.mercado ?? "").trim(),
      seleccion: String(pick.seleccion ?? "").trim(),
      cuota: String(pick.cuota ?? "").trim().replace(",", "."),
      eventName: String(pick.eventName ?? "").trim(),
      competition: String(pick.competition ?? "").trim(),
      kickoffAt: String(pick.kickoffAt ?? "").trim(),
      footballMatchId: String(pick.footballMatchId ?? "").trim(),
      footballMatchExternalId: String(pick.footballMatchExternalId ?? "").trim(),
    }));
    const pickEvents = Array.from(new Set(cleanPicks.map((pick) => pick.eventName).filter(Boolean)));
    const pickCompetitions = Array.from(
      new Set(cleanPicks.map((pick) => pick.competition).filter(Boolean))
    );
    const pickKickoffs = cleanPicks
      .map((pick) => (pick.kickoffAt ? new Date(pick.kickoffAt).getTime() : NaN))
      .filter(Number.isFinite);

    if (picks.length === 1) {
      const pick = cleanPicks[0];
      mercado = [pick.mercado, pick.seleccion].filter(Boolean).join(": ");
      cuota = parseFloat(pick.cuota);
      if (pick.eventName) evento = pick.eventName;
      if (pick.competition) competicion = pick.competition;
      if (pick.kickoffAt) fechaEvento = pick.kickoffAt;
      if (pick.footballMatchId) footballMatchId = pick.footballMatchId;
      if (pick.footballMatchExternalId) footballMatchExternalId = pick.footballMatchExternalId;
    } else {
      mercado = cleanPicks
        .map((pick) => [pick.eventName, [pick.mercado, pick.seleccion].filter(Boolean).join(": ")].filter(Boolean).join(": "))
        .join(" + ");
      cuota = cleanPicks.reduce((acc, pick) => acc * parseFloat(pick.cuota), 1);
      cuota = Math.round(cuota * 100) / 100;
      if (pickEvents.length > 0) {
        evento = pickEvents.length <= 2 ? pickEvents.join(" + ") : `Combinada (${pickEvents.length} partidos)`;
      }
      if (pickCompetitions.length === 1) {
        competicion = pickCompetitions[0];
      } else if (pickCompetitions.length > 1) {
        competicion = "Combinada";
      }
      if (pickKickoffs.length > 0) {
        fechaEvento = new Date(Math.max(...pickKickoffs)).toISOString();
      }
      footballMatchId = "";
      footballMatchExternalId = "";
    }
  } else {
    mercado = formData.get("mercado") as string;
    cuota = parseFloat(formData.get("cuota") as string);
  }

  if (!evento || !mercado || isNaN(cuota) || isNaN(confianza)) {
    return { error: "Rellena todos los campos obligatorios." };
  }

  if (!Number.isFinite(stakeSimulado) || stakeSimulado < 0.1 || stakeSimulado > 100) {
    return { error: "El stake simulado debe estar entre 0.1 y 100 unidades." };
  }

  const eventKey = buildEventKey({ eventId, deporte, competicion, evento, fechaEvento });
  const pickRateLimit = await checkPickRateLimit(supabase, user.id);
  if (!pickRateLimit.allowed) return { error: pickRateLimit.error };

  const matchLimit = await checkMaxPicksPerMatch(supabase, user.id, eventKey);
  if (!matchLimit.allowed) return { error: matchLimit.error };

  const spamReview = await reviewContentForSpam(supabase, {
    userId: user.id,
    text: explicacion,
    targetType: "pronostico",
  });
  if (!spamReview.allowed) return { error: spamReview.error };

  const basePick = {
    user_id: user.id,
    deporte,
    competicion,
    evento,
    mercado,
    cuota,
    confianza,
    explicacion,
    fecha_evento: fechaEvento || null,
    visibilidad: visibilidad || "publico",
  };

  const pickWithReferenceData = {
    ...basePick,
    football_match_id: footballMatchId || null,
    football_match_external_id: footballMatchExternalId || null,
    bookmaker: bookmaker || null,
    stake_simulado: stakeSimulado,
    cuota_tomada_at: new Date().toISOString(),
    copy_link: copyLink,
    categorias,
    event_key: eventKey || null,
    moderation_status: spamReview.moderationStatus,
  };

  let { data: insertedPick, error } = await supabase
    .from("pronosticos")
    .insert(pickWithReferenceData)
    .select("id")
    .maybeSingle();

  if (isMissingOptionalSchema(error)) {
    const missingSchemaMessage = error?.message ?? "";
    const missingReferenceDataColumn =
      missingSchemaMessage.includes("bookmaker") ||
      missingSchemaMessage.includes("stake_simulado") ||
      missingSchemaMessage.includes("cuota_tomada_at");

    if (!missingReferenceDataColumn) {
      return {
        error:
          "Falta actualizar la base de datos para guardar el link. Ejecuta supabase/14_pronostico_copy_categories.sql en Supabase.",
      };
    }

    const pickWithoutReferenceData = {
      ...basePick,
      football_match_id: footballMatchId || null,
      football_match_external_id: footballMatchExternalId || null,
      copy_link: copyLink,
      categorias,
      event_key: eventKey || null,
      moderation_status: spamReview.moderationStatus,
    };

    ({ data: insertedPick, error } = await supabase
      .from("pronosticos")
      .insert(pickWithoutReferenceData)
      .select("id")
      .maybeSingle());
  }

  if (error) {
    return { error: error.message };
  }

  await recordLinkUsage(supabase, user.id, spamReview.links, "pronostico", insertedPick?.id ?? null);
  if (insertedPick?.id) {
    await notifyFollowersAboutPronostico(insertedPick.id);
  }

  revalidatePath("/feed");
  revalidatePath("/perfil");
  redirect(action === "borrador" ? "/perfil" : "/feed");
}

export async function deletePronostico(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const pronosticoId = String(formData.get("pronostico_id") ?? "");
  if (!pronosticoId) redirect("/perfil");

  const { data: pronostico, error: fetchError } = await supabase
    .from("pronosticos")
    .select("id, user_id, resultado_captura_path")
    .eq("id", pronosticoId)
    .maybeSingle();

  if (fetchError || !pronostico) {
    redirect(`/perfil?error=${encodeURIComponent("No se ha encontrado el pronostico.")}`);
  }

  if (pronostico.user_id !== user.id) {
    redirect(`/detalle?id=${pronosticoId}&error=${encodeURIComponent("Solo el autor puede eliminar este pronostico.")}`);
  }

  const { error: deleteError } = await supabase
    .from("pronosticos")
    .delete()
    .eq("id", pronosticoId)
    .eq("user_id", user.id);

  if (deleteError) {
    redirect(`/detalle?id=${pronosticoId}&error=${encodeURIComponent(deleteError.message)}`);
  }

  if (pronostico.resultado_captura_path) {
    await supabase.storage
      .from("capturas-pronosticos")
      .remove([pronostico.resultado_captura_path]);
  }

  revalidatePath("/feed");
  revalidatePath("/perfil");
  revalidatePath("/ranking");
  revalidatePath("/guardados");
  redirect("/perfil?ok=eliminado");
}

export async function updatePronosticoCopyLink(pronosticoId: string, copyLinkValue: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };

  let copyLink: string | null = null;
  try {
    copyLink = normalizeBetCopyLink(copyLinkValue);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Revisa el enlace de la apuesta." };
  }

  if (!copyLink) {
    return { error: "Añade un enlace HTTPS para copiar la apuesta." };
  }

  const { data: pronostico, error: fetchError } = await supabase
    .from("pronosticos")
    .select("id, user_id")
    .eq("id", pronosticoId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!pronostico) return { error: "No se ha encontrado el pronostico." };
  if (pronostico.user_id !== user.id) {
    return { error: "Solo el autor puede editar el link de esta apuesta." };
  }

  const { error } = await supabase
    .from("pronosticos")
    .update({ copy_link: copyLink })
    .eq("id", pronosticoId)
    .eq("user_id", user.id);

  if (isMissingOptionalSchema(error)) {
    return {
      error:
        "Falta actualizar la base de datos para guardar el link. Ejecuta supabase/14_pronostico_copy_categories.sql en Supabase.",
    };
  }

  if (error) return { error: error.message };

  revalidatePath("/detalle");
  revalidatePath("/feed");
  return { ok: true, copyLink };
}

export async function toggleLike(pronosticoId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };

  const { data: existing, error: existingError } = await supabase
    .from("likes")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("pronostico_id", pronosticoId)
    .maybeSingle();

  if (existingError) return { error: existingError.message };

  let liked = false;
  if (existing) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", user.id)
      .eq("pronostico_id", pronosticoId);
    if (error) return { error: error.message };
    liked = false;
  } else {
    const { error } = await supabase.from("likes").insert({ user_id: user.id, pronostico_id: pronosticoId });
    if (error) {
      if (error.code !== "23505") return { error: error.message };
    }
    liked = true;
    await notifyPronosticoLiked(pronosticoId, user.id);
  }

  const { count } = await supabase
    .from("likes")
    .select("user_id", { count: "exact", head: true })
    .eq("pronostico_id", pronosticoId);

  revalidatePath("/feed");
  revalidatePath("/detalle");
  return { liked, count: count ?? null };
}

export async function addComentario(pronosticoId: string, contenido: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };
  if (!contenido.trim()) return { error: "El comentario no puede estar vacio." };

  const rateLimit = await checkCommentRateLimit(supabase, user.id);
  if (!rateLimit.allowed) return { error: rateLimit.error };

  const spamReview = await reviewContentForSpam(supabase, {
    userId: user.id,
    text: contenido,
    targetType: "comentario",
  });
  if (!spamReview.allowed) return { error: spamReview.error };

  let { data: insertedComment, error } = await supabase.from("comentarios").insert({
    user_id: user.id,
    pronostico_id: pronosticoId,
    contenido: contenido.trim(),
    moderation_status: spamReview.moderationStatus,
  }).select("id").maybeSingle();

  if (isMissingOptionalSchema(error)) {
    ({ data: insertedComment, error } = await supabase.from("comentarios").insert({
      user_id: user.id,
      pronostico_id: pronosticoId,
      contenido: contenido.trim(),
    }).select("id").maybeSingle());
  }

  if (error) return { error: error.message };

  await recordLinkUsage(supabase, user.id, spamReview.links, "comentario", insertedComment?.id ?? null);
  if (insertedComment?.id) {
    await notifyPronosticoCommented(pronosticoId, insertedComment.id, user.id);
  }

  revalidatePath("/detalle");
  revalidatePath("/feed");
  return { ok: true, pending: spamReview.moderationStatus === "pending_review" };
}

export async function savePronostico(pronosticoId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };

  const { data: existing } = await supabase
    .from("guardados")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("pronostico_id", pronosticoId)
    .single();

  if (existing) {
    await supabase
      .from("guardados")
      .delete()
      .eq("user_id", user.id)
      .eq("pronostico_id", pronosticoId);
    return { saved: false };
  } else {
    const { error } = await supabase
      .from("guardados")
      .insert({ user_id: user.id, pronostico_id: pronosticoId });
    if (error) return { error: error.message };
    await notifyPronosticoSaved(pronosticoId, user.id);
    return { saved: true };
  }
}

export async function reportPronostico(
  pronosticoId: string,
  motivo: string,
  detalle: string
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion para reportar contenido." };

  const motivoLimpio = motivo.trim();
  const detalleLimpio = detalle.trim().slice(0, 800);
  const motivosValidos = ["spam", "abuso", "riesgo", "ilegal", "otro"];

  if (!pronosticoId || !motivosValidos.includes(motivoLimpio)) {
    return { error: "Selecciona un motivo valido." };
  }

  const { data: pronostico } = await supabase
    .from("pronosticos")
    .select("id")
    .eq("id", pronosticoId)
    .maybeSingle();

  if (!pronostico) {
    return { error: "No se ha encontrado el pronostico." };
  }

  const { error } = await supabase.from("reportes_pronosticos").insert({
    pronostico_id: pronosticoId,
    user_id: user.id,
    motivo: motivoLimpio,
    detalle: detalleLimpio || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya has enviado un reporte para este pronostico." };
    }
    return { error: error.message };
  }

  revalidatePath("/detalle");
  return { ok: true };
}

export async function submitBetaFeedback(
  categoria: string,
  mensaje: string,
  pageUrl: string,
  rating: number
) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const categoriaLimpia = categoria.trim();
  const mensajeLimpio = mensaje.trim().slice(0, 1200);
  const categoriasValidas = ["bug", "idea", "ux", "contenido", "otro"];
  const safeRating = Number.isFinite(rating) ? Math.min(Math.max(Math.round(rating), 1), 5) : null;

  if (!categoriasValidas.includes(categoriaLimpia)) {
    return { error: "Elige una categoria valida." };
  }

  if (mensajeLimpio.length < 8) {
    return { error: "Cuentanos un poco mas para poder entender el feedback." };
  }

  const { error } = await supabase.from("beta_feedback").insert({
    user_id: user?.id ?? null,
    categoria: categoriaLimpia,
    mensaje: mensajeLimpio,
    page_url: pageUrl.slice(0, 500) || null,
    rating: safeRating,
  });

  if (error) return { error: error.message };

  return { ok: true };
}

function settleRedirect(pronosticoId: string, message: string): never {
  redirect(`/detalle?id=${pronosticoId}&error=${encodeURIComponent(message)}`);
}

export async function settlePronostico(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pronosticoId = String(formData.get("pronostico_id") ?? "");
  const estado = String(formData.get("estado") ?? "");
  const captura = formData.get("captura");

  if (!user) redirect("/auth");
  if (!pronosticoId) redirect("/feed");
  if (estado !== "acertada" && estado !== "fallada") {
    settleRedirect(pronosticoId, "Elige si el pronostico fue acertado o fallado.");
  }

  if (!(captura instanceof File) || captura.size === 0) {
    settleRedirect(pronosticoId, "Sube una captura de la apuesta para cerrar el resultado.");
  }

  const capturaFile = captura as File;

  if (!capturaFile.type.startsWith("image/")) {
    settleRedirect(pronosticoId, "La captura debe ser una imagen.");
  }

  if (capturaFile.size > 5 * 1024 * 1024) {
    settleRedirect(pronosticoId, "La captura no puede superar 5 MB.");
  }

  const { data: pronostico, error: fetchError } = await supabase
    .from("pronosticos")
    .select("id, user_id, estado, fecha_evento")
    .eq("id", pronosticoId)
    .single();

  if (fetchError || !pronostico) {
    settleRedirect(pronosticoId, "No se ha encontrado el pronostico.");
  }

  if (pronostico.user_id !== user.id) {
    settleRedirect(pronosticoId, "Solo el autor puede cerrar este pronostico.");
  }

  if (pronostico.estado !== "pendiente") {
    settleRedirect(pronosticoId, "Este pronostico ya esta cerrado.");
  }

  if (!pronostico.fecha_evento) {
    settleRedirect(pronosticoId, "Este pronostico no tiene fecha de evento.");
  }

  if (!canSettlePronostico(pronostico.fecha_evento, pronostico.estado)) {
    settleRedirect(pronosticoId, "Podras cerrar el pronostico cuando haya pasado la hora del partido.");
  }

  const rawExt = capturaFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ext = /^[a-z0-9]+$/.test(rawExt) ? rawExt : "jpg";
  const path = `${user.id}/${pronosticoId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("capturas-pronosticos")
    .upload(path, capturaFile, {
      contentType: capturaFile.type,
      upsert: false,
    });

  if (uploadError) {
    settleRedirect(pronosticoId, uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from("capturas-pronosticos")
    .getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("pronosticos")
    .update({
      estado,
      resultado_captura_path: path,
      resultado_captura_url: publicUrlData.publicUrl,
      resultado_reportado_at: new Date().toISOString(),
    })
    .eq("id", pronosticoId)
    .eq("user_id", user.id);

  if (updateError) {
    settleRedirect(pronosticoId, updateError.message);
  }

  await notifyPronosticoSettled(pronosticoId, estado);

  revalidatePath("/detalle");
  revalidatePath("/feed");
  revalidatePath("/perfil");
  revalidatePath("/ranking");
  redirect(`/detalle?id=${pronosticoId}`);
}

export async function followUser(targetUserId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };
  if (user.id === targetUserId) return { error: "No puedes seguirte a ti mismo." };

  const { data: existing } = await supabase
    .from("seguimientos")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("seguimientos")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);
    revalidatePath("/feed");
    revalidatePath("/ranking");
    revalidatePath("/perfil");
    revalidatePath("/detalle");
    revalidatePath("/cuenta");
    return { following: false };
  }

  const { data: existingRequest } = await supabase
    .from("seguimiento_solicitudes")
    .select("follower_id")
    .eq("follower_id", user.id)
    .eq("following_id", targetUserId)
    .maybeSingle();

  if (existingRequest) {
    await supabase
      .from("seguimiento_solicitudes")
      .delete()
      .eq("follower_id", user.id)
      .eq("following_id", targetUserId);
    revalidatePath("/feed");
    revalidatePath("/ranking");
    revalidatePath("/perfil");
    revalidatePath("/detalle");
    revalidatePath("/cuenta");
    return { following: false, requested: false };
  }

  const { data: targetProfile, error: profileError } = await supabase
    .from("profiles")
    .select("id, is_private")
    .eq("id", targetUserId)
    .single();

  if (profileError || !targetProfile) {
    return { error: "Usuario no encontrado." };
  }

  if (targetProfile.is_private) {
    const rateLimit = await checkFollowRateLimit(supabase, user.id);
    if (!rateLimit.allowed) return { error: rateLimit.error };

    const { error } = await supabase
      .from("seguimiento_solicitudes")
      .insert({ follower_id: user.id, following_id: targetUserId });
    if (error) return { error: error.message };
    await notifyFollowRequestCreated(targetUserId, user.id);
    revalidatePath("/feed");
    revalidatePath("/ranking");
    revalidatePath("/perfil");
    revalidatePath("/detalle");
    revalidatePath("/cuenta");
    return { following: false, requested: true };
  }

  const rateLimit = await checkFollowRateLimit(supabase, user.id);
  if (!rateLimit.allowed) return { error: rateLimit.error };

  const { error } = await supabase
    .from("seguimientos")
    .insert({ follower_id: user.id, following_id: targetUserId });
  if (error) return { error: error.message };
  await notifyFollowCreated(targetUserId, user.id);
  revalidatePath("/feed");
  revalidatePath("/ranking");
  revalidatePath("/perfil");
  revalidatePath("/detalle");
  revalidatePath("/cuenta");
  return { following: true, requested: false };
}

export async function acceptFollowRequest(requesterId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };

  const { error: insertError } = await supabase
    .from("seguimientos")
    .insert({ follower_id: requesterId, following_id: user.id });

  if (insertError && insertError.code !== "23505") {
    return { error: insertError.message };
  }

  const { error: deleteError } = await supabase
    .from("seguimiento_solicitudes")
    .delete()
    .eq("follower_id", requesterId)
    .eq("following_id", user.id);

  if (deleteError) return { error: deleteError.message };

  await notifyFollowRequestAccepted(requesterId, user.id);

  revalidatePath("/cuenta");
  revalidatePath("/perfil");
  revalidatePath("/feed");
  return { ok: true };
}

export async function rejectFollowRequest(requesterId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };

  const { error } = await supabase
    .from("seguimiento_solicitudes")
    .delete()
    .eq("follower_id", requesterId)
    .eq("following_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/cuenta");
  revalidatePath("/perfil");
  return { ok: true };
}
