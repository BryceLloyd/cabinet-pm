import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

// Wrapped in React cache() so repeated calls within a single server request
// (e.g. the app shell layout + the page it renders) share one client instead
// of re-parsing cookies and opening a new connection each time.
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore if middleware is refreshing sessions.
          }
        },
      },
      global: {
        fetch: (url: string | URL | Request, init?: RequestInit) =>
          fetch(url, { ...init, cache: "no-store" }),
      },
    }
  );
});

// getUser() hits the Supabase auth server over the network every call. The shell
// layout and each page both need the user, so cache() collapses those into one
// network round-trip per request.
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
