import { apiClient } from "../lib/api-client";
import { useEffect, useState } from "react";
import type { CurriculumProfileSummary } from "@softwarepilots/shared";

interface TrackSelectorProps {
  selectedProfile: string | null;
  onSelect: (profile: string) => void;
  compact?: boolean;
}

const TRACK_DESCRIPTIONS: Record<string, string> = {
  "level-0": "Complete beginner",
  "level-1": "New grad",
  "level-10": "Veteran",
  "level-20": "Senior leader",
};

export function TrackSelector({ selectedProfile, onSelect, compact }: TrackSelectorProps) {
  const [profiles, setProfiles] = useState<CurriculumProfileSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<CurriculumProfileSummary[]>("/api/curriculum")
      .then(setProfiles)
      .catch(() => setError("Failed to load tracks"));
  }, []);

  if (error) {
    return (
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {error}
      </p>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-col gap-1" data-testid="track-selector-compact">
        {profiles.map((p) => (
          <button
            key={p.profile}
            type="button"
            onClick={() => onSelect(p.profile)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors"
            style={{
              background: selectedProfile === p.profile ? "var(--pilot-blue)" : "transparent",
              color: selectedProfile === p.profile ? "var(--text-on-brand)" : "var(--text-primary)",
            }}
            data-testid={`track-option-${p.profile}`}
          >
            <span className="font-medium">{p.title}</span>
            <span
              className="ml-auto text-xs"
              style={{
                color: selectedProfile === p.profile ? "rgba(255,255,255,0.7)" : "var(--text-muted)",
              }}
            >
              {TRACK_DESCRIPTIONS[p.profile] ?? ""}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2" data-testid="track-selector-full">
      {profiles.map((p) => {
        const isSelected = selectedProfile === p.profile;
        return (
          <button
            key={p.profile}
            type="button"
            onClick={() => onSelect(p.profile)}
            className="cursor-pointer rounded-xl p-6 text-left transition-all"
            style={{
              background: isSelected ? "var(--pilot-blue)" : "var(--bg-subtle)",
              border: isSelected ? "2px solid var(--pilot-blue)" : "2px solid var(--border-light)",
              color: isSelected ? "var(--text-on-brand)" : "var(--text-primary)",
            }}
            data-testid={`track-option-${p.profile}`}
          >
            <h3 className="text-lg font-bold">{p.title}</h3>
            <p
              className="mt-1 text-sm"
              style={{
                color: isSelected ? "rgba(255,255,255,0.75)" : "var(--text-muted)",
              }}
            >
              {TRACK_DESCRIPTIONS[p.profile] ?? p.starting_position}
            </p>
            <p
              className="mt-3 text-sm"
              style={{
                color: isSelected ? "rgba(255,255,255,0.6)" : "var(--text-muted)",
              }}
            >
              {p.starting_position}
            </p>
            <div className="mt-4">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: isSelected ? "rgba(255,255,255,0.15)" : "var(--bg-muted)",
                  color: isSelected ? "var(--text-on-brand)" : "var(--text-secondary)",
                }}
              >
                {p.section_count} sections
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
