import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProductionLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, production_access")
    .eq("id", user.id)
    .single();
  const hasProduction = profile?.role === "admin" || !!profile?.production_access;
  if (!hasProduction) redirect("/dashboard");

  return <>{children}</>;
}
