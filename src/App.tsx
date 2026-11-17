import { Navigate, Route, Routes } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { NoAccessPage } from "./pages/NoAccessPage";
import { PlatformHomePage, TopPlatformsPage } from "./pages/PlatformHomePage";
import { hasHome, hasPlatformDashboard } from "./lib/region";
import { RequireAuth } from "./components/RequireAuth";

/**
 * Two views behind one login: the dashboard, and the analyst chat that reads
 * the same endpoints.
 *
 * The router is here because the dashboard keeps its filter state in the query
 * string — a filtered view is a shareable URL — and RequireAuth preserves that
 * query string across the login bounce, so a link shared with a colleague
 * survives them having to sign in first.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/no-access"
        element={
          <RequireAuth>
            <NoAccessPage />
          </RequireAuth>
        }
      />
      <Route
        path="/maxdiff"
        element={
          <RequireAuth>
            <DashboardPage key="benefits" view={hasPlatformDashboard() ? "benefits" : undefined} />
          </RequireAuth>
        }
      />
      <Route
        path="/chat"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />
      {hasPlatformDashboard() && (
        <Route
          path="/platform-dashboard"
          element={
            <RequireAuth>
              <DashboardPage key="platform" view="platform" />
            </RequireAuth>
          }
        />
      )}
      {hasHome() && (
        <Route
          path="/top-platforms"
          element={
            <RequireAuth>
              <TopPlatformsPage />
            </RequireAuth>
          }
        />
      )}
      {hasHome() && (
        <Route
          path="/home"
          element={
            <RequireAuth>
              <PlatformHomePage />
            </RequireAuth>
          }
        />
      )}
      <Route path="/" element={<Navigate to={hasHome() ? "/home" : "/maxdiff"} replace />} />
      <Route path="*" element={<Navigate to="/maxdiff" replace />} />
    </Routes>
  );
}
