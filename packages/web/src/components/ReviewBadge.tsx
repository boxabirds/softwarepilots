import { Link } from "react-router-dom";

/* ---- Component ---- */

interface ReviewBadgeProps {
  concept: string;
  daysOverdue: number;
  profile: string;
  sectionId: string;
}

/**
 * Shows a "Due for review" indicator with days overdue.
 * Clicking navigates to the section's Socratic session.
 */
export function ReviewBadge({
  concept,
  daysOverdue,
  profile,
  sectionId,
}: ReviewBadgeProps) {
  const label =
    daysOverdue === 0
      ? "Due today"
      : daysOverdue === 1
        ? "1 day overdue"
        : `${daysOverdue} days overdue`;

  return (
    <Link
      to={`/curriculum/${profile}/${sectionId}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800 transition-colors hover:bg-orange-100"
      data-testid="review-badge"
      title={`Review "${concept}" - ${label}`}
    >
      <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
      <span>{concept}</span>
      <span className="text-orange-600">{label}</span>
    </Link>
  );
}
