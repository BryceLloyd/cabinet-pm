"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { SlidePanel } from "@/components/ui/slide-panel";

interface AddEventPanelProps {
  open: boolean;
  date?: string;
  projects: { id: string; name: string }[];
  eventTypes: { id: string; name: string; color: string; archived_at: string | null }[];
  roomGroups: { id: string; name: string; project_id: string }[];
  groupsByProject: Map<string, { id: string; name: string; project_id: string }[]>;
  onClose: () => void;
  onCreated: (event: any) => void;
}

export function AddEventPanel({
  open,
  date,
  projects,
  eventTypes,
  roomGroups,
  groupsByProject,
  onClose,
  onCreated,
}: AddEventPanelProps) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState(date || format(new Date(), "yyyy-MM-dd"));
  const [typeId, setTypeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const availableGroups = projectId ? (groupsByProject.get(projectId) || []) : [];

  // Sync date field when date prop changes or panel opens
  useEffect(() => {
    if (open) {
      setEventDate(date || format(new Date(), "yyyy-MM-dd"));
    }
  }, [date, open]);

  function resetForm() {
    setTitle("");
    setEventDate(date || format(new Date(), "yyyy-MM-dd"));
    setTypeId("");
    setProjectId("");
    setGroupId("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate || saving) return;
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
        notes: notes.trim() || null,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (!error && data) {
      onCreated(data);
      resetForm();
      onClose();
    }
    setSaving(false);
  }

  const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5";
  const inputClass = "w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <SlidePanel open={open} onClose={onClose} title="New Event">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <div>
          <label className={labelClass}>Title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
            placeholder="e.g. Template day, Worktop install"
          />
        </div>

        {/* Date */}
        <div>
          <label className={labelClass}>Date</label>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Event Type */}
        <div>
          <label className={labelClass}>Event Type</label>
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className={inputClass}
          >
            <option value="">None</option>
            {eventTypes
              .filter((t) => !t.archived_at)
              .map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
          </select>
        </div>

        {/* Project */}
        <div>
          <label className={labelClass}>Project</label>
          <select
            value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setGroupId(""); }}
            className={inputClass}
          >
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Room Group */}
        <div>
          <label className={labelClass}>Room Group</label>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            disabled={!projectId || availableGroups.length === 0}
            className={`${inputClass} disabled:opacity-50`}
          >
            <option value="">None</option>
            {availableGroups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Add notes..."
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving || !title.trim() || !eventDate}
          className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creating..." : "Create event"}
        </button>
      </form>
    </SlidePanel>
  );
}
