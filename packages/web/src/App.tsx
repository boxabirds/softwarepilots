import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { useAuth } from "./lib/auth";

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard }))
);
const Exercise = lazy(() =>
  import("./pages/Exercise").then((m) => ({ default: m.Exercise }))
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

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <RouteLoader>
                <Dashboard />
              </RouteLoader>
            </AuthGuard>
          }
        />
        <Route
          path="/exercise/:moduleId/:exerciseId"
          element={
            <AuthGuard>
              <RouteLoader>
                <Exercise />
              </RouteLoader>
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
