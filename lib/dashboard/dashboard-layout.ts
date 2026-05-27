export interface CardLayout {
  cardType: string;
  position: number;
}

const STORAGE_PREFIX = "cabinet-pm-dashboard-";

const DEFAULT_LAYOUT: CardLayout[] = [
  { cardType: "my_tasks", position: 0 },
  { cardType: "upcoming_deadlines", position: 1 },
  { cardType: "projects_by_phase", position: 2 },
];

export function getDefaultLayout(): CardLayout[] {
  return DEFAULT_LAYOUT.map((c) => ({ ...c }));
}

export function getLayout(userId: string): CardLayout[] {
  if (typeof window === "undefined") return getDefaultLayout();
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + userId);
    if (!raw) return getDefaultLayout();
    const parsed = JSON.parse(raw) as CardLayout[];
    if (!Array.isArray(parsed) || parsed.length === 0) return getDefaultLayout();
    return parsed.sort((a, b) => a.position - b.position);
  } catch {
    return getDefaultLayout();
  }
}

export function setLayout(userId: string, layout: CardLayout[]): void {
  if (typeof window === "undefined") return;
  const ordered = layout.map((c, i) => ({ cardType: c.cardType, position: i }));
  localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(ordered));
}
