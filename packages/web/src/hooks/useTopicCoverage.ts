import { useState, useEffect } from "react";
import { apiClient } from "../lib/api-client";
import { getCurriculumSections, getSection } from "@softwarepilots/shared";

/* ---- Types ---- */

export interface CoverageCount {
  covered: number;
  total: number;
}

export interface SectionCoverage extends CoverageCount {
  dueForReview: boolean;
}

export interface TopicCoverage {
  track: CoverageCount;
  modules: Map<string, CoverageCount>;
  sections: Map<string, SectionCoverage>;
}

interface ProgressEntry {
  section_id: string;
  status: string;
  understanding_level?: string;
  concepts_json?: string | null;
}

interface ConceptAssessment {
  level: string;
  next_review?: string;
}

/* ---- Cache ---- */

const coverageCache = new Map<string, TopicCoverage>();

/** Invalidate cached coverage so the next hook mount fetches fresh data. */
export function invalidateTopicCoverageCache(profile?: string) {
  if (profile) coverageCache.delete(profile);
  else coverageCache.clear();
}

/* ---- Computation (exported for testing) ---- */

export function computeSectionCoverage(
  conceptsJson: string | null | undefined,
  totalConcepts: number,
): SectionCoverage {
  if (!conceptsJson || totalConcepts === 0) {
    return { covered: 0, total: totalConcepts, dueForReview: false };
  }

  let parsed: Record<string, ConceptAssessment>;
  try {
    parsed = JSON.parse(conceptsJson);
  } catch {
    return { covered: 0, total: totalConcepts, dueForReview: false };
  }

  const keys = Object.keys(parsed);
  const covered = Math.min(keys.length, totalConcepts);
  const now = new Date();
  const dueForReview = keys.some((key) => {
    const assessment = parsed[key];
    if (!assessment.next_review) return false;
    return new Date(assessment.next_review) < now;
  });

  return { covered, total: totalConcepts, dueForReview };
}

export function computeTopicCoverage(
  profile: string,
  progressEntries: ProgressEntry[],
): TopicCoverage {
  const sections = new Map<string, SectionCoverage>();
  const modules = new Map<string, CoverageCount>();
  let trackCovered = 0;
  let trackTotal = 0;

  // Build a lookup from progress entries
  const progressMap = new Map<string, ProgressEntry>();
  for (const entry of progressEntries) {
    progressMap.set(entry.section_id, entry);
  }

  // Get all sections from the curriculum registry
  let allSections: Array<{ id: string; module_id: string; concepts: string[] }>;
  try {
    allSections = getCurriculumSections(profile).map((s) => {
      // getCurriculumSections returns Omit<SectionMeta, "markdown">, which includes concepts
      return { id: s.id, module_id: s.module_id, concepts: s.concepts };
    });
  } catch {
    return {
      track: { covered: 0, total: 0 },
      modules,
      sections,
    };
  }

  for (const sec of allSections) {
    const progress = progressMap.get(sec.id);
    const sectionCov = computeSectionCoverage(
      progress?.concepts_json,
      sec.concepts.length,
    );
    sections.set(sec.id, sectionCov);

    // Aggregate to module level
    const existing = modules.get(sec.module_id) ?? { covered: 0, total: 0 };
    modules.set(sec.module_id, {
      covered: existing.covered + sectionCov.covered,
      total: existing.total + sectionCov.total,
    });

    // Aggregate to track level
    trackCovered += sectionCov.covered;
    trackTotal += sectionCov.total;
  }

  return {
    track: { covered: trackCovered, total: trackTotal },
    modules,
    sections,
  };
}

/* ---- Hook ---- */

export function useTopicCoverage(profile: string | undefined): TopicCoverage | null {
  const [coverage, setCoverage] = useState<TopicCoverage | null>(
    profile ? (coverageCache.get(profile) ?? null) : null,
  );

  useEffect(() => {
    if (!profile) return;

    if (coverageCache.has(profile)) {
      setCoverage(coverageCache.get(profile)!);
      return;
    }

    let cancelled = false;

    apiClient
      .get<ProgressEntry[]>(`/api/curriculum/${profile}/progress`)
      .then((entries) => {
        if (cancelled) return;
        const result = computeTopicCoverage(profile, entries);
        coverageCache.set(profile, result);
        setCoverage(result);
      })
      .catch(() => {
        if (!cancelled) {
          setCoverage(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [profile]);

  return coverage;
}
