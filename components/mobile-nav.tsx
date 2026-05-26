"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const NAV = [
  { href: "/dashboard" as const, label: "Dashboard" },
  { href: "/plan" as const, label: "Year plan" },
  { href: "/projects" as const, label: "Projects" },
  { href: "/tasks" as const, label: "Tasks" },
  { href: "/settings" as const, label: "Settings" },
];

export function MobileNav({
  userName,
  isAdmin,
  bizName,
  bizLogo,
}: {
  userName: string;
  isAdmin: boolean;
  bizName: string;
  bizLogo: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/login");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="md:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 5h14M3 10h14M3 15h14" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <nav className="fixed inset-y-0 left-0 w-64 bg-background border-r p-4 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-2 font-semibold tracking-tight">
                {bizLogo && (
                  <img src={bizLogo} alt="" className="h-6 w-6 object-contain rounded" />
                )}
                {bizName}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Close menu"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            </div>
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`px-3 py-2 text-sm rounded-md transition-colors ${
                  pathname.startsWith(item.href)
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-auto pt-4 border-t px-3">
              <div className="text-sm text-muted-foreground">
                {userName}
                {isAdmin && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-muted">admin</span>}
              </div>
              <button
                onClick={handleSignOut}
                className="mt-2 text-sm text-muted-foreground hover:text-foreground"
              >Sign out</button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
