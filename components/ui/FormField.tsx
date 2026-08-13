import { forwardRef, InputHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const FormField = forwardRef<
  HTMLInputElement,
  {
    label: string;
    icon?: LucideIcon;
    trailing?: ReactNode;
  } & InputHTMLAttributes<HTMLInputElement>
>(function FormField({ label, icon: Icon, trailing, ...props }, ref) {
  return (
    <label className="block">
      <span className="text-sm text-ink-muted mb-1.5 block">{label}</span>
      <span className="relative flex items-center">
        {Icon && <Icon size={16} className="pointer-events-none absolute left-4 text-ink-muted" />}
        <input
          ref={ref}
          {...props}
          className={`w-full rounded-xl border border-border bg-base py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent ${
            Icon ? "pl-11" : "pl-4"
          } ${trailing ? "pr-11" : "pr-4"}`}
        />
        {trailing && <span className="absolute right-3.5">{trailing}</span>}
      </span>
    </label>
  );
});
