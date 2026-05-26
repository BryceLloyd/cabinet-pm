"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, FolderKanban, CheckSquare } from "lucide-react";

const TABS = [
  { href: "/dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
  { href: "/plan?view=calendar" as const, label: "Year plan", icon: Calendar, matchPath: "/plan" },
  { href: "/projects" as const, label: "Projects", icon: FolderKanban },
  { href: "/tasks" as const, label: "Tasks", icon: CheckSquare },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background">
      <div className="flex items-center justify-around h-14">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.matchPath || tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[10px] transition-colors ${
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
              <span className={isActive ? "font-medium" : ""}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
