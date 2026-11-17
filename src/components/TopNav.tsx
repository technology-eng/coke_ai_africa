import { LogOut, RefreshCw, Sparkles } from "lucide-react";
import { aiName, brandMark, brandTitle, hasHome, hasPlatformDashboard } from "@/lib/region";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuthEmail, logout } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Brand bar: identity, a manual refresh, the assistant, and who is signed in.
 *
 * The email matters more than it looks — dashboards are scoped per account, so
 * "which account am I?" is the same question as "whose data am I looking at?"
 * A reader who forgets they are signed in as a different client would have no
 * other way to tell.
 *
 * The assistant is a filled red button rather than a tab, matching the stills
 * workbench. A tab pair frames the two as equal halves you switch between; the
 * dashboard is the product and the assistant is something you reach for while
 * reading it, so it gets a call-to-action and the page keeps its own identity.
 */
export function TopNav({
  title,
  onRefresh,
  refreshing,
}: {
  title: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const email = getAuthEmail();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b bg-card">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            {brandMark()}
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">{brandTitle()}</div>
            <div className="text-xs text-muted-foreground">{title}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* The two dashboards; ASP also has home (benefit platforms) and Top 5. */}
          {hasPlatformDashboard() &&
            ([
              ...(hasHome()
                ? [
                    ["/home", "Platforms"],
                    ["/top-platforms", "Top 5 Platforms"],
                  ]
                : []),
              ["/maxdiff", "Benefits Dashboard"],
              ["/platform-dashboard", "Benefits Platform Dashboard"],
            ] as [string, string][]).map(([to, label]) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition hover:bg-muted",
                  pathname === to ? "font-semibold text-coke-red" : "text-muted-foreground hover:text-coke-red"
                )}
              >
                {label}
              </button>
            ))}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-coke-red disabled:opacity-50"
              title="Refetch every panel"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </button>
          )}
          <button
            onClick={() => navigate("/chat")}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            title={`Ask ${aiName()} about this study`}
          >
            <Sparkles className="h-3.5 w-3.5" /> {aiName()}
          </button>
          {email && (
            <>
              <span
                className="ml-2 hidden font-mono text-[11px] text-muted-foreground sm:inline"
                title="Signed in — dashboards are scoped to this account"
              >
                {email}
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
                className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-coke-red"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
