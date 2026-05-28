"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import {
  differenceInDays,
  parseISO,
  addDays,
  format,
} from "date-fns";
import type { Phase, PhasePlan, RoomGroup } from "@/lib/types";

interface Props {
  projectStart: string;
  projectEnd: string;
  groups: RoomGroup[];
  phasePlans: PhasePlan[];
  phases: Phase[];
}

const ROW_H = 40;
const HEADER_H = 52;
const SECTION_LABEL_H = 20;

const SECTION_COLORS = [
  "rgba(59,130,246,0.08)",
  "rgba(234,179,8,0.08)",
  "rgba(168,85,247,0.08)",
  "rgba(34,197,94,0.08)",
];

export function ProjectGantt({ projectStart, projectEnd, groups, phasePlans, phases }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const phaseMap = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases]);

  const start = parseISO(projectStart);
  const end = parseISO(projectEnd);
  const totalDays = Math.max(1, differenceInDays(end, start) + 1);

  // Split lead time into 4 equal sections
  const sectionDays = totalDays / 4;
  const sections = Array.from({ length: 4 }, (_, i) => {
    const sectionStart = addDays(start, Math.round(sectionDays * i));
    const sectionEnd = i < 3 ? addDays(start, Math.round(sectionDays * (i + 1)) - 1) : end;
    return {
      index: i,
      start: sectionStart,
      end: sectionEnd,
      label: `${format(sectionStart, "d MMM")} – ${format(sectionEnd, "d MMM")}`,
    };
  });

  const rows: { id: string; label: string }[] =
    groups.length > 0
      ? groups.map((g) => ({ id: g.id, label: g.name }))
      : [{ id: "__project__", label: "Project" }];

  const LABEL_W = Math.max(100, Math.min(200, containerW * 0.2));
  const TIMELINE_W = Math.max(400, containerW - LABEL_W);
  const dayW = TIMELINE_W / totalDays;
  const height = HEADER_H + rows.length * ROW_H;

  const today = new Date();
  const todayInRange = today >= start && today <= end;

  if (containerW === 0) {
    return <div ref={containerRef} className="h-24" />;
  }

  return (
    <div ref={containerRef} className="overflow-x-auto">
      <svg width={LABEL_W + TIMELINE_W} height={height} className="block">
        {/* Section backgrounds */}
        {sections.map((s, i) => {
          const x = LABEL_W + differenceInDays(s.start, start) * dayW;
          const w = (differenceInDays(s.end, s.start) + 1) * dayW;
          return (
            <g key={i}>
              <rect x={x} y={0} width={w} height={height} fill={SECTION_COLORS[i]} />
              <line x1={x} y1={0} x2={x} y2={height} stroke="hsl(var(--border))" strokeWidth={0.5} />
              {/* Section number */}
              <text
                x={x + w / 2}
                y={16}
                textAnchor="middle"
                fontSize={11}
                fontWeight={600}
                className="fill-foreground"
              >
                Section {i + 1}
              </text>
              {/* Date range */}
              <text
                x={x + w / 2}
                y={30}
                textAnchor="middle"
                fontSize={9}
                className="fill-muted-foreground"
              >
                {s.label}
              </text>
            </g>
          );
        })}

        {/* Header / timeline border */}
        <line x1={LABEL_W} y1={HEADER_H - 8} x2={LABEL_W + TIMELINE_W} y2={HEADER_H - 8} stroke="hsl(var(--border))" />
        <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={height} stroke="hsl(var(--border))" />

        {/* Week ticks */}
        {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => {
          const tickDate = addDays(start, i * 7);
          const x = LABEL_W + differenceInDays(tickDate, start) * dayW;
          return (
            <line
              key={i}
              x1={x}
              y1={HEADER_H - 8}
              x2={x}
              y2={HEADER_H - 3}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
            />
          );
        })}

        {/* Rows */}
        {rows.map((row, i) => {
          const rowY = HEADER_H + i * ROW_H;
          const plans = phasePlans.filter((pp) =>
            row.id === "__project__"
              ? pp.project_id !== null
              : pp.room_group_id === row.id
          );

          return (
            <g key={row.id}>
              <line x1={0} y1={rowY} x2={LABEL_W + TIMELINE_W} y2={rowY} stroke="hsl(var(--border))" strokeWidth={0.5} />
              <text x={8} y={rowY + 24} fontSize={11} className="fill-foreground" fontWeight={500}>
                {row.label.length > 20 ? row.label.slice(0, 20) + "…" : row.label}
              </text>
              {plans.map((pp) => {
                const phase = phaseMap.get(pp.phase_id);
                if (!phase) return null;
                const ppStart = parseISO(pp.start_date);
                const ppEnd = parseISO(pp.end_date);
                const x = LABEL_W + Math.max(0, differenceInDays(ppStart, start)) * dayW;
                const w = Math.max(2, (differenceInDays(ppEnd, ppStart) + 1) * dayW);
                const barY = rowY + 10;
                return (
                  <g key={pp.id}>
                    <rect x={x} y={barY} width={w} height={20} rx={3} fill={phase.color} fillOpacity={0.85} />
                    {w > 40 && (
                      <text x={x + 4} y={barY + 14} fontSize={9} fill="white" fontWeight={500}>
                        {phase.name}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Today line */}
        {todayInRange && (() => {
          const todayX = LABEL_W + differenceInDays(today, start) * dayW;
          return (
            <line x1={todayX} y1={0} x2={todayX} y2={height} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="4 2" />
          );
        })()}
      </svg>
    </div>
  );
}
