import { useNavigate } from "react-router-dom";
import { brandMark, brandTitle } from "@/lib/region";
import { ArrowLeft, LogOut } from "lucide-react";
import { logout } from "@/lib/auth";
import { ChatPanel } from "@/components/chat/ChatPanel";

/**
 * The analyst chat, on its own route.
 *
 * Its own header rather than the shared TopNav, matching the stills workbench:
 * the nav's CokeAI button is what brought you here, so reusing it would leave a
 * call-to-action pointing at the page you are already on. What you need here is
 * the way back, which is the leftmost thing on the bar.
 *
 * A full page rather than a drawer beside the dashboard: an answer is prose
 * plus tables and needs the same reading width the panels get.
 *
 * No survey id — like every other view, the chat resolves its study from
 * ?variant= server-side.
 */
export function ChatPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen flex-col bg-muted/20">
      <header className="z-30 shrink-0 border-b bg-card">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/maxdiff")}
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-coke-red"
              title="Back to the dashboard"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              {brandMark()}
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">{brandTitle()}</div>
              <div className="text-xs text-muted-foreground">MaxDiff Assistant</div>
            </div>
          </div>
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
        </div>
      </header>

      <main className="flex min-h-0 flex-1">
        <ChatPanel />
      </main>
    </div>
  );
}
