import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getAuthEmail, getRegions, logout } from "@/lib/auth";
import { REGIONS, brandTitle, regionInfo } from "@/lib/region";

/** Signed in, but this account is not granted the region in the URL. */
export function NoAccessPage() {
  const navigate = useNavigate();
  const here = regionInfo();
  const allowed = REGIONS.filter((r) => r.id !== here.id && getRegions().includes(r.id));

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold">No access to {brandTitle(here)}</h1>
        <p className="text-sm text-muted-foreground">
          {getAuthEmail() ?? "This account"} is not granted the {here.title} dashboard. Ask an admin for
          access{allowed.length ? ", or open one you have:" : "."}
        </p>
        {allowed.map((r) => (
          <a key={r.id} href={`${r.base}/maxdiff`} className="block text-sm font-medium text-primary hover:underline">
            {brandTitle(r)}
          </a>
        ))}
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            logout();
            navigate("/login", { replace: true });
          }}
        >
          Sign in with another account
        </Button>
      </div>
    </div>
  );
}
