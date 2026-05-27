import { createClient } from "@/lib/supabase/server";
import { BusinessInfoForm } from "@/components/settings/business-info-form";
import type { BusinessInfo } from "@/lib/types";

export default async function BusinessSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: profile }, { data: businessInfo }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
    supabase.from("business_info").select("*").eq("id", 1).single(),
  ]);

  const isAdmin = profile?.role === "admin";
  const biz: BusinessInfo = businessInfo || {
    id: 1, name: "", logo_url: null, address: null, phone: null,
    email: null, workshop_photo_url: null, updated_at: "",
  };

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b">
        <h2 className="font-medium">Business info</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Appears on the login screen, nav bar, and dashboard.
        </p>
      </div>
      <div className="px-5 py-4">
        <BusinessInfoForm initial={biz} isAdmin={isAdmin} />
      </div>
    </section>
  );
}
