import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { endpoint, p256dh, auth, userAgent } = await request.json();

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Upsert: if this endpoint already exists, update the keys
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent || null,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("Failed to save push subscription:", error);
    return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
