"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function SettingsDesktopRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (window.innerWidth >= 768) {
      router.replace("/settings/profile");
    }
  }, [router]);
  return null;
}
