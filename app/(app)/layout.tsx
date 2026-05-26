import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MobileNav } from "@/components/mobile-nav";
import { SignOutButton } from "@/components/sign-out-button";

const NAV = [
  { href: "/dashboard" as const, label: "Dashboard" },
  { href: "/plan" as const, label: "Year plan" },
  { href: "/projects" as const, label: "Projects" },
  { href: "/tasks" as const, label: "Tasks" },
  { href: "/settings" as const, label: "Settings" },
];

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: businessInfo }] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", user.id).single(),
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

  const userName = profile.full_name || user.email || "";
  const isAdmin = profile.role === "admin";
  const bizName = businessInfo?.name || "Cabinet PM";
  const bizLogo = businessInfo?.logo_url || null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-4 md:gap-8">
            <MobileNav userName={userName} isAdmin={isAdmin} bizName={bizName} bizLogo={bizLogo} />
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
              {bizLogo && (
                <img src={bizLogo} alt="" className="h-7 w-7 object-contain rounded" />
              )}
              <span>{bizName}</span>
            </Link>
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
          </div>
          <div className="hidden md:flex items-center gap-3 text-sm text-muted-foreground">
            <span>
              {userName}
              {isAdmin && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted">admin</span>}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
