"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  startOfYear, endOfYear, eachMonthOfInterval, differenceInDays,
  format, max, min, parseISO, startOfMonth, endOfMonth,
  startOfWeek, addDays, isSameMonth, isToday,
} from "date-fns";
import type { Project, Phase } from "@/lib/types";

interface Props {
  year: number;
  initialView: "gantt" | "calendar";
  projects: Project[];
  phases: Phase[];
}

export function YearPlanView({ year, initialView, projects, phases }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [view, setView] = useState(initialView);

  const phaseMap = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);

  function setQuery(updates: Record<string, string>) {
    const next = new URLSearchParams(sp);
    Object.entries(updates).forEach(([k, v]) => next.set(k, v));
    router.push(`/plan?${next.toString()}`);
  }

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="sticky top-0 z-10 bg-background pb-4 -mt-2 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Year plan</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {projects.length} projects · scheduled backwards from completion date
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-md border">
              <button
                onClick={() => setQuery({ year: String(year - 1) })}
                className="h-8 w-8 grid place-items-center text-sm hover:bg-muted"
              >‹</button>
              <span className="px-3 text-sm font-medium w-16 text-center">{year}</span>
              <button
                onClick={() => setQuery({ year: String(year + 1) })}
                className="h-8 w-8 grid place-items-center text-sm hover:bg-muted"
              >›</button>
            </div>
            <div className="flex items-center rounded-md border p-0.5">
              <button
                onClick={() => { setView("gantt"); setQuery({ view: "gantt" }); }}
                className={`h-7 px-3 text-xs rounded ${view === "gantt" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >Gantt</button>
              <button
                onClick={() => { setView("calendar"); setQuery({ view: "calendar" }); }}
                className={`h-7 px-3 text-xs rounded ${view === "calendar" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >Calendar</button>
            </div>
            <Link
              href="/projects/new"
              className="h-8 px-3 inline-flex items-center rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
            >New project</Link>
          </div>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <p className="text-sm text-muted-foreground">No projects scheduled for {year}.</p>
          <Link href="/projects/new" className="mt-3 inline-block text-sm font-medium underline">
            Add your first project
          </Link>
        </div>
      ) : view === "gantt" ? (
        <GanttView year={year} projects={projects} phaseMap={phaseMap} />
      ) : (
        <CalendarView year={year} projects={projects} phaseMap={phaseMap} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gantt: SVG-based timeline, one row per project, spans start_date → completion.
// ─────────────────────────────────────────────────────────────────────────────
function GanttView({
  year, projects, phaseMap,
}: { year: number; projects: Project[]; phaseMap: Map<string, Phase> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const yearStart = startOfYear(new Date(year, 0, 1));
  const yearEnd = endOfYear(new Date(year, 0, 1));
  const totalDays = differenceInDays(yearEnd, yearStart) + 1;
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });
  const today = new Date();
  const todayInRange = today >= yearStart && today <= yearEnd;

  const ROW_H = 36;
  const HEADER_H = 32;
  const isMobile = containerW > 0 && containerW < 640;
  const LABEL_W = isMobile ? 80 : (containerW > 0 ? Math.max(100, Math.min(240, containerW * 0.2)) : 240);
  // On mobile: make SVG wide enough for all 12 months but only show ~4 months in viewport
  const TIMELINE_W = isMobile
    ? (containerW - LABEL_W) * 3  // 3x viewport = 12 months, viewport shows ~4
    : (containerW > 0 ? Math.max(600, containerW - LABEL_W) : 980);
  const dayW = TIMELINE_W / totalDays;
  const height = HEADER_H + projects.length * ROW_H;
  const truncLen = isMobile ? 10 : (LABEL_W > 160 ? 28 : 14);

  // Auto-scroll Gantt to today on mobile
  useEffect(() => {
    if (!isMobile || !todayInRange || !containerRef.current) return;
    const todayX = LABEL_W + differenceInDays(today, yearStart) * dayW;
    // Scroll so today is ~25% from left edge
    const scrollTo = Math.max(0, todayX - (containerW - LABEL_W) * 0.25);
    containerRef.current.scrollLeft = scrollTo;
  }, [isMobile, todayInRange, containerW]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="rounded-lg border bg-card overflow-x-auto no-scrollbar">
      <svg width={LABEL_W + TIMELINE_W} height={height} className="block">
        {/* Month header */}
        <g>
          {months.map((m, i) => {
            const x = LABEL_W + (differenceInDays(m, yearStart) * dayW);
            const w = differenceInDays(endOfMonth(m), m) * dayW + dayW;
            return (
              <g key={i}>
                <line x1={x} y1={0} x2={x} y2={height} stroke="hsl(var(--border))" strokeWidth={0.5} />
                <text x={x + w / 2} y={20} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>
                  {format(m, "MMM")}
                </text>
              </g>
            );
          })}
          <line x1={LABEL_W} y1={HEADER_H} x2={LABEL_W + TIMELINE_W} y2={HEADER_H} stroke="hsl(var(--border))" />
          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={height} stroke="hsl(var(--border))" />
        </g>

        {/* Project rows */}
        {projects.map((p, i) => {
          const start = max([parseISO(p.start_date), yearStart]);
          const end = min([parseISO(p.estimated_completion_date), yearEnd]);
          const x = LABEL_W + (differenceInDays(start, yearStart) * dayW);
          const w = Math.max(2, (differenceInDays(end, start) + 1) * dayW);
          const y = HEADER_H + i * ROW_H + 8;
          const phase = p.current_phase_id ? phaseMap.get(p.current_phase_id) : null;
          const color = phase?.color || "#94a3b8";

          return (
            <g key={p.id}>
              {/* Row divider */}
              <line x1={0} y1={HEADER_H + i * ROW_H} x2={LABEL_W + TIMELINE_W} y2={HEADER_H + i * ROW_H} stroke="hsl(var(--border))" strokeWidth={0.5} />
              {/* Label */}
              <text x={12} y={HEADER_H + i * ROW_H + 22} fontSize={12} className="fill-foreground" fontWeight={500}>
                {p.name.length > truncLen ? p.name.slice(0, truncLen) + "…" : p.name}
              </text>
              {p.client_name && LABEL_W > 160 && (
                <text x={12} y={HEADER_H + i * ROW_H + 22} fontSize={10} className="fill-muted-foreground" textAnchor="start" dx={Math.min(160, p.name.length * 6.5 + 8)}>
                  {p.client_name.length > 16 ? p.client_name.slice(0, 16) + "…" : p.client_name}
                </text>
              )}
              {/* Bar */}
              <a href={`/projects/${p.id}`}>
                <rect x={x} y={y} width={w} height={20} rx={4} fill={color} fillOpacity={0.85} className="hover:fill-opacity-100 cursor-pointer" />
                {/* Completion marker */}
                <line x1={x + w} y1={y - 2} x2={x + w} y2={y + 22} stroke={color} strokeWidth={2} />
              </a>
            </g>
          );
        })}

        {/* Today line */}
        {todayInRange && (() => {
          const todayX = LABEL_W + differenceInDays(today, yearStart) * dayW;
          return (
            <g>
              <line
                x1={todayX} y1={0} x2={todayX} y2={height}
                stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2"
              />
              <rect x={todayX - 22} y={2} width={44} height={16} rx={3} fill="#ef4444" />
              <text x={todayX} y={13} textAnchor="middle" fill="white" fontSize={9} fontWeight={600}>
                Today
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="px-4 py-3 border-t flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span>Phases:</span>
        {Array.from(phaseMap.values()).map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar: 12-month grid, projects show on their completion date.
// ─────────────────────────────────────────────────────────────────────────────
function CalendarView({
  year, projects, phaseMap,
}: { year: number; projects: Project[]; phaseMap: Map<string, Phase> }) {
  const todayMonthRef = useRef<HTMLDivElement>(null);
  const months = eachMonthOfInterval({
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 1),
  });

  // Auto-scroll to current month on mount
  useEffect(() => {
    if (todayMonthRef.current) {
      todayMonthRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [year]);

  const today = new Date();
  const todayMonthIndex = year === today.getFullYear() ? today.getMonth() : -1;

  // Group projects by completion date (YYYY-MM-DD)
  const byDate = useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      const arr = m.get(p.estimated_completion_date) || [];
      arr.push(p);
      m.set(p.estimated_completion_date, arr);
    }
    return m;
  }, [projects]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {months.map((m, i) => (
        <MonthCard
          key={m.toISOString()}
          ref={i === todayMonthIndex ? todayMonthRef : undefined}
          month={m}
          byDate={byDate}
          phaseMap={phaseMap}
          isCurrentMonth={i === todayMonthIndex}
        />
      ))}
    </div>
  );
}

const MonthCard = forwardRef<HTMLDivElement, {
  month: Date;
  byDate: Map<string, Project[]>;
  phaseMap: Map<string, Phase>;
  isCurrentMonth?: boolean;
}>(function MonthCard({ month, byDate, phaseMap, isCurrentMonth }, ref) {
  // Build the calendar grid: start from the Monday of the week containing day 1.
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = gridStart;
  while (d <= monthEnd || days.length % 7 !== 0) {
    days.push(d);
    d = addDays(d, 1);
  }

  return (
    <div ref={ref} className={`rounded-lg border bg-card ${isCurrentMonth ? "ring-2 ring-primary" : ""}`}>
      <div className={`px-4 py-2.5 border-b ${isCurrentMonth ? "bg-primary/5" : ""}`}>
        <h3 className="font-medium text-sm">{format(month, "MMMM")}</h3>
      </div>
      <div className="grid grid-cols-7 text-[10px] text-muted-foreground border-b">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="px-1.5 py-1 text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, month);
          const dayIsToday = isToday(day);
          const key = format(day, "yyyy-MM-dd");
          const projectsToday = byDate.get(key) || [];
          return (
            <div
              key={i}
              className={`min-h-[44px] border-b border-r last:border-r-0 p-1 text-[11px] ${
                dayIsToday
                  ? "bg-primary/10"
                  : inMonth ? "" : "bg-muted/30 text-muted-foreground/50"
              }`}
            >
              <div className={`font-medium ${
                dayIsToday
                  ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px]"
                  : ""
              }`}>
                {format(day, "d")}
              </div>
              {projectsToday.slice(0, 2).map((p) => {
                const phase = p.current_phase_id ? phaseMap.get(p.current_phase_id) : null;
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    className="block mt-0.5 truncate rounded px-1 py-0.5 text-[10px] hover:opacity-80"
                    style={{
                      backgroundColor: phase ? `${phase.color}25` : "hsl(var(--muted))",
                      color: phase?.color || "inherit",
                    }}
                    title={`${p.name} — ${p.client_name || ""}`}
                  >
                    {p.name}
                  </Link>
                );
              })}
              {projectsToday.length > 2 && (
                <div className="text-[9px] text-muted-foreground mt-0.5">+{projectsToday.length - 2} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
