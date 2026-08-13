import type { ReactNode } from "react";

export function Tooltip({ label, show, children }: { label: string; show: boolean; children: ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <span className="group/tooltip relative flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-base opacity-0 shadow-lg transition-opacity duration-150 group-hover/tooltip:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}
