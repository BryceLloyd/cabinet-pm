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

const OFFICE_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/plan", label: "Year plan", icon: Calendar },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

const FACTORY_STAGES = ["/production/cut-edge", "/production/painting", "/production/assembly"];

const PRODUCTION_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/production", label: "Dashboard", icon: LayoutDashboard },
  { href: "/production/cut-edge", label: "Factory", icon: Factory },
  { href: "/production/installation", label: "Installation", icon: Truck },
  { href: "/production/hardware", label: "Hardware orders", icon: Package },
  { href: "/production/cutlists", label: "Cutlists", icon: ClipboardList },
];

const base = "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors";

export function HeaderNav() {
  const pathname = usePathname();
  const isProduction = pathname === "/production" || pathname.startsWith("/production/");

  function officeActive(href: string): boolean {
    return pathname === href || pathname.startsWith(href + "/");
  }
  function prodActive(href: string): boolean {
    if (href === "/production") return pathname === "/production";
    if (href === "/production/cut-edge") return FACTORY_STAGES.some((s) => pathname === s || pathname.startsWith(s + "/"));
    return pathname === href || pathname.startsWith(href + "/");
  }

  const items = isProduction ? PRODUCTION_NAV : OFFICE_NAV;
  const isActive = isProduction ? prodActive : officeActive;

  return (
    <nav className="hidden md:flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href as never}
            className={`${base} ${active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
          >
            <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
