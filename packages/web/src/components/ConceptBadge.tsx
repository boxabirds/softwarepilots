/* ---- Constants ---- */

const LEVEL_CLASSES: Record<string, string> = {
  emerging: "bg-yellow-100 text-yellow-800 border-yellow-300",
  developing: "bg-blue-100 text-blue-800 border-blue-300",
  solid: "bg-green-100 text-green-800 border-green-300",
  strong: "bg-purple-100 text-purple-800 border-purple-300",
};

const DEFAULT_CLASS = "bg-gray-100 text-gray-600 border-gray-300";

/* ---- Component ---- */

interface ConceptBadgeProps {
  concept: string;
  level: string;
}

/**
 * Displays a concept name with color-coded mastery level.
 *
 * - emerging = yellow
 * - developing = blue
 * - solid = green
 * - strong = purple
 */
export function ConceptBadge({ concept, level }: ConceptBadgeProps) {
  const classes = LEVEL_CLASSES[level] ?? DEFAULT_CLASS;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}
      data-testid="concept-badge"
      data-level={level}
    >
      {concept}
    </span>
  );
}
