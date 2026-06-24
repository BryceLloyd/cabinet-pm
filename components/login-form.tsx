"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ bizName, bizLogo }: { bizName: string; bizLogo: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <main className="min-h-screen grid place-items-center bg-muted/30 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {bizLogo && (
            <img src={bizLogo} alt="" className="h-12 mx-auto mb-3 object-contain" />
          )}
          <h1 className="text-2xl font-semibold tracking-tight">{bizName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <form onSubmit={handleSignIn} className="space-y-4">
          <InputField id="email" label="Email" type="email" required value={email} onChange={setEmail} />
          <InputField id="password" label="Password" type="password" required value={password} onChange={setPassword} />
          <SubmitButton loading={loading}>Sign in</SubmitButton>
        </form>

        <p className="mt-4 text-xs text-muted-foreground text-center">
          No account? Ask your admin to create one for you.
        </p>

        {error && <p className="mt-3 text-sm text-destructive text-center">{error}</p>}
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
