export type BetslipImagePreprocessResult = {
  buffer: Buffer;
  steps: string[];
  warnings: string[];
};

export async function preprocessBetslipImage(buffer: Buffer): Promise<BetslipImagePreprocessResult> {
  return {
    buffer,
    steps: ["client-side resize", "server validation"],
    warnings: [],
  };
}
