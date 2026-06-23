import type { ProductionRole } from "@/lib/types";

// Which production section slugs each role may see. 'all' = every section.
// 'member' is kept for back-compat with existing accounts and maps to office.
const STAGE_ACCESS: Record<ProductionRole, "all" | string[]> = {
  admin: "all",
  office: "all",
  member: "all",
  factory: ["cut-edge", "painting", "assembly", "hardware-orders"],
  site: ["installation"],
};

export function canSeeStage(role: string, slug: string): boolean {
  const access = STAGE_ACCESS[role as ProductionRole] ?? [];
  return access === "all" || access.includes(slug);
}

// Any role can reach the production area (every role sees at least one section).
export function canSeeProduction(role: string): boolean {
  const access = STAGE_ACCESS[role as ProductionRole];
  return access === "all" || (Array.isArray(access) && access.length > 0);
}

export function canSeeProductionSettings(role: string): boolean {
  return role === "admin";
}

// Site users work a single section; everyone else gets the overview dashboard.
export function canSeeProductionDashboard(role: string): boolean {
  return role !== "site";
}
