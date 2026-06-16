import OpenAI from "openai";
import { BETSLIP_VISION_EXTRACTION_PROMPT } from "../prompts/vision-extraction-prompt.ts";
import {
  BETSLIP_EXTRACTION_JSON_SCHEMA,
  parseBetslipExtractionJson,
} from "../schema/betslip-extraction-schema.ts";
import { normalizeExtractedBetslip } from "../validation/normalize-extracted-betslip.ts";
import type { BetslipExtractionResult, BetslipExtractorInput, BetslipExtractorProvider } from "./provider.ts";

const SUPPORTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function dataUrl(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function parseJsonText(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("OpenAI no devolvio JSON valido.");
    return JSON.parse(match[0]);
  }
}

export class OpenAIVisionBetslipExtractorProvider implements BetslipExtractorProvider {
  name = "openai" as const;
  private readonly model: string;

  constructor(model = process.env.BETSLIP_VISION_MODEL || "gpt-5-mini") {
    this.model = model;
  }

  async extract(input: BetslipExtractorInput): Promise<BetslipExtractionResult> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY no esta configurada.");
    }
    if (!SUPPORTED_MIME_TYPES.has(input.mimeType)) {
      throw new Error("Formato de imagen no soportado por el extractor IA.");
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.responses.create({
      model: this.model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: BETSLIP_VISION_EXTRACTION_PROMPT },
            { type: "input_image", image_url: dataUrl(input.imageBuffer, input.mimeType), detail: "high" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "betslip_extraction",
          strict: true,
          schema: BETSLIP_EXTRACTION_JSON_SCHEMA,
        },
      },
    });

    const rawJson = parseJsonText(response.output_text);
    const parsed = parseBetslipExtractionJson(rawJson);

    return normalizeExtractedBetslip({
      provider: "openai",
      model: this.model,
      ...parsed,
      calculatedTotalOdds: null,
      totalOddsMatch: null,
      rawText: null,
      rawProviderJson: rawJson,
    });
  }
}
