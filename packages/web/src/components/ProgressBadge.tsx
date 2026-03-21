interface ProgressBadgeProps {
  status: "not_started" | "in_progress" | "completed";
  understandingLevel?: string;
}

const BADGE_SIZE = "h-4 w-4";

export function ProgressBadge({ status, understandingLevel }: ProgressBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        data-testid="progress-circle"
        className={`inline-block rounded-full border-2 ${BADGE_SIZE} ${statusClasses(status)}`}
        aria-label={statusLabel(status)}
      />
      {understandingLevel && (
        <span className="text-xs text-muted-foreground">
          {understandingLevel}
        </span>
      )}
    </span>
  );
}

function statusClasses(status: ProgressBadgeProps["status"]): string {
  switch (status) {
    case "not_started":
      return "border-gray-300 bg-transparent";
    case "in_progress":
      return "border-blue-500 bg-gradient-to-t from-blue-500 from-50% to-transparent to-50%";
    case "completed":
      return "border-green-600 bg-green-600";
  }
}

function statusLabel(status: ProgressBadgeProps["status"]): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
  }
}
