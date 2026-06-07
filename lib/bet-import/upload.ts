import type { SupabaseClient } from "@supabase/supabase-js";
import { getSafeBetSlipExtension } from "./validators.ts";

export async function uploadBetSlipImage(
  userId: string,
  importId: string,
  file: File,
  body: Buffer,
  supabase: SupabaseClient
) {
  const extension = getSafeBetSlipExtension(file);
  const path = `${userId}/${importId}.${extension}`;
  const { error } = await supabase.storage.from("bet-imports").upload(path, body, {
    contentType: file.type,
    upsert: false,
  });

  if (error) throw new Error(error.message);
  return path;
}
