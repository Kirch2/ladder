"use client";

import type { ReactNode } from "react";
import { cn } from "@/app/lib/utils";

/**
 * Three-column row cell. Shares the `relative font-mono` defaults so the
 * call sites only specify what's actually different (color, weight,
 * alignment). Routed through `cn()` to keep the className tidy.
 */
export function Cell({
  align = "left",
  className,
  children,
}: {
  align?: "left" | "right";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "relative font-mono",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </span>
  );
}
