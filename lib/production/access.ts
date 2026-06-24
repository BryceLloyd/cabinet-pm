import type { ProductionRole } from "@/lib/types";

// Which production section slugs each role may see. 'all' = every section.
const STAGE_ACCESS: Record<ProductionRole, "all" | string[]> = {
  admin: "all",
  office: "all",
  factory: ["cut-edge", "painting", "assembly", "hardware-orders"],
  site: ["installation"],
};

export function canSeeStage(role: string, slug: string): boolean {
  const access = STAGE_ACCESS[role as ProductionRole] ?? [];
  return access === "all" || access.includes(slug);
}

// Office and Admin see the Office view (dashboard, projects, tasks, calendar).
export function canSeeOffice(role: string): boolean {
  return role === "admin" || role === "office";
}

// Every role can reach the Production area (each sees at least one section).
export function canSeeProduction(role: string): boolean {
  const access = STAGE_ACCESS[role as ProductionRole];
  return access === "all" || (Array.isArray(access) && access.length > 0);
}

// Production settings (materials, suppliers, hardware, paint) — office + admin.
export function canSeeProductionSettings(role: string): boolean {
  return role === "admin" || role === "office";
}

// Site users work a single section; everyone else gets the overview dashboard.
export function canSeeProductionDashboard(role: string): boolean {
  return role !== "site";
}
