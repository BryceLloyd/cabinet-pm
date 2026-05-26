"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setMagicSent(true);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-muted/30 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Cabinet PM</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" && "Sign in to your account"}
            {mode === "signup" && "Create your account"}
            {mode === "magic" && "Sign in with a magic link"}
          </p>
        </div>

        {magicSent ? (
          <div className="rounded-md border bg-card p-6 text-sm text-center">
            <p>Check <span className="font-medium">{email}</span> for a sign-in link.</p>
            <button
              onClick={() => { setMagicSent(false); setMode("signin"); }}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground underline"
            >Back to sign in</button>
          </div>
        ) : (
          <>
            {/* Tab switcher */}
            <div className="flex items-center rounded-md border p-0.5 mb-5">
              {([["signin", "Sign in"], ["signup", "Sign up"], ["magic", "Magic link"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setMode(key); setError(null); }}
                  className={`flex-1 h-8 text-xs rounded font-medium transition-colors ${
                    mode === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >{label}</button>
              ))}
            </div>

            {/* Sign In form */}
            {mode === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <InputField id="email" label="Email" type="email" required value={email} onChange={setEmail} />
                <InputField id="password" label="Password" type="password" required value={password} onChange={setPassword} />
                <SubmitButton loading={loading}>Sign in</SubmitButton>
              </form>
            )}

            {/* Sign Up form */}
            {mode === "signup" && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <InputField id="email" label="Email" type="email" required value={email} onChange={setEmail} />
                <InputField id="password" label="Password" type="password" required value={password} onChange={setPassword} placeholder="At least 6 characters" />
                <InputField id="confirm" label="Confirm password" type="password" required value={confirmPassword} onChange={setConfirmPassword} />
                <SubmitButton loading={loading}>Create account</SubmitButton>
                <p className="text-xs text-muted-foreground text-center">
                  Only pre-approved emails can create an account. Ask your admin to add you.
                </p>
              </form>
            )}

            {/* Magic Link form */}
            {mode === "magic" && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <InputField id="email" label="Email" type="email" required value={email} onChange={setEmail} />
                <SubmitButton loading={loading}>Send magic link</SubmitButton>
              </form>
            )}

            {error && <p className="mt-3 text-sm text-destructive text-center">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}

function InputField({ id, label, type, required, value, onChange, placeholder }: {
  id: string; label: string; type: string; required?: boolean;
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-10 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
    >{loading ? "Please wait…" : children}</button>
  );
}
