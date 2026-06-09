import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeAuthRedirect } from "@/lib/auth-redirect";
import { getPublicSiteOrigin } from "@/lib/site-url";

function sanitizeUsername(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return normalized.length >= 3 ? normalized : "usuario";
}

async function ensureOAuthProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) return;

  const metadata = user.user_metadata ?? {};
  const emailName = user.email?.split("@")[0] ?? "";
  const baseUsername = sanitizeUsername(
    String(metadata.username ?? metadata.preferred_username ?? emailName ?? "usuario")
  );
  const displayName = String(
    metadata.display_name ?? metadata.full_name ?? metadata.name ?? baseUsername
  ).slice(0, 40);

  let username = baseUsername;
  for (let suffix = 0; suffix < 50; suffix++) {
    const { data: taken } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (!taken) break;
    const suffixText = String(suffix + 1);
    username = `${baseUsername.slice(0, 24 - suffixText.length)}${suffixText}`;
  }

  await supabase.from("profiles").insert({
    id: user.id,
    username,
    display_name: displayName || username,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const publicOrigin = getPublicSiteOrigin();
  const code = url.searchParams.get("code");
  const authError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const next = normalizeAuthRedirect(url.searchParams.get("next"));

  if (authError) {
    return NextResponse.redirect(
      new URL(`/auth?next=${encodeURIComponent(next)}&error=${encodeURIComponent(authError)}`, publicOrigin)
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      await ensureOAuthProfile(supabase);
      return NextResponse.redirect(new URL(next, publicOrigin));
    }

    return NextResponse.redirect(
      new URL(`/auth?next=${encodeURIComponent(next)}&error=${encodeURIComponent(error.message)}`, publicOrigin)
    );
  }

  const message = "No se ha podido iniciar sesion con Google. Intentalo de nuevo.";
  return NextResponse.redirect(new URL(`/auth?error=${encodeURIComponent(message)}`, publicOrigin));
}
