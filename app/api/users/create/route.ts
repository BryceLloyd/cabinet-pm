import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

const ROLES = ["admin", "office", "factory", "site"] as const;
type Role = (typeof ROLES)[number];

// Creates a team member directly: the admin sets the password, the user just
// logs in. No email confirmation involved. Requires the service-role key, so
// the whole thing runs server-side behind an admin check.
export async function POST(request: Request) {
  // 1. Only an authenticated admin may create users.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data: caller } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (caller?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can create users" }, { status: 403 });
  }

  // 2. Validate input.
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const fullName = String(body.full_name || "").trim();
  const email = String(body.email || "").toLowerCase().trim();
  const password = String(body.password || "");
  const role: Role = ROLES.includes(body.role) ? body.role : "office";

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }

  // 3. Create the auth user (already confirmed) + their profile via service role.
  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || email.split("@")[0] },
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message || "";
    const already = /already.*registered|already been registered|duplicate|exists/i.test(msg);
    return NextResponse.json(
      { error: already ? "That email already has an account" : msg || "Failed to create user" },
      { status: already ? 409 : 500 }
    );
  }

  // The signup trigger only creates a profile for allowed_emails, so upsert ours
  // with the chosen role/access (overrides the trigger's row if one exists).
  const { error: profileErr } = await admin.from("profiles").upsert(
    {
      id: created.user.id,
      full_name: fullName || email.split("@")[0],
      role,
      deactivated_at: null,
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    // Roll back the auth user so a half-created account doesn't linger.
    await admin.auth.admin.deleteUser(created.user.id);
    console.error("Failed to create profile:", profileErr);
    return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
