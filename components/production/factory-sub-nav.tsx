"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/production/cut-edge", label: "Cut & edge" },
  { href: "/production/painting", label: "Painting" },
  { href: "/production/assembly", label: "Assembly" },
];

export function FactorySubNav() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b mb-4">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href as never}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
