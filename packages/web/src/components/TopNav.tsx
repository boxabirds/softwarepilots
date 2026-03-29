import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useIsMobile } from "../hooks/useIsMobile";
import { useBreadcrumbs } from "../hooks/useBreadcrumbs";
import { TrackSelector } from "./TrackSelector";
import { apiClient } from "../lib/api-client";

const NAV_HEIGHT_REM = "3.5rem"; // 56px at default 16px root

export function TopNav() {
  const { learner } = useAuth();
  const isMobile = useIsMobile();
  const breadcrumbs = useBreadcrumbs();

  const firstInitial = learner?.display_name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <nav
      className="fixed top-0 right-0 left-0 z-30 flex items-center px-4"
      style={{ borderBottom: "1px solid var(--border-light)", background: "var(--bg-base)", height: NAV_HEIGHT_REM }}
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

      {/* External links (desktop only - mobile shows in profile dropdown) */}
      {!isMobile && (
        <div className="mr-3 flex shrink-0 items-center gap-3">
          <a
            href="https://softwarepilotry.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:underline"
            style={{ color: "var(--pilot-blue)" }}
            data-testid="manifesto-link"
          >
            <img src="/logo-blue-circle.png" alt="" className="h-4 w-auto" />
            Manifesto
          </a>
          <a
            href="https://github.com/boxabirds/softwarepilots"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
            data-testid="github-link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
          <a
            href="https://discord.gg/3VayBR5mFQ"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-medium transition-colors hover:underline"
            style={{ color: "var(--text-muted)" }}
            data-testid="discord-link"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
            Discord
          </a>
        </div>
      )}

      {/* Right: Profile menu */}
      <ProfileMenu initial={firstInitial} displayName={learner?.display_name} selectedProfile={learner?.selected_profile} isMobile={isMobile} />
    </nav>
  );
}

function ProfileMenu({ initial, displayName, selectedProfile, isMobile }: { initial: string; displayName?: string; selectedProfile?: string | null; isMobile?: boolean }) {
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
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md py-1 shadow-lg" style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)" }}>
          {displayName && (
            <div className="px-3 py-2 text-xs" style={{ borderBottom: "1px solid var(--border-light)", color: "var(--text-muted)" }}>
              {displayName}
            </div>
          )}
          {selectedProfile !== undefined && (
            <div
              className="px-3 py-2"
              style={{ borderBottom: "1px solid var(--border-light)" }}
              data-testid="track-selector-menu"
            >
              <p className="mb-1.5 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                Track
              </p>
              <TrackSelector
                selectedProfile={selectedProfile ?? null}
                onSelect={async (profile) => {
                  await apiClient.put("/api/auth/preferences", { selected_profile: profile });
                  window.location.reload();
                }}
                compact
              />
            </div>
          )}
          <Link
            to="/admin"
            onClick={() => setOpen(false)}
            className="flex w-full items-center px-3 py-2 text-sm"
            style={{ color: "var(--text-primary)" }}
            data-testid="admin-link"
          >
            Admin
          </Link>
          <button
            onClick={handleSignOut}
            className="flex w-full cursor-pointer items-center px-3 py-2 text-sm"
            style={{ color: "var(--text-primary)" }}
            data-testid="sign-out-button"
          >
            Sign out
          </button>
          {isMobile && (
            <div
              className="flex items-center justify-around px-3 py-2.5"
              style={{ borderTop: "1px solid var(--border-light)" }}
            >
              <a
                href="https://softwarepilotry.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: "var(--pilot-blue)" }}
                data-testid="manifesto-link"
              >
                <img src="/logo-blue-circle.png" alt="" className="h-4 w-auto" />
                Manifesto
              </a>
              <a
                href="https://github.com/boxabirds/softwarepilots"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
                data-testid="github-link"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                GitHub
              </a>
              <a
                href="https://discord.gg/3VayBR5mFQ"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
                data-testid="discord-link"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z"/></svg>
                Discord
              </a>
            </div>
          )}
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

export { NAV_HEIGHT_REM };
