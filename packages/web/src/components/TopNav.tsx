import { useState, useRef, useEffect } from "react";
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
      className="fixed top-0 right-0 left-0 z-30 flex items-center px-4"
      style={{ borderBottom: "1px solid var(--border-light)", background: "var(--bg-base)" }}
      style={{ height: NAV_HEIGHT_PX }}
      data-testid="top-nav"
    >
      {/* Left: Logo */}
      <Link
        to="/dashboard"
        className="flex shrink-0 items-center"
        data-testid="nav-logo"
      >
        <img src="/logo-blue-circle.png" alt="Software Pilots" className="h-14 w-auto" />
      </Link>

      {/* Center: breadcrumb trail */}
      <div className="mx-4 flex min-w-0 flex-1 items-center" data-testid="breadcrumbs">
        {isMobile ? (
          <MobileBreadcrumbs segments={breadcrumbs} />
        ) : (
          <DesktopBreadcrumbs segments={breadcrumbs} />
        )}
      </div>

      {/* Right: Profile menu */}
      <ProfileMenu initial={firstInitial} displayName={learner?.display_name} />
    </nav>
  );
}

function ProfileMenu({ initial, displayName }: { initial: string; displayName?: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSignOut = () => {
    // POST to logout endpoint - it clears the cookie and redirects
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/auth/logout";
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-sm font-medium transition-colors"
        style={{ background: "var(--bg-muted)", color: "var(--pilot-blue)" }}
        data-testid="nav-profile-icon"
        title={displayName ?? "Profile"}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-40 rounded-md py-1 shadow-lg" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)" }}>
          {displayName && (
            <div className="px-3 py-2 text-xs" style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
              {displayName}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex w-full cursor-pointer items-center px-3 py-2 text-sm"
            style={{ color: "var(--text-primary)" }}
            data-testid="sign-out-button"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
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
          {i > 0 && <span className="text-xs opacity-60">&gt;</span>}
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
  let parentSegment: BreadcrumbSegment | undefined;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i].href) { parentSegment = segments[i]; break; }
  }

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
