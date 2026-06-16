import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadBetSlipImage } from "@/lib/bet-import/upload";
import { validateBetSlipImage } from "@/lib/bet-import/validators";
import { isMissingOptionalSchema } from "@/lib/anti-spam/server";
import { extractBetslipFromImage } from "@/lib/betslip-import/services/extract-betslip-from-image";
import { createReviewPayload } from "@/lib/betslip-import/services/create-review-payload";

export const runtime = "nodejs";
export const maxDuration = 60;

function importsPerHour() {
  const value = Number(process.env.BETSLIP_IMPORT_MAX_PER_HOUR);
  return Number.isFinite(value) && value > 0 ? value : 10;
}

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

  if (normalized.includes("openai_api_key")) {
    return "Falta configurar OPENAI_API_KEY en Vercel para procesar capturas con IA.";
  }

  if (normalized.includes("tesseract") && normalized.includes("vercel")) {
    return "El OCR basico local no esta disponible en Vercel. Configura OPENAI_API_KEY y usa BETSLIP_EXTRACTOR_PROVIDER=openai.";
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
  const limit = importsPerHour();
  if ((count ?? 0) >= limit) {
    return { allowed: false, error: `Has alcanzado el limite de ${limit} importaciones por hora.` };
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

    const extraction = await extractBetslipFromImage({
      imageBuffer: buffer,
      mimeType: file.type.toLowerCase(),
      userId: user.id,
    });
    const parsed = createReviewPayload(extraction);

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

    const updateWithAiMetadata = {
      bookmaker: parsed.bookmaker === "unknown" ? null : parsed.bookmaker,
      extracted_text: parsed.rawText ?? "",
      parsed_json: parsed,
      extraction_provider: extraction.provider,
      extraction_model: extraction.model ?? null,
      extraction_confidence: extraction.confidence,
      raw_provider_json: extraction.rawProviderJson ?? null,
      validated_json: extraction,
      status: "processed",
      error_message: null,
    };

    const { error: updateError } = await supabase
      .from("bet_imports")
      .update(updateWithAiMetadata)
      .eq("id", betImport.id)
      .eq("user_id", user.id);

    if (isMissingOptionalSchema(updateError)) {
      const { error: retryUpdateError } = await supabase
        .from("bet_imports")
        .update({
          bookmaker: parsed.bookmaker === "unknown" ? null : parsed.bookmaker,
          extracted_text: parsed.rawText ?? "",
          parsed_json: parsed,
          status: "processed",
          error_message: null,
        })
        .eq("id", betImport.id)
        .eq("user_id", user.id);
      if (retryUpdateError) throw new Error(retryUpdateError.message);
    } else if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      importId: betImport.id,
      extractedText: parsed.rawText ?? "",
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
