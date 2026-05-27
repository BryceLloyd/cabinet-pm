"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { MobileFabDrawer } from "@/components/mobile-fab-drawer";

export type FabDrawerMode = "dashboard-picker" | "project-picker" | "quick-task";

type FabConfig = {
  label: string;
  action: "navigate" | "drawer";
  href?: string;
  drawerMode?: FabDrawerMode;
  projectId?: string;
};

function getFabConfig(pathname: string): FabConfig | null {
  if (pathname === "/settings") return null;
  if (pathname.startsWith("/projects/new")) return null;

  if (pathname === "/dashboard") {
    return { label: "Add", action: "drawer", drawerMode: "dashboard-picker" };
  }
  if (pathname === "/plan" || pathname.startsWith("/plan?")) {
    return { label: "New project", action: "navigate", href: "/projects/new" };
  }
  if (pathname === "/projects") {
    return { label: "New project", action: "navigate", href: "/projects/new" };
  }
  if (pathname === "/tasks") {
    return { label: "New task", action: "drawer", drawerMode: "quick-task" };
  }

  // /projects/[id] — extract project ID
  const projectMatch = pathname.match(/^\/projects\/([^/]+)$/);
  if (projectMatch) {
    return {
      label: "Add",
      action: "drawer",
      drawerMode: "project-picker",
      projectId: projectMatch[1],
    };
  }

  return null;
}

export function MobileFab() {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const config = getFabConfig(pathname);
  if (!config) return null;

  function handleClick() {
    if (config!.action === "navigate" && config!.href) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(config!.href as any);
    } else {
      setDrawerOpen(true);
    }
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="md:hidden fixed bottom-[calc(72px+env(safe-area-inset-bottom)+12px)] left-1/2 -translate-x-1/2 z-50 h-11 px-5 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-1.5 text-sm font-medium hover:opacity-90 active:scale-95 transition-transform"
      >
        <Plus size={18} strokeWidth={2.5} />
        {config.label}
      </button>
      {config.action === "drawer" && (
        <MobileFabDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          mode={config.drawerMode!}
          projectId={config.projectId}
        />
      )}
    </>
  );
}
