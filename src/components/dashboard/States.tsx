import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { AxiosError } from "axios";

export function PanelLoading({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-6 animate-pulse rounded bg-muted" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

export function PanelSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

/**
 * Failure state. Shows the server's own message where there is one — the
 * segments endpoint returns a 409 with a reason when nothing has been fitted
 * yet, and that reason is more useful than "request failed".
 */
export function PanelError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const err = error as AxiosError<{ message?: string }>;
  const status = err?.response?.status;
  const message =
    err?.response?.data?.message ||
    (err?.code === "ERR_NETWORK"
      ? "Could not reach the API. Check that the coke_eu service is running and that API_BASE_URL in src/ENV.ts points at it."
      : err?.message) ||
    "Something went wrong.";

  return (
    <div className="flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="text-sm">
        <div className="font-medium text-destructive">
          {status ? `Request failed (${status})` : "Request failed"}
        </div>
        <p className="mt-1 leading-relaxed text-muted-foreground">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/**
 * Thin-base warning. A cut can be legitimately small, so this warns rather
 * than blocks — but the numbers below it should not be quoted.
 */
export function ThinBaseNotice({ n }: { n: number }) {
  return (
    <div className="mb-3 rounded-md border border-coke-red/40 bg-coke-red/[0.05] px-3 py-2 text-[11.5px] leading-relaxed text-foreground">
      <b>Base of {n.toLocaleString()}.</b> Below roughly 100 respondents the
      confidence intervals are wide enough that rank order is not reliable —
      read the direction, not the position.
    </div>
  );
}
