"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format, addWeeks } from "date-fns";
import { SlidePanel } from "@/components/ui/slide-panel";

interface AddProjectPanelProps {
  open: boolean;
  onClose: () => void;
}

export function AddProjectPanel({ open, onClose }: AddProjectPanelProps) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [completionDate, setCompletionDate] = useState(
    format(addWeeks(new Date(), 8), "yyyy-MM-dd")
  );
  const [leadTimeWeeks, setLeadTimeWeeks] = useState(8);
  const [notes, setNotes] = useState("");

  const computedStart = format(
    addWeeks(new Date(completionDate || new Date()), -leadTimeWeeks),
    "MMM d, yyyy"
  );

  function resetForm() {
    setName("");
    setClientName("");
    setSiteAddress("");
    setCompletionDate(format(addWeeks(new Date(), 8), "yyyy-MM-dd"));
    setLeadTimeWeeks(8);
    setNotes("");
    setError(null);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { setSaving(false); return; }

    const { data: phase } = await supabase
      .from("phases")
      .select("id")
      .eq("is_default", true)
      .is("archived_at", null)
      .maybeSingle();

    const { data, error: insertError } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        client_name: clientName.trim() || null,
        site_address: siteAddress.trim() || null,
        notes: notes.trim() || null,
        estimated_completion_date: completionDate,
        lead_time_weeks: leadTimeWeeks,
        current_phase_id: phase?.id || null,
        created_by: user.user.id,
        status: "planning",
      })
      .select("id")
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
    } else {
      resetForm();
      onClose();
      router.push(`/projects/${data.id}`);
    }
  }

  const labelClass =
    "block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5";
  const inputClass =
    "w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <SlidePanel open={open} onClose={handleClose} title="New Project">
      {/* Name */}
      <div className="mb-4">
        <label className={labelClass}>
          Project name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="e.g. Smith Residence — Main Kitchen"
          autoFocus
          className={inputClass}
        />
      </div>

      {/* Client name */}
      <div className="mb-4">
        <label className={labelClass}>Client name</label>
        <input
          type="text"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Site address */}
      <div className="mb-4">
        <label className={labelClass}>Site address</label>
        <input
          type="text"
          value={siteAddress}
          onChange={(e) => setSiteAddress(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Completion date */}
      <div className="mb-4">
        <label className={labelClass}>
          Estimated completion <span className="text-destructive">*</span>
        </label>
        <input
          type="date"
          value={completionDate}
          onChange={(e) => setCompletionDate(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Lead time */}
      <div className="mb-4">
        <label className={labelClass}>
          Lead time (weeks) <span className="text-destructive">*</span>
        </label>
        <input
          type="number"
          min={1}
          value={leadTimeWeeks}
          onChange={(e) => setLeadTimeWeeks(parseInt(e.target.value) || 8)}
          className={inputClass}
        />
      </div>

      {/* Computed start date */}
      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground mb-4">
        <span className="font-medium text-foreground">Start date:</span> {computedStart}
        <span className="ml-1">(completion − lead time)</span>
      </div>

      {/* Notes */}
      <div className="mb-6">
        <label className={labelClass}>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any key constraints, site access notes, etc."
          rows={3}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      </div>

      {error && (
        <p className="text-sm text-destructive mb-4">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!name.trim() || !completionDate || saving}
        className="w-full h-9 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Creating..." : "Create project"}
      </button>
    </SlidePanel>
  );
}
