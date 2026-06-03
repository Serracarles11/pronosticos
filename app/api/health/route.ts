import { NextResponse } from "next/server";

export function GET() {
  const envReady =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  return NextResponse.json(
    {
      ok: envReady,
      service: "TodosGanamos",
      env: envReady ? "configured" : "missing",
      timestamp: new Date().toISOString(),
    },
    {
      status: envReady ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
