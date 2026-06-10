import Link from "next/link";
import { User, Bell, Building2, Users, Layers, CalendarDays, Tag, ChevronRight, ListChecks } from "lucide-react";
import { SettingsDesktopRedirect } from "./desktop-redirect";

const SETTINGS_SECTIONS = [
  { href: "/settings/profile", label: "Profile", description: "Name, avatar, appearance", icon: User },
  { href: "/settings/notifications", label: "Notifications", description: "Push and in-app alerts", icon: Bell },
  { href: "/settings/business", label: "Business", description: "Company info and branding", icon: Building2 },
  { href: "/settings/team", label: "Team", description: "Members and permissions", icon: Users },
  { href: "/settings/phases", label: "Phases", description: "Project phase pipeline", icon: Layers },
  { href: "/settings/event-types", label: "Event types", description: "Calendar event categories", icon: CalendarDays },
  { href: "/settings/task-types", label: "Task types", description: "Task categories", icon: Tag },
  { href: "/settings/task-templates", label: "Task templates", description: "Reusable task checklists", icon: ListChecks },
] as const;

export default function SettingsIndexPage() {
  return (
    <>
      <SettingsDesktopRedirect />
      <div className="space-y-1 md:hidden">
        {SETTINGS_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.href}
              href={section.href as any}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted transition-colors"
            >
              <Icon size={18} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{section.label}</div>
                <div className="text-xs text-muted-foreground">{section.description}</div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
