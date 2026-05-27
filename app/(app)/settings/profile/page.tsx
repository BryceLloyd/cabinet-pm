import { createClient } from "@/lib/supabase/server";
import { SetPassword } from "@/components/settings/set-password";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      {/* Name + email — read only for now, full form in Task 5 */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Profile</h2>
        </div>
        <div className="px-5 py-4 space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span>{" "}
            {user?.email || "—"}
          </div>
        </div>
      </section>

      {/* Password */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Password</h2>
        </div>
        <div className="px-5 py-4">
          <SetPassword />
        </div>
      </section>
    </div>
  );
}
