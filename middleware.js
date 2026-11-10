// Kept as Edge middleware (not Next 16 `proxy.js`) for Cloudflare Workers: the Node.js
// proxy runtime is experimental in OpenNext and pushes the Worker over the 3 MB Free plan limit.
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase/config";

const PROTECTED_PATHS = ["/courses", "/admin", "/profile", "/certificates"];

export async function middleware(request) {
  let response = NextResponse.next({ request });

  // Refreshes the session cookie on every matched request, as @supabase/ssr recommends.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/courses", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/courses/:path*", "/admin/:path*", "/profile/:path*", "/certificates/:path*", "/login"],
};
