import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { canSeeProductionSettings } from "@/lib/production/access";
import { ProductionSettingsNav } from "@/components/production/production-settings-nav";

export default async function ProductionSettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!canSeeProductionSettings(profile?.role ?? "member")) redirect("/production");

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="md:flex md:gap-8">
        <ProductionSettingsNav />
        <div className="flex-1 min-w-0 max-w-2xl mt-4 md:mt-0">{children}</div>
      </div>
    </div>
  );
}
