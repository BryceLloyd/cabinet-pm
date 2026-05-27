"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { SetPassword } from "@/components/settings/set-password";

interface ProfileFormProps {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  themePref: "light" | "dark" | "system";
  densityPref: "compact" | "comfortable";
}

export function ProfileForm({
  userId,
  email,
  fullName: initialName,
  avatarUrl: initialAvatar,
  themePref,
  densityPref: initialDensity,
}: ProfileFormProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const supabase = createClient();
  const avatarRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName || "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar || "");
  const [density, setDensity] = useState(initialDensity);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Sync next-themes with DB preference on mount
  useState(() => {
    if (themePref && theme !== themePref) {
      setTheme(themePref);
    }
  });

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${userId}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (error) {
      setError(`Upload failed: ${error.message}`);
      setSaving(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`; // cache-bust
    setAvatarUrl(publicUrl);
    await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
    setSaving(false);
    router.refresh();
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatus("idle");
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name })
      .eq("id", userId);
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("saved");
      router.refresh();
    }
    setSaving(false);
  }

  function handleThemeChange(newTheme: "light" | "dark" | "system") {
    setTheme(newTheme);
    supabase.from("profiles").update({ theme_preference: newTheme }).eq("id", userId);
  }

  function handleDensityChange(newDensity: "compact" | "comfortable") {
    setDensity(newDensity);
    if (newDensity === "compact") {
      document.documentElement.classList.add("density-compact");
    } else {
      document.documentElement.classList.remove("density-compact");
    }
    supabase.from("profiles").update({ density_preference: newDensity }).eq("id", userId);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="space-y-6">
      {/* Avatar + Name */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Profile</h2>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-start gap-4 mb-4">
            <button
              type="button"
              onClick={() => avatarRef.current?.click()}
              className="h-24 w-24 rounded-full bg-muted flex items-center justify-center text-lg font-medium overflow-hidden shrink-0 hover:opacity-80 transition-opacity"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-24 w-24 object-cover" />
              ) : (
                (name || email).slice(0, 2).toUpperCase()
              )}
            </button>
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div className="pt-2">
              <p className="text-sm font-medium">Profile photo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click the circle to upload</p>
            </div>
          </div>

          <form onSubmit={handleSaveName} className="space-y-3 max-w-sm">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full name</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setStatus("idle"); }}
                className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                value={email}
                disabled
                className="w-full h-9 px-3 rounded-md border bg-muted text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {status === "saved" && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>}
              {status === "error" && error && <span className="text-sm text-destructive">{error}</span>}
            </div>
          </form>
        </div>
      </section>

      {/* Appearance */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Appearance</h2>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Theme */}
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <div className="inline-flex items-center rounded-md border p-0.5">
              {(["light", "dark", "system"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleThemeChange(opt)}
                  className={`h-8 px-3 text-xs rounded font-medium transition-colors capitalize ${
                    (theme || "system") === opt
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Density */}
          <div>
            <label className="block text-sm font-medium mb-2">Density</label>
            <div className="inline-flex items-center rounded-md border p-0.5">
              {(["comfortable", "compact"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleDensityChange(opt)}
                  className={`h-8 px-3 text-xs rounded font-medium transition-colors capitalize ${
                    density === opt
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">Adjusts padding and spacing. Font sizes stay the same.</p>
          </div>
        </div>
      </section>

      {/* Password */}
      <section className="rounded-lg border bg-card">
        <div className="px-5 py-3.5 border-b">
          <h2 className="font-medium">Password</h2>
        </div>
        <div className="px-5 py-4">
          <SetPassword />
        </div>
      </section>

      {/* Sign out */}
      <button
        type="button"
        onClick={handleSignOut}
        className="h-9 px-4 rounded-md border text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
