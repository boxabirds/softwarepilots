import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useIsMobile } from "../hooks/useIsMobile";

const NAV_HEIGHT_PX = 48;

interface TopNavProps {
  children?: React.ReactNode;
}

export function TopNav({ children }: TopNavProps) {
  const { learner } = useAuth();
  const isMobile = useIsMobile();

  const firstInitial = learner?.display_name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <nav
      className="fixed top-0 right-0 left-0 z-30 flex items-center border-b border-border bg-background px-4"
      style={{ height: NAV_HEIGHT_PX }}
      data-testid="top-nav"
    >
      {/* Left: Logo */}
      <Link
        to="/dashboard"
        className="flex shrink-0 items-center gap-2 font-semibold text-foreground no-underline"
        data-testid="nav-logo"
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          SP
        </span>
        {!isMobile && (
          <span className="text-sm">Software Pilots</span>
        )}
      </Link>

      {/* Center: breadcrumb trail (placeholder for task 37.2) */}
      <div className="mx-4 flex min-w-0 flex-1 items-center">
        {children}
      </div>

      {/* Right: Profile icon */}
      <div
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground"
        data-testid="nav-profile-icon"
        title={learner?.display_name ?? "Profile"}
      >
        {firstInitial}
      </div>
    </nav>
  );
}

export { NAV_HEIGHT_PX };
