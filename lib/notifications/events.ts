import { isMissingOptionalSchema } from "@/lib/anti-spam/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

type ProfileLite = {
  id?: string;
  username?: string | null;
  display_name?: string | null;
};

type PronosticoLite = {
  id: string;
  user_id: string;
  evento: string | null;
  mercado: string | null;
  cuota: number | string | null;
  estado?: string | null;
  visibilidad?: string | null;
  moderation_status?: string | null;
};

type NotificationInput = {
  user_id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  href?: string | null;
  actor_id?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  dedupe_key?: string | null;
  metadata_json?: Record<string, unknown>;
};

function getNotificationAdminClient() {
  try {
    return createAdminClient();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[notifications] disabled:",
        error instanceof Error ? error.message : "missing admin client"
      );
    }
    return null;
  }
}

function uniqueRows(rows: NotificationInput[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (!row.user_id || row.user_id === row.actor_id) return false;
    const key = `${row.user_id}:${row.dedupe_key ?? `${row.tipo}:${row.href ?? ""}:${row.mensaje}`}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function baseNotification(row: NotificationInput) {
  return {
    user_id: row.user_id,
    tipo: row.tipo,
    titulo: row.titulo,
    mensaje: row.mensaje,
    href: row.href ?? null,
  };
}

function supportsBaseNotificationFallback(error: { code?: string; message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    isMissingOptionalSchema(error) ||
    error?.code === "42P10" ||
    message.includes("no unique or exclusion constraint")
  );
}

async function insertNotifications(rows: NotificationInput[]) {
  const admin = getNotificationAdminClient();
  const unique = uniqueRows(rows);
  if (!admin || unique.length === 0) return;

  const expandedRows = unique.map((row) => ({
    ...baseNotification(row),
    actor_id: row.actor_id ?? null,
    entity_type: row.entity_type ?? null,
    entity_id: row.entity_id ?? null,
    dedupe_key: row.dedupe_key ?? null,
    metadata_json: row.metadata_json ?? {},
  }));

  const { error } = await admin
    .from("notificaciones")
    .upsert(expandedRows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });

  if (!error) return;

  if (!supportsBaseNotificationFallback(error)) {
    console.error("[notifications] insert failed", error.message);
    return;
  }

  const { error: fallbackError } = await admin
    .from("notificaciones")
    .insert(unique.map(baseNotification));

  if (fallbackError && !isMissingOptionalSchema(fallbackError)) {
    console.error("[notifications] fallback insert failed", fallbackError.message);
  }
}

async function getProfile(admin: AdminClient, userId: string): Promise<ProfileLite | null> {
  const { data } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .eq("id", userId)
    .maybeSingle();

  return (data as ProfileLite | null) ?? null;
}

function actorName(profile: ProfileLite | null) {
  if (profile?.username) return `@${profile.username}`;
  if (profile?.display_name) return profile.display_name;
  return "Alguien";
}

function profileHref(profile: ProfileLite | null) {
  return profile?.username ? `/u/${profile.username}` : "/feed";
}

function formatCuota(value: PronosticoLite["cuota"]) {
  const cuota = Number(value);
  return Number.isFinite(cuota) ? cuota.toFixed(2) : "--";
}

function pronosticoMessage(pronostico: PronosticoLite) {
  const evento = pronostico.evento?.trim() || "Nuevo pronostico";
  return `${evento} - cuota ${formatCuota(pronostico.cuota)}`;
}

function isPubliclyNotifiable(pronostico: PronosticoLite) {
  if (pronostico.visibilidad === "borrador") return false;
  return (pronostico.moderation_status ?? "approved") === "approved";
}

async function getPronostico(admin: AdminClient, pronosticoId: string): Promise<PronosticoLite | null> {
  const selectWithModeration = "id, user_id, evento, mercado, cuota, estado, visibilidad, moderation_status";
  const { data, error } = await admin
    .from("pronosticos")
    .select(selectWithModeration)
    .eq("id", pronosticoId)
    .maybeSingle();

  if (isMissingOptionalSchema(error)) {
    const retry = await admin
      .from("pronosticos")
      .select("id, user_id, evento, mercado, cuota, estado, visibilidad")
      .eq("id", pronosticoId)
      .maybeSingle();
    if (retry.error || !retry.data) return null;
    return retry.data as PronosticoLite;
  }

  if (error || !data) return null;
  return data as PronosticoLite;
}

async function getFollowerIds(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("seguimientos")
    .select("follower_id")
    .eq("following_id", userId)
    .limit(500);

  if (error) return [];
  return Array.from(new Set((data ?? []).map((row) => row.follower_id as string).filter(Boolean)));
}

async function getInteractionUserIds(admin: AdminClient, pronosticoId: string) {
  const [likes, guardados, comentarios] = await Promise.all([
    admin.from("likes").select("user_id").eq("pronostico_id", pronosticoId).limit(500),
    admin.from("guardados").select("user_id").eq("pronostico_id", pronosticoId).limit(500),
    admin.from("comentarios").select("user_id").eq("pronostico_id", pronosticoId).limit(500),
  ]);

  return Array.from(
    new Set(
      [
        ...(likes.data ?? []),
        ...(guardados.data ?? []),
        ...(comentarios.data ?? []),
      ].map((row) => row.user_id as string).filter(Boolean)
    )
  );
}

async function filterAllowedRecipients(admin: AdminClient, actorId: string, recipientIds: string[]) {
  const recipients = Array.from(new Set(recipientIds.filter((id) => id && id !== actorId)));
  if (recipients.length === 0) return [];

  const blocked = new Set<string>();

  const [mutedRes, blockedActorRes, blockedByActorRes] = await Promise.all([
    admin
      .from("user_mutes")
      .select("muter_user_id")
      .eq("muted_user_id", actorId)
      .in("muter_user_id", recipients),
    admin
      .from("user_blocks")
      .select("blocker_id")
      .eq("blocked_id", actorId)
      .in("blocker_id", recipients),
    admin
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", actorId)
      .in("blocked_id", recipients),
  ]);

  if (!mutedRes.error || !isMissingOptionalSchema(mutedRes.error)) {
    for (const row of mutedRes.data ?? []) blocked.add(row.muter_user_id as string);
  }
  if (!blockedActorRes.error || !isMissingOptionalSchema(blockedActorRes.error)) {
    for (const row of blockedActorRes.data ?? []) blocked.add(row.blocker_id as string);
  }
  if (!blockedByActorRes.error || !isMissingOptionalSchema(blockedByActorRes.error)) {
    for (const row of blockedByActorRes.data ?? []) blocked.add(row.blocked_id as string);
  }

  return recipients.filter((id) => !blocked.has(id));
}

export async function notifyFollowersAboutPronostico(pronosticoId: string) {
  const admin = getNotificationAdminClient();
  if (!admin) return;

  const pronostico = await getPronostico(admin, pronosticoId);
  if (!pronostico || !isPubliclyNotifiable(pronostico)) return;

  const [author, followers] = await Promise.all([
    getProfile(admin, pronostico.user_id),
    getFollowerIds(admin, pronostico.user_id),
  ]);
  const recipients = await filterAllowedRecipients(admin, pronostico.user_id, followers);
  const name = actorName(author);

  await insertNotifications(
    recipients.map((userId) => ({
      user_id: userId,
      tipo: "nuevo_pronostico_seguido",
      titulo: `Nueva cuota de ${name}`,
      mensaje: pronosticoMessage(pronostico),
      href: `/detalle?id=${pronostico.id}`,
      actor_id: pronostico.user_id,
      entity_type: "pronostico",
      entity_id: pronostico.id,
      dedupe_key: `pronostico-seguido:${pronostico.id}`,
      metadata_json: { cuota: pronostico.cuota, evento: pronostico.evento },
    }))
  );
}

export async function notifyPronosticoLiked(pronosticoId: string, actorId: string) {
  const admin = getNotificationAdminClient();
  if (!admin) return;

  const pronostico = await getPronostico(admin, pronosticoId);
  if (!pronostico || pronostico.user_id === actorId) return;

  const actor = await getProfile(admin, actorId);
  const [recipient] = await filterAllowedRecipients(admin, actorId, [pronostico.user_id]);
  if (!recipient) return;

  await insertNotifications([
    {
      user_id: recipient,
      tipo: "like_pronostico",
      titulo: `${actorName(actor)} le dio corazon a tu pronostico`,
      mensaje: pronosticoMessage(pronostico),
      href: `/detalle?id=${pronostico.id}`,
      actor_id: actorId,
      entity_type: "pronostico",
      entity_id: pronostico.id,
      dedupe_key: `like:${pronostico.id}:${actorId}`,
    },
  ]);
}

export async function notifyPronosticoSaved(pronosticoId: string, actorId: string) {
  const admin = getNotificationAdminClient();
  if (!admin) return;

  const pronostico = await getPronostico(admin, pronosticoId);
  if (!pronostico || pronostico.user_id === actorId) return;

  const actor = await getProfile(admin, actorId);
  const [recipient] = await filterAllowedRecipients(admin, actorId, [pronostico.user_id]);
  if (!recipient) return;

  await insertNotifications([
    {
      user_id: recipient,
      tipo: "guardado_pronostico",
      titulo: `${actorName(actor)} guardo tu pronostico`,
      mensaje: pronosticoMessage(pronostico),
      href: `/detalle?id=${pronostico.id}`,
      actor_id: actorId,
      entity_type: "pronostico",
      entity_id: pronostico.id,
      dedupe_key: `guardado:${pronostico.id}:${actorId}`,
    },
  ]);
}

export async function notifyPronosticoCommented(
  pronosticoId: string,
  comentarioId: string,
  actorId: string
) {
  const admin = getNotificationAdminClient();
  if (!admin) return;

  const [pronostico, actor, commentRes] = await Promise.all([
    getPronostico(admin, pronosticoId),
    getProfile(admin, actorId),
    admin
      .from("comentarios")
      .select("id, user_id, moderation_status")
      .eq("id", comentarioId)
      .maybeSingle(),
  ]);
  if (!pronostico) return;

  const comment = commentRes.data as { moderation_status?: string | null } | null;
  if ((comment?.moderation_status ?? "approved") !== "approved") return;

  const interactionIds = await getInteractionUserIds(admin, pronosticoId);
  const recipients = await filterAllowedRecipients(admin, actorId, [
    pronostico.user_id,
    ...interactionIds,
  ]);
  const name = actorName(actor);

  await insertNotifications(
    recipients.map((userId) => ({
      user_id: userId,
      tipo: userId === pronostico.user_id ? "comentario_pronostico" : "comentario_hilo",
      titulo:
        userId === pronostico.user_id
          ? `${name} comento tu pronostico`
          : "Nuevo comentario en un pronostico que sigues",
      mensaje: pronosticoMessage(pronostico),
      href: `/detalle?id=${pronostico.id}#comentarios`,
      actor_id: actorId,
      entity_type: "comentario",
      entity_id: comentarioId,
      dedupe_key: `comentario:${comentarioId}`,
    }))
  );
}

export async function notifyPronosticoSettled(pronosticoId: string, estado: "acertada" | "fallada" | string) {
  const admin = getNotificationAdminClient();
  if (!admin) return;

  const pronostico = await getPronostico(admin, pronosticoId);
  if (!pronostico) return;

  const [author, followers, interactions] = await Promise.all([
    getProfile(admin, pronostico.user_id),
    getFollowerIds(admin, pronostico.user_id),
    getInteractionUserIds(admin, pronostico.id),
  ]);
  const recipients = await filterAllowedRecipients(admin, pronostico.user_id, [
    ...followers,
    ...interactions,
  ]);

  await insertNotifications(
    recipients.map((userId) => ({
      user_id: userId,
      tipo: "resultado_pronostico",
      titulo: `${actorName(author)} marco un pronostico como ${estado}`,
      mensaje: pronosticoMessage(pronostico),
      href: `/detalle?id=${pronostico.id}`,
      actor_id: pronostico.user_id,
      entity_type: "pronostico",
      entity_id: pronostico.id,
      dedupe_key: `resultado:${pronostico.id}:${estado}`,
    }))
  );
}

export async function notifyFollowCreated(targetUserId: string, actorId: string) {
  const admin = getNotificationAdminClient();
  if (!admin || targetUserId === actorId) return;

  const actor = await getProfile(admin, actorId);
  const [recipient] = await filterAllowedRecipients(admin, actorId, [targetUserId]);
  if (!recipient) return;

  await insertNotifications([
    {
      user_id: recipient,
      tipo: "nuevo_seguidor",
      titulo: `${actorName(actor)} te sigue`,
      mensaje: "Recibira tus nuevas cuotas en su feed.",
      href: profileHref(actor),
      actor_id: actorId,
      entity_type: "usuario",
      entity_id: actorId,
      dedupe_key: `follow:${actorId}:${targetUserId}`,
    },
  ]);
}

export async function notifyFollowRequestCreated(targetUserId: string, actorId: string) {
  const admin = getNotificationAdminClient();
  if (!admin || targetUserId === actorId) return;

  const actor = await getProfile(admin, actorId);
  const [recipient] = await filterAllowedRecipients(admin, actorId, [targetUserId]);
  if (!recipient) return;

  await insertNotifications([
    {
      user_id: recipient,
      tipo: "solicitud_seguimiento",
      titulo: `${actorName(actor)} quiere seguirte`,
      mensaje: "Revisa la solicitud desde tu cuenta.",
      href: "/cuenta",
      actor_id: actorId,
      entity_type: "usuario",
      entity_id: actorId,
      dedupe_key: `follow-request:${actorId}:${targetUserId}`,
    },
  ]);
}

export async function notifyFollowRequestAccepted(requesterId: string, targetUserId: string) {
  const admin = getNotificationAdminClient();
  if (!admin || requesterId === targetUserId) return;

  const target = await getProfile(admin, targetUserId);
  const [recipient] = await filterAllowedRecipients(admin, targetUserId, [requesterId]);
  if (!recipient) return;

  await insertNotifications([
    {
      user_id: recipient,
      tipo: "seguimiento_aceptado",
      titulo: `${actorName(target)} acepto tu solicitud`,
      mensaje: "Ya puedes ver sus cuotas para seguidores.",
      href: profileHref(target),
      actor_id: targetUserId,
      entity_type: "usuario",
      entity_id: targetUserId,
      dedupe_key: `follow-accepted:${requesterId}:${targetUserId}`,
    },
  ]);
}
