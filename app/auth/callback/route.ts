import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuthRedirect } from "@/lib/auth-redirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = normalizeAuthRedirect(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const message = "No se ha podido iniciar sesion con Google. Intentalo de nuevo.";
  return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(message)}`, url.origin));
}
