import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "./config";

const publicPages = new Set(["/login", "/auth/recovery", "/auth/callback"]);
function unauthenticatedResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Se requiere una sesión válida." }, { status: 401 });
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export async function updateSupabaseSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicPage = publicPages.has(pathname);
  if (pathname === "/login") return NextResponse.next({ request });
  if (isPublicPage) {
    const config = getSupabasePublicConfig();
    if (!config) return NextResponse.next({ request });
  }

  const config = getSupabasePublicConfig();
  if (!config) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/login?configuration=required", request.url));
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims();
  if (!isPublicPage && (error || typeof data?.claims?.sub !== "string")) {
    return unauthenticatedResponse(request);
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
