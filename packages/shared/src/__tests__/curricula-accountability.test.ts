import { describe, it, expect } from "vitest";
import {
  getCurriculumMeta,
  getCurriculumSections,
  getSection,
} from "../curricula";
import type { LearnerProfile, AccountabilityScope } from "../curricula";

const ALL_PROFILES: LearnerProfile[] = ["level-0", "level-1", "level-10", "level-20"];

const EXPECTED_SCOPES: Record<LearnerProfile, AccountabilityScope> = {
  "level-0": "learning",
  "level-1": "single-app",
  "level-10": "system-of-services",
  "level-20": "org-practices",
};

describe("AccountabilityScope in CurriculumMeta", () => {
  it.each(ALL_PROFILES)(
    "getCurriculumMeta(%s) returns correct accountability_scope",
    (profile) => {
      const meta = getCurriculumMeta(profile);
      expect(meta.accountability_scope).toBe(EXPECTED_SCOPES[profile]);
    }
  );

  it("accountability_scope is one of the four valid values", () => {
    const validScopes: AccountabilityScope[] = [
      "learning",
      "single-app",
      "system-of-services",
      "org-practices",
    ];
    for (const profile of ALL_PROFILES) {
      const meta = getCurriculumMeta(profile);
      expect(validScopes).toContain(meta.accountability_scope);
    }
  });
});

describe("simulation_scenarios in SectionMeta", () => {
  it.each(ALL_PROFILES)(
    "%s has at least one section with simulation_scenarios",
    (profile) => {
      const sections = getCurriculumSections(profile);
      const withSims = sections.filter((s) => {
        const full = getSection(profile, s.id);
        return (
          full.simulation_scenarios !== undefined &&
          full.simulation_scenarios.length > 0
        );
      });
      expect(withSims.length).toBeGreaterThan(0);
    }
  );

  it("simulation_scenarios values are non-empty strings", () => {
    for (const profile of ALL_PROFILES) {
      const sections = getCurriculumSections(profile);
      for (const s of sections) {
        const full = getSection(profile, s.id);
        if (full.simulation_scenarios) {
          for (const scenario of full.simulation_scenarios) {
            expect(typeof scenario).toBe("string");
            expect(scenario.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("simulation_scenarios is undefined (not empty array) when absent", () => {
    // Verify the optional field behavior: sections without scenarios
    // should have undefined, not an empty array
    for (const profile of ALL_PROFILES) {
      const sections = getCurriculumSections(profile);
      for (const s of sections) {
        const full = getSection(profile, s.id);
        if (full.simulation_scenarios !== undefined) {
          expect(full.simulation_scenarios.length).toBeGreaterThan(0);
        }
      }
    }
  });
});
