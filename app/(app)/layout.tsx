import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="font-semibold tracking-tight">Cabinet PM</Link>
            <nav className="flex items-center gap-1">
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
          <div className="text-sm text-muted-foreground">
            {profile?.full_name || user.email}
            {profile?.role === "admin" && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted">admin</span>}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
