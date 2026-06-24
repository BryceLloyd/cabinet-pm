import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canSeeOffice, canSeeProduction } from "@/lib/production/access";

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

  // Office / Production view access derived from role.
  if (user && !isAuthPage && !path.startsWith("/auth")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile) {
      const office = canSeeOffice(profile.role);
      const production = canSeeProduction(profile.role);
      const isProduction = path === "/production" || path.startsWith("/production/");
      if (isProduction && !production && office) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      if (!isProduction && !office && production) {
        return NextResponse.redirect(new URL("/production", request.url));
      }

      // Admin-only settings: non-admins can only reach Profile / Notifications.
      const ADMIN_ONLY_SETTINGS = ["/settings/business", "/settings/team", "/settings/phases", "/settings/event-types", "/settings/task-types", "/settings/task-templates"];
      if (profile.role !== "admin" && ADMIN_ONLY_SETTINGS.some((p) => path === p || path.startsWith(p + "/"))) {
        return NextResponse.redirect(new URL("/settings/profile", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|favicon-.*|auth/callback|manifest.json|icon.*|apple-touch-icon.png|sw.js).*)"],
};
