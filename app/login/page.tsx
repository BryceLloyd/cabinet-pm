import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: businessInfo } = await supabase
    .from("business_info")
    .select("name, logo_url")
    .eq("id", 1)
    .single();

  const bizName = businessInfo?.name || "Cabinet PM";
  const bizLogo = businessInfo?.logo_url || null;

  return <LoginForm bizName={bizName} bizLogo={bizLogo} />;
}
