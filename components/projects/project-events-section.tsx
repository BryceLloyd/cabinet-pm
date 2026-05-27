"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { CalendarPlus, Pencil, Trash2, X, Check } from "lucide-react";
import type { CalendarEvent, EventType, RoomGroup } from "@/lib/types";

interface Props {
  projectId: string;
  initialEvents: CalendarEvent[];
  eventTypes: EventType[];
  roomGroups: RoomGroup[];
}

export function ProjectEventsSection({ projectId, initialEvents, eventTypes, roomGroups }: Props) {
  const supabase = createClient();
  const [events, setEvents] = useState(initialEvents);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state shared between add and edit
  const [form, setForm] = useState({
    title: "",
    event_date: format(new Date(), "yyyy-MM-dd"),
    event_type_id: "",
    room_group_id: "",
    notes: "",
  });

  const eventTypeMap = new Map(eventTypes.map((t) => [t.id, t]));

  function resetForm() {
    setForm({
      title: "",
      event_date: format(new Date(), "yyyy-MM-dd"),
      event_type_id: "",
      room_group_id: "",
      notes: "",
    });
  }

  function startAdd() {
    setEditingId(null);
    resetForm();
    setAdding(true);
  }

  function startEdit(event: CalendarEvent) {
    setAdding(false);
    setEditingId(event.id);
    setForm({
      title: event.title,
      event_date: event.event_date,
      event_type_id: event.event_type_id || "",
      room_group_id: event.room_group_id || "",
      notes: event.notes || "",
    });
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    resetForm();
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.event_date) return;
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        title: form.title.trim(),
        event_date: form.event_date,
        event_type_id: form.event_type_id || null,
        project_id: projectId,
        room_group_id: form.room_group_id || null,
        notes: form.notes.trim() || null,
        created_by: user!.id,
      })
      .select("*")
      .single();

    if (!error && data) {
      setEvents((prev) => [...prev, data as CalendarEvent].sort((a, b) => a.event_date.localeCompare(b.event_date)));
      setAdding(false);
      resetForm();
    }
    setSaving(false);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !form.title.trim() || !form.event_date) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("calendar_events")
      .update({
        title: form.title.trim(),
        event_date: form.event_date,
        event_type_id: form.event_type_id || null,
        room_group_id: form.room_group_id || null,
        notes: form.notes.trim() || null,
      })
      .eq("id", editingId)
      .select("*")
      .single();

    if (!error && data) {
      setEvents((prev) =>
        prev
          .map((ev) => (ev.id === editingId ? (data as CalendarEvent) : ev))
          .sort((a, b) => a.event_date.localeCompare(b.event_date))
      );
      setEditingId(null);
      resetForm();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (!error) {
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    }
  }

  const sorted = [...events].sort((a, b) => a.event_date.localeCompare(b.event_date));

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-5 py-3.5 border-b flex items-center justify-between">
        <h2 className="font-medium">Events</h2>
        {!adding && !editingId && (
          <button
            onClick={startAdd}
            className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md border text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <CalendarPlus size={13} />
            Add event
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <EventForm
          form={form}
          setForm={setForm}
          eventTypes={eventTypes}
          roomGroups={roomGroups}
          saving={saving}
          onSubmit={handleAdd}
          onCancel={cancel}
          submitLabel="Add event"
        />
      )}

      {/* Event list */}
      {sorted.length === 0 && !adding ? (
        <div className="px-5 py-8 text-sm text-muted-foreground text-center">
          No events for this project yet.
        </div>
      ) : (
        <ul className="divide-y">
          {sorted.map((ev) => {
            const et = ev.event_type_id ? eventTypeMap.get(ev.event_type_id) : null;
            const group = ev.room_group_id ? roomGroups.find((g) => g.id === ev.room_group_id) : null;
            const color = et?.color || "#94a3b8";

            if (editingId === ev.id) {
              return (
                <li key={ev.id}>
                  <EventForm
                    form={form}
                    setForm={setForm}
                    eventTypes={eventTypes}
                    roomGroups={roomGroups}
                    saving={saving}
                    onSubmit={handleEdit}
                    onCancel={cancel}
                    submitLabel="Save"
                  />
                </li>
              );
            }

            return (
              <li key={ev.id} className="px-5 py-3 flex items-center gap-3 group">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{ev.title}</span>
                    {et && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded shrink-0"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {et.name}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    <span>{format(new Date(ev.event_date), "EEE, MMM d yyyy")}</span>
                    {group && <span>· {group.name}</span>}
                    {ev.notes && <span>· {ev.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button
                    onClick={() => startEdit(ev)}
                    className="h-7 w-7 rounded-md border grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted"
                    title="Edit event"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(ev.id)}
                    className="h-7 w-7 rounded-md border grid place-items-center text-muted-foreground hover:text-destructive hover:bg-muted"
                    title="Delete event"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/* ── Reusable event form ── */

function EventForm({
  form,
  setForm,
  eventTypes,
  roomGroups,
  saving,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  form: { title: string; event_date: string; event_type_id: string; room_group_id: string; notes: string };
  setForm: (f: typeof form) => void;
  eventTypes: EventType[];
  roomGroups: RoomGroup[];
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  return (
    <form onSubmit={onSubmit} className="px-5 py-4 border-b space-y-3 bg-muted/30">
      <div>
        <input
          autoFocus
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Event title (e.g. Template day, Worktop install)"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Date</label>
          <input
            type="date"
            value={form.event_date}
            onChange={(e) => setForm({ ...form, event_date: e.target.value })}
            className="w-full h-8 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Type</label>
          <select
            value={form.event_type_id}
            onChange={(e) => setForm({ ...form, event_type_id: e.target.value })}
            className="w-full h-8 px-2 rounded-md border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">None</option>
            {eventTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Room group</label>
          <select
            value={form.room_group_id}
            onChange={(e) => setForm({ ...form, room_group_id: e.target.value })}
            disabled={roomGroups.length === 0}
            className="w-full h-8 px-2 rounded-md border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">None</option>
            {roomGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full h-8 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Notes (optional)"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-3 rounded-md border text-xs hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !form.title.trim() || !form.event_date}
          className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
