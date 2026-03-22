export interface ClaimProgressData {
  demonstrated: number;
  total: number;
  percentage: number;
}

export interface ProgressBadgeProps {
  status: "not_started" | "in_progress" | "completed" | "needs_review";
  understandingLevel?: string;
  claimProgress?: ClaimProgressData;
}

/** SVG ring dimensions */
const RING_SIZE = 20;
const STROKE_WIDTH = 2.5;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Percentage thresholds for ring color bands */
const COLOR_BAND_LOW = 30;
const COLOR_BAND_MID = 69;
const COLOR_BAND_HIGH = 99;

export function ProgressBadge({ status, understandingLevel, claimProgress }: ProgressBadgeProps) {
  const hasRing = claimProgress && claimProgress.total > 0;

  return (
    <span className="inline-flex items-center gap-1.5">
      {hasRing ? (
        <PercentageRing
          percentage={claimProgress.percentage}
          status={status}
        />
      ) : (
        <span
          data-testid="progress-circle"
          className={`inline-block rounded-full border-2 h-4 w-4 ${statusClasses(status)}`}
          aria-label={statusLabel(status)}
        />
      )}
      {understandingLevel && (
        <span className="text-xs text-muted-foreground">
          {understandingLevel}
        </span>
      )}
    </span>
  );
}

function PercentageRing({
  percentage,
  status,
}: {
  percentage: number;
  status: ProgressBadgeProps["status"];
}) {
  const dashOffset = CIRCUMFERENCE - (percentage / 100) * CIRCUMFERENCE;
  const color = status === "needs_review"
    ? ringColorNeedsReview()
    : ringColor(percentage);
  const isComplete = percentage === 100 && status === "completed";

  return (
    <span
      className="relative inline-flex items-center justify-center"
      data-testid="progress-ring"
      aria-label={`${statusLabel(status)} - ${percentage}%`}
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        className="block"
      >
        {/* Background track */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          className="text-gray-200"
        />
        {/* Progress arc */}
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          data-testid="progress-arc"
        />
        {/* Checkmark for 100% completed */}
        {isComplete && (
          <path
            d="M6.5 10.5L9 13L14 7.5"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            data-testid="checkmark"
          />
        )}
        {/* Refresh indicator for needs_review */}
        {status === "needs_review" && (
          <path
            d="M7 10a3.5 3.5 0 0 1 6.2-1.5M13 10a3.5 3.5 0 0 1-6.2 1.5"
            fill="none"
            stroke={color}
            strokeWidth="1"
            strokeLinecap="round"
            data-testid="refresh-indicator"
          />
        )}
      </svg>
      {/* Percentage text - only shown when not 100% complete and not needs_review with tiny ring */}
      {!isComplete && status !== "needs_review" && percentage > 0 && (
        <span
          className="absolute inset-0 flex items-center justify-center text-[6px] font-bold leading-none"
          style={{ color }}
          data-testid="percentage-text"
        >
          {percentage}%
        </span>
      )}
    </span>
  );
}

function ringColor(percentage: number): string {
  if (percentage <= COLOR_BAND_LOW) return "#9ca3af"; // gray-400
  if (percentage <= COLOR_BAND_MID) return "#3b82f6"; // blue-500
  if (percentage <= COLOR_BAND_HIGH) return "#16a34a"; // green-600
  return "#16a34a"; // green-600 for 100%
}

function ringColorNeedsReview(): string {
  return "#d97706"; // amber-600
}

function statusClasses(status: ProgressBadgeProps["status"]): string {
  switch (status) {
    case "not_started":
      return "border-gray-300 bg-transparent";
    case "in_progress":
      return "border-blue-500 bg-gradient-to-t from-blue-500 from-50% to-transparent to-50%";
    case "completed":
      return "border-green-600 bg-green-600";
    case "needs_review":
      return "border-amber-500 bg-amber-500";
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
    case "needs_review":
      return "Needs review";
  }
}
