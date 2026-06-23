import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() refreshes the session token — required so client-side
  // Supabase calls don't 403 after the JWT expires.
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthPage = path.startsWith("/login");
  if (!user && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Office / Production view access (admins always have both).
  if (user && !isAuthPage && !path.startsWith("/auth")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, office_access, production_access")
      .eq("id", user.id)
      .single();
    if (profile) {
      const isAdmin = profile.role === "admin";
      const office = isAdmin || profile.office_access;
      const production = isAdmin || profile.production_access;
      const isProduction = path === "/production" || path.startsWith("/production/");
      if (isProduction && !production && office) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      if (!isProduction && !office && production) {
        return NextResponse.redirect(new URL("/production", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|favicon-.*|auth/callback|manifest.json|icon.*|apple-touch-icon.png|sw.js).*)"],
};
