"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format, addWeeks } from "date-fns";

export default function NewProjectPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    client_name: "",
    site_address: "",
    notes: "",
    estimated_completion_date: format(addWeeks(new Date(), 8), "yyyy-MM-dd"),
    lead_time_weeks: 8,
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;

    // Get the default starting phase.
    const { data: phase } = await supabase
      .from("phases").select("id").eq("is_default", true).maybeSingle();

    const { data, error } = await supabase
      .from("projects")
      .insert({
        name: form.name,
        client_name: form.client_name || null,
        site_address: form.site_address || null,
        notes: form.notes || null,
        estimated_completion_date: form.estimated_completion_date,
        lead_time_weeks: form.lead_time_weeks,
        current_phase_id: phase?.id || null,
        created_by: user.user.id,
        status: "planning",
      })
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      router.push(`/projects/${data.id}`);
    }
  }

  const computedStart = format(
    addWeeks(new Date(form.estimated_completion_date), -form.lead_time_weeks),
    "MMM d, yyyy"
  );

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-6">New project</h1>

      <form onSubmit={submit} className="space-y-5 rounded-lg border bg-card p-6">
        <Field label="Project name" required>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            placeholder="e.g. Smith Residence — Main Kitchen"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Client name">
            <input
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Site address">
            <input
              value={form.site_address}
              onChange={(e) => setForm({ ...form, site_address: e.target.value })}
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Estimated completion date" required>
            <input
              type="date"
              required
              value={form.estimated_completion_date}
              onChange={(e) => setForm({ ...form, estimated_completion_date: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Lead time (weeks)" required>
            <input
              type="number"
              min={1}
              required
              value={form.lead_time_weeks}
              onChange={(e) => setForm({ ...form, lead_time_weeks: parseInt(e.target.value) || 8 })}
              className="input"
            />
          </Field>
        </div>

        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Start date:</span> {computedStart}
          <span className="ml-2">(auto-calculated from completion − lead time)</span>
        </div>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="input min-h-[80px]"
            placeholder="Any key constraints, site access notes, etc."
          />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => router.back()}
            className="h-9 px-4 rounded-md border text-sm hover:bg-muted">Cancel</button>
          <button type="submit" disabled={saving}
            className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {saving ? "Creating…" : "Create project"}
          </button>
        </div>
      </form>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          height: 2.25rem;
          padding: 0 0.75rem;
          border-radius: 0.375rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          font-size: 0.875rem;
        }
        :global(textarea.input) { height: auto; padding: 0.5rem 0.75rem; }
        :global(.input:focus) { outline: 2px solid hsl(var(--ring)); outline-offset: -1px; }
      `}</style>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}
