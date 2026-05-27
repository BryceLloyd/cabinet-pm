import { lazy, type ComponentType } from "react";

export interface CardDefinition {
  type: string;
  title: string;
  description: string;
  component: React.LazyExoticComponent<ComponentType<CardProps>>;
  defaultSize: "sm" | "lg";
  actionLabel?: string;
  actionHref?: string;
}

export interface CardProps {
  userId: string;
}

export const CARD_REGISTRY: Record<string, CardDefinition> = {
  my_tasks: {
    type: "my_tasks",
    title: "My tasks",
    description: "Your open tasks sorted by due date",
    component: lazy(() => import("@/components/dashboard/cards/my-tasks-card")),
    defaultSize: "sm",
    actionLabel: "View all",
    actionHref: "/tasks",
  },
  upcoming_events: {
    type: "upcoming_events",
    title: "Upcoming events",
    description: "Calendar events in the next 14 days",
    component: lazy(() => import("@/components/dashboard/cards/upcoming-events-card")),
    defaultSize: "sm",
    actionLabel: "View all",
    actionHref: "/plan",
  },
  projects_by_phase: {
    type: "projects_by_phase",
    title: "Projects by phase",
    description: "Project counts grouped by phase",
    component: lazy(() => import("@/components/dashboard/cards/projects-by-phase-card")),
    defaultSize: "sm",
  },
  team_workload: {
    type: "team_workload",
    title: "Team workload",
    description: "Open tasks per team member",
    component: lazy(() => import("@/components/dashboard/cards/team-workload-card")),
    defaultSize: "sm",
  },
  personal_todos: {
    type: "personal_todos",
    title: "Personal todos",
    description: "Your personal tasks not linked to any project",
    component: lazy(() => import("@/components/dashboard/cards/personal-todos-card")),
    defaultSize: "sm",
    actionLabel: "View all",
    actionHref: "/tasks?filter=personal",
  },
  notes: {
    type: "notes",
    title: "Notes",
    description: "Quick scratch notepad",
    component: lazy(() => import("@/components/dashboard/cards/notes-card")),
    defaultSize: "sm",
  },
};

export const ALL_CARD_TYPES = Object.keys(CARD_REGISTRY);
