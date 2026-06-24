import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ProductionStage,
  ProductionStep,
  ProductionRefType,
  SupplierKind,
} from "@/lib/types";

// FK joins come back as a single object at runtime but are typed as arrays
// (see CLAUDE.md). Normalize to a single value.
function one<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export interface StepView {
  id: string; // production_item_steps.id (the instance to toggle)
  stepId: string;
  name: string;
  sortOrder: number;
  completedAt: string | null;
  completedByName: string | null;
}

export interface ItemView {
  id: string;
  refType: ProductionRefType;
  label: string;
  supplierId: string | null;
  supplierName: string | null;
  supplierKind: SupplierKind | null;
  paintTypeName: string | null;
  cutlistId: string;
  cutlistName: string;
  projectName: string;
  notes: string | null;
  completedAt: string | null;
  steps: StepView[];
}

export interface StageView {
  stage: ProductionStage;
  steps: ProductionStep[];
  items: ItemView[];
}

/** Load everything a section page needs for one stage (by slug). No gating — every item is independent. */
export async function loadStageView(
  supabase: SupabaseClient,
  slug: string
): Promise<StageView | null> {
  const { data: stage } = await supabase
    .from("production_stages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!stage || stage.archived_at) return null;

  const { data: steps } = await supabase
    .from("production_steps")
    .select("*")
    .eq("stage_id", stage.id)
    .is("archived_at", null)
    .order("sort_order");

  const { data: rawItems } = await supabase
    .from("production_items")
    .select(
      `id, ref_type, ref_id, notes, sort_order, completed_at, cutlist_id,
       cutlist:cutlists(id, name, project:projects(name)),
       item_steps:production_item_steps(id, step_id, completed_at, completed_by)`
    )
    .eq("stage_id", stage.id)
    .order("sort_order");

  const items = rawItems ?? [];
  const materialIds = items.filter((i) => i.ref_type === "material_order").map((i) => i.ref_id);
  const roomIds = items.filter((i) => i.ref_type === "room").map((i) => i.ref_id);

  const [materialsRes, roomsRes, suppliersRes, paintsRes, profilesRes] = await Promise.all([
    materialIds.length
      ? supabase.from("material_orders").select("id, material_name, supplier_id, paint_type_id").in("id", materialIds)
      : Promise.resolve({ data: [] as { id: string; material_name: string; supplier_id: string | null; paint_type_id: string | null }[] }),
    roomIds.length
      ? supabase.from("rooms").select("id, name").in("id", roomIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from("suppliers").select("id, name, kind"),
    supabase.from("paint_types").select("id, name"),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const matMap = new Map((materialsRes.data ?? []).map((m) => [m.id, m]));
  const supMap = new Map((suppliersRes.data ?? []).map((s) => [s.id, s]));
  const paintMap = new Map((paintsRes.data ?? []).map((p) => [p.id, p.name]));
  const roomMap = new Map((roomsRes.data ?? []).map((r) => [r.id, r.name]));
  const profMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
  const stepDefMap = new Map((steps ?? []).map((s) => [s.id, s]));

  const itemViews: ItemView[] = items.map((i) => {
    type ProjectRel = { name: string } | { name: string }[] | null;
    const cutlist = one<{ name: string; project: ProjectRel }>(i.cutlist);
    const project = one<{ name: string }>(cutlist?.project ?? null);

    let label = "(removed)";
    let supplierId: string | null = null;
    let supplierName: string | null = null;
    let supplierKind: SupplierKind | null = null;
    let paintTypeName: string | null = null;

    if (i.ref_type === "material_order") {
      const m = matMap.get(i.ref_id);
      if (m) {
        label = m.material_name;
        supplierId = m.supplier_id;
        const sup = m.supplier_id ? supMap.get(m.supplier_id) : null;
        supplierName = sup?.name ?? null;
        supplierKind = (sup?.kind as SupplierKind | undefined) ?? null;
        paintTypeName = m.paint_type_id ? paintMap.get(m.paint_type_id) ?? null : null;
      }
    } else if (i.ref_type === "room") {
      label = roomMap.get(i.ref_id) ?? "(removed)";
    } else {
      label = cutlist?.name || "Cutlist";
    }

    const itemSteps: StepView[] = (i.item_steps ?? [])
      .map((st: { id: string; step_id: string; completed_at: string | null; completed_by: string | null }) => {
        const def = stepDefMap.get(st.step_id);
        return {
          id: st.id,
          stepId: st.step_id,
          name: def?.name ?? "",
          sortOrder: def?.sort_order ?? 0,
          completedAt: st.completed_at,
          completedByName: st.completed_by ? profMap.get(st.completed_by) ?? null : null,
        };
      })
      .sort((a: StepView, b: StepView) => a.sortOrder - b.sortOrder);

    return {
      id: i.id,
      refType: i.ref_type,
      label,
      supplierId,
      supplierName,
      supplierKind,
      paintTypeName,
      cutlistId: i.cutlist_id,
      cutlistName: cutlist?.name ?? "",
      projectName: project?.name ?? "",
      notes: i.notes,
      completedAt: i.completed_at,
      steps: itemSteps,
    };
  });

  return { stage, steps: steps ?? [], items: itemViews };
}

export type HardwareItemStatus = "to_order" | "ordered" | "received";

export interface HardwareBatch {
  key: string; // orderId:supplierId
  orderId: string;
  orderTitle: string;
  cutlistLabel: string | null;
  supplierId: string | null;
  supplierName: string | null;
  status: HardwareItemStatus;
  itemIds: string[];
  items: { id: string; name: string; qty: number | null }[];
  sortOrder: number;
}

const STATUS_RANK: Record<HardwareItemStatus, number> = { to_order: 0, ordered: 1, received: 2 };

/** Hardware items grouped into (order × supplier) batches — the tracked unit on the Hardware page. */
export async function loadHardwareBatches(supabase: SupabaseClient): Promise<HardwareBatch[]> {
  const [ordersRes, suppliersRes] = await Promise.all([
    supabase
      .from("hardware_orders")
      .select(
        `id, title, cutlist_id, created_at,
         cutlist:cutlists(name, project:projects(name)),
         items:hardware_order_items(id, name, qty, supplier_id, status, sort_order)`
      )
      .order("created_at", { ascending: false }),
    supabase.from("suppliers").select("id, name"),
  ]);

  const supMap = new Map((suppliersRes.data ?? []).map((s) => [s.id, s.name]));
  type ProjectRel = { name: string } | { name: string }[] | null;
  type Item = { id: string; name: string; qty: number | null; supplier_id: string | null; status: HardwareItemStatus; sort_order: number };

  const batches: HardwareBatch[] = [];
  for (const o of ordersRes.data ?? []) {
    const cutlist = one<{ name: string; project: ProjectRel }>(o.cutlist);
    const project = one<{ name: string }>(cutlist?.project ?? null);
    const cutlistLabel = cutlist ? `${project?.name ?? ""} · ${cutlist.name}` : null;

    const bySupplier = new Map<string, Item[]>();
    for (const it of (o.items ?? []) as Item[]) {
      const key = it.supplier_id ?? "none";
      const list = bySupplier.get(key) ?? [];
      list.push(it);
      bySupplier.set(key, list);
    }
    for (const [supKey, list] of bySupplier) {
      list.sort((a, b) => a.sort_order - b.sort_order);
      // batch status = lowest status across its items (not "received" until all received)
      const status = list.reduce<HardwareItemStatus>(
        (acc, it) => (STATUS_RANK[it.status] < STATUS_RANK[acc] ? it.status : acc),
        "received"
      );
      batches.push({
        key: `${o.id}:${supKey}`,
        orderId: o.id,
        orderTitle: o.title,
        cutlistLabel,
        supplierId: supKey === "none" ? null : supKey,
        supplierName: supKey === "none" ? null : supMap.get(supKey) ?? null,
        status,
        itemIds: list.map((i) => i.id),
        items: list.map((i) => ({ id: i.id, name: i.name, qty: i.qty })),
        sortOrder: list[0]?.sort_order ?? 0,
      });
    }
  }
  return batches;
}

export type SegmentStatus = "done" | "progress" | "pending";

const HARDWARE_SLUG = "hardware-orders";
const HARDWARE_NAME = "Hardware orders";

export interface DashboardSection {
  slug: string;
  name: string;
  total: number;
  done: number;
  preview: string[];
}

export interface DashboardCutlistSection {
  slug: string;
  name: string;
  status: SegmentStatus;
  done: number;
  total: number;
}

export interface DashboardCutlist {
  id: string;
  name: string;
  projectName: string;
  currentStageName: string | null;
  sections: DashboardCutlistSection[];
}

export interface DashboardData {
  metrics: { activeCutlists: number; itemsInProgress: number; openOrders: number };
  sections: DashboardSection[];
  cutlists: DashboardCutlist[];
}

function seg(done: number, total: number): SegmentStatus {
  if (total === 0) return "pending";
  if (done === total) return "done";
  return done > 0 ? "progress" : "pending";
}

const CUT_EDGE_ORDERS = "cut-edge-orders";

/** Aggregate overview for the production dashboard: per-section live status + per-cutlist progress. */
export async function loadDashboard(supabase: SupabaseClient): Promise<DashboardData> {
  const [stagesRes, cutlistsRes, itemsRes, hwRes, matRes, supRes] = await Promise.all([
    supabase
      .from("production_stages")
      .select("id, name, slug, is_parallel, sort_order")
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("cutlists")
      .select("id, name, project:projects(name)")
      .order("created_at", { ascending: false }),
    supabase.from("production_items").select("stage_id, cutlist_id, ref_type, ref_id, completed_at"),
    supabase
      .from("hardware_orders")
      .select("id, title, cutlist_id, cutlist:cutlists(name, project:projects(name)), items:hardware_order_items(status)"),
    supabase.from("material_orders").select("id, supplier_id"),
    supabase.from("suppliers").select("id, kind"),
  ]);

  const stages = stagesRes.data ?? [];
  const cutlists = cutlistsRes.data ?? [];
  const items = itemsRes.data ?? [];
  const hwOrders = hwRes.data ?? [];
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const supKind = new Map((supRes.data ?? []).map((s) => [s.id, s.kind]));
  const matKind = new Map((matRes.data ?? []).map((m) => [m.id, m.supplier_id ? supKind.get(m.supplier_id) ?? "in_house" : "in_house"]));

  // Section list: split Cut & edge into in-house ("cut-edge") and outsourced ("cut-edge-orders").
  const sectionDefs: { key: string; name: string }[] = [];
  for (const s of stages) {
    if (s.slug === "cut-edge") {
      sectionDefs.push({ key: "cut-edge", name: "Cut & edge" });
      sectionDefs.push({ key: CUT_EDGE_ORDERS, name: "Cut & edge orders" });
    } else {
      sectionDefs.push({ key: s.slug, name: s.name });
    }
  }
  sectionDefs.push({ key: HARDWARE_SLUG, name: HARDWARE_NAME });

  function sectionKeyFor(it: { stage_id: string; ref_type: string; ref_id: string }): string {
    const stage = stageById.get(it.stage_id);
    if (!stage) return "";
    if (stage.slug === "cut-edge") {
      const kind = it.ref_type === "material_order" ? matKind.get(it.ref_id) ?? "in_house" : "in_house";
      return kind === "outsource" ? CUT_EDGE_ORDERS : "cut-edge";
    }
    return stage.slug;
  }

  const cutlistLabel = new Map<string, string>();
  for (const c of cutlists) {
    const project = one<{ name: string }>(c.project);
    cutlistLabel.set(c.id, `${project?.name ?? ""} · ${c.name}`);
  }

  // tally[cutlistId][sectionKey] = { total, done }
  const tally = new Map<string, Map<string, { total: number; done: number }>>();
  let itemsInProgress = 0;
  let openOrders = 0;
  for (const it of items) {
    const key = sectionKeyFor(it);
    if (!it.completed_at) {
      itemsInProgress++;
      if (key === CUT_EDGE_ORDERS) openOrders++;
    }
    let byKey = tally.get(it.cutlist_id);
    if (!byKey) { byKey = new Map(); tally.set(it.cutlist_id, byKey); }
    const e = byKey.get(key) ?? { total: 0, done: 0 };
    e.total++;
    if (it.completed_at) e.done++;
    byKey.set(key, e);
  }

  // Hardware per cutlist, by item (status received = done). Standalone = no cutlist.
  type HwItem = { status: HardwareItemStatus };
  const hwByCutlist = new Map<string, { total: number; done: number }>();
  const hwPreview: string[] = [];
  let hwTotal = 0, hwDone = 0;
  for (const o of hwOrders) {
    const oItems = (o.items ?? []) as HwItem[];
    if (oItems.length === 0) continue;
    const received = oItems.filter((i) => i.status === "received").length;
    hwTotal += oItems.length;
    hwDone += received;
    const open = received < oItems.length;
    if (open) openOrders++;
    const oCutlist = one<{ name: string; project: { name: string } | { name: string }[] | null }>(o.cutlist);
    const oProject = one<{ name: string }>(oCutlist?.project ?? null);
    const label = oCutlist ? `${oProject?.name ?? ""} · ${oCutlist.name}` : o.title;
    if (open && hwPreview.length < 6) hwPreview.push(label);
    if (o.cutlist_id) {
      const e = hwByCutlist.get(o.cutlist_id) ?? { total: 0, done: 0 };
      e.total += oItems.length;
      e.done += received;
      hwByCutlist.set(o.cutlist_id, e);
    }
  }

  function sectionTotals(key: string): { total: number; done: number; preview: string[] } {
    if (key === HARDWARE_SLUG) return { total: hwTotal, done: hwDone, preview: hwPreview };
    let total = 0, done = 0;
    const preview: string[] = [];
    for (const c of cutlists) {
      const e = tally.get(c.id)?.get(key);
      if (e) {
        total += e.total;
        done += e.done;
        if (e.done < e.total && preview.length < 6) preview.push(cutlistLabel.get(c.id) ?? "");
      }
    }
    return { total, done, preview };
  }

  const sections: DashboardSection[] = sectionDefs.map((def) => {
    const t = sectionTotals(def.key);
    return { slug: def.key, name: def.name, total: t.total, done: t.done, preview: t.preview };
  });

  let activeCutlists = 0;
  const dashCutlists: DashboardCutlist[] = cutlists.map((c) => {
    const byKey = tally.get(c.id) ?? new Map<string, { total: number; done: number }>();
    const hw = hwByCutlist.get(c.id) ?? { total: 0, done: 0 };
    let anyOpen = false;
    let currentStageName: string | null = null;

    const cutlistSections: DashboardCutlistSection[] = sectionDefs.map((def) => {
      const e = def.key === HARDWARE_SLUG ? hw : byKey.get(def.key) ?? { total: 0, done: 0 };
      const status = seg(e.done, e.total);
      if (e.total > 0 && e.done < e.total) {
        anyOpen = true;
        if (!currentStageName && def.key !== HARDWARE_SLUG) currentStageName = def.name;
      }
      return { slug: def.key, name: def.name, status, done: e.done, total: e.total };
    });

    const project = one<{ name: string }>(c.project);
    if (anyOpen) activeCutlists++;

    return { id: c.id, name: c.name, projectName: project?.name ?? "", currentStageName, sections: cutlistSections };
  });

  return {
    metrics: { activeCutlists, itemsInProgress, openOrders },
    sections,
    cutlists: dashCutlists.filter((c) => c.sections.some((s) => s.total > 0)),
  };
}
