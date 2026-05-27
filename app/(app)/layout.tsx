import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { BottomTabBar } from "@/components/bottom-tab-bar";
import { PageTitle } from "@/components/page-title";
import { MobileFab } from "@/components/mobile-fab";
import { DensityProvider } from "@/components/density-provider";

const NAV = [
  { href: "/dashboard" as const, label: "Dashboard" },
  { href: "/plan" as const, label: "Year plan" },
  { href: "/projects" as const, label: "Projects" },
  { href: "/tasks" as const, label: "Tasks" },
];

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: businessInfo }] = await Promise.all([
    supabase.from("profiles").select("full_name, role, avatar_url, density_preference").eq("id", user.id).single(),
    supabase.from("business_info").select("name, logo_url").eq("id", 1).single(),
  ]);

  if (!profile) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold mb-2">Access denied</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Your email hasn&apos;t been approved for this workspace. Ask an admin to add you.
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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
              {bizLogo && (
                <img src={bizLogo} alt="" className="h-7 w-7 object-contain rounded" />
              )}
              <span className="hidden md:inline text-sm font-semibold tracking-tight">{bizName}</span>
            </Link>
            <span className="hidden md:inline text-muted-foreground/40 text-sm">/</span>
            <PageTitle />
          </div>
          <div className="flex items-center gap-1 md:gap-4">
            <nav className="hidden md:flex items-center gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <UserMenu
              fullName={profile.full_name}
              email={user.email || ""}
              role={profile.role}
              avatarUrl={profile.avatar_url || null}
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
    </div>
  );
}
