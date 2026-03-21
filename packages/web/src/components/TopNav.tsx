import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useIsMobile } from "../hooks/useIsMobile";
import { useBreadcrumbs } from "../hooks/useBreadcrumbs";

const NAV_HEIGHT_PX = 56;

export function TopNav() {
  const { learner } = useAuth();
  const isMobile = useIsMobile();
  const breadcrumbs = useBreadcrumbs();

  const firstInitial = learner?.display_name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <nav
      className="fixed top-0 right-0 left-0 z-30 flex items-center border-b border-border bg-background px-4"
      style={{ height: NAV_HEIGHT_PX }}
      data-testid="top-nav"
    >
      {/* Left: Logo */}
      <a
        href="https://softwarepilotry.com"
        target="_blank"
        rel="noopener noreferrer"
        className="flex shrink-0 items-center"
        data-testid="nav-logo"
      >
        <img src="/logo-blue-circle.png" alt="Software Pilots" className="h-14 w-auto" />
      </a>

      {/* Center: breadcrumb trail */}
      <div className="mx-4 flex min-w-0 flex-1 items-center" data-testid="breadcrumbs">
        {isMobile ? (
          <MobileBreadcrumbs segments={breadcrumbs} />
        ) : (
          <DesktopBreadcrumbs segments={breadcrumbs} />
        )}
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

interface BreadcrumbSegment {
  label: string;
  href?: string;
}

function DesktopBreadcrumbs({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
      {segments.map((seg, i) => (
        <li key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-xs text-muted-foreground/60">&gt;</span>}
          {seg.href ? (
            <Link
              to={seg.href}
              className="truncate hover:text-foreground hover:underline"
              data-testid={`breadcrumb-link-${i}`}
            >
              {seg.label}
            </Link>
          ) : (
            <span className="truncate font-medium text-foreground" data-testid={`breadcrumb-current-${i}`}>
              {seg.label}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function MobileBreadcrumbs({ segments }: { segments: BreadcrumbSegment[] }) {
  const currentSegment = segments[segments.length - 1];
  // Find the parent segment (last one with an href)
  const parentSegment = [...segments].reverse().find((s) => s.href);

  return (
    <div className="flex items-center gap-1 text-sm">
      {parentSegment && (
        <Link
          to={parentSegment.href!}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Back"
        >
          &lt;
        </Link>
      )}
      <span className="truncate font-medium text-foreground" data-testid="breadcrumb-current-mobile">
        {currentSegment?.label}
      </span>
    </div>
  );
}

export { NAV_HEIGHT_PX };
