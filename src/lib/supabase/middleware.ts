import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/" ||
    // Missive inbound webhooks (Phase C) — no Auth session.
    pathname.startsWith("/api/webhooks/")
  );
}

/** Copy refreshed Auth cookies onto a redirect without dropping attributes. */
function copyCookies(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie);
  });
  return to;
}

/** Refresh the Auth session and gate app routes behind login. */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const { pathname } = request.nextUrl;
  const publicPath = isPublicPath(pathname);

  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) {
    // No database/auth config: never serve the app unauthenticated.
    if (!publicPath) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Important: do not remove — keeps the session fresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !publicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return copyCookies(supabaseResponse, NextResponse.redirect(loginUrl));
  }

  if (user && (pathname === "/login" || pathname === "/")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/ranglijst";
    homeUrl.search = "";
    return copyCookies(supabaseResponse, NextResponse.redirect(homeUrl));
  }

  return supabaseResponse;
}
