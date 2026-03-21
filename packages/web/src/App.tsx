import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { useAuth } from "./lib/auth";
import { TopNav, NAV_HEIGHT_PX } from "./components/TopNav";

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard }))
);
const Exercise = lazy(() =>
  import("./pages/Exercise").then((m) => ({ default: m.Exercise }))
);
const SocraticSession = lazy(() =>
  import("./pages/SocraticSession").then((m) => ({ default: m.SocraticSession }))
);
const ProgressDashboard = lazy(() =>
  import("./pages/ProgressDashboard").then((m) => ({
    default: m.ProgressDashboard,
  }))
);

function RouteLoader({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-muted-foreground">
          Loading...
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <div style={{ paddingTop: NAV_HEIGHT_PX }}>{children}</div>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <AuthenticatedLayout>
                <RouteLoader>
                  <Dashboard />
                </RouteLoader>
              </AuthenticatedLayout>
            </AuthGuard>
          }
        />
        {/* /curriculum redirects to dashboard - they're the same page now */}
        <Route path="/curriculum" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/exercise/:moduleId/:exerciseId"
          element={
            <AuthGuard>
              <AuthenticatedLayout>
                <RouteLoader>
                  <Exercise />
                </RouteLoader>
              </AuthenticatedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/curriculum/:profile/progress"
          element={
            <AuthGuard>
              <AuthenticatedLayout>
                <RouteLoader>
                  <ProgressDashboard />
                </RouteLoader>
              </AuthenticatedLayout>
            </AuthGuard>
          }
        />
        <Route
          path="/curriculum/:profile/:sectionId"
          element={
            <AuthGuard>
              <AuthenticatedLayout>
                <RouteLoader>
                  <SocraticSession />
                </RouteLoader>
              </AuthenticatedLayout>
            </AuthGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
