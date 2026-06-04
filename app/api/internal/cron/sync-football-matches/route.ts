import { NextResponse } from "next/server";
import { getDefaultFootballSyncRange, syncFootballMatches } from "@/lib/football-data/sync";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  return auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ status: "error", errors: ["No autorizado."] }, { status: 401 });
  }

  try {
    const range = getDefaultFootballSyncRange();
    const result = await syncFootballMatches(range);
    return NextResponse.json(result, { status: result.status === "error" ? 500 : 200 });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        fetched: 0,
        inserted: 0,
        updated: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : "Error sincronizando football-data."],
      },
      { status: 500 }
    );
  }
}
