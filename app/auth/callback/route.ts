import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/?auth=not-configured", request.url));
  const code = request.nextUrl.searchParams.get("code");
  if (code) await supabase.auth.exchangeCodeForSession(code);
  const destination = request.nextUrl.searchParams.get("next");
  const safePath = destination?.startsWith("/") && !destination.startsWith("//") ? destination : "/";
  return NextResponse.redirect(new URL(safePath, request.url));
}
