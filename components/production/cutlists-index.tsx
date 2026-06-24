"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AddCutlistPanel } from "@/components/production/add-cutlist-panel";
import { ActionPill } from "@/components/production/action-pill";
import type { Supplier, Material, PaintType, HardwareCatalogItem } from "@/lib/types";

interface CutlistRow {
  id: string;
  name: string;
  projectName: string;
  roomCount: number;
  materialCount: number;
  hardwareCount: number;
}

interface Props {
  cutlists: CutlistRow[];
  projects: { id: string; name: string }[];
  suppliers: Supplier[];
  materials: Material[];
  paintTypes: PaintType[];
  hardwareCatalog: HardwareCatalogItem[];
  userId: string;
}

export function CutlistsIndex({ cutlists, projects, suppliers, materials, paintTypes, hardwareCatalog, userId }: Props) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="container py-6 md:py-8 px-4">
      <h1 className="text-lg font-semibold mb-5">Cutlists</h1>

      {cutlists.length === 0 ? (
        <div className="rounded-lg border bg-card px-4 py-10 text-center text-sm text-muted-foreground">No cutlists yet. Add one to get started.</div>
      ) : (
        <div className="space-y-2">
          {cutlists.map((c) => (
            <Link key={c.id} href={`/production/cutlists/${c.id}` as never} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 hover:bg-muted/40 transition-colors">
              <div className="min-w-0">
                <span className="font-medium">{c.projectName}</span>
                <span className="text-muted-foreground"> · {c.name}</span>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {c.roomCount} room{c.roomCount !== 1 ? "s" : ""} · {c.materialCount} cut &amp; edge · {c.hardwareCount} hardware order{c.hardwareCount !== 1 ? "s" : ""}
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <ActionPill label="Add cutlist" onClick={() => setAddOpen(true)} />
      <AddCutlistPanel open={addOpen} onClose={() => setAddOpen(false)} projects={projects} suppliers={suppliers} materials={materials} paintTypes={paintTypes} hardwareCatalog={hardwareCatalog} userId={userId} />
    </div>
  );
}
