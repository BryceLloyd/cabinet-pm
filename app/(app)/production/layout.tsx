import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { canSeeProduction } from "@/lib/production/access";

export default async function ProductionLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const hasProduction = canSeeProduction(profile?.role ?? "");
  if (!hasProduction) redirect("/dashboard");

  return <>{children}</>;
}
