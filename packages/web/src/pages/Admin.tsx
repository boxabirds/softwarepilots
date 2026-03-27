import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type FormEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurriculumTree } from "@/components/CurriculumTree";

/* ---- Admin auth (localStorage bearer token) ---- */

const ADMIN_KEY_STORAGE = "softwarepilots_admin_key";

function getAdminKey(): string | null {
  return localStorage.getItem(ADMIN_KEY_STORAGE);
}

function setAdminKey(key: string): void {
  localStorage.setItem(ADMIN_KEY_STORAGE, key);
}

function clearAdminKey(): void {
  localStorage.removeItem(ADMIN_KEY_STORAGE);
}

/* ---- Types ---- */

interface FeedbackEntry {
  id: number;
  profile: string;
  section_id: string;
  message_content: string;
  message_index: number;
  feedback_text: string;
  created_at: string;
  learner_name: string;
}

interface UserProfileProgress {
  profile: string;
  sections_started: number;
  sections_completed: number;
  total_sections: number;
  claim_percentage: number;
}

interface AdminUser {
  id: string;
  display_name: string | null;
  email?: string;
  enrolled_at: string | null;
  last_active_at: string | null;
  profiles: UserProfileProgress[];
}

type TabId = "feedback" | "users" | "prompts";
type StatusFilter = "all" | "active" | "inactive" | "needs_review";
type ActivityRange = "all" | "24h" | "7d" | "30d" | "inactive_7d";

/* ---- Constants ---- */

const TRUNCATE_LENGTH = 80;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const MS_PER_DAY = 86400000;
const INACTIVE_THRESHOLD_DAYS = 7;
const MIN_COLUMN_WIDTH_PX = 150;
const DEFAULT_LEFT_WIDTH_PX = 250;
const DEFAULT_MIDDLE_WIDTH_PX = 350;
const ICON_RAIL_WIDTH_PX = 48;
const ACTIVITY_24H_MS = MS_PER_DAY;
const ACTIVITY_7D_MS = 7 * MS_PER_DAY;
const ACTIVITY_30D_MS = 30 * MS_PER_DAY;

/* ---- SectionDetail types ---- */

interface ConversationMessage {
  role: string;
  content: string;
  timestamp?: string;
}

interface ConversationSession {
  id: string;
  messages: ConversationMessage[];
  summary: string | null;
  archived_at: string | null;
  created_at: string;
}

interface ConversationsResponse {
  conversations: ConversationSession[];
}

interface ClaimEntry {
  level: string;
  timestamp: string;
}

interface ConceptAssessment {
  level: string;
  review_count: number;
  next_review: string;
}

type SectionDetailTab = "conversation" | "events";

/* ---- Section events types ---- */

interface SectionEventsResponse {
  status: string;
  understanding_json: string;
  claims_json: string;
  concepts_json: string;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  updated_at: string | null;
}

interface UnderstandingEntry {
  understanding_level?: string;
  confidence_assessment?: string;
  final_understanding?: string;
  concepts_covered?: string[];
  concepts_missed?: string[];
  pause_reason?: string;
  concepts_covered_so_far?: string;
  resume_suggestion?: string;
  timestamp?: string;
}

interface EventItem {
  timestamp: string;
  type: string;
  badgeClass: string;
  description: string;
}

/* ---- Helpers ---- */

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < SECONDS_PER_MINUTE) return "just now";
  if (diffSeconds < SECONDS_PER_HOUR) {
    const minutes = Math.floor(diffSeconds / SECONDS_PER_MINUTE);
    return `${minutes}m ago`;
  }
  if (diffSeconds < SECONDS_PER_DAY) {
    const hours = Math.floor(diffSeconds / SECONDS_PER_HOUR);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffSeconds / SECONDS_PER_DAY);
  return `${days}d ago`;
}

function toISODate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toISOString().split("T")[0];
  } catch {
    return "-";
  }
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_PER_DAY);
  } catch {
    return null;
  }
}

/* ---- Admin-authenticated fetch helpers ---- */

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const key = getAdminKey();
  if (!key) throw new Error("Not authenticated");
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });
  if (res.status === 401) {
    clearAdminKey();
    throw new Error("Invalid admin key");
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

/* ---- Login gate ---- */

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      setAdminKey(key);
      await adminFetch<FeedbackEntry[]>("/api/admin/feedback");
      onSuccess();
    } catch {
      clearAdminKey();
      setError("Invalid admin key");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 pt-32">
      <h1 className="mb-6 text-xl font-bold text-foreground">Admin Access</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          name="adminKey"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Admin key"
          autoFocus
          className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/50"
        />
        {error && (
          <p className="mb-3 text-sm text-destructive">{error}</p>
        )}
        <Button
          type="submit"
          disabled={loading || !key}
          className="w-full"
        >
          {loading ? "Verifying..." : "Enter"}
        </Button>
      </form>
    </div>
  );
}

/* ---- Tab button ---- */

function TabButton({
  active,
  onClick,
  children,
  testId,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className={cn(
        "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground hover:bg-muted/80"
      )}
    >
      {children}
    </button>
  );
}

/* ---- Resizable column drag handle ---- */

function DragHandle({
  onDrag,
}: {
  onDrag: (deltaX: number) => void;
}) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;

      const onMouseMove = (moveEvent: MouseEvent) => {
        onDrag(moveEvent.clientX - startX);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [onDrag]
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className="flex w-1.5 shrink-0 cursor-col-resize items-center justify-center hover:bg-primary/20"
      data-testid="drag-handle"
    >
      <div className="h-8 w-0.5 rounded-full bg-border" />
    </div>
  );
}

/* ---- Mini progress bar for UserRow ---- */

function MiniProgressBar({
  profile,
  completed,
  started,
  total,
}: {
  profile: string;
  completed: number;
  started: number;
  total: number;
}) {
  const completedPct = total > 0 ? (completed / total) * 100 : 0;
  const startedPct = total > 0 ? (started / total) * 100 : 0;

  return (
    <div className="flex items-center gap-1.5" title={`${profile}: ${completed}/${total} completed`}>
      <span className="w-14 truncate text-[10px] text-muted-foreground">{profile}</span>
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-green-500"
          style={{ width: `${completedPct}%` }}
        />
        <div
          className="absolute top-0 h-full rounded-full bg-blue-400"
          style={{ left: `${completedPct}%`, width: `${startedPct}%` }}
        />
      </div>
    </div>
  );
}

/* ---- User row ---- */

function UserRow({
  user,
  selected,
  onSelect,
}: {
  user: AdminUser;
  selected: boolean;
  onSelect: () => void;
}) {
  const inactiveDays = daysSince(user.last_active_at);
  const isInactive = inactiveDays !== null && inactiveDays >= INACTIVE_THRESHOLD_DAYS;
  const hasNeedsReview = user.profiles.some(
    (p) => p.sections_started > 0 || p.sections_completed > 0
    /* needs_review is detected via the backend - for now highlight if claim_percentage < 100 and has started */
  );
  const hasOverrides = user.profiles.some((p) => (p as Record<string, unknown>).has_overrides === true);

  return (
    <button
      onClick={onSelect}
      data-testid={`user-row-${user.id}`}
      className={cn(
        "flex w-full flex-col gap-1 border-b border-border px-3 py-2.5 text-left transition-colors",
        selected
          ? "bg-primary/10"
          : "hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-1.5">
        {/* Problem indicators */}
        {isInactive && (
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-gray-400" title="Inactive 7+ days" />
        )}
        {hasNeedsReview && user.profiles.some((p) => p.claim_percentage < 100 && p.sections_started > 0) && (
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-500" title="Needs review" />
        )}
        {hasOverrides && (
          <svg className="h-3 w-3 shrink-0 text-orange-500" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2h4v4H2V2zm8 0h4v4h-4V2zm-4 8h4v4H6v-4z" />
          </svg>
        )}
        <span className="truncate text-sm font-medium text-foreground">
          {user.display_name ?? "Unnamed"}
        </span>
      </div>

      <div className="flex gap-3 text-[11px] text-muted-foreground">
        <span>Enrolled {toISODate(user.enrolled_at)}</span>
        <span>Active {toISODate(user.last_active_at)}</span>
      </div>

      {user.profiles.length > 0 ? (
        <div className="mt-0.5 flex flex-col gap-0.5">
          {user.profiles.map((p) => (
            <MiniProgressBar
              key={p.profile}
              profile={p.profile}
              completed={p.sections_completed}
              started={p.sections_started}
              total={p.total_sections}
            />
          ))}
        </div>
      ) : (
        <span className="text-[11px] italic text-muted-foreground">No activity yet</span>
      )}
    </button>
  );
}

/* ---- Filter bar ---- */

function FilterBar({
  searchText,
  onSearchChange,
  statusFilter,
  onStatusChange,
  profileFilter,
  onProfileChange,
  activityRange,
  onActivityChange,
  availableProfiles,
}: {
  searchText: string;
  onSearchChange: (v: string) => void;
  statusFilter: StatusFilter;
  onStatusChange: (v: StatusFilter) => void;
  profileFilter: string;
  onProfileChange: (v: string) => void;
  activityRange: ActivityRange;
  onActivityChange: (v: ActivityRange) => void;
  availableProfiles: string[];
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border p-2" data-testid="filter-bar">
      <input
        type="text"
        placeholder="Search users..."
        value={searchText}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/50"
        data-testid="filter-search"
      />
      <div className="flex flex-wrap gap-1.5">
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
          className="rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
          data-testid="filter-status"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="needs_review">Needs review</option>
        </select>

        <select
          value={profileFilter}
          onChange={(e) => onProfileChange(e.target.value)}
          className="rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
          data-testid="filter-profile"
        >
          <option value="all">All profiles</option>
          {availableProfiles.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <select
          value={activityRange}
          onChange={(e) => onActivityChange(e.target.value as ActivityRange)}
          className="rounded-md border border-input bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring/50"
          data-testid="filter-activity"
        >
          <option value="all">All time</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="inactive_7d">Inactive 7d+</option>
        </select>
      </div>
    </div>
  );
}

/* ---- UserList component ---- */

function UserList({
  users,
  selectedUserId,
  onSelectUser,
  collapsed,
}: {
  users: AdminUser[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
  collapsed: boolean;
}) {
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [profileFilter, setProfileFilter] = useState("all");
  const [activityRange, setActivityRange] = useState<ActivityRange>("all");

  /* Collect unique profile names from all users */
  const availableProfiles = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      for (const p of u.profiles) set.add(p.profile);
    }
    return Array.from(set).sort();
  }, [users]);

  /* Client-side filtering with AND logic */
  const filteredUsers = useMemo(() => {
    const now = Date.now();
    return users.filter((u) => {
      /* Text search */
      if (searchText) {
        const q = searchText.toLowerCase();
        const name = (u.display_name ?? "").toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }

      /* Status filter */
      if (statusFilter !== "all") {
        const inactiveDays = daysSince(u.last_active_at);
        const isInactive = inactiveDays === null || inactiveDays >= INACTIVE_THRESHOLD_DAYS;
        if (statusFilter === "active" && isInactive) return false;
        if (statusFilter === "inactive" && !isInactive) return false;
        if (statusFilter === "needs_review") {
          const hasIssue = u.profiles.some(
            (p) => p.claim_percentage < 100 && p.sections_started > 0
          );
          if (!hasIssue) return false;
        }
      }

      /* Profile filter */
      if (profileFilter !== "all") {
        if (!u.profiles.some((p) => p.profile === profileFilter)) return false;
      }

      /* Activity range */
      if (activityRange !== "all") {
        const lastActive = u.last_active_at ? new Date(u.last_active_at).getTime() : 0;
        const elapsed = now - lastActive;
        if (activityRange === "24h" && elapsed > ACTIVITY_24H_MS) return false;
        if (activityRange === "7d" && elapsed > ACTIVITY_7D_MS) return false;
        if (activityRange === "30d" && elapsed > ACTIVITY_30D_MS) return false;
        if (activityRange === "inactive_7d" && elapsed < ACTIVITY_7D_MS) return false;
      }

      return true;
    });
  }, [users, searchText, statusFilter, profileFilter, activityRange]);

  /* Collapsed icon rail mode */
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 overflow-y-auto py-2" data-testid="user-list-collapsed">
        <button
          onClick={() => onSelectUser(selectedUserId ?? "")}
          title="Back to user list"
          className="mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
          data-testid="expand-user-list"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.5 3L4.5 7L8.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {filteredUsers.map((u) => (
          <button
            key={u.id}
            onClick={() => onSelectUser(u.id)}
            title={u.display_name ?? "Unnamed"}
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
              u.id === selectedUserId
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {(u.display_name ?? "?")[0].toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="user-list">
      <FilterBar
        searchText={searchText}
        onSearchChange={setSearchText}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        profileFilter={profileFilter}
        onProfileChange={setProfileFilter}
        activityRange={activityRange}
        onActivityChange={setActivityRange}
        availableProfiles={availableProfiles}
      />
      <div className="flex-1 overflow-y-auto">
        {filteredUsers.length === 0 ? (
          <p className="p-3 text-center text-xs text-muted-foreground">
            No users match filters
          </p>
        ) : (
          filteredUsers.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              selected={u.id === selectedUserId}
              onSelect={() => onSelectUser(u.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ---- Claim / concept level styling helpers ---- */

function claimLevelBadgeClass(level: string): string {
  switch (level) {
    case "developing":
      return "bg-blue-100 text-blue-800";
    case "solid":
      return "bg-green-100 text-green-800";
    case "strong":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function conceptLevelBadgeClass(level: string): string {
  switch (level) {
    case "emerging":
      return "bg-yellow-100 text-yellow-800";
    case "developing":
      return "bg-blue-100 text-blue-800";
    case "solid":
      return "bg-green-100 text-green-800";
    case "strong":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function toISOTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return dateStr;
  }
}

/* ---- Collapsible wrapper ---- */

function Collapsible({
  title,
  defaultExpanded = false,
  children,
  className,
}: {
  title: ReactNode;
  defaultExpanded?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left text-sm font-medium"
      >
        <span className="text-muted-foreground">{expanded ? "\u25BC" : "\u25B6"}</span>
        {title}
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </div>
  );
}

/* ---- Event type badge styling ---- */

const EVENT_BADGE_CLASSES: Record<string, string> = {
  started: "bg-blue-100 text-blue-800",
  understanding: "bg-indigo-100 text-indigo-800",
  claim: "bg-green-100 text-green-800",
  concept: "bg-yellow-100 text-yellow-800",
  completed: "bg-emerald-100 text-emerald-800",
  paused: "bg-orange-100 text-orange-800",
  override: "bg-red-100 text-red-800",
  status: "bg-gray-100 text-gray-600",
};

function eventBadgeClass(type: string): string {
  return EVENT_BADGE_CLASSES[type] ?? EVENT_BADGE_CLASSES.status;
}

/* ---- Parse section events into chronological list ---- */

function parseSectionEvents(data: SectionEventsResponse): EventItem[] {
  const events: EventItem[] = [];

  // Section started
  if (data.started_at) {
    events.push({
      timestamp: data.started_at,
      type: "started",
      badgeClass: eventBadgeClass("started"),
      description: "Section started",
    });
  }

  // Understanding entries
  let understandingEntries: UnderstandingEntry[] = [];
  try {
    understandingEntries = JSON.parse(data.understanding_json || "[]");
  } catch {
    understandingEntries = [];
  }

  for (const entry of understandingEntries) {
    const ts = entry.timestamp || data.updated_at || new Date().toISOString();

    if (entry.final_understanding) {
      events.push({
        timestamp: ts,
        type: "completed",
        badgeClass: eventBadgeClass("completed"),
        description: `Session completed: ${entry.final_understanding} understanding` +
          (entry.concepts_covered?.length ? ` - covered: ${entry.concepts_covered.join(", ")}` : "") +
          (entry.concepts_missed?.length ? ` - missed: ${entry.concepts_missed.join(", ")}` : ""),
      });
    } else if (entry.pause_reason) {
      events.push({
        timestamp: ts,
        type: "paused",
        badgeClass: eventBadgeClass("paused"),
        description: `Session paused: ${entry.pause_reason}` +
          (entry.resume_suggestion ? ` - resume: ${entry.resume_suggestion}` : ""),
      });
    } else if (entry.understanding_level) {
      events.push({
        timestamp: ts,
        type: "understanding",
        badgeClass: eventBadgeClass("understanding"),
        description: `Understanding assessed: ${entry.understanding_level}` +
          (entry.confidence_assessment ? ` (confidence: ${entry.confidence_assessment})` : ""),
      });
    }
  }

  // Claims
  let claimsMap: Record<string, ClaimEntry> = {};
  try {
    claimsMap = JSON.parse(data.claims_json || "{}");
  } catch {
    claimsMap = {};
  }

  for (const [claimId, entry] of Object.entries(claimsMap)) {
    events.push({
      timestamp: entry.timestamp,
      type: "claim",
      badgeClass: eventBadgeClass("claim"),
      description: `Claim demonstrated: ${claimId} at ${entry.level}`,
    });
  }

  // Concepts
  let conceptsMap: Record<string, ConceptAssessment & { last_reviewed?: string }> = {};
  try {
    conceptsMap = JSON.parse(data.concepts_json || "{}");
  } catch {
    conceptsMap = {};
  }

  for (const [conceptName, assessment] of Object.entries(conceptsMap)) {
    const ts = (assessment as Record<string, unknown>).last_reviewed as string
      || data.updated_at
      || new Date().toISOString();
    events.push({
      timestamp: ts,
      type: "concept",
      badgeClass: eventBadgeClass("concept"),
      description: `Concept assessed: ${conceptName} at ${assessment.level} (reviews: ${assessment.review_count})`,
    });
  }

  // Completed timestamp
  if (data.completed_at && !understandingEntries.some((e) => e.final_understanding)) {
    events.push({
      timestamp: data.completed_at,
      type: "completed",
      badgeClass: eventBadgeClass("completed"),
      description: "Section completed",
    });
  }

  // Paused timestamp
  if (data.paused_at && !understandingEntries.some((e) => e.pause_reason)) {
    events.push({
      timestamp: data.paused_at,
      type: "paused",
      badgeClass: eventBadgeClass("paused"),
      description: "Session paused",
    });
  }

  // Current status if needs_review
  if (data.status === "needs_review") {
    events.push({
      timestamp: data.updated_at || new Date().toISOString(),
      type: "status",
      badgeClass: eventBadgeClass("override"),
      description: "Status: needs_review (claims decayed below threshold)",
    });
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events;
}

/* ---- EventLog component ---- */

function EventLog({
  userId,
  profile,
  sectionId,
}: {
  userId: string;
  profile: string;
  sectionId: string;
}) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rawStatus, setRawStatus] = useState<string>("not_started");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    adminFetch<SectionEventsResponse>(
      `/api/admin/users/${userId}/section-events/${profile}/${sectionId}`
    )
      .then((data) => {
        if (!cancelled) {
          setEvents(parseSectionEvents(data));
          setRawStatus(data.status);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load events");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, profile, sectionId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-muted-foreground">
        <p className="text-sm">Loading events...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-4 text-muted-foreground" data-testid="no-events">
        <p className="text-sm">No events recorded for this section</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4" data-testid="event-log">
      {/* Status summary */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground">Current status:</span>
        <Badge className={cn("text-xs", rawStatus === "completed" ? "bg-emerald-100 text-emerald-800"
          : rawStatus === "in_progress" ? "bg-blue-100 text-blue-800"
          : rawStatus === "paused" ? "bg-orange-100 text-orange-800"
          : rawStatus === "needs_review" ? "bg-red-100 text-red-800"
          : "bg-gray-100 text-gray-600"
        )}>
          {rawStatus}
        </Badge>
        <span className="text-xs text-muted-foreground">{events.length} event{events.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Event timeline */}
      <div className="flex flex-col gap-2">
        {events.map((event, idx) => (
          <div
            key={`${event.timestamp}-${idx}`}
            className="flex items-start gap-3 rounded-lg border border-border px-3 py-2"
            data-testid={`event-${event.type}-${idx}`}
          >
            <div className="shrink-0 pt-0.5">
              <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                {toISOTimestamp(event.timestamp)}
              </span>
            </div>
            <Badge className={cn("shrink-0 text-[10px]", event.badgeClass)}>
              {event.type}
            </Badge>
            <span className="text-xs text-foreground leading-relaxed">
              {event.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- SectionDetail component ---- */

function SectionDetail({
  userId,
  profile,
  sectionId,
  progressData,
}: {
  userId: string;
  profile: string;
  sectionId: string;
  progressData?: {
    claims_json?: string | null;
    concepts_json?: string | null;
    claim_progress?: {
      demonstrated: number;
      total: number;
      percentage: number;
      missing: string[];
    };
  } | null;
}) {
  const [activeTab, setActiveTab] = useState<SectionDetailTab>("conversation");
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Fetch conversations when section changes */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    adminFetch<ConversationsResponse>(
      `/api/admin/users/${userId}/conversations/${profile}/${sectionId}`
    )
      .then((data) => {
        if (!cancelled) {
          setConversations(data.conversations ?? []);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load conversations");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId, profile, sectionId]);

  /* Parse claim data from progress */
  const claimsMap = useMemo<Record<string, ClaimEntry>>(() => {
    if (!progressData?.claims_json) return {};
    try {
      return JSON.parse(progressData.claims_json);
    } catch {
      return {};
    }
  }, [progressData?.claims_json]);

  /* Parse concept data from progress */
  const conceptsMap = useMemo<Record<string, ConceptAssessment>>(() => {
    if (!progressData?.concepts_json) return {};
    try {
      return JSON.parse(progressData.concepts_json);
    } catch {
      return {};
    }
  }, [progressData?.concepts_json]);

  const claimEntries = Object.entries(claimsMap);
  const conceptEntries = Object.entries(conceptsMap);
  const claimProgress = progressData?.claim_progress;

  return (
    <div className="flex h-full flex-col" data-testid="section-detail">
      {/* Section header */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-foreground">{sectionId}</h3>
        <p className="text-xs text-muted-foreground">
          {profile}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex shrink-0 gap-2 border-b border-border px-4 py-2">
        <TabButton
          active={activeTab === "conversation"}
          onClick={() => setActiveTab("conversation")}
          testId="section-tab-conversation"
        >
          Conversation
        </TabButton>
        <TabButton
          active={activeTab === "events"}
          onClick={() => setActiveTab("events")}
          testId="section-tab-events"
        >
          Events
        </TabButton>
      </div>

      {/* Tab content */}
      {activeTab === "events" ? (
        <EventLog userId={userId} profile={profile} sectionId={sectionId} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Claim coverage card */}
          <div className="shrink-0 border-b border-border p-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Claim Coverage
                  {claimProgress && (
                    <span className="ml-2 font-normal">
                      {claimProgress.demonstrated} of {claimProgress.total} demonstrated
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {claimEntries.length === 0 && (!claimProgress || claimProgress.total === 0) ? (
                  <p className="text-xs text-muted-foreground" data-testid="no-claim-data">
                    No claim data recorded
                  </p>
                ) : claimEntries.length === 0 && claimProgress && claimProgress.total > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {claimProgress.missing.map((claimId) => (
                      <Badge key={claimId} className="bg-gray-100 text-gray-500 text-xs">
                        {claimId} - not demonstrated
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {claimEntries.map(([claimId, entry]) => (
                      <div key={claimId} className="flex items-center gap-2">
                        <Badge className={cn("text-xs", claimLevelBadgeClass(entry.level))}>
                          {entry.level}
                        </Badge>
                        <span className="text-xs text-foreground">{claimId}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {toISOTimestamp(entry.timestamp)}
                        </span>
                      </div>
                    ))}
                    {/* Show missing claims too */}
                    {claimProgress?.missing.map((claimId) => (
                      <div key={claimId} className="flex items-center gap-2">
                        <Badge className="bg-gray-100 text-gray-500 text-xs">
                          not demonstrated
                        </Badge>
                        <span className="text-xs text-muted-foreground">{claimId}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Concept mastery card */}
          <div className="shrink-0 border-b border-border p-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  Concept Mastery
                </CardTitle>
              </CardHeader>
              <CardContent>
                {conceptEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No concepts recorded</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {conceptEntries.map(([name, assessment]) => (
                      <Badge
                        key={name}
                        className={cn("text-xs", conceptLevelBadgeClass(assessment.level))}
                      >
                        {name} - {assessment.level}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Conversation history */}
          <div className="p-4">
            {loading ? (
              <p className="text-center text-xs text-muted-foreground">Loading conversations...</p>
            ) : error ? (
              <p className="text-center text-xs text-destructive">{error}</p>
            ) : conversations.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground" data-testid="no-conversations">
                No conversations yet
              </p>
            ) : (
              <div className="flex flex-col gap-6">
                {conversations.map((session) => (
                  <ConversationSessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- ConversationSessionCard ---- */

function ConversationSessionCard({ session }: { session: ConversationSession }) {
  const isArchived = session.archived_at !== null;
  const isActive = !isArchived;

  return (
    <div
      className="rounded-lg border border-border"
      data-testid={`conversation-${session.id}`}
    >
      {/* Session header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold text-foreground">
          {isActive ? "Current session" : "Archived session"}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {toISOTimestamp(session.created_at)}
        </span>
      </div>

      {/* Summary banner for archived sessions */}
      {isArchived && session.summary ? (
        <Collapsible
          title={
            <span className="text-xs font-medium text-blue-800">Session Summary</span>
          }
          defaultExpanded={true}
          className="border-b border-border bg-blue-50 px-3 py-2"
        >
          <p className="text-xs leading-relaxed text-blue-900">{session.summary}</p>
        </Collapsible>
      ) : isArchived && !session.summary ? (
        <div className="border-b border-border bg-gray-50 px-3 py-2">
          <p className="text-xs text-muted-foreground">Session archived (no summary available)</p>
        </div>
      ) : null}

      {/* Messages */}
      <div className="flex flex-col gap-2 p-3">
        {session.messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages in this session</p>
        ) : (
          session.messages
            .filter((msg) => msg.role !== "system")
            .map((msg, idx) => {
              const isLearner = msg.role === "user";
              const senderLabel = isLearner ? "Learner" : "Tutor";

              return (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col max-w-[85%] rounded-lg px-3 py-2",
                    isLearner
                      ? "self-start bg-muted/60"
                      : "self-end bg-primary/10"
                  )}
                  data-testid={`message-${msg.role}-${idx}`}
                >
                  <span className={cn(
                    "text-[10px] font-semibold mb-0.5",
                    isLearner ? "text-muted-foreground" : "text-primary/70"
                  )}>
                    {senderLabel}
                  </span>
                  <p className="whitespace-pre-wrap text-xs text-foreground leading-relaxed">
                    {msg.content}
                  </p>
                  {msg.timestamp && (
                    <span className="mt-1 text-[10px] text-muted-foreground">
                      {toISOTimestamp(msg.timestamp)}
                    </span>
                  )}
                  {/* Tutor context metadata */}
                  {!isLearner && (
                    <Collapsible
                      title={<span className="text-[10px] text-muted-foreground">Tutor context</span>}
                      className="mt-1"
                    >
                      <p className="text-[10px] text-muted-foreground">
                        Per-message tutor metadata is not available - individual message context (tool_type, understanding_level, claims_demonstrated) is stored as aggregate entries in progress data, not per-message. See the Events tab for the chronological tutor behavior log.
                      </p>
                    </Collapsible>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

/* ---- Users tab with three-column layout ---- */

function UsersTab({
  searchParams,
  setSearchParams,
  onAuthFail,
}: {
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams, opts?: { replace?: boolean }) => void;
  onAuthFail: () => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* URL-driven selection state */
  const selectedUserId = searchParams.get("user");
  const selectedProfile = searchParams.get("profile");
  const selectedSection = searchParams.get("section");

  /* Column widths */
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH_PX);
  const [middleWidth, setMiddleWidth] = useState(DEFAULT_MIDDLE_WIDTH_PX);
  const leftWidthRef = useRef(DEFAULT_LEFT_WIDTH_PX);
  const middleWidthRef = useRef(DEFAULT_MIDDLE_WIDTH_PX);

  /* Fetch users */
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<AdminUser[]>("/api/admin/users");
      setUsers(data);
    } catch (err) {
      if (err instanceof Error && err.message === "Invalid admin key") {
        onAuthFail();
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /* URL state helpers */
  const updateParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (value) {
        next.set(key, value);
      } else {
        next.delete(key);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleSelectUser = useCallback(
    (userId: string) => {
      const next = new URLSearchParams(searchParams);
      if (next.get("user") === userId) {
        /* Deselect */
        next.delete("user");
        next.delete("profile");
        next.delete("section");
      } else {
        next.set("user", userId);
        next.delete("profile");
        next.delete("section");
      }
      next.set("tab", "users");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleSelectSection = useCallback(
    (profile: string, sectionId: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", "users");
      if (selectedUserId) next.set("user", selectedUserId);
      next.set("profile", profile);
      next.set("section", sectionId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, selectedUserId]
  );

  /* Drag handlers for column resizing */
  const handleLeftDrag = useCallback(
    (deltaX: number) => {
      const newWidth = Math.max(MIN_COLUMN_WIDTH_PX, leftWidthRef.current + deltaX);
      leftWidthRef.current = newWidth;
      setLeftWidth(newWidth);
    },
    []
  );

  const handleMiddleDrag = useCallback(
    (deltaX: number) => {
      const newWidth = Math.max(MIN_COLUMN_WIDTH_PX, middleWidthRef.current + deltaX);
      middleWidthRef.current = newWidth;
      setMiddleWidth(newWidth);
    },
    []
  );

  /* Keep refs in sync with state for drag start position */
  useEffect(() => { leftWidthRef.current = leftWidth; }, [leftWidth]);
  useEffect(() => { middleWidthRef.current = middleWidth; }, [middleWidth]);

  const isUserSelected = selectedUserId !== null;
  const effectiveLeftWidth = isUserSelected ? ICON_RAIL_WIDTH_PX : leftWidth;

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading users...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center" data-testid="users-error">
        <p className="mb-4 text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchUsers}>Retry</Button>
      </div>
    );
  }

  return (
    <div
      className="flex h-[calc(100vh-10rem)] border border-border rounded-lg overflow-hidden"
      data-testid="users-layout"
    >
      {/* Left column - UserList */}
      <div
        className="shrink-0 overflow-hidden border-r border-border transition-[width] duration-200"
        style={{ width: effectiveLeftWidth }}
        data-testid="column-left"
      >
        <UserList
          users={users}
          selectedUserId={selectedUserId}
          onSelectUser={handleSelectUser}
          collapsed={isUserSelected}
        />
      </div>

      {!isUserSelected && (
        <DragHandle onDrag={handleLeftDrag} />
      )}

      {/* Middle column - CurriculumTree */}
      <div
        className="shrink-0 overflow-hidden border-r border-border"
        style={{ width: middleWidth }}
        data-testid="column-middle"
      >
        <CurriculumTree
          selectedUserId={selectedUserId}
          selectedProfile={selectedProfile}
          selectedSection={selectedSection}
          onSelectSection={handleSelectSection}
          adminFetch={adminFetch}
        />
      </div>

      <DragHandle onDrag={handleMiddleDrag} />

      {/* Right column - SectionDetail */}
      <div
        className="min-w-0 flex-1 overflow-hidden"
        data-testid="column-right"
      >
        {selectedUserId && selectedProfile && selectedSection ? (
          <SectionDetail
            userId={selectedUserId}
            profile={selectedProfile}
            sectionId={selectedSection}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center text-muted-foreground">
            <p className="text-sm">Select a section to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Feedback tab (original content) ---- */

function FeedbackTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<FeedbackEntry[]>("/api/admin/feedback");
      setFeedback(data);
    } catch (err) {
      if (err instanceof Error && err.message === "Invalid admin key") {
        onAuthFail();
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this feedback entry?")) return;
    try {
      await adminFetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
      await fetchFeedback();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete feedback");
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading feedback...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center" data-testid="error-state">
        <p className="mb-4 text-destructive">{error}</p>
        <Button variant="outline" onClick={fetchFeedback}>Retry</Button>
      </div>
    );
  }

  if (feedback.length === 0) {
    return (
      <p className="text-muted-foreground" data-testid="empty-state">
        No feedback has been submitted yet
      </p>
    );
  }

  return (
    <table className="w-full border-collapse text-sm" data-testid="feedback-table">
      <thead>
        <tr className="border-b-2 border-border text-left">
          <th className="px-3 py-2 font-semibold text-muted-foreground">Section</th>
          <th className="px-3 py-2 font-semibold text-muted-foreground">Message</th>
          <th className="px-3 py-2 font-semibold text-muted-foreground">Feedback</th>
          <th className="px-3 py-2 font-semibold text-muted-foreground">From</th>
          <th className="px-3 py-2 font-semibold text-muted-foreground">When</th>
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        {feedback.map((entry) => (
          <FeedbackRow
            key={entry.id}
            entry={entry}
            expanded={expandedId === entry.id}
            onToggle={() => toggleExpand(entry.id)}
            onDelete={() => handleDelete(entry.id)}
          />
        ))}
      </tbody>
    </table>
  );
}

function FeedbackRow({
  entry,
  expanded,
  onToggle,
  onDelete,
}: {
  entry: FeedbackEntry;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "cursor-pointer border-b border-border transition-colors",
          expanded ? "bg-muted" : "hover:bg-muted/50"
        )}
        data-testid={`feedback-row-${entry.id}`}
      >
        <td className="px-3 py-2.5 text-foreground">
          {entry.profile}/{entry.section_id}
        </td>
        <td className="px-3 py-2.5 text-foreground">
          {truncate(entry.message_content, TRUNCATE_LENGTH)}
        </td>
        <td className="px-3 py-2.5 text-foreground">
          {truncate(entry.feedback_text, TRUNCATE_LENGTH)}
        </td>
        <td className="px-3 py-2.5 text-muted-foreground">
          {entry.learner_name}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
          {relativeTime(entry.created_at)}
        </td>
        <td className="px-3 py-2.5">
          <Button
            variant="outline"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            data-testid={`delete-btn-${entry.id}`}
          >
            Delete
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted">
          <td colSpan={6} className="px-6 py-3">
            <div className="mb-3">
              <strong className="text-xs text-muted-foreground">Full Message</strong>
              <p className="mt-1 whitespace-pre-wrap text-foreground">
                {entry.message_content}
              </p>
            </div>
            <div>
              <strong className="text-xs text-muted-foreground">Full Feedback</strong>
              <p className="mt-1 whitespace-pre-wrap text-foreground">
                {entry.feedback_text}
              </p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ---- Prompts Tab ---- */

interface PromptRow {
  id: number;
  key: string;
  content: string;
  version: number;
  created_at: string;
  created_by: string | null;
  reason: string | null;
}

function PromptsTab({ onAuthFail }: { onAuthFail: () => void }) {
  const [prompts, setPrompts] = useState<PromptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editReason, setEditReason] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [history, setHistory] = useState<PromptRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load prompt list
  const loadPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<PromptRow[]>("/api/admin/prompts");
      setPrompts(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        onAuthFail();
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load prompts");
    } finally {
      setLoading(false);
    }
  }, [onAuthFail]);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  // Load selected prompt detail + history
  const selectPrompt = useCallback(async (key: string) => {
    setSelectedKey(key);
    setShowHistory(false);
    setEditReason("");
    try {
      const data = await adminFetch<{ prompt: PromptRow; history?: PromptRow[] }>(
        `/api/admin/prompts/${encodeURIComponent(key)}?history=true`
      );
      setEditContent(data.prompt.content);
      setOriginalContent(data.prompt.content);
      setHistory(data.history ?? []);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        onAuthFail();
      }
    }
  }, [onAuthFail]);

  // Save edited prompt
  const handleSave = useCallback(async () => {
    if (!selectedKey || !editReason.trim()) return;
    setSaving(true);
    try {
      await adminFetch<PromptRow>(`/api/admin/prompts/${encodeURIComponent(selectedKey)}`, {
        method: "PUT",
        body: JSON.stringify({ content: editContent, reason: editReason }),
      });
      setEditReason("");
      await loadPrompts();
      await selectPrompt(selectedKey);
    } catch (err) {
      if (err instanceof Error && err.message.includes("401")) {
        onAuthFail();
      }
    } finally {
      setSaving(false);
    }
  }, [selectedKey, editContent, editReason, onAuthFail, loadPrompts, selectPrompt]);

  const contentChanged = editContent !== originalContent;
  const canSave = contentChanged && editReason.trim().length > 0 && !saving;

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading prompts...</p>;
  }

  if (error) {
    return (
      <div className="text-sm text-destructive">
        <p>{error}</p>
        <button onClick={loadPrompts} className="mt-2 text-primary underline">Retry</button>
      </div>
    );
  }

  if (prompts.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
        No prompts found. Run the seed script to populate prompts.
      </div>
    );
  }

  return (
    <div className="flex gap-6" style={{ minHeight: "500px" }} data-testid="prompts-tab">
      {/* Prompt list */}
      <div className="w-64 shrink-0 overflow-y-auto border-r border-border pr-4">
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Prompt Keys</h3>
        <ul className="flex flex-col gap-1">
          {prompts.map((p) => (
            <li key={p.key}>
              <button
                onClick={() => selectPrompt(p.key)}
                data-testid={`prompt-key-${p.key}`}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                  selectedKey === p.key
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <div className="truncate font-mono text-xs">{p.key}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  v{p.version} - {p.content.slice(0, 60)}...
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Editor panel */}
      <div className="flex-1">
        {!selectedKey ? (
          <p className="text-sm text-muted-foreground">Select a prompt to edit</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-sm font-semibold">{selectedKey}</h3>
              {contentChanged && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  Unsaved changes
                </span>
              )}
            </div>

            {/* Content editor */}
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              data-testid="prompt-editor"
              className="min-h-[300px] w-full rounded-md border border-border bg-background p-3 font-mono text-sm"
              spellCheck={false}
            />

            {/* Reason + Save */}
            <div className="flex gap-3">
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Reason for change (required)"
                data-testid="prompt-reason"
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                onClick={handleSave}
                disabled={!canSave}
                data-testid="prompt-save"
                className={cn(
                  "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  canSave
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>

            {/* Version history */}
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="cursor-pointer text-sm text-primary underline"
                data-testid="prompt-toggle-history"
              >
                {showHistory ? "Hide history" : `Show history (${history.length} versions)`}
              </button>
              {showHistory && history.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {history.map((h) => (
                    <div
                      key={h.version}
                      className="rounded-md border border-border p-3 text-sm"
                      data-testid={`prompt-history-v${h.version}`}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>v{h.version} - {h.created_at}{h.created_by ? ` by ${h.created_by}` : ""}</span>
                        {h.version !== history[0]?.version && (
                          <button
                            onClick={() => setEditContent(h.content)}
                            className="cursor-pointer text-primary underline"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                      {h.reason && (
                        <div className="mt-1 text-xs italic text-muted-foreground">{h.reason}</div>
                      )}
                      <pre className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs opacity-70">
                        {h.content.slice(0, 200)}{h.content.length > 200 ? "..." : ""}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Main Admin component ---- */

export function Admin() {
  const [authenticated, setAuthenticated] = useState(!!getAdminKey());
  const [searchParams, setSearchParams] = useSearchParams();

  /* Read active tab from URL, default to "feedback" */
  const activeTab = (searchParams.get("tab") as TabId) || "feedback";

  const switchTab = useCallback(
    (tab: TabId) => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", tab);
      /* Clear user/profile/section when switching tabs */
      if (tab !== "users") {
        next.delete("user");
        next.delete("profile");
        next.delete("section");
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleLogout = () => {
    clearAdminKey();
    setAuthenticated(false);
  };

  const handleAuthFail = useCallback(() => {
    clearAdminKey();
    setAuthenticated(false);
  }, []);

  if (!authenticated) {
    return <AdminLogin onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Admin</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          data-testid="admin-logout"
        >
          Logout
        </Button>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-2 border-b border-border pb-3">
        <TabButton
          active={activeTab === "feedback"}
          onClick={() => switchTab("feedback")}
          testId="tab-feedback"
        >
          Feedback
        </TabButton>
        <TabButton
          active={activeTab === "users"}
          onClick={() => switchTab("users")}
          testId="tab-users"
        >
          Users
        </TabButton>
        <TabButton
          active={activeTab === "prompts"}
          onClick={() => switchTab("prompts")}
          testId="tab-prompts"
        >
          Prompts
        </TabButton>
      </div>

      {/* Tab content */}
      {activeTab === "feedback" && <FeedbackTab onAuthFail={handleAuthFail} />}
      {activeTab === "users" && (
        <UsersTab searchParams={searchParams} setSearchParams={setSearchParams} onAuthFail={handleAuthFail} />
      )}
      {activeTab === "prompts" && <PromptsTab onAuthFail={handleAuthFail} />}
    </div>
  );
}
