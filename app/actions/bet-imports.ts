"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCombinedPickFromImport } from "@/lib/bet-import/createPronosticoFromImport";
import type { ConfirmBetImportPayload } from "@/lib/bet-import/types";

export async function confirmBetImport(payload: ConfirmBetImportPayload) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth?next=/nuevo");

  const result = await createCombinedPickFromImport(supabase, user.id, payload);
  if (result.error) return { error: result.error };

  redirect("/feed");
}

export async function discardBetImport(importId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesion." };

  const { data: betImport, error: fetchError } = await supabase
    .from("bet_imports")
    .select("id, user_id, original_file_path")
    .eq("id", importId)
    .maybeSingle();

  if (fetchError) return { error: fetchError.message };
  if (!betImport || betImport.user_id !== user.id) return { error: "Importacion no encontrada." };

  const { error } = await supabase
    .from("bet_imports")
    .update({ status: "discarded" })
    .eq("id", importId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  if (betImport.original_file_path) {
    await supabase.storage.from("bet-imports").remove([betImport.original_file_path]);
  }

  return { ok: true };
}
