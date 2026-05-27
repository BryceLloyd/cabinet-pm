"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BusinessInfo } from "@/lib/types";

export function BusinessInfoForm({
  initial,
  isAdmin,
}: {
  initial: BusinessInfo;
  isAdmin: boolean;
}) {
  const [form, setForm] = useState({
    name: initial.name,
    address: initial.address || "",
    phone: initial.phone || "",
    email: initial.email || "",
  });
  const [logoUrl, setLogoUrl] = useState(initial.logo_url || "");
  const [workshopUrl, setWorkshopUrl] = useState(initial.workshop_photo_url || "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const workshopRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${path}.${ext}`;
    const { error } = await supabase.storage
      .from("business-assets")
      .upload(filePath, file, { upsert: true });
    if (error) {
      setError(`Upload failed: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage
      .from("business-assets")
      .getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const url = await uploadFile(file, "logo");
    if (url) setLogoUrl(url);
    setSaving(false);
  }

  async function handleWorkshopUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const url = await uploadFile(file, "workshop");
    if (url) setWorkshopUrl(url);
    setSaving(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatus("idle");

    const { error } = await supabase
      .from("business_info")
      .update({
        name: form.name,
        address: form.address || null,
        phone: form.phone || null,
        email: form.email || null,
        logo_url: logoUrl || null,
        workshop_photo_url: workshopUrl || null,
      })
      .eq("id", 1);

    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("saved");
    }
    setSaving(false);
  }

  // Read-only view for non-admins
  if (!isAdmin) {
    return (
      <div className="space-y-3 text-sm">
        {logoUrl && (
          <img src={logoUrl} alt="Logo" className="h-10 object-contain" />
        )}
        <div>
          <span className="text-muted-foreground">Name:</span>{" "}
          {initial.name || <span className="text-muted-foreground italic">Not set</span>}
        </div>
        {initial.address && (
          <div><span className="text-muted-foreground">Address:</span> {initial.address}</div>
        )}
        {initial.phone && (
          <div><span className="text-muted-foreground">Phone:</span> {initial.phone}</div>
        )}
        {initial.email && (
          <div><span className="text-muted-foreground">Email:</span> {initial.email}</div>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Business name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. Wooden Wonders"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Phone</label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Address</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Image uploads */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Logo</label>
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded border" />
            )}
            <button
              type="button"
              onClick={() => logoRef.current?.click()}
              className="h-9 px-3 rounded-md border text-sm hover:bg-muted"
            >
              {logoUrl ? "Replace" : "Upload"}
            </button>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Workshop photo</label>
          <div className="flex items-center gap-3">
            {workshopUrl && (
              <img src={workshopUrl} alt="Workshop" className="h-10 w-16 object-cover rounded border" />
            )}
            <button
              type="button"
              onClick={() => workshopRef.current?.click()}
              className="h-9 px-3 rounded-md border text-sm hover:bg-muted"
            >
              {workshopUrl ? "Replace" : "Upload"}
            </button>
            <input ref={workshopRef} type="file" accept="image/*" className="hidden" onChange={handleWorkshopUpload} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {status === "saved" && <span className="text-sm text-emerald-600">Saved.</span>}
        {status === "error" && error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}
