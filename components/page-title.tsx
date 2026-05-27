"use client";

import { usePathname } from "next/navigation";

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/plan": "Year Plan",
  "/projects": "Projects",
  "/projects/new": "New Project",
  "/tasks": "Tasks",
  "/settings": "Settings",
};

export function PageTitle() {
  const pathname = usePathname();

  let title = ROUTE_TITLES[pathname];
  if (!title) {
    if (pathname.startsWith("/projects/")) title = "Project";
    else title = "";
  }

  if (!title) return null;

  return (
    <span className="text-sm font-medium text-foreground truncate">
      {title}
    </span>
  );
}
