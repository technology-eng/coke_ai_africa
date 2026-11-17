import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Toggle chip used by every filter control.
 *
 * `aria-pressed` rather than a checkbox role: these are multi-select toggles
 * that take effect immediately, with no submit step.
 */
export function Chip({
  active,
  partial,
  onClick,
  children,
  title,
  disabled,
}: {
  active: boolean;
  /** Some, not all, of what the chip stands for is selected (a group chip). */
  partial?: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active ? true : partial ? "mixed" : false}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-sm border px-2.5 py-1 font-mono text-[11px] transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : partial
            ? "border-primary/60 bg-primary/15 text-primary hover:bg-primary/25"
            : "border-input bg-transparent text-muted-foreground hover:border-primary hover:text-primary"
      )}
    >
      {children}
    </button>
  );
}

export function ChipGroup({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-[150px]">
      <div
        className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
        title={hint}
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
