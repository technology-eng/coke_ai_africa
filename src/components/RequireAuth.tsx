import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { isLoggedIn } from "@/lib/auth";
import { isPublic } from "@/lib/region";

/**
 * Route guard. Redirects to /login when the client-side auth flag is not set,
 * preserving the requested location in router state so LoginPage can bounce
 * the user back after signing in — including the query string, which on this
 * dashboard carries the entire filter state.
 *
 * This is convenience, not security: the real gate is server-side, where every
 * endpoint resolves its survey through the calling account.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!isLoggedIn() && !isPublic()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: { pathname: location.pathname + location.search } }}
      />
    );
  }
  return <>{children}</>;
}
