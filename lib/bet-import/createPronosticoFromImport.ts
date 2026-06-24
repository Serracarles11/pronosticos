import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import {
  buildEventKey,
  checkMaxPicksPerMatch,
  checkPickRateLimit,
  isMissingOptionalSchema,
  recordLinkUsage,
  reviewContentForSpam,
} from "@/lib/anti-spam/server";
import { normalizePickCategories } from "@/lib/pronostico-meta";
import { canPublishBetImport } from "./access.ts";
import { latestImportedKickoff, resolveImportedSelectionKickoffMatches } from "./match-kickoff.ts";
import { calculateTotalOdds } from "./parser.ts";
import type { ConfirmBetImportPayload } from "./types.ts";
import { resolveImportVisibility } from "./visibility.ts";

function cleanText(value: string, fallback = "") {
  return (value || fallback).trim().slice(0, 500);
}

function buildMarket(payload: ConfirmBetImportPayload) {
  const validSelections = payload.selections.filter((selection) => selection.selection || selection.market);
  if (validSelections.length <= 1) {
    const onlySelection = validSelections[0];
    return cleanText(
      [
        onlySelection?.market || payload.market,
        onlySelection?.selection || payload.selection,
      ].filter(Boolean).join(" - "),
      onlySelection?.selection ?? "Pronostico importado"
    );
  }

  return validSelections
    .map((selection) =>
      cleanText(
        [selection.eventName, selection.market, selection.selection].filter(Boolean).join(": "),
        "Seleccion importada"
      )
    )
    .join(" + ")
    .slice(0, 1000);
}

function resolveTotalOdds(payload: ConfirmBetImportPayload) {
  const calculated = calculateTotalOdds(payload.selections);
  if (calculated) return calculated;
  if (payload.totalOdds && payload.totalOdds >= 1.01) return payload.totalOdds;
  if (payload.detectedTotalOdds && payload.detectedTotalOdds >= 1.01) return payload.detectedTotalOdds;
  return null;
}

export async function createCombinedPickFromImport(
  supabase: SupabaseClient,
  userId: string,
  payload: ConfirmBetImportPayload
) {
  const { data: betImport, error: importError } = await supabase
    .from("bet_imports")
    .select("id, user_id, status")
    .eq("id", payload.importId)
    .maybeSingle();

  if (importError) return { error: importError.message };
  if (!betImport || betImport.user_id !== userId) return { error: "Importacion no encontrada." };
  if (!canPublishBetImport(betImport.status)) {
    return { error: "Esta importacion no esta lista para publicarse." };
  }

  const matchResolution = await resolveImportedSelectionKickoffMatches(supabase, payload.selections, payload.kickoffAt);
  const resolvedSelections = matchResolution.selections;
  const resolvedKickoffAt = latestImportedKickoff(payload.kickoffAt, resolvedSelections);
  const resolvedPayload = { ...payload, selections: resolvedSelections, kickoffAt: resolvedKickoffAt };

  const eventName = cleanText(resolvedPayload.eventName || resolvedPayload.selections[0]?.eventName, "Evento importado");
  const mercado = buildMarket(resolvedPayload);
  const cuota = resolveTotalOdds(resolvedPayload);
  const confianza = 3;
  const deporte = cleanText(resolvedPayload.sport, "Futbol");
  const competicion = cleanText(resolvedPayload.competition, "Importada");
  const explicacion =
    cleanText(resolvedPayload.explanation, "Combinada importada desde captura y revisada por el usuario.");
  const visibilidad = resolveImportVisibility(resolvedPayload.visibility, matchResolution.unresolvedEventNames);
  const stakeSimulado = resolvedPayload.stakeSimulated && resolvedPayload.stakeSimulated > 0 ? resolvedPayload.stakeSimulated : 1;

  if (!cuota || cuota < 1.01) return { error: "Revisa las cuotas antes de publicar." };

  const eventKey = buildEventKey({
    eventId: "",
    deporte,
    competicion,
    evento: eventName,
    fechaEvento: resolvedKickoffAt ?? "",
  });

  const pickRateLimit = await checkPickRateLimit(supabase, userId);
  if (!pickRateLimit.allowed) return { error: pickRateLimit.error };

  const matchLimit = await checkMaxPicksPerMatch(supabase, userId, eventKey);
  if (!matchLimit.allowed) return { error: matchLimit.error };

  const spamReview = await reviewContentForSpam(supabase, {
    userId,
    text: explicacion,
    targetType: "pronostico",
  });
  if (!spamReview.allowed) return { error: spamReview.error };

  const { error: selectionDeleteError } = await supabase
    .from("imported_bet_selections")
    .delete()
    .eq("import_id", payload.importId);

  if (selectionDeleteError) return { error: selectionDeleteError.message };

  if (resolvedPayload.selections.length > 0) {
    const { error: selectionInsertError } = await supabase.from("imported_bet_selections").insert(
      resolvedPayload.selections.map((selection) => ({
        import_id: resolvedPayload.importId,
        event_name: selection.eventName || null,
        competition: selection.competition || null,
        market: selection.market || null,
        selection: selection.selection || null,
        odds: selection.odds,
        kickoff_at: selection.kickoffAt,
        confidence: selection.confidence,
        raw_text: selection.rawText || null,
      }))
    );
    if (selectionInsertError) return { error: selectionInsertError.message };
  }

  const importedPickWithReferenceData = {
      user_id: userId,
      deporte,
      competicion,
      evento: eventName,
      mercado,
      cuota,
      confianza,
      explicacion,
      fecha_evento: resolvedKickoffAt,
      visibilidad,
      bookmaker: resolvedPayload.bookmaker && resolvedPayload.bookmaker !== "unknown" ? resolvedPayload.bookmaker.slice(0, 40) : null,
      stake_simulado: stakeSimulado,
      cuota_tomada_at: new Date().toISOString(),
      categorias: normalizePickCategories(["mundial", "combinada", "importada"].join(",")),
      event_key: eventKey || null,
      moderation_status: spamReview.moderationStatus,
  };

  let { data: insertedPick, error: insertError } = await supabase
    .from("pronosticos")
    .insert(importedPickWithReferenceData)
    .select("id")
    .maybeSingle();

  if (isMissingOptionalSchema(insertError)) {
    const missingSchemaMessage = insertError?.message ?? "";
    const missingReferenceDataColumn =
      missingSchemaMessage.includes("bookmaker") ||
      missingSchemaMessage.includes("stake_simulado") ||
      missingSchemaMessage.includes("cuota_tomada_at");

    if (missingReferenceDataColumn) {
      const importedPickWithoutReferenceData = {
        user_id: userId,
        deporte,
        competicion,
        evento: eventName,
        mercado,
        cuota,
        confianza,
        explicacion,
        fecha_evento: resolvedKickoffAt,
        visibilidad,
        categorias: normalizePickCategories(["mundial", "combinada", "importada"].join(",")),
        event_key: eventKey || null,
        moderation_status: spamReview.moderationStatus,
      };

      ({ data: insertedPick, error: insertError } = await supabase
        .from("pronosticos")
        .insert(importedPickWithoutReferenceData)
        .select("id")
        .maybeSingle());
    }
  }

  if (insertError) return { error: insertError.message };

  await recordLinkUsage(supabase, userId, spamReview.links, "pronostico", insertedPick?.id ?? null);

  const { error: updateError } = await supabase
    .from("bet_imports")
    .update({
      status: "confirmed",
      bookmaker: resolvedPayload.bookmaker && resolvedPayload.bookmaker !== "unknown" ? resolvedPayload.bookmaker : null,
      parsed_json: resolvedPayload,
    })
    .eq("id", resolvedPayload.importId)
    .eq("user_id", userId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/feed");
  revalidatePath("/perfil");
  revalidatePath("/ranking");

  return { ok: true, pronosticoId: insertedPick?.id ?? null, visibilidad };
}
