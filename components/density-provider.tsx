"use client";

import { useEffect } from "react";

export function DensityProvider({
  density,
  children,
}: {
  density: "compact" | "comfortable";
  children: React.ReactNode;
}) {
  useEffect(() => {
    const root = document.documentElement;
    if (density === "compact") {
      root.classList.add("density-compact");
    } else {
      root.classList.remove("density-compact");
    }
  }, [density]);

  return <>{children}</>;
}
