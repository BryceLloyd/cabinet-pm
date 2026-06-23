"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  FolderKanban,
  CheckSquare,
  Factory,
  Truck,
  Package,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: (pathname: string) => boolean;
}

const OFFICE_TABS: Tab[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/plan?view=calendar", label: "Year plan", icon: Calendar, match: (p) => p.startsWith("/plan") },
  { href: "/projects", label: "Projects", icon: FolderKanban, match: (p) => p.startsWith("/projects") },
  { href: "/tasks", label: "Tasks", icon: CheckSquare, match: (p) => p.startsWith("/tasks") },
];

const FACTORY_STAGES = ["/production/cut-edge", "/production/painting", "/production/assembly"];

const PRODUCTION_TABS: Tab[] = [
  { href: "/production", label: "Dashboard", icon: LayoutDashboard, match: (p) => p === "/production" },
  { href: "/production/cut-edge", label: "Factory", icon: Factory, match: (p) => FACTORY_STAGES.some((s) => p === s || p.startsWith(s + "/")) },
  { href: "/production/installation", label: "Install", icon: Truck, match: (p) => p.startsWith("/production/installation") },
  { href: "/production/hardware", label: "Hardware", icon: Package, match: (p) => p.startsWith("/production/hardware") },
  { href: "/production/cutlists", label: "Cutlists", icon: ClipboardList, match: (p) => p.startsWith("/production/cutlists") },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const isProduction = pathname === "/production" || pathname.startsWith("/production/");
  const tabs = isProduction ? PRODUCTION_TABS : OFFICE_TABS;

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center justify-around h-[72px]">
        {tabs.map((tab) => {
          const isActive = tab.match ? tab.match(pathname) : pathname === tab.href;
          const Icon = tab.icon;
          return (
            <Link key={tab.label} href={tab.href as never} className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full">
              <span className={`flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors ${isActive ? "bg-muted text-foreground" : "text-muted-foreground"}`}>
                <Icon size={22} strokeWidth={isActive ? 2.25 : 1.75} />
                <span className={`text-[11px] ${isActive ? "font-medium" : ""}`}>{tab.label}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
