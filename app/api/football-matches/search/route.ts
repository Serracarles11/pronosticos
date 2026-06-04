import { NextResponse } from "next/server";
import { getMatchesForPicker } from "@/lib/football-data/search";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const matches = await getMatchesForPicker({
      id: url.searchParams.get("id"),
      query: url.searchParams.get("q"),
      dateFrom: url.searchParams.get("dateFrom"),
      dateTo: url.searchParams.get("dateTo"),
      competitionCode: url.searchParams.get("competitionCode"),
      limit: Number(url.searchParams.get("limit") ?? 20),
    });

    return NextResponse.json({ matches });
  } catch (error) {
    return NextResponse.json(
      {
        matches: [],
        error:
          error instanceof Error && error.message.includes("football_matches")
            ? "No hay partidos disponibles. Aplica la migracion de football-data."
            : error instanceof Error
            ? error.message
            : "No se pudieron cargar partidos.",
      },
      { status: 200 }
    );
  }
}
