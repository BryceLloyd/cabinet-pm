"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  startOfYear, endOfYear, eachMonthOfInterval, differenceInDays,
  format, max, min, parseISO, startOfMonth, endOfMonth,
  startOfWeek, addDays, isSameMonth, isToday,
} from "date-fns";
import { Plus, X, CalendarPlus } from "lucide-react";
import type { Project, Phase, RoomGroup, PhasePlan, CalendarEvent, EventType } from "@/lib/types";
import { EventDetailPanel } from "@/components/plan/event-detail-panel";

interface Props {
  year: number;
  initialView: "gantt" | "calendar";
  projects: Project[];
  phases: Phase[];
  roomGroups: RoomGroup[];
  phasePlans: PhasePlan[];
  showRoomGroups: boolean;
  calendarEvents: CalendarEvent[];
  eventTypes: EventType[];
}

export function YearPlanView({ year, initialView, projects, phases, roomGroups, phasePlans, showRoomGroups, calendarEvents, eventTypes }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [view, setView] = useState(initialView);
  const [scrollTrigger, setScrollTrigger] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState(calendarEvents);

  // Sync events state when server props change (e.g. after navigation)
  useEffect(() => {
    setEvents(calendarEvents);
  }, [calendarEvents]);

  const phaseMap = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);
  const eventTypeMap = useMemo(() => new Map(eventTypes.map((t) => [t.id, t])), [eventTypes]);
  const currentYear = new Date().getFullYear();

  const groupsByProject = useMemo(() => {
    const map = new Map<string, RoomGroup[]>();
    roomGroups.forEach((g) => {
      const list = map.get(g.project_id) || [];
      list.push(g);
      map.set(g.project_id, list);
    });
    return map;
  }, [roomGroups]);

  const plansByGroup = useMemo(() => {
    const map = new Map<string, PhasePlan[]>();
    phasePlans.forEach((pp) => {
      const key = pp.room_group_id || pp.project_id || "";
      const list = map.get(key) || [];
      list.push(pp);
      map.set(key, list);
    });
    return map;
  }, [phasePlans]);

  function toggleExpand(projectId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  function setQuery(updates: Record<string, string>) {
    const next = new URLSearchParams(sp);
    Object.entries(updates).forEach(([k, v]) => next.set(k, v));
    router.push(`/plan?${next.toString()}`);
  }

  function handleToday() {
    if (year !== currentYear) {
      setQuery({ year: String(currentYear) });
    }
    setScrollTrigger((n) => n + 1);
  }

  return (
    <div className="container py-6 md:py-8 px-4">
      <div className="sticky top-14 z-10 bg-background pb-4 -mt-6 pt-6 -mx-4 px-4 shadow-[0_1px_0_0_hsl(var(--border))]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
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
            <button
              onClick={handleToday}
              className="h-8 px-3 inline-flex items-center rounded-md border text-xs font-medium hover:bg-muted"
            >Today</button>
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
        <GanttView year={year} projects={projects} phaseMap={phaseMap} scrollTrigger={scrollTrigger}
          showRoomGroups={showRoomGroups} expanded={expanded} toggleExpand={toggleExpand}
          groupsByProject={groupsByProject} plansByGroup={plansByGroup} />
      ) : (
        <CalendarView year={year} projects={projects} phaseMap={phaseMap} scrollTrigger={scrollTrigger}
          events={events} eventTypeMap={eventTypeMap} eventTypes={eventTypes}
          roomGroups={roomGroups} groupsByProject={groupsByProject}
          onEventAdded={(e) => setEvents((prev) => [...prev, e])}
          onEventUpdated={(updated) => setEvents((prev) => prev.map((e) => e.id === updated.id ? updated : e))}
          onEventDeleted={(id) => setEvents((prev) => prev.filter((e) => e.id !== id))} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Gantt: SVG-based timeline, one row per project, spans start_date → completion.
// ─────────────────────────────────────────────────────────────────────────────
function GanttView({
  year, projects, phaseMap, scrollTrigger,
  showRoomGroups, expanded, toggleExpand, groupsByProject, plansByGroup,
}: {
  year: number; projects: Project[]; phaseMap: Map<string, Phase>; scrollTrigger: number;
  showRoomGroups: boolean; expanded: Set<string>; toggleExpand: (id: string) => void;
  groupsByProject: Map<string, RoomGroup[]>; plansByGroup: Map<string, PhasePlan[]>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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
  const SUB_ROW_H = 28;
  const HEADER_H = 32;
  const isMobile = containerW > 0 && containerW < 640;
  const LABEL_W = isMobile ? 90 : (containerW > 0 ? Math.max(100, Math.min(240, containerW * 0.2)) : 240);
  // On mobile: 4x viewport so ~3 months visible at a time
  const timelineViewport = containerW - LABEL_W;
  const TIMELINE_W = isMobile
    ? timelineViewport * 4  // 4x = 12 months, viewport shows ~3
    : (containerW > 0 ? Math.max(600, containerW - LABEL_W) : 980);
  const dayW = TIMELINE_W / totalDays;
  const truncLen = isMobile ? 8 : (LABEL_W > 160 ? 28 : 14);

  // Auto-scroll timeline so the current month starts at the left edge (mobile)
  useEffect(() => {
    if (!isMobile || !todayInRange || !scrollRef.current) return;
    const monthStartX = differenceInDays(startOfMonth(today), yearStart) * dayW;
    scrollRef.current.scrollLeft = monthStartX;
  }, [isMobile, todayInRange, containerW, scrollTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const rowOffsets = useMemo(() => {
    const offsets: number[] = [];
    let y = HEADER_H;
    projects.forEach((p) => {
      offsets.push(y);
      y += ROW_H;
      if (showRoomGroups && expanded.has(p.id)) {
        const groups = groupsByProject.get(p.id) || [];
        y += groups.length * SUB_ROW_H;
      }
    });
    return offsets;
  }, [projects, expanded, showRoomGroups, groupsByProject]); // eslint-disable-line react-hooks/exhaustive-deps

  const height = rowOffsets.length > 0
    ? rowOffsets[rowOffsets.length - 1] + ROW_H +
      (showRoomGroups && projects.length > 0 && expanded.has(projects[projects.length - 1].id)
        ? (groupsByProject.get(projects[projects.length - 1].id)?.length || 0) * SUB_ROW_H
        : 0)
    : HEADER_H;

  // Desktop: single SVG, all-in-one
  if (!isMobile) {
    return (
      <div ref={containerRef} className="rounded-lg border bg-card overflow-x-auto">
        <svg width={LABEL_W + TIMELINE_W} height={height} className="block">
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
          {projects.map((p, i) => {
            const start = max([parseISO(p.start_date), yearStart]);
            const end = min([parseISO(p.estimated_completion_date), yearEnd]);
            const x = LABEL_W + (differenceInDays(start, yearStart) * dayW);
            const w = Math.max(2, (differenceInDays(end, start) + 1) * dayW);
            const rowY = rowOffsets[i];
            const y = rowY + 8;
            const phase = p.current_phase_id ? phaseMap.get(p.current_phase_id) : null;
            const color = phase?.color || "#94a3b8";
            const projGroups = groupsByProject.get(p.id) || [];
            const isExpanded = showRoomGroups && expanded.has(p.id);
            const hasGroups = showRoomGroups && projGroups.length > 0;

            return (
              <g key={p.id}>
                <line x1={0} y1={rowY} x2={LABEL_W + TIMELINE_W} y2={rowY} stroke="hsl(var(--border))" strokeWidth={0.5} />
                {/* Expand chevron */}
                {hasGroups && (
                  <g onClick={() => toggleExpand(p.id)} className="cursor-pointer">
                    <text x={4} y={rowY + 22} fontSize={10} className="fill-muted-foreground">
                      {isExpanded ? "▼" : "▶"}
                    </text>
                  </g>
                )}
                <text x={hasGroups ? 16 : 12} y={rowY + 22} fontSize={12} className="fill-foreground" fontWeight={500}>
                  {p.name.length > truncLen ? p.name.slice(0, truncLen) + "…" : p.name}
                </text>
                {p.client_name && LABEL_W > 160 && (
                  <text x={hasGroups ? 16 : 12} y={rowY + 22} fontSize={10} className="fill-muted-foreground" textAnchor="start" dx={Math.min(160, p.name.length * 6.5 + 8)}>
                    {p.client_name.length > 16 ? p.client_name.slice(0, 16) + "…" : p.client_name}
                  </text>
                )}
                <a href={`/projects/${p.id}`}>
                  <rect x={x} y={y} width={w} height={20} rx={4} fill={color} fillOpacity={0.85} className="hover:fill-opacity-100 cursor-pointer" />
                  <line x1={x + w} y1={y - 2} x2={x + w} y2={y + 22} stroke={color} strokeWidth={2} />
                </a>

                {/* Sub-rows for room groups */}
                {isExpanded && projGroups.map((g, gi) => {
                  const subY = rowY + ROW_H + gi * SUB_ROW_H;
                  const groupPlans = plansByGroup.get(g.id) || [];
                  if (groupPlans.length === 0) {
                    return (
                      <g key={g.id}>
                        <line x1={0} y1={subY} x2={LABEL_W + TIMELINE_W} y2={subY} stroke="hsl(var(--border))" strokeWidth={0.3} strokeDasharray="2 2" />
                        <text x={28} y={subY + 18} fontSize={10} className="fill-muted-foreground">
                          {g.name.length > (truncLen - 2) ? g.name.slice(0, truncLen - 2) + "…" : g.name}
                        </text>
                      </g>
                    );
                  }
                  // Overall span: earliest start to latest end
                  const groupStart = groupPlans.reduce((minVal, pp) => pp.start_date < minVal ? pp.start_date : minVal, groupPlans[0].start_date);
                  const groupEnd = groupPlans.reduce((maxVal, pp) => pp.end_date > maxVal ? pp.end_date : maxVal, groupPlans[0].end_date);
                  const gStart = max([parseISO(groupStart), yearStart]);
                  const gEnd = min([parseISO(groupEnd), yearEnd]);
                  const gx = LABEL_W + differenceInDays(gStart, yearStart) * dayW;
                  const gw = Math.max(2, (differenceInDays(gEnd, gStart) + 1) * dayW);
                  // Use first phase's color as representative
                  const firstPlan = [...groupPlans].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
                  const gColor = firstPlan ? (phaseMap.get(firstPlan.phase_id)?.color || "#94a3b8") : "#94a3b8";

                  return (
                    <g key={g.id}>
                      <line x1={0} y1={subY} x2={LABEL_W + TIMELINE_W} y2={subY} stroke="hsl(var(--border))" strokeWidth={0.3} strokeDasharray="2 2" />
                      <text x={28} y={subY + 18} fontSize={10} className="fill-muted-foreground">
                        {g.name.length > (truncLen - 2) ? g.name.slice(0, truncLen - 2) + "…" : g.name}
                      </text>
                      <rect x={gx} y={subY + 4} width={gw} height={16} rx={3} fill={gColor} fillOpacity={0.6} />
                    </g>
                  );
                })}
              </g>
            );
          })}
          {todayInRange && (() => {
            const todayX = LABEL_W + differenceInDays(today, yearStart) * dayW;
            return (
              <g>
                <line x1={todayX} y1={0} x2={todayX} y2={height} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2" />
                <rect x={todayX - 22} y={2} width={44} height={16} rx={3} fill="#ef4444" />
                <text x={todayX} y={13} textAnchor="middle" fill="white" fontSize={9} fontWeight={600}>Today</text>
              </g>
            );
          })()}
        </svg>
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

  // Mobile: sticky label column + scrollable timeline
  return (
    <div ref={containerRef} className="rounded-lg border bg-card">
      <div className="flex">
        {/* Sticky label column */}
        <div className="shrink-0 border-r bg-card z-10" style={{ width: LABEL_W }}>
          <div className="h-8 border-b" />
          {projects.map((p, i) => {
            const projGroups = groupsByProject.get(p.id) || [];
            const isExpanded = showRoomGroups && expanded.has(p.id);
            const hasGroups = showRoomGroups && projGroups.length > 0;
            return (
              <div key={p.id}>
                <div
                  className="border-b px-2 flex items-center gap-1 text-[11px] font-medium truncate"
                  style={{ height: ROW_H }}
                  onClick={hasGroups ? () => toggleExpand(p.id) : undefined}
                >
                  {hasGroups && <span className="text-[9px] text-muted-foreground shrink-0">{isExpanded ? "▼" : "▶"}</span>}
                  <Link href={`/projects/${p.id}`} className="truncate hover:underline">
                    {p.name.length > truncLen ? p.name.slice(0, truncLen) + "…" : p.name}
                  </Link>
                </div>
                {isExpanded && projGroups.map((g) => (
                  <div key={g.id} className="border-b px-2 pl-4 flex items-center text-[10px] text-muted-foreground truncate" style={{ height: SUB_ROW_H }}>
                    {g.name.length > (truncLen - 2) ? g.name.slice(0, truncLen - 2) + "…" : g.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Scrollable timeline */}
        <div ref={scrollRef} className="overflow-x-auto no-scrollbar flex-1">
          <svg width={TIMELINE_W} height={height} className="block">
            <g>
              {months.map((m, i) => {
                const x = differenceInDays(m, yearStart) * dayW;
                const w = differenceInDays(endOfMonth(m), m) * dayW + dayW;
                return (
                  <g key={i}>
                    <line x1={x} y1={0} x2={x} y2={height} stroke="hsl(var(--border))" strokeWidth={0.5} />
                    <text x={x + w / 2} y={20} textAnchor="middle" className="fill-muted-foreground" fontSize={10}>
                      {format(m, "MMM")}
                    </text>
                  </g>
                );
              })}
              <line x1={0} y1={HEADER_H} x2={TIMELINE_W} y2={HEADER_H} stroke="hsl(var(--border))" />
            </g>
            {projects.map((p, i) => {
              const start = max([parseISO(p.start_date), yearStart]);
              const end = min([parseISO(p.estimated_completion_date), yearEnd]);
              const x = differenceInDays(start, yearStart) * dayW;
              const w = Math.max(2, (differenceInDays(end, start) + 1) * dayW);
              const rowY = rowOffsets[i];
              const y = rowY + 8;
              const phase = p.current_phase_id ? phaseMap.get(p.current_phase_id) : null;
              const color = phase?.color || "#94a3b8";
              const projGroups = groupsByProject.get(p.id) || [];
              const isExpanded = showRoomGroups && expanded.has(p.id);

              return (
                <g key={p.id}>
                  <line x1={0} y1={rowY} x2={TIMELINE_W} y2={rowY} stroke="hsl(var(--border))" strokeWidth={0.5} />
                  <a href={`/projects/${p.id}`}>
                    <rect x={x} y={y} width={w} height={20} rx={4} fill={color} fillOpacity={0.85} className="hover:fill-opacity-100 cursor-pointer" />
                    <line x1={x + w} y1={y - 2} x2={x + w} y2={y + 22} stroke={color} strokeWidth={2} />
                  </a>
                  {isExpanded && projGroups.map((g, gi) => {
                    const subY = rowY + ROW_H + gi * SUB_ROW_H;
                    const groupPlans = plansByGroup.get(g.id) || [];
                    if (groupPlans.length === 0) return <g key={g.id} />;
                    const groupStart = groupPlans.reduce((minVal, pp) => pp.start_date < minVal ? pp.start_date : minVal, groupPlans[0].start_date);
                    const groupEnd = groupPlans.reduce((maxVal, pp) => pp.end_date > maxVal ? pp.end_date : maxVal, groupPlans[0].end_date);
                    const gStart = max([parseISO(groupStart), yearStart]);
                    const gEnd = min([parseISO(groupEnd), yearEnd]);
                    const gx = differenceInDays(gStart, yearStart) * dayW;
                    const gw = Math.max(2, (differenceInDays(gEnd, gStart) + 1) * dayW);
                    const firstPlan = [...groupPlans].sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
                    const gColor = firstPlan ? (phaseMap.get(firstPlan.phase_id)?.color || "#94a3b8") : "#94a3b8";
                    return (
                      <g key={g.id}>
                        <line x1={0} y1={subY} x2={TIMELINE_W} y2={subY} stroke="hsl(var(--border))" strokeWidth={0.3} strokeDasharray="2 2" />
                        <rect x={gx} y={subY + 4} width={gw} height={16} rx={3} fill={gColor} fillOpacity={0.6} />
                      </g>
                    );
                  })}
                </g>
              );
            })}
            {todayInRange && (() => {
              const todayX = differenceInDays(today, yearStart) * dayW;
              return (
                <g>
                  <line x1={todayX} y1={0} x2={todayX} y2={height} stroke="#ef4444" strokeWidth={2} strokeDasharray="4 2" />
                  <rect x={todayX - 22} y={2} width={44} height={16} rx={3} fill="#ef4444" />
                  <text x={todayX} y={13} textAnchor="middle" fill="white" fontSize={9} fontWeight={600}>Today</text>
                </g>
              );
            })()}
          </svg>
        </div>
      </div>

      <div className="px-3 py-2 border-t flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span>Phases:</span>
        {Array.from(phaseMap.values()).map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar: 12-month grid, projects + events.
// ─────────────────────────────────────────────────────────────────────────────
function CalendarView({
  year, projects, phaseMap, scrollTrigger,
  events, eventTypeMap, eventTypes, roomGroups, groupsByProject,
  onEventAdded, onEventUpdated, onEventDeleted,
}: {
  year: number; projects: Project[]; phaseMap: Map<string, Phase>; scrollTrigger: number;
  events: CalendarEvent[]; eventTypeMap: Map<string, EventType>; eventTypes: EventType[];
  roomGroups: RoomGroup[]; groupsByProject: Map<string, RoomGroup[]>;
  onEventAdded: (e: CalendarEvent) => void;
  onEventUpdated: (e: CalendarEvent) => void;
  onEventDeleted: (id: string) => void;
}) {
  const todayMonthRef = useRef<HTMLDivElement>(null);
  const [quickAdd, setQuickAdd] = useState<{ date: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const months = eachMonthOfInterval({
    start: new Date(year, 0, 1),
    end: new Date(year, 11, 1),
  });

  useEffect(() => {
    if (!todayMonthRef.current) return;
    const timer = setTimeout(() => {
      if (!todayMonthRef.current) return;
      const rect = todayMonthRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY + rect.top - 80;
      window.scrollTo({ top: Math.max(0, scrollTop), behavior: "instant" });
    }, 100);
    return () => clearTimeout(timer);
  }, [year, scrollTrigger]);

  const today = new Date();
  const todayMonthIndex = year === today.getFullYear() ? today.getMonth() : -1;

  const byDate = useMemo(() => {
    const m = new Map<string, Project[]>();
    for (const p of projects) {
      const arr = m.get(p.estimated_completion_date) || [];
      arr.push(p);
      m.set(p.estimated_completion_date, arr);
    }
    return m;
  }, [projects]);

  const eventsByDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const arr = m.get(e.event_date) || [];
      arr.push(e);
      m.set(e.event_date, arr);
    }
    return m;
  }, [events]);

  return (
    <div className="space-y-4">
      {/* Quick add bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setQuickAdd({ date: format(today, "yyyy-MM-dd") })}
          className="h-8 px-3 inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90"
        >
          <CalendarPlus size={14} />
          Add event
        </button>
      </div>

      {/* Quick-add modal */}
      {quickAdd && (
        <QuickAddEvent
          date={quickAdd.date}
          projects={projects}
          eventTypes={eventTypes}
          roomGroups={roomGroups}
          groupsByProject={groupsByProject}
          onClose={() => setQuickAdd(null)}
          onAdded={(e) => { onEventAdded(e); setQuickAdd(null); }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {months.map((m, i) => (
          <MonthCard
            key={m.toISOString()}
            ref={i === todayMonthIndex ? todayMonthRef : undefined}
            month={m}
            byDate={byDate}
            eventsByDate={eventsByDate}
            eventTypeMap={eventTypeMap}
            phaseMap={phaseMap}
            isCurrentMonth={i === todayMonthIndex}
            onDayClick={(date) => setQuickAdd({ date })}
            onEventClick={(ev) => setSelectedEvent(ev)}
            onDeleteEvent={onEventDeleted}
          />
        ))}
      </div>

      {/* Event detail panel */}
      <EventDetailPanel
        event={selectedEvent}
        eventTypes={eventTypes}
        projects={projects}
        roomGroups={roomGroups}
        groupsByProject={groupsByProject}
        onClose={() => setSelectedEvent(null)}
        onUpdated={(updated) => {
          onEventUpdated(updated);
          setSelectedEvent(updated);
        }}
        onDeleted={(id) => {
          onEventDeleted(id);
          setSelectedEvent(null);
        }}
      />
    </div>
  );
}

/* ── Quick-add event form ── */

function QuickAddEvent({
  date, projects, eventTypes, roomGroups, groupsByProject, onClose, onAdded,
}: {
  date: string;
  projects: Project[];
  eventTypes: EventType[];
  roomGroups: RoomGroup[];
  groupsByProject: Map<string, RoomGroup[]>;
  onClose: () => void;
  onAdded: (e: CalendarEvent) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(date);
  const [typeId, setTypeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [saving, setSaving] = useState(false);

  const availableGroups = projectId ? (groupsByProject.get(projectId) || []) : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        title: title.trim(),
        event_date: eventDate,
        event_type_id: typeId || null,
        project_id: projectId || null,
        room_group_id: groupId || null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (!error && data) {
      onAdded(data as CalendarEvent);
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="bg-card border rounded-lg shadow-lg w-full max-w-md mx-4 p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-sm">New event</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. Template day, Worktop install"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Type</label>
            <select
              value={typeId}
              onChange={(e) => setTypeId(e.target.value)}
              className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">None</option>
              {eventTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Project</label>
            <select
              value={projectId}
              onChange={(e) => { setProjectId(e.target.value); setGroupId(""); }}
              className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Room group</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              disabled={!projectId || availableGroups.length === 0}
              className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">None</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md border text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !title.trim() || !eventDate}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Adding..." : "Add event"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Month card ── */

const MonthCard = forwardRef<HTMLDivElement, {
  month: Date;
  byDate: Map<string, Project[]>;
  eventsByDate: Map<string, CalendarEvent[]>;
  eventTypeMap: Map<string, EventType>;
  phaseMap: Map<string, Phase>;
  isCurrentMonth?: boolean;
  onDayClick: (date: string) => void;
  onEventClick: (event: CalendarEvent) => void;
  onDeleteEvent: (id: string) => void;
}>(function MonthCard({ month, byDate, eventsByDate, eventTypeMap, phaseMap, isCurrentMonth, onDayClick, onEventClick, onDeleteEvent }, ref) {
  const supabase = createClient();
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days: Date[] = [];
  let d = gridStart;
  while (d <= monthEnd || days.length % 7 !== 0) {
    days.push(d);
    d = addDays(d, 1);
  }

  async function handleDeleteEvent(id: string) {
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (!error) onDeleteEvent(id);
  }

  return (
    <div ref={ref} className={`rounded-lg bg-card ${isCurrentMonth ? "border-2 border-primary" : "border"}`}>
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
          const eventsToday = eventsByDate.get(key) || [];
          const totalItems = projectsToday.length + eventsToday.length;
          return (
            <div
              key={i}
              className={`min-h-[44px] border-b border-r last:border-r-0 p-1 text-[11px] group cursor-pointer hover:bg-muted/30 ${
                dayIsToday
                  ? "bg-primary/10"
                  : inMonth ? "" : "bg-muted/30 text-muted-foreground/50"
              }`}
              onClick={() => inMonth && onDayClick(key)}
            >
              <div className="flex items-center justify-between">
                <div className={`font-medium ${
                  dayIsToday
                    ? "inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px]"
                    : ""
                }`}>
                  {format(day, "d")}
                </div>
                {inMonth && (
                  <Plus size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
              {/* Projects */}
              {projectsToday.slice(0, 2).map((p) => {
                const phase = p.current_phase_id ? phaseMap.get(p.current_phase_id) : null;
                return (
                  <Link
                    key={p.id}
                    href={`/projects/${p.id}`}
                    onClick={(e) => e.stopPropagation()}
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
              {/* Events */}
              {eventsToday.slice(0, Math.max(1, 3 - projectsToday.length)).map((ev) => {
                const et = ev.event_type_id ? eventTypeMap.get(ev.event_type_id) : null;
                const color = et?.color || "#94a3b8";
                return (
                  <div
                    key={ev.id}
                    className="mt-0.5 truncate rounded px-1 py-0.5 text-[10px] flex items-center gap-0.5 group/ev cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: `${color}20`, color }}
                    title={`${ev.title}${et ? ` (${et.name})` : ""}`}
                    onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="truncate">{ev.title}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev.id); }}
                      className="ml-auto shrink-0 opacity-0 group-hover/ev:opacity-100 hover:text-destructive"
                      title="Delete event"
                    >
                      <X size={8} />
                    </button>
                  </div>
                );
              })}
              {totalItems > 3 && (
                <div className="text-[9px] text-muted-foreground mt-0.5">+{totalItems - 3} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
