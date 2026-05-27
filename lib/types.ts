// Hand-written DB types. Regenerate from Supabase later with:
//   npx supabase gen types typescript --project-id xxx > lib/database.types.ts

export type ProjectStatus = "planning" | "active" | "on_hold" | "complete" | "cancelled";

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: "admin" | "member";
  theme_preference: "light" | "dark" | "system";
  density_preference: "compact" | "comfortable";
  notification_preferences: Record<string, unknown>;
  created_at: string;
}

export interface Phase {
  id: string;
  name: string;
  sort_order: number;
  color: string;
  is_default: boolean;
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
  assigned_to: string | null;
  completed_by: string | null;
  completed_at: string | null;
  priority: 1 | 2 | 3;
  created_by: string;
  created_at: string;
  updated_at: string;
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
