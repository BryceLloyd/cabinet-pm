"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/production/settings/sections", label: "Sections & steps" },
  { href: "/production/settings/suppliers", label: "Suppliers" },
  { href: "/production/settings/materials", label: "Materials" },
  { href: "/production/settings/paint-types", label: "Paint types" },
  { href: "/production/settings/hardware", label: "Hardware" },
] as const;

export function ProductionSettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="md:w-52 shrink-0">
      <div className="flex md:flex-col gap-1 overflow-x-auto no-scrollbar md:sticky md:top-20">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href as never}
              className={`shrink-0 rounded-md px-3 py-2 text-sm transition-colors ${
                active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
