export type OcrResult = {
  text: string;
  provider: string;
};

export interface OcrProvider {
  recognize(image: Buffer): Promise<OcrResult>;
}

async function resolveTesseractWorkerPath() {
  const path = await import("node:path");
  return path.resolve(
    process.cwd(),
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js"
  );
}

export class TesseractOcrProvider implements OcrProvider {
  async recognize(image: Buffer): Promise<OcrResult> {
    const { createWorker, PSM } = await import("tesseract.js");
    const languages = process.env.BET_IMPORT_OCR_LANGS || "spa";
    const worker = await createWorker(languages, 1, {
      cacheMethod: "readOnly",
      logger: () => undefined,
      workerPath: await resolveTesseractWorkerPath(),
    });

    try {
      await worker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      });
      const result = await worker.recognize(image);

      return {
        text: result.data.text ?? "",
        provider: `tesseract:${languages}`,
      };
    } finally {
      await worker.terminate();
    }
  }
}

export class CloudOcrProvider implements OcrProvider {
  async recognize(): Promise<OcrResult> {
    throw new Error("Cloud OCR no esta configurado.");
  }
}

export async function runOcrOnBetSlip(filePathOrBuffer: string | Buffer, provider: OcrProvider = new TesseractOcrProvider()) {
  if (typeof filePathOrBuffer === "string") {
    const { readFile } = await import("node:fs/promises");
    return provider.recognize(await readFile(filePathOrBuffer));
  }

  return provider.recognize(filePathOrBuffer);
}
