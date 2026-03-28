import { useState, useEffect } from "react";

const STORAGE_KEY = "sp-guidance-collapsed";

interface EducationalGuidanceProps {
  isNewUser?: boolean;
}

interface GuidanceSection {
  title: string;
  content: string;
}

const GUIDANCE_SECTIONS: GuidanceSection[] = [
  {
    title: "How tutoring works",
    content:
      "Each lesson uses Socratic dialogue - the tutor asks you questions to guide your understanding rather than lecturing. You demonstrate knowledge by explaining concepts in your own words. The system tracks which concepts you have covered and adjusts accordingly.",
  },
  {
    title: "How progress is tracked",
    content:
      "Progress is measured by concept coverage, not time spent. Each lesson has a set of core concepts. As you demonstrate understanding through conversation, the system marks concepts as covered. Your progress persists across sessions.",
  },
  {
    title: "Why revisit lessons",
    content:
      "Spaced repetition strengthens long-term retention. The system may suggest revisiting lessons when concepts are due for review. Revisiting does not mean you failed - it means the system is optimising your learning over time.",
  },
];

export function EducationalGuidance({ isNewUser }: EducationalGuidanceProps) {
  const [collapsed, setCollapsed] = useState(() => {
    if (isNewUser) return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      // Ignore storage errors
    }
  }, [collapsed]);

  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border-light)" }}
      data-testid="educational-guidance"
    >
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full cursor-pointer items-center justify-between text-left"
        data-testid="guidance-toggle"
      >
        <h3
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Getting started
        </h3>
        <span
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {collapsed ? "Show" : "Hide"}
        </span>
      </button>

      {!collapsed && (
        <div className="mt-3 flex flex-col gap-4" data-testid="guidance-content">
          {GUIDANCE_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4
                className="text-sm font-medium"
                style={{ color: "var(--text-secondary)" }}
              >
                {section.title}
              </h4>
              <p
                className="mt-1 text-sm leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {section.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
