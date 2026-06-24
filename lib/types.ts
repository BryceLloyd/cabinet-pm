// Hand-written DB types. Regenerate from Supabase later with:
//   npx supabase gen types typescript --project-id xxx > lib/database.types.ts

export type ProjectStatus = "planning" | "active" | "on_hold" | "complete" | "cancelled";

export type ProductionRole = "admin" | "office" | "factory" | "site" | "member";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: ProductionRole;
  office_access: boolean;
  production_access: boolean;
  density_preference: "compact" | "comfortable";
  notification_preferences: Record<string, unknown>;
  show_room_groups: boolean;
  created_at: string;
}

export interface Phase {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  is_default: boolean;
  default_duration_days: number | null;
  created_at: string;
  archived_at: string | null;
}

export interface Project {
  id: string;
  name: string;
  client_name: string | null;
  site_address: string | null;
  notes: string | null;
  estimated_completion_date: string;  // ISO date
  lead_time_weeks: number;
  start_date: string;                  // generated
  current_phase_id: string | null;
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  project_id: string;
  name: string;
  notes: string | null;
  sort_order: number;
  room_group_id: string | null;
  current_phase_id: string | null;
  estimated_start: string | null;
  estimated_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  project_id: string | null;
  room_id: string | null;
  room_group_id: string | null;
  task_type_id: string | null;
  assigned_to: string | null;
  completed_by: string | null;
  completed_at: string | null;
  priority: 1 | 2 | 3;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TaskChecklistItem {
  id: string;
  task_id: string;
  title: string;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
  created_at: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  items: string[];
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface TaskType {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface BusinessInfo {
  id: number;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  workshop_photo_url: string | null;
  updated_at: string;
}

export interface RoomPhaseHistory {
  id: string;
  room_id: string;
  phase_id: string;
  entered_at: string;
  entered_by: string | null;
  exited_at: string | null;
  notes: string | null;
}

export interface RoomGroup {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  notes: string | null;
  created_at: string;
}

export interface PhasePlan {
  id: string;
  room_group_id: string | null;
  project_id: string | null;
  phase_id: string;
  start_date: string;
  end_date: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventType {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  event_type_id: string | null;
  project_id: string | null;
  room_group_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// ── Production management ────────────────────────────────────────────────────

export type StageKind = "work" | "order";
export type ItemGranularity =
  | "material_order"
  | "material_order_painting"
  | "cutlist"
  | "room";
export type ProductionRefType = "material_order" | "cutlist" | "room";
export type SupplierKind = "in_house" | "outsource";
export type SupplierCategory = "cut_edge" | "hardware";
export type StepAppliesTo = "all" | "in_house" | "outsource";

export interface Supplier {
  id: string;
  name: string;
  kind: SupplierKind;
  category: SupplierCategory;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface Material {
  id: string;
  name: string;
  default_supplier_id: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface PaintType {
  id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface HardwareCatalogItem {
  id: string;
  name: string;
  default_supplier_id: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export type HardwareItemStatus = "to_order" | "ordered" | "received";

export interface HardwareOrder {
  id: string;
  title: string;
  cutlist_id: string | null;
  created_by: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface HardwareOrderItem {
  id: string;
  hardware_order_id: string;
  name: string;
  qty: number | null;
  supplier_id: string | null;
  status: HardwareItemStatus;
  ordered_at: string | null;
  received_at: string | null;
  completed_by: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProductionStage {
  id: string;
  name: string;
  slug: string;
  kind: StageKind;
  item_granularity: ItemGranularity;
  gates_on_stage_id: string | null;
  is_parallel: boolean;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
}

export interface ProductionStep {
  id: string;
  stage_id: string;
  name: string;
  sort_order: number;
  applies_to: StepAppliesTo;
  archived_at: string | null;
  created_at: string;
}

export interface Cutlist {
  id: string;
  project_id: string;
  name: string;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CutlistRoom {
  cutlist_id: string;
  room_id: string;
  sort_order: number;
}

export interface MaterialOrder {
  id: string;
  cutlist_id: string;
  material_name: string;
  supplier_id: string | null;
  paint_type_id: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProductionItem {
  id: string;
  stage_id: string;
  cutlist_id: string;
  ref_type: ProductionRefType;
  ref_id: string;
  notes: string | null;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

export interface ProductionItemStep {
  id: string;
  item_id: string;
  step_id: string;
  sort_order: number;
  completed_at: string | null;
  completed_by: string | null;
}

export type {
  NotificationType,
  Notification,
  PushSubscriptionRecord,
  NotificationPreferences,
} from "./types/notifications";
export { DEFAULT_NOTIFICATION_PREFERENCES } from "./types/notifications";
