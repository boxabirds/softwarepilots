import { useMemo } from "react";
import { getCurriculumSections } from "@softwarepilots/shared";

interface CelebrationCardProps {
  profile: string;
  sectionId: string;
  onNext?: (nextSectionId: string) => void;
}

interface NextTarget {
  sectionId: string;
  label: string;
}

function computeNextTarget(profile: string, sectionId: string): NextTarget | "curriculum-complete" | null {
  try {
    const allSections = getCurriculumSections(profile);
    const currentIndex = allSections.findIndex((s) => s.id === sectionId);
    if (currentIndex === -1) return null;

    const current = allSections[currentIndex];
    const next = allSections[currentIndex + 1];

    if (!next) return "curriculum-complete";

    if (next.module_id === current.module_id) {
      return { sectionId: next.id, label: "Next lesson" };
    }
    return { sectionId: next.id, label: "Next module" };
  } catch {
    return null;
  }
}

export function CelebrationCard({ profile, sectionId, onNext }: CelebrationCardProps) {
  const nextTarget = useMemo(() => computeNextTarget(profile, sectionId), [profile, sectionId]);

  const isCurriculumComplete = nextTarget === "curriculum-complete";
  const hasNext = nextTarget !== null && nextTarget !== "curriculum-complete";

  return (
    <div
      className="mx-auto my-4 flex max-w-lg flex-col items-center gap-3 rounded-xl px-6 py-5 text-center"
      style={{ background: "rgba(22, 163, 74, 0.12)", border: "1px solid rgba(22, 163, 74, 0.3)" }}
      data-testid="celebration-card"
    >
      <span className="text-3xl" role="img" aria-label="Trophy">
        🏆
      </span>
      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
        {isCurriculumComplete
          ? "Congratulations! You've completed the entire curriculum!"
          : "Well done! All the topics in this lesson are completed."}
      </p>
      {!isCurriculumComplete && (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          You can continue on this topic, or choose Next to move to the {hasNext ? (nextTarget as NextTarget).label.toLowerCase().replace("next ", "") : "next lesson"}.
        </p>
      )}
      {hasNext && onNext && (
        <button
          onClick={() => onNext((nextTarget as NextTarget).sectionId)}
          className="mt-1 cursor-pointer rounded-lg border-none px-5 py-2 text-sm font-semibold transition-colors"
          style={{ background: "#16a34a", color: "white" }}
          data-testid="celebration-next-btn"
        >
          {(nextTarget as NextTarget).label} &rarr;
        </button>
      )}
    </div>
  );
}

export { computeNextTarget };
