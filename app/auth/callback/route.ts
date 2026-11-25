import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/safe-next";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL("/?auth=not-configured", request.url));
  const code = request.nextUrl.searchParams.get("code");
  if (code) await supabase.auth.exchangeCodeForSession(code);
  const destination = request.nextUrl.searchParams.get("next");
  const safePath = safeNextPath(destination, request.nextUrl.origin);
  return NextResponse.redirect(new URL(safePath, request.url));
}
