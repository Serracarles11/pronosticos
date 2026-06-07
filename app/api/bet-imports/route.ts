import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseBetSlipText } from "@/lib/bet-import/parser";
import { runOcrOnBetSlip } from "@/lib/bet-import/ocr";
import { uploadBetSlipImage } from "@/lib/bet-import/upload";
import { validateBetSlipImage } from "@/lib/bet-import/validators";

export const runtime = "nodejs";

const IMPORTS_PER_HOUR = 10;

function userFacingImportError(error: unknown) {
  const message = error instanceof Error ? error.message : "No se pudo procesar la captura.";
  const normalized = message.toLowerCase();

  if (normalized.includes("bucket") || normalized.includes("storage")) {
    return "No existe el bucket privado bet-imports. Ejecuta la migracion supabase/17_import_betslip_ocr.sql.";
  }

  if (
    normalized.includes("bet_imports") ||
    normalized.includes("imported_bet_selections") ||
    normalized.includes("relation")
  ) {
    return "Falta aplicar la migracion supabase/17_import_betslip_ocr.sql en Supabase.";
  }

  if (normalized.includes("read image") || normalized.includes("decode") || normalized.includes("libpng")) {
    return "No se pudo leer la imagen. Prueba con una captura JPG o PNG clara, sin editar ni recortar demasiado.";
  }

  if (normalized.includes("traineddata") || normalized.includes("lang")) {
    return "No se pudo cargar el idioma OCR. Revisa la conexion del servidor o configura BET_IMPORT_OCR_LANGS=eng.";
  }

  return message;
}

async function checkImportRateLimit(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("bet_imports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) return { allowed: false, error: error.message };
  if ((count ?? 0) >= IMPORTS_PER_HOUR) {
    return { allowed: false, error: "Has alcanzado el limite de 10 importaciones por hora." };
  }

  return { allowed: true };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesion." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sube una captura valida." }, { status: 400 });
  }

  const validation = validateBetSlipImage(file);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const rateLimit = await checkImportRateLimit(supabase, user.id);
  if (!rateLimit.allowed) {
    const isSchemaError = /bet_imports|relation/i.test(rateLimit.error ?? "");
    return NextResponse.json(
      { error: userFacingImportError(new Error(rateLimit.error ?? "")) },
      { status: isSchemaError ? 500 : 429 }
    );
  }

  const { data: betImport, error: insertError } = await supabase
    .from("bet_imports")
    .insert({
      user_id: user.id,
      source_type: "screenshot",
      status: "uploaded",
    })
    .select("id")
    .maybeSingle();

  if (insertError || !betImport) {
    return NextResponse.json(
      { error: userFacingImportError(insertError ?? new Error("No se pudo crear la importacion.")) },
      { status: 500 }
    );
  }

  try {
    const filePath = await uploadBetSlipImage(user.id, betImport.id, file, buffer, supabase);

    await supabase
      .from("bet_imports")
      .update({ original_file_path: filePath, status: "processing" })
      .eq("id", betImport.id)
      .eq("user_id", user.id);

    const ocr = await runOcrOnBetSlip(buffer);
    const parsed = parseBetSlipText(ocr.text);

    if (parsed.selections.length > 0) {
      const { error: selectionError } = await supabase.from("imported_bet_selections").insert(
        parsed.selections.map((selection) => ({
          import_id: betImport.id,
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

      if (selectionError) throw new Error(selectionError.message);
    }

    const { error: updateError } = await supabase
      .from("bet_imports")
      .update({
        bookmaker: parsed.bookmaker === "unknown" ? null : parsed.bookmaker,
        extracted_text: ocr.text,
        parsed_json: { ...parsed, ocrProvider: ocr.provider },
        status: "processed",
        error_message: null,
      })
      .eq("id", betImport.id)
      .eq("user_id", user.id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      importId: betImport.id,
      extractedText: ocr.text,
      parsed,
    });
  } catch (error) {
    const message = userFacingImportError(error);
    console.error("[bet-imports] import failed", error);
    await supabase
      .from("bet_imports")
      .update({ status: "failed", error_message: message })
      .eq("id", betImport.id)
      .eq("user_id", user.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
