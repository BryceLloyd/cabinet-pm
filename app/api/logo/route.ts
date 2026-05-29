import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );

  const { data } = await supabase
    .from("business_info")
    .select("logo_url")
    .eq("id", 1)
    .single();

  const logoUrl = data?.logo_url;
  if (!logoUrl) {
    // Fallback: redirect to the default SVG icon
    return NextResponse.redirect(new URL("/icon.svg", process.env.NEXT_PUBLIC_SITE_URL || "https://cabinet-pm.vercel.app"));
  }

  // Redirect to the Supabase storage URL
  return NextResponse.redirect(logoUrl);
}
