"use client";

import { useRouter, usePathname } from "next/navigation";

/** Office ⇄ Production view toggle. Only shown to users who have both views. */
export function ViewSwitch({ hasOffice, hasProduction }: { hasOffice: boolean; hasProduction: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  if (!hasOffice || !hasProduction) return null;

  const isProduction = pathname === "/production" || pathname.startsWith("/production/");

  return (
    <div className="inline-flex items-center rounded-md border p-0.5 text-xs shrink-0">
      <button
        onClick={() => router.push("/dashboard")}
        className={`px-2.5 py-1 rounded transition-colors ${!isProduction ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        Office
      </button>
      <button
        onClick={() => router.push("/production")}
        className={`px-2.5 py-1 rounded transition-colors ${isProduction ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        Production
      </button>
    </div>
  );
}
