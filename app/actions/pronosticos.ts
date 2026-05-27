"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createPronostico(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/nuevo");
  }

  const action = formData.get("_action") as string;
  const deporte = formData.get("deporte") as string;
  const competicion = formData.get("competicion") as string;
  const evento = formData.get("evento") as string;
  const confianza = parseInt(formData.get("confianza") as string, 10);
  const explicacion = formData.get("explicacion") as string;
  const fechaEvento = formData.get("fecha_evento") as string;
  let visibilidad = formData.get("visibilidad") as string;

  if (action === "borrador") {
    visibilidad = "borrador";
  }

  // Picks: puede venir como JSON (múltiples selecciones) o campo simple
  let mercado: string;
  let cuota: number;

  const picksJson = formData.get("picks_json") as string | null;
  if (picksJson) {
    type PickItem = { mercado: string; cuota: string };
    const picks: PickItem[] = JSON.parse(picksJson);
    if (!picks.length || picks.some((p) => !p.mercado || !p.cuota)) {
      return { error: "Rellena todos los campos de cada seleccion." };
    }
    if (picks.length === 1) {
      mercado = picks[0].mercado;
      cuota = parseFloat(picks[0].cuota);
    } else {
      mercado = picks.map((p) => p.mercado).join(" + ");
      cuota = picks.reduce((acc, p) => acc * parseFloat(p.cuota), 1);
      cuota = Math.round(cuota * 100) / 100;
    }
  } else {
    mercado = formData.get("mercado") as string;
    cuota = parseFloat(formData.get("cuota") as string);
  }

  if (!evento || !mercado || isNaN(cuota) || isNaN(confianza)) {
    return { error: "Rellena todos los campos obligatorios." };
  }

  const { error } = await supabase.from("pronosticos").insert({
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
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/feed");
  revalidatePath("/perfil");
  redirect(action === "borrador" ? "/perfil" : "/feed");
}

export async function toggleLike(pronosticoId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };

  const { data: existing } = await supabase
    .from("likes")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("pronostico_id", pronosticoId)
    .single();

  if (existing) {
    await supabase
      .from("likes")
      .delete()
      .eq("user_id", user.id)
      .eq("pronostico_id", pronosticoId);
  } else {
    await supabase.from("likes").insert({ user_id: user.id, pronostico_id: pronosticoId });
  }

  revalidatePath("/feed");
  revalidatePath("/detalle");
  return { liked: !existing };
}

export async function addComentario(pronosticoId: string, contenido: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };
  if (!contenido.trim()) return { error: "El comentario no puede estar vacio." };

  const { error } = await supabase.from("comentarios").insert({
    user_id: user.id,
    pronostico_id: pronosticoId,
    contenido: contenido.trim(),
  });

  if (error) return { error: error.message };

  revalidatePath("/detalle");
  revalidatePath("/feed");
  return { ok: true };
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
    return { saved: true };
  }
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

  const canSettleAt = new Date(pronostico.fecha_evento).getTime() + 24 * 60 * 60 * 1000;
  if (Date.now() < canSettleAt) {
    settleRedirect(pronosticoId, "Podras cerrar el pronostico 24 horas despues del evento.");
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
    .single();

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
  } else {
    const { error } = await supabase
      .from("seguimientos")
      .insert({ follower_id: user.id, following_id: targetUserId });
    if (error) return { error: error.message };
    revalidatePath("/feed");
    revalidatePath("/ranking");
    revalidatePath("/perfil");
    revalidatePath("/detalle");
    revalidatePath("/cuenta");
    return { following: true };
  }
}
