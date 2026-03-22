import { describe, it, expect } from "vitest";
import { validateLearningMap } from "../curricula/learning-map-validator";
import {
  getCurriculumProfiles,
  getCurriculumSections,
  getSection,
  extractConcepts,
  getLearningMapForProfile,
  learningMapRegistry,
} from "../curricula";
import type { SectionLearningMap } from "../curricula";

// -- Helpers --

function makeValidMap(overrides?: Partial<SectionLearningMap>): SectionLearningMap {
  return {
    section_id: "test-section",
    generated_at: "2026-01-01T00:00:00Z",
    model_used: "test-model",
    prerequisites: [],
    core_claims: [
      { id: "c1", statement: "Claim 1", concepts: ["A", "B"], demonstration_criteria: "Can build a working example" },
      { id: "c2", statement: "Claim 2", concepts: ["C"], demonstration_criteria: "Can explain the tradeoffs in writing" },
      { id: "c3", statement: "Claim 3", concepts: ["D"], demonstration_criteria: "Can identify three failure modes" },
    ],
    key_misconceptions: [
      { id: "m1", belief: "Wrong belief", correction: "Right answer", related_claims: ["c1"] },
    ],
    key_intuition_decomposition: [
      { id: "si1", statement: "First insight", order: 1 },
      { id: "si2", statement: "Second insight", order: 2 },
    ],
    ...overrides,
  };
}

const ALL_CONCEPTS = ["A", "B", "C", "D"];

// -- Unit tests: validation rules --

describe("validateLearningMap - unit", () => {
  it("(1) accepts valid map with 3-7 claims and full concept coverage", () => {
    const result = validateLearningMap(makeValidMap(), ALL_CONCEPTS);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("(1b) accepts valid map with exactly 7 claims", () => {
    const map = makeValidMap({
      core_claims: Array.from({ length: 7 }, (_, i) => ({
        id: `c${i + 1}`,
        statement: `Claim ${i + 1}`,
        concepts: [ALL_CONCEPTS[i % ALL_CONCEPTS.length]],
        demonstration_criteria: "Can demonstrate by building an example",
      })),
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(true);
  });

  it("(2) rejects map with fewer than 3 claims", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "Only claim", concepts: ALL_CONCEPTS, demonstration_criteria: "Can build it" },
        { id: "c2", statement: "Second claim", concepts: ["A"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("3-7 core_claims, got 2"))).toBe(true);
  });

  it("(3) rejects map with more than 7 claims", () => {
    const claims = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i + 1}`,
      statement: `Claim ${i + 1}`,
      concepts: [ALL_CONCEPTS[i % ALL_CONCEPTS.length]],
      demonstration_criteria: "Can build it from scratch",
    }));
    const map = makeValidMap({ core_claims: claims });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("3-7 core_claims, got 8"))).toBe(true);
  });

  it("(4) rejects map where a section concept is not in any claim", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ["A"], demonstration_criteria: "Can build it" },
        { id: "c2", statement: "C2", concepts: ["B"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["C"], demonstration_criteria: "Can build it" },
        // "D" is not covered
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"D" not covered'))).toBe(true);
  });

  it("(5a) rejects vague demonstration criteria - 'understands'", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ["A", "B"], demonstration_criteria: "Understands the basic concept" },
        { id: "c2", statement: "C2", concepts: ["C"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["D"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("vague") && e.includes("understands"))).toBe(true);
  });

  it("(5b) rejects vague demonstration criteria - 'is aware of'", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ALL_CONCEPTS, demonstration_criteria: "Is aware of the implications" },
        { id: "c2", statement: "C2", concepts: ["A"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["B"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("is aware of"))).toBe(true);
  });

  it("(5c) rejects vague demonstration criteria - 'has knowledge of'", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: ALL_CONCEPTS, demonstration_criteria: "Has knowledge of the topic" },
        { id: "c2", statement: "C2", concepts: ["A"], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["B"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("has knowledge of"))).toBe(true);
  });

  it("rejects claim with no concepts when section has concepts", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: [], demonstration_criteria: "Can build it" },
        { id: "c2", statement: "C2", concepts: ALL_CONCEPTS, demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: ["A"], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"c1" has no concepts'))).toBe(true);
  });

  it("allows claims with no concepts when section has no extractable concepts", () => {
    const map = makeValidMap({
      core_claims: [
        { id: "c1", statement: "C1", concepts: [], demonstration_criteria: "Can build it" },
        { id: "c2", statement: "C2", concepts: [], demonstration_criteria: "Can build it" },
        { id: "c3", statement: "C3", concepts: [], demonstration_criteria: "Can build it" },
      ],
    });
    const result = validateLearningMap(map, []);
    expect(result.valid).toBe(true);
  });

  it("rejects 1 sub-insight (below minimum)", () => {
    const map = makeValidMap({
      key_intuition_decomposition: [{ id: "si1", statement: "Only one", order: 1 }],
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("2-4 key_intuition_decomposition"))).toBe(true);
  });

  it("rejects 5 sub-insights (above maximum)", () => {
    const map = makeValidMap({
      key_intuition_decomposition: Array.from({ length: 5 }, (_, i) => ({
        id: `si${i + 1}`,
        statement: `Insight ${i + 1}`,
        order: i + 1,
      })),
    });
    const result = validateLearningMap(map, ALL_CONCEPTS);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("2-4 key_intuition_decomposition"))).toBe(true);
  });
});

// -- Integration tests: real curriculum data --

describe("learning map integration", () => {
  it("(6) flattenSections produces SectionMeta with learning_map attached", () => {
    const section = getSection("level-0", "0.1");
    expect(section).toHaveProperty("learning_map");
    expect(section.learning_map).toHaveProperty("section_id");
    expect(section.learning_map).toHaveProperty("core_claims");
    expect(section.learning_map).toHaveProperty("key_misconceptions");
    expect(section.learning_map).toHaveProperty("key_intuition_decomposition");
    expect(section.learning_map).toHaveProperty("model_used");
    expect(section.learning_map).toHaveProperty("generated_at");
    expect(section.learning_map).toHaveProperty("prerequisites");
  });

  it("(6b) learning_map has real data, not empty placeholder", () => {
    const section = getSection("level-0", "0.1");
    expect(section.learning_map.core_claims.length).toBeGreaterThanOrEqual(3);
    expect(section.learning_map.model_used).toBeTruthy();
    expect(section.learning_map.generated_at).toBeTruthy();
  });

  it("(7) every real curriculum section has a valid learning_map after generation", () => {
    const profiles = getCurriculumProfiles();
    const failures: string[] = [];

    for (const profileSummary of profiles) {
      const profile = profileSummary.profile;
      const sections = getCurriculumSections(profile);

      for (const sectionSummary of sections) {
        const section = getSection(profile, sectionSummary.id);
        const concepts = extractConcepts(section.markdown);
        const { valid, errors } = validateLearningMap(section.learning_map, concepts);

        if (!valid) {
          failures.push(`${profile}/${sectionSummary.id}: ${errors.join("; ")}`);
        }
      }
    }

    expect(
      failures,
      `Sections with invalid learning maps:\n${failures.join("\n")}`,
    ).toEqual([]);
  });

  it("(7b) registry has an entry for every section across all profiles", () => {
    const profiles = getCurriculumProfiles();
    const missing: string[] = [];

    for (const profileSummary of profiles) {
      const profile = profileSummary.profile;
      const sections = getCurriculumSections(profile);

      for (const sectionSummary of sections) {
        const key = `${profile}:${sectionSummary.id}`;
        if (!learningMapRegistry.has(key)) {
          missing.push(key);
        }
        // Also verify getLearningMapForProfile resolves
        const map = getLearningMapForProfile(profile, sectionSummary.id);
        if (!map) {
          missing.push(`${key} (via getLearningMapForProfile)`);
        }
      }
    }

    expect(
      missing,
      `Missing registry entries:\n${missing.join("\n")}`,
    ).toEqual([]);
  });

  it("(7c) every generated map file exports a valid SectionLearningMap with correct section_id", () => {
    const profiles = getCurriculumProfiles();
    const mismatches: string[] = [];

    for (const profileSummary of profiles) {
      const profile = profileSummary.profile;
      const sections = getCurriculumSections(profile);

      for (const sectionSummary of sections) {
        const map = getLearningMapForProfile(profile, sectionSummary.id);
        if (map && map.section_id !== sectionSummary.id) {
          mismatches.push(
            `${profile}/${sectionSummary.id}: section_id is "${map.section_id}" but expected "${sectionSummary.id}"`,
          );
        }
      }
    }

    expect(
      mismatches,
      `section_id mismatches:\n${mismatches.join("\n")}`,
    ).toEqual([]);
  });

  it("(7d) all section learning maps have non-empty model_used and generated_at", () => {
    const profiles = getCurriculumProfiles();
    for (const profileSummary of profiles) {
      const sections = getCurriculumSections(profileSummary.profile);
      for (const sectionSummary of sections) {
        const section = getSection(profileSummary.profile, sectionSummary.id);
        expect(
          section.learning_map.model_used,
          `${profileSummary.profile}/${sectionSummary.id} missing model_used`,
        ).toBeTruthy();
        expect(
          section.learning_map.generated_at,
          `${profileSummary.profile}/${sectionSummary.id} missing generated_at`,
        ).toBeTruthy();
      }
    }
  });
});
