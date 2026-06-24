import Link from "next/link";
import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { MobileFab } from "@/components/mobile-fab";
import { DensityProvider } from "@/components/density-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ServiceWorkerRegister } from "@/components/notifications/sw-register";
import { ViewSwitch } from "@/components/view-switch";
import { HeaderNav } from "@/components/header-nav";

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();

  const [{ data: profile }, { data: businessInfo }] = await Promise.all([
    supabase.from("profiles").select("full_name, role, avatar_url, density_preference, deactivated_at, office_access, production_access").eq("id", user.id).single(),
    supabase.from("business_info").select("name, logo_url").eq("id", 1).single(),
  ]);

  if (!profile || profile.deactivated_at) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold mb-2">Access denied</h1>
          <p className="text-sm text-muted-foreground mb-4">
            {profile?.deactivated_at
              ? "Your account has been deactivated. Contact an admin if this is a mistake."
              : "Your email hasn't been approved for this workspace. Ask an admin to add you."}
          </p>
          <form action="/auth/signout" method="POST">
            <button type="submit" className="text-sm underline text-muted-foreground hover:text-foreground">
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  const bizName = businessInfo?.name || "Cabinet PM";
  const bizLogo = businessInfo?.logo_url || null;
  const isAdmin = profile.role === "admin";
  const hasOffice = isAdmin || profile.office_access;
  const hasProduction = isAdmin || profile.production_access;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container flex h-14 items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              {bizLogo && (
                <img src={bizLogo} alt="" className="h-7 w-7 object-contain rounded" />
              )}
              <span className="hidden lg:inline text-sm font-semibold tracking-tight">{bizName}</span>
            </Link>
            <ViewSwitch hasOffice={hasOffice} hasProduction={hasProduction} />
          </div>
          <div className="flex items-center gap-1 md:gap-4">
            <HeaderNav />
            <NotificationBell userId={user.id} />
            <UserMenu
              fullName={profile.full_name}
              email={user.email || ""}
              role={profile.role}
              avatarUrl={profile.avatar_url || null}
              showProductionSettings={isAdmin && hasProduction}
            />
          </div>
        </div>
      </header>
      <main className="flex-1 pb-20 md:pb-0">
        <DensityProvider density={profile.density_preference || "comfortable"}>
          {children}
        </DensityProvider>
      </main>
      <BottomTabBar />
      <MobileFab />
      <ServiceWorkerRegister />
    </div>
  );
}
