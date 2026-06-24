"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Building2, Users, Layers, CalendarDays, Tag, ChevronLeft, Bell, ListChecks } from "lucide-react";

const SETTINGS_NAV = [
  { href: "/settings/profile", label: "Profile", icon: User, adminOnly: false },
  { href: "/settings/notifications", label: "Notifications", icon: Bell, adminOnly: false },
  { href: "/settings/business", label: "Business", icon: Building2, adminOnly: true },
  { href: "/settings/team", label: "Team", icon: Users, adminOnly: true },
  { href: "/settings/phases", label: "Phases", icon: Layers, adminOnly: true },
  { href: "/settings/event-types", label: "Event types", icon: CalendarDays, adminOnly: true },
  { href: "/settings/task-types", label: "Task types", icon: Tag, adminOnly: true },
  { href: "/settings/task-templates", label: "Task templates", icon: ListChecks, adminOnly: true },
] as const;

export function SettingsShell({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const isRoot = pathname === "/settings";
  const nav = SETTINGS_NAV.filter((item) => isAdmin || !item.adminOnly);

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="md:flex md:gap-8">
        {/* Desktop sidebar */}
        <nav className="hidden md:block w-56 shrink-0">
          <div className="sticky top-20 space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Mobile back link — shown on sub-routes only */}
        {!isRoot && (
          <div className="md:hidden mb-4">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={16} />
              Settings
            </Link>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
