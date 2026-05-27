"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "next-themes";

function getInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const words = fullName.trim().split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return fullName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

// Deterministic color from string
function avatarColor(str: string): string {
  const colors = [
    "#e11d48", "#db2777", "#c026d3", "#9333ea",
    "#7c3aed", "#4f46e5", "#2563eb", "#0284c7",
    "#0891b2", "#0d9488", "#059669", "#16a34a",
    "#ca8a04", "#ea580c", "#dc2626",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function UserMenu({
  fullName,
  email,
  role,
  avatarUrl,
}: {
  fullName: string | null;
  email: string;
  role: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const initials = getInitials(fullName, email);
  const bg = avatarColor(email);
  const { theme, setTheme } = useTheme();

  function cycleTheme() {
    const next = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    // Persist to DB (fire-and-forget)
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").update({ theme_preference: next }).eq("id", user.id);
      }
    });
  }

  function themeLabel() {
    if (theme === "light") return "Light";
    if (theme === "dark") return "Dark";
    return "System";
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 overflow-hidden"
          style={{ backgroundColor: avatarUrl ? undefined : bg }}
          aria-label="User menu"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-8 w-8 object-cover" />
          ) : (
            initials
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[200px] rounded-lg border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {/* Header */}
          <div className="px-3 py-2">
            <div className="text-sm font-medium">{fullName || email}</div>
            {fullName && <div className="text-xs text-muted-foreground">{email}</div>}
            <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-muted capitalize">
              {role}
            </span>
          </div>

          <DropdownMenu.Separator className="h-px bg-border my-1" />

          <DropdownMenu.Item asChild>
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer outline-none hover:bg-muted focus:bg-muted"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              Settings
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={cycleTheme}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer outline-none hover:bg-muted focus:bg-muted"
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            ) : theme === "light" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" /><path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" /><path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="3" rx="2" />
                <line x1="8" x2="16" y1="21" y2="21" />
                <line x1="12" x2="12" y1="17" y2="21" />
              </svg>
            )}
            Theme: {themeLabel()}
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-border my-1" />

          <DropdownMenu.Item
            onSelect={handleSignOut}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm cursor-pointer outline-none hover:bg-muted focus:bg-muted text-muted-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
